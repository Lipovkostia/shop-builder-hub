import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import type { RetailCategory } from "@/hooks/useRetailStore";

interface CategoryHeaderProps {
  category: RetailCategory | null;
  productCount: number;
}

export function CategoryHeader({ category, productCount }: CategoryHeaderProps) {
  const { subdomain } = useParams();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const bannerImages = category?.banner_images?.filter(Boolean) || [];
  const bannerEnabled = category?.banner_enabled && bannerImages.length > 0;
  const interval = (category?.banner_interval || 5) * 1000;
  const effect = category?.banner_effect || "fade";

  // Auto-rotate slides
  useEffect(() => {
    if (!bannerEnabled || bannerImages.length <= 1) return;

    const timer = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentSlide((prev) => (prev + 1) % bannerImages.length);
        setTimeout(() => setIsTransitioning(false), 50);
      }, 300);
    }, interval);

    return () => clearInterval(timer);
  }, [bannerEnabled, bannerImages.length, interval]);

  // Reset slide on category change
  useEffect(() => {
    setCurrentSlide(0);
    setIsTransitioning(false);
  }, [category?.id]);

  if (!bannerEnabled) {
    return (
      <div className="mb-1.5 bg-card rounded-2xl p-5">
        <h1 className="text-2xl lg:text-3xl font-semibold tracking-normal text-foreground font-sans">
          {category?.name || "Все товары"}
        </h1>
      </div>
    );
  }

  const transitionClass = getTransitionClass(effect, isTransitioning);

  return (
    <div className="mb-1.5 bg-card rounded-2xl overflow-hidden">
      {/* Banner carousel - recommended: 1200×300 for desktop, 16:4 aspect */}
      <div className="relative w-full" style={{ aspectRatio: "4 / 1", maxHeight: "300px" }}>
        {bannerImages.map((img, idx) => (
          <img
            key={img}
            src={img}
            alt={`${category?.name || ""} баннер ${idx + 1}`}
            className={`absolute inset-0 w-full h-full object-cover transition-all duration-500 ease-in-out ${
              idx === currentSlide ? transitionClass.active : transitionClass.inactive
            }`}
          />
        ))}

        {/* Dots indicator */}
        {bannerImages.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {bannerImages.map((_, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setIsTransitioning(true);
                  setTimeout(() => {
                    setCurrentSlide(idx);
                    setTimeout(() => setIsTransitioning(false), 50);
                  }, 200);
                }}
                className={`w-2 h-2 rounded-full transition-all ${
                  idx === currentSlide
                    ? "bg-white shadow-md scale-110"
                    : "bg-white/50 hover:bg-white/70"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function getTransitionClass(effect: string, isTransitioning: boolean) {
  switch (effect) {
    case "slide":
      return {
        active: isTransitioning
          ? "opacity-0 translate-x-full"
          : "opacity-100 translate-x-0",
        inactive: "opacity-0 -translate-x-full",
      };
    case "zoom":
      return {
        active: isTransitioning
          ? "opacity-0 scale-110"
          : "opacity-100 scale-100",
        inactive: "opacity-0 scale-95",
      };
    case "fade":
    default:
      return {
        active: isTransitioning ? "opacity-0" : "opacity-100",
        inactive: "opacity-0",
      };
  }
}

function getProductWord(count: number): string {
  const lastTwo = count % 100;
  const lastOne = count % 10;
  
  if (lastTwo >= 11 && lastTwo <= 14) return "товаров";
  if (lastOne === 1) return "товар";
  if (lastOne >= 2 && lastOne <= 4) return "товара";
  return "товаров";
}
