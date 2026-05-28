import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useImageTemplates, type ImageTemplate } from "@/hooks/useImageTemplates";
import { useImageGeneration } from "@/hooks/useImageGeneration";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sparkles, Loader2, Trash2, Plus, Wand2, Check, Pencil } from "lucide-react";
import { toast } from "sonner";
import { KIE_MODELS, DEFAULT_USD_RUB, formatRub } from "./models";

interface ProductLite {
  id: string;
  name: string;
  images: string[] | null;
  sku?: string | null;
}

interface PhotoRow {
  id: string; // product_id::index
  product_id: string;
  product_name: string;
  index: number;
  source_url: string | null;
  template_id: string | null;
  prompt: string;
}

const ASPECT_PRESETS = ["1:1", "16:9", "9:16", "4:3", "3:4", "2:3", "3:2", "21:9"] as const;

interface Props {
  storeId: string;
  preselectedProductId?: string | null;
}

export function PhotoGenerationSection({ storeId, preselectedProductId }: Props) {
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState<PhotoRow[]>([]);
  const [aspect, setAspect] = useState<string>("1:1");
  const [customW, setCustomW] = useState<number | null>(null);
  const [customH, setCustomH] = useState<number | null>(null);
  const [globalPrompt, setGlobalPrompt] = useState("");
  const [globalTemplateId, setGlobalTemplateId] = useState<string | null>(null);
  const [selectedResults, setSelectedResults] = useState<Set<string>>(new Set());
  const [modelId, setModelId] = useState<string>(KIE_MODELS[0].id);
  const [usdRub, setUsdRub] = useState<number>(() => {
    const saved = typeof window !== "undefined" ? Number(localStorage.getItem("kie_usd_rub")) : NaN;
    return Number.isFinite(saved) && saved > 0 ? saved : DEFAULT_USD_RUB;
  });

  const selectedModel = useMemo(
    () => KIE_MODELS.find((m) => m.id === modelId) ?? KIE_MODELS[0],
    [modelId],
  );
  const pricePerImageRub = selectedModel.priceUsd * usdRub;

  const { templates, create, update, remove } = useImageTemplates(storeId);
  const { results, running, progress, generateBatch, clearResult } = useImageGeneration();

  // Load products
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingProducts(true);
      const { data, error } = await supabase
        .from("products")
        .select("id, name, images, sku")
        .eq("store_id", storeId)
        .is("deleted_at", null)
        .eq("is_active", true)
        .order("name")
        .limit(2000);
      if (!mounted) return;
      if (error) {
        toast.error(`Ошибка загрузки товаров: ${error.message}`);
      } else {
        setProducts((data ?? []) as ProductLite[]);
        if (preselectedProductId) {
          setSelectedIds(new Set([preselectedProductId]));
        }
      }
      setLoadingProducts(false);
    })();
    return () => {
      mounted = false;
    };
  }, [storeId, preselectedProductId]);

  // Build rows when selection changes
  useEffect(() => {
    const newRows: PhotoRow[] = [];
    products
      .filter((p) => selectedIds.has(p.id))
      .forEach((p) => {
        const imgs = (p.images ?? []).filter((u) => !!u);
        if (imgs.length === 0) {
          newRows.push({
            id: `${p.id}::nofoto`,
            product_id: p.id,
            product_name: p.name,
            index: 0,
            source_url: null,
            template_id: null,
            prompt: "",
          });
        } else {
          imgs.forEach((url, idx) => {
            newRows.push({
              id: `${p.id}::${idx}`,
              product_id: p.id,
              product_name: p.name,
              index: idx,
              source_url: url,
              template_id: null,
              prompt: "",
            });
          });
        }
      });
    setRows((prev) => {
      // preserve existing prompt/template for rows that still exist
      const prevById = new Map(prev.map((r) => [r.id, r]));
      return newRows.map((r) => prevById.get(r.id) ?? r);
    });
  }, [selectedIds, products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q));
  }, [products, search]);

  const toggleProduct = (id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const updateRow = (id: string, patch: Partial<PhotoRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const applyTemplateToRow = (rowId: string, tpl: ImageTemplate) => {
    updateRow(rowId, { template_id: tpl.id, prompt: tpl.prompt_template });
  };

  const applyGlobalToAll = () => {
    if (!globalPrompt.trim() && !globalTemplateId) {
      toast.info("Введите промпт или выберите шаблон");
      return;
    }
    const tpl = templates.find((t) => t.id === globalTemplateId);
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        template_id: globalTemplateId,
        prompt: globalPrompt.trim() || tpl?.prompt_template || r.prompt,
      })),
    );
    toast.success("Применено ко всем фото");
  };

  const generateAll = async () => {
    const tasks = rows.filter((r) => r.prompt.trim());
    if (!tasks.length) {
      toast.info("Заполните хотя бы один промпт");
      return;
    }
    await generateBatch(
      tasks.map((r) => ({
        id: r.id,
        product_id: r.product_id,
        source_image_url: r.source_url,
        prompt: r.prompt,
      })),
      {
        aspect_ratio: aspect,
        width: customW ?? undefined,
        height: customH ?? undefined,
        model: modelId,
      },
    );
  };

  const generateRow = async (row: PhotoRow) => {
    if (!row.prompt.trim()) {
      toast.info("Введите промпт");
      return;
    }
    await generateBatch(
      [{ id: row.id, product_id: row.product_id, source_image_url: row.source_url, prompt: row.prompt }],
      { aspect_ratio: aspect, width: customW ?? undefined, height: customH ?? undefined, model: modelId },
    );
  };

  const toggleResult = (taskId: string) => {
    setSelectedResults((prev) => {
      const n = new Set(prev);
      if (n.has(taskId)) n.delete(taskId);
      else n.add(taskId);
      return n;
    });
  };

  const addSelectedToProducts = async () => {
    // Group selected results by product_id
    const byProduct = new Map<string, string[]>();
    for (const taskId of selectedResults) {
      const r = results[taskId];
      if (!r || r.status !== "success" || !r.url) continue;
      const productId = taskId.split("::")[0];
      const arr = byProduct.get(productId) ?? [];
      arr.push(r.url);
      byProduct.set(productId, arr);
    }
    if (byProduct.size === 0) {
      toast.info("Не выбрано ни одного результата");
      return;
    }

    let ok = 0;
    for (const [pid, urls] of byProduct) {
      const prod = products.find((p) => p.id === pid);
      const current = prod?.images ?? [];
      const next = [...current, ...urls];
      const { error } = await supabase.from("products").update({ images: next }).eq("id", pid);
      if (error) {
        toast.error(`${prod?.name}: ${error.message}`);
      } else {
        ok += 1;
        // update local cache so the UI reflects the new images instantly
        setProducts((prev) => prev.map((p) => (p.id === pid ? { ...p, images: next } : p)));
      }
    }
    toast.success(`Добавлено в ${ok} товаров`);
    setSelectedResults(new Set());
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">Генерация фотографий</h2>
        </div>
        {running && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {progress.done} / {progress.total}
          </div>
        )}
      </div>

      <Tabs defaultValue="workspace">
        <TabsList>
          <TabsTrigger value="workspace">Рабочая область</TabsTrigger>
          <TabsTrigger value="templates">Шаблоны промптов</TabsTrigger>
        </TabsList>

        <TabsContent value="workspace" className="space-y-3">
          {/* Global params bar */}
          <div className="rounded-lg border border-border bg-card p-3 space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Соотношение сторон</Label>
                <Select value={aspect} onValueChange={setAspect}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASPECT_PRESETS.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">Своё</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {aspect === "custom" && (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs">Ширина</Label>
                    <Input type="number" min={512} max={1920} step={32} value={customW ?? ""} onChange={(e) => setCustomW(e.target.value ? Number(e.target.value) : null)} className="w-24" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Высота</Label>
                    <Input type="number" min={512} max={1920} step={32} value={customH ?? ""} onChange={(e) => setCustomH(e.target.value ? Number(e.target.value) : null)} className="w-24" />
                  </div>
                </>
              )}
              <div className="flex-1 min-w-[200px] space-y-1">
                <Label className="text-xs">Массовый промпт</Label>
                <Input value={globalPrompt} onChange={(e) => setGlobalPrompt(e.target.value)} placeholder="Применить ко всем фото..." />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Массовый шаблон</Label>
                <Select value={globalTemplateId ?? ""} onValueChange={(v) => setGlobalTemplateId(v || null)}>
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Выбрать..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.is_system ? "★ " : ""}
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="secondary" onClick={applyGlobalToAll}>
                Применить ко всем
              </Button>
              <Button onClick={generateAll} disabled={running || rows.length === 0}>
                <Wand2 className="h-4 w-4" />
                Сгенерировать всё
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-3">
            {/* Left: product picker */}
            <div className="col-span-12 lg:col-span-3 rounded-lg border border-border bg-card p-3">
              <Input placeholder="Поиск товара..." value={search} onChange={(e) => setSearch(e.target.value)} className="mb-2" />
              <div className="text-xs text-muted-foreground mb-2">
                Выбрано: {selectedIds.size}
              </div>
              <ScrollArea className="h-[600px]">
                <div className="space-y-1 pr-2">
                  {loadingProducts && <div className="text-sm text-muted-foreground">Загрузка...</div>}
                  {filtered.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer">
                      <Checkbox checked={selectedIds.has(p.id)} onCheckedChange={() => toggleProduct(p.id)} />
                      {p.images?.[0] ? (
                        <img src={p.images[0]} alt="" className="h-8 w-8 rounded object-cover" />
                      ) : (
                        <div className="h-8 w-8 rounded bg-muted" />
                      )}
                      <span className="text-sm flex-1 line-clamp-1">{p.name}</span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Center: rows */}
            <div className="col-span-12 lg:col-span-5 rounded-lg border border-border bg-card p-3 space-y-2">
              <h3 className="font-semibold text-sm">Исходные фото и промпты</h3>
              <ScrollArea className="h-[600px]">
                <div className="space-y-3 pr-2">
                  {rows.length === 0 && <div className="text-sm text-muted-foreground">Выберите товары слева</div>}
                  {rows.map((r) => (
                    <div key={r.id} className="rounded-lg border border-border p-2 space-y-2">
                      <div className="flex items-center gap-2">
                        {r.source_url ? (
                          <img src={r.source_url} alt="" className="h-16 w-16 rounded object-cover flex-shrink-0" />
                        ) : (
                          <div className="h-16 w-16 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">нет фото</div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{r.product_name}</div>
                          <Select value={r.template_id ?? ""} onValueChange={(v) => {
                            const tpl = templates.find((t) => t.id === v);
                            if (tpl) applyTemplateToRow(r.id, tpl);
                          }}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Шаблон..." />
                            </SelectTrigger>
                            <SelectContent>
                              {templates.map((t) => (
                                <SelectItem key={t.id} value={t.id}>
                                  {t.is_system ? "★ " : ""}{t.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Textarea
                        value={r.prompt}
                        onChange={(e) => updateRow(r.id, { prompt: e.target.value })}
                        placeholder="Промпт... ({product_name} подставится автоматически)"
                        rows={2}
                        className="text-xs"
                      />
                      <div className="flex justify-end">
                        <Button size="sm" variant="outline" onClick={() => generateRow(r)} disabled={running}>
                          <Wand2 className="h-3 w-3" />
                          Генерировать
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Right: results */}
            <div className="col-span-12 lg:col-span-4 rounded-lg border border-border bg-card p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Сгенерированные</h3>
                <Button size="sm" onClick={addSelectedToProducts} disabled={selectedResults.size === 0}>
                  <Check className="h-3 w-3" />
                  Добавить ({selectedResults.size})
                </Button>
              </div>
              <ScrollArea className="h-[600px]">
                <div className="space-y-2 pr-2">
                  {Object.keys(results).length === 0 && (
                    <div className="text-sm text-muted-foreground">Здесь появятся результаты генерации</div>
                  )}
                  {rows.map((r) => {
                    const res = results[r.id];
                    if (!res) return null;
                    return (
                      <div key={r.id} className="rounded-lg border border-border p-2 space-y-1">
                        <div className="text-xs text-muted-foreground truncate">{r.product_name}</div>
                        {res.status === "pending" && (
                          <div className="h-32 flex items-center justify-center bg-muted rounded">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                          </div>
                        )}
                        {res.status === "error" && (
                          <div className="h-32 flex items-center justify-center bg-destructive/10 text-destructive text-xs p-2 text-center rounded">
                            {res.error}
                          </div>
                        )}
                        {res.status === "success" && res.url && (
                          <>
                            <img src={res.url} alt="" className="w-full rounded object-cover" />
                            <div className="flex items-center justify-between gap-2">
                              <label className="flex items-center gap-1 text-xs cursor-pointer">
                                <Checkbox checked={selectedResults.has(r.id)} onCheckedChange={() => toggleResult(r.id)} />
                                Выбрать
                              </label>
                              <div className="flex gap-1">
                                <Button size="sm" variant="ghost" onClick={() => generateRow(r)} disabled={running}>
                                  <Wand2 className="h-3 w-3" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => clearResult(r.id)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="templates">
          <TemplatesManager templates={templates} onCreate={create} onUpdate={update} onDelete={remove} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TemplatesManager({
  templates,
  onCreate,
  onUpdate,
  onDelete,
}: {
  templates: ImageTemplate[];
  onCreate: (i: { name: string; prompt_template: string; default_aspect_ratio?: string }) => Promise<void>;
  onUpdate: (id: string, i: Partial<Pick<ImageTemplate, "name" | "prompt_template" | "default_aspect_ratio">>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState<ImageTemplate | null>(null);
  const [draft, setDraft] = useState({ name: "", prompt_template: "", default_aspect_ratio: "1:1" });

  const startNew = () => {
    setEditing(null);
    setDraft({ name: "", prompt_template: "", default_aspect_ratio: "1:1" });
  };
  const startEdit = (t: ImageTemplate) => {
    setEditing(t);
    setDraft({ name: t.name, prompt_template: t.prompt_template, default_aspect_ratio: t.default_aspect_ratio ?? "1:1" });
  };
  const save = async () => {
    if (!draft.name.trim() || !draft.prompt_template.trim()) {
      toast.info("Заполните название и промпт");
      return;
    }
    if (editing && !editing.is_system) {
      await onUpdate(editing.id, draft);
    } else {
      await onCreate(draft);
    }
    setEditing(null);
    setDraft({ name: "", prompt_template: "", default_aspect_ratio: "1:1" });
  };

  return (
    <div className="grid grid-cols-12 gap-3">
      <div className="col-span-12 lg:col-span-5 rounded-lg border border-border bg-card p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Шаблоны</h3>
          <Button size="sm" onClick={startNew}>
            <Plus className="h-4 w-4" />
            Новый
          </Button>
        </div>
        <ScrollArea className="h-[500px]">
          <div className="space-y-1">
            {templates.map((t) => (
              <div key={t.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate flex items-center gap-1">
                    {t.is_system && <Badge variant="secondary" className="text-xs">сист.</Badge>}
                    {t.name}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{t.prompt_template}</div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => startEdit(t)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                {!t.is_system && (
                  <Button size="sm" variant="ghost" onClick={() => onDelete(t.id)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className="col-span-12 lg:col-span-7 rounded-lg border border-border bg-card p-3 space-y-3">
        <h3 className="font-semibold">{editing ? (editing.is_system ? "Создать на основе системного" : "Редактировать") : "Новый шаблон"}</h3>
        <div className="space-y-2">
          <Label>Название</Label>
          <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Промпт (используйте {`{product_name}`} для подстановки названия)</Label>
          <Textarea value={draft.prompt_template} onChange={(e) => setDraft({ ...draft, prompt_template: e.target.value })} rows={6} />
        </div>
        <div className="space-y-2">
          <Label>Соотношение по умолчанию</Label>
          <Select value={draft.default_aspect_ratio} onValueChange={(v) => setDraft({ ...draft, default_aspect_ratio: v })}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ASPECT_PRESETS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={save}>Сохранить</Button>
      </div>
    </div>
  );
}
