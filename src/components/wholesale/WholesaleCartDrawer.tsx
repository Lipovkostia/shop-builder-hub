import { useEffect, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { Minus, Plus, Trash2, ShoppingCart, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { WholesaleCartItem } from "@/hooks/useWholesaleCart";

interface WholesaleCartDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cart: WholesaleCartItem[];
  cartTotal: number;
  minOrderAmount?: number;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

export function WholesaleCartDrawer({
  open,
  onOpenChange,
  cart,
  cartTotal,
  minOrderAmount = 0,
  onUpdateQuantity,
  onRemove,
}: WholesaleCartDrawerProps) {
  const { subdomain } = useParams();
  const drawerRef = useRef<HTMLDivElement>(null);

  const canCheckout = cartTotal >= minOrderAmount;

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onOpenChange(false);
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onOpenChange]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* Backdrop - desktop only */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 hidden lg:block",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      {/* Drawer container - slides from right, desktop only */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Корзина"
        className={cn(
          "fixed right-0 top-0 bottom-0 z-50 w-full max-w-md hidden lg:block",
          "bg-background shadow-2xl border-l border-border",
          "transform transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Корзина</h2>
              {cart.length > 0 && (
                <span className="text-sm text-muted-foreground">
                  ({cart.length} {cart.length === 1 ? "позиция" : cart.length < 5 ? "позиции" : "позиций"})
                </span>
              )}
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-muted/80 hover:bg-muted transition-colors"
              aria-label="Закрыть корзину"
            >
              <X className="h-5 w-5 text-foreground" />
            </button>
          </div>

          {cart.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center px-6">
              <div className="w-24 h-24 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <ShoppingCart className="h-12 w-12 text-muted-foreground/50" />
              </div>
              <p className="text-lg font-medium text-foreground">Корзина пуста</p>
              <p className="text-sm text-muted-foreground mt-1 text-center">
                Добавьте товары для оформления заказа
              </p>
              <Button
                variant="outline"
                className="mt-6"
                onClick={() => onOpenChange(false)}
              >
                Вернуться к каталогу
              </Button>
            </div>
          ) : (
            <>
              {/* Scrollable cart items */}
              <ScrollArea className="flex-1">
                <div className="px-6 py-4 space-y-3">
                  {cart.map((item) => (
                    <div
                      key={item.productId}
                      className="flex gap-4 p-4 rounded-xl bg-muted/30 border border-border/50"
                    >
                      {/* Image */}
                      <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ShoppingCart className="h-6 w-6 text-muted-foreground/30" />
                          </div>
                        )}
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm line-clamp-2 text-foreground">
                          {item.name}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">
                            {formatPrice(item.price)} / {item.unit || "шт"}
                          </span>
                          {item.sku && (
                            <span className="text-xs text-muted-foreground">
                              • Арт: {item.sku}
                            </span>
                          )}
                        </div>

                        {/* Quantity controls */}
                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center gap-1">
                            <button
                              className="w-8 h-8 rounded-lg bg-background border border-border flex items-center justify-center hover:bg-muted transition-colors"
                              onClick={() => onUpdateQuantity(item.productId, item.quantity - 1)}
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="w-10 text-center text-sm font-semibold">
                              {item.quantity}
                            </span>
                            <button
                              className="w-8 h-8 rounded-lg bg-background border border-border flex items-center justify-center hover:bg-muted transition-colors"
                              onClick={() => onUpdateQuantity(item.productId, item.quantity + 1)}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="font-bold text-foreground">
                              {formatPrice(item.price * item.quantity)}
                            </span>
                            <button
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                              onClick={() => onRemove(item.productId)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Fixed bottom section with total and checkout button */}
              <div className="border-t border-border bg-background px-6 py-5">
                {/* Minimum order warning */}
                {!canCheckout && minOrderAmount > 0 && (
                  <div className="bg-amber-500/10 text-amber-600 dark:text-amber-400 text-sm rounded-lg px-3 py-2 mb-4">
                    Минимальный заказ: {formatPrice(minOrderAmount)}. Добавьте ещё {formatPrice(minOrderAmount - cartTotal)}
                  </div>
                )}

                {/* Total */}
                <div className="flex items-center justify-between mb-4">
                  <span className="text-muted-foreground">Итого к оплате:</span>
                  <span className="text-2xl font-bold text-foreground">
                    {formatPrice(cartTotal)}
                  </span>
                </div>

                {/* Checkout button */}
                <Button
                  asChild={canCheckout}
                  disabled={!canCheckout}
                  className="w-full h-12 text-base font-semibold rounded-xl"
                  size="lg"
                >
                  {canCheckout ? (
                    <Link
                      to={`/wholesale/${subdomain}/checkout`}
                      onClick={() => onOpenChange(false)}
                    >
                      Оформить заказ
                    </Link>
                  ) : (
                    <span>Оформить заказ</span>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
