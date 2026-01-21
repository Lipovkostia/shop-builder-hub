import { useState, useRef, useEffect } from "react";
import { Heart, ShoppingBag, Search, X, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface RetailMobileNavProps {
  cartItemsCount: number;
  favoritesCount: number;
  onCategoriesClick: () => void;
  onCartClick: () => void;
  onFavoritesClick: () => void;
  onPromotionsClick?: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function RetailMobileNav({
  cartItemsCount,
  favoritesCount,
  onCategoriesClick,
  onCartClick,
  onFavoritesClick,
  onPromotionsClick,
  searchQuery,
  onSearchChange,
}: RetailMobileNavProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync local query with parent
  useEffect(() => {
    setLocalQuery(searchQuery);
  }, [searchQuery]);

  // Focus input when search opens
  useEffect(() => {
    if (searchOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [searchOpen]);

  const handleSearchSubmit = () => {
    onSearchChange(localQuery);
    if (localQuery.trim()) {
      setSearchOpen(false);
    }
  };

  const handleClose = () => {
    setSearchOpen(false);
    setLocalQuery("");
    onSearchChange("");
  };

  return (
    <>
      {/* Search overlay - slides from top */}
      <div
        className={cn(
          "fixed inset-x-0 top-0 z-50 lg:hidden transition-transform duration-300 ease-out",
          searchOpen ? "translate-y-0" : "-translate-y-full"
        )}
      >
        {/* Search panel */}
        <div className="bg-background/95 backdrop-blur-xl border-b shadow-lg">
          <div className="px-4 py-4 safe-area-top">
            <div className="flex items-center gap-3">
              {/* Close button */}
              <button
                onClick={handleClose}
                className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-muted/80 text-foreground"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Search input */}
              <div className="flex-1 relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={localQuery}
                  onChange={(e) => setLocalQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSearchSubmit();
                    }
                  }}
                  placeholder="Поиск товаров..."
                  className="w-full h-12 pl-4 pr-12 rounded-2xl bg-muted/60 border-0 text-base placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {/* Search button */}
              <button
                onClick={handleSearchSubmit}
                className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-2xl bg-primary text-primary-foreground"
              >
                <Search className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/40 -z-10"
          onClick={handleClose}
        />
      </div>

      {/* Bottom navigation bar - highest z-index to stay on top */}
      <nav className="fixed bottom-0 inset-x-0 z-[100] lg:hidden">
        {/* Glass background */}
        <div className="bg-background/95 backdrop-blur-xl border-t shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
          {/* Ultra compact container */}
          <div className="h-14 px-4 flex items-center justify-around safe-area-bottom">
            {/* Promotions button */}
            <button
              onClick={onPromotionsClick}
              className="relative flex flex-col items-center justify-center gap-0.5 min-w-[48px]"
            >
              <Sparkles className="h-5 w-5 text-foreground" />
              <span className="text-[10px] text-muted-foreground">Акции</span>
            </button>

            {/* Favorites */}
            <button
              onClick={onFavoritesClick}
              className="relative flex flex-col items-center justify-center gap-0.5 min-w-[48px]"
            >
              <Heart className="h-5 w-5 text-foreground" />
              {favoritesCount > 0 && (
                <Badge className="absolute -top-1 left-1/2 ml-1 h-4 min-w-4 flex items-center justify-center p-0 text-[10px] bg-primary text-primary-foreground">
                  {favoritesCount > 99 ? "99+" : favoritesCount}
                </Badge>
              )}
              <span className="text-[10px] text-muted-foreground">Любимое</span>
            </button>

            {/* Catalog button - elevated center */}
            <button
              onClick={onCategoriesClick}
              className="relative flex flex-col items-center justify-center -mt-4"
            >
              <div className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-6 w-6"
                >
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                </svg>
              </div>
              <span className="text-[10px] text-muted-foreground mt-0.5">Каталог</span>
            </button>

            {/* Cart */}
            <button
              onClick={onCartClick}
              className="relative flex flex-col items-center justify-center gap-0.5 min-w-[48px]"
            >
              <ShoppingBag className="h-5 w-5 text-foreground" />
              {cartItemsCount > 0 && (
                <Badge className="absolute -top-1 left-1/2 ml-1 h-4 min-w-4 flex items-center justify-center p-0 text-[10px] bg-primary text-primary-foreground">
                  {cartItemsCount > 99 ? "99+" : cartItemsCount}
                </Badge>
              )}
              <span className="text-[10px] text-muted-foreground">Корзина</span>
            </button>

            {/* Search */}
            <button
              onClick={() => setSearchOpen(true)}
              className="relative flex flex-col items-center justify-center gap-0.5 min-w-[48px]"
            >
              <Search className="h-5 w-5 text-foreground" />
              <span className="text-[10px] text-muted-foreground">Поиск</span>
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}
