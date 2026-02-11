import { useState, useEffect } from "react";
import { ImageIcon, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface LandingProduct {
  id: string;
  name: string;
  images_count: number;
}

export default function LandingProductTable() {
  const [products, setProducts] = useState<LandingProduct[]>([]);
  const [loading, setLoading] = useState(true);

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
      <div className="px-2 py-1.5 border-b bg-muted/30">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Каталог товаров · {products.length}
        </span>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b bg-muted/20">
              <th className="text-left text-[10px] font-medium text-muted-foreground px-2 py-1">Название</th>
              <th className="text-center text-[10px] font-medium text-muted-foreground px-1 py-1 w-10">
                <ImageIcon className="h-3 w-3 mx-auto" />
              </th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-b border-border/50 h-7">
                <td className="px-2 py-0.5">
                  <span className="text-[11px] font-medium truncate block">{p.name}</span>
                </td>
                <td className="px-1 py-0.5 text-center">
                  {p.images_count > 0 ? (
                    <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
                      {p.images_count}
                    </Badge>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
