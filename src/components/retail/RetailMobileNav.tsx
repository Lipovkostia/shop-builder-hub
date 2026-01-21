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
      <div className="relative flex items-center justify-around h-5 px-6">
        {/* Favorites */}
        <button
          onClick={onFavoritesClick}
          className="flex items-center justify-center w-6 h-5 transition-all active:scale-95"
        >
          <div className="relative">
            <Heart className="h-2.5 w-2.5 text-foreground/70" />
            {favoritesCount > 0 && (
              <Badge
                className="absolute -top-1 -right-1.5 h-2.5 min-w-2.5 flex items-center justify-center p-0 text-[6px] bg-primary text-primary-foreground border-0"
              >
                {favoritesCount > 99 ? "+" : favoritesCount}
              </Badge>
            )}
          </div>
        </button>

        {/* Categories - Center, emphasized */}
        <button
          onClick={onCategoriesClick}
          className="flex items-center justify-center -mt-1.5"
        >
          <div className="flex items-center justify-center w-5 h-5 rounded-lg bg-primary shadow-sm shadow-primary/25 transition-all active:scale-95">
            <Grid3X3 className="h-2.5 w-2.5 text-primary-foreground" />
          </div>
        </button>

        {/* Cart */}
        <button
          onClick={onCartClick}
          className="flex items-center justify-center w-6 h-5 transition-all active:scale-95"
        >
          <div className="relative">
            <ShoppingCart className="h-2.5 w-2.5 text-foreground/70" />
            {cartItemsCount > 0 && (
              <Badge
                className="absolute -top-1 -right-1.5 h-2.5 min-w-2.5 flex items-center justify-center p-0 text-[6px] bg-primary text-primary-foreground border-0"
              >
                {cartItemsCount > 99 ? "+" : cartItemsCount}
              </Badge>
            )}
          </div>
        </button>
      </div>
    </nav>
  );
}
