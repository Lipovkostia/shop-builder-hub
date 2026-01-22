import { useEffect, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { Minus, Plus, Trash2, ShoppingBag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RetailCartItem } from "@/hooks/useRetailCart";

interface RetailCartDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cart: RetailCartItem[];
  cartTotal: number;
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

export function RetailCartDrawer({
  open,
  onOpenChange,
  cart,
  cartTotal,
  onUpdateQuantity,
  onRemove,
}: RetailCartDrawerProps) {
  const { subdomain } = useParams();
  const drawerRef = useRef<HTMLDivElement>(null);

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
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300 hidden lg:block",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      {/* Drawer container - slides from right */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Корзина"
        className={cn(
          "fixed inset-y-0 right-0 z-[60] hidden lg:block",
          "w-full sm:max-w-md",
          "transform transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Drawer content */}
        <div className="bg-background h-full shadow-2xl flex flex-col overflow-hidden">
          {/* Handle bar */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-12 h-1.5 rounded-full bg-muted-foreground/30" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-border/50">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Корзина</h2>
              {cart.length > 0 && (
                <span className="text-sm text-muted-foreground">
                  ({cart.length})
                </span>
              )}
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-muted/80 hover:bg-muted transition-colors"
              aria-label="Закрыть корзину"
            >
              <X className="h-5 w-5 text-foreground" />
            </button>
          </div>

          {cart.length === 0 ? (
            /* Empty state */
            <div className="flex-1 flex flex-col items-center justify-center py-12 px-5">
              <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <ShoppingBag className="h-10 w-10 text-muted-foreground/50" />
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
                Перейти к покупкам
              </Button>
            </div>
          ) : (
            <>
              {/* Scrollable cart items */}
              <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
                <div className="space-y-4">
                  {cart.map((item) => (
                    <div
                      key={item.productId}
                      className="flex gap-3 p-3 rounded-xl bg-muted/30 border border-border/50"
                    >
                      {/* Image */}
                      <div className="w-16 h-16 rounded-xl bg-muted overflow-hidden flex-shrink-0">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ShoppingBag className="h-6 w-6 text-muted-foreground/30" />
                          </div>
                        )}
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm line-clamp-2 text-foreground">
                          {item.name}
                        </h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatPrice(item.price)} / {item.unit || "шт"}
                        </p>

                        {/* Quantity controls */}
                        <div className="flex items-center justify-between mt-2">
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

                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-foreground">
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
              </div>

              {/* Fixed bottom section with total and checkout button */}
              <div className="border-t border-border bg-background px-5 pt-4 pb-6">
                {/* Total */}
                <div className="flex items-center justify-between mb-4">
                  <span className="text-muted-foreground">Итого:</span>
                  <span className="text-2xl font-bold text-foreground">
                    {formatPrice(cartTotal)}
                  </span>
                </div>

                {/* Checkout button */}
                <Button
                  asChild
                  className="w-full h-14 text-base font-semibold rounded-2xl shadow-lg"
                  size="lg"
                >
                  <Link
                    to={`/retail/${subdomain}/checkout`}
                    onClick={() => onOpenChange(false)}
                  >
                    Оформить заказ
                  </Link>
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
