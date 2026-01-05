import React, { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { ShoppingCart, Settings, ChevronDown, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useStoreBySubdomain, useIsStoreOwner } from "@/hooks/useUserStore";
import { useStoreProducts } from "@/hooks/useStoreProducts";
import { useStoreCatalogs } from "@/hooks/useStoreCatalogs";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";

interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

const formatPriceSpaced = (price: number): string => {
  return Math.round(price)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
};

// Product Card Component
function ProductCard({
  product,
  cart,
  onAddToCart,
}: {
  product: any;
  cart: CartItem[];
  onAddToCart: (productId: string, name: string, price: number) => void;
}) {
  const cartItem = cart.find((item) => item.productId === product.id);
  const quantity = cartItem?.quantity || 0;
  const price = product.price || 0;
  const images = product.images || [];
  const firstImage = images[0] || "/placeholder.svg";

  return (
    <div className="bg-card rounded-lg border overflow-hidden hover:shadow-md transition-shadow">
      <div className="aspect-square relative overflow-hidden bg-muted">
        <img
          src={firstImage}
          alt={product.name}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = "/placeholder.svg";
          }}
        />
        {!product.is_active && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
            <Badge variant="secondary">Нет в наличии</Badge>
          </div>
        )}
      </div>
      
      <div className="p-3">
        <h3 className="font-medium text-sm line-clamp-2 mb-1">{product.name}</h3>
        {product.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
            {product.description}
          </p>
        )}
        
        <div className="flex items-center justify-between mt-2">
          <div className="text-lg font-bold text-primary">
            {formatPriceSpaced(price)} ₽
            {product.unit && (
              <span className="text-xs font-normal text-muted-foreground ml-1">
                / {product.unit}
              </span>
            )}
          </div>
          
          {product.is_active !== false && (
            <Button
              size="sm"
              variant={quantity > 0 ? "default" : "outline"}
              onClick={() => onAddToCart(product.id, product.name, price)}
              className="h-8 px-3"
            >
              {quantity > 0 ? `${quantity} шт` : "В корзину"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Store Header Component
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
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const selectedCatalogName = catalogs.find((c) => c.id === selectedCatalog)?.name || "Все товары";

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Logo & Name */}
          <div className="flex items-center gap-3">
            {store.logo_url ? (
              <img src={store.logo_url} alt={store.name} className="w-10 h-10 rounded-lg object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <span className="text-primary font-bold text-lg">
                  {store.name?.charAt(0) || "M"}
                </span>
              </div>
            )}
            <div>
              <h1 className="font-bold text-lg">{store.name}</h1>
              {store.description && (
                <p className="text-xs text-muted-foreground line-clamp-1">{store.description}</p>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {/* Catalog Selector */}
            {catalogs.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1">
                    {selectedCatalogName}
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onSelectCatalog(null)}>
                    Все товары
                  </DropdownMenuItem>
                  {catalogs.map((catalog) => (
                    <DropdownMenuItem
                      key={catalog.id}
                      onClick={() => onSelectCatalog(catalog.id)}
                    >
                      {catalog.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Toggle Images */}
            <Button variant="ghost" size="icon" onClick={onToggleImages}>
              {showImages ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </Button>

            {/* Cart */}
            <Button variant="outline" size="sm" className="gap-2">
              <ShoppingCart className="h-4 w-4" />
              {totalItems > 0 && (
                <>
                  <span>{totalItems}</span>
                  <span className="text-muted-foreground">|</span>
                  <span>{formatPriceSpaced(totalPrice)} ₽</span>
                </>
              )}
            </Button>

            {/* Admin Link */}
            {isOwner && (
              <Button variant="ghost" size="icon" asChild>
                <Link to={`/store/${store.subdomain}/admin`}>
                  <Settings className="h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

// Loading Skeleton
function StoreSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 bg-background border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-lg" />
              <div>
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-3 w-48 mt-1" />
              </div>
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-9" />
            </div>
          </div>
        </div>
      </div>
      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="bg-card rounded-lg border overflow-hidden">
              <Skeleton className="aspect-square" />
              <div className="p-3">
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-3 w-2/3 mb-3" />
                <div className="flex justify-between">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-8 w-20" />
                </div>
              </div>
            </div>
          ))}
        </div>
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
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCatalog, setSelectedCatalog] = useState<string | null>(null);
  const [showImages, setShowImages] = useState(true);

  // Filter products based on selected catalog
  const filteredProducts = useMemo(() => {
    let filtered = products.filter((p) => p.is_active !== false);

    if (selectedCatalog) {
      filtered = filtered.filter((p) => productVisibility[p.id]?.has(selectedCatalog));
    }

    return filtered;
  }, [products, selectedCatalog, productVisibility]);

  // Handle add to cart
  const handleAddToCart = (productId: string, name: string, price: number) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === productId);
      if (existing) {
        return prev.map((item) =>
          item.productId === productId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { productId, name, price, quantity: 1 }];
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
    <div className="min-h-screen bg-background">
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

      <main className="container mx-auto px-4 py-6">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {selectedCatalog
                ? "В этом прайс-листе пока нет товаров"
                : "В магазине пока нет товаров"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                cart={cart}
                onAddToCart={handleAddToCart}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
