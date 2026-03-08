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
      <div className="min-h-screen" style={{ background: "#1a0e08" }}>
        <div className="max-w-[1600px] mx-auto px-4 py-8">
          <Skeleton className="h-12 w-48 mb-6 bg-amber-900/30" />
          <div className="flex gap-4">
            <Skeleton className="w-56 h-[400px] bg-amber-900/30" />
            <Skeleton className="flex-1 h-[400px] bg-amber-900/30" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !store) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#1a0e08" }}>
        <div className="text-center">
          <Package className="h-16 w-16 mx-auto mb-4" style={{ color: "#c9a96e" }} />
          <h1 className="text-2xl font-bold mb-2" style={{ color: "#e8d5b0", fontFamily: "'Georgia', serif" }}>Магазин не найден</h1>
          <p style={{ color: "#8a7a60" }}>{error || "Оптовый магазин не активирован"}</p>
        </div>
      </div>
    );
  }

  const displayName = store.wholesale_name || store.name;

  return (
    <div
      className="min-h-screen flex flex-col relative"
      style={{
        backgroundImage: "url('/images/medieval-wood-bg.jpg')",
        backgroundSize: "cover",
        backgroundAttachment: "fixed",
        backgroundPosition: "center",
      }}
    >
      {/* Dark overlay for readability */}
      <div className="fixed inset-0 pointer-events-none z-0" style={{ background: "rgba(15, 8, 3, 0.55)" }} />

      {/* Torch decorations - desktop only */}
      <div className="hidden lg:block fixed left-0 top-1/4 z-10 pointer-events-none" style={{ filter: "drop-shadow(0 0 30px rgba(255, 150, 30, 0.6))" }}>
        <img src="/images/medieval-torch-left.png" alt="" className="w-20 opacity-80" style={{ animation: "torch-flicker 3s ease-in-out infinite alternate" }} />
      </div>
      <div className="hidden lg:block fixed right-0 top-1/4 z-10 pointer-events-none" style={{ filter: "drop-shadow(0 0 30px rgba(255, 150, 30, 0.6))", transform: "scaleX(-1)" }}>
        <img src="/images/medieval-torch-left.png" alt="" className="w-20 opacity-80" style={{ animation: "torch-flicker 3s ease-in-out infinite alternate 1.5s" }} />
      </div>

      {/* Header */}
      <header
        className="sticky top-0 z-50 border-b"
        style={{
          backgroundImage: "url('/images/medieval-wood-bg.jpg')",
          backgroundSize: "cover",
          borderColor: "#5a3d1e",
          boxShadow: "0 4px 20px rgba(0,0,0,0.5), inset 0 -1px 0 rgba(201,169,110,0.2)",
        }}
      >
        {/* Ornament below header */}
        <div className="absolute bottom-0 left-0 right-0 translate-y-full z-40 flex justify-center pointer-events-none">
          <img src="/images/medieval-header-ornament.png" alt="" className="h-6 opacity-60" />
        </div>

        <div className="max-w-[1600px] mx-auto px-4 py-2 relative">
          <div className="flex items-center gap-3">
            {/* Mobile: Categories button */}
            <Button
              variant="outline"
              size="sm"
              className="lg:hidden h-8 text-xs shrink-0 border-amber-700/60 bg-amber-900/30 text-amber-200 hover:bg-amber-800/40 hover:text-amber-100"
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
                <div
                  className="h-8 w-8 rounded flex items-center justify-center"
                  style={{ background: "rgba(201,169,110,0.15)", border: "1px solid rgba(201,169,110,0.3)" }}
                >
                  <Package className="h-4 w-4" style={{ color: "#c9a96e" }} />
                </div>
              )}
              <span className="font-semibold text-sm hidden sm:block" style={{ color: "#e8d5b0", fontFamily: "'Georgia', serif" }}>
                {displayName}
              </span>
            </Link>

            {/* Search */}
            <div className="flex-1 max-w-lg">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: "#8a7a60" }} />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Наименование, код или артикул"
                  className="pl-8 h-8 text-xs border-amber-700/50 placeholder:text-amber-800/60"
                  style={{
                    background: "rgba(30, 18, 8, 0.7)",
                    color: "#e8d5b0",
                  }}
                />
              </div>
            </div>

            {/* Count */}
            <span className="text-xs hidden md:inline tabular-nums" style={{ color: "#8a7a60" }}>
              {filteredProducts.length}
            </span>

            {/* Contacts */}
            <div className="hidden lg:flex items-center gap-3 text-xs" style={{ color: "#8a7a60" }}>
              {store.contact_phone && (
                <a href={`tel:${store.contact_phone}`} className="flex items-center gap-1 hover:text-amber-300 transition-colors">
                  <Phone className="h-3 w-3" />
                  {store.contact_phone}
                </a>
              )}
              {store.contact_email && (
                <a href={`mailto:${store.contact_email}`} className="flex items-center gap-1 hover:text-amber-300 transition-colors">
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
              className="relative h-8 text-xs border-amber-600/60 text-amber-200 hover:bg-amber-800/40 hover:text-amber-100"
              style={{ background: "rgba(139, 90, 30, 0.3)" }}
            >
              <ShoppingCart className="h-3.5 w-3.5 mr-1" />
              <span className="hidden sm:inline">Корзина</span>
              {cartItemsCount > 0 && (
                <Badge
                  className="absolute -top-1.5 -right-1.5 h-4 w-4 p-0 flex items-center justify-center text-[10px] border-0"
                  style={{ background: "#b8860b", color: "#1a0e08" }}
                >
                  {cartItemsCount}
                </Badge>
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 max-w-[1600px] mx-auto w-full flex relative z-10">
        {/* Left sidebar - categories (desktop) */}
        <aside
          className="hidden lg:block w-56 shrink-0 overflow-y-auto p-3"
          style={{
            maxHeight: "calc(100vh - 48px)",
            position: "sticky",
            top: "48px",
            backgroundImage: "url('/images/medieval-wood-bg.jpg')",
            backgroundSize: "cover",
            borderRight: "2px solid #5a3d1e",
            boxShadow: "inset -10px 0 20px rgba(0,0,0,0.3)",
          }}
        >
          <WholesaleCategorySidebar
            categories={categories.filter(c => c.product_count && c.product_count > 0) as any}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            totalProductsCount={products.length}
            medieval
          />
        </aside>

        {/* Product table area */}
        <main
          className="flex-1 min-w-0 overflow-hidden"
          style={{
            backgroundImage: "url('/images/medieval-parchment.jpg')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {/* Min order notice */}
          {store.wholesale_min_order_amount && store.wholesale_min_order_amount > 0 && (
            <div
              className="px-3 py-1.5 text-xs font-medium border-b"
              style={{
                background: "rgba(139, 90, 30, 0.15)",
                borderColor: "rgba(139, 90, 30, 0.3)",
                color: "#5a3d1e",
                fontFamily: "'Georgia', serif",
              }}
            >
              Минимальный заказ: {store.wholesale_min_order_amount.toLocaleString("ru-RU")} ₽
            </div>
          )}

          {filteredProducts.length === 0 ? (
            <div className="text-center py-16">
              <Package className="h-10 w-10 mx-auto mb-3" style={{ color: "#8a7a60" }} />
              <p className="text-sm" style={{ color: "#5a3d1e", fontFamily: "'Georgia', serif" }}>Товары не найдены</p>
              {searchQuery && (
                <Button variant="link" size="sm" onClick={() => setSearchQuery("")} style={{ color: "#8b5a1e" }}>
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
              medieval
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
        <SheetContent
          side="left"
          className="w-72 p-0 border-r-0"
          style={{
            backgroundImage: "url('/images/medieval-wood-bg.jpg')",
            backgroundSize: "cover",
          }}
        >
          <div className="p-4 border-b" style={{ borderColor: "#5a3d1e" }}>
            <h3 className="font-semibold text-sm" style={{ color: "#e8d5b0", fontFamily: "'Georgia', serif" }}>Категории</h3>
          </div>
          <div className="p-3 overflow-y-auto" style={{ maxHeight: "calc(100vh - 60px)" }}>
            <WholesaleCategorySidebar
              categories={categories.filter(c => c.product_count && c.product_count > 0) as any}
              selectedCategory={selectedCategory}
              onSelectCategory={handleMobileCategorySelect}
              totalProductsCount={products.length}
              medieval
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

      {/* Torch flicker animation */}
      <style>{`
        @keyframes torch-flicker {
          0% { opacity: 0.7; filter: drop-shadow(0 0 25px rgba(255, 150, 30, 0.5)) brightness(0.95); }
          25% { opacity: 0.85; filter: drop-shadow(0 0 35px rgba(255, 150, 30, 0.7)) brightness(1.05); }
          50% { opacity: 0.75; filter: drop-shadow(0 0 28px rgba(255, 150, 30, 0.55)) brightness(1); }
          75% { opacity: 0.9; filter: drop-shadow(0 0 40px rgba(255, 150, 30, 0.8)) brightness(1.1); }
          100% { opacity: 0.8; filter: drop-shadow(0 0 32px rgba(255, 150, 30, 0.65)) brightness(1.02); }
        }
      `}</style>
    </div>
  );
}
