import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ShoppingCart, Check, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { RetailProduct } from "@/hooks/useRetailStore";

interface RetailProductCardProps {
  product: RetailProduct;
  onAddToCart: (product: RetailProduct) => void;
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

export function RetailProductCard({ product, onAddToCart }: RetailProductCardProps) {
  const { subdomain } = useParams();
  const [imageError, setImageError] = useState(false);
  const [isAdded, setIsAdded] = useState(false);

  const mainImage = product.images?.[0];
  const hasDiscount = product.compare_price && product.compare_price > product.price;
  const discountPercent = hasDiscount
    ? Math.round(((product.compare_price! - product.price) / product.compare_price!) * 100)
    : 0;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onAddToCart(product);
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 1500);
  };

  return (
    <Link
      to={`/retail/${subdomain}/product/${product.id}`}
      className="group bg-card rounded-lg border overflow-hidden hover:shadow-lg transition-all duration-200"
    >
      {/* Image */}
      <div className="relative aspect-square bg-muted overflow-hidden">
        {mainImage && !imageError ? (
          <img
            src={mainImage}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setImageError(true)}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageOff className="h-12 w-12 text-muted-foreground/30" />
          </div>
        )}

        {/* Discount badge */}
        {hasDiscount && (
          <Badge className="absolute top-2 left-2 bg-destructive text-destructive-foreground">
            -{discountPercent}%
          </Badge>
        )}

        {/* Out of stock overlay */}
        {product.quantity <= 0 && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
            <Badge variant="secondary">Нет в наличии</Badge>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3 space-y-2">
        {/* Category */}
        {product.category_name && (
          <span className="text-xs text-muted-foreground">{product.category_name}</span>
        )}

        {/* Name */}
        <h3 className="font-medium text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors min-h-[2.5rem]">
          {product.name}
        </h3>

        {/* Price */}
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold">{formatPrice(product.price)}</span>
          {hasDiscount && (
            <span className="text-sm text-muted-foreground line-through">
              {formatPrice(product.compare_price!)}
            </span>
          )}
        </div>

        {/* Unit info */}
        <span className="text-xs text-muted-foreground">
          за {product.unit}
        </span>

        {/* Add to cart button */}
        <Button
          onClick={handleAddToCart}
          disabled={product.quantity <= 0}
          className={cn(
            "w-full mt-2 transition-all",
            isAdded && "bg-emerald-600 hover:bg-emerald-600 dark:bg-emerald-700 dark:hover:bg-emerald-700"
          )}
          size="sm"
        >
          {isAdded ? (
            <>
              <Check className="h-4 w-4 mr-1" />
              Добавлено
            </>
          ) : (
            <>
              <ShoppingCart className="h-4 w-4 mr-1" />
              В корзину
            </>
          )}
        </Button>
      </div>
    </Link>
  );
}
