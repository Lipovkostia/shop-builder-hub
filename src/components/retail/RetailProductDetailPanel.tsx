import { X, Plus, Minus, ShoppingBag, ImageOff, ChevronLeft, ChevronRight, Star, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { RetailProduct } from "@/hooks/useRetailStore";
import type { ProductReview } from "@/hooks/useProductReviews";
import { useState, useEffect } from "react";
import { FullscreenImageViewer } from "@/components/ui/fullscreen-image-viewer";

interface RetailProductDetailPanelProps {
  product: RetailProduct | null;
  onClose: () => void;
  onAddToCart: (product: RetailProduct) => void;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  cartQuantity: number;
  productReviews?: ProductReview[];
  reviewStats?: { averageRating: number; totalCount: number };
  onSubmitReview?: (productId: string, name: string, rating: number, comment: string) => void;
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
  productReviews = [],
  reviewStats,
  onSubmitReview,
}: RetailProductDetailPanelProps) {
  const [imageError, setImageError] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewName, setReviewName] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [showReviews, setShowReviews] = useState(false);

  useEffect(() => {
    setCurrentImageIndex(0);
    setImageError(false);
    setShowReviewForm(false);
    setShowReviews(false);
  }, [product?.id]);

  const images = product?.images || [];
  const currentImage = images[currentImageIndex] || null;
  const hasDiscount = product?.compare_price && product.compare_price > (product?.price ?? 0);
  const isInCart = cartQuantity > 0;
  const hasMultipleImages = images.length > 1;

  if (!product) return null;

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

  const handleSubmitReview = () => {
    if (!reviewName.trim() || !onSubmitReview) return;
    onSubmitReview(product.id, reviewName.trim(), reviewRating, reviewComment.trim());
    setReviewName("");
    setReviewComment("");
    setReviewRating(5);
    setShowReviewForm(false);
  };

  return (
    <aside className={cn("absolute inset-0 z-10 bg-background flex flex-col", "animate-slide-in-right")}>
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
          {/* Image with navigation */}
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
                <button onClick={goPrev} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition-colors z-10">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button onClick={goNext} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition-colors z-10">
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

          {/* Image dots */}
          {hasMultipleImages && (
            <div className="flex justify-center gap-1.5">
              {images.map((_, i) => (
                <button key={i} onClick={() => { setCurrentImageIndex(i); setImageError(false); }} className={cn("w-2 h-2 rounded-full transition-colors", i === currentImageIndex ? "bg-primary" : "bg-muted-foreground/30")} />
              ))}
            </div>
          )}

          {/* Name */}
          <h2 className="text-base font-semibold text-foreground leading-snug">{product.name}</h2>

          {/* Unit */}
          {product.unit && <p className="text-xs text-muted-foreground">{product.unit}</p>}

          {/* Description */}
          {product.description && (
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{product.description}</p>
          )}

          {/* Price */}
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">{formatPrice(product.price)}</span>
            {hasDiscount && (
              <span className="text-sm text-muted-foreground line-through">{formatPrice(product.compare_price!)}</span>
            )}
          </div>

          {/* Review stats + toggle */}
          <div className="flex items-center gap-3">
            {reviewStats && reviewStats.totalCount > 0 && (
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                <span className="text-sm font-medium">{reviewStats.averageRating}</span>
              </div>
            )}
            <button
              onClick={() => setShowReviews(!showReviews)}
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <MessageSquare className="h-4 w-4" />
              <span>Отзывы ({reviewStats?.totalCount || 0})</span>
            </button>
          </div>

          {/* Reviews section */}
          {showReviews && (
            <div className="space-y-3 border-t border-border pt-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Отзывы</h4>
                <Button size="sm" variant="outline" onClick={() => setShowReviewForm(!showReviewForm)}>
                  {showReviewForm ? "Отмена" : "Написать отзыв"}
                </Button>
              </div>

              {/* Review form */}
              {showReviewForm && (
                <div className="space-y-3 bg-muted/50 rounded-lg p-3">
                  <Input
                    placeholder="Ваше имя"
                    value={reviewName}
                    onChange={e => setReviewName(e.target.value)}
                    className="h-9"
                  />
                  {/* Star rating */}
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground mr-1">Оценка:</span>
                    {[1, 2, 3, 4, 5].map(s => (
                      <button key={s} onClick={() => setReviewRating(s)} className="p-0.5">
                        <Star className={cn("h-5 w-5", s <= reviewRating ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30")} />
                      </button>
                    ))}
                  </div>
                  <Textarea
                    placeholder="Ваш отзыв..."
                    value={reviewComment}
                    onChange={e => setReviewComment(e.target.value)}
                    className="min-h-[60px]"
                  />
                  <Button size="sm" onClick={handleSubmitReview} disabled={!reviewName.trim()}>
                    Отправить
                  </Button>
                </div>
              )}

              {/* Existing reviews */}
              {productReviews.length === 0 ? (
                <p className="text-xs text-muted-foreground">Пока нет отзывов</p>
              ) : (
                productReviews.map(review => (
                  <div key={review.id} className="border border-border rounded-lg p-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{review.reviewer_name}</span>
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map(s => (
                          <Star key={s} className={cn("h-3 w-3", s <= review.rating ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30")} />
                        ))}
                      </div>
                    </div>
                    {review.comment && <p className="text-xs text-muted-foreground">{review.comment}</p>}
                    <p className="text-[10px] text-muted-foreground/60">
                      {new Date(review.created_at).toLocaleDateString("ru-RU")}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer: add to cart */}
      <div className="border-t border-border px-4 py-4">
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
            Добавить в корзину
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
  );
}
