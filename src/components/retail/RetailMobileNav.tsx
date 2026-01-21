import { useState, useRef, useEffect } from "react";
import { Heart, Grid3X3, ShoppingCart, Search, X } from "lucide-react";
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
      // Small delay to ensure animation starts before focus
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isSearchOpen]);

  const handleSearchOpen = () => {
    setIsSearchOpen(true);
  };

  const handleSearchClose = () => {
    setIsSearchOpen(false);
    // Blur the input to hide keyboard
    inputRef.current?.blur();
  };

  const handleSearchChange = (value: string) => {
    setLocalQuery(value);
    onSearchChange?.(value);
  };

  const handleClearSearch = () => {
    setLocalQuery("");
    onSearchChange?.("");
    inputRef.current?.focus();
  };

  return (
    <>
      {/* Search overlay - appears above nav bar */}
      <div
        className={`
          lg:hidden fixed left-0 right-0 z-50 
          transition-all duration-300 ease-out
          ${isSearchOpen 
            ? "bottom-[calc(20px+env(safe-area-inset-bottom))] opacity-100 translate-y-0" 
            : "bottom-0 opacity-0 translate-y-4 pointer-events-none"
          }
        `}
      >
        <div className="mx-4 mb-3">
          {/* Elegant search container */}
          <div className="relative bg-card/95 backdrop-blur-xl rounded-2xl shadow-xl shadow-black/10 border border-border/50 overflow-hidden">
            {/* Subtle gradient accent at top */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
            
            <div className="flex items-center gap-3 p-3">
              {/* Search icon */}
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center">
                <Search className="h-5 w-5 text-muted-foreground" />
              </div>
              
              {/* Input field */}
              <div className="flex-1 relative">
                <Input
                  ref={inputRef}
                  type="text"
                  placeholder="Поиск товаров..."
                  value={localQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="
                    h-10 w-full bg-transparent border-0 
                    text-base text-foreground placeholder:text-muted-foreground/60
                    focus-visible:ring-0 focus-visible:ring-offset-0
                    pr-10
                  "
                  // Prevent viewport from jumping on iOS
                  onFocus={(e) => {
                    // Scroll into view smoothly
                    setTimeout(() => {
                      e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 300);
                  }}
                />
                
                {/* Clear button */}
                {localQuery && (
                  <button
                    onClick={handleClearSearch}
                    className="absolute right-0 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              
              {/* Close button */}
              <button
                onClick={handleSearchClose}
                className="flex-shrink-0 w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all active:scale-95"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Backdrop when search is open */}
      <div
        className={`
          lg:hidden fixed inset-0 z-40 bg-black/20 backdrop-blur-sm
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

          {/* Search - rightmost position */}
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
