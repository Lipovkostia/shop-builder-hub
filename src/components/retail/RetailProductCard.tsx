import { useState, useCallback, useRef, useEffect } from "react";
import { Heart, ImageOff, Plus, Minus, ChevronRight, ChevronLeft } from "lucide-react";
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
  index?: number; // To determine left/right position
  isCarousel?: boolean; // Whether card is in a horizontal carousel
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
  index = 0,
  isCarousel = false,
}: RetailProductCardProps) {
  const isMobile = useIsMobile();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [expandedImageIndex, setExpandedImageIndex] = useState(0);
  const [imageError, setImageError] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isImageExpanded, setIsImageExpanded] = useState(false);
  const [cardHeight, setCardHeight] = useState<number>(0);
  const [isOnRightHalf, setIsOnRightHalf] = useState(false);
  
  // Touch/swipe handling for mobile
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  
  // Touch/swipe for expanded image viewer with drag effect
  const expandedTouchStartX = useRef<number>(0);
  const expandedTouchCurrentX = useRef<number>(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Pinch-to-zoom state
  const [zoomScale, setZoomScale] = useState(1);
  const [zoomPosition, setZoomPosition] = useState({ x: 0, y: 0 });
  const [isPinching, setIsPinching] = useState(false);
  const initialPinchDistance = useRef<number>(0);
  const initialScale = useRef<number>(1);
  const lastPanPosition = useRef({ x: 0, y: 0 });
  const imageContainerWidth = useRef<number>(0);
  
  // Image container ref for cursor tracking on desktop
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const innerCardRef = useRef<HTMLDivElement>(null);
  const expandedImageRef = useRef<HTMLDivElement>(null);

  // Determine card position on screen for carousel mode
  const checkCardPosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const cardCenterX = rect.left + rect.width / 2;
    const screenCenterX = window.innerWidth / 2;
    setIsOnRightHalf(cardCenterX > screenCenterX);
  }, []);

  // For carousel mode: calculate position dynamically
  // For grid mode: use index % 2 logic
  const isRightSide = isCarousel ? isOnRightHalf : (index % 2 === 1);

  // Check position when expanding in carousel mode
  useEffect(() => {
    if (isCarousel && (isExpanded || isImageExpanded)) {
      checkCardPosition();
    }
  }, [isCarousel, isExpanded, isImageExpanded, checkCardPosition]);

  // Measure card height for description panel
  useEffect(() => {
    if (innerCardRef.current) {
      setCardHeight(innerCardRef.current.offsetHeight);
    }
  }, []);

  const images = product.images || [];
  const hasMultipleImages = images.length > 1;
  const currentImage = images[currentImageIndex];
  
  const hasDiscount = product.compare_price && product.compare_price > product.price;
  const isOutOfStock = product.catalog_status === 'out_of_stock';
  const isInCart = cartQuantity > 0;
  const cartItemTotal = cartQuantity * product.price;
  const hasDescription = product.description && product.description.trim().length > 0;

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

  const handleNameClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (hasDescription) {
      // Check position before expanding in carousel mode
      if (isCarousel) {
        checkCardPosition();
      }
      setIsExpanded(prev => !prev);
    }
  }, [hasDescription, isCarousel, checkCardPosition]);

  const handleImageClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (images.length > 0 && !isOutOfStock) {
      // Check position before expanding in carousel mode
      if (isCarousel) {
        checkCardPosition();
      }
      // Always start from the first (main) image to avoid jerking
      setExpandedImageIndex(0);
      setDragOffset(0);
      setZoomScale(1);
      setZoomPosition({ x: 0, y: 0 });
      setIsImageExpanded(true);
    }
  }, [images.length, isOutOfStock, isCarousel, checkCardPosition]);

  // Handle tap on expanded image to close
  const handleExpandedImageTap = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only close if not dragging and not zoomed/pinching
    if (!isDragging && !isPinching && zoomScale <= 1) {
      setIsImageExpanded(false);
    } else if (zoomScale > 1) {
      // Reset zoom on tap when zoomed
      setZoomScale(1);
      setZoomPosition({ x: 0, y: 0 });
    }
  }, [isDragging, isPinching, zoomScale]);

  // Close description when clicking outside
  useEffect(() => {
    if (!isExpanded) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsExpanded(false);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isExpanded]);

  // Close expanded image when clicking outside and reset zoom
  useEffect(() => {
    if (!isImageExpanded) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      if (expandedImageRef.current && !expandedImageRef.current.contains(e.target as Node)) {
        setIsImageExpanded(false);
        // Reset zoom when closing
        setZoomScale(1);
        setZoomPosition({ x: 0, y: 0 });
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isImageExpanded]);

  // Reset zoom when changing image
  useEffect(() => {
    setZoomScale(1);
    setZoomPosition({ x: 0, y: 0 });
  }, [expandedImageIndex]);

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

  // Calculate distance between two touch points
  const getDistance = (touches: React.TouchList): number => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Get center point between two touches
  const getCenter = (touches: React.TouchList): { x: number; y: number } => {
    if (touches.length < 2) return { x: touches[0].clientX, y: touches[0].clientY };
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2
    };
  };

  // Expanded image touch handlers with drag effect and pinch-to-zoom
  const handleExpandedTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch start
      e.preventDefault();
      setIsPinching(true);
      initialPinchDistance.current = getDistance(e.touches);
      initialScale.current = zoomScale;
      const center = getCenter(e.touches);
      lastPanPosition.current = { x: center.x, y: center.y };
    } else if (e.touches.length === 1) {
      // Single touch - swipe or pan
      if (zoomScale > 1) {
        // Pan when zoomed
        lastPanPosition.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else {
        // Swipe for image navigation
        expandedTouchStartX.current = e.touches[0].clientX;
        expandedTouchCurrentX.current = e.touches[0].clientX;
      }
      setIsDragging(false);
    }
  }, [zoomScale]);

  const handleExpandedTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch zoom
      e.preventDefault();
      const newDistance = getDistance(e.touches);
      const scaleFactor = newDistance / initialPinchDistance.current;
      const newScale = Math.min(Math.max(initialScale.current * scaleFactor, 1), 4);
      setZoomScale(newScale);
      
      // Pan while pinching
      const center = getCenter(e.touches);
      if (newScale > 1) {
        const deltaX = center.x - lastPanPosition.current.x;
        const deltaY = center.y - lastPanPosition.current.y;
        setZoomPosition(prev => ({
          x: prev.x + deltaX,
          y: prev.y + deltaY
        }));
        lastPanPosition.current = { x: center.x, y: center.y };
      }
    } else if (e.touches.length === 1) {
      if (zoomScale > 1) {
        // Pan when zoomed
        e.preventDefault();
        const deltaX = e.touches[0].clientX - lastPanPosition.current.x;
        const deltaY = e.touches[0].clientY - lastPanPosition.current.y;
        setZoomPosition(prev => ({
          x: prev.x + deltaX,
          y: prev.y + deltaY
        }));
        lastPanPosition.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        setIsDragging(true);
      } else if (hasMultipleImages) {
        // Swipe for navigation
        const currentX = e.touches[0].clientX;
        expandedTouchCurrentX.current = currentX;
        const diff = currentX - expandedTouchStartX.current;
        setDragOffset(diff);
        if (Math.abs(diff) > 10) {
          setIsDragging(true);
        }
      }
    }
  }, [hasMultipleImages, zoomScale]);

  const handleExpandedTouchEnd = useCallback(() => {
    if (isPinching) {
      setIsPinching(false);
      // Reset if zoom is too small
      if (zoomScale < 1.1) {
        setZoomScale(1);
        setZoomPosition({ x: 0, y: 0 });
      }
      return;
    }
    
    // Handle swipe for image navigation (only when not zoomed)
    if (zoomScale <= 1 && hasMultipleImages) {
      const threshold = 60;
      const containerWidth = imageContainerWidth.current || 300;
      
      if (Math.abs(dragOffset) > threshold) {
        // Determine direction
        const goNext = dragOffset < 0;
        const goPrev = dragOffset > 0;
        
        // Calculate new index
        let newIndex = expandedImageIndex;
        if (goNext && expandedImageIndex < images.length - 1) {
          newIndex = expandedImageIndex + 1;
        } else if (goNext && expandedImageIndex === images.length - 1) {
          newIndex = 0; // Loop to first
        } else if (goPrev && expandedImageIndex > 0) {
          newIndex = expandedImageIndex - 1;
        } else if (goPrev && expandedImageIndex === 0) {
          newIndex = images.length - 1; // Loop to last
        }
        
        // Enable animation, then change index
        setIsAnimating(true);
        setExpandedImageIndex(newIndex);
        
        // Reset drag offset after transition completes
        setTimeout(() => {
          setDragOffset(0);
          setIsAnimating(false);
        }, 300);
      } else {
        // Snap back - not enough swipe
        setIsAnimating(true);
        setDragOffset(0);
        setTimeout(() => setIsAnimating(false), 300);
      }
    } else {
      setDragOffset(0);
    }
    
    // Reset dragging state after a small delay to allow tap detection
    setTimeout(() => setIsDragging(false), 50);
    expandedTouchStartX.current = 0;
    expandedTouchCurrentX.current = 0;
  }, [hasMultipleImages, images.length, dragOffset, isPinching, zoomScale, expandedImageIndex]);

  const handleExpandedPrev = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  }, [images.length]);

  const handleExpandedNext = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  }, [images.length]);

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
    <div className="relative w-full" ref={containerRef}>
      {/* Description panel - positioned as overlay, full width of neighbor card */}
      <div 
        className={cn(
          "absolute top-0 z-30 transition-all duration-300 ease-out overflow-hidden",
          isExpanded ? "opacity-100" : "opacity-0 pointer-events-none",
          isRightSide ? "right-full" : "left-full"
        )}
        style={{ 
          width: isExpanded ? 'calc(100% + 16px)' : 0, // 100% + gap-4 (16px)
          height: cardHeight > 0 ? cardHeight : 'auto'
        }}
      >
        <div 
          className={cn(
            "h-full bg-muted/95 backdrop-blur-sm shadow-lg flex flex-col overflow-hidden",
            isRightSide ? "rounded-l-xl" : "rounded-r-xl"
          )}
          style={{ height: cardHeight > 0 ? cardHeight : 'auto' }}
        >
          {/* Scrollable description content - no header, just content */}
          <div className="flex-1 overflow-y-auto scrollbar-thin p-3 min-h-0">
            <h4 className="font-medium text-sm leading-snug text-foreground mb-2">
              {product.name}
            </h4>
            <p className="text-xs leading-relaxed text-foreground/80">
              {product.description}
            </p>
          </div>
        </div>
      </div>

      {/* Expanded image viewer - positioned as overlay covering 2 cards */}
      <div 
        ref={expandedImageRef}
        className={cn(
          "absolute top-0 z-40 transition-all duration-300 ease-out overflow-hidden",
          isImageExpanded ? "opacity-100" : "opacity-0 pointer-events-none",
          isRightSide ? "right-0" : "left-0"
        )}
        style={{ 
          width: isImageExpanded ? 'calc(200% + 16px)' : '100%',
          height: cardHeight > 0 ? cardHeight : 'auto'
        }}
      >
        <div 
          className="h-full bg-muted rounded-xl shadow-lg overflow-hidden relative touch-none"
          style={{ height: cardHeight > 0 ? cardHeight : 'auto' }}
          onTouchStart={handleExpandedTouchStart}
          onTouchMove={handleExpandedTouchMove}
          onTouchEnd={handleExpandedTouchEnd}
          onClick={handleExpandedImageTap}
        >
          {/* Images container with drag effect and zoom */}
          <div 
            className="flex h-full"
            style={{ 
              width: `${images.length * 100}%`,
              transform: `translateX(calc(-${expandedImageIndex * (100 / images.length)}% + ${zoomScale <= 1 ? dragOffset : 0}px))`,
              transition: (isDragging && !isAnimating) || isPinching ? 'none' : 'transform 0.3s ease-out'
            }}
          >
            {images.map((img, idx) => (
              <div 
                key={idx} 
                className="h-full flex-shrink-0 overflow-hidden"
                style={{ width: `${100 / images.length}%` }}
              >
                <img
                  src={img}
                  alt={`${product.name} - ${idx + 1}`}
                  className="w-full h-full object-cover origin-center"
                  style={{
                    transform: idx === expandedImageIndex 
                      ? `scale(${zoomScale}) translate(${zoomPosition.x / zoomScale}px, ${zoomPosition.y / zoomScale}px)`
                      : 'scale(1)',
                    transition: isPinching || isDragging ? 'none' : 'transform 0.2s ease-out'
                  }}
                  draggable={false}
                />
              </div>
            ))}
          </div>
          
          {/* Navigation arrows for desktop */}
          {hasMultipleImages && !isMobile && (
            <>
              <button
                onClick={handleExpandedPrev}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center shadow-md hover:bg-background transition-colors"
              >
                <ChevronLeft className="h-5 w-5 text-foreground" />
              </button>
              <button
                onClick={handleExpandedNext}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center shadow-md hover:bg-background transition-colors"
              >
                <ChevronRight className="h-5 w-5 text-foreground" />
              </button>
            </>
          )}
          
          {/* Image indicators */}
          {hasMultipleImages && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {images.map((_, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all",
                    idx === expandedImageIndex 
                      ? "bg-foreground" 
                      : "bg-foreground/30"
                  )}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main card */}
      <div 
        ref={innerCardRef}
        className="bg-card rounded-xl overflow-visible flex flex-col shadow-sm hover:shadow-md transition-shadow relative"
      >
        {/* Favorite button - positioned above card */}
        <button
          onClick={handleFavorite}
          className={cn(
            "absolute -top-2 -right-2 p-1 transition-all z-20 bg-transparent border-none outline-none",
            isFavorite 
              ? "drop-shadow-[0_3px_6px_rgba(139,0,0,0.5)] animate-heartbeat" 
              : "drop-shadow-[0_1px_2px_rgba(0,0,0,0.2)]"
          )}
          style={{ background: 'transparent' }}
        >
          {isFavorite ? (
            <svg width="28" height="28" viewBox="0 0 24 24" className="h-7 w-7 block">
              <defs>
                <linearGradient id={`heartGradient-${product.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#8B0000" />
                  <stop offset="50%" stopColor="#A52A2A" />
                  <stop offset="100%" stopColor="#6B0000" />
                </linearGradient>
              </defs>
              <path 
                d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
                fill={`url(#heartGradient-${product.id})`}
                stroke="none"
              />
            </svg>
          ) : (
            <Heart className="h-7 w-7 fill-transparent stroke-foreground/40 stroke-[1.5] block" />
          )}
        </button>

        {/* Image section - clickable to expand */}
        <div 
          ref={imageContainerRef}
          className="relative aspect-square bg-muted overflow-hidden rounded-t-xl cursor-pointer"
          onClick={handleImageClick}
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

        {/* Product name - clickable to expand description */}
        <div className="px-2 pt-2 pb-1">
          <div 
            onClick={handleNameClick}
            className={cn(
              "flex items-start gap-1 min-h-[2.5rem]",
              hasDescription && "cursor-pointer group"
            )}
          >
            <h3 className={cn(
              "font-medium text-sm leading-snug text-foreground line-clamp-2 flex-1",
              hasDescription && "group-hover:text-primary transition-colors"
            )}>
              {product.name}
            </h3>
            {hasDescription && (
              <ChevronRight className={cn(
                "h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5 transition-transform duration-300",
                isExpanded && "rotate-180"
              )} />
            )}
          </div>
        </div>

        {/* Buy button - compact fixed height */}
        <div className="mt-auto">
          <div className="flex h-10 overflow-hidden rounded-b-xl">
            {/* Minus button - only visible when in cart */}
            <button
              onClick={handleDecrement}
              className={cn(
                "flex items-center justify-center transition-all text-foreground overflow-hidden",
                isInCart 
                  ? "w-8 bg-muted hover:bg-muted/80" 
                  : "w-0"
              )}
              style={{ transition: 'width 0.2s ease-out' }}
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            
            {/* Main button area with two rows */}
            <button
              onClick={handleAddToCart}
              disabled={isOutOfStock}
              className={cn(
                "flex-1 h-full flex flex-col items-center justify-center py-0.5 transition-all",
                "bg-primary text-primary-foreground",
                isOutOfStock && "opacity-50 cursor-not-allowed",
                !isInCart && "hover:opacity-90"
              )}
            >
              {/* Top row: cart info (quantity × total) - only when in cart */}
              <div className={cn(
                "text-[9px] leading-none transition-opacity tabular-nums",
                isInCart ? "opacity-70" : "opacity-0 h-0"
              )}>
                {cartQuantity} × {formatPrice(cartItemTotal)}
              </div>
              
              {/* Bottom row: price per unit */}
              <div className="flex items-center gap-0.5">
                <span className="font-semibold text-xs leading-tight">{formatPrice(product.price)}</span>
                {product.unit && (
                  <span className="text-[9px] opacity-70 leading-tight">/ {formatUnit(product.unit)}</span>
                )}
              </div>
            </button>
            
            {/* Plus button - only visible when in cart */}
            <button
              onClick={handleIncrement}
              disabled={isOutOfStock}
              className={cn(
                "flex items-center justify-center transition-all text-primary-foreground overflow-hidden",
                isInCart 
                  ? "w-8 bg-primary/80 hover:bg-primary/70" 
                  : "w-0"
              )}
              style={{ transition: 'width 0.2s ease-out' }}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
