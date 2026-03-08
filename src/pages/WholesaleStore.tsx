import { useState, useMemo, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Search,
  ShoppingCart,
  Phone,
  Mail,
  Package,
  ListTree,
} from "lucide-react";
import { useWholesaleStore, WholesaleProduct } from "@/hooks/useWholesaleStore";
import { useRetailCart } from "@/hooks/useRetailCart";
import { useIsMobile } from "@/hooks/use-mobile";
import { WholesaleCartSheet } from "@/components/wholesale/WholesaleCartSheet";
import { WholesaleCartDrawer } from "@/components/wholesale/WholesaleCartDrawer";
import { WholesaleCategorySidebar } from "@/components/wholesale/WholesaleCategorySidebar";
import { WholesaleProductTable } from "@/components/wholesale/WholesaleProductTable";
import { WholesaleProductDetailPanel } from "@/components/wholesale/WholesaleProductDetailPanel";
import { StorefrontChatWidget } from "@/components/retail/StorefrontChatWidget";

interface WholesaleStoreProps {
  subdomain?: string;
}

export default function WholesaleStore({ subdomain: propSubdomain }: WholesaleStoreProps = {}) {
  const params = useParams();
  const subdomain = propSubdomain || params.subdomain;
  const isMobile = useIsMobile();
  const { store, products, categories, loading, error } = useWholesaleStore(subdomain);
  const { cart, cartTotal, cartItemsCount, isOpen, setIsOpen, addToCart, updateQuantity, removeFromCart } = useRetailCart(subdomain || null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<WholesaleProduct | null>(null);
  const [categoriesDrawerOpen, setCategoriesDrawerOpen] = useState(false);

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
    return result;
  }, [products, searchQuery, selectedCategory]);

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

  const handleMobileCategorySelect = (catId: string | null) => {
    setSelectedCategory(catId);
    setCategoriesDrawerOpen(false);
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
        <div className="max-w-[1600px] mx-auto px-4 py-8">
          <Skeleton className="h-12 w-48 mb-6" />
          <div className="flex gap-4">
            <Skeleton className="w-56 h-[400px]" />
            <Skeleton className="flex-1 h-[400px]" />
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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card border-b">
        <div className="max-w-[1600px] mx-auto px-4 py-2">
          <div className="flex items-center gap-3">
            {/* Mobile: Categories button */}
            <Button
              variant="outline"
              size="sm"
              className="lg:hidden h-8 text-xs shrink-0"
              onClick={() => setCategoriesDrawerOpen(true)}
            >
              <ListTree className="h-3.5 w-3.5 mr-1" />
              Категории
            </Button>

            {/* Logo */}
            <Link to={`/wholesale/${subdomain}`} className="flex items-center gap-2 shrink-0">
              {store.wholesale_logo_url || store.logo_url ? (
                <img
                  src={store.wholesale_logo_url || store.logo_url || ""}
                  alt={displayName}
                  className="h-8 w-auto object-contain"
                />
              ) : (
                <div className="h-8 w-8 bg-primary/10 rounded flex items-center justify-center">
                  <Package className="h-4 w-4 text-primary" />
                </div>
              )}
              <span className="font-semibold text-sm hidden sm:block">{displayName}</span>
            </Link>

            {/* Search */}
            <div className="flex-1 max-w-lg">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Наименование, код или артикул"
                  className="pl-8 h-8 text-xs"
                />
              </div>
            </div>

            {/* Count */}
            <span className="text-xs text-muted-foreground hidden md:inline tabular-nums">
              {filteredProducts.length}
            </span>

            {/* Contacts */}
            <div className="hidden lg:flex items-center gap-3 text-xs text-muted-foreground">
              {store.contact_phone && (
                <a href={`tel:${store.contact_phone}`} className="flex items-center gap-1 hover:text-primary">
                  <Phone className="h-3 w-3" />
                  {store.contact_phone}
                </a>
              )}
              {store.contact_email && (
                <a href={`mailto:${store.contact_email}`} className="flex items-center gap-1 hover:text-primary">
                  <Mail className="h-3 w-3" />
                  {store.contact_email}
                </a>
              )}
            </div>

            {/* Cart */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsOpen(true)}
              className="relative h-8 text-xs"
            >
              <ShoppingCart className="h-3.5 w-3.5 mr-1" />
              <span className="hidden sm:inline">Корзина</span>
              {cartItemsCount > 0 && (
                <Badge
                  variant="default"
                  className="absolute -top-1.5 -right-1.5 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
                >
                  {cartItemsCount}
                </Badge>
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 max-w-[1600px] mx-auto w-full flex">
        {/* Left sidebar - categories (desktop) */}
        <aside className="hidden lg:block w-56 shrink-0 border-r bg-card overflow-y-auto p-3" style={{ maxHeight: "calc(100vh - 48px)", position: "sticky", top: "48px" }}>
          <WholesaleCategorySidebar
            categories={categories.filter(c => c.product_count && c.product_count > 0) as any}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            totalProductsCount={products.length}
          />
        </aside>

        {/* Product table area */}
        <main className="flex-1 min-w-0 overflow-hidden">
          {/* Min order notice */}
          {store.wholesale_min_order_amount && store.wholesale_min_order_amount > 0 && (
            <div className="px-3 py-1.5 bg-muted/30 border-b text-xs text-muted-foreground">
              Минимальный заказ: {store.wholesale_min_order_amount.toLocaleString("ru-RU")} ₽
            </div>
          )}

          {filteredProducts.length === 0 ? (
            <div className="text-center py-16">
              <Package className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Товары не найдены</p>
              {searchQuery && (
                <Button variant="link" size="sm" onClick={() => setSearchQuery("")}>
                  Очистить поиск
                </Button>
              )}
            </div>
          ) : (
            <WholesaleProductTable
              products={filteredProducts}
              subdomain={subdomain || ""}
              getCartQuantity={getCartQuantity}
              onAddToCart={handleAddToCart}
              onUpdateQuantity={updateQuantity}
              onSelectProduct={setSelectedProduct}
            />
          )}
        </main>
      </div>

      {/* Product detail panel */}
      {selectedProduct && (
        <WholesaleProductDetailPanel
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={handleAddToCart}
          onUpdateQuantity={updateQuantity}
          cartQuantity={getCartQuantity(selectedProduct.id)}
        />
      )}

      {/* Mobile categories drawer */}
      <Sheet open={categoriesDrawerOpen} onOpenChange={setCategoriesDrawerOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-sm">Категории</h3>
          </div>
          <div className="p-3 overflow-y-auto" style={{ maxHeight: "calc(100vh - 60px)" }}>
            <WholesaleCategorySidebar
              categories={categories.filter(c => c.product_count && c.product_count > 0) as any}
              selectedCategory={selectedCategory}
              onSelectCategory={handleMobileCategorySelect}
              totalProductsCount={products.length}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Cart */}
      {isMobile ? (
        <WholesaleCartSheet
          open={isOpen}
          onOpenChange={setIsOpen}
          cart={cart}
          cartTotal={cartTotal}
          onUpdateQuantity={updateQuantity}
          onRemove={removeFromCart}
          minOrderAmount={store.wholesale_min_order_amount}
        />
      ) : (
        <WholesaleCartDrawer
          open={isOpen}
          onOpenChange={setIsOpen}
          cart={cart}
          cartTotal={cartTotal}
          onUpdateQuantity={updateQuantity}
          onRemove={removeFromCart}
          minOrderAmount={store.wholesale_min_order_amount}
        />
      )}

      {/* Chat widget */}
      {store?.id && <StorefrontChatWidget storeId={store.id} channel="wholesale" />}
    </div>
  );
}
