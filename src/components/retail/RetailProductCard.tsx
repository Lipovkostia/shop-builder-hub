import { useState, useCallback, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { Heart, ImageOff, Plus, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import type { RetailProduct } from "@/hooks/useRetailStore";

interface RetailProductCardProps {
  product: RetailProduct;
  onAddToCart: (product: RetailProduct) => void;
  onUpdateQuantity?: (productId: string, quantity: number) => void;
  cartQuantity?: number;
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
  return unit;
}

export function RetailProductCard({ 
  product, 
  onAddToCart,
  onUpdateQuantity,
  cartQuantity = 0,
  isFavorite = false,
  onToggleFavorite,
}: RetailProductCardProps) {
  const { subdomain } = useParams();
  const isMobile = useIsMobile();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageError, setImageError] = useState(false);
  
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
  const isInCart = cartQuantity > 0;
  const cartItemTotal = cartQuantity * product.price;

  const handleAddToCart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isOutOfStock) return;
    
    onAddToCart(product);
  }, [product, onAddToCart, isOutOfStock]);

  const handleIncrement = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isOutOfStock) return;
    
    onAddToCart(product);
  }, [product, onAddToCart, isOutOfStock]);

  const handleDecrement = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onUpdateQuantity) return;
    
    const newQuantity = cartQuantity - 1;
    onUpdateQuantity(product.id, newQuantity);
  }, [product.id, cartQuantity, onUpdateQuantity]);

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
    const threshold = 50;
    
    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
      } else {
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
            "absolute -top-3 -right-3 p-1 transition-all z-10",
            isFavorite && "text-destructive drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]"
          )}
        >
          <Heart className={cn("h-7 w-7", isFavorite && "fill-current")} />
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

        {/* Image indicators */}
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
        {isInCart ? (
          <>
            {/* Compact cart info - numbers only */}
            <div className="text-[10px] text-center text-muted-foreground leading-none pb-0.5">
              {cartQuantity} × {formatPrice(cartItemTotal)}
            </div>
            
            {/* Quantity controls when in cart */}
            <div className="flex h-12">
              {/* Minus button */}
              <button
                onClick={handleDecrement}
                className="w-8 h-full flex items-center justify-center bg-muted hover:bg-muted/80 transition-colors text-foreground"
              >
                <Minus className="h-3 w-3" />
              </button>
              
              {/* Price display */}
              <div 
                className="flex-1 h-full flex items-center justify-center bg-primary text-primary-foreground text-xs font-medium"
                onClick={handleAddToCart}
              >
                <span className="flex items-center gap-1">
                  <span className="font-semibold">{formatPrice(product.price)}</span>
                  {product.unit && (
                    <span className="text-[10px] opacity-80">/ {formatUnit(product.unit)}</span>
                  )}
                </span>
              </div>
              
              {/* Plus button */}
              <button
                onClick={handleIncrement}
                disabled={isOutOfStock}
                className="w-8 h-full flex items-center justify-center bg-primary hover:bg-primary/90 transition-colors text-primary-foreground"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          </>
        ) : (
          /* Default buy button */
          <button
            onClick={handleAddToCart}
            disabled={isOutOfStock}
            className={cn(
              "w-full h-12 rounded-none text-sm font-medium transition-all flex items-center justify-center gap-2",
              "bg-primary text-primary-foreground hover:opacity-90",
              isOutOfStock && "opacity-50 cursor-not-allowed"
            )}
          >
            <span className="flex items-center gap-2">
              <span className="font-semibold">{formatPrice(product.price)}</span>
              {product.unit && (
                <span className="text-xs opacity-80">/ {formatUnit(product.unit)}</span>
              )}
            </span>
          </button>
        )}
      </div>
    </Link>
  );
}
