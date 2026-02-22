import { X, Plus, Minus, ShoppingBag, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { RetailProduct } from "@/hooks/useRetailStore";
import { useState } from "react";

interface RetailProductDetailPanelProps {
  product: RetailProduct | null;
  onClose: () => void;
  onAddToCart: (product: RetailProduct) => void;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  cartQuantity: number;
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price) + " ₽";
}

export function RetailProductDetailPanel({
  product,
  onClose,
  onAddToCart,
  onUpdateQuantity,
  cartQuantity,
}: RetailProductDetailPanelProps) {
  const [imageError, setImageError] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Reset state when product changes
  const images = product?.images || [];
  const currentImage = images[currentImageIndex] || null;
  const hasDiscount = product?.compare_price && product.compare_price > (product?.price ?? 0);
  const isInCart = cartQuantity > 0;

  if (!product) return null;

  return (
    <aside
      className={cn(
        "absolute inset-0 z-10 bg-background flex flex-col",
        "animate-slide-in-right"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground truncate">Товар</h3>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted-foreground/20 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-4 py-4 space-y-4">
          {/* Image */}
          <div className="w-full aspect-square rounded-xl bg-muted overflow-hidden">
            {currentImage && !imageError ? (
              <img
                src={currentImage}
                alt={product.name}
                className="w-full h-full object-cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ImageOff className="h-12 w-12 text-muted-foreground/30" />
              </div>
            )}
          </div>

          {/* Image dots */}
          {images.length > 1 && (
            <div className="flex justify-center gap-1.5">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => { setCurrentImageIndex(i); setImageError(false); }}
                  className={cn(
                    "w-2 h-2 rounded-full transition-colors",
                    i === currentImageIndex ? "bg-primary" : "bg-muted-foreground/30"
                  )}
                />
              ))}
            </div>
          )}

          {/* Name */}
          <h2 className="text-base font-semibold text-foreground leading-snug">
            {product.name}
          </h2>

          {/* Unit */}
          {product.unit && (
            <p className="text-xs text-muted-foreground">{product.unit}</p>
          )}

          {/* Description */}
          {product.description && (
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {product.description}
            </p>
          )}

          {/* Price */}
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">
              {formatPrice(product.price)}
            </span>
            {hasDiscount && (
              <span className="text-sm text-muted-foreground line-through">
                {formatPrice(product.compare_price!)}
              </span>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Footer: add to cart */}
      <div className="border-t border-border px-4 py-4">
        {isInCart ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button
                className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center hover:bg-muted-foreground/20 transition-colors"
                onClick={() => onUpdateQuantity(product.id, cartQuantity - 1)}
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-10 text-center text-base font-semibold">
                {cartQuantity}
              </span>
              <button
                className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center hover:bg-muted-foreground/20 transition-colors"
                onClick={() => onUpdateQuantity(product.id, cartQuantity + 1)}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <span className="font-bold text-lg text-foreground">
              {formatPrice(product.price * cartQuantity)}
            </span>
          </div>
        ) : (
          <Button
            className="w-full h-12 text-base font-semibold rounded-xl"
            size="lg"
            onClick={() => onAddToCart(product)}
          >
            <ShoppingBag className="h-5 w-5 mr-2" />
            Добавить в корзину
          </Button>
        )}
      </div>
    </aside>
  );
}
