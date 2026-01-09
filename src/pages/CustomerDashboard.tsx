import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useCustomerCatalogs, CartItem, CatalogProduct, CustomerCatalog } from "@/hooks/useCustomerCatalogs";
import { useCustomerOrders, useCustomerOrdersHistory, Order } from "@/hooks/useOrders";
import { useProfileSettings } from "@/hooks/useProfileSettings";
import { useCustomerAddresses } from "@/hooks/useCustomerAddresses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2, 
  LogOut, 
  Package,
  PackageOpen,
  Loader2,
  FolderOpen,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Filter,
  Image,
  User,
  Key,
  Store,
  ArrowLeft,
  Shield,
  Bell,
  MapPin,
  ChevronDown,
  Check,
  Settings,
  ChevronLeft,
  ChevronRight,
  X
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Форматирование цены с пробелом
function formatPriceSpaced(price: number): string {
  return Math.round(price).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

// Форматирование цены с символом рубля
function formatPrice(price: number): string {
  return `${formatPriceSpaced(price)} ₽`;
}

// Индикатор порции (SVG для чёткости)
function PortionIndicator({ type }: { type: "full" | "half" | "quarter" | "portion" }) {
  const size = 14;
  const r = 5;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
      {/* Фоновый круг */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary" />
      
      {type === "full" && (
        <circle cx={cx} cy={cy} r={r} className="fill-primary" />
      )}
      
      {type === "half" && (
        <path 
          d={`M ${cx} ${cy - r} A ${r} ${r} 0 0 0 ${cx} ${cy + r} Z`}
          className="fill-primary"
        />
      )}
      
      {type === "quarter" && (
        <path 
          d={`M ${cx} ${cy} L ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${cx + r} ${cy} Z`}
          className="fill-primary"
        />
      )}
      
      {type === "portion" && (
        <circle cx={cx} cy={cy} r={2} className="fill-primary" />
      )}
    </svg>
  );
}

interface LocalCartItem {
  productId: string;
  variantIndex: number;
  quantity: number;
  price: number;
  // For repeat order items
  originalProductName?: string;
  isAvailable?: boolean;
}

// Карточка товара в стиле TestStore
function ProductCard({ 
  product, 
  cart, 
  onAddToCart,
  showImages = true,
  isExpanded = false,
  onImageClick,
  onOpenFullscreen,
  isDescriptionExpanded = false,
  onNameClick
}: { 
  product: CatalogProduct;
  cart: LocalCartItem[];
  onAddToCart: (productId: string, variantIndex: number, price: number) => void;
  showImages?: boolean;
  isExpanded?: boolean;
  onImageClick?: () => void;
  onOpenFullscreen?: (imageIndex: number) => void;
  isDescriptionExpanded?: boolean;
  onNameClick?: () => void;
}) {
  const getCartQuantity = (variantIndex: number) => {
    const item = cart.find(
      (c) => c.productId === product.id && c.variantIndex === variantIndex
    );
    return item?.quantity || 0;
  };

  const basePrice = product.price;
  const unitWeight = product.unit_weight || 1;
  
  // Расчёт цен - приоритет каталоговым ценам
  const catalogPrices = product.catalog_portion_prices;
  
  // Проверяем есть ли установленные цены для вариантов (из каталога или из товара)
  const hasHalfPrice = catalogPrices?.half != null || product.price_half != null;
  const hasQuarterPrice = catalogPrices?.quarter != null || product.price_quarter != null;
  const hasPortionPrice = catalogPrices?.portion != null || product.price_portion != null;
  
  // Показываем кнопки вариантов если есть хотя бы одна цена варианта
  const hasAnyVariantPrice = hasHalfPrice || hasQuarterPrice || hasPortionPrice;
  const hasVariantPrices = hasAnyVariantPrice;
  const isHead = product.packaging_type === 'head';
  
  // Кнопка "целый" показывается если есть хотя бы одна цена варианта ИЛИ если явно задана fullPrice
  const hasFullPrice = catalogPrices?.full != null || product.price_full != null || hasAnyVariantPrice;
  
  // Расчёт цен для вариантов
  // Логика аналогична calculatePackagingPrices из seller: цена за кг * вес порции
  // catalogPrices.half/quarter - это цена за кг, а не итоговая цена!
  const fullPricePerKg = catalogPrices?.full || product.price_full || basePrice;
  const halfPricePerKg = catalogPrices?.half || product.price_half || basePrice;
  const quarterPricePerKg = catalogPrices?.quarter || product.price_quarter || basePrice;
  const portionPrice = catalogPrices?.portion || product.price_portion || null;
  
  // Итоговые цены = цена за кг * вес порции
  const fullPrice = fullPricePerKg * unitWeight;
  const halfPrice = halfPricePerKg * (unitWeight / 2);
  const quarterPrice = quarterPricePerKg * (unitWeight / 4);

  // Use catalog_status if available, otherwise fall back to quantity check
  const inStock = product.catalog_status 
    ? product.catalog_status === 'in_stock' 
    : product.quantity > 0;
  const image = product.images?.[0] || "";

  return (
    <>
      {/* Основная карточка - высота адаптируется при раскрытии описания */}
      <div className={`flex gap-1.5 px-1.5 py-0.5 bg-background border-b border-border transition-all ${showImages ? (isDescriptionExpanded ? 'min-h-[72px]' : 'h-[calc((100vh-44px)/8)] min-h-[72px]') : 'h-9 min-h-[36px]'}`}>
        {/* Изображение */}
        {showImages && (
          <button 
            onClick={onImageClick}
            className="relative w-14 h-14 flex-shrink-0 rounded overflow-hidden bg-muted self-center cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
          >
            {image ? (
              <img
                src={image}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-6 h-6 text-muted-foreground" />
              </div>
            )}
            {/* Индикатор количества фото */}
            {(product.images?.length || 0) > 1 && (
              <div className="absolute bottom-0.5 right-0.5 bg-black/60 text-white text-[8px] px-1 rounded">
                {product.images?.length}
              </div>
            )}
          </button>
        )}

        {/* Контент справа */}
        <div className={`flex-1 min-w-0 flex ${showImages ? 'flex-col justify-center gap-0' : 'flex-row items-center gap-2'}`}>
          {/* Название */}
          <button 
            onClick={onNameClick}
            className={`relative overflow-hidden text-left ${showImages ? '' : 'flex-1 min-w-0'} ${product.description ? 'cursor-pointer hover:text-primary transition-colors' : ''}`}
          >
            <h3 className={`font-medium text-foreground leading-tight whitespace-nowrap ${showImages ? 'text-xs pr-6' : 'text-[11px]'} ${isDescriptionExpanded ? 'text-primary' : ''}`}>
              {product.name}
            </h3>
            {showImages && <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-background to-transparent pointer-events-none" />}
          </button>
          
          {/* Описание (раскрывается при клике на название) */}
          <Collapsible open={isDescriptionExpanded}>
            <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
              {product.description && (
                <p className="text-[10px] text-muted-foreground leading-relaxed py-1 pr-2">
                  {product.description}
                </p>
              )}
            </CollapsibleContent>
          </Collapsible>

          <p className={`text-muted-foreground leading-tight ${showImages ? 'text-[10px]' : 'text-[9px] whitespace-nowrap'}`}>
            {formatPrice(basePrice)}/{product.unit}
            {showImages && hasVariantPrices && isHead && unitWeight > 0 && (
              <span className="ml-1">
                · головка ~{formatPrice(fullPrice)}
              </span>
            )}
          </p>

          {/* Кнопки */}
          <div className={`flex items-center gap-0.5 flex-wrap ${showImages ? 'mt-0.5' : ''}`}>
            {inStock ? (
              <>
                {/* Кнопки вариантов в порядке: порция, 1/4, 1/2, целая */}
                {hasPortionPrice && portionPrice && (() => {
                  const qty = getCartQuantity(3);
                  return (
                    <button
                      onClick={() => onAddToCart(product.id, 3, portionPrice)}
                      className="relative flex items-center gap-1 h-7 px-2 rounded border border-border hover:border-primary hover:bg-primary/5 transition-all"
                    >
                      {qty > 0 && (
                        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center">
                          {qty}
                        </span>
                      )}
                      <PortionIndicator type="portion" />
                      <span className="text-[9px] font-medium text-foreground">
                        {formatPriceSpaced(portionPrice)}
                      </span>
                    </button>
                  );
                })()}
                {hasQuarterPrice && (() => {
                  const qty = getCartQuantity(2);
                  return (
                    <button
                      onClick={() => onAddToCart(product.id, 2, quarterPrice)}
                      className="relative flex items-center gap-1 h-7 px-2 rounded border border-border hover:border-primary hover:bg-primary/5 transition-all"
                    >
                      {qty > 0 && (
                        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center">
                          {qty}
                        </span>
                      )}
                      <PortionIndicator type="quarter" />
                      <span className="text-[9px] font-medium text-foreground">
                        {formatPriceSpaced(quarterPrice)}
                      </span>
                    </button>
                  );
                })()}
                {hasHalfPrice && (() => {
                  const qty = getCartQuantity(1);
                  return (
                    <button
                      onClick={() => onAddToCart(product.id, 1, halfPrice)}
                      className="relative flex items-center gap-1 h-7 px-2 rounded border border-border hover:border-primary hover:bg-primary/5 transition-all"
                    >
                      {qty > 0 && (
                        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center">
                          {qty}
                        </span>
                      )}
                      <PortionIndicator type="half" />
                      <span className="text-[9px] font-medium text-foreground">
                        {formatPriceSpaced(halfPrice)}
                      </span>
                    </button>
                  );
                })()}
                {hasFullPrice && (() => {
                  const qty = getCartQuantity(0);
                  return (
                    <button
                      onClick={() => onAddToCart(product.id, 0, fullPrice)}
                      className="relative flex items-center gap-1 h-7 px-2 rounded border border-border hover:border-primary hover:bg-primary/5 transition-all"
                    >
                      {qty > 0 && (
                        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center">
                          {qty}
                        </span>
                      )}
                      <PortionIndicator type="full" />
                      <span className="text-[9px] font-medium text-foreground">
                        {formatPriceSpaced(fullPrice)}
                      </span>
                    </button>
                  );
                })()}
                {/* Обычная кнопка - показываем только если нет ни одной цены варианта */}
                {!hasVariantPrices && (() => {
                  const qty = getCartQuantity(0);
                  return (
                    <button
                      onClick={() => onAddToCart(product.id, 0, basePrice)}
                      className="relative flex items-center gap-1 h-7 px-2 rounded border border-border hover:border-primary hover:bg-primary/5 transition-all"
                    >
                      {qty > 0 && (
                        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center">
                          {qty}
                        </span>
                      )}
                      <Plus className="w-3 h-3 text-primary" />
                      <span className="text-[9px] font-medium text-foreground">
                        {formatPriceSpaced(basePrice)}
                      </span>
                    </button>
                  );
                })()}
              </>
            ) : (
              <span className="text-[10px] text-muted-foreground">Нет в наличии</span>
            )}
          </div>
        </div>
      </div>
      
      {/* Галерея ВНЕ карточки — сдвигает нижние элементы */}
      <Collapsible open={isExpanded}>
        <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
          {(product.images?.length || 0) > 0 && (
            <div className="overflow-x-auto bg-muted/30 border-b border-border">
              <div className="flex gap-2 p-2">
              {product.images?.map((img, idx) => (
                  <button 
                    key={idx}
                    onClick={() => onOpenFullscreen?.(idx)}
                    className="w-32 h-32 flex-shrink-0 rounded overflow-hidden bg-muted cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                  >
                    <img
                      src={img}
                      alt={`${product.name} ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </>
  );
}

// Шапка магазина
function CustomerHeader({ 
  cart, 
  catalogs, 
  selectedCatalog, 
  onSelectCatalog,
  showImages,
  onToggleImages,
  onOpenCart,
  onOpenProfile,
  onOpenOrders,
  categories,
  selectedCategory,
  onSelectCategory
}: { 
  cart: LocalCartItem[];
  catalogs: CustomerCatalog[];
  selectedCatalog: CustomerCatalog | null;
  onSelectCatalog: (catalog: CustomerCatalog | null) => void;
  showImages: boolean;
  onToggleImages: () => void;
  onOpenCart: () => void;
  onOpenProfile: () => void;
  onOpenOrders: () => void;
  categories: string[];
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
}) {
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <header className="sticky top-0 z-50 bg-background border-b border-border">
      <div className="h-12 flex items-center justify-between px-3 relative">
        <button 
          onClick={onOpenCart}
          className="relative flex items-center gap-1.5 bg-primary/10 hover:bg-primary/20 transition-colors rounded-full py-1.5 px-3"
        >
          <ShoppingCart className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">{formatPrice(totalPrice)}</span>
          {totalItems > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
              {totalItems}
            </span>
          )}
        </button>

        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          <button
            onClick={onOpenOrders}
            className="p-1.5 bg-muted hover:bg-muted/80 transition-colors rounded-full"
            title="Мои заказы"
          >
            <PackageOpen className="w-4 h-4 text-muted-foreground" />
          </button>
          <button
            onClick={onOpenProfile}
            className="p-1.5 bg-muted hover:bg-muted/80 transition-colors rounded-full"
            title="Профиль"
          >
            <User className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Панель управления с иконками */}
      <div className="h-10 flex items-center justify-between px-3 border-t border-border bg-muted/30">
        <div className="flex items-center gap-1">
          {/* Селектор прайс-листа */}
          <DropdownMenu>
            <DropdownMenuTrigger className="p-2 rounded hover:bg-muted transition-colors">
              <FolderOpen className="w-4 h-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[200px] bg-popover z-50">
              {catalogs.map((catalog) => (
                <DropdownMenuItem
                  key={catalog.id}
                  onClick={() => onSelectCatalog(catalog)}
                  className="cursor-pointer"
                >
                  <div className="flex flex-col">
                    <span className={selectedCatalog?.id === catalog.id ? "font-semibold" : ""}>
                      {catalog.store_name}
                    </span>
                    <span className="text-xs text-muted-foreground">{catalog.catalog_name}</span>
                  </div>
                </DropdownMenuItem>
              ))}
              {catalogs.length === 0 && (
                <DropdownMenuItem disabled>
                  <span className="text-muted-foreground">Нет прайс-листов</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Фильтр по категориям */}
          <DropdownMenu>
            <DropdownMenuTrigger className={`p-2 rounded transition-colors ${selectedCategory ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground'}`}>
              <Filter className="w-4 h-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[160px] bg-popover z-50">
              <DropdownMenuItem
                onClick={() => onSelectCategory(null)}
                className="cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  {!selectedCategory && <Check className="w-4 h-4 text-primary" />}
                  <span className={!selectedCategory ? "font-semibold" : ""}>Все категории</span>
                </div>
              </DropdownMenuItem>
              {categories.map((category) => (
                <DropdownMenuItem
                  key={category}
                  onClick={() => onSelectCategory(category)}
                  className="cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    {selectedCategory === category && <Check className="w-4 h-4 text-primary" />}
                    <span className={selectedCategory === category ? "font-semibold" : ""}>
                      {category}
                    </span>
                  </div>
                </DropdownMenuItem>
              ))}
              {categories.length === 0 && (
                <DropdownMenuItem disabled>
                  <span className="text-muted-foreground">Нет категорий</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Переключатель изображений */}
          <button 
            onClick={onToggleImages}
            className={`p-2 rounded transition-colors ${showImages ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground'}`}
          >
            <Image className="w-4 h-4" />
          </button>
        </div>

        {/* Название выбранного каталога */}
        <span className="text-xs text-muted-foreground truncate max-w-[150px]">
          {selectedCatalog ? `${selectedCatalog.store_name} — ${selectedCatalog.catalog_name}` : "Выберите прайс-лист"}
        </span>
      </div>
    </header>
  );
}

const CustomerDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, signOut, loading: authLoading, isSuperAdmin } = useAuth();
  
  // Check for impersonation mode
  const impersonateUserId = localStorage.getItem('impersonate_customer_id');
  const isImpersonating = !!impersonateUserId && isSuperAdmin;
  
  // Use impersonated user ID if super admin is impersonating
  const targetUserId = isImpersonating ? impersonateUserId : undefined;
  
  const { 
    catalogs, 
    loading: catalogsLoading, 
    currentCatalog, 
    setCurrentCatalog,
    products,
    productsLoading,
    addCatalogByCode,
    refetch: refetchCatalogs
  } = useCustomerCatalogs(targetUserId);
  const { createOrder, loading: orderLoading } = useCustomerOrders();
  const { orders: myOrders, loading: myOrdersLoading, refetch: refetchMyOrders } = useCustomerOrdersHistory();
  const { toastEnabled, updateSettings, isUpdating: updatingSettings } = useProfileSettings();
  const { addresses, addAddress, lastUsedAddress, deleteAddress } = useCustomerAddresses();
  const [cart, setCart] = useState<LocalCartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isOrdersOpen, setIsOrdersOpen] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [showProfileView, setShowProfileView] = useState(false);
  const [profileSection, setProfileSection] = useState<'personal' | 'catalogs' | 'settings'>('personal');
  const [showImages, setShowImages] = useState(true);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [expandedDescriptionId, setExpandedDescriptionId] = useState<string | null>(null);
  const [fullscreenImages, setFullscreenImages] = useState<{ images: string[]; index: number } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  // Extract unique categories from products
  const availableCategories = [...new Set(
    products
      .flatMap(p => p.catalog_categories || [])
      .filter(Boolean)
  )].sort();
  
  // Profile data
  const [profileData, setProfileData] = useState<{ full_name: string | null; phone: string | null } | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  
  // Add catalog by link
  const [catalogLinkInput, setCatalogLinkInput] = useState("");
  const [addingCatalog, setAddingCatalog] = useState(false);
  
  // Checkout form
  const [checkoutName, setCheckoutName] = useState("");
  const [checkoutPhone, setCheckoutPhone] = useState("");
  const [checkoutAddress, setCheckoutAddress] = useState("");
  const [checkoutComment, setCheckoutComment] = useState("");
  const [showAddressDropdown, setShowAddressDropdown] = useState(false);

  // Fetch profile data
  const fetchProfileData = async () => {
    const userId = targetUserId || user?.id;
    if (!userId) return;
    setProfileLoading(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, phone')
        .eq('user_id', userId)
        .single();
      setProfileData(data);
      setEditName(data?.full_name || "");
      setEditPhone(data?.phone || "");
    } catch (e) {
      console.error('Error fetching profile:', e);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleOpenProfile = () => {
    setShowProfileView(true);
    fetchProfileData();
  };

  const handleCloseProfile = () => {
    setShowProfileView(false);
  };

  const handleSaveProfile = async () => {
    const userId = targetUserId || user?.id;
    if (!userId) return;
    
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          full_name: editName.trim() || null, 
          phone: editPhone.trim() || null 
        })
        .eq('user_id', userId);
      
      if (error) throw error;
      
      setProfileData({ full_name: editName.trim() || null, phone: editPhone.trim() || null });
      toast({ title: "Сохранено", description: "Данные профиля обновлены" });
    } catch (e: any) {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast({ title: "Ошибка", description: "Пароль должен быть минимум 6 символов", variant: "destructive" });
      return;
    }
    setPasswordLoading(true);
    // Note: Password change only works for actual logged-in user, not impersonated
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordLoading(false);
    if (error) {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Успешно", description: "Пароль изменён" });
      setNewPassword("");
    }
  };

  const handleAddCatalogByLink = async () => {
    if (!catalogLinkInput.trim()) {
      toast({ title: "Ошибка", description: "Вставьте ссылку на прайс-лист", variant: "destructive" });
      return;
    }
    
    setAddingCatalog(true);
    
    // Extract access code from link - could be full URL or just code
    let accessCode = catalogLinkInput.trim();
    
    // Try to extract code from URL like /catalog-access/CODE or ?code=CODE
    const urlMatch = accessCode.match(/catalog-access\/([a-zA-Z0-9]+)/);
    if (urlMatch) {
      accessCode = urlMatch[1];
    } else {
      const codeMatch = accessCode.match(/[?&]code=([a-zA-Z0-9]+)/);
      if (codeMatch) {
        accessCode = codeMatch[1];
      }
    }
    
    const result = await addCatalogByCode(accessCode);
    setAddingCatalog(false);
    
    if (result.success) {
      setCatalogLinkInput("");
    }
  };

  const handleExitImpersonation = () => {
    localStorage.removeItem('impersonate_customer_id');
    navigate('/super-admin');
  };

  // Redirect if not authenticated (unless impersonating)
  useEffect(() => {
    if (!authLoading && !user && !isImpersonating) {
      navigate("/customer-auth");
    }
  }, [user, authLoading, navigate, isImpersonating]);

  // Fetch profile data on mount for checkout auto-fill
  useEffect(() => {
    const userId = targetUserId || user?.id;
    if (userId && !profileData) {
      fetchProfileData();
    }
  }, [user, targetUserId]);

  const getProductById = (productId: string) => products.find(p => p.id === productId);

  const getVariantLabel = (product: CatalogProduct, variantIndex: number): string => {
    const isHead = product.packaging_type === 'head';
    if (isHead) {
      switch (variantIndex) {
        case 0: return 'Целая';
        case 1: return '½';
        case 2: return '¼';
        case 3: return 'Порция';
        default: return 'Целая';
      }
    }
    // Для штучных товаров не показываем бейдж
    return '';
  };

  // Рассчитать объём/вес товара в корзине
  const getItemVolume = (product: CatalogProduct | undefined, variantIndex: number, quantity: number): string => {
    if (!product) return '';
    
    const isHead = product.packaging_type === 'head';
    const unitWeight = product.unit_weight || 1;
    const portionWeight = product.portion_weight || 0.1;
    
    if (isHead && unitWeight > 0) {
      // Для весовых товаров (головы) с указанным весом показываем вес в кг
      let weightPerItem: number;
      switch (variantIndex) {
        case 0: weightPerItem = unitWeight; break;
        case 1: weightPerItem = unitWeight / 2; break;
        case 2: weightPerItem = unitWeight / 4; break;
        case 3: weightPerItem = portionWeight; break;
        default: weightPerItem = unitWeight;
      }
      const totalWeight = weightPerItem * quantity;
      // Форматируем вес
      if (totalWeight >= 1) {
        return `≈ ${totalWeight.toFixed(1).replace('.0', '')} кг`;
      } else {
        return `≈ ${Math.round(totalWeight * 1000)} г`;
      }
    } else {
      // Для штучных товаров или head без указанного веса показываем количество
      const unit = product.unit === 'kg' ? 'кг' : 'шт';
      return `${quantity} ${unit}`;
    }
  };

  const handleAddToCart = (productId: string, variantIndex: number, price: number) => {
    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.productId === productId && item.variantIndex === variantIndex
      );
      
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex].quantity += 1;
        return updated;
      }
      
      return [...prev, { productId, variantIndex, quantity: 1, price }];
    });

    const product = getProductById(productId);
    if (product) {
      toast({
        title: "Добавлено в корзину",
        description: product.name,
      });
    }
  };

  const updateCartQuantity = (index: number, delta: number) => {
    setCart(prev => {
      const updated = [...prev];
      updated[index].quantity += delta;
      if (updated[index].quantity <= 0) {
        return updated.filter((_, i) => i !== index);
      }
      return updated;
    });
  };

  const removeFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  // Calculate cart total only for available items
  const cartTotal = cart
    .filter(item => item.isAvailable !== false)
    .reduce((sum, item) => sum + item.price * item.quantity, 0);
  
  const availableItemsCount = cart.filter(item => item.isAvailable !== false).length;
  const unavailableItemsCount = cart.filter(item => item.isAvailable === false).length;

  const [orderSuccess, setOrderSuccess] = useState(false);

  const handleCheckout = async () => {
    if (!currentCatalog || cart.length === 0) return;

    const items = cart.map(item => {
      const product = getProductById(item.productId);
      return {
        productId: item.productId,
        productName: product ? product.name + (getVariantLabel(product, item.variantIndex) ? ` (${getVariantLabel(product, item.variantIndex)})` : '') : 'Товар',
        quantity: item.quantity,
        price: item.price,
      };
    });

    const orderId = await createOrder({
      storeId: currentCatalog.store_id,
      items,
      shippingAddress: {
        name: checkoutName,
        phone: checkoutPhone,
        address: checkoutAddress,
        comment: checkoutComment || undefined,
      },
    });

    if (orderId) {
      // Save address for future use
      if (checkoutAddress.trim()) {
        await addAddress(checkoutAddress);
      }
      
      setCart([]);
      setIsCheckoutOpen(false);
      setIsCartOpen(false);
      setCheckoutName("");
      setCheckoutPhone("");
      setCheckoutAddress("");
      setCheckoutComment("");
      
      // Show success message for 1 second then redirect to catalog
      setOrderSuccess(true);
      setTimeout(() => {
        setOrderSuccess(false);
      }, 1000);
    }
  };

  // Repeat order function - adds all items from order to cart with availability check
  const handleRepeatOrder = (order: Order) => {
    if (!order.items || order.items.length === 0) return;

    const newCartItems: LocalCartItem[] = [];
    let availableCount = 0;
    let unavailableCount = 0;

    order.items.forEach(item => {
      // Try to find the product in current catalog
      const product = item.product_id ? getProductById(item.product_id) : null;
      const isAvailable = !!product;
      
      if (isAvailable) {
        availableCount++;
      } else {
        unavailableCount++;
      }

      // Parse variant from product name (e.g., "Сыр (½)" -> variantIndex 1)
      let variantIndex = 0;
      const variantMatch = item.product_name.match(/\((Целая|½|¼|Порция)\)$/);
      if (variantMatch) {
        switch (variantMatch[1]) {
          case 'Целая': variantIndex = 0; break;
          case '½': variantIndex = 1; break;
          case '¼': variantIndex = 2; break;
          case 'Порция': variantIndex = 3; break;
        }
      }

      // Get current price from product or use order item price
      let price = item.price;
      if (product) {
        const isHead = product.packaging_type === 'head' && (product.unit_weight || 0) > 0;
        if (isHead) {
          const catalogPrices = product.catalog_portion_prices;
          switch (variantIndex) {
            case 0: price = catalogPrices?.full || product.price_full || product.price * (product.unit_weight || 1); break;
            case 1: price = catalogPrices?.half || product.price_half || product.price * ((product.unit_weight || 1) / 2); break;
            case 2: price = catalogPrices?.quarter || product.price_quarter || product.price * ((product.unit_weight || 1) / 4); break;
            case 3: price = catalogPrices?.portion || product.price_portion || item.price; break;
          }
        } else {
          price = product.price;
        }
      }

      newCartItems.push({
        productId: item.product_id || `unavailable-${item.id}`,
        variantIndex,
        quantity: item.quantity,
        price,
        originalProductName: item.product_name,
        isAvailable,
      });
    });

    setCart(newCartItems);
    setIsOrdersOpen(false);
    setIsCartOpen(true);

    if (unavailableCount > 0) {
      toast({
        title: "Заказ добавлен в корзину",
        description: `${availableCount} товаров доступно, ${unavailableCount} нет в наличии`,
        variant: unavailableCount > availableCount ? "destructive" : "default",
      });
    } else {
      toast({
        title: "Заказ добавлен в корзину",
        description: `Все ${availableCount} товаров доступны`,
      });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  if (authLoading || catalogsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show profile view if open
  if (showProfileView) {
    return (
      <div className="h-screen bg-background flex flex-col">
        {isImpersonating && (
          <div className="bg-amber-500 text-amber-950 px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Shield className="w-4 h-4" />
              <span>Режим просмотра от имени покупателя</span>
            </div>
            <Button size="sm" variant="secondary" onClick={handleExitImpersonation} className="h-7 gap-1">
              <ArrowLeft className="w-3 h-3" />
              Назад
            </Button>
          </div>
        )}
        {/* Profile Header - inline */}
        <header className="sticky top-0 z-50 bg-background border-b border-border">
          <div className="h-12 flex items-center px-3 gap-3">
            <button
              onClick={handleCloseProfile}
              className="p-1.5 bg-muted hover:bg-muted/80 transition-colors rounded-full"
            >
              <ArrowLeft className="w-4 h-4 text-muted-foreground" />
            </button>
            <span className="font-semibold">Профиль</span>
          </div>
        </header>
        {/* Profile View - inline */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Profile tabs */}
          <div className="flex border-b border-border bg-muted/30">
            <button
              onClick={() => setProfileSection('personal')}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors relative ${
                profileSection === 'personal' 
                  ? 'text-primary' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className="flex items-center justify-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                <span>Личные данные</span>
              </div>
              {profileSection === 'personal' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
            <button
              onClick={() => setProfileSection('catalogs')}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors relative ${
                profileSection === 'catalogs' 
                  ? 'text-primary' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className="flex items-center justify-center gap-1.5">
                <Store className="w-3.5 h-3.5" />
                <span>Прайс-листы</span>
              </div>
              {profileSection === 'catalogs' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
            <button
              onClick={() => setProfileSection('settings')}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors relative ${
                profileSection === 'settings' 
                  ? 'text-primary' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className="flex items-center justify-center gap-1.5">
                <Settings className="w-3.5 h-3.5" />
                <span>Настройки</span>
              </div>
              {profileSection === 'settings' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
          </div>

          {/* Profile content */}
          <div className="flex-1 overflow-auto p-4">
            {profileLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <>
                {/* Личные данные */}
                {profileSection === 'personal' && (
                  <div className="space-y-4 animate-in fade-in duration-150">
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="edit-name" className="text-xs text-muted-foreground">Имя</Label>
                        <Input
                          id="edit-name"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Ваше имя"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="edit-phone" className="text-xs text-muted-foreground">Телефон</Label>
                        <Input
                          id="edit-phone"
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                          placeholder="+7 (999) 123-45-67"
                        />
                      </div>
                      <Button 
                        onClick={handleSaveProfile} 
                        disabled={savingProfile}
                        className="w-full"
                      >
                        {savingProfile ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Сохранить изменения
                      </Button>
                    </div>

                    {/* Адреса доставки */}
                    <div className="space-y-3 pt-4 border-t border-border">
                      <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        Адреса доставки
                      </h3>
                      {addresses.length > 0 ? (
                        <div className="space-y-2">
                          {addresses.map((addr) => (
                            <div key={addr.id} className="flex items-start gap-2 p-2.5 bg-muted/50 rounded-lg group">
                              <MapPin className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm leading-tight">{addr.address}</p>
                                {addr.label && (
                                  <p className="text-xs text-muted-foreground mt-0.5">{addr.label}</p>
                                )}
                              </div>
                              <button
                                onClick={() => deleteAddress(addr.id)}
                                className="p-1 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 rounded transition-all"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">Адреса сохраняются автоматически при оформлении заказа</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Прайс-листы */}
                {profileSection === 'catalogs' && (
                  <div className="space-y-4 animate-in fade-in duration-150">
                    {/* Добавить прайс-лист */}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Добавить новый прайс-лист</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Вставьте ссылку или код"
                          value={catalogLinkInput}
                          onChange={(e) => setCatalogLinkInput(e.target.value)}
                          className="flex-1"
                        />
                        <Button 
                          onClick={handleAddCatalogByLink} 
                          disabled={addingCatalog || !catalogLinkInput.trim()}
                          size="icon"
                        >
                          {addingCatalog ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    {/* Доступные прайс-листы */}
                    <div className="space-y-2 pt-4 border-t border-border">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Мои прайс-листы</span>
                        <Badge variant="secondary" className="text-[10px]">{catalogs.length}</Badge>
                      </div>
                      {catalogs.length > 0 ? (
                        <div className="space-y-2">
                          {catalogs.map((catalog) => (
                            <div 
                              key={catalog.id} 
                              onClick={() => {
                                setCurrentCatalog(catalog);
                                handleCloseProfile();
                              }}
                              className="p-3 bg-muted/50 hover:bg-muted rounded-lg cursor-pointer transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="font-medium text-sm">{catalog.store_name}</div>
                                  <div className="text-xs text-muted-foreground">{catalog.catalog_name}</div>
                                </div>
                                {currentCatalog?.id === catalog.id && (
                                  <CheckCircle2 className="w-4 h-4 text-primary" />
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-6 text-muted-foreground">
                          <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p className="text-xs">Нет доступных прайс-листов</p>
                          <p className="text-[10px] mt-1">Добавьте прайс-лист по ссылке выше</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Настройки */}
                {profileSection === 'settings' && (
                  <div className="space-y-4 animate-in fade-in duration-150">
                    {/* Уведомления */}
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="space-y-0.5">
                        <Label htmlFor="toast-toggle" className="text-sm font-medium flex items-center gap-2">
                          <Bell className="w-3.5 h-3.5" />
                          Уведомления
                        </Label>
                        <p className="text-[10px] text-muted-foreground">
                          Всплывающие уведомления о действиях
                        </p>
                      </div>
                      <Switch
                        id="toast-toggle"
                        checked={toastEnabled}
                        onCheckedChange={(checked) => updateSettings({ toast_notifications_enabled: checked })}
                        disabled={updatingSettings}
                      />
                    </div>

                    {/* Смена пароля */}
                    {!isImpersonating && (
                      <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
                        <Label className="text-sm font-medium flex items-center gap-2">
                          <Key className="w-3.5 h-3.5" />
                          Смена пароля
                        </Label>
                        <div className="flex gap-2">
                          <Input
                            type="password"
                            placeholder="Новый пароль"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="flex-1"
                          />
                          <Button 
                            onClick={handleChangePassword} 
                            disabled={passwordLoading || !newPassword}
                            size="sm"
                          >
                            {passwordLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Сменить"}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Выход */}
                    <div className="pt-4 border-t border-border">
                      {isImpersonating ? (
                        <Button variant="outline" onClick={handleExitImpersonation} className="w-full gap-2">
                          <ArrowLeft className="w-4 h-4" />
                          Вернуться в панель супер-админа
                        </Button>
                      ) : (
                        <Button variant="outline" onClick={handleSignOut} className="w-full gap-2">
                          <LogOut className="w-4 h-4" />
                          Выйти из аккаунта
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (catalogs.length === 0) {
    return (
      <div className="h-screen bg-background flex flex-col">
        {/* Impersonation banner */}
        {isImpersonating && (
          <div className="bg-amber-500 text-amber-950 px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Shield className="w-4 h-4" />
              <span>Режим просмотра от имени покупателя</span>
            </div>
            <Button size="sm" variant="secondary" onClick={handleExitImpersonation} className="h-7 gap-1">
              <ArrowLeft className="w-3 h-3" />
              Назад
            </Button>
          </div>
        )}
        <header className="sticky top-0 z-50 bg-background border-b border-border">
          <div className="h-12 flex items-center justify-between px-3">
            <span className="font-semibold">Мои прайс-листы</span>
            <button
              onClick={handleOpenProfile}
              className="p-1.5 bg-muted hover:bg-muted/80 transition-colors rounded-full"
            >
              <User className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </header>
        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <Package className="w-12 h-12 text-muted-foreground mb-3" />
          <h3 className="font-medium text-foreground mb-2">Нет доступных прайс-листов</h3>
          <p className="text-sm text-muted-foreground">
            Попросите продавца поделиться ссылкой на прайс-лист
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col relative">
      {/* Order Success Overlay */}
      {orderSuccess && (
        <div className="absolute inset-0 z-[100] bg-background/95 flex items-center justify-center">
          <div className="text-center space-y-3 animate-in fade-in zoom-in duration-200">
            <div className="w-16 h-16 mx-auto bg-green-500 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-lg font-semibold text-foreground">Заказ успешно отправлен!</p>
          </div>
        </div>
      )}
      {/* Impersonation banner */}
      {isImpersonating && (
        <div className="bg-amber-500 text-amber-950 px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Shield className="w-4 h-4" />
            <span>Режим просмотра от имени покупателя</span>
          </div>
          <Button size="sm" variant="secondary" onClick={handleExitImpersonation} className="h-7 gap-1">
            <ArrowLeft className="w-3 h-3" />
            Назад
          </Button>
        </div>
      )}
      <CustomerHeader 
        cart={cart} 
        catalogs={catalogs}
        selectedCatalog={currentCatalog}
        onSelectCatalog={(catalog) => catalog && setCurrentCatalog(catalog)}
        showImages={showImages}
        onToggleImages={() => setShowImages(!showImages)}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenProfile={handleOpenProfile}
        onOpenOrders={() => {
          refetchMyOrders();
          setIsOrdersOpen(true);
        }}
        categories={availableCategories}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />
      
      <main className="flex-1 overflow-auto">
        {productsLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : products.length > 0 ? (
          products
            .filter((product) => 
              !selectedCategory || 
              (product.catalog_categories && product.catalog_categories.includes(selectedCategory))
            )
            .map((product) => (
              <ProductCard 
                key={product.id} 
                product={product} 
                cart={cart}
                onAddToCart={handleAddToCart}
                showImages={showImages}
                isExpanded={expandedProductId === product.id}
                onImageClick={() => setExpandedProductId(expandedProductId === product.id ? null : product.id)}
                onOpenFullscreen={(imageIndex) => product.images && setFullscreenImages({ images: product.images, index: imageIndex })}
                isDescriptionExpanded={expandedDescriptionId === product.id}
                onNameClick={() => product.description && setExpandedDescriptionId(expandedDescriptionId === product.id ? null : product.id)}
              />
            ))
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <FolderOpen className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              {currentCatalog 
                ? `В прайс-листе "${currentCatalog.catalog_name}" нет товаров`
                : "Выберите прайс-лист"}
            </p>
          </div>
        )}
      </main>

      {/* Cart Drawer (slides from bottom on mobile) */}
      <Drawer open={isCartOpen} onOpenChange={setIsCartOpen}>
        <DrawerContent className="max-h-[70vh]">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">Корзина</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {cart.length}
              </Badge>
            </div>
            <span className="text-sm font-bold text-primary">{formatPrice(cartTotal)}</span>
          </div>
          
          <div className="flex-1 overflow-y-auto px-3 py-1.5 max-h-[40vh]">
            {cart.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-4">Корзина пуста</p>
            ) : (
              <div className="divide-y divide-border/50">
                {cart.map((item, index) => {
                  const product = getProductById(item.productId);
                  // For repeat order items, product might be null but we have originalProductName
                  const isUnavailable = item.isAvailable === false;
                  const displayName = product?.name || item.originalProductName || 'Товар';
                  const variantLabel = product ? getVariantLabel(product, item.variantIndex) : '';
                  const itemVolume = getItemVolume(product, item.variantIndex, item.quantity);
                  
                    return (
                      <div 
                        key={`${item.productId}-${item.variantIndex}-${index}`} 
                        className={`grid grid-cols-[20px_32px_1fr_auto_auto] gap-2 py-2 items-center ${isUnavailable ? 'opacity-60' : ''}`}
                      >
                        {/* Кнопка удаления слева */}
                        <button 
                          className="w-5 h-5 flex items-center justify-center rounded hover:bg-destructive/10 transition-colors"
                          onClick={() => removeFromCart(index)}
                        >
                          <Trash2 className="h-2.5 w-2.5 text-destructive/70" />
                        </button>
                        
                        {/* Изображение с индикатором доступности */}
                        <div className="relative w-8 h-8 rounded bg-muted flex items-center justify-center overflow-hidden">
                          {product?.images?.[0] ? (
                            <img src={product.images[0]} alt={displayName} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                          {/* Availability indicator */}
                          {item.isAvailable !== undefined && (
                            <div className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full flex items-center justify-center ${
                              item.isAvailable ? 'bg-green-500' : 'bg-destructive'
                            }`}>
                              {item.isAvailable ? (
                                <CheckCircle2 className="w-2 h-2 text-white" />
                              ) : (
                                <AlertCircle className="w-2 h-2 text-white" />
                              )}
                            </div>
                          )}
                        </div>
                        
                        {/* Название + вариант + объём + цена за 1 + статус */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className={`font-medium text-[11px] truncate leading-tight ${isUnavailable ? 'line-through' : ''}`}>
                              {displayName}
                            </p>
                            {variantLabel && !isUnavailable && (
                              <span className="flex-shrink-0 px-1.5 py-0.5 text-[9px] font-medium bg-primary/10 text-primary rounded">
                                {variantLabel}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {isUnavailable ? (
                              <span className="text-[9px] text-destructive">Нет в прайсе</span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground truncate">
                                <span className="text-primary font-medium">{itemVolume}</span>
                                {' · '}{formatPrice(item.price)}/шт
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {/* Кнопки +/- с количеством */}
                        <div className="flex items-center gap-0.5">
                          {!isUnavailable && (
                            <>
                              <button 
                                className="w-5 h-5 flex items-center justify-center rounded bg-muted hover:bg-muted/80 transition-colors"
                                onClick={() => updateCartQuantity(index, -1)}
                              >
                                <Minus className="h-2.5 w-2.5" />
                              </button>
                              <span className="w-5 text-center text-[11px] font-semibold tabular-nums">{item.quantity}</span>
                              <button 
                                className="w-5 h-5 flex items-center justify-center rounded bg-muted hover:bg-muted/80 transition-colors"
                                onClick={() => updateCartQuantity(index, 1)}
                              >
                                <Plus className="h-2.5 w-2.5" />
                              </button>
                            </>
                          )}
                        </div>
                        
                        {/* Сумма */}
                        <div className="text-right w-14">
                          {!isUnavailable && (
                            <span className="text-[11px] font-bold text-primary tabular-nums">{formatPriceSpaced(item.price * item.quantity)}</span>
                          )}
                        </div>
                      </div>
                    );
                })}
              </div>
            )}
          </div>
          
          {cart.length > 0 && (
            <div className="px-3 py-2 border-t border-border bg-muted/30 space-y-1.5">
              {/* Warning about unavailable items */}
              {unavailableItemsCount > 0 && (
                <div className="flex items-center gap-1.5 text-[10px] text-amber-600 dark:text-amber-400">
                  <AlertCircle className="w-3 h-3" />
                  <span>{unavailableItemsCount} товаров нет в прайсе — они будут исключены</span>
                </div>
              )}
              <Button 
                className="w-full h-9 text-sm font-semibold" 
                disabled={availableItemsCount === 0}
                onClick={() => {
                  // Remove unavailable items before checkout
                  if (unavailableItemsCount > 0) {
                    setCart(prev => prev.filter(item => item.isAvailable !== false));
                  }
                  if (profileData) {
                    setCheckoutName(profileData.full_name || "");
                    setCheckoutPhone(profileData.phone || "");
                  }
                  if (lastUsedAddress) {
                    setCheckoutAddress(lastUsedAddress.address);
                  }
                  setIsCartOpen(false);
                  setIsCheckoutOpen(true);
                }}
              >
                {availableItemsCount > 0 
                  ? `Оформить ${availableItemsCount} поз. · ${formatPrice(cartTotal)}`
                  : 'Нет доступных товаров'
                }
              </Button>
            </div>
          )}
        </DrawerContent>
      </Drawer>

      {/* Checkout Dialog */}
      <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Оформление заказа</DialogTitle>
            <DialogDescription>
              Заполните данные для доставки
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Имя</Label>
              <Input
                id="name"
                value={checkoutName}
                onChange={(e) => setCheckoutName(e.target.value)}
                placeholder="Ваше имя"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Телефон</Label>
              <Input
                id="phone"
                value={checkoutPhone}
                onChange={(e) => setCheckoutPhone(e.target.value)}
                placeholder="+7 (999) 123-45-67"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Адрес доставки</Label>
              <div className="relative">
                <Input
                  id="address"
                  value={checkoutAddress}
                  onChange={(e) => setCheckoutAddress(e.target.value)}
                  placeholder="Город, улица, дом, квартира"
                  className="pr-8"
                />
                {addresses.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAddressDropdown(!showAddressDropdown)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded transition-colors"
                  >
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showAddressDropdown ? 'rotate-180' : ''}`} />
                  </button>
                )}
              </div>
              
              {/* Saved addresses dropdown */}
              {showAddressDropdown && addresses.length > 0 && (
                <div className="border rounded-lg bg-popover shadow-md overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground bg-muted/50 border-b">
                    Сохранённые адреса
                  </div>
                  <div className="max-h-32 overflow-y-auto">
                    {addresses.map((addr) => (
                      <button
                        key={addr.id}
                        type="button"
                        onClick={() => {
                          setCheckoutAddress(addr.address);
                          setShowAddressDropdown(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors"
                      >
                        <MapPin className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="truncate flex-1">{addr.address}</span>
                        {checkoutAddress === addr.address && (
                          <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="comment">Комментарий (необязательно)</Label>
              <Input
                id="comment"
                value={checkoutComment}
                onChange={(e) => setCheckoutComment(e.target.value)}
                placeholder="Дополнительные пожелания"
              />
            </div>
            
            <div className="pt-4 border-t border-border">
              <div className="flex justify-between text-lg font-semibold">
                <span>Итого:</span>
                <span>{formatPrice(cartTotal)}</span>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsCheckoutOpen(false)}
            >
              Отмена
            </Button>
            <Button 
              onClick={handleCheckout}
              disabled={!checkoutName || !checkoutPhone || !checkoutAddress || orderLoading}
            >
              {orderLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Подтвердить заказ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Message Overlay */}
      {orderSuccess && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="flex flex-col items-center gap-3 p-6 bg-card rounded-lg shadow-lg border animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-lg font-medium text-foreground">Заказ успешно отправлен!</p>
          </div>
        </div>
      )}

      {/* Orders History Drawer (slides from bottom on mobile) */}
      <Drawer open={isOrdersOpen} onOpenChange={setIsOrdersOpen}>
        <DrawerContent className="max-h-[70vh]">
          <div className="flex items-center gap-2 px-4 py-1.5 border-b border-border">
            <PackageOpen className="w-3.5 h-3.5 text-primary" />
            <span className="font-medium text-xs">Мои заказы</span>
            <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
              {myOrders.length}
            </Badge>
          </div>
          
          <div className="flex-1 overflow-y-auto px-2 py-1.5 max-h-[55vh]">
            {myOrdersLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : myOrders.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Package className="w-8 h-8 mx-auto mb-1.5 opacity-50" />
                <p className="text-xs">У вас пока нет заказов</p>
              </div>
            ) : (
              <div className="space-y-1">
                {myOrders.map((order) => {
                  const isExpanded = expandedOrderId === order.id;
                  const statusColor = 
                    order.status === 'delivered' ? 'bg-green-500' :
                    order.status === 'cancelled' ? 'bg-destructive' :
                    order.status === 'shipped' ? 'bg-blue-500' :
                    order.status === 'processing' ? 'bg-amber-500' :
                    'bg-muted-foreground';
                  const statusText = 
                    order.status === 'pending' ? 'Ожидает' :
                    order.status === 'processing' ? 'В работе' :
                    order.status === 'shipped' ? 'Отправлен' :
                    order.status === 'delivered' ? 'Доставлен' :
                    'Отменён';
                  
                  return (
                    <div 
                      key={order.id} 
                      className={`rounded-lg border transition-all ${isExpanded ? 'bg-muted/30 border-primary/30' : 'border-border hover:border-muted-foreground/30'}`}
                    >
                      {/* Compact header - clickable */}
                      <button
                        onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left"
                      >
                        {/* Status dot */}
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusColor}`} />
                        
                        {/* Order info */}
                        <div className="flex-1 min-w-0 flex items-center gap-1.5">
                          <span className="text-[10px] font-semibold text-foreground">{order.order_number}</span>
                          <span className="text-[9px] text-muted-foreground">
                            {new Date(order.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
                          </span>
                        </div>
                        
                        {/* Items count + total */}
                        <div className="flex items-center gap-1.5">
                          {order.items && order.items.length > 0 && (
                            <span className="text-[9px] text-muted-foreground">{order.items.length} поз.</span>
                          )}
                          <span className="text-[10px] font-bold text-primary">{formatPriceSpaced(order.total)}</span>
                        </div>
                        
                        {/* Expand icon */}
                        <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>
                      
                      {/* Expanded content */}
                      {isExpanded && order.items && order.items.length > 0 && (
                        <div className="px-2.5 pb-2 pt-0.5 animate-in slide-in-from-top-1 duration-150">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full text-white ${statusColor}`}>
                                {statusText}
                              </span>
                              <span className="text-[9px] text-muted-foreground">
                                {new Date(order.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            {/* Repeat order button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRepeatOrder(order);
                              }}
                              className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-medium bg-primary/10 hover:bg-primary/20 text-primary rounded-full transition-colors"
                            >
                              <RotateCcw className="w-2.5 h-2.5" />
                              Повторить
                            </button>
                          </div>
                          <div className="space-y-0.5 border-t border-border/50 pt-1.5">
                            {order.items.map((item, idx) => {
                              // Check if this product is available in current catalog
                              const productAvailable = item.product_id ? !!getProductById(item.product_id) : false;
                              return (
                                <div key={idx} className="flex items-center justify-between text-[10px]">
                                  <div className="flex items-center gap-1 flex-1 min-w-0">
                                    {/* Availability indicator */}
                                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${productAvailable ? 'bg-green-500' : 'bg-muted-foreground/40'}`} />
                                    <span className={`truncate ${productAvailable ? 'text-muted-foreground' : 'text-muted-foreground/50'}`}>
                                      {item.product_name}
                                    </span>
                                  </div>
                                  <span className="flex-shrink-0 ml-2 text-foreground">
                                    <span className="text-muted-foreground">×{item.quantity}</span>
                                    <span className="ml-1.5 font-medium">{formatPriceSpaced(item.total)}</span>
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
      {/* Fullscreen Image Viewer */}
      {fullscreenImages && (
        <div 
          className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center"
          onClick={() => setFullscreenImages(null)}
        >
          {/* Close button */}
          <button 
            onClick={() => setFullscreenImages(null)}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white transition-colors z-10"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Image counter */}
          <div className="absolute top-4 left-4 text-white/70 text-sm">
            {fullscreenImages.index + 1} / {fullscreenImages.images.length}
          </div>

          {/* Previous button */}
          {fullscreenImages.images.length > 1 && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setFullscreenImages(prev => prev ? {
                  ...prev,
                  index: prev.index > 0 ? prev.index - 1 : prev.images.length - 1
                } : null);
              }}
              className="absolute left-2 p-2 text-white/70 hover:text-white transition-colors z-10"
            >
              <ChevronLeft className="w-8 h-8" />
            </button>
          )}

          {/* Current image */}
          <img
            src={fullscreenImages.images[fullscreenImages.index]}
            alt={`Image ${fullscreenImages.index + 1}`}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Next button */}
          {fullscreenImages.images.length > 1 && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setFullscreenImages(prev => prev ? {
                  ...prev,
                  index: prev.index < prev.images.length - 1 ? prev.index + 1 : 0
                } : null);
              }}
              className="absolute right-2 p-2 text-white/70 hover:text-white transition-colors z-10"
            >
              <ChevronRight className="w-8 h-8" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default CustomerDashboard;
