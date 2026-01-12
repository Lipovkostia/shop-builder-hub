import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ShoppingCart, Settings, FolderOpen, Filter, Image, ArrowLeft, Pencil, Search, X, Images, Tag, Store as StoreIcon, Package, LayoutGrid, Plus, LogIn, Sparkles, Users, Link2, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ForkliftIcon } from "@/components/icons/ForkliftIcon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
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
import { useOnboarding } from "@/contexts/OnboardingContext";
import { OnboardingBanner } from "@/components/onboarding/OnboardingBanner";

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

  // Вычисляем fullPrice напрямую, как у покупателя — работает для всех типов товаров
  const unitWeight = product.unit_weight || 1;
  const fullPrice = unitWeight > 0 ? salePrice * unitWeight : null;

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
      className={`flex gap-1.5 px-1.5 py-1.5 bg-background ${showImages ? 'min-h-[80px]' : 'min-h-[40px]'} ${isHidden ? 'opacity-60' : ''}`}
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
            {isOwner && (
              <Pencil className={`inline-block mr-1 w-3 h-3 ${isOnboardingHighlighted ? 'text-primary' : 'text-muted-foreground'}`} />
            )}
            {product.name}
          </h3>
          {showImages && <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-background to-transparent" />}
        </div>

        {/* Цена и кнопки */}
        {showImages ? (
          <>
            {/* С фото: цена отдельно */}
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
            {/* С фото: кнопки отдельно */}
            <div className="flex items-center gap-0.5 flex-shrink-0 mt-0.5 flex-wrap justify-end ml-auto flex-row-reverse">
              {/* Кнопки покупки - всегда показываем, но disabled если не in_stock */}
              {/* Целая - всегда показываем */}
              {(() => {
                const qty = getCartQuantity(0);
                const btnFullPrice = (product.unit_weight || 1) * salePrice;
                return (
                  <button
                    onClick={() => inStock && onAddToCart(product.id, 0, btnFullPrice)}
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
                      {formatPriceSpaced(btnFullPrice)}
                    </span>
                  </button>
                );
              })()}
              
              {/* Половина */}
              {portionPriceHalf && portionPriceHalf > 0 && (() => {
                const qty = getCartQuantity(1);
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
              
              {/* Четверть */}
              {portionPriceQuarter && portionPriceQuarter > 0 && (() => {
                const qty = getCartQuantity(2);
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
              
              {/* Порция */}
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
          </>
        ) : (
          /* Без фото: цена и кнопки в одной строке */
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <span className="text-muted-foreground text-[11px] whitespace-nowrap">
              {formatPrice(salePrice)}/{unit}
            </span>
            <div className="flex items-center gap-0.5 flex-shrink-0 flex-row-reverse">
              {/* Целая */}
              {(() => {
                const qty = getCartQuantity(0);
                const btnFullPrice = (product.unit_weight || 1) * salePrice;
                return (
                  <button
                    onClick={() => inStock && onAddToCart(product.id, 0, btnFullPrice)}
                    disabled={!inStock}
                    className={`relative flex items-center gap-1 h-6 px-1.5 rounded border transition-all ${
                      inStock 
                        ? 'border-border hover:border-primary hover:bg-primary/5' 
                        : 'border-border/50 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    {qty > 0 && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary text-primary-foreground text-[8px] font-bold rounded-full flex items-center justify-center">
                        {qty}
                      </span>
                    )}
                    <PortionIndicator type="full" />
                    <span className="text-xs font-medium text-foreground">
                      {formatPriceSpaced(btnFullPrice)}
                    </span>
                  </button>
                );
              })()}
              
              {/* Половина */}
              {portionPriceHalf && portionPriceHalf > 0 && (() => {
                const qty = getCartQuantity(1);
                const halfWeight = (product.unit_weight || 1) / 2;
                const halfPrice = halfWeight * portionPriceHalf;
                return (
                  <button
                    onClick={() => inStock && onAddToCart(product.id, 1, halfPrice)}
                    disabled={!inStock}
                    className={`relative flex items-center gap-1 h-6 px-1.5 rounded border transition-all ${
                      inStock 
                        ? 'border-border hover:border-primary hover:bg-primary/5' 
                        : 'border-border/50 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    {qty > 0 && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary text-primary-foreground text-[8px] font-bold rounded-full flex items-center justify-center">
                        {qty}
                      </span>
                    )}
                    <PortionIndicator type="half" />
                    <span className="text-xs font-medium text-foreground">
                      {formatPriceSpaced(halfPrice)}
                    </span>
                  </button>
                );
              })()}
              
              {/* Четверть */}
              {portionPriceQuarter && portionPriceQuarter > 0 && (() => {
                const qty = getCartQuantity(2);
                const quarterWeight = (product.unit_weight || 1) / 4;
                const quarterPrice = quarterWeight * portionPriceQuarter;
                return (
                  <button
                    onClick={() => inStock && onAddToCart(product.id, 2, quarterPrice)}
                    disabled={!inStock}
                    className={`relative flex items-center gap-1 h-6 px-1.5 rounded border transition-all ${
                      inStock 
                        ? 'border-border hover:border-primary hover:bg-primary/5' 
                        : 'border-border/50 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    {qty > 0 && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary text-primary-foreground text-[8px] font-bold rounded-full flex items-center justify-center">
                        {qty}
                      </span>
                    )}
                    <PortionIndicator type="quarter" />
                    <span className="text-xs font-medium text-foreground">
                      {formatPriceSpaced(quarterPrice)}
                    </span>
                  </button>
                );
              })()}
              
              {/* Порция */}
              {portionPricePortion && portionPricePortion > 0 && (() => {
                const qty = getCartQuantity(3);
                return (
                  <button
                    onClick={() => inStock && onAddToCart(product.id, 3, portionPricePortion)}
                    disabled={!inStock}
                    className={`relative flex items-center gap-1 h-6 px-1.5 rounded border transition-all ${
                      inStock 
                        ? 'border-border hover:border-primary hover:bg-primary/5' 
                        : 'border-border/50 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    {qty > 0 && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary text-primary-foreground text-[8px] font-bold rounded-full flex items-center justify-center">
                        {qty}
                      </span>
                    )}
                    <PortionIndicator type="portion" />
                    <span className="text-xs font-medium text-foreground">
                      {formatPriceSpaced(portionPricePortion)}
                    </span>
                  </button>
                );
              })()}
            </div>
          </div>
        )}
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
  onCreateCatalog,
  ordersCount,
  viewMode,
  onStoreClick,
  catalogDropdownOpen,
  setCatalogDropdownOpen,
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
  onCreateCatalog?: () => void;
  ordersCount?: number;
  viewMode?: 'storefront' | 'admin';
  onStoreClick?: () => void;
  catalogDropdownOpen?: boolean;
  setCatalogDropdownOpen?: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const selectedCatalogName = catalogs.find((c) => c.id === selectedCatalog)?.name || "Все товары";

  const handleCopyLink = () => {
    const catalog = catalogs.find(c => c.id === selectedCatalog);
    if (catalog?.access_code) {
      const url = `${window.location.origin}/catalog/${catalog.access_code}`;
      navigator.clipboard.writeText(url);
      toast({
        title: "Ссылка скопирована",
        description: "Ссылка на прайс-лист скопирована в буфер обмена",
      });
    }
  };

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
            <StoreIcon className={`w-5 h-5 ${viewMode === 'storefront' ? 'text-primary' : 'text-muted-foreground'}`} />
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
          <DropdownMenu open={catalogDropdownOpen} onOpenChange={setCatalogDropdownOpen}>
            <DropdownMenuTrigger 
              className="p-2 rounded hover:bg-muted transition-colors"
              data-onboarding="catalog-folder"
            >
              <FolderOpen className="w-4 h-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              align="start" 
              className="min-w-[200px] bg-popover z-50"
              data-onboarding="catalog-dropdown-content"
            >
              {/* Кнопка создания прайс-листа - только для владельца */}
              {isOwner && (
                <>
                  <DropdownMenuItem
                    onClick={() => onCreateCatalog?.()}
                    className="cursor-pointer text-primary"
                    data-onboarding="create-catalog-button"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    <span>Создать прайс-лист</span>
                  </DropdownMenuItem>
                  {catalogs.length > 0 && <DropdownMenuSeparator />}
                </>
              )}
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
              {catalogs.length === 0 && !isOwner && (
                <DropdownMenuItem disabled>
                  <span className="text-muted-foreground">Нет доступных прайс-листов</span>
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
        <button
          onClick={handleCopyLink}
          className="w-full flex items-center justify-end gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          title="Скопировать ссылку на прайс-лист"
        >
          <span className="truncate">
            {store.name} — {selectedCatalogName}
          </span>
          <Copy className="w-3.5 h-3.5 flex-shrink-0 text-primary/70" />
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
}

// Main StoreFront Component
export default function StoreFront({ workspaceMode, storeData, onSwitchToAdmin }: StoreFrontProps = {}) {
  const { subdomain } = useParams<{ subdomain: string }>();
  const navigate = useNavigate();
  const { user, profile, isSuperAdmin, loading: authLoading } = useAuth();
  
  // В режиме workspace используем переданные данные магазина
  const { store: fetchedStore, loading: storeLoading, error: storeError } = useStoreBySubdomain(workspaceMode ? undefined : subdomain);
  const store = workspaceMode ? storeData : fetchedStore;
  
  const { isOwner: isStoreOwner, loading: ownerLoading } = useIsStoreOwner(store?.id || null);
  const { products, loading: productsLoading, updateProduct, createProduct } = useStoreProducts(store?.id || null);
  const { catalogs, productVisibility, setProductCatalogs, createCatalog, refetch: refetchCatalogs } = useStoreCatalogs(store?.id || null);
  const { settings: catalogProductSettings, getProductSettings, updateProductSettings, refetch: refetchCatalogSettings } = useCatalogProductSettings(store?.id || null);
  const { categories } = useStoreCategories(store?.id || null);
  
  // Check for temp super admin from localStorage (used when super admin navigates from super admin panel)
  const isTempSuperAdmin = typeof window !== 'undefined' && localStorage.getItem('temp_super_admin') === 'true';
  
  // Super admin or store owner can manage the store
  const isOwner = isStoreOwner || isSuperAdmin || isTempSuperAdmin;
  
  // Customer access state - check if user is a registered customer of this store
  const [customerAccess, setCustomerAccess] = useState<{
    isCustomer: boolean;
    accessibleCatalogIds: string[];
    loading: boolean;
  }>({ isCustomer: false, accessibleCatalogIds: [], loading: true });

  // Check customer access when user/store changes
  useEffect(() => {
    const checkCustomerAccess = async () => {
      // In workspace mode, skip customer access check (owner is viewing)
      if (workspaceMode) {
        setCustomerAccess({ isCustomer: true, accessibleCatalogIds: [], loading: false });
        return;
      }
      
      // If already an owner/admin, grant full access
      if (isOwner) {
        setCustomerAccess({ isCustomer: true, accessibleCatalogIds: [], loading: false });
        return;
      }
      
      // If not logged in, no access
      if (!user || !profile?.id || !store?.id) {
        setCustomerAccess({ isCustomer: false, accessibleCatalogIds: [], loading: false });
        return;
      }

      try {
        // Check if user is a customer of this store and get their catalog access
        const { data: storeCustomer, error } = await supabase
          .from('store_customers')
          .select(`
            id,
            customer_catalog_access(catalog_id)
          `)
          .eq('store_id', store.id)
          .eq('profile_id', profile.id)
          .maybeSingle();

        if (error) {
          console.error("Error checking customer access:", error);
          setCustomerAccess({ isCustomer: false, accessibleCatalogIds: [], loading: false });
          return;
        }

        if (storeCustomer) {
          const catalogIds = storeCustomer.customer_catalog_access?.map((a: any) => a.catalog_id) || [];
          setCustomerAccess({ isCustomer: true, accessibleCatalogIds: catalogIds, loading: false });
        } else {
          setCustomerAccess({ isCustomer: false, accessibleCatalogIds: [], loading: false });
        }
      } catch (err) {
        console.error("Error checking customer access:", err);
        setCustomerAccess({ isCustomer: false, accessibleCatalogIds: [], loading: false });
      }
    };

    // Only check after auth and owner loading are complete
    if (!authLoading && !ownerLoading) {
      checkCustomerAccess();
    }
  }, [user, profile?.id, store?.id, isOwner, workspaceMode, authLoading, ownerLoading]);
  
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
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Состояние диалога создания товара
  const [isNewProductDialogOpen, setIsNewProductDialogOpen] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);

  // Состояние диалога создания прайс-листа
  const [isNewCatalogDialogOpen, setIsNewCatalogDialogOpen] = useState(false);
  const [newCatalogName, setNewCatalogName] = useState("");
  const [isCreatingCatalog, setIsCreatingCatalog] = useState(false);
  const newCatalogInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  // Отложенный фокус для избежания дёргания клавиатуры на мобильных
  useEffect(() => {
    if (isNewCatalogDialogOpen && newCatalogInputRef.current) {
      const timer = setTimeout(() => {
        newCatalogInputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isNewCatalogDialogOpen]);
  
  // Состояние dropdown каталогов для онбординга
  const [catalogDropdownOpen, setCatalogDropdownOpen] = useState(false);
  
  // Получаем контекст онбординга
  const { currentStep, isActive: isOnboardingActive, nextStep, startOnboarding, completedSteps } = useOnboarding();
  
  // Эффект для автооткрытия dropdown при онбординге
  useEffect(() => {
    if (isOnboardingActive && currentStep?.id === 'create-pricelist' && currentStep.autoOpenDropdown) {
      // Небольшая задержка для инициализации UI
      const timer = setTimeout(() => {
        setCatalogDropdownOpen(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOnboardingActive, currentStep]);
  
  // Обработчик создания прайс-листа с переходом к следующему шагу
  const handleCreateCatalogClick = () => {
    setIsNewCatalogDialogOpen(true);
    setCatalogDropdownOpen(false);
    // Переходим к следующему шагу онбординга после открытия диалога
    if (isOnboardingActive && currentStep?.id === 'create-pricelist') {
      nextStep();
    }
  };

  // Обработчик создания нового товара
  const handleCreateNewProduct = async () => {
    if (!newProductName.trim() || !selectedCatalog) return;
    
    setIsCreatingProduct(true);
    try {
      // Создаём товар
      const newProduct = await createProduct({ name: newProductName.trim() });
      
      if (newProduct) {
        // Привязываем к выбранному каталогу
        await setProductCatalogs(newProduct.id, [selectedCatalog]);
        
        // Закрываем диалог и сбрасываем поле
        setIsNewProductDialogOpen(false);
        setNewProductName("");
        
        // Переходим к следующему шагу онбординга и раскрываем карточку
        if (isOnboardingActive && currentStep?.id === 'create-product') {
          nextStep();
          // Раскрываем созданную карточку товара
          setExpandedProductId(newProduct.id);
        }
      }
    } finally {
      setIsCreatingProduct(false);
    }
  };

  // Обработчик создания нового прайс-листа
  const handleCreateNewCatalog = async () => {
    if (!newCatalogName.trim()) return;
    
    setIsCreatingCatalog(true);
    try {
      const newCatalog = await createCatalog(newCatalogName.trim());
      
      if (newCatalog) {
        // Выбираем новый прайс-лист
        setSelectedCatalog(newCatalog.id);
        
        // Закрываем диалог и сбрасываем поле
        setIsNewCatalogDialogOpen(false);
        setNewCatalogName("");
      }
    } finally {
      setIsCreatingCatalog(false);
    }
  };

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
  

  // Use products directly from hook - realtime handles sync
  const displayProducts = products;
  
  // Автоматически запускаем онбординг для новых пользователей (у которых нет продуктов и каталогов)
  useEffect(() => {
    if (isOwner && displayProducts.length === 0 && catalogs.length === 0 && !isOnboardingActive && completedSteps.length === 0) {
      // Запускаем онбординг с небольшой задержкой для инициализации UI
      const timer = setTimeout(() => {
        startOnboarding();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isOwner, displayProducts.length, catalogs.length, isOnboardingActive, completedSteps.length, startOnboarding]);
  // Filter catalogs for customers - they only see catalogs they have access to
  // Owners/admins see all catalogs
  const accessibleCatalogs = useMemo(() => {
    if (isOwner || workspaceMode) {
      return catalogs;
    }
    // For customers, filter to only their accessible catalogs
    if (customerAccess.accessibleCatalogIds.length > 0) {
      return catalogs.filter(c => customerAccess.accessibleCatalogIds.includes(c.id));
    }
    // If customer has no specific catalog access, show default catalogs only
    return catalogs.filter(c => c.is_default);
  }, [catalogs, isOwner, workspaceMode, customerAccess.accessibleCatalogIds]);
  
  // Calculate selected catalog name for display
  const selectedCatalogName = accessibleCatalogs.find((c) => c.id === selectedCatalog)?.name || "Все товары";

  // Get product catalog IDs for a specific product
  const getProductCatalogIds = (productId: string): string[] => {
    const visibility = productVisibility[productId];
    return visibility ? Array.from(visibility) : [];
  };

  // Handle save product
  const handleSaveProduct = async (productId: string, updates: Partial<StoreProduct>) => {
    const result = await updateProduct(productId, updates);
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

  // Show catalog hint when no catalog selected and there are catalogs to choose from
  const showCatalogHint = !selectedCatalog && accessibleCatalogs.length > 0 && displayProducts.length > 0;

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
    if (workspaceMode) {
      // В workspaceMode переключение происходит через родительский компонент
      onSwitchToAdmin?.(section);
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
  if (!workspaceMode && (storeLoading || productsLoading || customerAccess.loading || authLoading)) {
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

  // Access denied - show login prompt for non-authorized users (not in workspaceMode)
  if (!workspaceMode && !isOwner && !customerAccess.isCustomer) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
            {store.logo_url ? (
              <img src={store.logo_url} alt={store.name} className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <StoreIcon className="w-10 h-10 text-muted-foreground" />
            )}
          </div>
          <h1 className="text-2xl font-bold mb-2">{store.name}</h1>
          {store.description && (
            <p className="text-muted-foreground mb-6">{store.description}</p>
          )}
          <div className="bg-muted/50 rounded-lg p-4 mb-6">
            <p className="text-sm text-muted-foreground">
              Для просмотра каталога товаров необходимо войти в систему как покупатель этого магазина.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <Button 
              onClick={() => navigate('/?tab=customer')}
              className="w-full gap-2"
            >
              <LogIn className="w-4 h-4" />
              Войти как покупатель
            </Button>
            <Button variant="outline" asChild className="w-full">
              <Link to="/">На главную</Link>
            </Button>
          </div>
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
          catalogs={accessibleCatalogs}
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
          onCreateCatalog={() => setIsNewCatalogDialogOpen(true)}
          ordersCount={orders.length}
          viewMode={viewMode}
          onStoreClick={handleStoreClick}
        />
      )}

      {/* Упрощённый хедер в workspaceMode */}
      {workspaceMode && (
        <div className="sticky top-0 z-40 bg-background border-b border-border">
          
          {/* Панель управления с иконками */}
          <div className="h-10 flex items-center px-3 bg-muted/30 overflow-hidden">
            {/* Левая часть - иконки (сворачивается при поиске) */}
            <div 
              className={`flex items-center gap-1 transition-all duration-300 ease-in-out ${
                isSearchFocused ? 'w-0 opacity-0 overflow-hidden' : 'w-auto opacity-100'
              }`}
            >
              {/* Селектор прайс-листа */}
              <DropdownMenu open={catalogDropdownOpen} onOpenChange={setCatalogDropdownOpen}>
                <DropdownMenuTrigger 
                  className={`p-2 rounded hover:bg-muted transition-colors relative ${
                    showCatalogHint 
                      ? 'animate-attention-pulse bg-primary/20 ring-2 ring-primary z-20' 
                      : ''
                  }`}
                  data-onboarding="catalog-folder"
                >
                  <FolderOpen className={`w-4 h-4 ${showCatalogHint ? 'text-primary' : 'text-muted-foreground'}`} />
                  
                  {/* Прыгающая стрелка указывающая на иконку */}
                  {showCatalogHint && (
                    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-1 flex items-center animate-bounce-arrow pointer-events-none">
                      <svg 
                        className="w-5 h-5 text-primary" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={2.5} 
                          d="M11 17l-5-5m0 0l5-5m-5 5h12" 
                        />
                      </svg>
                    </div>
                  )}
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  align="start" 
                  className="min-w-[200px] bg-popover z-50"
                  data-onboarding="catalog-dropdown-content"
                >
                  {/* Кнопка создания прайс-листа - только для владельца */}
                  {isOwner && (
                    <>
                      <DropdownMenuItem
                        onClick={handleCreateCatalogClick}
                        className="cursor-pointer text-primary"
                        data-onboarding="create-catalog-button"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        <span>Создать прайс-лист</span>
                      </DropdownMenuItem>
                      {accessibleCatalogs.length > 0 && <DropdownMenuSeparator />}
                    </>
                  )}
                  {accessibleCatalogs.map((catalog, index) => (
                    <DropdownMenuItem
                      key={catalog.id}
                      onClick={() => {
                        setSelectedCatalog(catalog.id);
                      }}
                      className="cursor-pointer"
                    >
                      <span className={selectedCatalog === catalog.id ? "font-semibold" : ""}>
                        {catalog.name}
                      </span>
                    </DropdownMenuItem>
                  ))}
                  {accessibleCatalogs.length === 0 && !isOwner && (
                    <DropdownMenuItem disabled>
                      <span className="text-muted-foreground">Нет доступных прайс-листов</span>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Кнопка добавления нового товара - только для владельца и когда выбран каталог */}
              {isOwner && selectedCatalog && (
                <button 
                  onClick={() => setIsNewProductDialogOpen(true)}
                  className={`p-2 rounded transition-colors ${
                    filteredProducts.length === 0 
                      ? 'animate-attention-pulse bg-primary/20 text-primary ring-2 ring-primary' 
                      : 'hover:bg-muted text-muted-foreground hover:text-primary'
                  }`}
                  title="Добавить товар"
                  data-onboarding="add-product-button"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}

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

            {/* Центральная часть - анимированный поиск */}
            <div className={`flex items-center transition-all duration-300 ease-in-out ${
              isSearchFocused ? 'flex-1 mx-0' : 'flex-1 mx-2'
            }`}>
              <div 
                className={`flex items-center gap-2 bg-background border border-border rounded-full transition-all duration-300 ease-in-out cursor-text ${
                  isSearchFocused ? 'w-full px-3 py-1.5' : 'w-8 h-8 justify-center px-0'
                }`}
                onClick={() => {
                  setIsSearchFocused(true);
                  setTimeout(() => searchInputRef.current?.focus(), 50);
                }}
              >
                <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Поиск товара..."
                  value={searchInputValue}
                  onChange={(e) => setSearchInputValue(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => {
                    if (!searchInputValue) {
                      setIsSearchFocused(false);
                    }
                  }}
                  className={`bg-transparent outline-none text-sm transition-all duration-300 ease-in-out ${
                    isSearchFocused ? 'w-full opacity-100' : 'w-0 opacity-0'
                  }`}
                />
                {isSearchFocused && searchInputValue && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSearchInputValue('');
                      setSearchQuery('');
                      searchInputRef.current?.focus();
                    }}
                    className="p-0.5 hover:bg-muted rounded-full"
                  >
                    <X className="w-3 h-3 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>

            {/* Правая часть - категории (сворачивается при поиске) */}
            <div 
              className={`flex items-center transition-all duration-300 ease-in-out ${
                isSearchFocused ? 'w-0 opacity-0 overflow-hidden' : 'w-auto opacity-100'
              }`}
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button 
                    className={`p-2 rounded transition-colors ${categoryFilter ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground'}`}
                    title="Категории"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[160px] max-h-[300px] overflow-y-auto">
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
          </div>

          {/* Баннер онбординга - под блоком с иконками */}
          <OnboardingBanner />

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
                  isOnboardingHighlighted={false}
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
                    <div className="flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-muted/40 to-transparent border-b border-border/50 sticky top-0 z-10 backdrop-blur-sm">
                      <div className="w-0.5 h-3 rounded-full bg-primary/70" />
                      <span className="text-[11px] font-semibold text-foreground/80 uppercase tracking-wider">
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
                      <div className="flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-muted/40 to-transparent border-b border-border/50 sticky top-0 z-10 backdrop-blur-sm">
                        <div className="w-0.5 h-3 rounded-full bg-primary/70" />
                        <span className="text-[11px] font-semibold text-foreground/80 uppercase tracking-wider">{category.name}</span>
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
                        <div className="flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-muted/40 to-transparent border-b border-border/50 sticky top-0 z-10 backdrop-blur-sm">
                          <div className="w-0.5 h-3 rounded-full bg-muted-foreground/50" />
                          <span className="text-[11px] font-semibold text-muted-foreground/80 uppercase tracking-wider">Без категории</span>
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
            {/* Welcome onboarding for owner with no products */}
            {isOwner && displayProducts.length === 0 && catalogs.length === 0 ? (
              <div className="max-w-md mx-auto space-y-6">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-8 h-8 text-primary" />
                  </div>
                  <h2 className="text-xl font-semibold mb-2">Добро пожаловать!</h2>
                  <p className="text-muted-foreground text-sm">
                    Главная идея сервиса:
                  </p>
                  <p className="text-lg font-semibold text-primary mt-1">
                    ✨ Каждый тип покупателей видит свои цены
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                      <Users className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Рестораны — одни цены</p>
                      <p className="text-xs text-muted-foreground">Например, наценка 25%</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                      <Tag className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Оптовики — другие цены</p>
                      <p className="text-xs text-muted-foreground">Например, наценка 15%</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                      <Link2 className="w-4 h-4 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Делитесь ссылками на прайс-листы</p>
                      <p className="text-xs text-muted-foreground">Покупатель видит только свои цены</p>
                    </div>
                  </div>
                </div>

                <div className="text-center text-xs text-muted-foreground bg-primary/5 rounded-lg p-3">
                  <p>Меняйте цены и статусы товаров</p>
                  <p>оперативно для любого типа покупателей</p>
                </div>

              </div>
            ) : isOwner && displayProducts.length === 0 ? (
              <>
                <Package className="w-16 h-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Добавьте товары в прайс-лист</h3>
                <p className="text-muted-foreground text-sm mb-4 max-w-xs">
                  Выберите прайс-лист и добавьте в него товары.
                </p>
                <Button 
                  onClick={() => handleAdminClick('products')}
                  className="gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Перейти к товарам
                </Button>
              </>
            ) : (
              <>
                <FolderOpen className={`w-12 h-12 mb-3 ${showCatalogHint ? 'text-primary animate-pulse' : 'text-muted-foreground'}`} />
                <p className={`text-lg font-medium mb-1 ${showCatalogHint ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {selectedCatalog 
                    ? "Добавь товар в этот прайс лист"
                    : "Выберите прайс-лист"}
                </p>
                {selectedCatalog && (
                  <div className="flex items-center gap-2 text-primary animate-bounce mt-2">
                    <span className="text-sm font-medium">Нажми на кнопку</span>
                    <svg 
                      className="w-5 h-5 rotate-[-45deg]" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2.5} 
                        d="M5 10l7-7m0 0l7 7m-7-7v18" 
                      />
                    </svg>
                  </div>
                )}
                {!selectedCatalog && (
                  <>
                    <p className="text-muted-foreground text-sm mb-4">
                      Для просмотра товаров
                    </p>
                    <div className="flex items-center gap-2 text-primary animate-bounce">
                      <svg 
                        className="w-5 h-5 rotate-[-135deg]" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={2.5} 
                          d="M5 10l7-7m0 0l7 7m-7-7v18" 
                        />
                      </svg>
                      <span className="text-sm font-medium">Нажмите на иконку папки</span>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </main>
      )}

      {/* Диалог создания нового товара */}
      <Dialog open={isNewProductDialogOpen} onOpenChange={setIsNewProductDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Новый товар</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Название товара"
              value={newProductName}
              onChange={(e) => setNewProductName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newProductName.trim()) {
                  handleCreateNewProduct();
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsNewProductDialogOpen(false)}
            >
              Отмена
            </Button>
            <Button 
              onClick={handleCreateNewProduct}
              disabled={!newProductName.trim() || isCreatingProduct}
            >
              {isCreatingProduct ? "Создание..." : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Диалог создания нового прайс-листа */}
      {isMobile ? (
        <Drawer open={isNewCatalogDialogOpen} onOpenChange={setIsNewCatalogDialogOpen}>
          <DrawerContent>
            <DrawerHeader className="text-left">
              <DrawerTitle>Новый прайс-лист</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-4">
              <Input
                ref={newCatalogInputRef}
                placeholder="Название прайс-листа"
                value={newCatalogName}
                onChange={(e) => setNewCatalogName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newCatalogName.trim()) {
                    handleCreateNewCatalog();
                  }
                }}
              />
            </div>
            <DrawerFooter className="pt-2">
              <Button 
                onClick={handleCreateNewCatalog}
                disabled={!newCatalogName.trim() || isCreatingCatalog}
              >
                {isCreatingCatalog ? "Создание..." : "Создать"}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setIsNewCatalogDialogOpen(false)}
              >
                Отмена
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={isNewCatalogDialogOpen} onOpenChange={setIsNewCatalogDialogOpen}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Новый прайс-лист</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Input
                ref={newCatalogInputRef}
                placeholder="Название прайс-листа"
                value={newCatalogName}
                onChange={(e) => setNewCatalogName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newCatalogName.trim()) {
                    handleCreateNewCatalog();
                  }
                }}
              />
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setIsNewCatalogDialogOpen(false)}
              >
                Отмена
              </Button>
              <Button 
                onClick={handleCreateNewCatalog}
                disabled={!newCatalogName.trim() || isCreatingCatalog}
              >
                {isCreatingCatalog ? "Создание..." : "Создать"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
