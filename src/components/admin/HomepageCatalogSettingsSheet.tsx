import { useEffect, useState, useCallback } from "react";
import { Loader2, Save } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  catalog: {
    id: string;
    catalog_id: string | null;
    access_code: string;
    catalog_name?: string | null;
  };
  onClose: () => void;
  onChanged: () => void;
}

interface CategoryRow { id: string; name: string; parent_id: string | null; }
interface ProductRow { id: string; name: string; sku: string | null; category_id: string | null; category_name: string | null; }

export default function HomepageCatalogSettingsSheet({ catalog, onClose, onChanged }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [excludedCats, setExcludedCats] = useState<Set<string>>(new Set());
  const [excludedProds, setExcludedProds] = useState<Set<string>>(new Set());
  const [prodSearch, setProdSearch] = useState("");
  const [catSearch, setCatSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Products via public RPC
      const { data: rpcData, error: rpcErr } = await supabase.rpc("get_catalog_products_public", { _access_code: catalog.access_code });
      if (rpcErr) throw rpcErr;
      const prods: ProductRow[] = (rpcData || []).map((p: any) => ({
        id: p.product_id,
        name: p.product_name,
        sku: p.product_sku,
        category_id: p.category_id,
        category_name: p.category_name,
      }));
      setProducts(prods);

      // Categories from catalog_category_settings
      let cats: CategoryRow[] = [];
      if (catalog.catalog_id) {
        const { data: cs } = await supabase
          .from("catalog_category_settings")
          .select("category_id, parent_category_id, custom_name, sort_order")
          .eq("catalog_id", catalog.catalog_id)
          .order("sort_order", { ascending: true });
        if (cs && cs.length > 0) {
          const ids = cs.map((c: any) => c.category_id);
          const { data: names } = await supabase.from("categories").select("id, name").in("id", ids);
          const nm = new Map((names || []).map((n: any) => [n.id, n.name]));
          cats = cs.map((c: any) => ({
            id: c.category_id,
            name: c.custom_name || nm.get(c.category_id) || "—",
            parent_id: c.parent_category_id || null,
          }));
        }
      }
      if (cats.length === 0) {
        const seen = new Map<string, string>();
        prods.forEach((p) => {
          if (p.category_id && p.category_name && !seen.has(p.category_id)) seen.set(p.category_id, p.category_name);
        });
        cats = Array.from(seen.entries()).map(([id, name]) => ({ id, name, parent_id: null }));
      }
      setCategories(cats);

      // Existing excludes
      const [{ data: catEx }, { data: prodEx }] = await Promise.all([
        supabase.from("homepage_catalog_category_excludes" as any).select("category_id").eq("homepage_catalog_id", catalog.id),
        supabase.from("homepage_catalog_product_excludes" as any).select("product_id").eq("homepage_catalog_id", catalog.id),
      ]);
      setExcludedCats(new Set(((catEx || []) as any[]).map((r: any) => r.category_id)));
      setExcludedProds(new Set(((prodEx || []) as any[]).map((r: any) => r.product_id)));
    } catch (e: any) {
      toast({ title: "Ошибка загрузки", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [catalog, toast]);

  useEffect(() => { load(); }, [load]);

  const toggleCat = (id: string) => {
    setExcludedCats((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleProd = (id: string) => {
    setExcludedProds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await supabase.from("homepage_catalog_category_excludes" as any).delete().eq("homepage_catalog_id", catalog.id);
      await supabase.from("homepage_catalog_product_excludes" as any).delete().eq("homepage_catalog_id", catalog.id);
      if (excludedCats.size > 0) {
        const rows = Array.from(excludedCats).map((cid) => ({ homepage_catalog_id: catalog.id, category_id: cid }));
        const { error } = await supabase.from("homepage_catalog_category_excludes" as any).insert(rows);
        if (error) throw error;
      }
      if (excludedProds.size > 0) {
        const rows = Array.from(excludedProds).map((pid) => ({ homepage_catalog_id: catalog.id, product_id: pid }));
        const { error } = await supabase.from("homepage_catalog_product_excludes" as any).insert(rows);
        if (error) throw error;
      }
      toast({ title: "Настройки сохранены" });
      onChanged();
      onClose();
    } catch (e: any) {
      toast({ title: "Ошибка сохранения", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const filteredCats = categories.filter((c) => c.name.toLowerCase().includes(catSearch.toLowerCase()));
  const filteredProds = products.filter((p) => {
    const q = prodSearch.toLowerCase();
    return !q || p.name.toLowerCase().includes(q) || (p.sku || "").toLowerCase().includes(q);
  });

  const shownProdCount = products.filter((p) => !excludedProds.has(p.id) && !(p.category_id && excludedCats.has(p.category_id))).length;

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col h-[100dvh] max-h-[100dvh] overflow-hidden p-0">
        <SheetHeader className="px-6 pt-6 pb-3 border-b shrink-0">
          <SheetTitle>Настройка отображения: {catalog.catalog_name || catalog.access_code}</SheetTitle>
          <SheetDescription>
            Отметьте категории и товары, которые нужно <b>скрыть</b> с главной страницы.
            Показывается: <b>{shownProdCount}</b> из {products.length}.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : (
            <Tabs defaultValue="cats" className="h-full flex flex-col">
              <TabsList className="mx-6 mt-3 shrink-0">
                <TabsTrigger value="cats">Категории ({categories.length - excludedCats.size}/{categories.length})</TabsTrigger>
                <TabsTrigger value="prods">Товары ({products.length - excludedProds.size}/{products.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="cats" className="flex-1 min-h-0 flex flex-col mt-2">
                <div className="px-6 pb-2">
                  <Input placeholder="Поиск категорий..." value={catSearch} onChange={(e) => setCatSearch(e.target.value)} className="h-8" />
                </div>
                <ScrollArea className="flex-1 px-6">
                  <div className="space-y-1 pb-4">
                    {filteredCats.map((c) => {
                      const excluded = excludedCats.has(c.id);
                      return (
                        <label key={c.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer text-sm">
                          <Checkbox checked={!excluded} onCheckedChange={() => toggleCat(c.id)} />
                          <span className={excluded ? "line-through text-muted-foreground" : ""}>{c.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="prods" className="flex-1 min-h-0 flex flex-col mt-2">
                <div className="px-6 pb-2">
                  <Input placeholder="Поиск товаров..." value={prodSearch} onChange={(e) => setProdSearch(e.target.value)} className="h-8" />
                </div>
                <ScrollArea className="flex-1 px-6">
                  <div className="space-y-1 pb-4">
                    {filteredProds.slice(0, 500).map((p) => {
                      const excluded = excludedProds.has(p.id);
                      return (
                        <label key={p.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer text-sm">
                          <Checkbox checked={!excluded} onCheckedChange={() => toggleProd(p.id)} />
                          <span className={"flex-1 " + (excluded ? "line-through text-muted-foreground" : "")}>{p.name}</span>
                          <span className="text-xs text-muted-foreground">{p.category_name || "—"}</span>
                        </label>
                      );
                    })}
                    {filteredProds.length > 500 && (
                      <div className="text-xs text-muted-foreground p-2">Показаны первые 500 из {filteredProds.length}. Уточните поиск.</div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}
        </div>

        <div className="border-t px-6 py-3 flex justify-end gap-2 shrink-0" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
          <Button variant="outline" onClick={onClose} disabled={saving}>Отмена</Button>
          <Button onClick={save} disabled={saving || loading}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            Сохранить
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
