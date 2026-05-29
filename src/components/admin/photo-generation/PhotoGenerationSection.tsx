import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useImagePrompts } from "@/hooks/useImagePrompts";
import { useImageReferences } from "@/hooks/useImageReferences";
import { useImageGeneration } from "@/hooks/useImageGeneration";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sparkles, Loader2, Trash2, Wand2, Check, ImageIcon, Plus, Upload, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Cache natural dimensions across renders
const dimsCache = new Map<string, { w: number; h: number }>();
function ImageDims({ url, className = "" }: { url: string | null | undefined; className?: string }) {
  const [dims, setDims] = useState<{ w: number; h: number } | null>(() => (url ? dimsCache.get(url) ?? null : null));
  useEffect(() => {
    if (!url) { setDims(null); return; }
    const cached = dimsCache.get(url);
    if (cached) { setDims(cached); return; }
    const img = new Image();
    let cancelled = false;
    img.onload = () => {
      const d = { w: img.naturalWidth, h: img.naturalHeight };
      dimsCache.set(url, d);
      if (!cancelled) setDims(d);
    };
    img.src = url;
    return () => { cancelled = true; };
  }, [url]);
  if (!url) return null;
  return (
    <div className={`text-[10px] text-muted-foreground tabular-nums ${className}`}>
      {dims ? `${dims.w}×${dims.h}` : "…"}
    </div>
  );
}
import { toast } from "sonner";
import { KIE_MODELS, DEFAULT_USD_RUB, formatRub } from "./models";
import { PromptsManager } from "./PromptsManager";
import { ReferencesManager } from "./ReferencesManager";
import { PlaygroundChat } from "./PlaygroundChat";

interface ProductLite { id: string; name: string; images: string[] | null; sku?: string | null; }

interface PhotoRow {
  id: string;
  product_id: string;
  product_name: string;
  index: number;
  source_url: string | null;
  prompt_id: string | null;
  reference_id: string | null;
  prompt: string;
  reference_image_url: string | null;
  extra_images: string[]; // дополнительные изображения (#3, #4, ...)
}

interface SavedJob { id: string; product_id: string; prompt: string; result_image_url: string; created_at: string; }

const ASPECT_PRESETS = ["1:1", "16:9", "9:16", "4:3", "3:4", "2:3", "3:2", "21:9"] as const;

interface Props { storeId: string; preselectedProductId?: string | null; onOpenInAvito?: (productId: string) => void; }

export function PhotoGenerationSection({ storeId, preselectedProductId, onOpenInAvito }: Props) {
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState<PhotoRow[]>([]);
  const [aspect, setAspect] = useState<string>("1:1");
  const [globalPromptId, setGlobalPromptId] = useState<string | null>(null);
  const [globalReferenceId, setGlobalReferenceId] = useState<string | null>(null);
  const [globalPromptText, setGlobalPromptText] = useState("");
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]);
  const [localJobs, setLocalJobs] = useState<SavedJob[]>([]);
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  const [modelId, setModelId] = useState<string>(KIE_MODELS[0].id);
  const [usdRub, setUsdRub] = useState<number>(() => {
    const s = typeof window !== "undefined" ? Number(localStorage.getItem("kie_usd_rub")) : NaN;
    return Number.isFinite(s) && s > 0 ? s : DEFAULT_USD_RUB;
  });

  const selectedModel = useMemo(() => KIE_MODELS.find((m) => m.id === modelId) ?? KIE_MODELS[0], [modelId]);
  const pricePerImageRub = selectedModel.priceUsd * usdRub;

  const { prompts } = useImagePrompts(storeId);
  const { refs } = useImageReferences(storeId);
  const { results, running, progress, generateBatch, clearResult } = useImageGeneration();

  const localJobsKey = useMemo(() => `image_generation_pending_v1:${storeId}`, [storeId]);

  const persistLocalJobs = useCallback((jobs: SavedJob[]) => {
    setLocalJobs(jobs);
    try { localStorage.setItem(localJobsKey, JSON.stringify(jobs)); } catch { /* ignore unavailable localStorage */ }
  }, [localJobsKey]);

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
        toast.error(error.message);
        setLoadingProducts(false);
        return;
      }
      let list = (data ?? []) as ProductLite[];
      // Ensure preselected product is present even if inactive / outside the first 2000
      if (preselectedProductId && !list.some((p) => p.id === preselectedProductId)) {
        const { data: extra } = await supabase
          .from("products")
          .select("id, name, images, sku")
          .eq("id", preselectedProductId)
          .maybeSingle();
        if (extra) list = [extra as ProductLite, ...list];
      }
      setProducts(list);
      if (preselectedProductId) {
        setSelectedIds(new Set([preselectedProductId]));
        const target = list.find((p) => p.id === preselectedProductId);
        if (target) setSearch(target.name);
        else toast.warning("Товар не найден в ассортименте");
      }
      setLoadingProducts(false);
    })();
    return () => { mounted = false; };
  }, [storeId, preselectedProductId]);


  const loadJobs = async (ids: string[]) => {
    if (ids.length === 0) { setSavedJobs([]); return; }
    const { data, error } = await supabase
      .from("image_generation_jobs" as never)
      .select("id, product_id, prompt, result_image_url, created_at, status, approved, hidden")
      .in("product_id", ids)
      .eq("status", "success")
      .eq("approved", false)
      .eq("hidden", false)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) { setSavedJobs([]); return; }
    setSavedJobs(((data ?? []) as unknown as SavedJob[]).filter((j) => j.result_image_url));
  };

  useEffect(() => { loadJobs(Array.from(selectedIds)); }, [selectedIds, results]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(localJobsKey);
      setLocalJobs(raw ? JSON.parse(raw) : []);
    } catch { setLocalJobs([]); }
  }, [localJobsKey]);

  useEffect(() => {
    const additions: SavedJob[] = [];
    rows.forEach((row) => {
      const res = results[row.id];
      if (res?.status === "success" && res.url) {
        additions.push({
          id: `local:${row.id}:${res.url}`,
          product_id: row.product_id,
          prompt: row.prompt,
          result_image_url: res.url,
          created_at: new Date().toISOString(),
        });
      }
    });
    if (!additions.length) return;
    const existing = new Set(localJobs.map((j) => j.id));
    const unique = additions.filter((j) => !existing.has(j.id));
    if (unique.length) persistLocalJobs([...unique, ...localJobs].slice(0, 200));
  }, [results, rows, localJobs, persistLocalJobs]);

  useEffect(() => {
    const newRows: PhotoRow[] = [];
    products.filter((p) => selectedIds.has(p.id)).forEach((p) => {
      const imgs = (p.images ?? []).filter(Boolean);
      if (imgs.length === 0) {
        newRows.push({
          id: `${p.id}::nofoto`, product_id: p.id, product_name: p.name, index: 0,
          source_url: null, prompt_id: null, reference_id: null, prompt: "", reference_image_url: null, extra_images: [],
        });
      } else {
        imgs.forEach((url, idx) => {
          newRows.push({
            id: `${p.id}::${idx}`, product_id: p.id, product_name: p.name, index: idx,
            source_url: url, prompt_id: null, reference_id: null, prompt: "", reference_image_url: null, extra_images: [],
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
    setSelectedIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  const updateRow = (id: string, patch: Partial<PhotoRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const applyPromptToRow = (rowId: string, promptId: string) => {
    const p = prompts.find((x) => x.id === promptId);
    if (!p) return;
    updateRow(rowId, { prompt_id: promptId, prompt: p.prompt_template });
  };

  const applyReferenceToRow = (rowId: string, referenceId: string) => {
    const r = refs.find((x) => x.id === referenceId);
    if (!r) return;
    updateRow(rowId, { reference_id: referenceId, reference_image_url: r.image_url });
  };

  const applyGlobalToAll = () => {
    const p = globalPromptId ? prompts.find((x) => x.id === globalPromptId) : null;
    const r = globalReferenceId ? refs.find((x) => x.id === globalReferenceId) : null;
    const text = globalPromptText.trim() || p?.prompt_template || "";
    if (!text && !r) { toast.info("Выберите промпт/референс или введите текст"); return; }
    setRows((prev) => prev.map((row) => ({
      ...row,
      prompt_id: globalPromptId ?? row.prompt_id,
      reference_id: globalReferenceId ?? row.reference_id,
      prompt: text || row.prompt,
      reference_image_url: r?.image_url ?? row.reference_image_url,
    })));
    toast.success("Применено ко всем фото");
  };

  // Собираем упорядоченный список изображений: #1 = товар, #2 = референс, #3+ = доп.
  const composeImages = (r: PhotoRow): string[] => {
    const list: string[] = [];
    if (r.source_url) list.push(r.source_url);
    if (r.reference_image_url) list.push(r.reference_image_url);
    for (const u of r.extra_images) if (u) list.push(u);
    return list;
  };

  const buildTask = (r: PhotoRow) => ({
    id: r.id,
    product_id: r.product_id,
    source_image_url: r.source_url,
    reference_image_url: r.reference_image_url,
    image_urls: composeImages(r),
    prompt: r.prompt,
  });

  const generateAll = async () => {
    const tasks = rows.filter((r) => r.prompt.trim() || r.reference_image_url || r.extra_images.length > 0);
    if (!tasks.length) { toast.info("Заполните промпт или выберите референс хотя бы для одной строки"); return; }
    // Запускаем все одновременно (параллельно), не блокируя интерфейс
    generateBatch(tasks.map(buildTask), { aspect_ratio: aspect, model: modelId });
  };

  const generateRow = (row: PhotoRow) => {
    if (!row.prompt.trim() && !row.reference_image_url && row.extra_images.length === 0) {
      toast.info("Нужен промпт или изображение"); return;
    }
    // Не ждём — позволяем запускать несколько генераций параллельно
    generateBatch([buildTask(row)], { aspect_ratio: aspect, model: modelId });
  };

  const addExtraImageFromFile = async (rowId: string, file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      setRows((prev) => prev.map((r) => r.id === rowId ? { ...r, extra_images: [...r.extra_images, dataUrl] } : r));
    };
    reader.readAsDataURL(file);
  };

  const addExtraImageFromRef = (rowId: string, url: string) => {
    setRows((prev) => prev.map((r) => r.id === rowId ? { ...r, extra_images: [...r.extra_images, url] } : r));
  };

  const removeExtraImage = (rowId: string, idx: number) => {
    setRows((prev) => prev.map((r) => r.id === rowId ? { ...r, extra_images: r.extra_images.filter((_, i) => i !== idx) } : r));
  };


  type Item = { key: string; productId: string; url: string; productName: string; jobId?: string; taskId?: string };
  const approvable: Item[] = useMemo(() => {
    const fromJobs = savedJobs.map((j) => {
      const prod = products.find((p) => p.id === j.product_id);
      return { key: `job:${j.id}`, productId: j.product_id, url: j.result_image_url, productName: prod?.name ?? "товар", jobId: j.id };
    });
    const fromLive = localJobs
      .filter((j) => selectedIds.has(j.product_id))
      .map((j) => {
        const prod = products.find((p) => p.id === j.product_id);
        return { key: `local:${j.id}`, productId: j.product_id, url: j.result_image_url, productName: prod?.name ?? "товар", taskId: j.id };
      });
    return [...fromLive, ...fromJobs];
  }, [savedJobs, localJobs, selectedIds, products]);

  const toggleJob = (k: string) => {
    setSelectedJobIds((prev) => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  };

  const addSelectedToProducts = async () => {
    if (selectedJobIds.size === 0) { toast.info("Не выбрано"); return; }
    const byProduct = new Map<string, { urls: string[]; jobIds: string[] }>();
    for (const item of approvable) {
      if (!selectedJobIds.has(item.key)) continue;
      const e = byProduct.get(item.productId) ?? { urls: [], jobIds: [] };
      e.urls.push(item.url);
      if (item.jobId) e.jobIds.push(item.jobId);
      byProduct.set(item.productId, e);
    }
    let ok = 0; const allJobIds: string[] = []; const allTaskIds: string[] = [];
    for (const [pid, { urls, jobIds }] of byProduct) {
      const prod = products.find((p) => p.id === pid);
      const next = [...(prod?.images ?? []), ...urls];
      const { error } = await supabase.from("products").update({ images: next }).eq("id", pid);
      if (error) toast.error(`${prod?.name}: ${error.message}`);
      else { ok++; allJobIds.push(...jobIds); setProducts((prev) => prev.map((p) => p.id === pid ? { ...p, images: next } : p)); }
    }
    if (allJobIds.length) {
      await supabase.from("image_generation_jobs" as never).update({ approved: true } as never).in("id", allJobIds);
    }
    toast.success(`Добавлено в ${ok} товаров`);
    approvable.forEach((item) => { if (selectedJobIds.has(item.key) && item.taskId) allTaskIds.push(item.taskId); });
    if (allTaskIds.length) persistLocalJobs(localJobs.filter((j) => !allTaskIds.includes(j.id)));
    Object.keys(results).forEach(clearResult);
    setSelectedJobIds(new Set());
    await loadJobs(Array.from(selectedIds));
  };

  const hideJob = async (jobId: string) => {
    await supabase.from("image_generation_jobs" as never).update({ hidden: true } as never).eq("id", jobId);
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
            <Loader2 className="h-4 w-4 animate-spin" />{progress.done} / {progress.total}
          </div>
        )}
      </div>

      <Tabs defaultValue="workspace">
        <TabsList>
          <TabsTrigger value="workspace">Рабочая область</TabsTrigger>
          <TabsTrigger value="prompts">Шаблоны промптов</TabsTrigger>
          <TabsTrigger value="references">Референсы</TabsTrigger>
          <TabsTrigger value="chat">AI-чат</TabsTrigger>
        </TabsList>

        <TabsContent value="workspace" className="space-y-3">
          <div className="rounded-lg border border-border bg-card p-3 space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1 min-w-[260px]">
                <Label className="text-xs">Модель генерации</Label>
                <Select value={modelId} onValueChange={setModelId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {KIE_MODELS.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.label} · {formatRub(m.priceUsd * usdRub)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Курс USD → ₽</Label>
                <Input type="number" min={1} step={0.5} value={usdRub} className="w-24"
                  onChange={(e) => {
                    const v = Number(e.target.value) || DEFAULT_USD_RUB;
                    setUsdRub(v);
                    try { localStorage.setItem("kie_usd_rub", String(v)); } catch { /* ignore unavailable localStorage */ }
                  }} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Соотношение</Label>
                <Select value={aspect} onValueChange={setAspect}>
                  <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>{ASPECT_PRESETS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[200px] rounded-md bg-muted/50 px-3 py-2 text-sm">
                <div className="text-xs text-muted-foreground">Оценка расхода</div>
                <div className="font-semibold">
                  {formatRub(pricePerImageRub)} × {rows.length} = <span className="text-primary">{formatRub(pricePerImageRub * rows.length)}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1 min-w-[200px]">
                <Label className="text-xs">Промпт-шаблон (для всех)</Label>
                <Select value={globalPromptId ?? ""} onValueChange={(v) => setGlobalPromptId(v || null)}>
                  <SelectTrigger><SelectValue placeholder="— не выбрано —" /></SelectTrigger>
                  <SelectContent>
                    {prompts.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.is_system ? "★ " : ""}{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 min-w-[200px]">
                <Label className="text-xs">Референс (для всех)</Label>
                <Select value={globalReferenceId ?? ""} onValueChange={(v) => setGlobalReferenceId(v || null)}>
                  <SelectTrigger><SelectValue placeholder="— не выбрано —" /></SelectTrigger>
                  <SelectContent>
                    {refs.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.is_system ? "★ " : ""}{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[200px] space-y-1">
                <Label className="text-xs">или свой текст промпта</Label>
                <Input value={globalPromptText} onChange={(e) => setGlobalPromptText(e.target.value)}
                  placeholder="Применить ко всем..." />
              </div>
              <Button variant="secondary" onClick={applyGlobalToAll}>Применить ко всем</Button>
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
                      {p.images?.[0]
                        ? (
                          <div className="flex flex-col items-center">
                            <img src={p.images[0]} alt="" className="h-8 w-8 rounded object-cover" />
                            <ImageDims url={p.images[0]} />
                          </div>
                        )
                        : <div className="h-8 w-8 rounded bg-muted" />}
                      <span className="text-sm flex-1 line-clamp-1">{p.name}</span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            </div>

            <div className="col-span-12 lg:col-span-5 rounded-lg border border-border bg-card p-3 space-y-2">
              <h3 className="font-semibold text-sm">Фото / промпты</h3>
              <ScrollArea className="h-[600px]">
                <div className="space-y-3 pr-2">
                  {rows.length === 0 && <div className="text-sm text-muted-foreground">Выберите товары слева</div>}
                  {rows.map((r) => {
                    const imgs = composeImages(r);
                    const rowPending = results[r.id]?.status === "pending";
                    return (
                    <div key={r.id} className="rounded-lg border border-border p-2 space-y-2">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="text-sm font-medium truncate">{r.product_name}</div>
                          <div className="flex gap-1">
                            <Select value={r.prompt_id ?? ""} onValueChange={(v) => v && applyPromptToRow(r.id, v)}>
                              <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Шаблон промпта..." /></SelectTrigger>
                              <SelectContent>
                                {prompts.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>{p.is_system ? "★ " : ""}{p.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select value={r.reference_id ?? ""} onValueChange={(v) => v && applyReferenceToRow(r.id, v)}>
                              <SelectTrigger className="h-7 text-xs w-32"><SelectValue placeholder="Референс →#2" /></SelectTrigger>
                              <SelectContent>
                                {refs.map((x) => (
                                  <SelectItem key={x.id} value={x.id}>{x.is_system ? "★ " : ""}{x.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      {/* Полоса изображений с номерами (#1, #2, #3, ...) */}
                      <div className="flex flex-wrap gap-2 items-start rounded-md bg-muted/30 p-2">
                        {imgs.length === 0 && (
                          <div className="text-[11px] text-muted-foreground py-3 px-1">Нет изображений — добавьте товарное фото или референс</div>
                        )}
                        {imgs.map((url, i) => {
                          const sourceIdx = r.source_url ? 0 : -1;
                          const refIdx = r.reference_image_url ? (r.source_url ? 1 : 0) : -1;
                          const isSource = i === sourceIdx;
                          const isReference = i === refIdx;
                          const extraIdx = i - (r.source_url ? 1 : 0) - (r.reference_image_url ? 1 : 0);
                            <div key={`${url}-${i}`} className="relative flex flex-col items-center gap-0.5">
                              <div className="absolute -top-1 -left-1 z-10 bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center shadow">
                                #{i + 1}
                              </div>
                              <img src={url} alt="" className={`h-16 w-16 rounded object-cover border ${isSource ? "border-emerald-500" : isReference ? "border-primary" : "border-amber-500"}`} />
                              <ImageDims url={url} />
                              <div className="text-[9px] text-muted-foreground">
                                {isSource ? "товар" : isReference ? "референс" : "доп."}
                              </div>
                              {!isSource && (
                                <button
                                  onClick={() => {
                                    if (isReference) updateRow(r.id, { reference_id: null, reference_image_url: null });
                                    else removeExtraImage(r.id, extraIdx);
                                  }}
                                  className="absolute -top-1 -right-1 z-10 bg-destructive text-destructive-foreground rounded-full h-4 w-4 flex items-center justify-center"
                                  title="Убрать"
                                >
                                  <X className="h-2.5 w-2.5" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                        {/* Кнопка "Добавить изображение" */}
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className="h-16 w-16 rounded border-2 border-dashed border-border hover:border-primary flex flex-col items-center justify-center text-muted-foreground hover:text-primary transition-colors">
                              <Plus className="h-4 w-4" />
                              <span className="text-[9px]">+ фото</span>
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-72 p-2 space-y-2">
                            <div className="text-xs font-medium">Добавить изображение #{imgs.length + 1}</div>
                            <label className="flex items-center gap-2 text-xs p-2 rounded hover:bg-muted cursor-pointer border border-border">
                              <Upload className="h-3 w-3" /> Загрузить файл с компьютера
                              <input
                                type="file" accept="image/*" className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) addExtraImageFromFile(r.id, f);
                                  e.target.value = "";
                                }}
                              />
                            </label>
                            {refs.length > 0 && (
                              <div className="space-y-1">
                                <div className="text-[10px] text-muted-foreground">Из референсов:</div>
                                <div className="grid grid-cols-4 gap-1 max-h-48 overflow-y-auto">
                                  {refs.map((x) => (
                                    <button
                                      key={x.id}
                                      onClick={() => addExtraImageFromRef(r.id, x.image_url)}
                                      className="relative group"
                                      title={x.name}
                                    >
                                      <img src={x.image_url} alt={x.name} className="h-14 w-14 object-cover rounded border hover:border-primary" />
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </PopoverContent>
                        </Popover>
                      </div>

                      <Textarea
                        value={r.prompt}
                        onChange={(e) => updateRow(r.id, { prompt: e.target.value })}
                        placeholder={imgs.length >= 2
                          ? `Опиши задачу. Обращайся к изображениям по номерам: #1 — товар, #2 — референс${imgs.length > 2 ? `, #3…#${imgs.length} — доп.` : ""}. Пример: «Помести товар с #1 в руки персонажа с #2, фон как на #3»`
                          : "Промпт... ({product_name} подставится автоматически)"
                        }
                        rows={3} className="text-xs"
                      />
                      <div className="flex items-center justify-between gap-1">
                        <div className="text-[10px] text-muted-foreground">
                          {imgs.length > 0 && `Передаётся ${imgs.length} изображени${imgs.length === 1 ? "е" : imgs.length < 5 ? "я" : "й"} в порядке #1…#${imgs.length}`}
                        </div>
                        <div className="flex gap-1">
                          {onOpenInAvito && (
                            <Button size="sm" variant="ghost" onClick={() => onOpenInAvito(r.product_id)} title="Открыть фото объявления в разделе Авито">
                              <ImageIcon className="h-3 w-3" />В Авито
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => generateRow(r)} disabled={rowPending}>
                            {rowPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                            Генерировать
                          </Button>
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            <div className="col-span-12 lg:col-span-4 rounded-lg border border-border bg-card p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Сгенерированные</h3>
                <Button size="sm" onClick={addSelectedToProducts} disabled={selectedJobIds.size === 0}>
                  <Check className="h-3 w-3" />Добавить ({selectedJobIds.size})
                </Button>
              </div>
              <ScrollArea className="h-[600px]">
                <div className="space-y-2 pr-2">
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
                      Выберите товары и нажмите «Сгенерировать». Готовые фото будут здесь до одобрения.
                    </div>
                  )}
                  {approvable.map((item) => (
                    <div key={item.key} className="rounded-lg border border-border p-2 space-y-1">
                      <div className="text-xs text-muted-foreground truncate">{item.productName}</div>
                      <img src={item.url} alt="" className="w-full rounded object-cover" />
                      <ImageDims url={item.url} />
                      <div className="flex items-center justify-between gap-2">
                        <label className="flex items-center gap-1 text-xs cursor-pointer">
                          <Checkbox checked={selectedJobIds.has(item.key)} onCheckedChange={() => toggleJob(item.key)} />
                          Одобрить
                        </label>
                        <Button size="sm" variant="ghost" onClick={() => item.jobId ? hideJob(item.jobId) : item.taskId ? persistLocalJobs(localJobs.filter((j) => j.id !== item.taskId)) : undefined}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="prompts"><PromptsManager storeId={storeId} /></TabsContent>
        <TabsContent value="references"><ReferencesManager storeId={storeId} /></TabsContent>
        <TabsContent value="chat"><PlaygroundChat storeId={storeId} /></TabsContent>
      </Tabs>
    </div>
  );
}
