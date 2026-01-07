import { useEffect, useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ShoppingCart, Settings, FolderOpen, Filter, Image, ArrowLeft, Pencil, Search, X, Images, Tag, Store, Package, LayoutGrid } from "lucide-react";
import { ForkliftIcon } from "@/components/icons/ForkliftIcon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
  const inStock = effectiveStatus === "in_stock";
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
      className={`flex gap-1.5 px-1.5 py-0.5 bg-background ${showImages ? 'h-[calc((100vh-88px)/8)] min-h-[72px]' : 'h-9 min-h-[36px]'} ${isHidden ? 'opacity-60' : ''}`}
    >
      {/* Изображение */}
      {showImages && (
        <div 
          className={`relative w-14 h-14 flex-shrink-0 rounded overflow-hidden bg-muted self-center ${isOwner ? 'cursor-pointer' : ''}`}
          onClick={isOwner && onToggleGallery ? onToggleGallery : undefined}
        >
          <img
            src={firstImage}
            alt={product.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/placeholder.svg";
            }}
          />
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
      <div className={`flex-1 min-w-0 flex ${showImages ? 'flex-col justify-center gap-0' : 'flex-row items-center gap-2'}`}>
        {/* Название */}
        <div className={`relative overflow-hidden ${showImages ? '' : 'flex-1 min-w-0 mr-2'}`}>
          <h3 
            className={`font-medium text-foreground leading-tight ${showImages ? 'text-xs pr-6 whitespace-nowrap' : 'text-[11px] truncate'} ${isOwner ? 'cursor-pointer hover:text-primary transition-colors' : ''}`}
            onClick={isOwner && onToggleExpand ? () => onToggleExpand() : undefined}
          >
            {product.name}
            {isOwner && isHidden && (
              <Badge variant="outline" className="ml-1 text-[8px] py-0 px-1 bg-muted/50 text-muted-foreground border-dashed">
                Скрыт
              </Badge>
            )}
            {isOwner && (
              <Pencil className="inline-block ml-1 w-3 h-3 text-muted-foreground" />
            )}
          </h3>
          {showImages && <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-background to-transparent" />}
        </div>

        {/* Цена за кг и объём - только при показе изображений */}
        {showImages && (
          <p className="text-muted-foreground leading-tight text-[10px]">
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
        <div className={`flex items-center gap-0.5 flex-shrink-0 ${showImages ? 'mt-0.5 flex-wrap' : ''}`}>
          {/* Статус бейдж для "нет в наличии" или "скрыт" */}
          {effectiveStatus === "out_of_stock" && (
            <Badge variant="secondary" className="text-[9px] h-6 mr-1">
              Нет в наличии
            </Badge>
          )}
          
          {/* Кнопки покупки - всегда показываем, но disabled если не in_stock */}
          {packagingPrices ? (
            <>
              {/* Целая */}
              {(() => {
                const qty = getCartQuantity(0);
                return (
                  <button
                    onClick={() => inStock && onAddToCart(product.id, 0, packagingPrices.full)}
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
                    <span className="text-[9px] font-medium text-foreground">
                      {formatPriceSpaced(packagingPrices.full)}
                    </span>
                  </button>
                );
              })()}
              {/* Половина */}
              {(() => {
                const qty = getCartQuantity(1);
                return (
                  <button
                    onClick={() => inStock && onAddToCart(product.id, 1, packagingPrices.half)}
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
                    <span className="text-[9px] font-medium text-foreground">
                      {formatPriceSpaced(packagingPrices.half)}
                    </span>
                  </button>
                );
              })()}
              {/* Четверть */}
              {(() => {
                const qty = getCartQuantity(2);
                return (
                  <button
                    onClick={() => inStock && onAddToCart(product.id, 2, packagingPrices.quarter)}
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
                    <span className="text-[9px] font-medium text-foreground">
                      {formatPriceSpaced(packagingPrices.quarter)}
                    </span>
                  </button>
                );
              })()}
              {/* Порция - показываем если есть price_portion (из каталога или товара) */}
              {portionPricePortion && (
                (() => {
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
                      <span className="text-[9px] font-medium text-foreground">
                        {formatPriceSpaced(portionPricePortion)}
                      </span>
                    </button>
                  );
                })()
              )}
            </>
          ) : (
            // Простая кнопка для товаров без вариантов фасовки
            (() => {
              const qty = getCartQuantity(0);
              return (
                <button
                  onClick={() => inStock && onAddToCart(product.id, 0, salePrice)}
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
                  <span className="text-[9px] font-medium text-foreground">
                    {formatPriceSpaced(salePrice)}
                  </span>
                </button>
              );
            })()
          )}
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

        {/* Название выбранного каталога */}
        <span className="text-xs text-muted-foreground">
          {selectedCatalogName}
        </span>
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
}

// Main StoreFront Component
export default function StoreFront({ workspaceMode, storeData, onSwitchToAdmin }: StoreFrontProps = {}) {
  const { subdomain } = useParams<{ subdomain: string }>();
  const navigate = useNavigate();
  const { isSuperAdmin } = useAuth();
  
  // В режиме workspace используем переданные данные магазина
  const { store: fetchedStore, loading: storeLoading, error: storeError } = useStoreBySubdomain(workspaceMode ? undefined : subdomain);
  const store = workspaceMode ? storeData : fetchedStore;
  
  const { isOwner: isStoreOwner, loading: ownerLoading } = useIsStoreOwner(store?.id || null);
  const { products, loading: productsLoading, updateProduct } = useStoreProducts(store?.id || null);
  const { catalogs, productVisibility, setProductCatalogs } = useStoreCatalogs(store?.id || null);
  const { settings: catalogProductSettings, getProductSettings, updateProductSettings } = useCatalogProductSettings(store?.id || null);
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
  const [viewMode, setViewMode] = useState<'storefront' | 'admin'>('storefront');
  const [adminSection, setAdminSection] = useState<string | undefined>(undefined);

  // Use products directly from hook - realtime handles sync
  const displayProducts = products;

  // Get product catalog IDs for a specific product
  const getProductCatalogIds = (productId: string): string[] => {
    const visibility = productVisibility[productId];
    return visibility ? Array.from(visibility) : [];
  };

  // Handle save product
  const handleSaveProduct = async (productId: string, updates: Partial<StoreProduct>) => {
    return await updateProduct(productId, updates);
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
          {/* Панель управления с иконками */}
          <div className="h-10 flex items-center justify-between px-3 bg-muted/30">
            <div className="flex items-center gap-1">
              {/* Селектор прайс-листа */}
              <DropdownMenu>
                <DropdownMenuTrigger className="p-2 rounded hover:bg-muted transition-colors">
                  <FolderOpen className="w-4 h-4 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[200px] bg-popover z-50">
                  <DropdownMenuItem 
                    onClick={() => setSelectedCatalog(null)}
                    className="cursor-pointer"
                  >
                    <span className={!selectedCatalog ? "font-semibold" : ""}>Все товары</span>
                  </DropdownMenuItem>
                  {catalogs.map((catalog) => (
                    <DropdownMenuItem
                      key={catalog.id}
                      onClick={() => setSelectedCatalog(catalog.id)}
                      className="cursor-pointer"
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
            <button 
              className="p-2 rounded hover:bg-muted transition-colors text-muted-foreground"
              title="Категории"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
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
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Поиск товаров..."
                    className="w-full h-8 pl-7 pr-3 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery("")}
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
          filteredProducts.map((product) => {
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
                  // Close gallery when opening edit panel
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
                  // Close edit panel when opening gallery
                  if (galleryOpenProductId !== product.id) {
                    setExpandedProductId(null);
                  }
                }}
                onImagesUpdate={handleImagesUpdate}
              />
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
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
          </div>
        )}
      </main>
      )}
    </div>
  );
}
