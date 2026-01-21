import { useState, useCallback, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { Heart, Check, ImageOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import type { RetailProduct } from "@/hooks/useRetailStore";

interface RetailProductCardProps {
  product: RetailProduct;
  onAddToCart: (product: RetailProduct) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (productId: string) => void;
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price) + " ₽";
}

function formatUnit(unit: string | null): string {
  if (!unit) return "";
  // Return unit as-is for display (e.g., "1 кг", "150г", "шт")
  return unit;
}

export function RetailProductCard({ 
  product, 
  onAddToCart,
  isFavorite = false,
  onToggleFavorite,
}: RetailProductCardProps) {
  const { subdomain } = useParams();
  const isMobile = useIsMobile();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageError, setImageError] = useState(false);
  const [isAdded, setIsAdded] = useState(false);
  
  // Touch/swipe handling for mobile
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  
  // Image container ref for cursor tracking on desktop
  const imageContainerRef = useRef<HTMLDivElement>(null);

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
    onToggleFavorite?.(product.id);
  }, [onToggleFavorite, product.id]);

  // Mobile touch handlers for swipe
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!hasMultipleImages || !isMobile) return;
    touchStartX.current = e.touches[0].clientX;
  }, [hasMultipleImages, isMobile]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!hasMultipleImages || !isMobile) return;
    touchEndX.current = e.touches[0].clientX;
  }, [hasMultipleImages, isMobile]);

  const handleTouchEnd = useCallback(() => {
    if (!hasMultipleImages || !isMobile) return;
    
    const diff = touchStartX.current - touchEndX.current;
    const threshold = 50; // minimum swipe distance
    
    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        // Swipe left - next image
        setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
      } else {
        // Swipe right - previous image
        setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
      }
    }
    
    touchStartX.current = 0;
    touchEndX.current = 0;
  }, [hasMultipleImages, isMobile, images.length]);

  // Desktop mouse movement handler for cursor-based image switching
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!hasMultipleImages || isMobile || !imageContainerRef.current) return;
    
    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    
    // Divide the image area into sections based on number of images
    const sectionWidth = width / images.length;
    const newIndex = Math.min(Math.floor(x / sectionWidth), images.length - 1);
    
    if (newIndex !== currentImageIndex && newIndex >= 0) {
      setCurrentImageIndex(newIndex);
    }
  }, [hasMultipleImages, isMobile, images.length, currentImageIndex]);

  const handleMouseLeave = useCallback(() => {
    if (!isMobile && hasMultipleImages) {
      setCurrentImageIndex(0);
    }
  }, [isMobile, hasMultipleImages]);

  return (
    <Link
      to={`/retail/${subdomain}/product/${product.id}`}
      className="group bg-card rounded-xl overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-shadow"
    >
      {/* Image section */}
      <div 
        ref={imageContainerRef}
        className="relative aspect-square bg-muted overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {currentImage && !imageError ? (
          <img
            src={currentImage}
            alt={product.name}
            className="w-full h-full object-cover transition-opacity duration-200"
            onError={() => setImageError(true)}
            loading="lazy"
            draggable={false}
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

        {/* Image indicators (dots for mobile, sections for desktop) */}
        {hasMultipleImages && !isOutOfStock && (
          <div className="absolute bottom-3 left-3 flex gap-1">
            {images.map((_, idx) => (
              <div
                key={idx}
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

      {/* Product name - below image, 2 lines max with fade */}
      <div className="px-3 py-3">
        <h3 className="font-medium text-sm leading-snug text-foreground line-clamp-2 min-h-[2.5rem]">
          {product.name}
        </h3>
      </div>

      {/* Buy button - fills bottom of card */}
      <div className="mt-auto">
        <button
          onClick={handleAddToCart}
          disabled={isOutOfStock}
          className={cn(
            "w-full h-12 rounded-none text-sm font-medium transition-all flex items-center justify-center gap-2",
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
            <span className="flex items-center gap-2">
              <span className="font-semibold">{formatPrice(product.price)}</span>
              {product.unit && (
                <span className="text-xs opacity-80">/ {formatUnit(product.unit)}</span>
              )}
            </span>
          )}
        </button>
      </div>
    </Link>
  );
}
