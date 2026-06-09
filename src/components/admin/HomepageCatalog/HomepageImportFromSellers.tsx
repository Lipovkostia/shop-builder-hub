import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, Store as StoreIcon, FileText, ImageOff, CheckCircle2, Download } from "lucide-react";
import { cn } from "@/lib/utils";

const sb: any = supabase;

interface SellerStore {
  id: string;
  name: string;
  subdomain: string;
  owner_email: string | null;
  catalogs_count: number;
}

interface CatalogRow {
  id: string;
  name: string;
  description: string | null;
  access_code: string;
  is_default: boolean;
}

interface CatalogProduct {
  product_id: string;
  product_name: string;
  product_description: string | null;
  product_price: number | null;
  product_images: string[] | null;
  product_unit: string | null;
  product_sku: string | null;
  category_id: string | null;
  category_name: string | null;
}

export default function HomepageImportFromSellers() {
  const { toast } = useToast();

  const [stores, setStores] = useState<SellerStore[]>([]);
  const [storesLoading, setStoresLoading] = useState(true);
  const [storeSearch, setStoreSearch] = useState("");
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);

  const [catalogs, setCatalogs] = useState<CatalogRow[]>([]);
  const [catalogsLoading, setCatalogsLoading] = useState(false);
  const [selectedCatalog, setSelectedCatalog] = useState<CatalogRow | null>(null);

  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [importing, setImporting] = useState(false);

  // === Load stores ===
  useEffect(() => {
    (async () => {
      setStoresLoading(true);
      const { data: storeRows } = await sb
        .from("stores")
        .select("id, name, subdomain, owner_id")
        .order("name", { ascending: true });
      const { data: catalogRows } = await sb
        .from("catalogs")
        .select("id, store_id");
      const { data: profiles } = await sb
        .from("profiles")
        .select("id, email");

      const counts = new Map<string, number>();
      (catalogRows || []).forEach((c: any) => {
        counts.set(c.store_id, (counts.get(c.store_id) || 0) + 1);
      });
      const emailMap = new Map<string, string>();
      (profiles || []).forEach((p: any) => emailMap.set(p.id, p.email));

      const list: SellerStore[] = (storeRows || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        subdomain: s.subdomain,
        owner_email: emailMap.get(s.owner_id) || null,
        catalogs_count: counts.get(s.id) || 0,
      }));
      setStores(list);
      setStoresLoading(false);
    })();
  }, []);

  // === Load catalogs when store selected ===
  useEffect(() => {
    if (!selectedStoreId) {
      setCatalogs([]);
      setSelectedCatalog(null);
      return;
    }
    setCatalogsLoading(true);
    sb.from("catalogs")
      .select("id, name, description, access_code, is_default")
      .eq("store_id", selectedStoreId)
      .order("is_default", { ascending: false })
      .order("name", { ascending: true })
      .then(({ data }: any) => {
        setCatalogs((data || []) as CatalogRow[]);
        setCatalogsLoading(false);
      });
  }, [selectedStoreId]);

  // === Load products when catalog selected ===
  useEffect(() => {
    if (!selectedCatalog) {
      setProducts([]);
      setSelected(new Set());
      setSelectedCat("all");
      return;
    }
    setProductsLoading(true);
    sb.rpc("get_catalog_products_public", { _access_code: selectedCatalog.access_code }).then(({ data, error }: any) => {
      if (error) {
        toast({ title: "Ошибка загрузки товаров", description: error.message, variant: "destructive" });
        setProducts([]);
      } else {
        setProducts((data || []) as CatalogProduct[]);
      }
      setSelected(new Set());
      setSelectedCat("all");
      setProductsLoading(false);
    });
  }, [selectedCatalog, toast]);

  const filteredStores = useMemo(() => {
    const q = storeSearch.trim().toLowerCase();
    if (!q) return stores;
    return stores.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      s.subdomain.toLowerCase().includes(q) ||
      (s.owner_email || "").toLowerCase().includes(q),
    );
  }, [stores, storeSearch]);

  const productCategories = useMemo(() => {
    const m = new Map<string, { id: string; name: string; count: number }>();
    for (const p of products) {
      const id = p.category_id || "__none__";
      const name = p.category_name || "Без категории";
      const cur = m.get(id);
      if (cur) cur.count++;
      else m.set(id, { id, name, count: 1 });
    }
    return Array.from(m.values()).sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    return products.filter((p) => {
      if (selectedCat !== "all") {
        const pid = p.category_id || "__none__";
        if (pid !== selectedCat) return false;
      }
      if (q) {
        const hay = `${p.product_name} ${p.product_sku || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [products, productSearch, selectedCat]);

  const toggleSel = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const selectAllFiltered = () => setSelected(new Set(filteredProducts.map((p) => p.product_id)));
  const clearSel = () => setSelected(new Set());

  // === Import logic ===
  const importProducts = async (items: CatalogProduct[]) => {
    if (items.length === 0) return;
    setImporting(true);
    try {
      // 1. Resolve / create homepage categories by name
      const { data: existingCats } = await sb
        .from("homepage_categories")
        .select("id, name, sort_order");
      const nameToId = new Map<string, string>();
      (existingCats || []).forEach((c: any) => nameToId.set(c.name.trim().toLowerCase(), c.id));
      let maxOrder = (existingCats || []).reduce((m: number, c: any) => Math.max(m, c.sort_order || 0), -1);

      const neededCats = new Set<string>();
      items.forEach((p) => {
        if (p.category_name) neededCats.add(p.category_name.trim());
      });
      const toCreate = Array.from(neededCats).filter((n) => !nameToId.has(n.toLowerCase()));
      if (toCreate.length > 0) {
        const rows = toCreate.map((name) => ({ name, sort_order: ++maxOrder, is_active: true }));
        const { data: inserted, error: catErr } = await sb
          .from("homepage_categories")
          .insert(rows)
          .select("id, name");
        if (catErr) throw catErr;
        (inserted || []).forEach((c: any) => nameToId.set(c.name.trim().toLowerCase(), c.id));
      }

      // 2. Upsert products (matching by source_url == external product id marker)
      // Use source_url = `catalog:<catalogId>:<productId>` so re-imports are idempotent
      const catalogId = selectedCatalog?.id;
      const productRows = items.map((p, i) => ({
        name: p.product_name,
        description: p.product_description,
        image_url: p.product_images?.[0] || null,
        images: p.product_images || [],
        category_id: p.category_name ? nameToId.get(p.category_name.trim().toLowerCase()) || null : null,
        source_url: `catalog:${catalogId}:${p.product_id}`,
        source_site: selectedCatalog?.name || null,
        sku: p.product_sku,
        price: p.product_price,
        sort_order: i,
        is_active: true,
      }));

      const { error: upErr } = await sb
        .from("homepage_products")
        .upsert(productRows, { onConflict: "source_url" });
      if (upErr) throw upErr;

      toast({
        title: "Импорт завершён",
        description: `Добавлено товаров: ${items.length}. Категорий создано: ${toCreate.length}.`,
      });
      clearSel();
    } catch (e: any) {
      toast({ title: "Ошибка импорта", description: e.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const importAll = () => importProducts(products);
  const importSelected = () => importProducts(products.filter((p) => selected.has(p.product_id)));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" /> Импорт из прайс-листов продавцов
        </CardTitle>
        <CardDescription>
          Выберите продавца → его прайс-лист → одобрите весь прайс или выберите нужные товары. Они добавятся на главную с категориями.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-[260px_280px_1fr] gap-3 min-h-[60vh]">
          {/* === Sellers === */}
          <div className="border rounded-lg flex flex-col bg-card">
            <div className="p-3 border-b">
              <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                <StoreIcon className="h-3.5 w-3.5" /> Продавцы
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={storeSearch}
                  onChange={(e) => setStoreSearch(e.target.value)}
                  placeholder="Поиск магазина…"
                  className="h-8 pl-8 text-sm"
                />
              </div>
            </div>
            <ScrollArea className="flex-1 max-h-[60vh]">
              {storesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : filteredStores.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">Нет магазинов</p>
              ) : (
                <div className="p-1.5">
                  {filteredStores.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSelectedStoreId(s.id);
                        setSelectedCatalog(null);
                      }}
                      className={cn(
                        "w-full text-left px-2.5 py-2 rounded text-sm hover:bg-muted transition-colors",
                        selectedStoreId === s.id && "bg-primary/10 text-primary font-medium",
                      )}
                    >
                      <div className="truncate">{s.name}</div>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-[10px] text-muted-foreground truncate">{s.owner_email || s.subdomain}</span>
                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5 ml-1 shrink-0">{s.catalogs_count}</Badge>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* === Catalogs === */}
          <div className="border rounded-lg flex flex-col bg-card">
            <div className="p-3 border-b">
              <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" /> Прайс-листы
              </div>
            </div>
            <ScrollArea className="flex-1 max-h-[60vh]">
              {!selectedStoreId ? (
                <p className="text-xs text-muted-foreground text-center py-8 px-3">Выберите продавца слева</p>
              ) : catalogsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : catalogs.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8 px-3">У продавца нет прайс-листов</p>
              ) : (
                <div className="p-1.5">
                  {catalogs.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCatalog(c)}
                      className={cn(
                        "w-full text-left px-2.5 py-2 rounded text-sm hover:bg-muted transition-colors",
                        selectedCatalog?.id === c.id && "bg-primary/10 text-primary font-medium",
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="truncate">{c.name}</span>
                        {c.is_default && <Badge variant="outline" className="text-[9px] h-3.5 px-1">осн.</Badge>}
                      </div>
                      {c.description && (
                        <div className="text-[10px] text-muted-foreground truncate mt-0.5">{c.description}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* === Products === */}
          <div className="border rounded-lg flex flex-col bg-card">
            <div className="p-3 border-b space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold text-muted-foreground">
                  {selectedCatalog ? `Товары: ${selectedCatalog.name}` : "Товары"}
                </div>
                {selectedCatalog && (
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={importSelected}
                      disabled={selected.size === 0 || importing}
                      className="h-7 text-xs gap-1"
                    >
                      {importing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                      Выбранные ({selected.size})
                    </Button>
                    <Button
                      size="sm"
                      onClick={importAll}
                      disabled={products.length === 0 || importing}
                      className="h-7 text-xs gap-1"
                    >
                      {importing ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                      Одобрить весь прайс
                    </Button>
                  </div>
                )}
              </div>
              {selectedCatalog && (
                <>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Поиск товара…"
                      className="h-8 pl-8 text-sm"
                    />
                  </div>
                  {productCategories.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      <button
                        onClick={() => setSelectedCat("all")}
                        className={cn(
                          "text-[11px] px-2 py-0.5 rounded-full border",
                          selectedCat === "all" ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted",
                        )}
                      >
                        Все · {products.length}
                      </button>
                      {productCategories.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => setSelectedCat(c.id)}
                          className={cn(
                            "text-[11px] px-2 py-0.5 rounded-full border",
                            selectedCat === c.id ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted",
                          )}
                        >
                          {c.name} · {c.count}
                        </button>
                      ))}
                    </div>
                  )}
                  {filteredProducts.length > 0 && (
                    <div className="flex items-center justify-between text-[11px]">
                      <button onClick={selectAllFiltered} className="text-primary hover:underline">
                        Выделить все ({filteredProducts.length})
                      </button>
                      {selected.size > 0 && (
                        <button onClick={clearSel} className="text-muted-foreground hover:underline">
                          Снять выделение
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
            <ScrollArea className="flex-1 max-h-[60vh]">
              {!selectedCatalog ? (
                <p className="text-xs text-muted-foreground text-center py-12 px-3">
                  Выберите прайс-лист, чтобы увидеть товары
                </p>
              ) : productsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredProducts.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-12 px-3">В прайсе нет товаров</p>
              ) : (
                <div className="divide-y">
                  {filteredProducts.map((p) => {
                    const isSel = selected.has(p.product_id);
                    return (
                      <label
                        key={p.product_id}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50",
                          isSel && "bg-primary/5",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={() => toggleSel(p.product_id)}
                          className="h-4 w-4"
                        />
                        <div className="w-10 h-10 rounded bg-muted flex-shrink-0 overflow-hidden flex items-center justify-center">
                          {p.product_images?.[0] ? (
                            <img src={p.product_images[0]} alt={p.product_name} className="w-full h-full object-cover" />
                          ) : (
                            <ImageOff className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{p.product_name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {p.category_name && (
                              <Badge variant="outline" className="text-[10px] h-4 px-1.5">{p.category_name}</Badge>
                            )}
                            {p.product_sku && (
                              <span className="text-[10px] text-muted-foreground">SKU: {p.product_sku}</span>
                            )}
                          </div>
                        </div>
                        {p.product_price != null && (
                          <div className="text-xs font-medium whitespace-nowrap">
                            {Number(p.product_price).toLocaleString("ru-RU")} ₽
                            {p.product_unit && <span className="text-muted-foreground">/{p.product_unit}</span>}
                          </div>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
