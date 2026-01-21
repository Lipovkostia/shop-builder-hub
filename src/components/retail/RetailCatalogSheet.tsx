import { useEffect, useRef } from "react";
import { X, ChevronRight, Package, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { RetailCategory } from "@/hooks/useRetailStore";

interface RetailCatalogSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: RetailCategory[];
  selectedCategory: string | null;
  onCategorySelect: (categoryId: string | null) => void;
  storeName?: string;
}

export function RetailCatalogSheet({
  open,
  onOpenChange,
  categories,
  selectedCategory,
  onCategorySelect,
  storeName,
}: RetailCatalogSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onOpenChange(false);
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onOpenChange]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleCategoryClick = (categoryId: string | null) => {
    onCategorySelect(categoryId);
    onOpenChange(false);
  };

  // Calculate total products
  const totalProducts = categories.reduce((sum, cat) => sum + (cat.product_count || 0), 0);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      {/* Sheet container */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Каталог товаров"
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 lg:hidden",
          "transform transition-transform duration-300 ease-out",
          open ? "translate-y-0" : "translate-y-full"
        )}
      >
        {/* Sheet content */}
        <div className="bg-background rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col overflow-hidden safe-area-bottom">
          {/* Handle bar for visual affordance */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-12 h-1.5 rounded-full bg-muted-foreground/30" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-border/50">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Каталог</h2>
              {storeName && (
                <p className="text-xs text-muted-foreground mt-0.5">{storeName}</p>
              )}
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-muted/80 hover:bg-muted transition-colors"
              aria-label="Закрыть каталог"
            >
              <X className="h-5 w-5 text-foreground" />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {/* All products button */}
            <button
              onClick={() => handleCategoryClick(null)}
              className={cn(
                "w-full flex items-center gap-4 px-5 py-4 transition-all duration-200",
                "hover:bg-primary/5 active:bg-primary/10",
                selectedCategory === null
                  ? "bg-primary/10 border-l-4 border-primary"
                  : "border-l-4 border-transparent"
              )}
            >
              <div className={cn(
                "w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all",
                selectedCategory === null
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                  : "bg-gradient-to-br from-muted to-muted/50"
              )}>
                <Package className="h-6 w-6" />
              </div>
              <div className="flex-1 text-left">
                <p className={cn(
                  "font-semibold text-base",
                  selectedCategory === null ? "text-primary" : "text-foreground"
                )}>
                  Все товары
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {totalProducts} {getProductWord(totalProducts)}
                </p>
              </div>
              <ChevronRight className={cn(
                "h-5 w-5 flex-shrink-0 transition-transform",
                selectedCategory === null ? "text-primary translate-x-1" : "text-muted-foreground"
              )} />
            </button>

            {/* Divider with label */}
            <div className="px-5 py-3 flex items-center gap-3">
              <div className="flex-1 h-px bg-border/50" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Категории
              </span>
              <div className="flex-1 h-px bg-border/50" />
            </div>

            {/* Categories list */}
            <div className="pb-6">
              {categories.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
                    <Sparkles className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground">Категории скоро появятся</p>
                </div>
              ) : (
                categories.map((category, index) => (
                  <button
                    key={category.id}
                    onClick={() => handleCategoryClick(category.id)}
                    className={cn(
                      "w-full flex items-center gap-4 px-5 py-3.5 transition-all duration-200",
                      "hover:bg-primary/5 active:bg-primary/10",
                      selectedCategory === category.id
                        ? "bg-primary/10 border-l-4 border-primary"
                        : "border-l-4 border-transparent"
                    )}
                    style={{
                      animationDelay: `${index * 30}ms`,
                    }}
                  >
                    {/* Category image or placeholder */}
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden transition-all",
                      selectedCategory === category.id
                        ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                        : ""
                    )}>
                      {category.image_url ? (
                        <img
                          src={category.image_url}
                          alt={category.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                          <span className="text-lg font-semibold text-muted-foreground/70">
                            {category.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Category info */}
                    <div className="flex-1 text-left min-w-0">
                      <p className={cn(
                        "font-medium text-[15px] truncate",
                        selectedCategory === category.id ? "text-primary" : "text-foreground"
                      )}>
                        {category.name}
                      </p>
                      {category.product_count !== undefined && category.product_count > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {category.product_count} {getProductWord(category.product_count)}
                        </p>
                      )}
                    </div>

                    {/* Product count badge + arrow */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {category.product_count !== undefined && category.product_count > 0 && (
                        <span className={cn(
                          "text-xs font-medium px-2 py-1 rounded-full",
                          selectedCategory === category.id
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        )}>
                          {category.product_count}
                        </span>
                      )}
                      <ChevronRight className={cn(
                        "h-4 w-4 transition-transform",
                        selectedCategory === category.id ? "text-primary translate-x-1" : "text-muted-foreground"
                      )} />
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Bottom safe area spacer */}
          <div className="h-2" />
        </div>
      </div>
    </>
  );
}

// Helper function for Russian word forms
function getProductWord(count: number): string {
  const lastTwo = count % 100;
  const lastOne = count % 10;
  
  if (lastTwo >= 11 && lastTwo <= 19) {
    return "товаров";
  }
  
  if (lastOne === 1) {
    return "товар";
  }
  
  if (lastOne >= 2 && lastOne <= 4) {
    return "товара";
  }
  
  return "товаров";
}
