import { Heart, Grid3X3, ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";


interface RetailMobileNavProps {
  cartItemsCount: number;
  favoritesCount: number;
  onCategoriesClick: () => void;
  onCartClick: () => void;
  onFavoritesClick: () => void;
}

export function RetailMobileNav({
  cartItemsCount,
  favoritesCount,
  onCategoriesClick,
  onCartClick,
  onFavoritesClick,
}: RetailMobileNavProps) {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 pb-safe">
      {/* Frosted glass background */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-xl border-t border-border/50" />
      
      {/* Navigation items */}
      <div className="relative flex items-center justify-around h-16 px-6">
        {/* Favorites */}
        <button
          onClick={onFavoritesClick}
          className="flex flex-col items-center justify-center gap-0.5 w-16 h-14 rounded-xl transition-all active:scale-95"
        >
          <div className="relative">
            <Heart className="h-6 w-6 text-foreground/70" />
            {favoritesCount > 0 && (
              <Badge
                className="absolute -top-2 -right-2 h-4 min-w-4 flex items-center justify-center p-0 text-[10px] bg-primary text-primary-foreground border-0"
              >
                {favoritesCount > 99 ? "99+" : favoritesCount}
              </Badge>
            )}
          </div>
          <span className="text-[10px] font-medium text-foreground/60">Избранное</span>
        </button>

        {/* Categories - Center, emphasized */}
        <button
          onClick={onCategoriesClick}
          className="flex flex-col items-center justify-center gap-0.5 w-16 h-14 -mt-4"
        >
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-primary shadow-lg shadow-primary/25 transition-all active:scale-95">
            <Grid3X3 className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="text-[10px] font-medium text-foreground/60 mt-1">Каталог</span>
        </button>

        {/* Cart */}
        <button
          onClick={onCartClick}
          className="flex flex-col items-center justify-center gap-0.5 w-16 h-14 rounded-xl transition-all active:scale-95"
        >
          <div className="relative">
            <ShoppingCart className="h-6 w-6 text-foreground/70" />
            {cartItemsCount > 0 && (
              <Badge
                className="absolute -top-2 -right-2 h-4 min-w-4 flex items-center justify-center p-0 text-[10px] bg-primary text-primary-foreground border-0"
              >
                {cartItemsCount > 99 ? "99+" : cartItemsCount}
              </Badge>
            )}
          </div>
          <span className="text-[10px] font-medium text-foreground/60">Корзина</span>
        </button>
      </div>
    </nav>
  );
}
