import { useEffect, useState, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

interface FeaturedProduct {
  id: string;
  name: string;
  price: number;
  images: string[];
  description: string | null;
  slug: string;
}

export default function LandingFeaturedCarousel() {
  const [products, setProducts] = useState<FeaturedProduct[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/landing-featured`
        );
        const json = await res.json();
        if (json.data) setProducts(json.data);
      } catch {
        // silently fail
      }
    };

    fetchFeatured();
  }, []);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const scrollAmount = isMobile ? 260 : 340;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  if (products.length === 0) return null;

  const formatPrice = (price: number) => {
    if (!price || price === 0) return "По запросу";
    return `${price.toLocaleString("ru-RU")} ₽`;
  };

  return (
    <section className="mt-6 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm lg:text-base font-bold text-foreground">
          Новые предложения по выгодной цене
        </h2>
        <div className="hidden lg:flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 rounded-full"
            onClick={() => scroll("left")}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 rounded-full"
            onClick={() => scroll("right")}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {products.map((product) => (
          <div
            key={product.id}
            className={`flex-shrink-0 snap-start ${
              isMobile ? "w-[42%]" : "w-[220px]"
            }`}
          >
            {/* Card */}
            <div className="rounded-xl border bg-card overflow-hidden flex flex-col h-full">
              {/* Square image */}
              <div className="aspect-square w-full overflow-hidden bg-muted">
                {product.images.length > 0 ? (
                  <img
                    src={product.images[0]}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                    Нет фото
                  </div>
                )}
              </div>

              <div className="p-2.5 flex flex-col flex-1 gap-1.5">
                {/* Name + description (desktop) */}
                {isMobile ? (
                  <>
                    <p className="text-xs font-semibold text-foreground line-clamp-2 leading-tight">
                      {product.name}
                    </p>
                    <div className="mt-auto pt-1.5 flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-primary whitespace-nowrap">
                        {formatPrice(product.price)}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-[10px] px-2 shrink-0"
                        onClick={() => {
                          // Could navigate to product page
                        }}
                      >
                        Смотреть
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex gap-2 items-start">
                      <p className="text-xs font-semibold text-foreground line-clamp-2 leading-tight flex-1">
                        {product.name}
                      </p>
                      {product.description && (
                        <p className="text-[10px] text-muted-foreground line-clamp-2 leading-tight flex-1 min-w-0">
                          {product.description}
                        </p>
                      )}
                    </div>
                    <div className="mt-auto pt-2 flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-primary whitespace-nowrap">
                        {formatPrice(product.price)}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] px-3 shrink-0"
                        onClick={() => {
                          // Could navigate to product page
                        }}
                      >
                        Посмотреть товар
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
