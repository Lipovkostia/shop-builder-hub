import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Loader2, Plus, ChevronRight, ChevronDown, FolderOpen, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

export interface LandingProduct {
  id: string;
  name: string;
  images_count: number;
  price?: number;
  unit?: string;
  sku?: string;
  image?: string;
  category?: string;
  category_id?: string;
  setting_categories?: string[];
}

export interface LandingCategory {
  id: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
}

interface LandingProductTableProps {
  onAddToCatalog?: (products: LandingProduct[]) => void;
}

const BATCH_SIZE = 50;

export default function LandingProductTable({ onAddToCatalog }: LandingProductTableProps) {
  const [allProducts, setAllProducts] = useState<LandingProduct[]>([]);
  const [categories, setCategories] = useState<LandingCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showCatalog, setShowCatalog] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/landing-products`
        );
        if (!res.ok) throw new Error("Failed to fetch");
        const json = await res.json();
        setAllProducts(json.data || []);
        setCategories(json.categories || []);
      } catch (e) {
        console.error("Landing products error:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  // Build category tree
  const categoryTree = useMemo(() => {
    const parents = categories.filter(c => !c.parent_id);
    const childrenMap = new Map<string, LandingCategory[]>();
    categories.forEach(c => {
      if (c.parent_id) {
        const arr = childrenMap.get(c.parent_id) || [];
        arr.push(c);
        childrenMap.set(c.parent_id, arr);
      }
    });
    return { parents, childrenMap };
  }, [categories]);

  // Get all child category IDs for a parent
  const getChildIds = useCallback((parentId: string): string[] => {
    const children = categoryTree.childrenMap.get(parentId) || [];
    return children.map(c => c.id);
  }, [categoryTree]);

  // Filtered products by category
  const filteredProducts = useMemo(() => {
    if (!activeCategory) return allProducts;
    // Check if it's a parent category
    const childIds = getChildIds(activeCategory);
    const matchIds = childIds.length > 0 ? [activeCategory, ...childIds] : [activeCategory];
    return allProducts.filter(p => {
      if (p.setting_categories && p.setting_categories.length > 0) {
        return p.setting_categories.some(sc => matchIds.includes(sc));
      }
      return matchIds.includes(p.category_id || "");
    });
  }, [allProducts, activeCategory, getChildIds]);

  // Visible products (lazy loaded)
  const visibleProducts = useMemo(() => {
    return filteredProducts.slice(0, visibleCount);
  }, [filteredProducts, visibleCount]);

  // Reset visible count when filter changes
  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [activeCategory]);

  // Infinite scroll handler
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100) {
      setVisibleCount(prev => {
        if (prev >= filteredProducts.length) return prev;
        return Math.min(prev + BATCH_SIZE, filteredProducts.length);
      });
    }
  }, [filteredProducts.length]);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const ids = filteredProducts.map(p => p.id);
    if (ids.every(id => selected.has(id))) {
      setSelected(prev => {
        const next = new Set(prev);
        ids.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelected(prev => {
        const next = new Set(prev);
        ids.forEach(id => next.add(id));
        return next;
      });
    }
  };

  const handleAdd = () => {
    if (!onAddToCatalog || selected.size === 0) return;
    const selectedProducts = allProducts.filter(p => selected.has(p.id));
    onAddToCatalog(selectedProducts);
    setSelected(new Set());
  };

  const toggleParent = (id: string) => {
    setExpandedParents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectCategory = (id: string | null) => {
    setActiveCategory(id);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (allProducts.length === 0) return null;

  const allFilteredSelected = filteredProducts.length > 0 && filteredProducts.every(p => selected.has(p.id));
  const hasMore = visibleCount < filteredProducts.length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-2 py-1.5 border-b bg-muted/30 flex items-center justify-between shrink-0 gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
            Каталог · {filteredProducts.length}
          </span>
          <Button
            variant={showCatalog ? "secondary" : "ghost"}
            size="sm"
            className="h-5 px-1.5 text-[9px]"
            onClick={() => { setShowCatalog(!showCatalog); if (showCatalog) { setActiveCategory(null); setExpandedParents(new Set()); } }}
          >
            <FolderOpen className="h-2.5 w-2.5 mr-0.5" />
            Каталог
          </Button>
          {activeCategory && (
            <button
              onClick={() => selectCategory(null)}
              className="text-[9px] text-primary hover:underline flex items-center gap-0.5"
            >
              <X className="h-2.5 w-2.5" />
              Сбросить
            </button>
          )}
        </div>
        {onAddToCatalog && selected.size > 0 && (
          <Button size="sm" className="h-5 px-2 text-[9px]" onClick={handleAdd}>
            <Plus className="h-2.5 w-2.5 mr-0.5" />
            Добавить ({selected.size})
          </Button>
        )}
      </div>

      {/* Hierarchical category panel */}
      {showCatalog && categories.length > 0 && (
        <div className="border-b bg-muted/10 shrink-0 max-h-48 overflow-y-auto">
          {/* All products button */}
          <button
            onClick={() => selectCategory(null)}
            className={`w-full text-left text-[10px] px-2 py-1 transition-colors flex items-center gap-1 ${
              !activeCategory ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted/50 text-foreground"
            }`}
          >
            Все товары ({allProducts.length})
          </button>

          {/* Parent categories */}
          {categoryTree.parents.map(parent => {
            const children = categoryTree.childrenMap.get(parent.id) || [];
            const hasChildren = children.length > 0;
            const isExpanded = expandedParents.has(parent.id);
            const isActive = activeCategory === parent.id;

            return (
              <div key={parent.id}>
                <div className="flex items-center">
                  {hasChildren && (
                    <button
                      onClick={() => toggleParent(parent.id)}
                      className="px-1 py-1 text-muted-foreground hover:text-foreground"
                    >
                      {isExpanded
                        ? <ChevronDown className="h-3 w-3" />
                        : <ChevronRight className="h-3 w-3" />
                      }
                    </button>
                  )}
                  <button
                    onClick={() => selectCategory(parent.id)}
                    className={`flex-1 text-left text-[10px] py-1 pr-2 transition-colors font-medium ${
                      !hasChildren ? "pl-5" : ""
                    } ${isActive ? "text-primary font-semibold" : "hover:text-primary text-foreground"}`}
                  >
                    {parent.name}
                  </button>
                </div>
                {/* Subcategories */}
                {hasChildren && isExpanded && (
                  <div className="ml-4">
                    {children.map(child => (
                      <button
                        key={child.id}
                        onClick={() => selectCategory(child.id)}
                        className={`w-full text-left text-[10px] pl-3 pr-2 py-0.5 transition-colors ${
                          activeCategory === child.id ? "text-primary font-semibold" : "hover:text-primary text-muted-foreground"
                        }`}
                      >
                        {child.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Product list with infinite scroll */}
      <div
        ref={scrollRef}
        className="overflow-y-auto flex-1 min-h-0"
        onScroll={handleScroll}
      >
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="border-b bg-muted/40">
              {onAddToCatalog && (
                <th className="px-1 py-1 w-5">
                  <Checkbox
                    checked={allFilteredSelected}
                    onCheckedChange={toggleAll}
                    className="h-3.5 w-3.5"
                  />
                </th>
              )}
              <th className="text-left text-[10px] font-medium text-muted-foreground px-2 py-1">Название</th>
            </tr>
          </thead>
          <tbody>
            {visibleProducts.map(p => (
              <tr
                key={p.id}
                className={`border-b border-border/50 h-7 cursor-pointer transition-colors ${
                  selected.has(p.id) ? "bg-primary/5" : "hover:bg-muted/30"
                }`}
                onClick={() => onAddToCatalog && toggleSelect(p.id)}
              >
                {onAddToCatalog && (
                  <td className="px-1 py-0.5" onClick={e => e.stopPropagation()}>
                    <Checkbox
                      checked={selected.has(p.id)}
                      onCheckedChange={() => toggleSelect(p.id)}
                      className="h-3.5 w-3.5"
                    />
                  </td>
                )}
                <td className="px-2 py-0.5">
                  <span className="text-[11px] font-medium truncate block">{p.name}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {hasMore && (
          <div className="flex justify-center py-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
}
