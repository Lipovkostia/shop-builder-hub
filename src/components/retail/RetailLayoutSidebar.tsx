import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
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
  const topLevelCategories = categories;

  return (
    <aside className="w-64 lg:w-72 bg-sidebar border-r border-sidebar-border flex flex-col h-screen sticky top-0 flex-shrink-0">
      {/* Logo / Store name */}
      <div className="p-6 border-b border-sidebar-border">
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
            <h1 className="text-lg font-medium tracking-widest uppercase text-sidebar-foreground">
              {store.name}
            </h1>
          )}
        </Link>
      </div>

      {/* Categories */}
      <ScrollArea className="flex-1 py-6">
        <nav className="px-6 space-y-1">
          {/* Category list */}
          {topLevelCategories.map((category) => {
            const isSelected = selectedCategory === category.id;
            const isExpanded = expandedCategories.includes(category.id);
            // Placeholder for subcategories
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
                    "w-full text-left py-2.5 text-sm transition-colors flex items-center justify-between gap-2",
                    isSelected
                      ? "text-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className="truncate">{category.name}</span>
                  {hasChildren && (
                    isExpanded 
                      ? <ChevronDown className="h-4 w-4 flex-shrink-0" />
                      : <ChevronRight className="h-4 w-4 flex-shrink-0" />
                  )}
                </button>

                {/* Subcategories placeholder */}
                {hasChildren && isExpanded && (
                  <div className="ml-4 space-y-1 border-l border-sidebar-border pl-4">
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
        <div className="p-6 border-t border-sidebar-border">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest leading-relaxed">
            {store.description.length > 80 
              ? store.description.slice(0, 80) + '...' 
              : store.description}
          </p>
        </div>
      )}
    </aside>
  );
}
