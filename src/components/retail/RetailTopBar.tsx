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
    <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      {/* Main top bar */}
      <div className="border-b px-4 lg:px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Left side - Mobile menu + Phone */}
          <div className="flex items-center gap-3">
            {/* Mobile menu button */}
            {onMobileMenuClick && (
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={onMobileMenuClick}
              >
                <Menu className="h-5 w-5" />
              </Button>
            )}

            {/* Phone */}
            {store.contact_phone && (
              <a
                href={`tel:${store.contact_phone}`}
                className="hidden sm:flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
              >
                <Phone className="h-4 w-4" />
                <span>{store.contact_phone}</span>
              </a>
            )}
          </div>

          {/* Center - Delivery info (desktop) */}
          <button
            onClick={() => setDeliveryExpanded(!deliveryExpanded)}
            className="hidden md:flex items-center gap-2 px-4 py-1.5 rounded-full bg-muted/50 hover:bg-muted transition-colors"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[hsl(var(--delivery))] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[hsl(var(--delivery))]"></span>
            </span>
            <span className="text-sm font-medium">
              Ближайшая доставка в {nextDeliveryTime}
            </span>
          </button>

          {/* Right side - Icons */}
          <div className="flex items-center gap-1">
            {/* Search toggle (mobile) */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setSearchOpen(!searchOpen)}
            >
              {searchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
            </Button>

            {/* Desktop search */}
            <div className="hidden md:block relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Поиск товаров..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-9 h-9"
              />
            </div>

            {/* Favorites */}
            <Button variant="ghost" size="icon" className="hidden sm:flex">
              <Star className="h-5 w-5" />
            </Button>

            {/* Wishlist */}
            <Button variant="ghost" size="icon" className="hidden sm:flex">
              <Heart className="h-5 w-5" />
            </Button>

            {/* View mode toggle */}
            <div className="hidden sm:flex border rounded-lg ml-2">
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="icon"
                className="h-9 w-9 rounded-r-none"
                onClick={() => onViewModeChange("grid")}
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="icon"
                className="h-9 w-9 rounded-l-none"
                onClick={() => onViewModeChange("list")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>

            {/* Cart */}
            <Button
              variant="ghost"
              size="icon"
              className="relative ml-1"
              onClick={onCartClick}
            >
              <ShoppingCart className="h-5 w-5" />
              {cartItemsCount > 0 && (
                <Badge
                  className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-0 text-xs"
                >
                  {cartItemsCount > 99 ? "99+" : cartItemsCount}
                </Badge>
              )}
            </Button>
          </div>
        </div>

        {/* Mobile search bar */}
        {searchOpen && (
          <div className="md:hidden mt-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Поиск товаров..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-9 w-full"
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
