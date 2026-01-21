import { useState } from "react";
import { Phone, Grid, List, Heart, ShoppingCart, Star, Search, X, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { RetailStore } from "@/hooks/useRetailStore";
import { DeliveryInfoBanner } from "./DeliveryInfoBanner";

type ViewMode = "grid" | "list";

interface RetailTopBarProps {
  store: RetailStore;
  cartItemsCount: number;
  onCartClick: () => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onMobileMenuClick?: () => void;
}

export function RetailTopBar({
  store,
  cartItemsCount,
  onCartClick,
  viewMode,
  onViewModeChange,
  searchQuery,
  onSearchChange,
  onMobileMenuClick,
}: RetailTopBarProps) {
  const [deliveryExpanded, setDeliveryExpanded] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Placeholder delivery time - can be from store settings later
  const nextDeliveryTime = "14:00";

  return (
    <div className="sticky top-0 z-40 bg-background">
      {/* Main top bar */}
      <div className="px-4 lg:px-8 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Left side - Phone (desktop only now, mobile menu moved to bottom nav) */}
          <div className="flex items-center gap-3">
            {/* Mobile menu button - desktop only */}
            {onMobileMenuClick && (
              <Button
                variant="ghost"
                size="icon"
                className="hidden lg:flex text-foreground"
                onClick={onMobileMenuClick}
              >
                <Menu className="h-5 w-5" />
              </Button>
            )}

            {/* Phone */}
            {store.contact_phone && (
              <a
                href={`tel:${store.contact_phone}`}
                className="hidden sm:flex items-center gap-2 text-base font-medium text-foreground hover:text-muted-foreground transition-colors"
              >
                <span>{store.contact_phone}</span>
              </a>
            )}
          </div>

          {/* Center - Delivery info (desktop) */}
          <button
            onClick={() => setDeliveryExpanded(!deliveryExpanded)}
            className="hidden md:flex items-center gap-2.5 text-sm font-medium text-foreground hover:text-muted-foreground transition-colors"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[hsl(var(--delivery))] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[hsl(var(--delivery))]"></span>
            </span>
            <span className="uppercase tracking-wide text-xs">
              Ближайшая доставка в {nextDeliveryTime}
            </span>
          </button>

          {/* Right side - Icons (desktop only for cart/search) */}
          <div className="flex items-center gap-0.5">
            {/* Search toggle - desktop only */}
            <Button
              variant="ghost"
              size="icon"
              className="hidden md:flex text-foreground hover:text-muted-foreground"
              onClick={() => setSearchOpen(!searchOpen)}
            >
              {searchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
            </Button>

            {/* Favorites - desktop only */}
            <Button variant="ghost" size="icon" className="hidden sm:flex text-foreground hover:text-muted-foreground">
              <Star className="h-5 w-5" />
            </Button>

            {/* Wishlist - desktop only */}
            <Button variant="ghost" size="icon" className="hidden sm:flex text-foreground hover:text-muted-foreground">
              <Heart className="h-5 w-5" />
            </Button>

            {/* View mode toggle - desktop only */}
            <div className="hidden sm:flex items-center gap-0.5 ml-2">
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-9 w-9",
                  viewMode === "grid" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => onViewModeChange("grid")}
              >
                <Grid className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-9 w-9",
                  viewMode === "list" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => onViewModeChange("list")}
              >
                <List className="h-5 w-5" />
              </Button>
            </div>

            {/* Cart - desktop only */}
            <Button
              variant="ghost"
              size="icon"
              className="relative ml-1 hidden lg:flex text-foreground hover:text-muted-foreground"
              onClick={onCartClick}
            >
              <ShoppingCart className="h-5 w-5" />
              {cartItemsCount > 0 && (
                <Badge
                  className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-0 text-xs bg-primary text-primary-foreground"
                >
                  {cartItemsCount > 99 ? "99+" : cartItemsCount}
                </Badge>
              )}
            </Button>
          </div>
        </div>

        {/* Desktop search bar */}
        {searchOpen && (
          <div className="hidden md:block mt-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Поиск товаров..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-9 w-full bg-muted border-0"
                autoFocus
              />
            </div>
          </div>
        )}
      </div>

      {/* Delivery info banner (expandable) */}
      <DeliveryInfoBanner
        isExpanded={deliveryExpanded}
        onToggle={() => setDeliveryExpanded(!deliveryExpanded)}
        nextDeliveryTime={nextDeliveryTime}
        deliveryInfo={store.description || "Информация о доставке будет добавлена в настройках магазина"}
      />
    </div>
  );
}
