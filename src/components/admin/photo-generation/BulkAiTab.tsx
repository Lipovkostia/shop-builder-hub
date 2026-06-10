import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Wand2, Check, X, Trash2, Sparkles, RotateCw, Image as ImageIcon, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useImageGeneration } from "@/hooks/useImageGeneration";
import { useImagePrompts } from "@/hooks/useImagePrompts";
import { KIE_MODELS, DEFAULT_USD_RUB, formatRub } from "./models";

interface Props {
  storeId: string;
}

interface ProductLite {
  id: string;
  name: string;
  images: string[] | null;
  sku?: string | null;
  category_id?: string | null;
}

interface FeedRow {
  id: string;
  product_id: string;
  avito_params: any;
  group_id: string | null;
}

interface AvitoGroup { id: string; name: string; color: string; sort_order: number }
interface Category { id: string; name: string; parent_id: string | null; sort_order: number | null }


type Source = "pricelist" | "avito";

interface BulkTask {
  id: string;            // unique: product_id + index + url
  productId: string;
  productName: string;
  source: Source;        // where the image lives
  imageIndex: number;    // index in source array
  imageUrl: string;
  prompt: string;
}

export function BulkAiTab({ storeId }: Props) {
  const { prompts } = useImagePrompts(storeId);
  const { generateBatch, results, running, progress, clearResult } = useImageGeneration();

  const [source, setSource] = useState<Source>("pricelist");
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [feedRows, setFeedRows] = useState<FeedRow[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [tasks, setTasks] = useState<BulkTask[]>([]);
  const [globalPrompt, setGlobalPrompt] = useState("");
  const [globalPromptId, setGlobalPromptId] = useState<string>("");
  const [avitoGroups, setAvitoGroups] = useState<AvitoGroup[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());


  const [modelId, setModelId] = useState<string>(() => {
    try { return localStorage.getItem("kie_model") || "nano-banana-edit"; } catch { return "nano-banana-edit"; }
  });
  const [usdRub] = useState<number>(() => {
    try { return Number(localStorage.getItem("kie_usd_rub")) || DEFAULT_USD_RUB; } catch { return DEFAULT_USD_RUB; }
  });
  const selectedModel = useMemo(() => KIE_MODELS.find((m) => m.id === modelId) ?? KIE_MODELS[0], [modelId]);
  const pricePerImageRub = selectedModel.priceUsd * usdRub;

  // Load products
  useEffect(() => {
    if (!storeId) return;
    (async () => {
      setLoadingProducts(true);
      try {
        const { data, error } = await supabase
          .from("products")
          .select("id, name, images, sku")
          .eq("store_id", storeId)
          .order("name");
        if (error) throw error;
        setProducts((data as ProductLite[]) ?? []);
      } catch (e: any) {
        toast.error(`Не удалось загрузить товары: ${e.message}`);
      } finally {
        setLoadingProducts(false);
      }
    })();
  }, [storeId]);

  // Load Avito feed rows
  useEffect(() => {
    if (!storeId) return;
    (async () => {
      try {
        const { data, error } = await (supabase as any)
          .from("avito_feed_products")
          .select("id, product_id, avito_params")
          .eq("store_id", storeId);
        if (error) throw error;
        setFeedRows((data as FeedRow[]) ?? []);
      } catch (e: any) {
        console.error("Avito feed load failed:", e);
      }
    })();
  }, [storeId]);

  const feedByProduct = useMemo(() => {
    const m = new Map<string, FeedRow>();
    for (const r of feedRows) if (!m.has(r.product_id)) m.set(r.product_id, r);
    return m;
  }, [feedRows]);

  // Visible product list depends on source
  const visibleProducts = useMemo(() => {
    if (source === "pricelist") return products;
    const ids = new Set(feedRows.map((r) => r.product_id));
    return products.filter((p) => ids.has(p.id));
  }, [products, feedRows, source]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return visibleProducts;
    return visibleProducts.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q)
    );
  }, [visibleProducts, search]);

  const toggleProduct = (id: string) => {
    setSelectedProductIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const getProductImages = useCallback((productId: string): { urls: string[]; from: Source } => {
    if (source === "avito") {
      const fp = feedByProduct.get(productId);
      const curated: string[] | undefined = fp?.avito_params?.avitoImages;
      if (Array.isArray(curated) && curated.length > 0) return { urls: curated, from: "avito" };
    }
    const p = products.find((x) => x.id === productId);
    return { urls: (p?.images ?? []).filter((u) => u && !u.startsWith("data:")), from: source };
  }, [source, feedByProduct, products]);

  const taskKey = (productId: string, idx: number, url: string) => `${productId}::${idx}::${url}`;

  const addTask = (productId: string, idx: number, url: string) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;
    const id = taskKey(productId, idx, url);
    setTasks((prev) => {
      if (prev.some((t) => t.id === id)) return prev;
      return [...prev, {
        id,
        productId,
        productName: prod.name,
        source: getProductImages(productId).from,
        imageIndex: idx,
        imageUrl: url,
        prompt: globalPrompt,
      }];
    });
  };

  const removeTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    clearResult(id);
  };

  const updateTaskPrompt = (id: string, prompt: string) => {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, prompt } : t));
  };

  const applyGlobalPromptToAll = () => {
    const text = globalPromptId
      ? (prompts.find((p) => p.id === globalPromptId)?.prompt_template ?? "")
      : globalPrompt;
    if (!text.trim()) { toast.info("Промпт пустой"); return; }
    setTasks((prev) => prev.map((t) => ({ ...t, prompt: text })));
    toast.success(`Применено к ${tasks.length} задачам`);
  };

  const clearAll = () => {
    tasks.forEach((t) => clearResult(t.id));
    setTasks([]);
  };

  const runGeneration = async () => {
    const ready = tasks.filter((t) => t.prompt.trim().length > 0);
    if (ready.length === 0) { toast.error("Заполните промпты для задач"); return; }
    const batch = ready.map((t) => ({
      id: t.id,
      product_id: t.productId,
      source_image_url: t.imageUrl,
      reference_image_url: null,
      image_urls: [t.imageUrl],
      prompt: t.prompt,
    }));
    await generateBatch(batch, { aspect_ratio: "1:1", model: modelId, quality: "medium" });
  };

  const approveTask = async (task: BulkTask) => {
    const res = results[task.id];
    if (!res || res.status !== "success" || !res.url) return;
    try {
      if (task.source === "avito") {
        const fp = feedByProduct.get(task.productId);
        if (!fp) throw new Error("Нет строки Авито");
        const params = fp.avito_params || {};
        // Берём текущий список фото Авито (или фолбэк на фото товара),
        // и ДОБАВЛЯЕМ сгенерированное в конец — исходное фото остаётся.
        const prod = products.find((p) => p.id === task.productId);
        const baseList: string[] = Array.isArray(params.avitoImages) && params.avitoImages.length > 0
          ? [...params.avitoImages]
          : [...(prod?.images ?? [])];
        if (!baseList.includes(res.url)) baseList.push(res.url);
        const nextParams = { ...params, avitoImages: baseList };
        const { error } = await (supabase as any)
          .from("avito_feed_products")
          .update({ avito_params: nextParams })
          .eq("id", fp.id);
        if (error) throw error;
        setFeedRows((prev) => prev.map((r) => r.id === fp.id ? { ...r, avito_params: nextParams } : r));
        // Также добавим в общий список фото товара, чтобы было видно в карточке.
        if (prod) {
          const prodList = [...(prod.images ?? [])];
          if (!prodList.includes(res.url)) {
            prodList.push(res.url);
            await supabase.from("products").update({ images: prodList }).eq("id", task.productId);
            setProducts((prev) => prev.map((p) => p.id === task.productId ? { ...p, images: prodList } : p));
          }
        }
      } else {
        const prod = products.find((p) => p.id === task.productId);
        const list = [...(prod?.images ?? [])];
        if (!list.includes(res.url)) list.push(res.url);
        const { error } = await supabase.from("products").update({ images: list }).eq("id", task.productId);
        if (error) throw error;
        setProducts((prev) => prev.map((p) => p.id === task.productId ? { ...p, images: list } : p));
      }
      toast.success("Фото добавлено к товару");

      removeTask(task.id);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const regenerateTask = async (task: BulkTask) => {
    if (!task.prompt.trim()) { toast.error("Пустой промпт"); return; }
    clearResult(task.id);
    await generateBatch([{
      id: task.id,
      product_id: task.productId,
      source_image_url: task.imageUrl,
      reference_image_url: null,
      image_urls: [task.imageUrl],
      prompt: task.prompt,
    }], { aspect_ratio: "1:1", model: modelId, quality: "medium" });
  };

  return (
    <div className="space-y-3">
      {/* Top bar */}
      <div className="rounded-lg border border-border bg-card p-3 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1 min-w-[260px]">
            <Label className="text-xs">Модель генерации</Label>
            <Select value={modelId} onValueChange={(v) => { setModelId(v); try { localStorage.setItem("kie_model", v); } catch {} }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-w-[480px] max-h-[420px]">
                {KIE_MODELS.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label} {m.priceUsd > 0 && <>· {formatRub(m.priceUsd * usdRub)}</>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 min-w-[200px]">
            <Label className="text-xs">Шаблон промпта</Label>
            <Select value={globalPromptId} onValueChange={(v) => {
              setGlobalPromptId(v);
              const p = prompts.find((x) => x.id === v);
              if (p) setGlobalPrompt(p.prompt_template);
            }}>
              <SelectTrigger><SelectValue placeholder="— выбрать —" /></SelectTrigger>
              <SelectContent>
                {prompts.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.is_system ? "★ " : ""}{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[220px] space-y-1">
            <Label className="text-xs">или свой промпт (для всех)</Label>
            <Input value={globalPrompt} onChange={(e) => setGlobalPrompt(e.target.value)} placeholder="Например: улучши свет, фон чище, ..." />
          </div>
          <Button variant="secondary" onClick={applyGlobalPromptToAll} disabled={tasks.length === 0}>
            Применить ко всем ({tasks.length})
          </Button>
          <Button onClick={runGeneration} disabled={running || tasks.length === 0}>
            {running
              ? <><Loader2 className="h-4 w-4 animate-spin" />{progress.done}/{progress.total}</>
              : <><Wand2 className="h-4 w-4" />Запустить ({formatRub(pricePerImageRub * tasks.length)})</>}
          </Button>
          <Button variant="ghost" onClick={clearAll} disabled={tasks.length === 0}><Trash2 className="h-4 w-4" />Очистить</Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-3">
        {/* Col 1: source + products */}
        <div className="col-span-12 lg:col-span-3 rounded-lg border border-border bg-card p-3 space-y-2">
          <Tabs value={source} onValueChange={(v) => setSource(v as Source)}>
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="pricelist">Из прайс-листа</TabsTrigger>
              <TabsTrigger value="avito">Из Авито</TabsTrigger>
            </TabsList>
          </Tabs>
          <Input placeholder="Поиск..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="text-xs text-muted-foreground">Выбрано: {selectedProductIds.size}</div>
          <ScrollArea className="h-[560px]">
            <div className="space-y-1 pr-2">
              {loadingProducts && <div className="text-sm text-muted-foreground">Загрузка...</div>}
              {filtered.map((p) => {
                const imgs = source === "avito"
                  ? (feedByProduct.get(p.id)?.avito_params?.avitoImages?.length || p.images?.length || 0)
                  : (p.images?.length || 0);
                return (
                  <label key={p.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted cursor-pointer">
                    <Checkbox checked={selectedProductIds.has(p.id)} onCheckedChange={() => toggleProduct(p.id)} />
                    {p.images?.[0]
                      ? <img src={p.images[0]} alt="" className="h-8 w-8 rounded object-cover" />
                      : <div className="h-8 w-8 rounded bg-muted" />}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs truncate">{p.name}</div>
                      <div className="text-[10px] text-muted-foreground">{imgs} фото</div>
                    </div>
                  </label>
                );
              })}
              {!loadingProducts && filtered.length === 0 && (
                <div className="text-xs text-muted-foreground py-4 text-center">Нет товаров</div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Col 2: thumbnails of selected products → pick photos */}
        <div className="col-span-12 lg:col-span-3 rounded-lg border border-border bg-card p-3 space-y-2">
          <h3 className="font-semibold text-sm flex items-center gap-1">
            <ImageIcon className="h-4 w-4" /> Фото товаров
          </h3>
          <ScrollArea className="h-[610px]">
            <div className="space-y-3 pr-2">
              {selectedProductIds.size === 0 && (
                <div className="text-xs text-muted-foreground">Выберите товары слева</div>
              )}
              {Array.from(selectedProductIds).map((pid) => {
                const prod = products.find((p) => p.id === pid);
                if (!prod) return null;
                const { urls } = getProductImages(pid);
                return (
                  <div key={pid} className="rounded border border-border p-2 space-y-1">
                    <div className="text-xs font-medium truncate">{prod.name}</div>
                    <div className="text-[10px] text-muted-foreground">{urls.length} фото · клик = в задачи</div>
                    <div className="grid grid-cols-3 gap-1">
                      {urls.length === 0 && (
                        <div className="col-span-3 text-[10px] text-muted-foreground py-2">Нет фото</div>
                      )}
                      {urls.map((url, idx) => {
                        const key = taskKey(pid, idx, url);
                        const inTasks = tasks.some((t) => t.id === key);
                        return (
                          <button
                            key={`${url}-${idx}`}
                            type="button"
                            onClick={() => addTask(pid, idx, url)}
                            className={`relative aspect-square rounded overflow-hidden border-2 ${inTasks ? "border-primary" : "border-transparent hover:border-border"}`}
                            title={`#${idx + 1}`}
                          >
                            <img src={url} alt="" className="w-full h-full object-cover" />
                            <div className="absolute top-0 left-0 bg-background/90 text-[9px] px-1 rounded-br">#{idx + 1}</div>
                            {inTasks && (
                              <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                <Check className="h-4 w-4 text-primary" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Col 3 + 4 + 5 combined: per-task row with photo + prompt + result */}
        <div className="col-span-12 lg:col-span-6 rounded-lg border border-border bg-card p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm flex items-center gap-1">
              <Sparkles className="h-4 w-4 text-primary" />
              Задачи генерации ({tasks.length})
            </h3>
          </div>
          <ScrollArea className="h-[610px]">
            <div className="space-y-2 pr-2">
              {tasks.length === 0 && (
                <div className="text-xs text-muted-foreground py-6 text-center">
                  Кликайте по фото в средней колонке, чтобы добавить их сюда
                </div>
              )}
              {tasks.map((t) => {
                const res = results[t.id];
                return (
                  <div key={t.id} className="rounded border border-border p-2 grid grid-cols-12 gap-2 items-start">
                    {/* Исходное фото */}
                    <div className="col-span-2 space-y-1">
                      <img src={t.imageUrl} alt="" className="w-full aspect-square object-cover rounded border" />
                      <div className="text-[10px] text-muted-foreground truncate" title={t.productName}>
                        {t.productName}
                      </div>
                      <div className="text-[9px] text-muted-foreground">#{t.imageIndex + 1} · {t.source === "avito" ? "Авито" : "прайс"}</div>
                    </div>
                    {/* Промпт */}
                    <div className="col-span-5 space-y-1">
                      <Textarea
                        value={t.prompt}
                        onChange={(e) => updateTaskPrompt(t.id, e.target.value)}
                        placeholder="Промпт для этого фото..."
                        rows={5}
                        className="text-xs"
                      />
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => updateTaskPrompt(t.id, globalPrompt)} disabled={!globalPrompt.trim()}>
                          ← общий
                        </Button>
                      </div>
                    </div>
                    {/* Результат */}
                    <div className="col-span-5 space-y-1">
                      {!res && (
                        <div className="aspect-square rounded bg-muted/40 flex items-center justify-center text-[10px] text-muted-foreground">
                          ожидает запуска
                        </div>
                      )}
                      {res?.status === "pending" && (
                        <div className="aspect-square rounded bg-muted flex items-center justify-center">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      )}
                      {res?.status === "error" && (
                        <div className="aspect-square rounded bg-destructive/10 text-destructive text-[10px] p-2 flex items-center justify-center text-center">
                          {res.error}
                        </div>
                      )}
                      {res?.status === "success" && res.url && (
                        <>
                          <img src={res.url} alt="" className="w-full aspect-square object-cover rounded border border-primary" />
                          <div className="flex gap-1">
                            <Button size="sm" onClick={() => approveTask(t)}>
                              <Check className="h-3 w-3" /> Одобрить
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => regenerateTask(t)}>
                              <RotateCw className="h-3 w-3" />
                            </Button>
                            <a href={res.url} target="_blank" rel="noreferrer" className="text-[10px] text-primary self-center ml-auto">открыть</a>
                          </div>
                        </>
                      )}
                      <div className="flex justify-end">
                        <Button size="sm" variant="ghost" onClick={() => removeTask(t.id)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
