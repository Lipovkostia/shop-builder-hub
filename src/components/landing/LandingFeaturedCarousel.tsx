import { useEffect, useState, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
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

const PAGE_SIZE = 10;

export default function LandingFeaturedCarousel() {
  const [products, setProducts] = useState<FeaturedProduct[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const fetchPage = useCallback(async (pageNum: number) => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/landing-featured?page=${pageNum}&limit=${PAGE_SIZE}`
      );
      const json = await res.json();
      const newProducts: FeaturedProduct[] = json.data || [];
      if (newProducts.length < PAGE_SIZE) setHasMore(false);
      return newProducts;
    } catch {
      setHasMore(false);
      return [];
    }
  }, []);

  useEffect(() => {
    fetchPage(0).then((data) => {
      setProducts(data);
      setPage(0);
    });
  }, [fetchPage]);

  // Infinite scroll via IntersectionObserver on sentinel
  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          setLoadingMore(true);
          const nextPage = page + 1;
          fetchPage(nextPage).then((data) => {
            setProducts((prev) => [...prev, ...data]);
            setPage(nextPage);
            setLoadingMore(false);
          });
        }
      },
      { root: scrollRef.current, threshold: 0.1 }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, page, fetchPage]);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const scrollAmount = isMobile ? 200 : 260;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  if (products.length === 0) return null;

  return (
    <section className="mt-6 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm lg:text-base font-bold text-foreground">
          Новые предложения по выгодной цене
        </h2>
        <div className="hidden lg:flex items-center gap-1.5">
          <Button variant="outline" size="icon" className="h-7 w-7 rounded-full" onClick={() => scroll("left")}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="h-7 w-7 rounded-full" onClick={() => scroll("right")}>
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
            className={`flex-shrink-0 snap-start ${isMobile ? "w-[30%]" : "w-[140px]"}`}
          >
            <div className="rounded-xl border bg-card overflow-hidden flex flex-col h-full">
              <div className="aspect-square w-full overflow-hidden bg-muted">
                {product.images.length > 0 ? (
                  <img
                    src={product.images[0]}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-[10px]">
                    Нет фото
                  </div>
                )}
              </div>
              <div className="p-1.5">
                <p className="text-[11px] font-medium text-foreground line-clamp-2 leading-tight">
                  {product.name}
                </p>
              </div>
            </div>
          </div>
        ))}

        {/* Sentinel for infinite scroll */}
        {hasMore && (
          <div ref={sentinelRef} className="flex-shrink-0 w-10 flex items-center justify-center">
            {loadingMore && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        )}
      </div>
    </section>
  );
}
