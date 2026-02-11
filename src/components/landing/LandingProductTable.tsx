import { useState, useEffect, useMemo } from "react";
import { Loader2, Plus, Filter, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
}

interface LandingProductTableProps {
  onAddToCatalog?: (products: LandingProduct[]) => void;
}

export default function LandingProductTable({ onAddToCatalog }: LandingProductTableProps) {
  const [products, setProducts] = useState<LandingProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showCategories, setShowCategories] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/landing-products`
        );
        if (!res.ok) throw new Error("Failed to fetch");
        const json = await res.json();
        setProducts(json.data || []);
      } catch (e) {
        console.error("Landing products error:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  // Extract unique categories
  const categories = useMemo(() => {
    const cats = new Map<string, number>();
    products.forEach((p) => {
      const cat = p.category || "Без категории";
      cats.set(cat, (cats.get(cat) || 0) + 1);
    });
    return Array.from(cats.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [products]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    if (!activeCategory) return products;
    return products.filter((p) => (p.category || "Без категории") === activeCategory);
  }, [products, activeCategory]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const ids = filteredProducts.map((p) => p.id);
    if (ids.every((id) => selected.has(id))) {
      setSelected((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const handleAdd = () => {
    if (!onAddToCatalog || selected.size === 0) return;
    const selectedProducts = products.filter((p) => selected.has(p.id));
    onAddToCatalog(selectedProducts);
    setSelected(new Set());
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (products.length === 0) return null;

  const allFilteredSelected = filteredProducts.length > 0 && filteredProducts.every((p) => selected.has(p.id));

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-2 py-1.5 border-b bg-muted/30 flex items-center justify-between shrink-0 gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
            Каталог · {filteredProducts.length}
          </span>
          <Button
            variant={showCategories ? "secondary" : "ghost"}
            size="sm"
            className="h-5 px-1.5 text-[9px]"
            onClick={() => { setShowCategories(!showCategories); setActiveCategory(null); }}
          >
            <Filter className="h-2.5 w-2.5 mr-0.5" />
            Разделы
          </Button>
        </div>
        {onAddToCatalog && selected.size > 0 && (
          <Button size="sm" className="h-5 px-2 text-[9px]" onClick={handleAdd}>
            <Plus className="h-2.5 w-2.5 mr-0.5" />
            Добавить ({selected.size})
          </Button>
        )}
      </div>

      {/* Category filter bar */}
      {showCategories && (
        <div className="px-2 py-1 border-b bg-muted/10 flex flex-wrap gap-1 shrink-0">
          <button
            onClick={() => setActiveCategory(null)}
            className={`text-[9px] px-1.5 py-0.5 rounded-full transition-colors ${
              !activeCategory ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80 text-muted-foreground"
            }`}
          >
            Все ({products.length})
          </button>
          {categories.map(([cat, count]) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`text-[9px] px-1.5 py-0.5 rounded-full transition-colors ${
                activeCategory === cat ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80 text-muted-foreground"
              }`}
            >
              {cat} ({count})
            </button>
          ))}
        </div>
      )}

      {/* Product list */}
      <div className="overflow-y-auto flex-1 min-h-0">
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
            {filteredProducts.map((p) => (
              <tr
                key={p.id}
                className={`border-b border-border/50 h-7 cursor-pointer transition-colors ${
                  selected.has(p.id) ? "bg-primary/5" : "hover:bg-muted/30"
                }`}
                onClick={() => onAddToCatalog && toggleSelect(p.id)}
              >
                {onAddToCatalog && (
                  <td className="px-1 py-0.5" onClick={(e) => e.stopPropagation()}>
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
      </div>
    </div>
  );
}
