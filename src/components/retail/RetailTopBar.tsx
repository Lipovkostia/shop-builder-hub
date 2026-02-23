import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useNavigate, useParams } from "react-router-dom";
import { Search, User, LogOut, ShoppingBag, Settings, MapPin, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { RetailStore } from "@/hooks/useRetailStore";
import { DeliveryInfoBanner } from "./DeliveryInfoBanner";
import { CityPickerDialog } from "./CityPickerDialog";
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
  const { user, profile, signIn, signUp, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { subdomain } = useParams();
  const [deliveryExpanded, setDeliveryExpanded] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const [userCity, setUserCity] = useState<string>("");

  // Load city from localStorage
  useEffect(() => {
    const storageKey = `retail_city_${subdomain}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setUserCity(parsed.city || "");
      } catch {}
    }
  }, [subdomain]);

  const handleCitySelect = async (city: string, address: string) => {
    setUserCity(city);
    const storageKey = `retail_city_${subdomain}`;
    localStorage.setItem(storageKey, JSON.stringify({ city, address }));
    localStorage.setItem(`retail_address_${subdomain}`, address);

    // Auto-save to DB for logged-in users
    if (user) {
      try {
        const { data: prof } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_id", user.id)
          .single();
        if (prof) {
          const { data: existing } = await supabase
            .from("customer_addresses")
            .select("id")
            .eq("profile_id", prof.id);
          
          const alreadyExists = (existing || []).some(
            (a: any) => false // We'll just add it, the hook deduplicates
          );

          if ((existing || []).length < 5) {
            await supabase.from("customer_addresses").insert({
              profile_id: prof.id,
              address: address,
              city: city,
              is_default: (existing || []).length === 0,
            });
          }
        }
      } catch (e) {
        console.error("Auto-save address error:", e);
      }
    }
  };

  const logoUrl = store.retail_logo_url || store.logo_url;
  const storeName = store.retail_name || store.name;

  const formatWhatsAppPhone = (phone: string) => {
    return phone.replace(/[^\d]/g, "");
  };

  const handleAuth = async () => {
    setAuthLoading(true);
    try {
      if (authMode === "login") {
        const { error } = await signIn(authEmail, authPassword);
        if (error) {
          toast({ title: "Ошибка входа", description: error.message, variant: "destructive" });
          return;
        }
        toast({ title: "Вход выполнен" });
      } else {
        const { error } = await signUp(authEmail, authPassword, authName, "customer");
        if (error) {
          toast({ title: "Ошибка регистрации", description: error.message, variant: "destructive" });
          return;
        }
        toast({ title: "Регистрация успешна", description: "Проверьте email для подтверждения" });
      }
      setAuthOpen(false);
      setAuthEmail("");
      setAuthPassword("");
      setAuthName("");

      // Auto-register as store customer after login
      if (store.id) {
        setTimeout(async () => {
          try {
            const { data: profileData } = await supabase
              .from("profiles")
              .select("id")
              .eq("user_id", (await supabase.auth.getUser()).data.user?.id || "")
              .maybeSingle();

            if (profileData) {
              // Check if already a customer
              const { data: existing } = await supabase
                .from("store_customers")
                .select("id")
                .eq("store_id", store.id)
                .eq("profile_id", profileData.id)
                .maybeSingle();

              if (!existing) {
                await supabase.from("store_customers").insert({
                  store_id: store.id,
                  profile_id: profileData.id,
                });
              }
            }
          } catch (e) {
            console.error("Auto-register customer error:", e);
          }
        }, 1000);
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    toast({ title: "Вы вышли из аккаунта" });
  };

  return (
    <div className="sticky top-0 z-40">
      {/* Mobile contact bar */}
      {(store.retail_phone || store.telegram_username || store.whatsapp_phone || store.yandex_maps_api_key) && (
        <div className="flex md:hidden items-center justify-center gap-4 px-4 py-2.5 border-b border-border bg-muted/30">
          {store.yandex_maps_api_key && (
            <button
              onClick={() => setCityPickerOpen(true)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <MapPin className="h-3.5 w-3.5" />
              <span className="max-w-[80px] truncate">
                {userCity || "Город"}
              </span>
            </button>
          )}
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

      {/* Desktop top bar */}
      <div className="hidden lg:flex items-center gap-4 px-6 py-3 bg-card border-b border-border">
        {/* Logo */}
        <div className="flex-shrink-0">
          {logoUrl ? (
            <img src={logoUrl} alt={storeName} className="h-9 w-auto max-w-[140px] object-contain" />
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">
                  {storeName.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="font-semibold text-foreground text-base truncate max-w-[140px]">{storeName}</span>
            </div>
          )}
        </div>

        {/* Search - centered */}
        <div className="flex-1 flex justify-center">
          <div className="relative w-full max-w-2xl">
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

          {/* Right: favorites + messengers + auth */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Favorites */}
            <button
              onClick={onFavoritesClick}
              className="relative flex items-center justify-center w-9 h-9 rounded-full hover:bg-muted transition-colors"
              title="Избранное"
            >
              <Heart className={cn("h-5 w-5", favoritesCount > 0 ? "fill-red-500 text-red-500" : "text-muted-foreground")} />
              {favoritesCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {favoritesCount > 9 ? "9+" : favoritesCount}
                </span>
              )}
            </button>

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

          {/* Auth button */}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-xl gap-2 h-10 px-4">
                  <User className="h-4 w-4" />
                  <span className="max-w-[100px] truncate">{profile?.full_name || profile?.email || "Профиль"}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => navigate(`/retail/${subdomain}/account`)}>
                  <ShoppingBag className="h-4 w-4 mr-2" />
                  Мои заказы
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate(`/retail/${subdomain}/account`)}>
                  <Settings className="h-4 w-4 mr-2" />
                  Личный кабинет
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Выйти
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl gap-2 h-10 px-4"
              onClick={() => setAuthOpen(true)}
            >
              <User className="h-4 w-4" />
              <span>Войти</span>
            </Button>
          )}
        </div>
      </div>

      {/* Tablet top bar */}
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
        {user ? (
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-lg"
            onClick={() => navigate(`/retail/${subdomain}/account`)}
          >
            <User className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-lg"
            onClick={() => setAuthOpen(true)}
          >
            <User className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Delivery info */}
      <DeliveryInfoBanner
        isExpanded={deliveryExpanded}
        onToggle={() => setDeliveryExpanded(!deliveryExpanded)}
        nextDeliveryTime={store.retail_delivery_time}
        deliveryInfo={store.retail_delivery_info}
        deliveryFreeFrom={store.retail_delivery_free_from}
        deliveryRegion={store.retail_delivery_region}
      />

      {/* Auth Dialog */}
      <Dialog open={authOpen} onOpenChange={setAuthOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {authMode === "login" ? "Вход в аккаунт" : "Регистрация"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {authMode === "register" && (
              <div>
                <Label htmlFor="auth-name">Имя</Label>
                <Input
                  id="auth-name"
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                  placeholder="Ваше имя"
                />
              </div>
            )}
            <div>
              <Label htmlFor="auth-email">Email</Label>
              <Input
                id="auth-email"
                type="email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="email@example.com"
              />
            </div>
            <div>
              <Label htmlFor="auth-password">Пароль</Label>
              <Input
                id="auth-password"
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="••••••••"
                onKeyDown={(e) => e.key === "Enter" && handleAuth()}
              />
            </div>
            <Button
              onClick={handleAuth}
              disabled={authLoading || !authEmail || !authPassword}
              className="w-full"
            >
              {authLoading ? "Загрузка..." : authMode === "login" ? "Войти" : "Зарегистрироваться"}
            </Button>
            <div className="text-center text-sm text-muted-foreground">
              {authMode === "login" ? (
                <>
                  Нет аккаунта?{" "}
                  <button
                    onClick={() => setAuthMode("register")}
                    className="text-primary hover:underline"
                  >
                    Зарегистрируйтесь
                  </button>
                </>
              ) : (
                <>
                  Уже есть аккаунт?{" "}
                  <button
                    onClick={() => setAuthMode("login")}
                    className="text-primary hover:underline"
                  >
                    Войти
                  </button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* City Picker Dialog */}
      {store.yandex_maps_api_key && (
        <CityPickerDialog
          open={cityPickerOpen}
          onOpenChange={setCityPickerOpen}
          apiKey={store.yandex_maps_api_key}
          onCitySelect={handleCitySelect}
          currentCity={userCity}
        />
      )}
    </div>
  );
}
