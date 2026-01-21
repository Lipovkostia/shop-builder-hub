import { useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { Heart, Check, ImageOff, ChevronLeft, ChevronRight } from "lucide-react";
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
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price) + " ₽";
}

function formatWeight(unit: string | null): string {
  if (!unit) return "";
  // Extract weight from unit string or return as-is
  return unit.toUpperCase();
}

export function RetailProductCard({ product, onAddToCart }: RetailProductCardProps) {
  const { subdomain } = useParams();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageError, setImageError] = useState(false);
  const [isAdded, setIsAdded] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  const images = product.images || [];
  const hasMultipleImages = images.length > 1;
  const currentImage = images[currentImageIndex];
  
  const hasDiscount = product.compare_price && product.compare_price > product.price;
  const isOutOfStock = product.catalog_status === 'out_of_stock';

  const handleAddToCart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isOutOfStock) return;
    
    onAddToCart(product);
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 1500);
  }, [product, onAddToCart, isOutOfStock]);

  const handleFavorite = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFavorite(!isFavorite);
  }, [isFavorite]);

  const handlePrevImage = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  }, [images.length]);

  const handleNextImage = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  }, [images.length]);

  return (
    <Link
      to={`/retail/${subdomain}/product/${product.id}`}
      className="group bg-card rounded-lg overflow-hidden flex flex-col"
    >
      {/* Image section */}
      <div className="relative aspect-square bg-muted overflow-hidden rounded-lg">
        {currentImage && !imageError ? (
          <img
            src={currentImage}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={() => setImageError(true)}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <ImageOff className="h-12 w-12 text-muted-foreground/30" />
          </div>
        )}

        {/* Favorite button */}
        <button
          onClick={handleFavorite}
          className={cn(
            "absolute top-3 right-3 p-2.5 rounded-full bg-card/80 backdrop-blur transition-all hover:bg-card",
            isFavorite && "text-destructive"
          )}
        >
          <Heart className={cn("h-4 w-4", isFavorite && "fill-current")} />
        </button>

        {/* Sale badge */}
        {hasDiscount && (
          <Badge 
            className="absolute bottom-3 right-3 bg-primary text-primary-foreground font-medium text-[10px] uppercase tracking-wide px-2 py-1"
          >
            Акция
          </Badge>
        )}

        {/* Out of stock overlay */}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
            <span className="text-sm font-medium text-muted-foreground">Нет в наличии</span>
          </div>
        )}

        {/* Image carousel dots */}
        {hasMultipleImages && !isOutOfStock && (
          <div className="absolute bottom-3 left-3 flex gap-1">
            {images.map((_, idx) => (
              <button
                key={idx}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setCurrentImageIndex(idx);
                }}
                className={cn(
                  "w-1.5 h-1.5 rounded-full transition-all",
                  idx === currentImageIndex 
                    ? "bg-foreground" 
                    : "bg-foreground/30"
                )}
              />
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="pt-4 pb-2 flex-1 flex flex-col">
        {/* Name */}
        <h3 className="font-medium text-base leading-snug line-clamp-2 text-foreground mb-1">
          {product.name}
        </h3>

        {/* Category */}
        {product.category_name && (
          <span className="text-[11px] text-accent font-medium uppercase tracking-wide mb-auto">
            {product.category_name}
          </span>
        )}

        {/* Buy button with price */}
        <button
          onClick={handleAddToCart}
          disabled={isOutOfStock}
          className={cn(
            "w-full mt-4 h-11 rounded-md text-sm font-medium transition-all flex items-center justify-between px-4",
            isAdded 
              ? "bg-success text-success-foreground"
              : "bg-primary text-primary-foreground hover:opacity-90",
            isOutOfStock && "opacity-50 cursor-not-allowed"
          )}
        >
          {isAdded ? (
            <span className="flex items-center gap-2">
              <Check className="h-4 w-4" />
              Добавлено
            </span>
          ) : (
            <span className="uppercase tracking-wide">Купить</span>
          )}
          <span className="flex items-center gap-2">
            {product.unit && (
              <span className="text-xs opacity-70">{formatWeight(product.unit)}</span>
            )}
            <span className="font-semibold">{formatPrice(product.price)}</span>
          </span>
        </button>

        {/* Compare price if discounted */}
        {hasDiscount && (
          <div className="text-center mt-2">
            <span className="text-xs text-muted-foreground line-through">
              {formatPrice(product.compare_price!)}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
