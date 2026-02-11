import { useState, useEffect } from "react";
import { Loader2, Plus } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

interface LandingProduct {
  id: string;
  name: string;
  images_count: number;
  price?: number;
  unit?: string;
  sku?: string;
}

interface LandingProductTableProps {
  onAddToCatalog?: (products: LandingProduct[]) => void;
}

export default function LandingProductTable({ onAddToCatalog }: LandingProductTableProps) {
  const [products, setProducts] = useState<LandingProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

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

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === products.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(products.map((p) => p.id)));
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

  return (
    <div className="flex flex-col">
      <div className="px-2 py-1.5 border-b bg-muted/30 flex items-center justify-between">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Каталог товаров · {products.length}
        </span>
        {onAddToCatalog && selected.size > 0 && (
          <Button size="sm" className="h-6 px-2 text-[10px]" onClick={handleAdd}>
            <Plus className="h-3 w-3 mr-1" />
            Добавить ({selected.size})
          </Button>
        )}
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b bg-muted/20">
              {onAddToCatalog && (
                <th className="px-1 py-1 w-5">
                  <Checkbox
                    checked={selected.size === products.length && products.length > 0}
                    onCheckedChange={toggleAll}
                    className="h-3.5 w-3.5"
                  />
                </th>
              )}
              <th className="text-left text-[10px] font-medium text-muted-foreground px-2 py-1">Название</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
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
