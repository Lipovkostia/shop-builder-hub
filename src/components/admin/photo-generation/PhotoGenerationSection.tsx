import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useImageTemplates, type ImageTemplate, type TemplateInput } from "@/hooks/useImageTemplates";
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
import { Sparkles, Loader2, Trash2, Plus, Wand2, Check, Pencil, ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { KIE_MODELS, DEFAULT_USD_RUB, formatRub } from "./models";

interface ProductLite {
  id: string;
  name: string;
  images: string[] | null;
  sku?: string | null;
}

interface PhotoRow {
  id: string;
  product_id: string;
  product_name: string;
  index: number;
  source_url: string | null;
  template_id: string | null;
  prompt: string;
  reference_image_url?: string | null;
}

interface SavedJob {
  id: string;
  product_id: string;
  prompt: string;
  result_image_url: string;
  created_at: string;
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
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]);
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

  const { templates, create, update, remove, uploadReferenceImage } = useImageTemplates(storeId);
  const { results, running, progress, generateBatch, clearResult } = useImageGeneration();

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

  // Load past unapproved jobs for selected products
  const loadJobs = async (ids: string[]) => {
    if (ids.length === 0) {
      setSavedJobs([]);
      return;
    }
    const { data, error } = await supabase
      .from("image_generation_jobs" as any)
      .select("id, product_id, prompt, result_image_url, created_at, status, approved, hidden")
      .in("product_id", ids)
      .eq("status", "success")
      .eq("approved", false)
      .eq("hidden", false)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      console.error("load jobs", error);
      return;
    }
    setSavedJobs(((data ?? []) as any[]).filter((j) => j.result_image_url) as SavedJob[]);
  };

  useEffect(() => {
    loadJobs(Array.from(selectedIds));
  }, [selectedIds, results]);

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
    updateRow(rowId, {
      template_id: tpl.id,
      prompt: tpl.prompt_template,
      reference_image_url: tpl.reference_image_url ?? null,
    });
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
        reference_image_url: tpl?.reference_image_url ?? r.reference_image_url ?? null,
      })),
    );
    toast.success("Применено ко всем фото");
  };

  const buildTask = (r: PhotoRow) => ({
    id: r.id,
    product_id: r.product_id,
    // если есть референс шаблона — используем его как источник для редактирования
    source_image_url: r.reference_image_url || r.source_url,
    prompt: r.prompt,
  });

  const generateAll = async () => {
    const tasks = rows.filter((r) => r.prompt.trim());
    if (!tasks.length) {
      toast.info("Заполните хотя бы один промпт");
      return;
    }
    await generateBatch(tasks.map(buildTask), {
      aspect_ratio: aspect,
      width: customW ?? undefined,
      height: customH ?? undefined,
      model: modelId,
    });
  };

  const generateRow = async (row: PhotoRow) => {
    if (!row.prompt.trim()) {
      toast.info("Введите промпт");
      return;
    }
    await generateBatch([buildTask(row)], {
      aspect_ratio: aspect,
      width: customW ?? undefined,
      height: customH ?? undefined,
      model: modelId,
    });
  };

  // === Approve flow: combine in-memory results + saved jobs ===
  type ApprovableItem = {
    key: string;
    productId: string;
    url: string;
    productName: string;
    jobId?: string;
  };

  const approvable: ApprovableItem[] = useMemo(() => {
    const items: ApprovableItem[] = [];
    // saved jobs from DB
    for (const j of savedJobs) {
      const prod = products.find((p) => p.id === j.product_id);
      items.push({
        key: `job:${j.id}`,
        productId: j.product_id,
        url: j.result_image_url,
        productName: prod?.name ?? "товар",
        jobId: j.id,
      });
    }
    return items;
  }, [savedJobs, products]);

  const toggleJob = (key: string) => {
    setSelectedJobIds((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  };

  const addSelectedToProducts = async () => {
    if (selectedJobIds.size === 0) {
      toast.info("Не выбрано ни одного результата");
      return;
    }
    const byProduct = new Map<string, { urls: string[]; jobIds: string[] }>();
    for (const item of approvable) {
      if (!selectedJobIds.has(item.key)) continue;
      const entry = byProduct.get(item.productId) ?? { urls: [], jobIds: [] };
      entry.urls.push(item.url);
      if (item.jobId) entry.jobIds.push(item.jobId);
      byProduct.set(item.productId, entry);
    }

    let ok = 0;
    const allJobIds: string[] = [];
    for (const [pid, { urls, jobIds }] of byProduct) {
      const prod = products.find((p) => p.id === pid);
      const current = prod?.images ?? [];
      const next = [...current, ...urls];
      const { error } = await supabase.from("products").update({ images: next }).eq("id", pid);
      if (error) {
        toast.error(`${prod?.name}: ${error.message}`);
      } else {
        ok += 1;
        allJobIds.push(...jobIds);
        setProducts((prev) => prev.map((p) => (p.id === pid ? { ...p, images: next } : p)));
      }
    }
    if (allJobIds.length) {
      await supabase
        .from("image_generation_jobs" as any)
        .update({ approved: true } as any)
        .in("id", allJobIds);
    }
    toast.success(`Добавлено в ${ok} товаров`);
    setSelectedJobIds(new Set());
    await loadJobs(Array.from(selectedIds));
  };

  const hideJob = async (jobId: string) => {
    await supabase.from("image_generation_jobs" as any).update({ hidden: true } as any).eq("id", jobId);
    setSavedJobs((prev) => prev.filter((j) => j.id !== jobId));
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
          <div className="rounded-lg border border-border bg-card p-3 space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1 min-w-[280px]">
                <Label className="text-xs">Модель генерации</Label>
                <Select value={modelId} onValueChange={setModelId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KIE_MODELS.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        <span className="flex items-center gap-2">
                          <span>{m.label}</span>
                          <span className="text-xs text-muted-foreground">
                            ~{formatRub(m.priceUsd * usdRub)}/фото
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedModel.description && (
                  <div className="text-[11px] text-muted-foreground">{selectedModel.description}</div>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Курс USD → ₽</Label>
                <Input
                  type="number"
                  min={1}
                  step={0.5}
                  value={usdRub}
                  onChange={(e) => {
                    const v = Number(e.target.value) || DEFAULT_USD_RUB;
                    setUsdRub(v);
                    try { localStorage.setItem("kie_usd_rub", String(v)); } catch {}
                  }}
                  className="w-24"
                />
              </div>
              <div className="flex-1 min-w-[200px] rounded-md bg-muted/50 px-3 py-2 text-sm">
                <div className="text-xs text-muted-foreground">Оценка расхода</div>
                <div className="font-semibold">
                  {formatRub(pricePerImageRub)} × {rows.length} ={" "}
                  <span className="text-primary">{formatRub(pricePerImageRub * rows.length)}</span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  ${selectedModel.priceUsd.toFixed(3)}/фото по тарифу kie.ai
                </div>
              </div>
            </div>

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
                        {t.reference_image_url ? "🖼 " : ""}
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
                Сгенерировать всё ({formatRub(pricePerImageRub * rows.length)})
              </Button>
            </div>
          </div>


          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-12 lg:col-span-3 rounded-lg border border-border bg-card p-3">
              <Input placeholder="Поиск товара..." value={search} onChange={(e) => setSearch(e.target.value)} className="mb-2" />
              <div className="text-xs text-muted-foreground mb-2">Выбрано: {selectedIds.size}</div>
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
                                  {t.is_system ? "★ " : ""}{t.reference_image_url ? "🖼 " : ""}{t.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {r.reference_image_url && (
                          <div className="flex flex-col items-center gap-1">
                            <img src={r.reference_image_url} alt="" className="h-12 w-12 rounded object-cover border-2 border-primary" />
                            <span className="text-[9px] text-primary">референс</span>
                          </div>
                        )}
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

            <div className="col-span-12 lg:col-span-4 rounded-lg border border-border bg-card p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Сгенерированные</h3>
                <Button size="sm" onClick={addSelectedToProducts} disabled={selectedJobIds.size === 0}>
                  <Check className="h-3 w-3" />
                  Добавить ({selectedJobIds.size})
                </Button>
              </div>
              <ScrollArea className="h-[600px]">
                <div className="space-y-2 pr-2">
                  {/* live in-progress results */}
                  {rows.map((r) => {
                    const res = results[r.id];
                    if (!res || res.status === "success") return null;
                    return (
                      <div key={`live:${r.id}`} className="rounded-lg border border-border p-2 space-y-1">
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
                      </div>
                    );
                  })}

                  {approvable.length === 0 && Object.keys(results).length === 0 && (
                    <div className="text-sm text-muted-foreground">
                      Выберите товары и нажмите «Сгенерировать». Готовые фото копятся здесь до одобрения.
                    </div>
                  )}

                  {approvable.map((item) => (
                    <div key={item.key} className="rounded-lg border border-border p-2 space-y-1">
                      <div className="text-xs text-muted-foreground truncate">{item.productName}</div>
                      <img src={item.url} alt="" className="w-full rounded object-cover" />
                      <div className="flex items-center justify-between gap-2">
                        <label className="flex items-center gap-1 text-xs cursor-pointer">
                          <Checkbox
                            checked={selectedJobIds.has(item.key)}
                            onCheckedChange={() => toggleJob(item.key)}
                          />
                          Одобрить
                        </label>
                        {item.jobId && (
                          <Button size="sm" variant="ghost" onClick={() => hideJob(item.jobId!)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="templates">
          <TemplatesManager
            templates={templates}
            onCreate={create}
            onUpdate={update}
            onDelete={remove}
            uploadReferenceImage={uploadReferenceImage}
          />
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
  uploadReferenceImage,
}: {
  templates: ImageTemplate[];
  onCreate: (i: TemplateInput) => Promise<void>;
  onUpdate: (id: string, i: Partial<TemplateInput>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  uploadReferenceImage: (file: File) => Promise<string | null>;
}) {
  const [editing, setEditing] = useState<ImageTemplate | null>(null);
  const [draft, setDraft] = useState<TemplateInput>({
    name: "",
    prompt_template: "",
    default_aspect_ratio: "1:1",
    reference_image_url: null,
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const startNew = () => {
    setEditing(null);
    setDraft({ name: "", prompt_template: "", default_aspect_ratio: "1:1", reference_image_url: null });
  };
  const startEdit = (t: ImageTemplate) => {
    setEditing(t);
    setDraft({
      name: t.name,
      prompt_template: t.prompt_template,
      default_aspect_ratio: t.default_aspect_ratio ?? "1:1",
      reference_image_url: t.reference_image_url ?? null,
    });
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    const url = await uploadReferenceImage(file);
    setUploading(false);
    if (url) setDraft((d) => ({ ...d, reference_image_url: url }));
  };

  const save = async () => {
    if (!draft.name.trim()) {
      toast.info("Укажите название шаблона");
      return;
    }
    if (!draft.prompt_template.trim() && !draft.reference_image_url) {
      toast.info("Добавьте промпт или референс-изображение");
      return;
    }
    setSaving(true);
    try {
      if (editing && !editing.is_system) {
        await onUpdate(editing.id, draft);
      } else {
        await onCreate(draft);
      }
      setEditing(null);
      setDraft({ name: "", prompt_template: "", default_aspect_ratio: "1:1", reference_image_url: null });
    } finally {
      setSaving(false);
    }
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
                {t.reference_image_url ? (
                  <img src={t.reference_image_url} alt="" className="h-10 w-10 rounded object-cover flex-shrink-0" />
                ) : (
                  <div className="h-10 w-10 rounded bg-muted flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate flex items-center gap-1">
                    {t.is_system && <Badge variant="secondary" className="text-xs">сист.</Badge>}
                    {t.reference_image_url && <Badge className="text-xs">🖼 референс</Badge>}
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
          <Textarea
            value={draft.prompt_template}
            onChange={(e) => setDraft({ ...draft, prompt_template: e.target.value })}
            rows={6}
          />
        </div>
        <div className="space-y-2">
          <Label>Референс-изображение (необязательно)</Label>
          <div className="text-xs text-muted-foreground">
            ИИ будет опираться на это фото как на образец стиля/композиции вместо фото товара.
          </div>
          <div className="flex items-center gap-3">
            {draft.reference_image_url ? (
              <div className="relative">
                <img src={draft.reference_image_url} alt="" className="h-24 w-24 rounded object-cover border" />
                <button
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, reference_image_url: null }))}
                  className="absolute -top-2 -right-2 rounded-full bg-destructive text-destructive-foreground p-1"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="h-24 w-24 rounded border-2 border-dashed border-border bg-muted/30 flex items-center justify-center text-xs text-muted-foreground">
                нет фото
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
                e.target.value = "";
              }}
            />
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              {draft.reference_image_url ? "Заменить" : "Загрузить"}
            </Button>
          </div>
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
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Сохранить
        </Button>
      </div>
    </div>
  );
}
