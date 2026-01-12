import React, { useState, useCallback, useEffect, useRef } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface FullscreenImageViewerProps {
  images: string[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onIndexChange?: (index: number) => void;
}

export const FullscreenImageViewer: React.FC<FullscreenImageViewerProps> = ({
  images,
  currentIndex,
  isOpen,
  onClose,
  onIndexChange,
}) => {
  const [index, setIndex] = useState(currentIndex);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [touchCurrentY, setTouchCurrentY] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const minSwipeDistance = 50;
  const closeThreshold = 100;

  // Sync index with prop
  useEffect(() => {
    setIndex(currentIndex);
  }, [currentIndex]);

  // Reset drag state when closed
  useEffect(() => {
    if (!isOpen) {
      setTouchStartY(null);
      setTouchCurrentY(null);
      setIsDragging(false);
    }
  }, [isOpen]);

  // Prevent body scroll when viewer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const goNext = useCallback(() => {
    if (index < images.length - 1) {
      const newIndex = index + 1;
      setIndex(newIndex);
      onIndexChange?.(newIndex);
    }
  }, [index, images.length, onIndexChange]);

  const goPrev = useCallback(() => {
    if (index > 0) {
      const newIndex = index - 1;
      setIndex(newIndex);
      onIndexChange?.(newIndex);
    }
  }, [index, onIndexChange]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, goNext, goPrev, onClose]);

  // Touch handlers
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.targetTouches[0].clientX);
    setTouchStartY(e.targetTouches[0].clientY);
    setTouchCurrentY(e.targetTouches[0].clientY);
    setIsDragging(true);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    setTouchCurrentY(e.targetTouches[0].clientY);
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartX || !touchStartY || !touchCurrentY) {
      setIsDragging(false);
      return;
    }

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    
    const deltaX = touchStartX - touchEndX;
    const deltaY = touchEndY - touchStartY;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    // Prioritize vertical swipe for close (swipe down)
    if (deltaY > closeThreshold && absDeltaY > absDeltaX * 1.5) {
      onClose();
    } 
    // Horizontal swipe for navigation
    else if (absDeltaX > minSwipeDistance && absDeltaX > absDeltaY) {
      if (deltaX > 0) {
        goNext();
      } else {
        goPrev();
      }
    }

    setTouchStartX(null);
    setTouchStartY(null);
    setTouchCurrentY(null);
    setIsDragging(false);
  };

  // Handle click on edges for navigation
  const handleClick = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const edgeZone = width * 0.2; // 20% on each edge

    if (clickX < edgeZone && index > 0) {
      goPrev();
    } else if (clickX > width - edgeZone && index < images.length - 1) {
      goNext();
    }
  };

  // Calculate drag offset for visual feedback
  const dragOffset = isDragging && touchStartY && touchCurrentY 
    ? Math.max(0, touchCurrentY - touchStartY)
    : 0;
  
  const opacity = isDragging && dragOffset > 0 
    ? Math.max(0.3, 1 - dragOffset / 300)
    : 1;

  if (!isOpen || images.length === 0) return null;

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-[200] bg-black flex items-center justify-center"
      style={{ backgroundColor: `rgba(0, 0, 0, ${opacity})` }}
      onClick={handleClick}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Swipe down indicator */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-1 pointer-events-none">
        <div className="w-10 h-1 bg-white/40 rounded-full" />
        <span className="text-white/40 text-xs mt-1">Смахните вниз для закрытия</span>
      </div>

      {/* Close button - positioned in safe area */}
      <button 
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute z-50 p-3 text-white/80 hover:text-white bg-black/30 rounded-full transition-colors"
        style={{ 
          top: 'max(1rem, env(safe-area-inset-top, 1rem))', 
          right: 'max(1rem, env(safe-area-inset-right, 1rem))' 
        }}
      >
        <X className="w-6 h-6" />
      </button>

      {/* Image counter */}
      {images.length > 1 && (
        <div 
          className="absolute z-50 text-white/80 text-sm bg-black/40 px-3 py-1 rounded-full"
          style={{ 
            top: 'max(1rem, env(safe-area-inset-top, 1rem))', 
            left: 'max(1rem, env(safe-area-inset-left, 1rem))' 
          }}
        >
          {index + 1} / {images.length}
        </div>
      )}

      {/* Previous button */}
      {images.length > 1 && index > 0 && (
        <button 
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          className="absolute left-2 top-1/2 -translate-y-1/2 p-2 text-white/70 hover:text-white bg-black/30 rounded-full transition-colors z-50 hidden md:flex"
        >
          <ChevronLeft className="w-8 h-8" />
        </button>
      )}

      {/* Current image with drag animation */}
      <div 
        className="max-w-full max-h-full flex items-center justify-center transition-transform duration-75"
        style={{ 
          transform: `translateY(${dragOffset}px)`,
          opacity: opacity
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={images[index]}
          alt={`Image ${index + 1}`}
          className="max-w-full max-h-[85vh] object-contain select-none"
          draggable={false}
        />
      </div>

      {/* Next button */}
      {images.length > 1 && index < images.length - 1 && (
        <button 
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-white/70 hover:text-white bg-black/30 rounded-full transition-colors z-50 hidden md:flex"
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      )}

      {/* Thumbnail strip (optional - for multiple images) */}
      {images.length > 1 && (
        <div 
          className="absolute z-50 flex gap-2 overflow-x-auto max-w-[90vw] p-2 bg-black/50 rounded-lg"
          style={{ 
            bottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))',
            left: '50%',
            transform: 'translateX(-50%)'
          }}
        >
          {images.map((img, idx) => (
            <button
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                setIndex(idx);
                onIndexChange?.(idx);
              }}
              className={cn(
                "flex-shrink-0 w-12 h-12 rounded overflow-hidden border-2 transition-all",
                idx === index 
                  ? "border-white scale-110" 
                  : "border-transparent opacity-60 hover:opacity-100"
              )}
            >
              <img
                src={img}
                alt=""
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {/* Edge tap zones indicators (visible on touch) */}
      {images.length > 1 && (
        <>
          {index > 0 && (
            <div className="absolute left-0 top-0 bottom-0 w-[20%] flex items-center justify-start pl-4 pointer-events-none">
              <ChevronLeft className="w-8 h-8 text-white/20 md:hidden" />
            </div>
          )}
          {index < images.length - 1 && (
            <div className="absolute right-0 top-0 bottom-0 w-[20%] flex items-center justify-end pr-4 pointer-events-none">
              <ChevronRight className="w-8 h-8 text-white/20 md:hidden" />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default FullscreenImageViewer;
