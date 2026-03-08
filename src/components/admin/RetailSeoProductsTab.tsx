import React, { useState, useMemo, useCallback } from "react";
import { Search, Sparkles, Loader2, ChevronRight, ImageOff, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ProductSeoPanel } from "./ProductSeoPanel";
import { useProductSeo } from "@/hooks/useProductSeo";
import { useStoreProducts } from "@/hooks/useStoreProducts";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  // Filter products that are in the retail catalog
  const retailProducts = useMemo(() => {
    return products;
  }, [products]);

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

  const handleBulkGenerate = async () => {
    const ids = filteredProducts.map(p => p.id);
    if (ids.length === 0) return;
    
    const confirmed = window.confirm(`Сгенерировать SEO для ${ids.length} товаров?`);
    if (!confirmed) return;
    
    await generateBulkSeo(ids);
    refetch();
  };

  const productsWithSeo = retailProducts.filter(p => (p as any).seo_title).length;

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
                  SEO для всех
                </>
              )}
            </Button>
          </div>
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

        {/* Product list */}
        <ScrollArea className="flex-1">
          {loading ? (
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
                const image = product.images?.[0];

                return (
                  <button
                    key={product.id}
                    onClick={() => setSelectedProductId(isSelected ? null : product.id)}
                    className={cn(
                      "w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/50 transition-colors",
                      isSelected && "bg-primary/5 border-l-2 border-l-primary"
                    )}
                  >
                    {/* Image */}
                    <div className="w-10 h-10 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                      {image ? (
                        <img src={image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageOff className="h-4 w-4 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
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
