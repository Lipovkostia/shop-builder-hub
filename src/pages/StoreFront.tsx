import { useEffect, useState, useMemo, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ShoppingCart, Settings, FolderOpen, Filter, Image, ArrowLeft, Pencil, Search, X, Images, Tag, Store, Package, LayoutGrid, Plus } from "lucide-react";
import { ForkliftIcon } from "@/components/icons/ForkliftIcon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { useStoreBySubdomain, useIsStoreOwner } from "@/hooks/useUserStore";
import { useStoreProducts, StoreProduct } from "@/hooks/useStoreProducts";
import { useStoreCatalogs } from "@/hooks/useStoreCatalogs";
import { useCatalogProductSettings, CatalogProductSetting } from "@/hooks/useCatalogProductSettings";
import { useStoreOrders } from "@/hooks/useOrders";
import { useStoreCategories } from "@/hooks/useStoreCategories";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductEditPanel } from "@/components/admin/ProductEditPanel";
import { useAuth } from "@/hooks/useAuth";
import { ImageGalleryViewer } from "@/components/admin/ImageGalleryViewer";
import { uploadFilesToStorage, deleteSingleImage } from "@/hooks/useProductImages";
import { useToast } from "@/hooks/use-toast";
import {
  formatPrice,
  calculatePackagingPrices,
  calculateSalePrice,
} from "@/components/admin/types";
import AdminPanel from "@/pages/AdminPanel";

interface CartItem {
  productId: string;
  variantIndex: number;
  quantity: number;
  price: number;
}

// Форматирование цены с пробелом
function formatPriceSpaced(price: number): string {
  return Math.round(price).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

// Индикатор порции (SVG для чёткости)
function PortionIndicator({ type }: { type: "full" | "half" | "quarter" | "portion" }) {
  const size = 14;
  const r = 5;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
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

// Карточка товара в стиле TestStore
function ProductCard({ 
  product, 
  cart, 
  onAddToCart,
  showImages = true,
  catalogSettings,
  isOwner = false,
  isExpanded = false,
  onToggleExpand,
  onSave,
  catalogs = [],
  productCatalogIds = [],
  onCatalogsChange,
  selectedCatalog,
  onStatusChange,
  onCatalogSettingsChange,
  isGalleryOpen = false,
  onToggleGallery,
  onImagesUpdate,
  isOnboardingHighlighted = false,
}: { 
  product: any;
  cart: CartItem[];
  onAddToCart: (productId: string, variantIndex: number, price: number) => void;
  showImages?: boolean;
  catalogSettings?: CatalogProductSetting;
  isOwner?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onSave?: (productId: string, updates: Partial<StoreProduct>) => Promise<StoreProduct | null>;
  catalogs?: { id: string; name: string; is_default: boolean }[];
  productCatalogIds?: string[];
  onCatalogsChange?: (productId: string, catalogIds: string[]) => void;
  selectedCatalog?: string | null;
  onStatusChange?: (catalogId: string, productId: string, status: string) => void;
  onCatalogSettingsChange?: (catalogId: string, productId: string, settings: any) => void;
  isGalleryOpen?: boolean;
  onToggleGallery?: () => void;
  onImagesUpdate?: (productId: string, images: string[]) => void;
  isOnboardingHighlighted?: boolean;
}) {
  const { toast } = useToast();
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [isDeletingImage, setIsDeletingImage] = useState(false);
  const getCartQuantity = (variantIndex: number) => {
    const item = cart.find(
      (c) => c.productId === product.id && c.variantIndex === variantIndex
    );
    return item?.quantity || 0;
  };

  // Расчёт цен с учётом наценки (используем настройки каталога, если есть)
  const buyPrice = product.buy_price || product.price;
  const catalogMarkup = catalogSettings?.markup_value && catalogSettings.markup_value > 0
    ? { type: (catalogSettings.markup_type === 'fixed' ? 'rubles' : catalogSettings.markup_type) as "percent" | "rubles", value: catalogSettings.markup_value }
    : undefined;
  const productMarkup = product.markup_type && product.markup_value 
    ? { type: product.markup_type as "percent" | "rubles", value: product.markup_value }
    : undefined;
  const markup = catalogMarkup || productMarkup;
  const salePrice = calculateSalePrice(buyPrice, markup) || product.price;
  
  // Цены порций из настроек каталога или товара
  const portionPriceHalf = catalogSettings?.portion_prices?.halfPricePerKg || product.price_half;
  const portionPriceQuarter = catalogSettings?.portion_prices?.quarterPricePerKg || product.price_quarter;
  const portionPricePortion = catalogSettings?.portion_prices?.portionPrice || product.price_portion;
  
  const packagingPrices = calculatePackagingPrices(
    salePrice,
    product.unit_weight,
    product.packaging_type || "piece",
    undefined,
    undefined
  );

  const images = product.images || [];
  const firstImage = images[0] || "/placeholder.svg";
  const unit = product.unit || "кг";
  
  // Determine stock status: use catalog settings if available, otherwise fall back to product is_active
  const effectiveStatus = catalogSettings?.status || (product.is_active !== false ? "in_stock" : "out_of_stock");
  const inStock = effectiveStatus === "in_stock" || effectiveStatus === "pre_order";
  const isPreOrder = effectiveStatus === "pre_order";
  const isHidden = effectiveStatus === "hidden";

  const getFullPrice = () => {
    if (packagingPrices) {
      return packagingPrices.full;
    }
    return null;
  };

  const fullPrice = getFullPrice();

  // Обработчики для галереи изображений
  const handleAddImages = async (files: FileList, source: 'file' | 'camera') => {
    if (!isOwner || !onImagesUpdate || !onSave) return;
    
    setIsUploadingImages(true);
    try {
      const filesArray = Array.from(files);
      const startIndex = images.length;
      const newUrls = await uploadFilesToStorage(filesArray, product.id, startIndex);
      
      if (newUrls.length > 0) {
        const updatedImages = [...images, ...newUrls];
        // onSave returns null on error, so we need to check
        const result = await onSave(product.id, { images: updatedImages });
        if (result !== undefined) {
          onImagesUpdate(product.id, updatedImages);
          toast({
            title: "Изображения загружены",
            description: `Добавлено ${newUrls.length} фото`,
          });
        }
        // If result is undefined/null, updateProduct already showed an error toast
      }
    } catch (error) {
      console.error("Error uploading images:", error);
      toast({
        title: "Ошибка загрузки",
        description: "Не удалось загрузить изображения",
        variant: "destructive",
      });
    } finally {
      setIsUploadingImages(false);
    }
  };

  const handleDeleteImage = async (index: number) => {
    if (!isOwner || !onImagesUpdate) return;
    
    setIsDeletingImage(true);
    try {
      const imageUrl = images[index];
      await deleteSingleImage(imageUrl);
      
      const updatedImages = images.filter((_: string, i: number) => i !== index);
      await onSave?.(product.id, { images: updatedImages });
      onImagesUpdate(product.id, updatedImages);
      toast({
        title: "Изображение удалено",
      });
    } catch (error) {
      console.error("Error deleting image:", error);
      toast({
        title: "Ошибка удаления",
        description: "Не удалось удалить изображение",
        variant: "destructive",
      });
    } finally {
      setIsDeletingImage(false);
    }
  };

  const handleSetMainImage = async (index: number) => {
    if (!isOwner || !onImagesUpdate || index === 0) return;
    
    const updatedImages = [...images];
    const [movedImage] = updatedImages.splice(index, 1);
    updatedImages.unshift(movedImage);
    
    await onSave?.(product.id, { images: updatedImages });
    onImagesUpdate(product.id, updatedImages);
    toast({
      title: "Главное фото изменено",
    });
  };

  return (
    <div className="border-b border-border">
    <div 
      className={`flex gap-1.5 px-1.5 py-1.5 bg-background ${showImages ? 'min-h-[80px]' : 'min-h-[56px]'} ${isHidden ? 'opacity-60' : ''}`}
    >
      {/* Изображение */}
      {showImages && (
        <div 
          className={`relative w-14 h-14 flex-shrink-0 rounded overflow-hidden bg-muted self-center ${isOwner ? 'cursor-pointer' : ''}`}
          onClick={isOwner && onToggleGallery ? onToggleGallery : undefined}
        >
          {images.length > 0 ? (
            <img
              src={firstImage}
              alt={product.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/placeholder.svg";
              }}
            />
          ) : isOwner ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground hover:text-primary transition-colors">
              <Plus className="w-5 h-5" />
              <span className="text-[8px] mt-0.5">Фото</span>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Image className="w-6 h-6 text-muted-foreground/50" />
            </div>
          )}
          {/* Индикатор количества фото */}
          {isOwner && images.length > 0 && (
            <div className="absolute bottom-0 right-0 bg-black/70 text-white text-[8px] px-1 rounded-tl flex items-center gap-0.5">
              <Images className="w-2.5 h-2.5" />
              {images.length}
            </div>
          )}
        </div>
      )}

      {/* Контент справа */}
      <div className={`flex-1 min-w-0 flex flex-col justify-center gap-0`}>
        {/* Название */}
        <div className={`relative overflow-hidden ${isOnboardingHighlighted ? 'animate-pulse' : ''}`}>
          <h3 
            className={`font-medium text-foreground leading-tight ${showImages ? 'text-lg pr-6 whitespace-nowrap' : 'text-base truncate pr-2'} ${isOwner ? 'cursor-pointer hover:text-primary transition-colors' : ''} ${isOnboardingHighlighted ? 'text-primary ring-2 ring-primary ring-offset-2 rounded px-1 bg-primary/10' : ''}`}
            onClick={isOwner && onToggleExpand ? () => onToggleExpand() : undefined}
          >
            {effectiveStatus === "out_of_stock" && (
              <span className="inline-flex items-center gap-1 mr-1.5 text-muted-foreground text-xs align-middle">
                <span className="w-2 h-2 rounded-full bg-muted-foreground/50" />
                <span>нет в наличии</span>
              </span>
            )}
            {isPreOrder && (
              <span className="inline-flex items-center gap-1 mr-1.5 text-blue-600 dark:text-blue-400 text-xs align-middle">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span>под заказ</span>
              </span>
            )}
            {isOwner && isHidden && (
              <span className="inline-flex items-center gap-1 mr-1.5 text-muted-foreground text-xs align-middle">
                <span className="w-2 h-2 rounded-full bg-muted-foreground/50 border border-dashed border-muted-foreground" />
                <span>скрыт</span>
              </span>
            )}
            {product.name}
            {isOwner && (
              <Pencil className={`inline-block ml-1 w-3 h-3 ${isOnboardingHighlighted ? 'text-primary' : 'text-muted-foreground'}`} />
            )}
          </h3>
          {showImages && <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-background to-transparent" />}
        </div>

        {/* Цена за кг и объём - только при показе изображений */}
        {showImages && (
          <p className="text-muted-foreground leading-tight text-xs">
            {formatPrice(salePrice)}/{unit}
            {product.unit_weight && (
              <span className="ml-1">
                · {product.unit_weight} {unit}
              </span>
            )}
            {fullPrice && (
              <span className="ml-1">
                · ~{formatPrice(fullPrice)}
              </span>
            )}
          </p>
        )}

        {/* Кнопки - flex-shrink-0 чтобы не сжимались */}
        <div className={`flex items-center gap-0.5 flex-shrink-0 mt-0.5 flex-wrap justify-end flex-row-reverse`}>
          
          {/* Кнопки покупки - всегда показываем, но disabled если не in_stock */}
          {/* Целая - всегда показываем */}
          {(() => {
            const qty = getCartQuantity(0);
            // Цена = объём * цена за кг
            const fullPrice = (product.unit_weight || 1) * salePrice;
            return (
              <button
                onClick={() => inStock && onAddToCart(product.id, 0, fullPrice)}
                disabled={!inStock}
                className={`relative flex items-center gap-1 h-7 px-2 rounded border transition-all ${
                  inStock 
                    ? 'border-border hover:border-primary hover:bg-primary/5' 
                    : 'border-border/50 opacity-50 cursor-not-allowed'
                }`}
              >
                {qty > 0 && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center">
                    {qty}
                  </span>
                )}
                <PortionIndicator type="full" />
                <span className="text-sm font-medium text-foreground">
                  {formatPriceSpaced(fullPrice)}
                </span>
              </button>
            );
          })()}
          
          {/* Половина - показываем только если есть ненулевая цена */}
          {portionPriceHalf && portionPriceHalf > 0 && (() => {
            const qty = getCartQuantity(1);
            // Цена = половина объёма * цена за кг
            const halfWeight = (product.unit_weight || 1) / 2;
            const halfPrice = halfWeight * portionPriceHalf;
            return (
              <button
                onClick={() => inStock && onAddToCart(product.id, 1, halfPrice)}
                disabled={!inStock}
                className={`relative flex items-center gap-1 h-7 px-2 rounded border transition-all ${
                  inStock 
                    ? 'border-border hover:border-primary hover:bg-primary/5' 
                    : 'border-border/50 opacity-50 cursor-not-allowed'
                }`}
              >
                {qty > 0 && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center">
                    {qty}
                  </span>
                )}
                <PortionIndicator type="half" />
                <span className="text-sm font-medium text-foreground">
                  {formatPriceSpaced(halfPrice)}
                </span>
              </button>
            );
          })()}
          
          {/* Четверть - показываем только если есть ненулевая цена */}
          {portionPriceQuarter && portionPriceQuarter > 0 && (() => {
            const qty = getCartQuantity(2);
            // Цена = четверть объёма * цена за кг
            const quarterWeight = (product.unit_weight || 1) / 4;
            const quarterPrice = quarterWeight * portionPriceQuarter;
            return (
              <button
                onClick={() => inStock && onAddToCart(product.id, 2, quarterPrice)}
                disabled={!inStock}
                className={`relative flex items-center gap-1 h-7 px-2 rounded border transition-all ${
                  inStock 
                    ? 'border-border hover:border-primary hover:bg-primary/5' 
                    : 'border-border/50 opacity-50 cursor-not-allowed'
                }`}
              >
                {qty > 0 && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center">
                    {qty}
                  </span>
                )}
                <PortionIndicator type="quarter" />
                <span className="text-sm font-medium text-foreground">
                  {formatPriceSpaced(quarterPrice)}
                </span>
              </button>
            );
          })()}
          
          {/* Порция - показываем только если есть ненулевая цена */}
          {portionPricePortion && portionPricePortion > 0 && (() => {
            const qty = getCartQuantity(3);
            return (
              <button
                onClick={() => inStock && onAddToCart(product.id, 3, portionPricePortion)}
                disabled={!inStock}
                className={`relative flex items-center gap-1 h-7 px-2 rounded border transition-all ${
                  inStock 
                    ? 'border-border hover:border-primary hover:bg-primary/5' 
                    : 'border-border/50 opacity-50 cursor-not-allowed'
                }`}
              >
                {qty > 0 && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center">
                    {qty}
                  </span>
                )}
                <PortionIndicator type="portion" />
                <span className="text-sm font-medium text-foreground">
                  {formatPriceSpaced(portionPricePortion)}
                </span>
              </button>
            );
          })()}
        </div>
      </div>
    </div>
    
    {/* Галерея изображений для владельца */}
    {isOwner && onImagesUpdate && (
      <Collapsible open={isGalleryOpen}>
        <CollapsibleContent>
          <div className="px-2 py-3 bg-muted/30 border-t border-border">
            <ImageGalleryViewer
              images={images}
              productName={product.name}
              productId={product.id}
              onDeleteImage={handleDeleteImage}
              onAddImages={handleAddImages}
              onSetMainImage={handleSetMainImage}
              isDeleting={isDeletingImage}
              isUploading={isUploadingImages}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    )}

    {/* Панель редактирования для владельца */}
    {isOwner && onSave && onCatalogsChange && (
      <Collapsible open={isExpanded}>
        <CollapsibleContent>
          <ProductEditPanel
            product={product}
            catalogs={catalogs}
            productCatalogIds={productCatalogIds}
            onSave={onSave}
            onCatalogsChange={onCatalogsChange}
            onClose={() => onToggleExpand?.()}
            catalogId={selectedCatalog}
            currentStatus={catalogSettings?.status || "in_stock"}
            onStatusChange={onStatusChange}
            catalogSettings={catalogSettings ? {
              markup_type: catalogSettings.markup_type,
              markup_value: catalogSettings.markup_value,
              portion_prices: catalogSettings.portion_prices,
              status: catalogSettings.status,
              categories: catalogSettings.categories,
            } : undefined}
            onCatalogSettingsChange={onCatalogSettingsChange}
            storeId={product.store_id}
          />
        </CollapsibleContent>
      </Collapsible>
    )}
    </div>
  );
}

// Header в стиле TestStore
function StoreHeader({
  store,
  cart,
  catalogs,
  selectedCatalog,
  onSelectCatalog,
  showImages,
  onToggleImages,
  isOwner,
  isOwnerLoading,
  filtersOpen,
  onToggleFilters,
  statusFilter,
  onStatusFilterChange,
  searchQuery,
  onSearchChange,
  onAdminClick,
  ordersCount,
  viewMode,
  onStoreClick,
}: {
  store: any;
  cart: CartItem[];
  catalogs: any[];
  selectedCatalog: string | null;
  onSelectCatalog: (id: string | null) => void;
  showImages: boolean;
  onToggleImages: () => void;
  isOwner: boolean;
  isOwnerLoading: boolean;
  filtersOpen: boolean;
  onToggleFilters: () => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onAdminClick?: (section?: string) => void;
  ordersCount?: number;
  viewMode?: 'storefront' | 'admin';
  onStoreClick?: () => void;
}) {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const selectedCatalogName = catalogs.find((c) => c.id === selectedCatalog)?.name || "Все товары";

  // Шестерёнка ВСЕГДА видна для залогиненных пользователей с ролью seller
  // или пока идёт загрузка (чтобы избежать мигания)
  const canShowAdminButton =
    isOwner ||
    isOwnerLoading ||
    authLoading ||
    (!!user && profile?.role === "seller");

  return (
    <header className="sticky top-0 z-50 bg-background border-b border-border">
      <div className="h-12 flex items-center justify-between px-3 relative">
        {/* Иконка витрины - кликабельная для возврата к витрине */}
        <button 
          onClick={onStoreClick}
          className={`flex items-center gap-1 p-1.5 rounded-full transition-colors ${viewMode === 'storefront' ? 'bg-primary/10' : 'hover:bg-muted'}`}
          title="Витрина"
        >
          {store.logo_url ? (
            <img src={store.logo_url} alt={store.name} className="w-6 h-6 rounded object-cover" />
          ) : (
            <Store className={`w-5 h-5 ${viewMode === 'storefront' ? 'text-primary' : 'text-muted-foreground'}`} />
          )}
        </button>

        {/* Заказы по центру */}
        {canShowAdminButton && (
          <div className="absolute left-1/2 -translate-x-1/2">
            <button
              onClick={() => onAdminClick?.('orders')}
              className={`p-1.5 transition-colors rounded-full ${viewMode === 'admin' ? 'bg-primary/10' : 'bg-muted hover:bg-muted/80'}`}
              title={`Заказы${ordersCount ? ` (${ordersCount})` : ''}`}
              aria-label="Заказы"
            >
              <Package className={`w-5 h-5 ${viewMode === 'admin' ? 'text-primary' : 'text-muted-foreground'}`} />
            </button>
          </div>
        )}

        {canShowAdminButton && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onAdminClick?.('products')}
              className={`p-1.5 transition-colors rounded-full ${viewMode === 'admin' ? 'bg-primary/10' : 'bg-muted hover:bg-muted/80'}`}
              title="Панель управления"
              aria-label="Панель управления"
            >
              <Settings className={`w-4 h-4 ${viewMode === 'admin' ? 'text-primary' : 'text-muted-foreground'}`} />
            </button>
          </div>
        )}
        {!canShowAdminButton && <div className="w-8" />}
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
              <DropdownMenuItem 
                onClick={() => onSelectCatalog(null)}
                className="cursor-pointer"
              >
                <span className={!selectedCatalog ? "font-semibold" : ""}>Все товары</span>
              </DropdownMenuItem>
              {catalogs.map((catalog) => (
                <DropdownMenuItem
                  key={catalog.id}
                  onClick={() => onSelectCatalog(catalog.id)}
                  className="cursor-pointer"
                >
                  <span className={selectedCatalog === catalog.id ? "font-semibold" : ""}>
                    {catalog.name}
                  </span>
                </DropdownMenuItem>
              ))}
              {catalogs.length === 0 && (
                <DropdownMenuItem disabled>
                  <span className="text-muted-foreground">Нет прайс-листов</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Фильтр */}
          <button 
            onClick={onToggleFilters}
            className={`p-2 rounded transition-colors ${filtersOpen ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground'}`}
          >
            <Filter className="w-4 h-4" />
          </button>

          {/* Переключатель изображений */}
          <button 
            onClick={onToggleImages}
            className={`p-2 rounded transition-colors ${showImages ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground'}`}
          >
            <Image className="w-4 h-4" />
          </button>
      </div>
      </div>

      {/* Название магазина и прайс-листа - под блоком с иконками */}
      <div className="px-3 py-1 border-t border-border bg-background">
        <p className="text-[10px] text-muted-foreground text-right truncate">
          {store.name} — {selectedCatalogName}
        </p>
      </div>

      {/* Выезжающий блок фильтров */}
      <Collapsible open={filtersOpen}>
        <CollapsibleContent>
          <div className="px-3 py-2 border-t border-border bg-muted/20 space-y-2">
            {/* Поиск */}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Поиск товаров..."
                className="w-full h-8 pl-7 pr-3 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {searchQuery && (
                <button 
                  onClick={() => onSearchChange("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                >
                  <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>

            {/* Фильтр по статусу (только для владельца) */}
            {isOwner && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground uppercase">Статус:</span>
                <div className="flex gap-1">
                  {[
                    { value: "all", label: "Все" },
                    { value: "in_stock", label: "В наличии" },
                    { value: "pre_order", label: "Под заказ" },
                    { value: "out_of_stock", label: "Нет в наличии" },
                    { value: "hidden", label: "Скрытые" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => onStatusFilterChange(opt.value)}
                      className={`px-2 py-0.5 text-[10px] rounded-full transition-colors ${
                        statusFilter === opt.value
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </header>
  );
}

// Loading Skeleton
function StoreSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 bg-background border-b">
        <div className="h-12 flex items-center justify-between px-3">
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
        <div className="h-10 flex items-center gap-2 px-3 border-t">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
        </div>
      </div>
      <main className="flex-1">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-1.5 px-1.5 py-0.5 border-b h-[72px]">
            <Skeleton className="w-14 h-14 rounded self-center" />
            <div className="flex-1 flex flex-col justify-center gap-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <div className="flex gap-1">
                <Skeleton className="h-7 w-16" />
                <Skeleton className="h-7 w-16" />
                <Skeleton className="h-7 w-16" />
              </div>
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}

// Props interface for workspace mode
interface StoreFrontProps {
  workspaceMode?: boolean;
  storeData?: any;
  onSwitchToAdmin?: (section?: string) => void;
  onboardingStep1Active?: boolean;
  onOnboardingStep1Complete?: () => void;
  onboardingStep9Active?: boolean;
  onOnboardingStep9Complete?: () => void;
  onboardingStep10Active?: boolean;
  onOnboardingStep10Complete?: () => void;
  triggerRefetch?: boolean; // Trigger refetch when this changes to true
  onRefetchComplete?: () => void; // Called after refetch is done
}

// Main StoreFront Component
export default function StoreFront({ workspaceMode, storeData, onSwitchToAdmin, onboardingStep1Active, onOnboardingStep1Complete, onboardingStep9Active, onOnboardingStep9Complete, onboardingStep10Active, onOnboardingStep10Complete, triggerRefetch, onRefetchComplete }: StoreFrontProps = {}) {
  const { subdomain } = useParams<{ subdomain: string }>();
  const navigate = useNavigate();
  const { isSuperAdmin } = useAuth();
  
  // В режиме workspace используем переданные данные магазина
  const { store: fetchedStore, loading: storeLoading, error: storeError } = useStoreBySubdomain(workspaceMode ? undefined : subdomain);
  const store = workspaceMode ? storeData : fetchedStore;
  
  const { isOwner: isStoreOwner, loading: ownerLoading } = useIsStoreOwner(store?.id || null);
  const { products, loading: productsLoading, updateProduct } = useStoreProducts(store?.id || null);
  const { catalogs, productVisibility, setProductCatalogs, refetch: refetchCatalogs } = useStoreCatalogs(store?.id || null);
  const { settings: catalogProductSettings, getProductSettings, updateProductSettings, refetch: refetchCatalogSettings } = useCatalogProductSettings(store?.id || null);
  const { categories } = useStoreCategories(store?.id || null);
  
  // Check for temp super admin from localStorage (used when super admin navigates from super admin panel)
  const isTempSuperAdmin = typeof window !== 'undefined' && localStorage.getItem('temp_super_admin') === 'true';
  
  // Super admin or store owner can manage the store
  const isOwner = isStoreOwner || isSuperAdmin || isTempSuperAdmin;
  
  // Fetch orders count for owner
  const { orders } = useStoreOrders(isOwner ? store?.id : null);
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCatalog, setSelectedCatalog] = useState<string | null>(null);
  const [showImages, setShowImages] = useState(true);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [galleryOpenProductId, setGalleryOpenProductId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInputValue, setSearchInputValue] = useState("");
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search - update searchQuery 400ms after user stops typing
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setSearchQuery(searchInputValue);
    }, 400);
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchInputValue]);
  const [viewMode, setViewMode] = useState<'storefront' | 'admin'>('storefront');
  const [adminSection, setAdminSection] = useState<string | undefined>(undefined);
  
  // Onboarding step 9 sub-step: "catalog-trigger" -> "catalog-item" -> "done"
  const [onboardingStep9SubStep, setOnboardingStep9SubStep] = useState<"catalog-trigger" | "catalog-item" | "done">("catalog-trigger");
  
  // Onboarding step 10: track if name was edited
  const [onboardingStep10NameEdited, setOnboardingStep10NameEdited] = useState(false);

  // Refetch catalogs when triggerRefetch prop changes to true
  useEffect(() => {
    if (triggerRefetch) {
      refetchCatalogs();
      refetchCatalogSettings();
      onRefetchComplete?.();
    }
  }, [triggerRefetch, refetchCatalogs, refetchCatalogSettings, onRefetchComplete]);

  // Use products directly from hook - realtime handles sync
  const displayProducts = products;

  // Get product catalog IDs for a specific product
  const getProductCatalogIds = (productId: string): string[] => {
    const visibility = productVisibility[productId];
    return visibility ? Array.from(visibility) : [];
  };

  // Handle save product
  const handleSaveProduct = async (productId: string, updates: Partial<StoreProduct>) => {
    const result = await updateProduct(productId, updates);
    
    // If name was changed during onboarding step 10, complete it
    if (onboardingStep10Active && updates.name && result) {
      setOnboardingStep10NameEdited(true);
      setTimeout(() => {
        onOnboardingStep10Complete?.();
      }, 500);
    }
    
    return result;
  };

  // Handle catalogs change
  const handleCatalogsChange = (productId: string, catalogIds: string[]) => {
    setProductCatalogs(productId, catalogIds);
  };

  // Handle status change for catalog-specific settings
  const handleStatusChange = async (catalogId: string, productId: string, status: string) => {
    await updateProductSettings(catalogId, productId, { status });
  };

  // Handle images update - realtime will sync automatically
  const handleImagesUpdate = (_productId: string, _images: string[]) => {
    // Images are now synced via realtime through updateProduct
    // No local state update needed
  };

  // Filter products based on selected catalog, status filter, category filter, and search
  // Products are ONLY shown when a catalog is selected
  const filteredProducts = useMemo(() => {
    // No catalog selected = no products shown
    if (!selectedCatalog) {
      return [];
    }

    let filtered = displayProducts.filter((p) => {
      // Check if product is in this catalog
      if (!productVisibility[p.id]?.has(selectedCatalog)) {
        return false;
      }
      
      // Check catalog-specific status
      const catalogSettings = getProductSettings(selectedCatalog, p.id);
      const effectiveStatus = catalogSettings?.status || "in_stock";
      
      // Hide products with "hidden" status for non-owners
      if (effectiveStatus === "hidden" && !isOwner) {
        return false;
      }
      
      // Apply status filter for owners (only when filter is active)
      if (isOwner && statusFilter !== "all" && effectiveStatus !== statusFilter) {
        return false;
      }
      
      // Apply category filter - use catalog-specific categories
      if (categoryFilter !== null) {
        const productCategories = catalogSettings?.categories || [];
        if (!productCategories.includes(categoryFilter)) {
          return false;
        }
      }
      
      return true;
    });

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((p) => 
        p.name.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [displayProducts, selectedCatalog, productVisibility, getProductSettings, isOwner, statusFilter, categoryFilter, searchQuery]);

  // Get categories that exist in the current catalog (from products visible in this catalog)
  const catalogCategories = useMemo(() => {
    if (!selectedCatalog) return [];
    
    // Collect all unique category IDs from products in the current catalog
    const categoryIds = new Set<string>();
    
    displayProducts.forEach((p) => {
      // Check if product is in this catalog
      if (!productVisibility[p.id]?.has(selectedCatalog)) return;
      
      // Get catalog-specific categories for this product
      const catalogSettings = getProductSettings(selectedCatalog, p.id);
      const productCategories = catalogSettings?.categories || [];
      
      productCategories.forEach((catId) => categoryIds.add(catId));
    });
    
    // Filter the categories list to only include those that exist in this catalog
    return categories.filter((cat) => categoryIds.has(cat.id));
  }, [selectedCatalog, displayProducts, productVisibility, getProductSettings, categories]);

  // Handle add to cart
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
  };

  // Обработчик клика на кнопку админки — теперь переключает режим внутри страницы
  const handleAdminClick = (section?: string) => {
    if (workspaceMode && onSwitchToAdmin) {
      onSwitchToAdmin(section);
    } else {
      setViewMode('admin');
      setAdminSection(section);
    }
  };

  // Обработчик клика на иконку витрины — возврат к витрине
  const handleStoreClick = () => {
    setViewMode('storefront');
  };

  // Loading state - в workspaceMode данные магазина уже есть, показываем скелетон только при загрузке товаров
  // при этом избегаем двойного мигания, показывая скелетон только если нет товаров
  if (!workspaceMode && (storeLoading || productsLoading)) {
    return <StoreSkeleton />;
  }
  
  // В workspaceMode показываем скелетон только при первой загрузке товаров (когда products пуст)
  if (workspaceMode && productsLoading && products.length === 0) {
    return <StoreSkeleton />;
  }

  // Error state
  if (storeError || !store) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Магазин не найден</h1>
          <p className="text-muted-foreground mb-4">
            {storeError || "Магазин с таким адресом не существует или недоступен"}
          </p>
          <Button asChild>
            <Link to="/">На главную</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-background flex flex-col">
      {/* Шапка скрывается в workspaceMode - там свой общий хедер */}
      {!workspaceMode && (
        <StoreHeader
          store={store}
          cart={cart}
          catalogs={catalogs}
          selectedCatalog={selectedCatalog}
          onSelectCatalog={setSelectedCatalog}
          showImages={showImages}
          onToggleImages={() => setShowImages(!showImages)}
          isOwner={isOwner}
          isOwnerLoading={ownerLoading}
          filtersOpen={filtersOpen}
          onToggleFilters={() => setFiltersOpen(!filtersOpen)}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onAdminClick={handleAdminClick}
          ordersCount={orders.length}
          viewMode={viewMode}
          onStoreClick={handleStoreClick}
        />
      )}

      {/* Упрощённый хедер в workspaceMode */}
      {workspaceMode && (
        <div className="sticky top-0 z-40 bg-background border-b border-border">
          {/* Onboarding Step 1: Go to Admin Panel */}
          {onboardingStep1Active && (
            <div 
              className="bg-primary/10 border-b border-primary/30 p-3 cursor-pointer hover:bg-primary/15 transition-colors"
              onClick={() => {
                const adminButton = document.querySelector('[data-onboarding-admin-button]');
                if (adminButton) {
                  adminButton.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                  adminButton.classList.add('animate-pulse', 'ring-2', 'ring-primary', 'ring-offset-2', 'bg-primary/20');
                  setTimeout(() => {
                    adminButton.classList.remove('animate-pulse', 'ring-2', 'ring-primary', 'ring-offset-2', 'bg-primary/20');
                  }, 3000);
                }
              }}
            >
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-primary font-bold text-sm">1</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Добро пожаловать! Начнём обучение</p>
                  <p className="text-xs text-muted-foreground">
                    Зайдите в панель управления в раздел "Ассортимент" и создайте первый товар.
                  </p>
                  <p className="text-xs text-primary mt-1 font-medium">
                    👆 Нажмите на кнопку "Управление" в правом верхнем углу
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Onboarding Step 9 */}
          {onboardingStep9Active && onboardingStep9SubStep !== "done" && (
            <div className="bg-primary/10 border-b border-primary/30 p-3">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-primary font-bold text-sm">9</span>
                </div>
                <div className="flex-1">
                  {onboardingStep9SubStep === "catalog-trigger" && (
                    <>
                      <p className="text-sm font-medium text-foreground">Шаг 9.1: Откройте список прайс-листов</p>
                      <p className="text-xs text-muted-foreground">Нажмите на иконку папки, чтобы увидеть все ваши прайс-листы</p>
                      <p className="text-xs text-muted-foreground/70 mt-1">💡 Обновите страницу, если прайс-листа нет в списке</p>
                    </>
                  )}
                  {onboardingStep9SubStep === "catalog-item" && (
                    <>
                      <p className="text-sm font-medium text-foreground">Шаг 9.2: Выберите прайс-лист</p>
                      <p className="text-xs text-muted-foreground">Нажмите на созданный прайс-лист, чтобы открыть его</p>
                    </>
                  )}
                  <div className="flex gap-1 mt-2">
                    <div className={`h-1.5 w-8 rounded-full ${onboardingStep9SubStep === "catalog-item" ? 'bg-primary' : 'bg-muted'}`} />
                    <div className={`h-1.5 w-8 rounded-full bg-muted`} />
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Onboarding Step 10 */}
          {onboardingStep10Active && !onboardingStep10NameEdited && (
            <div className="bg-green-500/10 border-b border-green-500/30 p-3">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                  <span className="text-green-600 dark:text-green-400 font-bold text-sm">10</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Редактирование товаров</p>
                  <p className="text-xs text-muted-foreground">
                    Оперативно меняйте цены, статусы и другие данные о товаре в этом разделе.
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1 font-medium">
                    Нажмите на название товара и измените его, чтобы завершить обучение.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Onboarding Complete */}
          {onboardingStep10Active && onboardingStep10NameEdited && (
            <div className="bg-green-500/20 border-b border-green-500/50 p-3">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">✓</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-700 dark:text-green-300">Поздравляем! Обучение завершено 🎉</p>
                  <p className="text-xs text-muted-foreground">
                    Теперь вы знаете основы работы с платформой
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Панель управления с иконками */}
          <div className="h-10 flex items-center justify-between px-3 bg-muted/30">
            <div className="flex items-center gap-1">
              {/* Селектор прайс-листа */}
              <DropdownMenu onOpenChange={(open) => {
                if (open && onboardingStep9Active && onboardingStep9SubStep === "catalog-trigger") {
                  setOnboardingStep9SubStep("catalog-item");
                }
              }}>
                <DropdownMenuTrigger 
                  className={`p-2 rounded hover:bg-muted transition-colors ${onboardingStep9Active && onboardingStep9SubStep === "catalog-trigger" ? 'animate-pulse ring-2 ring-primary ring-offset-2 bg-primary/20' : ''}`}
                  data-onboarding-catalog-trigger
                >
                  <FolderOpen className="w-4 h-4 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[200px] bg-popover z-50">
                  <DropdownMenuItem 
                    onClick={() => setSelectedCatalog(null)}
                    className="cursor-pointer"
                  >
                    <span className={!selectedCatalog ? "font-semibold" : ""}>Все товары</span>
                  </DropdownMenuItem>
                  {catalogs.map((catalog, index) => (
                    <DropdownMenuItem
                      key={catalog.id}
                      onClick={() => {
                        setSelectedCatalog(catalog.id);
                        if (onboardingStep9Active && onboardingStep9SubStep === "catalog-item") {
                          setOnboardingStep9SubStep("done");
                          onOnboardingStep9Complete?.();
                        }
                      }}
                      className={`cursor-pointer ${onboardingStep9Active && onboardingStep9SubStep === "catalog-item" && index === 0 ? 'animate-pulse bg-primary/20 ring-1 ring-primary' : ''}`}
                      data-onboarding-catalog-item={index === 0 ? "first" : undefined}
                    >
                      <span className={selectedCatalog === catalog.id ? "font-semibold" : ""}>
                        {catalog.name}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Фильтр */}
              <button 
                onClick={() => setFiltersOpen(!filtersOpen)}
                className={`p-2 rounded transition-colors ${filtersOpen ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground'}`}
              >
                <Filter className="w-4 h-4" />
              </button>

              {/* Переключатель изображений */}
              <button 
                onClick={() => setShowImages(!showImages)}
                className={`p-2 rounded transition-colors ${showImages ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground'}`}
              >
                <Image className="w-4 h-4" />
              </button>
            </div>

            {/* Категории - центральная иконка */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button 
                  className={`p-2 rounded transition-colors ${categoryFilter ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground'}`}
                  title="Категории"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="min-w-[160px] max-h-[300px] overflow-y-auto">
                <DropdownMenuItem
                  onClick={() => setCategoryFilter(null)}
                  className={`cursor-pointer ${categoryFilter === null ? 'font-semibold bg-primary/10' : ''}`}
                >
                  Все товары
                </DropdownMenuItem>
                {catalogCategories.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    {catalogCategories.map((cat) => (
                      <DropdownMenuItem
                        key={cat.id}
                        onClick={() => setCategoryFilter(cat.id)}
                        className={`cursor-pointer ${categoryFilter === cat.id ? 'font-semibold bg-primary/10' : ''}`}
                      >
                        {cat.name}
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Выезжающий блок фильтров */}
          <Collapsible open={filtersOpen}>
            <CollapsibleContent>
              <div className="px-3 py-2 border-t border-border bg-muted/20 space-y-2">
                {/* Поиск */}
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchInputValue}
                    onChange={(e) => setSearchInputValue(e.target.value)}
                    placeholder="Поиск товаров..."
                    className="w-full h-8 pl-7 pr-3 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  {searchInputValue && (
                    <button 
                      onClick={() => {
                        setSearchInputValue("");
                        setSearchQuery("");
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                    >
                      <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                    </button>
                  )}
                </div>

                {/* Фильтр по категориям */}
                {categories.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                      <Tag className="w-3 h-3" />
                      Категория:
                    </span>
                    <div className="flex gap-1 flex-wrap">
                      <button
                        onClick={() => setCategoryFilter(null)}
                        className={`px-2 py-0.5 text-[10px] rounded-full transition-colors ${
                          categoryFilter === null
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                        }`}
                      >
                        Все
                      </button>
                      {categories.map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => setCategoryFilter(cat.id)}
                          className={`px-2 py-0.5 text-[10px] rounded-full transition-colors ${
                            categoryFilter === cat.id
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                          }`}
                        >
                          {cat.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Фильтр по статусу (только для владельца) */}
                {isOwner && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground uppercase">Статус:</span>
                    <div className="flex gap-1">
                      {[
                        { value: "all", label: "Все" },
                        { value: "in_stock", label: "В наличии" },
                        { value: "pre_order", label: "Под заказ" },
                        { value: "out_of_stock", label: "Нет в наличии" },
                        { value: "hidden", label: "Скрытые" },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setStatusFilter(opt.value)}
                          className={`px-2 py-0.5 text-[10px] rounded-full transition-colors ${
                            statusFilter === opt.value
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}

      {/* Админ-панель встроенная */}
      {viewMode === 'admin' && !workspaceMode && store?.id && (
        <div className="flex-1 overflow-auto">
          <AdminPanel 
            workspaceMode={true} 
            storeIdOverride={store.id}
            onSwitchToStorefront={handleStoreClick}
            initialSection={adminSection as any}
          />
        </div>
      )}

      {/* Витрина */}
      {viewMode === 'storefront' && (
        <main className="flex-1 overflow-auto">
        {filteredProducts.length > 0 ? (
          (() => {
            // Helper function to render a product card
            const renderProductCard = (product: StoreProduct) => {
              const catalogSettings = selectedCatalog ? getProductSettings(selectedCatalog, product.id) : undefined;
              return (
                <ProductCard 
                  key={product.id} 
                  product={product} 
                  cart={cart}
                  onAddToCart={handleAddToCart}
                  showImages={showImages}
                  catalogSettings={catalogSettings}
                  isOwner={isOwner}
                  isExpanded={expandedProductId === product.id}
                  onToggleExpand={() => {
                    setExpandedProductId(expandedProductId === product.id ? null : product.id);
                    if (expandedProductId !== product.id) {
                      setGalleryOpenProductId(null);
                    }
                  }}
                  onSave={handleSaveProduct}
                  catalogs={catalogs}
                  productCatalogIds={getProductCatalogIds(product.id)}
                  onCatalogsChange={handleCatalogsChange}
                  selectedCatalog={selectedCatalog}
                  onStatusChange={handleStatusChange}
                  onCatalogSettingsChange={updateProductSettings}
                  isGalleryOpen={galleryOpenProductId === product.id}
                  onToggleGallery={() => {
                    setGalleryOpenProductId(galleryOpenProductId === product.id ? null : product.id);
                    if (galleryOpenProductId !== product.id) {
                      setExpandedProductId(null);
                    }
                  }}
                  onImagesUpdate={handleImagesUpdate}
                  isOnboardingHighlighted={onboardingStep10Active && !onboardingStep10NameEdited && filteredProducts.indexOf(product) === 0}
                />
              );
            };

            // If search is active or category filter is selected - show flat list
            if (searchQuery.trim() || categoryFilter !== null) {
              return (
                <>
                  {searchQuery.trim() && (
                    <div className="px-3 py-2 bg-muted/50 border-b border-border">
                      <span className="text-sm text-muted-foreground">
                        Найдено: {filteredProducts.length} {filteredProducts.length === 1 ? 'товар' : filteredProducts.length < 5 ? 'товара' : 'товаров'}
                      </span>
                    </div>
                  )}
                  {categoryFilter !== null && !searchQuery.trim() && (
                    <div className="px-3 py-px bg-muted/50 border-b border-border">
                      <span className="text-[11px] font-medium text-foreground leading-none">
                        {catalogCategories.find(c => c.id === categoryFilter)?.name || 'Категория'}
                      </span>
                    </div>
                  )}
                  {filteredProducts.map(renderProductCard)}
                </>
              );
            }

            // Group products by category (sorted by category sort_order)
            const sortedCategories = [...catalogCategories].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
            
            return (
              <>
                {sortedCategories.map((category) => {
                  const categoryProducts = filteredProducts.filter((p) => {
                    const catalogSettings = selectedCatalog ? getProductSettings(selectedCatalog, p.id) : undefined;
                    const productCategories = catalogSettings?.categories || [];
                    return productCategories.includes(category.id);
                  });
                  
                  if (categoryProducts.length === 0) return null;
                  
                  return (
                    <div key={category.id}>
                      <div className="px-3 py-px bg-muted/50 border-b border-border sticky top-0 z-10">
                        <span className="text-[11px] font-medium text-foreground leading-none">{category.name}</span>
                      </div>
                      {categoryProducts.map(renderProductCard)}
                    </div>
                  );
                })}
                
                {/* Products without category */}
                {(() => {
                  const uncategorizedProducts = filteredProducts.filter((p) => {
                    const catalogSettings = selectedCatalog ? getProductSettings(selectedCatalog, p.id) : undefined;
                    const productCategories = catalogSettings?.categories || [];
                    return productCategories.length === 0;
                  });
                  
                  if (uncategorizedProducts.length === 0) return null;
                  
                  return (
                    <div>
                      {sortedCategories.length > 0 && (
                        <div className="px-3 py-px bg-muted/50 border-b border-border sticky top-0 z-10">
                          <span className="text-[11px] font-medium text-muted-foreground leading-none">Без категории</span>
                        </div>
                      )}
                      {uncategorizedProducts.map(renderProductCard)}
                    </div>
                  );
                })()}
              </>
            );
          })()
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            {/* Empty state for owner with no products at all */}
            {isOwner && displayProducts.length === 0 ? (
              <>
                <Package className="w-16 h-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Добавьте свой первый товар</h3>
                <p className="text-muted-foreground text-sm mb-4 max-w-xs">
                  Ваш ассортимент пока пуст. Добавьте товары, чтобы начать продажи.
                </p>
                <Button 
                  onClick={() => handleAdminClick('products')}
                  className="gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Добавить товар
                </Button>
              </>
            ) : (
              <>
                <FolderOpen className="w-12 h-12 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">
                  {selectedCatalog 
                    ? "В этом прайс-листе нет товаров"
                    : "Выберите прайс-лист для просмотра товаров"}
                </p>
                {!selectedCatalog && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Нажмите на иконку папки слева вверху
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </main>
      )}
    </div>
  );
}
