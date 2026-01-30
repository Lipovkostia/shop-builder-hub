import { useState, useMemo, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Search, 
  ShoppingCart, 
  Phone, 
  Mail, 
  MapPin,
  ChevronRight,
  Package,
  Filter,
  X
} from "lucide-react";
import { useWholesaleStore, WholesaleProduct } from "@/hooks/useWholesaleStore";
import { useRetailCart } from "@/hooks/useRetailCart";
import { cn } from "@/lib/utils";
import { WholesaleLivestreamBlock } from "@/components/wholesale/WholesaleLivestreamBlock";

type SortOption = "default" | "price-asc" | "price-desc" | "name-asc" | "name-desc";

interface WholesaleStoreProps {
  subdomain?: string;
}

export default function WholesaleStore({ subdomain: directSubdomain }: WholesaleStoreProps = {}) {
  const params = useParams();
  const subdomain = directSubdomain || params.subdomain;
  const { store, products, categories, loading, error } = useWholesaleStore(subdomain);
  const { cart, cartTotal, cartItemsCount, isOpen, setIsOpen, addToCart, updateQuantity, removeFromCart } = useRetailCart(subdomain || null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("default");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let result = [...products];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.description?.toLowerCase().includes(query) ||
          p.sku?.toLowerCase().includes(query)
      );
    }

    if (selectedCategory) {
      result = result.filter((p) => 
        p.category_ids.includes(selectedCategory) || p.category_id === selectedCategory
      );
    }

    switch (sortBy) {
      case "price-asc":
        result.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        result.sort((a, b) => b.price - a.price);
        break;
      case "name-asc":
        result.sort((a, b) => a.name.localeCompare(b.name, "ru"));
        break;
      case "name-desc":
        result.sort((a, b) => b.name.localeCompare(a.name, "ru"));
        break;
    }

    return result;
  }, [products, searchQuery, selectedCategory, sortBy]);

  const handleAddToCart = (product: WholesaleProduct) => {
    addToCart({
      productId: product.id,
      name: product.name,
      price: product.price,
      image: product.images?.[0],
      unit: product.unit || "",
    });
  };

  const getCartQuantity = (productId: string): number => {
    const item = cart.find(i => i.productId === productId);
    return item?.quantity || 0;
  };

  // SEO
  useEffect(() => {
    if (store) {
      const displayName = store.wholesale_name || store.name;
      document.title = store.wholesale_seo_title || store.seo_title || `${displayName} — Оптовый магазин`;
      const metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription) {
        metaDescription.setAttribute(
          "content",
          store.wholesale_seo_description || store.seo_description || `Оптовые закупки в ${displayName}`
        );
      }
    }
  }, [store]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <Skeleton className="h-16 w-48 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !store) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Магазин не найден</h1>
          <p className="text-muted-foreground">{error || "Оптовый магазин не активирован"}</p>
        </div>
      </div>
    );
  }

  const displayName = store.wholesale_name || store.name;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Logo */}
            <Link to={`/wholesale/${subdomain}`} className="flex items-center gap-3 shrink-0">
              {store.wholesale_logo_url || store.logo_url ? (
                <img 
                  src={store.wholesale_logo_url || store.logo_url || ""} 
                  alt={displayName}
                  className="h-10 w-auto object-contain"
                />
              ) : (
                <div className="h-10 w-10 bg-primary/10 rounded flex items-center justify-center">
                  <Package className="h-5 w-5 text-primary" />
                </div>
              )}
              <div className="hidden sm:block">
                <h1 className="font-semibold text-foreground">{displayName}</h1>
                <p className="text-xs text-muted-foreground">Оптовый каталог</p>
              </div>
            </Link>

            {/* Search */}
            <div className="flex-1 max-w-xl">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск товаров..."
                  className="pl-10"
                />
              </div>
            </div>

            {/* Cart */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsOpen(true)}
              className="relative"
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Корзина</span>
              {cartItemsCount > 0 && (
                <Badge 
                  variant="default" 
                  className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
                >
                  {cartItemsCount}
                </Badge>
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Sidebar - Livestream, Categories, Contacts */}
          <aside className="hidden lg:block w-80 shrink-0">
            <div className="sticky top-24 space-y-4">
              
              {/* Livestream block */}
              {store.wholesale_livestream_enabled && (
                <WholesaleLivestreamBlock
                  storeId={store.id}
                  streamUrl={store.wholesale_livestream_url}
                  streamTitle={store.wholesale_livestream_title}
                />
              )}
              
              {/* Categories */}
              <div>
                <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-2">
                  Категории
                </h2>
                <nav className="space-y-1">
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                      !selectedCategory 
                        ? "bg-primary text-primary-foreground" 
                        : "hover:bg-muted"
                    )}
                  >
                    Все товары
                    <span className="float-right text-xs opacity-70">{products.length}</span>
                  </button>
                  {categories.filter(c => c.product_count && c.product_count > 0).map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                        selectedCategory === cat.id 
                          ? "bg-primary text-primary-foreground" 
                          : "hover:bg-muted"
                      )}
                    >
                      {cat.name}
                      <span className="float-right text-xs opacity-70">{cat.product_count}</span>
                    </button>
                  ))}
                </nav>
              </div>

              {/* Contact info */}
              {(store.contact_phone || store.contact_email) && (
                <div className="pt-4 border-t space-y-3">
                  <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                    Контакты
                  </h3>
                  {store.contact_phone && (
                    <a 
                      href={`tel:${store.contact_phone}`}
                      className="flex items-center gap-2 text-sm hover:text-primary"
                    >
                      <Phone className="h-4 w-4" />
                      {store.contact_phone}
                    </a>
                  )}
                  {store.contact_email && (
                    <a 
                      href={`mailto:${store.contact_email}`}
                      className="flex items-center gap-2 text-sm hover:text-primary"
                    >
                      <Mail className="h-4 w-4" />
                      {store.contact_email}
                    </a>
                  )}
                </div>
              )}
            </div>
          </aside>

          {/* Products */}
          <main className="flex-1 min-w-0">
            {/* Mobile filters button */}
            <div className="lg:hidden mb-4 flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
              >
                <Filter className="h-4 w-4 mr-2" />
                Фильтры
                {selectedCategory && (
                  <Badge variant="secondary" className="ml-2">1</Badge>
                )}
              </Button>
              {selectedCategory && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedCategory(null)}
                >
                  <X className="h-4 w-4 mr-1" />
                  Сбросить
                </Button>
              )}
            </div>

            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">
                  {selectedCategory 
                    ? categories.find(c => c.id === selectedCategory)?.name 
                    : "Все товары"
                  }
                </h1>
                <span className="text-sm text-muted-foreground">
                  {filteredProducts.length} товаров
                </span>
              </div>
              {store.wholesale_min_order_amount && store.wholesale_min_order_amount > 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  Минимальный заказ: {store.wholesale_min_order_amount.toLocaleString("ru-RU")} ₽
                </p>
              )}
            </div>

            {/* Products list - compact B2B style */}
            {filteredProducts.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Товары не найдены</p>
                {searchQuery && (
                  <Button variant="link" onClick={() => setSearchQuery("")}>
                    Очистить поиск
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {/* Table header */}
                <div className="hidden md:grid md:grid-cols-12 gap-4 px-4 py-2 bg-muted/50 rounded-lg text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <div className="col-span-5">Товар</div>
                  <div className="col-span-2 text-right">Цена</div>
                  <div className="col-span-2 text-center">Ед. изм.</div>
                  <div className="col-span-3 text-right">Действия</div>
                </div>

                {/* Products */}
                {filteredProducts.map((product) => {
                  const cartQty = getCartQuantity(product.id);
                  
                  return (
                    <Card key={product.id} className="overflow-hidden">
                      <CardContent className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                          {/* Product info */}
                          <div className="md:col-span-5 flex items-center gap-3">
                            {product.images?.[0] && (
                              <img
                                src={product.images[0]}
                                alt={product.name}
                                className="w-12 h-12 object-cover rounded"
                              />
                            )}
                            <div className="min-w-0">
                              <Link
                                to={`/wholesale/${subdomain}/product/${product.slug}`}
                                className="font-medium hover:text-primary line-clamp-1"
                              >
                                {product.name}
                              </Link>
                              {product.sku && (
                                <p className="text-xs text-muted-foreground">
                                  Арт: {product.sku}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Price */}
                          <div className="md:col-span-2 text-right">
                            <span className="font-semibold text-lg">
                              {product.price.toLocaleString("ru-RU")} ₽
                            </span>
                          </div>

                          {/* Unit */}
                          <div className="md:col-span-2 text-center">
                            <span className="text-sm text-muted-foreground">
                              за {product.unit || "шт"}
                            </span>
                          </div>

                          {/* Actions */}
                          <div className="md:col-span-3 flex items-center justify-end gap-2">
                            {cartQty > 0 ? (
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => updateQuantity(product.id, cartQty - 1)}
                                >
                                  -
                                </Button>
                                <span className="w-8 text-center font-medium">{cartQty}</span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => updateQuantity(product.id, cartQty + 1)}
                                >
                                  +
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => handleAddToCart(product)}
                              >
                                В корзину
                              </Button>
                            )}
                            <Link to={`/wholesale/${subdomain}/product/${product.slug}`}>
                              <Button variant="ghost" size="sm">
                                <ChevronRight className="h-4 w-4" />
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Cart minimum order warning */}
      {store.wholesale_min_order_amount && cartTotal < store.wholesale_min_order_amount && cartItemsCount > 0 && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm">
          <Card className="bg-orange-50 border-orange-200">
            <CardContent className="p-4">
              <p className="text-sm text-orange-800">
                Минимальная сумма заказа: {store.wholesale_min_order_amount.toLocaleString("ru-RU")} ₽
              </p>
              <p className="text-xs text-orange-600 mt-1">
                Добавьте ещё на {(store.wholesale_min_order_amount - cartTotal).toLocaleString("ru-RU")} ₽
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
