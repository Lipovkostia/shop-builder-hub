import { useState } from "react";
import { Search, User, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RetailStore } from "@/hooks/useRetailStore";
import { DeliveryInfoBanner } from "./DeliveryInfoBanner";
import { TelegramIcon } from "@/components/icons/TelegramIcon";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";

interface RetailTopBarProps {
  store: RetailStore;
  cartItemsCount: number;
  onCartClick: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  favoritesCount?: number;
  onFavoritesClick?: () => void;
  cartIconRef?: React.RefObject<HTMLButtonElement>;
}

export function RetailTopBar({
  store,
  cartItemsCount,
  onCartClick,
  searchQuery,
  onSearchChange,
  favoritesCount = 0,
  onFavoritesClick,
  cartIconRef,
}: RetailTopBarProps) {
  const [deliveryExpanded, setDeliveryExpanded] = useState(false);

  const logoUrl = store.retail_logo_url || store.logo_url;
  const storeName = store.retail_name || store.name;

  // Helper to format phone for WhatsApp link
  const formatWhatsAppPhone = (phone: string) => {
    return phone.replace(/[^\d]/g, "");
  };

  return (
    <div className="sticky top-0 z-40 bg-background">
      {/* Mobile contact bar */}
      {(store.retail_phone || store.telegram_username || store.whatsapp_phone) && (
        <div className="flex md:hidden items-center justify-center gap-4 px-4 py-2.5 border-b border-border bg-muted/30">
          {store.telegram_username && (
            <a
              href={`https://t.me/${store.telegram_username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-8 h-8 rounded-full bg-[#229ED9]/10 hover:bg-[#229ED9]/20 transition-colors"
            >
              <TelegramIcon className="h-4 w-4 text-[#229ED9]" />
            </a>
          )}
          {store.retail_phone && (
            <a
              href={`tel:${store.retail_phone}`}
              className="text-sm font-medium text-foreground hover:text-muted-foreground transition-colors"
            >
              {store.retail_phone}
            </a>
          )}
          {store.whatsapp_phone && (
            <a
              href={`https://wa.me/${formatWhatsAppPhone(store.whatsapp_phone)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-8 h-8 rounded-full bg-[#25D366]/10 hover:bg-[#25D366]/20 transition-colors"
            >
              <WhatsAppIcon className="h-4 w-4 text-[#25D366]" />
            </a>
          )}
        </div>
      )}

      {/* Desktop top bar: Logo | Search | Login */}
      <div className="hidden lg:flex items-center gap-4 px-6 py-3 border-b border-border">
        {/* Logo placeholder */}
        <div className="flex-shrink-0 w-40">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={storeName}
              className="h-9 w-auto max-w-[140px] object-contain"
            />
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">
                  {storeName.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="font-semibold text-foreground text-base truncate">
                {storeName}
              </span>
            </div>
          )}
        </div>

        {/* Search bar - center, takes remaining space */}
        <div className="flex-1 max-w-2xl">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder={`Искать в ${storeName}`}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 h-10 bg-muted/50 border-border rounded-xl text-sm"
            />
          </div>
        </div>

        {/* Right side: Login + messenger */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Messenger icons */}
          {store.telegram_username && (
            <a
              href={`https://t.me/${store.telegram_username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-muted transition-colors"
            >
              <TelegramIcon className="h-4.5 w-4.5 text-muted-foreground" />
            </a>
          )}
          {store.whatsapp_phone && (
            <a
              href={`https://wa.me/${formatWhatsAppPhone(store.whatsapp_phone)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-muted transition-colors"
            >
              <WhatsAppIcon className="h-4.5 w-4.5 text-muted-foreground" />
            </a>
          )}

          {/* Login button */}
          <Button variant="outline" size="sm" className="rounded-xl gap-2 h-10 px-4">
            <User className="h-4 w-4" />
            <span>Войти</span>
          </Button>
        </div>
      </div>

      {/* Tablet top bar (md but not lg) */}
      <div className="hidden md:flex lg:hidden items-center gap-3 px-4 py-3 border-b border-border">
        <div className="flex-shrink-0">
          {logoUrl ? (
            <img src={logoUrl} alt={storeName} className="h-8 w-auto max-w-[100px] object-contain" />
          ) : (
            <span className="font-semibold text-foreground text-sm">{storeName}</span>
          )}
        </div>
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Поиск..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 h-9 bg-muted/50 border-border rounded-lg text-sm"
            />
          </div>
        </div>
        <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg" onClick={onCartClick}>
          <User className="h-4 w-4" />
        </Button>
      </div>

      {/* Delivery info banner */}
      <DeliveryInfoBanner
        isExpanded={deliveryExpanded}
        onToggle={() => setDeliveryExpanded(!deliveryExpanded)}
        nextDeliveryTime={store.retail_delivery_time}
        deliveryInfo={store.retail_delivery_info}
        deliveryFreeFrom={store.retail_delivery_free_from}
        deliveryRegion={store.retail_delivery_region}
      />
    </div>
  );
}
