import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { RetailProduct, RetailCategory } from "@/hooks/useRetailStore";

interface CategoryProductsSectionProps {
  category: RetailCategory;
  products: RetailProduct[];
  renderProductCard: (product: RetailProduct, index: number, isCarousel: boolean) => React.ReactNode;
}

export function CategoryProductsSection({
  category,
  products,
  renderProductCard,
}: CategoryProductsSectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const scrollAmount = 300;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  if (products.length === 0) return null;

  return (
    <section className="mb-8">
      {/* Category header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg lg:text-xl font-semibold tracking-normal text-foreground font-sans">
          {category.name}
        </h2>
        
        {/* Scroll controls - desktop only */}
        <div className="hidden lg:flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={() => scroll("left")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={() => scroll("right")}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Horizontal scrollable product row */}
      <div className="relative -mx-4 lg:-mx-6">
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide px-4 lg:px-6 pt-4 pb-2 -mt-4 snap-x snap-mandatory"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {products.map((product, index) => (
            <div
              key={product.id}
              className="flex-shrink-0 w-[45%] sm:w-[35%] md:w-[28%] lg:w-[22%] xl:w-[18%] snap-start"
            >
              {renderProductCard(product, index, true)}
            </div>
          ))}
        </div>
      </div>

      {/* Separator */}
      <div className="mt-6 h-px bg-border" />
    </section>
  );
}
