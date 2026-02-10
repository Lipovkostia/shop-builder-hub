import { useState, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { RetailStore, RetailCategory, RetailProduct } from "@/hooks/useRetailStore";

interface RetailLayoutSidebarProps {
  store: RetailStore;
  categories: RetailCategory[];
  products: RetailProduct[];
  selectedCategory: string | null;
  onCategorySelect: (categoryId: string | null) => void;
}

export function RetailLayoutSidebar({
  store,
  categories,
  products,
  selectedCategory,
  onCategorySelect,
}: RetailLayoutSidebarProps) {
  const { subdomain } = useParams();
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  
  const logoUrl = store.retail_logo_url || store.logo_url;
  const storeName = store.retail_name || store.name;

  const toggleExpanded = (categoryId: string) => {
    setExpandedSections((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  // Build hierarchy: sections (parents) and subcategories (children)
  const { sections, standalone } = useMemo(() => {
    // Filter to categories with products
    const hasProducts = (catId: string) =>
      products.some(p => p.category_ids?.includes(catId) || p.category_id === catId);

    const parentCategories = categories.filter(c => !c.parent_id);
    const childCategories = categories.filter(c => c.parent_id);

    const sections: { parent: RetailCategory; children: RetailCategory[] }[] = [];
    const standalone: RetailCategory[] = [];

    for (const parent of parentCategories) {
      const children = childCategories
        .filter(c => c.parent_id === parent.id)
        .filter(c => hasProducts(c.id));

      const parentHasProducts = hasProducts(parent.id);

      if (children.length > 0) {
        // Section with children - show even if parent itself has no direct products
        sections.push({ parent, children });
      } else if (parentHasProducts) {
        // Standalone category (no children, but has products)
        standalone.push(parent);
      }
    }

    // Also include orphan children (parent_id set but parent not in list) that have products
    const parentIds = new Set(parentCategories.map(p => p.id));
    const orphans = childCategories
      .filter(c => c.parent_id && !parentIds.has(c.parent_id))
      .filter(c => hasProducts(c.id));
    standalone.push(...orphans);

    return { sections, standalone };
  }, [categories, products]);

  // Auto-expand section containing selected category
  useMemo(() => {
    if (!selectedCategory) return;
    for (const section of sections) {
      if (section.children.some(c => c.id === selectedCategory) || section.parent.id === selectedCategory) {
        if (!expandedSections.includes(section.parent.id)) {
          setExpandedSections(prev => [...prev, section.parent.id]);
        }
        break;
      }
    }
  }, [selectedCategory, sections]);

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
              alt={storeName}
              className="h-12 w-auto max-w-full object-contain"
            />
          ) : (
            <h1 className="text-lg font-medium tracking-widest uppercase text-sidebar-foreground">
              {storeName}
            </h1>
          )}
        </Link>
      </div>

      {/* Categories */}
      <ScrollArea className="flex-1 py-6">
        <nav className="px-6 space-y-0.5">
          {/* Sections with children */}
          {sections.map(({ parent, children }) => {
            const isExpanded = expandedSections.includes(parent.id);
            const isSectionSelected = selectedCategory === parent.id;

            return (
              <div key={parent.id} className="mb-1">
                <button
                  onClick={() => {
                    toggleExpanded(parent.id);
                    onCategorySelect(parent.id);
                  }}
                  className={cn(
                    "w-full text-left py-2 transition-colors flex items-center justify-between gap-2",
                    isSectionSelected
                      ? "text-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className="truncate font-serif font-medium tracking-tight text-[0.95rem]">
                    {parent.name}
                  </span>
                  {isExpanded 
                    ? <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 opacity-50" />
                    : <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 opacity-50" />
                  }
                </button>

                {isExpanded && (
                  <div className="ml-3 border-l border-sidebar-border pl-3 space-y-0.5 pb-1">
                    {children.map((child) => {
                      const isSelected = selectedCategory === child.id;
                      return (
                        <button
                          key={child.id}
                          onClick={() => onCategorySelect(child.id)}
                          className={cn(
                            "w-full text-left py-1.5 transition-colors block",
                            isSelected
                              ? "text-foreground font-semibold"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <span className="truncate font-serif font-light tracking-tight text-sm">
                            {child.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Standalone categories (no children) */}
          {standalone.map((category) => {
            const isSelected = selectedCategory === category.id;
            return (
              <button
                key={category.id}
                onClick={() => onCategorySelect(category.id)}
                className={cn(
                  "w-full text-left py-2 transition-colors flex items-center gap-2",
                  isSelected
                    ? "text-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="truncate font-serif font-light tracking-tight">{category.name}</span>
              </button>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Store description at bottom */}
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
