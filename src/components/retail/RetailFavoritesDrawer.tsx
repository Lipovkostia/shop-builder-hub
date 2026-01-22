import { Heart, X, ShoppingBag, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { RetailProduct } from "@/hooks/useRetailStore";

interface RetailFavoritesDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: RetailProduct[];
  favoriteIds: string[];
  onToggleFavorite: (productId: string) => void;
  onAddToCart: (product: RetailProduct) => void;
  getCartQuantity: (productId: string) => number;
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

export function RetailFavoritesDrawer({
  open,
  onOpenChange,
  products,
  favoriteIds,
  onToggleFavorite,
  onAddToCart,
  getCartQuantity,
}: RetailFavoritesDrawerProps) {
  // Get favorite products
  const favoriteProducts = products.filter((p) => favoriteIds.includes(p.id));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-md p-0 flex flex-col border-l"
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-destructive fill-destructive" />
            <h2 className="text-xl font-semibold text-foreground">Избранное</h2>
            {favoriteProducts.length > 0 && (
              <span className="text-sm bg-destructive/10 text-destructive px-2 py-0.5 rounded-full font-medium">
                {favoriteProducts.length}
              </span>
            )}
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-muted/80 hover:bg-muted transition-colors"
            aria-label="Закрыть избранное"
          >
            <X className="h-5 w-5 text-foreground" />
          </button>
        </div>

        {favoriteProducts.length === 0 ? (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center py-12 px-5">
            <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <Heart className="h-10 w-10 text-destructive/40" />
            </div>
            <p className="text-lg font-medium text-foreground">Список пуст</p>
            <p className="text-sm text-muted-foreground mt-1 text-center max-w-[250px]">
              Нажмите на сердечко у товара, чтобы добавить его в избранное
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
            {/* Scrollable favorites grid */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
              {/* 2-column compact grid */}
              <div className="grid grid-cols-2 gap-3">
                {favoriteProducts.map((product) => {
                  const inCart = getCartQuantity(product.id) > 0;
                  
                  return (
                    <div
                      key={product.id}
                      className="relative bg-card rounded-2xl border border-border/50 overflow-hidden shadow-sm"
                    >
                      {/* Remove from favorites button */}
                      <button
                        onClick={() => onToggleFavorite(product.id)}
                        className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-md hover:bg-white transition-colors"
                        aria-label="Удалить из избранного"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive transition-colors" />
                      </button>

                      {/* Product image */}
                      <div className="aspect-square bg-muted overflow-hidden">
                        {product.images?.[0] ? (
                          <img
                            src={product.images[0]}
                            alt={product.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ShoppingBag className="h-10 w-10 text-muted-foreground/30" />
                          </div>
                        )}
                      </div>

                      {/* Product info */}
                      <div className="p-3">
                        {/* Name - 2 lines max */}
                        <h4 className="font-medium text-sm leading-snug text-foreground line-clamp-2 min-h-[2.5rem]">
                          {product.name}
                        </h4>

                        {/* Price */}
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div>
                            <p className="font-bold text-base text-foreground">
                              {formatPrice(product.price)}
                            </p>
                            {product.unit && (
                              <p className="text-xs text-muted-foreground">
                                / {product.unit}
                              </p>
                            )}
                          </div>

                          {/* Add to cart button */}
                          <button
                            onClick={() => onAddToCart(product)}
                            className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                              inCart
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted hover:bg-primary hover:text-primary-foreground"
                            )}
                          >
                            {inCart ? (
                              <span className="text-sm font-bold">
                                {getCartQuantity(product.id)}
                              </span>
                            ) : (
                              <Plus className="h-5 w-5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom action area */}
            <div className="border-t border-border bg-background px-5 pt-4 pb-6">
              <Button
                className="w-full h-14 text-base font-semibold rounded-2xl"
                onClick={() => onOpenChange(false)}
              >
                <ShoppingBag className="h-5 w-5 mr-2" />
                Продолжить покупки
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
