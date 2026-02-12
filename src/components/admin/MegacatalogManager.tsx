import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Search, Plus, Trash2, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface MegaProduct {
  id: string;
  product_id: string;
  created_at: string;
  product_name: string;
  product_sku: string | null;
  store_name: string;
}

interface AllProduct {
  id: string;
  name: string;
  sku: string | null;
  store_name: string;
  store_id: string;
}

export default function MegacatalogManager() {
  const { toast } = useToast();
  const { user } = useAuth();

  // Current megacatalog products
  const [megaProducts, setMegaProducts] = useState<MegaProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedForRemoval, setSelectedForRemoval] = useState<Set<string>>(new Set());
  const [removing, setRemoving] = useState(false);

  // Add products mode
  const [showAddMode, setShowAddMode] = useState(false);
  const [allProducts, setAllProducts] = useState<AllProduct[]>([]);
  const [allProductsLoading, setAllProductsLoading] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [selectedForAdd, setSelectedForAdd] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);

  // Search for current list
  const [searchQuery, setSearchQuery] = useState("");

  const fetchMegaProducts = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("megacatalog_products")
        .select(`
          id, product_id, created_at,
          products!inner(name, sku, store_id, stores!inner(name))
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const mapped = (data || []).map((item: any) => ({
        id: item.id,
        product_id: item.product_id,
        created_at: item.created_at,
        product_name: item.products?.name || "—",
        product_sku: item.products?.sku || null,
        store_name: item.products?.stores?.name || "—",
      }));

      setMegaProducts(mapped);
    } catch (err) {
      console.error("Error fetching megacatalog products:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMegaProducts();
  }, [fetchMegaProducts]);

  const filteredMega = useMemo(() => {
    if (!searchQuery.trim()) return megaProducts;
    const q = searchQuery.toLowerCase();
    return megaProducts.filter(
      (p) =>
        p.product_name.toLowerCase().includes(q) ||
        (p.product_sku && p.product_sku.toLowerCase().includes(q)) ||
        p.store_name.toLowerCase().includes(q)
    );
  }, [megaProducts, searchQuery]);

  const existingProductIds = useMemo(
    () => new Set(megaProducts.map((p) => p.product_id)),
    [megaProducts]
  );

  const fetchAllProducts = async () => {
    setAllProductsLoading(true);
    try {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku, store_id, stores!inner(name)")
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("name");

      if (error) throw error;

      setAllProducts(
        (data || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          store_name: p.stores?.name || "—",
          store_id: p.store_id,
        }))
      );
    } catch (err) {
      console.error("Error fetching all products:", err);
    } finally {
      setAllProductsLoading(false);
    }
  };

  const handleOpenAddMode = () => {
    setShowAddMode(true);
    setSelectedForAdd(new Set());
    setAddSearch("");
    fetchAllProducts();
  };

  const filteredAllProducts = useMemo(() => {
    const available = allProducts.filter((p) => !existingProductIds.has(p.id));
    if (!addSearch.trim()) return available;
    const q = addSearch.toLowerCase();
    return available.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        p.store_name.toLowerCase().includes(q)
    );
  }, [allProducts, addSearch, existingProductIds]);

  const handleAddProducts = async () => {
    if (selectedForAdd.size === 0 || !user) return;
    setAdding(true);
    try {
      const rows = Array.from(selectedForAdd).map((productId) => ({
        product_id: productId,
        added_by: user.id,
      }));

      const { error } = await supabase.from("megacatalog_products").insert(rows);
      if (error) throw error;

      toast({
        title: "Добавлено",
        description: `${rows.length} товар(ов) добавлено в мегакаталог`,
      });
      setSelectedForAdd(new Set());
      setShowAddMode(false);
      fetchMegaProducts();
    } catch (err: any) {
      console.error("Error adding to megacatalog:", err);
      toast({
        title: "Ошибка",
        description: err.message || "Не удалось добавить товары",
        variant: "destructive",
      });
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveProducts = async () => {
    if (selectedForRemoval.size === 0) return;
    setRemoving(true);
    try {
      const { error } = await supabase
        .from("megacatalog_products")
        .delete()
        .in("id", Array.from(selectedForRemoval));

      if (error) throw error;

      toast({
        title: "Удалено",
        description: `${selectedForRemoval.size} товар(ов) удалено из мегакаталога`,
      });
      setSelectedForRemoval(new Set());
      fetchMegaProducts();
    } catch (err: any) {
      console.error("Error removing from megacatalog:", err);
      toast({
        title: "Ошибка",
        description: err.message || "Не удалось удалить товары",
        variant: "destructive",
      });
    } finally {
      setRemoving(false);
    }
  };

  if (showAddMode) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Добавить товары в мегакаталог</h3>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowAddMode(false)}>
              Отмена
            </Button>
            <Button onClick={handleAddProducts} disabled={adding || selectedForAdd.size === 0}>
              {adding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Добавить ({selectedForAdd.size})
            </Button>
          </div>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск товаров..."
            value={addSearch}
            onChange={(e) => setAddSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {allProductsLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="rounded-lg border bg-card max-h-[600px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Название</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Магазин</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAllProducts.slice(0, 200).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedForAdd.has(p.id)}
                        onCheckedChange={(checked) => {
                          setSelectedForAdd((prev) => {
                            const next = new Set(prev);
                            if (checked) next.add(p.id);
                            else next.delete(p.id);
                            return next;
                          });
                        }}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-muted-foreground">{p.sku || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{p.store_name}</TableCell>
                  </TableRow>
                ))}
                {filteredAllProducts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Нет доступных товаров
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
        {filteredAllProducts.length > 200 && (
          <p className="text-sm text-muted-foreground">Показано 200 из {filteredAllProducts.length}. Используйте поиск.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Мегакаталог</h3>
          <Badge variant="secondary">{megaProducts.length} товаров</Badge>
        </div>
        <div className="flex gap-2">
          {selectedForRemoval.size > 0 && (
            <Button variant="destructive" size="sm" onClick={handleRemoveProducts} disabled={removing}>
              {removing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Удалить ({selectedForRemoval.size})
            </Button>
          )}
          <Button onClick={handleOpenAddMode}>
            <Plus className="h-4 w-4 mr-2" />
            Добавить товары
          </Button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Поиск в мегакаталоге..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : megaProducts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">Мегакаталог пуст</p>
          <p className="text-sm">Добавьте товары, чтобы продавцы могли их видеть</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card max-h-[600px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Название</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Магазин</TableHead>
                <TableHead>Добавлен</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMega.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedForRemoval.has(p.id)}
                      onCheckedChange={(checked) => {
                        setSelectedForRemoval((prev) => {
                          const next = new Set(prev);
                          if (checked) next.add(p.id);
                          else next.delete(p.id);
                          return next;
                        });
                      }}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{p.product_name}</TableCell>
                  <TableCell className="text-muted-foreground">{p.product_sku || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{p.store_name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(p.created_at).toLocaleDateString("ru-RU")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
