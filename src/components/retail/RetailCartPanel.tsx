import { Link, useParams } from "react-router-dom";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { RetailCartItem } from "@/hooks/useRetailCart";

interface RetailCartPanelProps {
  cart: RetailCartItem[];
  cartTotal: number;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price) + " ₽";
}

export function RetailCartPanel({
  cart,
  cartTotal,
  onUpdateQuantity,
  onRemove,
}: RetailCartPanelProps) {
  const { subdomain } = useParams();

  return (
    <aside className="w-full bg-background border-l border-border flex flex-col h-screen sticky top-0">
      {/* Cart items */}
      {cart.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-3">
            <ShoppingBag className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium text-foreground">Корзина пуста</p>
          <p className="text-xs text-muted-foreground mt-1 text-center">
            Добавьте товары
          </p>
        </div>
      ) : (
        <>
          <ScrollArea className="flex-1 px-3 pt-3">
            <div className="space-y-3 pb-3">
              {cart.map((item) => (
                <div
                  key={item.productId}
                  className="flex gap-2.5 items-start"
                >
                  {/* Image */}
                  <div className="w-14 h-14 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingBag className="h-5 w-5 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-xs line-clamp-2 text-foreground leading-tight">
                      {item.name}
                    </h4>
                    {item.unit && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {item.unit}
                      </p>
                    )}

                    {/* Quantity + price row */}
                    <div className="flex items-center justify-between mt-1.5">
                      <div className="flex items-center gap-0.5">
                        <button
                          className="w-6 h-6 rounded bg-muted flex items-center justify-center hover:bg-muted-foreground/20 transition-colors"
                          onClick={() => onUpdateQuantity(item.productId, item.quantity - 1)}
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-7 text-center text-xs font-semibold">
                          {item.quantity}
                        </span>
                        <button
                          className="w-6 h-6 rounded bg-muted flex items-center justify-center hover:bg-muted-foreground/20 transition-colors"
                          onClick={() => onUpdateQuantity(item.productId, item.quantity + 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>

                      <span className="font-bold text-sm text-foreground">
                        {formatPrice(item.price * item.quantity)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Footer: total + checkout */}
          <div className="border-t border-border px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">Итого</span>
              <span className="text-2xl font-bold text-foreground">
                {formatPrice(cartTotal)}
              </span>
            </div>

            <Button
              asChild
              className="w-full h-12 text-base font-semibold rounded-xl"
              size="lg"
            >
              <Link
                to={`/retail/${subdomain}/checkout`}
              >
                Продолжить
              </Link>
            </Button>
          </div>
        </>
      )}
    </aside>
  );
}
