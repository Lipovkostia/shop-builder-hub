import { Link } from "react-router-dom";
import { Plus, Minus, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { WholesaleProduct } from "@/hooks/useWholesaleStore";

interface WholesaleProductTableProps {
  products: WholesaleProduct[];
  subdomain: string;
  getCartQuantity: (productId: string) => number;
  onAddToCart: (product: WholesaleProduct) => void;
  onUpdateQuantity: (productId: string, qty: number) => void;
  onSelectProduct?: (product: WholesaleProduct) => void;
}

function formatPrice(price: number): string {
  if (!price || price === 0) return "0,00";
  return price.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function WholesaleProductTable({
  products,
  subdomain,
  getCartQuantity,
  onAddToCart,
  onUpdateQuantity,
}: WholesaleProductTableProps) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        {/* Header */}
        <thead className="bg-muted/40 sticky top-0 z-10">
          <tr className="border-b text-muted-foreground">
            <th className="w-8 px-1 py-2 text-center">&nbsp;</th>
            <th className="w-10 px-1 py-2">&nbsp;</th>
            <th className="px-2 py-2 text-left font-medium min-w-[250px]">Наименование</th>
            <th className="px-2 py-2 text-left font-medium w-24">Артикул</th>
            <th className="px-2 py-2 text-center font-medium w-16">Ед. изм.</th>
            <th className="px-2 py-2 text-right font-medium w-24">Цена</th>
            <th className="px-2 py-2 text-center font-medium w-16">Δ 24ч</th>
            <th className="px-2 py-2 text-center font-medium w-14">Наличие</th>
            <th className="px-2 py-2 text-center font-medium w-24">Корзина</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => {
            const cartQty = getCartQuantity(product.id);
            // Placeholder price delta (will be real data later)
            const priceDelta = 0;
            
            return (
              <tr
                key={product.id}
                className="border-b border-border/50 hover:bg-muted/30 transition-colors h-10"
              >
                {/* Checkbox placeholder */}
                <td className="px-1 py-1 text-center">
                  <input type="checkbox" className="h-3.5 w-3.5 rounded border-muted-foreground/30" />
                </td>

                {/* Image */}
                <td className="px-1 py-1">
                  {product.images?.[0] ? (
                    <img
                      src={product.images[0]}
                      alt=""
                      className="w-8 h-8 object-cover rounded"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-8 h-8 bg-muted rounded" />
                  )}
                </td>

                {/* Name */}
                <td className="px-2 py-1">
                  <Link
                    to={`/wholesale/${subdomain}/product/${product.slug}`}
                    className="hover:text-primary hover:underline line-clamp-1"
                  >
                    {product.name}
                  </Link>
                </td>

                {/* SKU */}
                <td className="px-2 py-1 text-muted-foreground">
                  {product.sku || "—"}
                </td>

                {/* Unit */}
                <td className="px-2 py-1 text-center text-muted-foreground">
                  {product.unit || "шт"}
                </td>

                {/* Price */}
                <td className="px-2 py-1 text-right font-medium tabular-nums">
                  {formatPrice(product.price)}
                </td>

                {/* Price delta */}
                <td className="px-2 py-1 text-center">
                  {priceDelta !== 0 ? (
                    <span className={cn(
                      "inline-flex items-center gap-0.5 text-[10px] font-medium",
                      priceDelta > 0 ? "text-red-500" : "text-green-500"
                    )}>
                      {priceDelta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {Math.abs(priceDelta).toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-muted-foreground/40">—</span>
                  )}
                </td>

                {/* Stock */}
                <td className="px-2 py-1 text-center">
                  {product.quantity > 0 ? (
                    <span className="text-green-600 font-medium">✓</span>
                  ) : (
                    <span className="text-muted-foreground/40">—</span>
                  )}
                </td>

                {/* Cart actions */}
                <td className="px-2 py-1 text-center">
                  {cartQty > 0 ? (
                    <div className="inline-flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => onUpdateQuantity(product.id, cartQty - 1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-5 text-center font-medium text-xs tabular-nums">{cartQty}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => onUpdateQuantity(product.id, cartQty + 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-primary hover:text-primary"
                      onClick={() => onAddToCart(product)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
