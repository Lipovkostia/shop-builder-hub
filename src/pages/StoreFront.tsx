import { useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ShoppingCart, Settings, FolderOpen, Filter, Image, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useStoreBySubdomain, useIsStoreOwner } from "@/hooks/useUserStore";
import { useStoreProducts } from "@/hooks/useStoreProducts";
import { useStoreCatalogs } from "@/hooks/useStoreCatalogs";
import { useCatalogProductSettings, CatalogProductSetting } from "@/hooks/useCatalogProductSettings";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatPrice,
  calculatePackagingPrices,
  calculateSalePrice,
} from "@/components/admin/types";

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
  catalogSettings
}: { 
  product: any;
  cart: CartItem[];
  onAddToCart: (productId: string, variantIndex: number, price: number) => void;
  showImages?: boolean;
  catalogSettings?: CatalogProductSetting;
}) {
  const getCartQuantity = (variantIndex: number) => {
    const item = cart.find(
      (c) => c.productId === product.id && c.variantIndex === variantIndex
    );
    return item?.quantity || 0;
  };

  // Расчёт цен с учётом наценки
  const buyPrice = product.buy_price || product.price;
  const markup = product.markup_type && product.markup_value 
    ? { type: product.markup_type as "percent" | "rubles", value: product.markup_value }
    : undefined;
  const salePrice = calculateSalePrice(buyPrice, markup) || product.price;
  
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
  
  // Determine stock status: use catalog settings if available, otherwise fall back to product data
  const effectiveStatus = catalogSettings?.status || (product.is_active !== false && (product.quantity || 0) > 0 ? "in_stock" : "out_of_stock");
  const inStock = effectiveStatus === "in_stock";

  const getFullPrice = () => {
    if (packagingPrices) {
      return packagingPrices.full;
    }
    return null;
  };

  const fullPrice = getFullPrice();

  return (
    <div className={`flex gap-1.5 px-1.5 py-0.5 bg-background border-b border-border ${showImages ? 'h-[calc((100vh-88px)/8)] min-h-[72px]' : 'h-9 min-h-[36px]'}`}>
      {/* Изображение */}
      {showImages && (
        <div className="relative w-14 h-14 flex-shrink-0 rounded overflow-hidden bg-muted self-center">
          <img
            src={firstImage}
            alt={product.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/placeholder.svg";
            }}
          />
        </div>
      )}

      {/* Контент справа */}
      <div className={`flex-1 min-w-0 flex ${showImages ? 'flex-col justify-center gap-0' : 'flex-row items-center gap-2'}`}>
        {/* Название */}
        <div className={`relative overflow-hidden ${showImages ? '' : 'flex-1 min-w-0'}`}>
          <h3 className={`font-medium text-foreground leading-tight whitespace-nowrap ${showImages ? 'text-xs pr-6' : 'text-[11px]'}`}>
            {product.name}
          </h3>
          {showImages && <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-background to-transparent" />}
        </div>

        {/* Цена за кг */}
        <p className={`text-muted-foreground leading-tight ${showImages ? 'text-[10px]' : 'text-[9px] whitespace-nowrap'}`}>
          {formatPrice(salePrice)}/{unit}
          {showImages && fullPrice && (
            <span className="ml-1">
              · ~{formatPrice(fullPrice)}
            </span>
          )}
        </p>

        {/* Кнопки */}
        <div className={`flex items-center gap-0.5 flex-wrap ${showImages ? 'mt-0.5' : ''}`}>
          {inStock ? (
            <>
              {/* Если есть packagingPrices (голова) - показываем кнопки с расчётными ценами */}
              {packagingPrices ? (
                <>
                  {/* Целая */}
                  {(() => {
                    const qty = getCartQuantity(0);
                    return (
                      <button
                        onClick={() => onAddToCart(product.id, 0, packagingPrices.full)}
                        className="relative flex items-center gap-1 h-7 px-2 rounded border border-border hover:border-primary hover:bg-primary/5 transition-all"
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
                        onClick={() => onAddToCart(product.id, 1, packagingPrices.half)}
                        className="relative flex items-center gap-1 h-7 px-2 rounded border border-border hover:border-primary hover:bg-primary/5 transition-all"
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
                        onClick={() => onAddToCart(product.id, 2, packagingPrices.quarter)}
                        className="relative flex items-center gap-1 h-7 px-2 rounded border border-border hover:border-primary hover:bg-primary/5 transition-all"
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
                  {/* Порция */}
                  {packagingPrices.portion && (
                    (() => {
                      const qty = getCartQuantity(3);
                      return (
                        <button
                          onClick={() => onAddToCart(product.id, 3, packagingPrices.portion!)}
                          className="relative flex items-center gap-1 h-7 px-2 rounded border border-border hover:border-primary hover:bg-primary/5 transition-all"
                        >
                          {qty > 0 && (
                            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center">
                              {qty}
                            </span>
                          )}
                          <PortionIndicator type="portion" />
                          <span className="text-[9px] font-medium text-foreground">
                            {formatPriceSpaced(packagingPrices.portion!)}
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
                      onClick={() => onAddToCart(product.id, 0, salePrice)}
                      className="relative flex items-center gap-1 h-7 px-2 rounded border border-border hover:border-primary hover:bg-primary/5 transition-all"
                    >
                      {qty > 0 && (
                        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center">
                          {qty}
                        </span>
                      )}
                      <span className="text-[9px] font-medium text-foreground">
                        {formatPriceSpaced(salePrice)}
                      </span>
                    </button>
                  );
                })()
              )}
            </>
          ) : (
            <Badge variant="secondary" className="text-[9px] h-6">
              Нет в наличии
            </Badge>
          )}
        </div>
      </div>
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
}: {
  store: any;
  cart: CartItem[];
  catalogs: any[];
  selectedCatalog: string | null;
  onSelectCatalog: (id: string | null) => void;
  showImages: boolean;
  onToggleImages: () => void;
  isOwner: boolean;
}) {
  const navigate = useNavigate();
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const selectedCatalogName = catalogs.find((c) => c.id === selectedCatalog)?.name || "Все товары";

  return (
    <header className="sticky top-0 z-50 bg-background border-b border-border">
      <div className="h-12 flex items-center justify-between px-3 relative">
        <button className="relative flex items-center gap-1.5 bg-primary/10 hover:bg-primary/20 transition-colors rounded-full py-1.5 px-3">
          <ShoppingCart className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">{formatPrice(totalPrice)}</span>
          {totalItems > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
              {totalItems}
            </span>
          )}
        </button>

        <div className="flex items-center gap-1">
          {store.logo_url ? (
            <img src={store.logo_url} alt={store.name} className="w-6 h-6 rounded object-cover" />
          ) : null}
          <span className="text-sm font-medium">{store.name}</span>
        </div>

        {isOwner && (
          <button
            onClick={() => navigate(`/admin?storeId=${store.id}`)}
            className="p-1.5 bg-muted hover:bg-muted/80 transition-colors rounded-full"
          >
            <Settings className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
        {!isOwner && <div className="w-8" />}
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
          <button className="p-2 rounded hover:bg-muted transition-colors">
            <Filter className="w-4 h-4 text-muted-foreground" />
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

// Main StoreFront Component
export default function StoreFront() {
  const { subdomain } = useParams<{ subdomain: string }>();
  const { store, loading: storeLoading, error: storeError } = useStoreBySubdomain(subdomain);
  const { isOwner } = useIsStoreOwner(store?.id || null);
  const { products, loading: productsLoading } = useStoreProducts(store?.id || null);
  const { catalogs, productVisibility } = useStoreCatalogs(store?.id || null);
  const { settings: catalogProductSettings, getProductSettings } = useCatalogProductSettings(store?.id || null);
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCatalog, setSelectedCatalog] = useState<string | null>(null);
  const [showImages, setShowImages] = useState(true);

  // Filter products based on selected catalog and catalog-specific status
  const filteredProducts = useMemo(() => {
    let filtered = products.filter((p) => p.is_active !== false);

    if (selectedCatalog) {
      filtered = filtered.filter((p) => {
        // Check if product is in this catalog
        if (!productVisibility[p.id]?.has(selectedCatalog)) {
          return false;
        }
        
        // Check catalog-specific status - hide products with "hidden" status
        const catalogSettings = getProductSettings(selectedCatalog, p.id);
        if (catalogSettings?.status === "hidden") {
          return false;
        }
        
        return true;
      });
    }

    return filtered;
  }, [products, selectedCatalog, productVisibility, getProductSettings]);

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

  // Loading state
  if (storeLoading || productsLoading) {
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
    <div className="h-screen bg-background flex flex-col">
      <StoreHeader
        store={store}
        cart={cart}
        catalogs={catalogs}
        selectedCatalog={selectedCatalog}
        onSelectCatalog={setSelectedCatalog}
        showImages={showImages}
        onToggleImages={() => setShowImages(!showImages)}
        isOwner={isOwner}
      />

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
              />
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <FolderOpen className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              {selectedCatalog 
                ? "В этом прайс-листе нет товаров"
                : "В магазине пока нет товаров"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Добавьте товары в панели управления
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
