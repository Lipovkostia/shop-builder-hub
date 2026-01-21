import { useState, useRef, useEffect } from "react";
import { Heart, Grid3X3, ShoppingCart, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface RetailMobileNavProps {
  cartItemsCount: number;
  favoritesCount: number;
  onCategoriesClick: () => void;
  onCartClick: () => void;
  onFavoritesClick: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export function RetailMobileNav({
  cartItemsCount,
  favoritesCount,
  onCategoriesClick,
  onCartClick,
  onFavoritesClick,
  searchQuery = "",
  onSearchChange,
}: RetailMobileNavProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync with external search query
  useEffect(() => {
    setLocalQuery(searchQuery);
  }, [searchQuery]);

  // Focus input when search opens
  useEffect(() => {
    if (isSearchOpen && inputRef.current) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isSearchOpen]);

  const handleSearchOpen = () => {
    setIsSearchOpen(true);
  };

  const handleSearchClose = () => {
    setIsSearchOpen(false);
    inputRef.current?.blur();
  };

  const handleSearchSubmit = () => {
    onSearchChange?.(localQuery);
    handleSearchClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearchSubmit();
    }
    if (e.key === "Escape") {
      handleSearchClose();
    }
  };

  return (
    <>
      {/* Search panel - slides from top */}
      <div
        className={`
          lg:hidden fixed top-0 left-0 right-0 z-50
          transition-transform duration-300 ease-out
          ${isSearchOpen ? "translate-y-0" : "-translate-y-full"}
        `}
      >
        <div className="bg-background border-b border-border shadow-lg pt-safe">
          <div className="flex items-center gap-3 px-4 py-3">
            {/* Search input */}
            <div className="flex-1 relative">
              <Input
                ref={inputRef}
                type="text"
                placeholder="Поиск товаров..."
                value={localQuery}
                onChange={(e) => setLocalQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="
                  h-12 w-full pl-4 pr-12
                  bg-muted/50 border-border/50 rounded-xl
                  text-base text-foreground placeholder:text-muted-foreground
                  focus-visible:ring-2 focus-visible:ring-primary/50
                "
              />
            </div>

            {/* Search button */}
            <button
              onClick={handleSearchSubmit}
              className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-sm active:scale-95 transition-transform"
            >
              <Search className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Backdrop when search is open */}
      <div
        className={`
          lg:hidden fixed inset-0 z-40 bg-black/40
          transition-opacity duration-300
          ${isSearchOpen ? "opacity-100" : "opacity-0 pointer-events-none"}
        `}
        onClick={handleSearchClose}
      />

      {/* Navigation bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 pb-safe">
        {/* Frosted glass background */}
        <div className="absolute inset-0 bg-background/80 backdrop-blur-xl border-t border-border/50" />
        
        {/* Navigation items */}
        <div className="relative flex items-center justify-around h-5 px-6">
          {/* Favorites */}
          <button
            onClick={onFavoritesClick}
            className="flex items-center justify-center w-8 h-5 transition-all active:scale-95"
          >
            <div className="relative">
              <Heart className="h-5 w-5 text-foreground/70" />
              {favoritesCount > 0 && (
                <Badge
                  className="absolute -top-1.5 -right-2 h-3 min-w-3 flex items-center justify-center p-0 text-[7px] bg-primary text-primary-foreground border-0"
                >
                  {favoritesCount > 99 ? "+" : favoritesCount}
                </Badge>
              )}
            </div>
          </button>

          {/* Categories - Center, emphasized */}
          <button
            onClick={onCategoriesClick}
            className="flex items-center justify-center -mt-3"
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary shadow-sm shadow-primary/25 transition-all active:scale-95">
              <Grid3X3 className="h-5 w-5 text-primary-foreground" />
            </div>
          </button>

          {/* Cart */}
          <button
            onClick={onCartClick}
            className="flex items-center justify-center w-8 h-5 transition-all active:scale-95"
          >
            <div className="relative">
              <ShoppingCart className="h-5 w-5 text-foreground/70" />
              {cartItemsCount > 0 && (
                <Badge
                  className="absolute -top-1.5 -right-2 h-3 min-w-3 flex items-center justify-center p-0 text-[7px] bg-primary text-primary-foreground border-0"
                >
                  {cartItemsCount > 99 ? "+" : cartItemsCount}
                </Badge>
              )}
            </div>
          </button>

          {/* Search */}
          <button
            onClick={handleSearchOpen}
            className="flex items-center justify-center w-8 h-5 transition-all active:scale-95"
          >
            <Search className="h-5 w-5 text-foreground/70" />
          </button>
        </div>
      </nav>
    </>
  );
}
