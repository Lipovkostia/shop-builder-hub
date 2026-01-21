import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { RetailStore, RetailCategory } from "@/hooks/useRetailStore";

interface RetailLayoutSidebarProps {
  store: RetailStore;
  categories: RetailCategory[];
  selectedCategory: string | null;
  onCategorySelect: (categoryId: string | null) => void;
}

export function RetailLayoutSidebar({
  store,
  categories,
  selectedCategory,
  onCategorySelect,
}: RetailLayoutSidebarProps) {
  const { subdomain } = useParams();
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  
  const logoUrl = store.retail_logo_url || store.logo_url;

  const toggleExpanded = (categoryId: string) => {
    setExpandedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  // Get parent categories (those without parent_id)
  // For now, we treat all categories as top-level since we don't have nesting yet
  const topLevelCategories = categories;

  return (
    <aside className="w-64 lg:w-72 bg-card border-r flex flex-col h-screen sticky top-0 flex-shrink-0">
      {/* Logo / Store name */}
      <div className="p-6 border-b">
        <Link 
          to={`/retail/${subdomain}`} 
          className="block"
          onClick={() => onCategorySelect(null)}
        >
          {logoUrl ? (
            <img 
              src={logoUrl} 
              alt={store.name} 
              className="h-12 w-auto max-w-full object-contain"
            />
          ) : (
            <h1 className="text-xl font-bold tracking-tight uppercase">
              {store.name}
            </h1>
          )}
        </Link>
      </div>

      {/* Categories */}
      <ScrollArea className="flex-1 py-4">
        <nav className="px-4 space-y-1">
          {/* All products */}
          <button
            onClick={() => onCategorySelect(null)}
            className={cn(
              "w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              selectedCategory === null
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted text-foreground"
            )}
          >
            Все товары
          </button>

          {/* Category list */}
          {topLevelCategories.map((category) => {
            const isSelected = selectedCategory === category.id;
            const isExpanded = expandedCategories.includes(category.id);
            // Placeholder for subcategories - can be implemented when data supports it
            const hasChildren = false;

            return (
              <div key={category.id}>
                <button
                  onClick={() => {
                    onCategorySelect(category.id);
                    if (hasChildren) {
                      toggleExpanded(category.id);
                    }
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-between gap-2",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted text-foreground"
                  )}
                >
                  <span className="truncate">{category.name}</span>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {category.product_count !== undefined && category.product_count > 0 && (
                      <Badge 
                        variant={isSelected ? "secondary" : "outline"}
                        className={cn(
                          "text-xs h-5 px-1.5 font-normal",
                          isSelected && "bg-primary-foreground/20 text-primary-foreground border-transparent"
                        )}
                      >
                        {category.product_count}
                      </Badge>
                    )}
                    {hasChildren && (
                      isExpanded 
                        ? <ChevronDown className="h-4 w-4" />
                        : <ChevronRight className="h-4 w-4" />
                    )}
                  </div>
                </button>

                {/* Subcategories placeholder */}
                {hasChildren && isExpanded && (
                  <div className="ml-4 mt-1 space-y-1 border-l pl-3">
                    {/* Subcategories would go here */}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Store slogan/description at bottom */}
      {store.description && (
        <div className="p-4 border-t">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider leading-relaxed">
            {store.description.length > 100 
              ? store.description.slice(0, 100) + '...' 
              : store.description}
          </p>
        </div>
      )}
    </aside>
  );
}
