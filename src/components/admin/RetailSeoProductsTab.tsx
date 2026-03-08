import React, { useState, useMemo, useEffect } from "react";
import { Search, Sparkles, Loader2, ChevronRight, ImageOff, ExternalLink, Filter, CheckSquare, Square, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { ProductSeoPanel } from "./ProductSeoPanel";
import { useProductSeo } from "@/hooks/useProductSeo";
import { useStoreProducts } from "@/hooks/useStoreProducts";
import { useStoreAiAccess, AI_MODELS } from "@/hooks/useStoreAiAccess";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface RetailSeoProductsTabProps {
  storeId: string | null;
  storeName?: string;
  subdomain?: string;
  retailCatalogId?: string | null;
}

export function RetailSeoProductsTab({ storeId, storeName, subdomain, retailCatalogId }: RetailSeoProductsTabProps) {
  const { products, loading, refetch } = useStoreProducts(storeId);
  const { generating, progress, generateBulkSeo } = useProductSeo(storeId, storeName, "retail");
  const { access, updateModel, getModel } = useStoreAiAccess(storeId);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [onlyRetailCatalog, setOnlyRetailCatalog] = useState(true);
  const [retailProductIds, setRetailProductIds] = useState<Set<string> | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  const currentModel = getModel("seo");

  // Load retail catalog product IDs
  useEffect(() => {
    if (!retailCatalogId || !onlyRetailCatalog) {
      setRetailProductIds(null);
      return;
    }
    setLoadingCatalog(true);
    const load = async () => {
      const { data: cps } = await supabase
        .from("catalog_product_settings")
        .select("product_id")
        .eq("catalog_id", retailCatalogId);
      
      if (cps && cps.length > 0) {
        setRetailProductIds(new Set(cps.map(r => r.product_id)));
      } else {
        const { data: pcv } = await supabase
          .from("product_catalog_visibility")
          .select("product_id")
          .eq("catalog_id", retailCatalogId);
        setRetailProductIds(new Set((pcv || []).map(r => r.product_id)));
      }
      setLoadingCatalog(false);
    };
    load();
  }, [retailCatalogId, onlyRetailCatalog]);

  const retailProducts = useMemo(() => {
    if (!onlyRetailCatalog || !retailProductIds) return products;
    return products.filter(p => retailProductIds.has(p.id));
  }, [products, onlyRetailCatalog, retailProductIds]);

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return retailProducts;
    const q = searchQuery.toLowerCase();
    return retailProducts.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.sku && p.sku.toLowerCase().includes(q))
    );
  }, [retailProducts, searchQuery]);

  const selectedProduct = useMemo(() => {
    if (!selectedProductId) return null;
    return products.find(p => p.id === selectedProductId) || null;
  }, [products, selectedProductId]);

  // Bulk for checked or all filtered
  const handleBulkGenerate = async () => {
    const ids = checkedIds.size > 0
      ? filteredProducts.filter(p => checkedIds.has(p.id)).map(p => p.id)
      : filteredProducts.map(p => p.id);
    if (ids.length === 0) return;
    
    const label = checkedIds.size > 0 ? `выбранных ${ids.length}` : `всех ${ids.length}`;
    const confirmed = window.confirm(`Сгенерировать SEO для ${label} товаров?`);
    if (!confirmed) return;
    
    await generateBulkSeo(ids);
    setCheckedIds(new Set());
    refetch();
  };

  const toggleCheck = (id: string) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (checkedIds.size === filteredProducts.length) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(filteredProducts.map(p => p.id)));
    }
  };

  const productsWithSeo = retailProducts.filter(p => (p as any).seo_title).length;
  const allChecked = filteredProducts.length > 0 && checkedIds.size === filteredProducts.length;

  return (
    <div className="flex gap-0 h-[calc(100vh-280px)] min-h-[500px]">
      {/* Product list */}
      <div className={cn(
        "flex flex-col border border-border rounded-lg overflow-hidden bg-card",
        selectedProduct ? "w-1/2" : "w-full"
      )}>
        {/* Header */}
        <div className="p-4 border-b border-border space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">SEO товаров</h3>
              <p className="text-xs text-muted-foreground">
                {productsWithSeo} из {retailProducts.length} товаров с SEO
                {onlyRetailCatalog && retailCatalogId && (
                  <span className="ml-1 text-primary">(только розница)</span>
                )}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleBulkGenerate}
              disabled={generating || filteredProducts.length === 0}
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  {progress ? `${progress.current}/${progress.total}` : "..."}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-1" />
                  {checkedIds.size > 0 ? `SEO для ${checkedIds.size} выбр.` : "SEO для всех"}
                </>
              )}
            </Button>
          </div>

          {/* Model selector */}
          <div className="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-2">
            <Bot className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Модель:</span>
            <Select
              value={currentModel}
              onValueChange={(val) => updateModel("seo_model", val)}
            >
              <SelectTrigger className="h-7 text-xs border-0 bg-transparent shadow-none px-1 min-w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AI_MODELS.map(m => (
                  <SelectItem key={m.value} value={m.value} className="text-xs">
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {retailCatalogId && (
            <div className="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-2">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <Label htmlFor="retail-filter" className="text-xs font-medium cursor-pointer">
                Только товары розничного магазина
              </Label>
              <Switch
                id="retail-filter"
                checked={onlyRetailCatalog}
                onCheckedChange={setOnlyRetailCatalog}
                className="ml-auto"
              />
            </div>
          )}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Поиск товаров..."
              className="pl-9 h-9 text-sm"
            />
          </div>
        </div>

        {/* Select all bar */}
        {filteredProducts.length > 0 && (
          <div className="px-4 py-2 border-b border-border flex items-center gap-2 bg-muted/30">
            <Checkbox
              checked={allChecked}
              onCheckedChange={toggleAll}
              className="h-4 w-4"
            />
            <span className="text-xs text-muted-foreground">
              {checkedIds.size > 0 ? `Выбрано: ${checkedIds.size}` : "Выбрать все"}
            </span>
            {checkedIds.size > 0 && (
              <button
                onClick={() => setCheckedIds(new Set())}
                className="text-xs text-primary ml-auto hover:underline"
              >
                Сбросить
              </button>
            )}
          </div>
        )}

        {/* Product list */}
        <ScrollArea className="flex-1">
          {loading || loadingCatalog ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Товары не найдены
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredProducts.map(product => {
                const hasSeo = !!(product as any).seo_title;
                const isSelected = selectedProductId === product.id;
                const isChecked = checkedIds.has(product.id);
                const image = product.images?.[0];

                return (
                  <div
                    key={product.id}
                    className={cn(
                      "flex items-center gap-1 hover:bg-muted/50 transition-colors",
                      isSelected && "bg-primary/5 border-l-2 border-l-primary"
                    )}
                  >
                    <div className="pl-3 flex items-center" onClick={e => e.stopPropagation()}>
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleCheck(product.id)}
                        className="h-4 w-4"
                      />
                    </div>
                    <button
                      onClick={() => setSelectedProductId(isSelected ? null : product.id)}
                      className="flex-1 text-left px-2 py-3 flex items-center gap-3"
                    >
                      <div className="w-10 h-10 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                        {image ? (
                          <img src={image} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageOff className="h-4 w-4 text-muted-foreground/30" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{product.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {product.sku && (
                            <span className="text-xs text-muted-foreground">{product.sku}</span>
                          )}
                          {hasSeo ? (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-emerald-50 text-emerald-600 border-emerald-200">
                              SEO ✓
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-muted-foreground">
                              Без SEO
                            </Badge>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* SEO Panel */}
      {selectedProduct && (
        <div className="w-1/2 border border-border border-l-0 rounded-r-lg overflow-hidden bg-card">
          <ScrollArea className="h-full">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-sm truncate">{selectedProduct.name}</h3>
              {subdomain && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(`/retail/${subdomain}/p/${selectedProduct.slug}`, "_blank")}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Открыть
                </Button>
              )}
            </div>
            <div className="p-2">
              <ProductSeoPanel
                product={selectedProduct as any}
                storeId={storeId}
                storeName={storeName}
                subdomain={subdomain}
                storeType="retail"
                onUpdate={refetch}
              />
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
