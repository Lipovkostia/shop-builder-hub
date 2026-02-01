import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Plus, Package, Store, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Product } from "./types";

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

interface MegacatalogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingProductIds: Set<string>;
  onAddProducts: (products: MegacatalogProduct[]) => Promise<void>;
}

export function MegacatalogDialog({
  open,
  onOpenChange,
  existingProductIds,
  onAddProducts,
}: MegacatalogDialogProps) {
  const { toast } = useToast();
  const [products, setProducts] = useState<MegacatalogProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);

  // Fetch all products from all stores
  useEffect(() => {
    if (!open) return;

    const fetchProducts = async () => {
      setLoading(true);
      try {
        // Fetch products with store names
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
  }, [open, toast]);

  // Filter products by search
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const query = searchQuery.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        (p.sku && p.sku.toLowerCase().includes(query)) ||
        (p.description && p.description.toLowerCase().includes(query))
    );
  }, [products, searchQuery]);

  // Group by first letter for better navigation
  const groupedProducts = useMemo(() => {
    const groups: Record<string, MegacatalogProduct[]> = {};
    for (const product of filteredProducts) {
      const firstLetter = product.name.charAt(0).toUpperCase() || "#";
      if (!groups[firstLetter]) {
        groups[firstLetter] = [];
      }
      groups[firstLetter].push(product);
    }
    return groups;
  }, [filteredProducts]);

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
      onOpenChange(false);
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
  }, [selectedProducts, products, onAddProducts, onOpenChange, toast]);

  const handleSelectAll = useCallback(() => {
    const notExisting = filteredProducts.filter((p) => !existingProductIds.has(p.id));
    if (selectedProducts.size === notExisting.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(notExisting.map((p) => p.id)));
    }
  }, [filteredProducts, existingProductIds, selectedProducts.size]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Мегакаталог
            <Badge variant="secondary" className="ml-2">
              {products.length} товаров
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Search and actions */}
        <div className="flex items-center gap-2 pb-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по названию, SKU или описанию..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" size="sm" onClick={handleSelectAll}>
            {selectedProducts.size === filteredProducts.filter((p) => !existingProductIds.has(p.id)).length
              ? "Снять всё"
              : "Выбрать всё"}
          </Button>
        </div>

        {/* Selected count and add button */}
        {selectedProducts.size > 0 && (
          <div className="flex items-center justify-between bg-primary/10 px-4 py-2 rounded-md">
            <span className="text-sm font-medium">
              Выбрано: {selectedProducts.size} товар(ов)
            </span>
            <Button size="sm" onClick={handleAddSelected} disabled={adding}>
              {adding ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Добавить в ассортимент
            </Button>
          </div>
        )}

        {/* Product list */}
        <ScrollArea className="flex-1 -mx-6 px-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {searchQuery ? "Ничего не найдено" : "Нет доступных товаров"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedProducts)
                .sort(([a], [b]) => a.localeCompare(b, "ru"))
                .map(([letter, prods]) => (
                  <div key={letter}>
                    <div className="sticky top-0 bg-background py-1 mb-2 z-10">
                      <Badge variant="outline" className="text-xs">
                        {letter}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {prods.map((product) => {
                        const isExisting = existingProductIds.has(product.id);
                        const isSelected = selectedProducts.has(product.id);
                        const imageUrl = product.images?.[0];

                        return (
                          <div
                            key={product.id}
                            className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-colors ${
                              isExisting
                                ? "bg-muted/50 opacity-60 cursor-not-allowed"
                                : isSelected
                                ? "border-primary bg-primary/5"
                                : "hover:bg-muted/30"
                            }`}
                            onClick={() => !isExisting && handleToggleProduct(product.id)}
                          >
                            {/* Checkbox */}
                            <div className="flex-shrink-0">
                              {isExisting ? (
                                <Check className="h-4 w-4 text-green-500" />
                              ) : (
                                <Checkbox
                                  checked={isSelected}
                                  className="pointer-events-none"
                                />
                              )}
                            </div>

                            {/* Image */}
                            <div className="w-12 h-12 flex-shrink-0 rounded-md overflow-hidden bg-muted">
                              {imageUrl ? (
                                <img
                                  src={imageUrl}
                                  alt={product.name}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Package className="h-5 w-5 text-muted-foreground" />
                                </div>
                              )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{product.name}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                {product.sku && (
                                  <span className="truncate max-w-[80px]">{product.sku}</span>
                                )}
                                <span className="flex items-center gap-1">
                                  <Store className="h-3 w-3" />
                                  {product.store_name}
                                </span>
                              </div>
                            </div>

                            {/* Price */}
                            <div className="text-right flex-shrink-0">
                              <p className="font-medium text-sm">
                                {product.price > 0
                                  ? `${product.price.toLocaleString("ru-RU")} ₽`
                                  : product.buy_price
                                  ? `${product.buy_price.toLocaleString("ru-RU")} ₽`
                                  : "—"}
                              </p>
                              {product.unit && (
                                <p className="text-xs text-muted-foreground">/{product.unit}</p>
                              )}
                            </div>

                            {/* Already added badge */}
                            {isExisting && (
                              <Badge variant="secondary" className="text-xs flex-shrink-0">
                                Уже есть
                              </Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
