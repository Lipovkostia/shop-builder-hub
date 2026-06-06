import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Plus, Trash2, Edit, Search, Globe, Upload, ImageOff,
  ArrowUp, ArrowDown, EyeOff, Eye, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface HCategory {
  id: string;
  name: string;
  slug: string | null;
  parent_id: string | null;
  sort_order: number;
  image_url: string | null;
  is_active: boolean;
}

interface HProduct {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  images: string[];
  category_id: string | null;
  source_url: string | null;
  source_site: string | null;
  sku: string | null;
  sort_order: number;
  is_active: boolean;
}

const sb: any = supabase;

export default function HomepageCatalogSection() {
  const { toast } = useToast();

  const [categories, setCategories] = useState<HCategory[]>([]);
  const [products, setProducts] = useState<HProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<string>("all");
  const [showHidden, setShowHidden] = useState(true);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editProduct, setEditProduct] = useState<HProduct | null>(null);
  const [parserOpen, setParserOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: cats }, { data: prods }] = await Promise.all([
      sb.from("homepage_categories").select("*").order("sort_order", { ascending: true }),
      sb.from("homepage_products").select("*").order("sort_order", { ascending: true }).limit(3000),
    ]);
    setCategories((cats as HCategory[]) || []);
    setProducts((prods as HProduct[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (!showHidden && !p.is_active) return false;
      if (filterCat !== "all" && p.category_id !== filterCat) return false;
      if (q) {
        const hay = `${p.name} ${p.sku || ""} ${p.source_url || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [products, search, filterCat, showHidden]);

  const toggleSelected = (id: string) => {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const selectAll = () => setSelected(new Set(filtered.map((p) => p.id)));
  const clearSelected = () => setSelected(new Set());

  const bulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Удалить ${selected.size} товаров?`)) return;
    const ids = Array.from(selected);
    const { error } = await sb.from("homepage_products").delete().in("id", ids);
    if (error) { toast({ title: "Ошибка", description: error.message, variant: "destructive" }); return; }
    setProducts((arr) => arr.filter((p) => !selected.has(p.id)));
    clearSelected();
    toast({ title: "Удалено", description: `Товаров: ${ids.length}` });
  };

  const bulkToggleHidden = async (active: boolean) => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    const { error } = await sb.from("homepage_products").update({ is_active: active }).in("id", ids);
    if (error) { toast({ title: "Ошибка", description: error.message, variant: "destructive" }); return; }
    setProducts((arr) => arr.map((p) => selected.has(p.id) ? { ...p, is_active: active } : p));
    clearSelected();
  };

  const bulkSetCategory = async (categoryId: string | null) => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    const { error } = await sb.from("homepage_products").update({ category_id: categoryId }).in("id", ids);
    if (error) { toast({ title: "Ошибка", description: error.message, variant: "destructive" }); return; }
    setProducts((arr) => arr.map((p) => selected.has(p.id) ? { ...p, category_id: categoryId } : p));
    clearSelected();
  };

  const createBlank = async () => {
    const { data, error } = await sb.from("homepage_products")
      .insert({ name: "Новый товар", is_active: true })
      .select().single();
    if (error) { toast({ title: "Ошибка", description: error.message, variant: "destructive" }); return; }
    setProducts((arr) => [data as HProduct, ...arr]);
    setEditProduct(data as HProduct);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Главная страница — товары</CardTitle>
            <CardDescription>
              Отдельный пул товаров, который отображается на главной (в новой витрине). Не связан с разделом «Ассортимент».
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setParserOpen(true)} variant="outline" className="gap-2">
              <Globe className="h-4 w-4" /> Спарсить сайт
            </Button>
            <Button onClick={createBlank} className="gap-2">
              <Plus className="h-4 w-4" /> Добавить товар
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        {/* Categories panel */}
        <Card className="lg:sticky lg:top-4 self-start">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Категории</CardTitle>
            <CardDescription className="text-xs">Управление и фильтр</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <CategoriesPanel
              categories={categories}
              products={products}
              selectedFilter={filterCat}
              onFilter={setFilterCat}
              onChange={setCategories}
            />
          </CardContent>
        </Card>

        {/* Products list */}
        <Card>
          <CardHeader className="pb-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Поиск по названию, SKU, ссылке…"
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch id="show-hidden" checked={showHidden} onCheckedChange={setShowHidden} />
                <Label htmlFor="show-hidden" className="text-xs">Скрытые</Label>
              </div>
              <Badge variant="secondary">{filtered.length}</Badge>
            </div>
            {selected.size > 0 && (
              <div className="flex flex-wrap items-center gap-2 p-2 bg-muted rounded-lg">
                <span className="text-sm font-medium">Выбрано: {selected.size}</span>
                <Select onValueChange={(v) => bulkSetCategory(v === "__none__" ? null : v)}>
                  <SelectTrigger className="h-8 w-[180px]"><SelectValue placeholder="Перенести в категорию" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Без категории</SelectItem>
                    {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={() => bulkToggleHidden(false)} className="gap-1">
                  <EyeOff className="h-3.5 w-3.5" /> Скрыть
                </Button>
                <Button size="sm" variant="outline" onClick={() => bulkToggleHidden(true)} className="gap-1">
                  <Eye className="h-3.5 w-3.5" /> Показать
                </Button>
                <Button size="sm" variant="destructive" onClick={bulkDelete} className="gap-1">
                  <Trash2 className="h-3.5 w-3.5" /> Удалить
                </Button>
                <Button size="sm" variant="ghost" onClick={clearSelected}>Снять</Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">
                Товаров нет. Добавьте вручную или запустите парсер.
              </p>
            ) : (
              <>
                <div className="flex items-center gap-2 pb-2 border-b">
                  <Button size="sm" variant="ghost" onClick={selectAll} className="h-7 text-xs">Выделить всё</Button>
                </div>
                <div className="divide-y">
                  {filtered.map((p) => {
                    const isSel = selected.has(p.id);
                    const cat = p.category_id ? catMap.get(p.category_id) : null;
                    return (
                      <div key={p.id} className={cn("flex items-center gap-3 py-2", isSel && "bg-primary/5")}>
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={() => toggleSelected(p.id)}
                          className="h-4 w-4"
                        />
                        <div className="w-12 h-12 rounded bg-muted flex-shrink-0 overflow-hidden flex items-center justify-center">
                          {p.image_url ? (
                            <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <ImageOff className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{p.name}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-0.5">
                            {cat && <Badge variant="outline" className="text-[10px] h-4 px-1.5">{cat.name}</Badge>}
                            {!p.is_active && <Badge variant="secondary" className="text-[10px] h-4 px-1.5">Скрыт</Badge>}
                            {p.source_site && (
                              <span className="text-[10px] text-muted-foreground truncate">{p.source_site}</span>
                            )}
                          </div>
                        </div>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditProduct(p)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {editProduct && (
        <ProductEditDialog
          product={editProduct}
          categories={categories}
          onClose={() => setEditProduct(null)}
          onSaved={(p) => setProducts((arr) => arr.map((x) => x.id === p.id ? p : x))}
          onDeleted={(id) => setProducts((arr) => arr.filter((x) => x.id !== id))}
        />
      )}

      <SiteParserDialog
        open={parserOpen}
        onClose={() => setParserOpen(false)}
        onDone={() => load()}
      />
    </div>
  );
}

/* ============== Categories panel ============== */

function CategoriesPanel({
  categories, products, selectedFilter, onFilter, onChange,
}: {
  categories: HCategory[];
  products: HProduct[];
  selectedFilter: string;
  onFilter: (v: string) => void;
  onChange: (cats: HCategory[]) => void;
}) {
  const { toast } = useToast();
  const [newName, setNewName] = useState("");

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of products) {
      if (!p.category_id) continue;
      m.set(p.category_id, (m.get(p.category_id) || 0) + 1);
    }
    return m;
  }, [products]);

  const uncategorized = products.filter((p) => !p.category_id).length;

  const create = async () => {
    const name = newName.trim();
    if (!name) return;
    const maxOrder = categories.reduce((m, c) => Math.max(m, c.sort_order), -1);
    const { data, error } = await sb.from("homepage_categories")
      .insert({ name, sort_order: maxOrder + 1, is_active: true })
      .select().single();
    if (error) { toast({ title: "Ошибка", description: error.message, variant: "destructive" }); return; }
    onChange([...categories, data as HCategory]);
    setNewName("");
  };

  const rename = async (id: string, name: string) => {
    const { error } = await sb.from("homepage_categories").update({ name }).eq("id", id);
    if (error) { toast({ title: "Ошибка", description: error.message, variant: "destructive" }); return; }
    onChange(categories.map((c) => c.id === id ? { ...c, name } : c));
  };

  const remove = async (id: string) => {
    if (!confirm("Удалить категорию? Товары останутся, но без категории.")) return;
    const { error } = await sb.from("homepage_categories").delete().eq("id", id);
    if (error) { toast({ title: "Ошибка", description: error.message, variant: "destructive" }); return; }
    onChange(categories.filter((c) => c.id !== id));
  };

  const move = async (id: string, dir: -1 | 1) => {
    const idx = categories.findIndex((c) => c.id === id);
    const swap = idx + dir;
    if (swap < 0 || swap >= categories.length) return;
    const a = categories[idx], b = categories[swap];
    const next = [...categories];
    next[idx] = { ...b, sort_order: a.sort_order };
    next[swap] = { ...a, sort_order: b.sort_order };
    onChange(next);
    await Promise.all([
      sb.from("homepage_categories").update({ sort_order: a.sort_order }).eq("id", b.id),
      sb.from("homepage_categories").update({ sort_order: b.sort_order }).eq("id", a.id),
    ]);
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <button
          onClick={() => onFilter("all")}
          className={cn(
            "w-full text-left px-2 py-1.5 rounded text-sm flex items-center justify-between",
            selectedFilter === "all" ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted",
          )}
        >
          <span>Все товары</span>
          <span className="text-xs text-muted-foreground">{products.length}</span>
        </button>
        <button
          onClick={() => onFilter("none")}
          className={cn(
            "w-full text-left px-2 py-1.5 rounded text-sm flex items-center justify-between",
            selectedFilter === "none" ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted",
          )}
        >
          <span className="text-muted-foreground italic">Без категории</span>
          <span className="text-xs text-muted-foreground">{uncategorized}</span>
        </button>
      </div>

      <div className="border-t pt-2">
        <ScrollArea className="max-h-[50vh]">
          <div className="space-y-1 pr-2">
            {categories.map((c, idx) => (
              <div key={c.id} className="group flex items-center gap-1">
                <button
                  onClick={() => onFilter(c.id)}
                  className={cn(
                    "flex-1 text-left px-2 py-1.5 rounded text-sm flex items-center justify-between min-w-0",
                    selectedFilter === c.id ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted",
                  )}
                >
                  <span className="truncate">{c.name}</span>
                  <span className="text-xs text-muted-foreground ml-2 shrink-0">{counts.get(c.id) || 0}</span>
                </button>
                <div className="opacity-0 group-hover:opacity-100 flex items-center transition-opacity">
                  <Button size="icon" variant="ghost" className="h-6 w-6" disabled={idx === 0} onClick={() => move(c.id, -1)}>
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6" disabled={idx === categories.length - 1} onClick={() => move(c.id, 1)}>
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6"
                    onClick={() => {
                      const n = prompt("Новое название", c.name)?.trim();
                      if (n && n !== c.name) rename(c.id, n);
                    }}
                  ><Edit className="h-3 w-3" /></Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => remove(c.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className="border-t pt-2 flex gap-1">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Новая категория"
          className="h-8 text-sm"
          onKeyDown={(e) => { if (e.key === "Enter") create(); }}
        />
        <Button size="sm" onClick={create} className="h-8 px-2"><Plus className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

/* ============== Edit product dialog ============== */

function ProductEditDialog({
  product, categories, onClose, onSaved, onDeleted,
}: {
  product: HProduct;
  categories: HCategory[];
  onClose: () => void;
  onSaved: (p: HProduct) => void;
  onDeleted: (id: string) => void;
}) {
  const { toast } = useToast();
  const [draft, setDraft] = useState<HProduct>(product);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const save = async () => {
    setSaving(true);
    const { id, ...patch } = draft;
    const { error } = await sb.from("homepage_products").update(patch).eq("id", id);
    setSaving(false);
    if (error) { toast({ title: "Не сохранено", description: error.message, variant: "destructive" }); return; }
    onSaved(draft);
    toast({ title: "Сохранено" });
    onClose();
  };

  const remove = async () => {
    if (!confirm("Удалить товар?")) return;
    const { error } = await sb.from("homepage_products").delete().eq("id", product.id);
    if (error) { toast({ title: "Ошибка", description: error.message, variant: "destructive" }); return; }
    onDeleted(product.id);
    onClose();
  };

  const uploadImage = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `homepage/${product.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await sb.storage.from("product-images").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = sb.storage.from("product-images").getPublicUrl(path);
      setDraft((d) => ({ ...d, image_url: data.publicUrl }));
    } catch (e: any) {
      toast({ title: "Не удалось загрузить", description: e.message, variant: "destructive" });
    } finally { setUploading(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Редактирование товара</DialogTitle>
          <DialogDescription>Карточка товара для главной страницы</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-4">
            <div className="space-y-2">
              <div className="aspect-square bg-muted rounded-lg overflow-hidden border flex items-center justify-center">
                {draft.image_url ? (
                  <img src={draft.image_url} alt={draft.name} className="w-full h-full object-cover" />
                ) : (
                  <ImageOff className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <input type="file" accept="image/*" hidden ref={fileRef}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = ""; }} />
              <Button size="sm" variant="outline" className="w-full gap-1" disabled={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Фото
              </Button>
            </div>
            <div className="space-y-3">
              <div>
                <Label>Название</Label>
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </div>
              <div>
                <Label>URL изображения</Label>
                <Input value={draft.image_url || ""} onChange={(e) => setDraft({ ...draft, image_url: e.target.value || null })} placeholder="https://…" />
              </div>
              <div>
                <Label>Категория</Label>
                <Select
                  value={draft.category_id || "__none__"}
                  onValueChange={(v) => setDraft({ ...draft, category_id: v === "__none__" ? null : v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Без категории</SelectItem>
                    {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div>
            <Label>Описание</Label>
            <Textarea rows={4} value={draft.description || ""} onChange={(e) => setDraft({ ...draft, description: e.target.value || null })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>SKU</Label>
              <Input value={draft.sku || ""} onChange={(e) => setDraft({ ...draft, sku: e.target.value || null })} />
            </div>
            <div>
              <Label>Источник (URL)</Label>
              <Input value={draft.source_url || ""} onChange={(e) => setDraft({ ...draft, source_url: e.target.value || null })} placeholder="https://…" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={draft.is_active} onCheckedChange={(v) => setDraft({ ...draft, is_active: v })} />
            <Label className="text-sm">{draft.is_active ? "Показывается на главной" : "Скрыт"}</Label>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="destructive" onClick={remove} className="mr-auto gap-1"><Trash2 className="h-4 w-4" /> Удалить</Button>
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Сохранить</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============== Site parser dialog ============== */

interface ParseJob {
  id: string;
  url: string;
  host: string | null;
  status: string; // starting | scraping | completed | failed | cancelled | stopped
  total: number;
  completed: number;
  ingested: number;
  duplicates: number;
  last_error: string | null;
  stop_requested: boolean;
  started_at: string;
  finished_at: string | null;
}

const ACTIVE_STATUSES = new Set(["starting", "scraping"]);

async function callParser(action: string, payload: Record<string, unknown> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/homepage-parse-site`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, ...payload }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
  return json;
}

function statusLabel(s: string): { label: string; cls: string } {
  switch (s) {
    case "starting": return { label: "Запуск…", cls: "bg-blue-500/15 text-blue-600 border-blue-500/30" };
    case "scraping": return { label: "Парсит", cls: "bg-amber-500/15 text-amber-600 border-amber-500/30" };
    case "completed": return { label: "Готово", cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" };
    case "failed": return { label: "Ошибка", cls: "bg-red-500/15 text-red-600 border-red-500/30" };
    case "stopped": return { label: "Остановлен", cls: "bg-muted text-muted-foreground border-border" };
    case "cancelled": return { label: "Отменён", cls: "bg-muted text-muted-foreground border-border" };
    default: return { label: s, cls: "bg-muted text-muted-foreground border-border" };
  }
}

function SiteParserDialog({
  open, onClose, onDone,
}: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [url, setUrl] = useState("https://streitsale.ru/");
  const [starting, setStarting] = useState(false);
  const [jobs, setJobs] = useState<ParseJob[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = async () => {
    try {
      const r = await callParser("status");
      setJobs((r?.jobs || []) as ParseJob[]);
      setLoaded(true);
    } catch (_) { /* ignore polling errors */ }
  };

  // Poll while dialog open. Faster cadence if any job is active.
  useEffect(() => {
    if (!open) return;
    refresh();
    const t = setInterval(() => {
      refresh();
      // Notify parent so the products list refreshes during the crawl.
      if (jobs.some((j) => ACTIVE_STATUSES.has(j.status))) onDone();
    }, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, jobs.length, jobs.map((j) => j.status).join(",")]);

  const hasActive = jobs.some((j) => ACTIVE_STATUSES.has(j.status));

  const start = async () => {
    setStarting(true);
    try {
      const r = await callParser("start", { url });
      toast({ title: "Парсинг запущен", description: r?.message || "Идёт в фоне." });
      await refresh();
      onDone();
    } catch (e: any) {
      toast({ title: "Ошибка парсинга", description: e.message, variant: "destructive" });
    } finally {
      setStarting(false);
    }
  };

  const stop = async (jobId: string) => {
    try {
      await callParser("stop", { job_id: jobId });
      toast({ title: "Останавливаем…", description: "Уже спарсенные товары сохранятся." });
      setJobs((arr) => arr.map((j) => j.id === jobId ? { ...j, stop_requested: true } : j));
    } catch (e: any) {
      toast({ title: "Не удалось остановить", description: e.message, variant: "destructive" });
    }
  };

  const clearFinished = async () => {
    try {
      await callParser("clear_finished");
      await refresh();
    } catch (_) { /* ignore */ }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Парсинг сайта</DialogTitle>
          <DialogDescription>
            Соберём все товары: название, фото, цену, описание и иерархию категорий. Дубли по ссылке пропускаются. Парсинг идёт в фоне — можно закрыть окно.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <Label>URL сайта</Label>
            <div className="flex gap-2 mt-1">
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" disabled={starting} />
              <Button onClick={start} disabled={starting || !url.trim()} className="gap-2 shrink-0">
                {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
                Запустить
              </Button>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              До 5000 страниц за прогон. Можно запускать несколько сайтов одновременно.
            </div>
          </div>

          <div className="border-t pt-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold">Задачи парсинга</div>
              {jobs.length > 0 && (
                <Button size="sm" variant="ghost" onClick={clearFinished} className="h-7 text-xs">
                  Очистить завершённые
                </Button>
              )}
            </div>

            {!loaded ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : jobs.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Пока ни одного запуска.</p>
            ) : (
              <div className="space-y-2">
                {jobs.map((j) => {
                  const st = statusLabel(j.status);
                  const isActive = ACTIVE_STATUSES.has(j.status);
                  const pct = j.total > 0 ? Math.min(100, Math.round((j.completed / j.total) * 100)) : (isActive ? 5 : 0);
                  return (
                    <div key={j.id} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5", st.cls)}>{st.label}</Badge>
                        <span className="text-xs font-medium truncate flex-1 min-w-0">{j.host || j.url}</span>
                        {isActive && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1"
                            disabled={j.stop_requested}
                            onClick={() => stop(j.id)}
                          >
                            <X className="h-3 w-3" />
                            {j.stop_requested ? "Останавливаем…" : "Остановить"}
                          </Button>
                        )}
                      </div>

                      {isActive && (
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-4 gap-2 text-xs">
                        <div>
                          <div className="text-muted-foreground">Страниц</div>
                          <div className="font-semibold">
                            {j.completed}{j.total > 0 ? ` / ${j.total}` : ""}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Товаров</div>
                          <div className="font-semibold text-emerald-600">{j.ingested}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Дубли</div>
                          <div className="font-semibold">{j.duplicates}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Запущен</div>
                          <div className="font-semibold">
                            {new Date(j.started_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>
                      </div>

                      {j.last_error && (
                        <div className="text-xs text-red-600 break-all">Ошибка: {j.last_error}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {hasActive && (
              <p className="text-[11px] text-muted-foreground mt-2">
                Можно закрыть окно — парсинг продолжится в фоне. Товары появляются в каталоге по мере обработки.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Закрыть</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
