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
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
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
      className="group bg-card rounded-xl border overflow-hidden hover:shadow-lg transition-all duration-200 flex flex-col"
    >
      {/* Image section */}
      <div className="relative aspect-square bg-muted overflow-hidden">
        {currentImage && !imageError ? (
          <img
            src={currentImage}
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

        {/* Favorite button */}
        <button
          onClick={handleFavorite}
          className={cn(
            "absolute top-3 right-3 p-2 rounded-full bg-background/80 backdrop-blur transition-all hover:bg-background",
            isFavorite && "text-destructive"
          )}
        >
          <Heart className={cn("h-5 w-5", isFavorite && "fill-current")} />
        </button>

        {/* Sale badge */}
        {hasDiscount && (
          <Badge 
            className="absolute top-3 left-3 bg-destructive text-destructive-foreground font-semibold"
          >
            АКЦИЯ
          </Badge>
        )}

        {/* Out of stock overlay */}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
            <Badge variant="secondary" className="text-sm">Нет в наличии</Badge>
          </div>
        )}

        {/* Image carousel controls */}
        {hasMultipleImages && !isOutOfStock && (
          <>
            {/* Nav arrows */}
            <button
              onClick={handlePrevImage}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-background/80 backdrop-blur opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={handleNextImage}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-background/80 backdrop-blur opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            {/* Dots indicator */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {images.map((_, idx) => (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setCurrentImageIndex(idx);
                  }}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all",
                    idx === currentImageIndex 
                      ? "bg-foreground w-4" 
                      : "bg-foreground/40 hover:bg-foreground/60"
                  )}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col">
        {/* Name */}
        <h3 className="font-semibold text-base leading-tight line-clamp-2 group-hover:text-primary transition-colors mb-2">
          {product.name}
        </h3>

        {/* Category */}
        {product.category_name && (
          <span className="text-xs text-primary font-medium uppercase tracking-wide mb-auto">
            {product.category_name}
          </span>
        )}

        {/* Buy button with price */}
        <Button
          onClick={handleAddToCart}
          disabled={isOutOfStock}
          className={cn(
            "w-full mt-4 h-12 text-base font-semibold transition-all justify-between px-4",
            isAdded && "bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]"
          )}
        >
          {isAdded ? (
            <span className="flex items-center gap-2">
              <Check className="h-5 w-5" />
              Добавлено
            </span>
          ) : (
            <span>КУПИТЬ</span>
          )}
          <span className="flex items-center gap-2">
            <span className="text-sm opacity-80">{product.unit}</span>
            <span className="font-bold">{formatPrice(product.price)}</span>
          </span>
        </Button>

        {/* Compare price if discounted */}
        {hasDiscount && (
          <div className="text-center mt-2">
            <span className="text-sm text-muted-foreground line-through">
              {formatPrice(product.compare_price!)}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
