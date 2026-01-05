import React from "react";
import { Package, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { ProductEditPanel } from "./ProductEditPanel";
import { cn } from "@/lib/utils";
import type { StoreProduct } from "@/hooks/useStoreProducts";

interface Catalog {
  id: string;
  name: string;
  is_default: boolean;
}

interface ProductCardProps {
  product: StoreProduct;
  isExpanded: boolean;
  onToggleExpand: () => void;
  catalogs: Catalog[];
  productCatalogIds: string[];
  onSave: (productId: string, updates: Partial<StoreProduct>) => Promise<void>;
  onCatalogsChange: (productId: string, catalogIds: string[]) => void;
}

export function ProductCard({
  product,
  isExpanded,
  onToggleExpand,
  catalogs,
  productCatalogIds,
  onSave,
  onCatalogsChange,
}: ProductCardProps) {
  const catalogCount = productCatalogIds.length;

  return (
    <div className="border-b last:border-b-0">
      {/* Clickable product row */}
      <div
        className={cn(
          "p-4 flex items-center gap-4 cursor-pointer transition-colors",
          isExpanded ? "bg-muted/50" : "hover:bg-muted/30"
        )}
        onClick={onToggleExpand}
      >
        {/* Product image */}
        <div className="w-12 h-12 rounded bg-muted flex-shrink-0 overflow-hidden">
          {product.images?.[0] ? (
            <img
              src={product.images[0]}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Product info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium truncate">{product.name}</p>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform flex-shrink-0",
                isExpanded && "rotate-180"
              )}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {product.price} ₽ / {product.unit || "шт"}
            {product.buy_price && (
              <span className="ml-2 text-xs">
                (закупка: {product.buy_price} ₽)
              </span>
            )}
          </p>
        </div>

        {/* Status badges */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {product.is_active === false && (
            <Badge variant="secondary" className="text-xs">
              Скрыт
            </Badge>
          )}
          {catalogCount > 0 && (
            <Badge variant="outline" className="text-xs">
              {catalogCount} прайс
            </Badge>
          )}
        </div>
      </div>

      {/* Expandable edit panel */}
      <Collapsible open={isExpanded}>
        <CollapsibleContent>
          <ProductEditPanel
            product={product}
            catalogs={catalogs}
            productCatalogIds={productCatalogIds}
            onSave={onSave}
            onCatalogsChange={onCatalogsChange}
            onClose={onToggleExpand}
          />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
