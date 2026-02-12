import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Plus, Package, Store, Check, Image as ImageIcon, ChevronLeft, ChevronRight, Filter, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface MegacatalogProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  buy_price: number | null;
  images: string[] | null;
  unit: string | null;
  sku: string | null;
  packaging_type: string | null;
  unit_weight: number | null;
  store_id: string;
  store_name?: string;
}

interface MegacatalogSectionProps {
  existingProductIds: Set<string>;
  onAddProducts: (products: MegacatalogProduct[]) => Promise<void>;
}

const PAGE_SIZE = 100;

export function MegacatalogSection({
  existingProductIds,
  onAddProducts,
}: MegacatalogSectionProps) {
  const { toast } = useToast();
  const [products, setProducts] = useState<MegacatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [page, setPage] = useState(0);

  // Filters
  const [storeFilter, setStoreFilter] = useState("all");
  const [photoFilter, setPhotoFilter] = useState("all");
  const [unitFilter, setUnitFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [existingFilter, setExistingFilter] = useState("all");

  // Password gate
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [passwordError, setPasswordError] = useState(false);

  // Fetch all products (only after unlocked)
  useEffect(() => {
    if (!isUnlocked) return;
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("products")
          .select(`
            id, name, description, price, buy_price, images, unit, sku, 
            packaging_type, unit_weight, store_id,
            stores!inner(name)
          `)
          .eq("is_active", true)
          .is("deleted_at", null)
          .order("name");

        if (error) throw error;

        const productsWithStores = (data || []).map((p: any) => ({
          ...p,
          store_name: p.stores?.name || "Неизвестный магазин",
        }));

        setProducts(productsWithStores);
      } catch (error) {
        console.error("Error fetching megacatalog products:", error);
        toast({
          title: "Ошибка загрузки",
          description: "Не удалось загрузить товары из мегакаталога",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [isUnlocked, toast]);

  const handleVerifyPassword = async () => {
    setVerifying(true);
    setPasswordError(false);
    try {
      const { data, error } = await supabase.rpc('verify_megacatalog_password', {
        _password: passwordInput,
      });
      if (error) throw error;
      if (data === true) {
        setIsUnlocked(true);
      } else {
        setPasswordError(true);
      }
    } catch (err) {
      console.error('Error verifying password:', err);
      setPasswordError(true);
    } finally {
      setVerifying(false);
    }
  };

  // Unique stores for filter
  const storeOptions = useMemo(() => {
    const stores = new Map<string, string>();
    for (const p of products) {
      if (p.store_id && p.store_name) {
        stores.set(p.store_id, p.store_name);
      }
    }
    return Array.from(stores.entries()).map(([id, name]) => ({ value: id, label: name }));
  }, [products]);

  // Unique units for filter
  const unitOptions = useMemo(() => {
    const units = new Set<string>();
    for (const p of products) {
      if (p.unit) units.add(p.unit);
    }
    return Array.from(units).sort().map((u) => ({ value: u, label: u }));
  }, [products]);

  // Unique packaging types for filter
  const typeOptions = useMemo(() => {
    const types = new Map<string, string>();
    const labels: Record<string, string> = {
      head: "Голова", package: "Упаковка", piece: "Штучный",
      can: "Банка", box: "Ящик", carcass: "Туша",
    };
    for (const p of products) {
      if (p.packaging_type) {
        types.set(p.packaging_type, labels[p.packaging_type] || p.packaging_type);
      }
    }
    return Array.from(types.entries()).map(([v, l]) => ({ value: v, label: l }));
  }, [products]);

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (
          !p.name.toLowerCase().includes(q) &&
          !(p.sku && p.sku.toLowerCase().includes(q)) &&
          !(p.description && p.description.toLowerCase().includes(q))
        ) return false;
      }
      if (storeFilter !== "all" && p.store_id !== storeFilter) return false;
      if (photoFilter === "with" && (!p.images || p.images.length === 0)) return false;
      if (photoFilter === "without" && p.images && p.images.length > 0) return false;
      if (unitFilter !== "all" && p.unit !== unitFilter) return false;
      if (typeFilter !== "all" && p.packaging_type !== typeFilter) return false;
      if (existingFilter === "new" && existingProductIds.has(p.id)) return false;
      if (existingFilter === "existing" && !existingProductIds.has(p.id)) return false;
      return true;
    });
  }, [products, searchQuery, storeFilter, photoFilter, unitFilter, typeFilter, existingFilter, existingProductIds]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [searchQuery, storeFilter, photoFilter, unitFilter, typeFilter, existingFilter]);

  // Paginated products
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const paginatedProducts = useMemo(() => {
    const start = page * PAGE_SIZE;
    return filteredProducts.slice(start, start + PAGE_SIZE);
  }, [filteredProducts, page]);

  const handleToggleProduct = useCallback((productId: string) => {
    setSelectedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  }, []);

  const handleAddSelected = useCallback(async () => {
    if (selectedProducts.size === 0) return;
    setAdding(true);
    try {
      const productsToAdd = products.filter((p) => selectedProducts.has(p.id));
      await onAddProducts(productsToAdd);
      toast({
        title: "Товары добавлены",
        description: `${productsToAdd.length} товар(ов) добавлено в ваш ассортимент`,
      });
      setSelectedProducts(new Set());
    } catch (error) {
      console.error("Error adding products:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось добавить товары",
        variant: "destructive",
      });
    } finally {
      setAdding(false);
    }
  }, [selectedProducts, products, onAddProducts, toast]);

  const handleSelectAllOnPage = useCallback(() => {
    const notExisting = paginatedProducts.filter((p) => !existingProductIds.has(p.id));
    const allSelected = notExisting.every((p) => selectedProducts.has(p.id));
    if (allSelected) {
      setSelectedProducts((prev) => {
        const next = new Set(prev);
        for (const p of notExisting) next.delete(p.id);
        return next;
      });
    } else {
      setSelectedProducts((prev) => {
        const next = new Set(prev);
        for (const p of notExisting) next.add(p.id);
        return next;
      });
    }
  }, [paginatedProducts, existingProductIds, selectedProducts]);

  const hasActiveFilters = storeFilter !== "all" || photoFilter !== "all" || unitFilter !== "all" || typeFilter !== "all" || existingFilter !== "all";

  const resetFilters = () => {
    setStoreFilter("all");
    setPhotoFilter("all");
    setUnitFilter("all");
    setTypeFilter("all");
    setExistingFilter("all");
    setSearchQuery("");
  };

  if (!isUnlocked) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-full max-w-sm space-y-4 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <Package className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Доступ к Мегакаталогу</h3>
            <p className="text-sm text-muted-foreground mt-1">Введите пароль для доступа</p>
          </div>
          <div className="space-y-2">
            <Input
              type="password"
              placeholder="Пароль"
              value={passwordInput}
              onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(false); }}
              onKeyDown={(e) => e.key === 'Enter' && handleVerifyPassword()}
              className={passwordError ? 'border-destructive' : ''}
            />
            {passwordError && (
              <p className="text-sm text-destructive">Неверный пароль</p>
            )}
            <Button onClick={handleVerifyPassword} disabled={verifying || !passwordInput} className="w-full">
              {verifying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Войти
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Мегакаталог</h2>
          <Badge variant="secondary" className="text-xs">
            {filteredProducts.length} из {products.length}
          </Badge>
        </div>
        {selectedProducts.size > 0 && (
          <Button size="sm" onClick={handleAddSelected} disabled={adding}>
            {adding ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Добавить {selectedProducts.size} товар(ов)
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Поиск по названию, SKU или описанию..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-9"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        
        <Select value={storeFilter} onValueChange={setStoreFilter}>
          <SelectTrigger className="h-8 text-xs w-[160px]">
            <SelectValue placeholder="Магазин" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все магазины</SelectItem>
            {storeOptions.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={photoFilter} onValueChange={setPhotoFilter}>
          <SelectTrigger className="h-8 text-xs w-[130px]">
            <SelectValue placeholder="Фото" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все фото</SelectItem>
            <SelectItem value="with">С фото</SelectItem>
            <SelectItem value="without">Без фото</SelectItem>
          </SelectContent>
        </Select>

        <Select value={unitFilter} onValueChange={setUnitFilter}>
          <SelectTrigger className="h-8 text-xs w-[110px]">
            <SelectValue placeholder="Ед. изм." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все ед.</SelectItem>
            {unitOptions.map((u) => (
              <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-8 text-xs w-[130px]">
            <SelectValue placeholder="Тип" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все типы</SelectItem>
            {typeOptions.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={existingFilter} onValueChange={setExistingFilter}>
          <SelectTrigger className="h-8 text-xs w-[140px]">
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все товары</SelectItem>
            <SelectItem value="new">Только новые</SelectItem>
            <SelectItem value="existing">Уже в ассортименте</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={resetFilters}>
            <X className="h-3 w-3 mr-1" />
            Сбросить
          </Button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Package className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            {searchQuery || hasActiveFilters ? "Ничего не найдено" : "Нет доступных товаров"}
          </p>
        </div>
      ) : (
        <>
          {/* Compact Table */}
          <div className="border rounded-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead className="bg-muted/30 sticky top-0 z-10">
                  <tr className="border-b">
                    <th className="w-8 px-2 py-1.5 text-left">
                      <Checkbox
                        checked={
                          paginatedProducts.filter((p) => !existingProductIds.has(p.id)).length > 0 &&
                          paginatedProducts
                            .filter((p) => !existingProductIds.has(p.id))
                            .every((p) => selectedProducts.has(p.id))
                        }
                        onCheckedChange={handleSelectAllOnPage}
                        className="h-3.5 w-3.5"
                      />
                    </th>
                    <th className="w-10 px-1 py-1.5 text-center">Фото</th>
                    <th className="px-2 py-1.5 text-left font-medium text-muted-foreground min-w-[200px]">Название</th>
                    <th className="px-2 py-1.5 text-left font-medium text-muted-foreground w-[80px]">SKU</th>
                    <th className="px-2 py-1.5 text-left font-medium text-muted-foreground w-[50px]">Ед.</th>
                    <th className="px-2 py-1.5 text-left font-medium text-muted-foreground w-[70px]">Тип</th>
                    <th className="px-2 py-1.5 text-left font-medium text-muted-foreground w-[60px]">Объём</th>
                    <th className="px-2 py-1.5 text-left font-medium text-muted-foreground w-[140px]">Магазин</th>
                    <th className="px-2 py-1.5 text-center font-medium text-muted-foreground w-[70px]">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedProducts.map((product) => {
                    const isExisting = existingProductIds.has(product.id);
                    const isSelected = selectedProducts.has(product.id);
                    const photoCount = product.images?.length || 0;

                    return (
                      <tr
                        key={product.id}
                        className={`border-b h-[28px] cursor-pointer transition-colors ${
                          isExisting
                            ? "bg-muted/30 opacity-60"
                            : isSelected
                            ? "bg-primary/5"
                            : "hover:bg-muted/20"
                        }`}
                        onClick={() => !isExisting && handleToggleProduct(product.id)}
                      >
                        <td className="px-2">
                          {isExisting ? (
                            <Check className="h-3.5 w-3.5 text-green-500" />
                          ) : (
                            <Checkbox
                              checked={isSelected}
                              className="h-3.5 w-3.5 pointer-events-none"
                            />
                          )}
                        </td>
                        <td className="px-1 text-center">
                          {photoCount > 0 ? (
                            <span className="inline-flex items-center gap-0.5 text-muted-foreground">
                              <ImageIcon className="h-3 w-3" />
                              <span className="text-[10px]">{photoCount}</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </td>
                        <td className="px-2 font-medium truncate max-w-[300px]">
                          <span className="truncate block">{product.name}</span>
                        </td>
                        <td className="px-2 text-muted-foreground truncate">{product.sku || "—"}</td>
                        <td className="px-2 text-muted-foreground">{product.unit || "—"}</td>
                        <td className="px-2 text-muted-foreground truncate">
                          {product.packaging_type === "head" ? "Голова" :
                           product.packaging_type === "package" ? "Упак." :
                           product.packaging_type === "piece" ? "Штучн." :
                           product.packaging_type === "can" ? "Банка" :
                           product.packaging_type === "box" ? "Ящик" :
                           product.packaging_type === "carcass" ? "Туша" :
                           product.packaging_type || "—"}
                        </td>
                        <td className="px-2 text-muted-foreground">
                          {product.unit_weight ? `${product.unit_weight}` : "—"}
                        </td>
                        <td className="px-2 text-muted-foreground truncate max-w-[140px]">
                          <span className="inline-flex items-center gap-1 truncate">
                            <Store className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{product.store_name}</span>
                          </span>
                        </td>
                        <td className="px-2 text-center">
                          {isExisting ? (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              Есть
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-600 border-green-300">
                              Новый
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Стр. {page + 1} из {totalPages} ({filteredProducts.length} товаров)
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
                Назад
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Вперёд
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
