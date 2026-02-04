import { useEffect, useRef, useState, useMemo } from "react";
import { X, ChevronRight, ChevronDown, Package, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { RetailCategory } from "@/hooks/useRetailStore";
import { buildCategoryTree, filterTreeWithProducts, getParentChain, CategoryTree } from "@/lib/categoryUtils";

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
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

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

  // Build category tree
  const categoryTree = useMemo(() => {
    const tree = buildCategoryTree(categories);
    return filterTreeWithProducts(tree);
  }, [categories]);

  // Auto-expand parent categories when a child is selected
  useEffect(() => {
    if (selectedCategory) {
      const parentChain = getParentChain(selectedCategory, categories);
      if (parentChain.length > 0) {
        setExpandedCategories(prev => {
          const newExpanded = [...prev];
          parentChain.forEach(parentId => {
            if (!newExpanded.includes(parentId)) {
              newExpanded.push(parentId);
            }
          });
          return newExpanded;
        });
      }
    }
  }, [selectedCategory, categories]);

  const handleCategoryClick = (categoryId: string | null) => {
    onCategorySelect(categoryId);
    onOpenChange(false);
  };

  const toggleExpanded = (categoryId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  // Calculate total products
  const totalProducts = categories.reduce((sum, cat) => sum + (cat.product_count || 0), 0);

  // Recursive category renderer
  const renderCategory = (category: CategoryTree, depth: number = 0, index: number = 0) => {
    const hasChildren = category.children.length > 0;
    const isExpanded = expandedCategories.includes(category.id);
    const isSelected = selectedCategory === category.id;

    return (
      <div key={category.id}>
        <button
          onClick={() => {
            handleCategoryClick(category.id);
            if (hasChildren && !isExpanded) {
              setExpandedCategories(prev => [...prev, category.id]);
            }
          }}
          className={cn(
            "w-full flex items-center gap-4 px-5 py-3.5 transition-all duration-200",
            "hover:bg-primary/5 active:bg-primary/10",
            isSelected
              ? "bg-primary/10 border-l-4 border-primary"
              : "border-l-4 border-transparent"
          )}
          style={{
            paddingLeft: 20 + depth * 16,
            animationDelay: `${index * 30}ms`,
          }}
        >
          {/* Category image or placeholder */}
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden transition-all",
            isSelected
              ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
              : "",
            depth > 0 && "w-8 h-8 rounded-lg"
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
                <span className={cn(
                  "font-semibold text-muted-foreground/70",
                  depth > 0 ? "text-sm" : "text-base"
                )}>
                  {category.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {/* Category info */}
          <div className="flex-1 text-left min-w-0">
            <p className={cn(
              "font-medium truncate",
              isSelected ? "text-primary" : "text-foreground",
              depth > 0 ? "text-sm" : "text-[15px]"
            )}>
              {category.name}
            </p>
            {category.totalProductCount > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {category.totalProductCount} {getProductWord(category.totalProductCount)}
              </p>
            )}
          </div>

          {/* Expand/collapse + arrow */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {hasChildren && (
              <span 
                onClick={(e) => toggleExpanded(category.id, e)}
                className={cn(
                  "p-1.5 rounded-full hover:bg-muted transition-colors",
                  isExpanded ? "rotate-0" : ""
                )}
              >
                {isExpanded 
                  ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                }
              </span>
            )}
            {!hasChildren && (
              <ChevronRight className={cn(
                "h-4 w-4 transition-transform",
                isSelected ? "text-primary translate-x-1" : "text-muted-foreground"
              )} />
            )}
          </div>
        </button>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="border-l-2 border-muted ml-7">
            {category.children.map((child, i) => renderCategory(child, depth + 1, i))}
          </div>
        )}
      </div>
    );
  };

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
              {storeName && storeName.trim() !== '' && (
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

            {/* Categories tree - with extra bottom padding for mobile nav */}
            <div className="pb-24">
              {categoryTree.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
                    <Sparkles className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground">Категории скоро появятся</p>
                </div>
              ) : (
                categoryTree.map((category, index) => renderCategory(category, 0, index))
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
