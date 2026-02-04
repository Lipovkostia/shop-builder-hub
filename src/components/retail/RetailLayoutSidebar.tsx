import { useState, useMemo, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { buildCategoryTree, filterTreeWithProducts, getParentChain, CategoryTree } from "@/lib/categoryUtils";
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
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  
  const logoUrl = store.retail_logo_url || store.logo_url;
  const storeName = store.retail_name || store.name;

  const toggleExpanded = (categoryId: string) => {
    setExpandedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  // Filter categories to only show those with products
  const categoriesWithProducts = useMemo(() => {
    return categories.map(cat => ({
      ...cat,
      product_count: products.filter(p => {
        const productCategoryIds = p.category_ids || [];
        return productCategoryIds.includes(cat.id) || p.category_id === cat.id;
      }).length,
    }));
  }, [categories, products]);

  // Build category tree
  const categoryTree = useMemo(() => {
    const tree = buildCategoryTree(categoriesWithProducts);
    return filterTreeWithProducts(tree);
  }, [categoriesWithProducts]);

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

  // Recursive category renderer
  const renderCategory = (cat: CategoryTree, depth: number = 0) => {
    const isSelected = selectedCategory === cat.id;
    const isExpanded = expandedCategories.includes(cat.id);
    const hasChildren = cat.children.length > 0;

    return (
      <div key={cat.id}>
        <button
          onClick={() => {
            onCategorySelect(cat.id);
            if (hasChildren) {
              toggleExpanded(cat.id);
            }
          }}
          className={cn(
            "w-full text-left py-2.5 transition-colors flex items-center justify-between gap-2",
            isSelected
              ? "text-foreground font-semibold"
              : "text-muted-foreground hover:text-foreground"
          )}
          style={{ paddingLeft: depth * 16 }}
        >
          <span className="truncate font-serif font-light tracking-tight">
            {cat.name}
          </span>
          <div className="flex items-center gap-1 flex-shrink-0">
            {cat.totalProductCount > 0 && (
              <span className="text-xs text-muted-foreground">
                {cat.totalProductCount}
              </span>
            )}
            {hasChildren && (
              <span 
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpanded(cat.id);
                }}
                className="p-0.5 hover:bg-muted rounded cursor-pointer"
              >
                {isExpanded 
                  ? <ChevronDown className="h-4 w-4" />
                  : <ChevronRight className="h-4 w-4" />
                }
              </span>
            )}
          </div>
        </button>

        {/* Subcategories */}
        {hasChildren && isExpanded && (
          <div className="border-l border-sidebar-border ml-2 pl-2">
            {cat.children.map(child => renderCategory(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

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
        <nav className="px-6 space-y-1">
          {/* All products button */}
          <button
            onClick={() => onCategorySelect(null)}
            className={cn(
              "w-full text-left py-2.5 transition-colors flex items-center justify-between gap-2",
              selectedCategory === null
                ? "text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span className="truncate font-serif font-light tracking-tight">
              Все товары
            </span>
            <span className="text-xs text-muted-foreground">
              {products.length}
            </span>
          </button>

          {/* Divider */}
          <div className="h-px bg-sidebar-border my-2" />

          {/* Category tree */}
          {categoryTree.map(cat => renderCategory(cat, 0))}
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
