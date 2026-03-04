import { X, Plus, Minus, ShoppingBag, ImageOff, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { WholesaleProduct } from "@/hooks/useWholesaleStore";
import { useState, useEffect } from "react";
import { FullscreenImageViewer } from "@/components/ui/fullscreen-image-viewer";

interface WholesaleProductDetailPanelProps {
  product: WholesaleProduct | null;
  onClose: () => void;
  onAddToCart: (product: WholesaleProduct) => void;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  cartQuantity: number;
}

function formatPrice(price: number): string {
  return price.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₽";
}

export function WholesaleProductDetailPanel({
  product,
  onClose,
  onAddToCart,
  onUpdateQuantity,
  cartQuantity,
}: WholesaleProductDetailPanelProps) {
  const [imageError, setImageError] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);

  useEffect(() => {
    setCurrentImageIndex(0);
    setImageError(false);
  }, [product?.id]);

  if (!product) return null;

  const images = product.images || [];
  const currentImage = images[currentImageIndex] || null;
  const hasMultipleImages = images.length > 1;
  const isInCart = cartQuantity > 0;

  const goPrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex(i => (i === 0 ? images.length - 1 : i - 1));
    setImageError(false);
  };

  const goNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex(i => (i === images.length - 1 ? 0 : i + 1));
    setImageError(false);
  };

  const handleImageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const edgeZone = width * 0.25;
    if (hasMultipleImages && clickX < edgeZone) {
      setCurrentImageIndex(i => (i === 0 ? images.length - 1 : i - 1));
      setImageError(false);
    } else if (hasMultipleImages && clickX > width - edgeZone) {
      setCurrentImageIndex(i => (i === images.length - 1 ? 0 : i + 1));
      setImageError(false);
    } else {
      setFullscreenOpen(true);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <aside className="fixed top-0 right-0 z-50 h-full w-full max-w-md bg-background border-l shadow-xl flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
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
            <div
              className="w-full aspect-square rounded-xl bg-muted overflow-hidden relative cursor-pointer group"
              onMouseEnter={() => setIsHovering(true)}
              onMouseLeave={() => setIsHovering(false)}
              onClick={handleImageClick}
            >
              {currentImage && !imageError ? (
                <img src={currentImage} alt={product.name} className="w-full h-full object-cover" onError={() => setImageError(true)} draggable={false} />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageOff className="h-12 w-12 text-muted-foreground/30" />
                </div>
              )}
              {hasMultipleImages && isHovering && (
                <>
                  <button onClick={goPrev} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 z-10">
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button onClick={goNext} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 z-10">
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
              {hasMultipleImages && (
                <div className="absolute top-2 right-2 bg-black/40 text-white text-xs px-2 py-0.5 rounded-full">
                  {currentImageIndex + 1}/{images.length}
                </div>
              )}
            </div>

            {/* Dots */}
            {hasMultipleImages && (
              <div className="flex justify-center gap-1.5">
                {images.map((_, i) => (
                  <button key={i} onClick={() => { setCurrentImageIndex(i); setImageError(false); }} className={cn("w-2 h-2 rounded-full transition-colors", i === currentImageIndex ? "bg-primary" : "bg-muted-foreground/30")} />
                ))}
              </div>
            )}

            {/* Name */}
            <h2 className="text-base font-semibold text-foreground leading-snug">{product.name}</h2>

            {/* Characteristics */}
            <div className="space-y-1.5 text-xs">
              {product.sku && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Артикул</span>
                  <span className="font-medium">{product.sku}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ед. измерения</span>
                <span className="font-medium">{product.unit || "шт"}</span>
              </div>
              {product.category_name && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Категория</span>
                  <span className="font-medium">{product.category_name}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Наличие</span>
                <span className={cn("font-medium", product.quantity > 0 ? "text-green-600" : "text-muted-foreground")}>
                  {product.quantity > 0 ? "В наличии" : "Нет в наличии"}
                </span>
              </div>
            </div>

            {/* Description */}
            {product.description && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground mb-1">Описание</h4>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{product.description}</p>
              </div>
            )}

            {/* Price */}
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground">{formatPrice(product.price)}</span>
              {product.compare_price && product.compare_price > product.price && (
                <span className="text-sm text-muted-foreground line-through">{formatPrice(product.compare_price)}</span>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Footer: cart */}
        <div className="border-t border-border px-4 py-4 shrink-0">
          {isInCart ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center hover:bg-muted-foreground/20 transition-colors" onClick={() => onUpdateQuantity(product.id, cartQuantity - 1)}>
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-10 text-center text-base font-semibold">{cartQuantity}</span>
                <button className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center hover:bg-muted-foreground/20 transition-colors" onClick={() => onUpdateQuantity(product.id, cartQuantity + 1)}>
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <span className="font-bold text-lg text-foreground">{formatPrice(product.price * cartQuantity)}</span>
            </div>
          ) : (
            <Button className="w-full h-12 text-base font-semibold rounded-xl" size="lg" onClick={() => onAddToCart(product)}>
              <ShoppingBag className="h-5 w-5 mr-2" />
              В корзину
            </Button>
          )}
        </div>

        <FullscreenImageViewer
          images={images}
          currentIndex={currentImageIndex}
          isOpen={fullscreenOpen}
          onClose={() => setFullscreenOpen(false)}
          onIndexChange={(idx) => { setCurrentImageIndex(idx); setImageError(false); }}
        />
      </aside>
    </>
  );
}
