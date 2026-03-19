import { useRef, useCallback, memo } from "react";
import { Plus, Minus, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useVirtualizer } from "@tanstack/react-virtual";
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

/* ──────────────── Mobile card row ──────────────── */
const MobileProductRow = memo(function MobileProductRow({
  product,
  cartQty,
  onAddToCart,
  onUpdateQuantity,
  onSelectProduct,
}: {
  product: WholesaleProduct;
  cartQty: number;
  onAddToCart: () => void;
  onUpdateQuantity: (qty: number) => void;
  onSelectProduct?: () => void;
}) {
  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 border-b border-border/40 active:bg-muted/40 transition-colors"
      onClick={onSelectProduct}
    >
      <div className="shrink-0">
        {product.images?.[0] ? (
          <img src={product.images[0]} alt="" className="w-10 h-10 object-cover rounded-md" loading="lazy" />
        ) : (
          <div className="w-10 h-10 bg-muted rounded-md" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight line-clamp-2 text-foreground">{product.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {product.sku && <span className="text-[11px] text-muted-foreground">{product.sku}</span>}
          <span className="text-[11px] text-muted-foreground">{product.unit || "шт"}</span>
        </div>
      </div>
      <div className="shrink-0 flex flex-col items-end gap-1.5">
        <span className="text-sm font-semibold tabular-nums whitespace-nowrap">{formatPrice(product.price)} ₽</span>
        <div onClick={(e) => e.stopPropagation()}>
          {cartQty > 0 ? (
            <div className="inline-flex items-center gap-0.5 bg-primary/10 rounded-full">
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => onUpdateQuantity(cartQty - 1)}>
                <Minus className="h-3 w-3" />
              </Button>
              <span className="w-6 text-center font-semibold text-xs tabular-nums">{cartQty}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => onUpdateQuantity(cartQty + 1)}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="icon" className="h-7 w-7 rounded-full text-primary border-primary/30" onClick={onAddToCart}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
});

/* ──────────────── Desktop table row ──────────────── */
const DesktopProductRow = memo(function DesktopProductRow({
  product,
  cartQty,
  onAddToCart,
  onUpdateQuantity,
  onSelectProduct,
}: {
  product: WholesaleProduct;
  cartQty: number;
  onAddToCart: () => void;
  onUpdateQuantity: (id: string, qty: number) => void;
  onSelectProduct?: () => void;
}) {
  const priceDelta = 0;
  return (
    <tr
      className="border-b border-border/50 hover:bg-muted/30 transition-colors h-10 cursor-pointer"
      onClick={onSelectProduct}
    >
      <td className="px-1 py-1">
        {product.images?.[0] ? (
          <img src={product.images[0]} alt="" className="w-8 h-8 object-cover rounded" loading="lazy" />
        ) : (
          <div className="w-8 h-8 bg-muted rounded" />
        )}
      </td>
      <td className="px-2 py-1">
        <span className="hover:text-primary hover:underline line-clamp-1">{product.name}</span>
      </td>
      <td className="px-2 py-1 text-muted-foreground">{product.sku || "—"}</td>
      <td className="px-2 py-1 text-center text-muted-foreground">{product.unit || "шт"}</td>
      <td className="px-2 py-1 text-right font-medium tabular-nums whitespace-nowrap">{formatPrice(product.price)} ₽</td>
      <td className="px-2 py-1 text-center">
        {priceDelta !== 0 ? (
          <span className={cn("inline-flex items-center gap-0.5 text-[10px] font-medium", priceDelta > 0 ? "text-red-500" : "text-green-500")}>
            {priceDelta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(priceDelta).toFixed(1)}%
          </span>
        ) : (
          <span className="text-muted-foreground/40">—</span>
        )}
      </td>
      <td className="px-2 py-1 text-center">
        {product.quantity > 0 ? <span className="text-green-600 font-medium">✓</span> : <span className="text-muted-foreground/40">—</span>}
      </td>
      <td className="px-2 py-1 text-center" onClick={e => e.stopPropagation()}>
        {cartQty > 0 ? (
          <div className="inline-flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onUpdateQuantity(product.id, cartQty - 1)}>
              <Minus className="h-3 w-3" />
            </Button>
            <span className="w-5 text-center font-medium text-xs tabular-nums">{cartQty}</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onUpdateQuantity(product.id, cartQty + 1)}>
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <Button variant="ghost" size="icon" className="h-6 w-6 text-primary hover:text-primary" onClick={onAddToCart}>
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </td>
    </tr>
  );
});

/* ──────────────── Virtualized Desktop table ──────────────── */
function VirtualDesktopTable({
  products,
  getCartQuantity,
  onAddToCart,
  onUpdateQuantity,
  onSelectProduct,
}: Omit<WholesaleProductTableProps, "subdomain">) {
  const parentRef = useRef<HTMLDivElement>(null);
  const ROW_HEIGHT = 40;

  const virtualizer = useVirtualizer({
    count: products.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
  });

  return (
    <div
      ref={parentRef}
      className="w-full overflow-auto"
      style={{ height: "calc(100vh - 48px)" }}
    >
      <table className="w-full text-xs border-collapse">
        <thead className="bg-muted/40 sticky top-0 z-10">
          <tr className="border-b text-muted-foreground">
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
          {/* Spacer before visible rows */}
          {virtualizer.getVirtualItems().length > 0 && (
            <tr style={{ height: virtualizer.getVirtualItems()[0].start }}>
              <td colSpan={8} />
            </tr>
          )}
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const product = products[virtualRow.index];
            return (
              <DesktopProductRow
                key={product.id}
                product={product}
                cartQty={getCartQuantity(product.id)}
                onAddToCart={() => onAddToCart(product)}
                onUpdateQuantity={onUpdateQuantity}
                onSelectProduct={() => onSelectProduct?.(product)}
              />
            );
          })}
          {/* Spacer after visible rows */}
          {virtualizer.getVirtualItems().length > 0 && (
            <tr style={{ height: virtualizer.getTotalSize() - (virtualizer.getVirtualItems().at(-1)?.end ?? 0) }}>
              <td colSpan={8} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ──────────────── Virtualized Mobile list ──────────────── */
function VirtualMobileList({
  products,
  getCartQuantity,
  onAddToCart,
  onUpdateQuantity,
  onSelectProduct,
}: Omit<WholesaleProductTableProps, "subdomain">) {
  const parentRef = useRef<HTMLDivElement>(null);
  const ROW_HEIGHT = 64;

  const virtualizer = useVirtualizer({
    count: products.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 15,
  });

  return (
    <div
      ref={parentRef}
      className="overflow-auto"
      style={{ height: "calc(100vh - 48px)" }}
    >
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const product = products[virtualRow.index];
          return (
            <div
              key={product.id}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <MobileProductRow
                product={product}
                cartQty={getCartQuantity(product.id)}
                onAddToCart={() => onAddToCart(product)}
                onUpdateQuantity={(qty) => onUpdateQuantity(product.id, qty)}
                onSelectProduct={() => onSelectProduct?.(product)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ──────────────── Main export ──────────────── */
export function WholesaleProductTable(props: WholesaleProductTableProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <VirtualMobileList {...props} />;
  }

  return <VirtualDesktopTable {...props} />;
}
