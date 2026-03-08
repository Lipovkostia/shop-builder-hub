import { Plus, Minus, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import type { WholesaleProduct } from "@/hooks/useWholesaleStore";

interface WholesaleProductTableProps {
  products: WholesaleProduct[];
  subdomain: string;
  getCartQuantity: (productId: string) => number;
  onAddToCart: (product: WholesaleProduct) => void;
  onUpdateQuantity: (productId: string, qty: number) => void;
  onSelectProduct?: (product: WholesaleProduct) => void;
  medieval?: boolean;
}

function formatPrice(price: number): string {
  if (!price || price === 0) return "0,00";
  return price.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ──────────── Medieval palette ──────────── */
const med = {
  rowEven: "rgba(62, 42, 20, 0.12)",
  rowOdd: "rgba(90, 61, 30, 0.08)",
  rowHover: "rgba(139, 90, 30, 0.18)",
  headerBg: "rgba(90, 61, 30, 0.25)",
  text: "#3d2a10",
  textMuted: "#7a6545",
  border: "rgba(139, 90, 30, 0.25)",
  accent: "#8b5a1e",
  accentLight: "rgba(139, 90, 30, 0.15)",
  gold: "#b8860b",
  font: "'Georgia', serif",
};

/* ──────────────── Mobile card row ──────────────── */
function MobileProductRow({
  product,
  cartQty,
  onAddToCart,
  onUpdateQuantity,
  onSelectProduct,
  medieval,
}: {
  product: WholesaleProduct;
  cartQty: number;
  onAddToCart: () => void;
  onUpdateQuantity: (qty: number) => void;
  onSelectProduct?: () => void;
  medieval?: boolean;
}) {
  const baseStyle = medieval
    ? { borderColor: med.border, fontFamily: med.font }
    : {};

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 border-b transition-colors",
        !medieval && "border-border/40 active:bg-muted/40"
      )}
      style={{
        ...baseStyle,
        ...(medieval ? { color: med.text } : {}),
      }}
      onClick={onSelectProduct}
    >
      {/* Image */}
      <div className="shrink-0">
        {product.images?.[0] ? (
          <img
            src={product.images[0]}
            alt=""
            className="w-10 h-10 object-cover rounded-md"
            style={medieval ? { borderRadius: "4px", border: `1px solid ${med.border}` } : {}}
            loading="lazy"
          />
        ) : (
          <div
            className="w-10 h-10 rounded-md"
            style={medieval ? { background: med.accentLight, border: `1px solid ${med.border}` } : {}}
          />
        )}
      </div>

      {/* Name + SKU + Unit */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight line-clamp-2" style={medieval ? { color: med.text } : {}}>
          {product.name}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {product.sku && (
            <span className="text-[11px]" style={medieval ? { color: med.textMuted } : {}}>{product.sku}</span>
          )}
          <span className="text-[11px]" style={medieval ? { color: med.textMuted } : {}}>{product.unit || "шт"}</span>
        </div>
      </div>

      {/* Price + Cart */}
      <div className="shrink-0 flex flex-col items-end gap-1.5">
        <span className="text-sm font-semibold tabular-nums whitespace-nowrap" style={medieval ? { color: med.accent } : {}}>
          {formatPrice(product.price)} ₽
        </span>

        <div onClick={(e) => e.stopPropagation()}>
          {cartQty > 0 ? (
            <div
              className="inline-flex items-center gap-0.5 rounded-full"
              style={medieval ? { background: med.accentLight } : {}}
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full"
                style={medieval ? { color: med.accent } : {}}
                onClick={() => onUpdateQuantity(cartQty - 1)}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="w-6 text-center font-semibold text-xs tabular-nums" style={medieval ? { color: med.text } : {}}>{cartQty}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full"
                style={medieval ? { color: med.accent } : {}}
                onClick={() => onUpdateQuantity(cartQty + 1)}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 rounded-full"
              style={medieval ? { borderColor: med.border, color: med.accent, background: "transparent" } : {}}
              onClick={onAddToCart}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ──────────────── Desktop table ──────────────── */
function DesktopProductTable({
  products,
  getCartQuantity,
  onAddToCart,
  onUpdateQuantity,
  onSelectProduct,
  medieval,
}: Omit<WholesaleProductTableProps, "subdomain">) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-xs border-collapse" style={medieval ? { fontFamily: med.font } : {}}>
        <thead className="sticky top-0 z-10">
          <tr
            className="border-b"
            style={medieval ? { background: med.headerBg, borderColor: med.border, color: med.textMuted } : {}}
          >
            <th className="w-10 px-1 py-2">&nbsp;</th>
            <th className="px-2 py-2 text-left font-medium min-w-[250px]">Наименование</th>
            <th className="px-2 py-2 text-left font-medium w-24">Артикул</th>
            <th className="px-2 py-2 text-center font-medium w-16">Ед. изм.</th>
            <th className="px-2 py-2 text-right font-medium w-28">Цена</th>
            <th className="px-2 py-2 text-center font-medium w-16">Δ 24ч</th>
            <th className="px-2 py-2 text-center font-medium w-14">Наличие</th>
            <th className="px-2 py-2 text-center font-medium w-24">Корзина</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product, idx) => {
            const cartQty = getCartQuantity(product.id);
            const priceDelta = 0;
            const isEven = idx % 2 === 0;

            return (
              <tr
                key={product.id}
                className={cn(
                  "border-b transition-colors h-10 cursor-pointer",
                  !medieval && "border-border/50 hover:bg-muted/30"
                )}
                style={medieval ? {
                  background: isEven ? med.rowEven : med.rowOdd,
                  borderColor: med.border,
                } : {}}
                onMouseEnter={medieval ? (e) => { (e.currentTarget as HTMLElement).style.background = med.rowHover; } : undefined}
                onMouseLeave={medieval ? (e) => { (e.currentTarget as HTMLElement).style.background = isEven ? med.rowEven : med.rowOdd; } : undefined}
                onClick={() => onSelectProduct?.(product)}
              >
                {/* Image */}
                <td className="px-1 py-1">
                  {product.images?.[0] ? (
                    <img
                      src={product.images[0]}
                      alt=""
                      className="w-8 h-8 object-cover rounded"
                      style={medieval ? { border: `1px solid ${med.border}`, borderRadius: "3px" } : {}}
                      loading="lazy"
                    />
                  ) : (
                    <div
                      className="w-8 h-8 rounded"
                      style={medieval ? { background: med.accentLight, border: `1px solid ${med.border}` } : {}}
                    />
                  )}
                </td>

                <td className="px-2 py-1">
                  <span
                    className="line-clamp-1 transition-colors"
                    style={medieval ? { color: med.text } : {}}
                    onMouseEnter={medieval ? (e) => { (e.currentTarget as HTMLElement).style.color = med.accent; } : undefined}
                    onMouseLeave={medieval ? (e) => { (e.currentTarget as HTMLElement).style.color = med.text; } : undefined}
                  >
                    {product.name}
                  </span>
                </td>

                <td className="px-2 py-1" style={medieval ? { color: med.textMuted } : {}}>
                  {product.sku || "—"}
                </td>

                <td className="px-2 py-1 text-center" style={medieval ? { color: med.textMuted } : {}}>
                  {product.unit || "шт"}
                </td>

                <td className="px-2 py-1 text-right font-medium tabular-nums whitespace-nowrap" style={medieval ? { color: med.accent } : {}}>
                  {formatPrice(product.price)} ₽
                </td>

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
                    <span style={medieval ? { color: "rgba(122, 101, 69, 0.4)" } : {}}>—</span>
                  )}
                </td>

                <td className="px-2 py-1 text-center">
                  {product.quantity > 0 ? (
                    <span className="font-medium" style={medieval ? { color: "#5a7a3a" } : { color: "green" }}>✓</span>
                  ) : (
                    <span style={medieval ? { color: "rgba(122, 101, 69, 0.4)" } : {}}>—</span>
                  )}
                </td>

                <td className="px-2 py-1 text-center" onClick={e => e.stopPropagation()}>
                  {cartQty > 0 ? (
                    <div className="inline-flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        style={medieval ? { color: med.accent } : {}}
                        onClick={() => onUpdateQuantity(product.id, cartQty - 1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-5 text-center font-medium text-xs tabular-nums" style={medieval ? { color: med.text } : {}}>
                        {cartQty}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        style={medieval ? { color: med.accent } : {}}
                        onClick={() => onUpdateQuantity(product.id, cartQty + 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      style={medieval ? { color: med.gold } : {}}
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

/* ──────────────── Main export ──────────────── */
export function WholesaleProductTable(props: WholesaleProductTableProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="divide-y-0">
        {props.products.map((product) => (
          <MobileProductRow
            key={product.id}
            product={product}
            cartQty={props.getCartQuantity(product.id)}
            onAddToCart={() => props.onAddToCart(product)}
            onUpdateQuantity={(qty) => props.onUpdateQuantity(product.id, qty)}
            onSelectProduct={() => props.onSelectProduct?.(product)}
            medieval={props.medieval}
          />
        ))}
      </div>
    );
  }

  return <DesktopProductTable {...props} />;
}
