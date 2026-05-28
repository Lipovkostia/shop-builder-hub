import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Plus, Copy as CopyIcon, Trash2, Sparkles, Loader2, Image as ImageIcon, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Variant {
  id: string;
  store_id: string;
  source_product_id: string;
  variant_label: string;
  title: string | null;
  description: string | null;
  images: string[] | null;
  price: number | null;
  avito_category: string | null;
  avito_address: string | null;
  avito_params: Record<string, any> | null;
  status: string;
  avito_item_id: string | null;
  last_error: string | null;
  unique_seed: number;
  created_at: string;
  updated_at: string;
}

interface SourceProduct {
  id: string;
  name: string;
  description?: string | null;
  price?: number | null;
  images?: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  product: SourceProduct | null;
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Черновик", cls: "bg-muted text-muted-foreground" },
  queued: { label: "В очереди", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" },
  published: { label: "Опубликовано", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" },
  moderation_error: { label: "Ошибка модерации", cls: "bg-destructive/15 text-destructive" },
  archived: { label: "В архиве", cls: "bg-muted text-muted-foreground line-through" },
};

export function AvitoListingVariantsManager({ open, onOpenChange, storeId, product }: Props) {
  const { toast } = useToast();
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(false);
  const [uniquifyingId, setUniquifyingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = async () => {
    if (!product) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("avito_listing_variants" as any)
      .select("*")
      .eq("source_product_id", product.id)
      .order("created_at", { ascending: true });
    setLoading(false);
    if (error) {
      toast({ title: "Не удалось загрузить варианты", description: error.message, variant: "destructive" });
      return;
    }
    setVariants((data as any) || []);
    if (data && data.length && !selectedId) setSelectedId((data[0] as any).id);
  };

  useEffect(() => {
    if (open) load();
    else { setVariants([]); setSelectedId(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product?.id]);

  const createVariant = async (fromVariant?: Variant) => {
    if (!product) return;
    const base = fromVariant ?? {
      variant_label: `Вариант ${variants.length + 1}`,
      title: product.name,
      description: product.description || "",
      images: product.images || [],
      price: product.price ?? null,
      avito_category: null,
      avito_address: null,
      avito_params: {},
      unique_seed: variants.length + 1,
    };
    const insertRow = {
      store_id: storeId,
      source_product_id: product.id,
      variant_label: fromVariant ? `${fromVariant.variant_label} (копия)` : base.variant_label,
      title: base.title,
      description: base.description,
      images: base.images,
      price: base.price,
      avito_category: base.avito_category,
      avito_address: base.avito_address,
      avito_params: base.avito_params || {},
      unique_seed: (variants.reduce((m, v) => Math.max(m, v.unique_seed), 0) || 0) + 1,
      status: "draft",
    };
    const { data, error } = await supabase
      .from("avito_listing_variants" as any)
      .insert(insertRow)
      .select()
      .single();
    if (error) {
      toast({ title: "Ошибка создания варианта", description: error.message, variant: "destructive" });
      return;
    }
    const row = data as any as Variant;
    setVariants(prev => [...prev, row]);
    setSelectedId(row.id);
    toast({ title: "Вариант создан" });
  };

  const updateVariant = async (id: string, patch: Partial<Variant>) => {
    setVariants(prev => prev.map(v => v.id === id ? { ...v, ...patch } as Variant : v));
    const { error } = await supabase
      .from("avito_listing_variants" as any)
      .update(patch as any)
      .eq("id", id);
    if (error) {
      toast({ title: "Не сохранилось", description: error.message, variant: "destructive" });
      load();
    }
  };

  const deleteVariant = async (id: string) => {
    if (!confirm("Удалить вариант объявления?")) return;
    const { error } = await supabase.from("avito_listing_variants" as any).delete().eq("id", id);
    if (error) {
      toast({ title: "Ошибка удаления", description: error.message, variant: "destructive" });
      return;
    }
    setVariants(prev => prev.filter(v => v.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const uniquifyWithAi = async (v: Variant) => {
    if (!product) return;
    setUniquifyingId(v.id);
    try {
      const { data, error } = await supabase.functions.invoke("ai-avito-description", {
        body: {
          mode: "uniquify_variant",
          storeId,
          maxChars: 1500,
          instruction: `Перепиши текст другими словами, чтобы антифрод Авито не считал объявление дублем. Seed уникальности: ${v.unique_seed}. Сохрани смысл, характеристики и эмодзи. Не вставляй контактов/ссылок. Не пиши КАПС.`,
          products: [{
            id: v.id,
            name: v.title || product.name,
            description: v.description || product.description || product.name,
            price: v.price ?? product.price ?? undefined,
          }],
        },
      });
      if (error) throw error;
      const desc = (data as any)?.descriptions?.[v.id];
      if (!desc) throw new Error("ИИ не вернул текст");
      await updateVariant(v.id, { description: desc, unique_seed: v.unique_seed + 1 });
      toast({ title: "Вариант уникализирован" });
    } catch (e: any) {
      toast({ title: "Ошибка ИИ", description: e?.message || "Неизвестная ошибка", variant: "destructive" });
    } finally {
      setUniquifyingId(null);
    }
  };

  const selected = variants.find(v => v.id === selectedId) || null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[85vh] p-0 flex flex-col">
        <DialogHeader className="px-5 py-3 border-b">
          <DialogTitle className="flex items-center gap-2 text-base">
            <CopyIcon className="h-4 w-4 text-primary" />
            Дубли объявления для Авито
            {product && <span className="text-muted-foreground font-normal">— {product.name}</span>}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Один товар в ассортименте может иметь несколько уникальных объявлений на Авито (разные тексты/фото/города).
            Дубли НЕ появляются в основном каталоге и связаны с исходным товаром.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 grid grid-cols-[320px_1fr] min-h-0">
          {/* Left: variants list */}
          <div className="border-r flex flex-col min-h-0">
            <div className="p-3 border-b">
              <Button size="sm" className="w-full" onClick={() => createVariant()} disabled={!product}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Создать дубль
              </Button>
            </div>
            <ScrollArea className="flex-1">
              {loading && (
                <div className="p-4 text-xs text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Загрузка...
                </div>
              )}
              {!loading && variants.length === 0 && (
                <div className="p-4 text-xs text-muted-foreground">
                  Пока нет дублей. Создайте первый — он унаследует название, описание и фото от товара.
                </div>
              )}
              <div className="divide-y">
                {variants.map(v => {
                  const st = STATUS_LABELS[v.status] || STATUS_LABELS.draft;
                  return (
                    <button
                      key={v.id}
                      onClick={() => setSelectedId(v.id)}
                      className={cn(
                        "w-full text-left p-3 hover:bg-muted/50 transition-colors",
                        selectedId === v.id && "bg-muted",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-sm font-medium truncate">{v.variant_label}</span>
                        <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0", st.cls)}>{st.label}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {v.title || product?.name || "—"}
                      </div>
                      <div className="text-[10px] text-muted-foreground/70 mt-1 flex items-center gap-2">
                        <span className="flex items-center gap-0.5"><ImageIcon className="h-2.5 w-2.5" />{(v.images || []).length}</span>
                        <span>seed #{v.unique_seed}</span>
                        {v.avito_item_id && <span>· id {v.avito_item_id}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Right: editor */}
          <div className="flex flex-col min-h-0">
            {!selected ? (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-8 text-center">
                Выберите вариант слева или создайте новый, чтобы редактировать его.
              </div>
            ) : (
              <ScrollArea className="flex-1">
                <div className="p-5 space-y-4 max-w-3xl">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Link2 className="h-3 w-3" /> Родитель: <span className="font-mono">{product?.id.substring(0, 8)}</span> · {product?.name}
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => createVariant(selected)}>
                        <CopyIcon className="h-3.5 w-3.5 mr-1" /> Клонировать
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => uniquifyWithAi(selected)}
                        disabled={uniquifyingId === selected.id}
                      >
                        {uniquifyingId === selected.id
                          ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                          : <Sparkles className="h-3.5 w-3.5 mr-1" />}
                        Уникализировать ИИ
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteVariant(selected.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Метка варианта</Label>
                      <Input
                        value={selected.variant_label}
                        onChange={(e) => updateVariant(selected.id, { variant_label: e.target.value })}
                        placeholder="Например: Москва / скидка"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Статус</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={selected.status}
                        onChange={(e) => updateVariant(selected.id, { status: e.target.value })}
                      >
                        <option value="draft">Черновик</option>
                        <option value="queued">В очереди в фид</option>
                        <option value="published">Опубликовано</option>
                        <option value="moderation_error">Ошибка модерации</option>
                        <option value="archived">Архив</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Заголовок (для Авито)</Label>
                    <Input
                      value={selected.title || ""}
                      onChange={(e) => updateVariant(selected.id, { title: e.target.value })}
                      placeholder={product?.name}
                      maxLength={50}
                    />
                    <span className="text-[10px] text-muted-foreground">{(selected.title || "").length}/50</span>
                  </div>

                  <div>
                    <Label className="text-xs">Описание</Label>
                    <Textarea
                      value={selected.description || ""}
                      onChange={(e) => updateVariant(selected.id, { description: e.target.value })}
                      rows={10}
                      placeholder="Уникальный текст для этого объявления"
                    />
                    <span className="text-[10px] text-muted-foreground">{(selected.description || "").length} символов</span>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Цена</Label>
                      <Input
                        type="number"
                        value={selected.price ?? ""}
                        onChange={(e) => updateVariant(selected.id, { price: e.target.value ? Number(e.target.value) : null })}
                        placeholder={String(product?.price ?? 0)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Категория Авито</Label>
                      <Input
                        value={selected.avito_category || ""}
                        onChange={(e) => updateVariant(selected.id, { avito_category: e.target.value })}
                        placeholder="Продукты питания"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Адрес</Label>
                      <Input
                        value={selected.avito_address || ""}
                        onChange={(e) => updateVariant(selected.id, { avito_address: e.target.value })}
                        placeholder="Город, улица"
                      />
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <Label className="text-xs">Фотографии ({(selected.images || []).length})</Label>
                    <div className="grid grid-cols-6 gap-2 mt-1">
                      {(selected.images || []).map((url, idx) => (
                        <div key={idx} className="relative group aspect-square rounded overflow-hidden border">
                          <img src={url} alt="" className="w-full h-full object-cover" />
                          <button
                            onClick={() => {
                              const next = (selected.images || []).filter((_, i) => i !== idx);
                              updateVariant(selected.id, { images: next });
                            }}
                            className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                    {(product?.images?.length || 0) > 0 && (selected.images || []).length < (product?.images?.length || 0) && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        onClick={() => updateVariant(selected.id, { images: product?.images || [] })}
                      >
                        Взять все фото товара
                      </Button>
                    )}
                  </div>

                  {selected.last_error && (
                    <div className="p-3 bg-destructive/10 border border-destructive/30 rounded text-xs text-destructive">
                      <div className="font-semibold mb-1">Ошибка модерации Авито:</div>
                      {selected.last_error}
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
