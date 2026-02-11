import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ImageIcon, Loader2 } from "lucide-react";

interface LandingProduct {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  unit: string | null;
  images_count: number;
  quantity: number;
  category: string | null;
  store_name: string;
  store_subdomain: string;
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
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Товары скоро появятся
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b bg-muted/30">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Каталог товаров платформы
        </h3>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {products.length} товаров от продавцов
        </p>
      </div>
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="h-7">
              <TableHead className="text-[10px] px-2">Название</TableHead>
              <TableHead className="text-[10px] px-2">Арт.</TableHead>
              <TableHead className="text-[10px] px-2 text-right">Цена</TableHead>
              <TableHead className="text-[10px] px-2 text-center">Ед.</TableHead>
              <TableHead className="text-[10px] px-2 text-center">
                <ImageIcon className="h-3 w-3 mx-auto" />
              </TableHead>
              <TableHead className="text-[10px] px-2">Магазин</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((p) => (
              <TableRow key={p.id} className="h-7">
                <TableCell className="px-2 py-0.5 max-w-[140px]">
                  <span className="text-[11px] font-medium">{p.name}</span>
                  {p.category && (
                    <span className="block text-[9px] text-muted-foreground truncate">{p.category}</span>
                  )}
                </TableCell>
                <TableCell className="px-2 py-0.5">
                  <span className="text-[10px] text-muted-foreground">{p.sku || "—"}</span>
                </TableCell>
                <TableCell className="px-2 py-0.5 text-right">
                  <span className="text-[11px] font-medium">{p.price.toLocaleString("ru-RU")} ₽</span>
                </TableCell>
                <TableCell className="px-2 py-0.5 text-center">
                  <span className="text-[10px]">{p.unit || "шт"}</span>
                </TableCell>
                <TableCell className="px-2 py-0.5 text-center">
                  {p.images_count > 0 ? (
                    <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
                      {p.images_count}
                    </Badge>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="px-2 py-0.5 max-w-[100px]">
                  <span className="text-[10px] text-muted-foreground truncate block">{p.store_name}</span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
