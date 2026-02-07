import { useState, useMemo, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useShowcaseStore } from "@/hooks/useShowcaseStore";
import { useShowcaseCart } from "@/hooks/useShowcaseCart";
import { useRetailFavorites } from "@/hooks/useRetailFavorites";
import { useIsMobile } from "@/hooks/use-mobile";
import { RetailLayoutSidebar } from "@/components/retail/RetailLayoutSidebar";
import { RetailTopBar } from "@/components/retail/RetailTopBar";
import { RetailProductCard } from "@/components/retail/RetailProductCard";
import { RetailCartDrawer } from "@/components/retail/RetailCartDrawer";
import { RetailCartSheet } from "@/components/retail/RetailCartSheet";
import { RetailFooter } from "@/components/retail/RetailFooter";
import { CategoryHeader } from "@/components/retail/CategoryHeader";
import { RetailMobileNav } from "@/components/retail/RetailMobileNav";
import { RetailCatalogSheet } from "@/components/retail/RetailCatalogSheet";
import { RetailFavoritesSheet } from "@/components/retail/RetailFavoritesSheet";
import { RetailFavoritesDrawer } from "@/components/retail/RetailFavoritesDrawer";
import { CategoryProductsSection } from "@/components/retail/CategoryProductsSection";
import { FlyToCartAnimation, triggerFlyToCart } from "@/components/retail/FlyToCartAnimation";

type SortOption = "default" | "price-asc" | "price-desc" | "name-asc" | "name-desc";

interface ShowcaseStoreProps {
  subdomain?: string;
}

export default function ShowcaseStore({ subdomain: propSubdomain }: ShowcaseStoreProps = {}) {
  const params = useParams();
  const subdomain = propSubdomain || params.subdomain;
  const { store: rawStore, products, categories, loading, error } = useShowcaseStore(subdomain);
  const { cart, cartTotal, cartItemsCount, isOpen, setIsOpen, addToCart, updateQuantity, removeFromCart } = useShowcaseCart(subdomain || null);
  const { favorites, favoritesCount, toggleFavorite, isFavorite } = useRetailFavorites(subdomain ? `showcase-${subdomain}` : null);
  const isMobile = useIsMobile();

  const cartIconRef = useRef<HTMLButtonElement>(null);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>("default");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileCatalogOpen, setMobileCatalogOpen] = useState(false);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [expandedDescriptionCardId, setExpandedDescriptionCardId] = useState<string | null>(null);

  const priceRange = useMemo(() => {
    if (products.length === 0) return [0, 10000] as [number, number];
    const prices = products.map((p) => p.price);
    return [Math.min(...prices), Math.max(...prices)] as [number, number];
  }, [products]);
  const [currentPriceRange, setCurrentPriceRange] = useState<[number, number]>(priceRange);
  useEffect(() => { setCurrentPriceRange(priceRange); }, [priceRange]);

  // Adapt showcase store to retail store interface for shared components
  const store = useMemo(() => {
    if (!rawStore) return null;
    return {
      ...rawStore,
      retail_name: rawStore.showcase_name,
      retail_enabled: rawStore.showcase_enabled,
      retail_theme: rawStore.showcase_theme as any,
      retail_logo_url: rawStore.showcase_logo_url,
      seo_title: rawStore.showcase_seo_title,
      seo_description: rawStore.showcase_seo_description,
      favicon_url: rawStore.showcase_favicon_url,
      custom_domain: rawStore.showcase_custom_domain,
      retail_catalog_id: rawStore.showcase_catalog_id,
      retail_phone: rawStore.showcase_phone,
      telegram_username: rawStore.showcase_telegram_username,
      whatsapp_phone: rawStore.showcase_whatsapp_phone,
      retail_delivery_time: rawStore.showcase_delivery_time,
      retail_delivery_info: rawStore.showcase_delivery_info,
      retail_delivery_free_from: rawStore.showcase_delivery_free_from,
      retail_delivery_region: rawStore.showcase_delivery_region,
      retail_footer_delivery_payment: rawStore.showcase_footer_delivery_payment,
      retail_footer_returns: rawStore.showcase_footer_returns,
    };
  }, [rawStore]);

  // Load Google Fonts
  useEffect(() => {
    if (!store?.retail_theme?.fonts) return;
    const fonts = store.retail_theme.fonts;
    const fontFamilies = new Set<string>();
    if (fonts.catalog?.family && fonts.catalog.family !== 'system' && fonts.catalog.family !== 'inherit') fontFamilies.add(fonts.catalog.family);
    if (fonts.productName?.family && fonts.productName.family !== 'inherit') fontFamilies.add(fonts.productName.family);
    if (fonts.productPrice?.family && fonts.productPrice.family !== 'inherit') fontFamilies.add(fonts.productPrice.family);
    if (fonts.productDescription?.family && fonts.productDescription.family !== 'inherit') fontFamilies.add(fonts.productDescription.family);
    if (fontFamilies.size === 0) return;
    const fontQuery = Array.from(fontFamilies).map(f => f.replace(/ /g, '+') + ':wght@400;500;600;700').join('&family=');
    const linkId = 'showcase-google-fonts';
    const existingLink = document.getElementById(linkId);
    if (existingLink) existingLink.remove();
    const link = document.createElement('link');
    link.id = linkId; link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${fontQuery}&display=swap`;
    document.head.appendChild(link);
    return () => { const l = document.getElementById(linkId); if (l) l.remove(); };
  }, [store?.retail_theme?.fonts]);

  useEffect(() => {
    if (selectedCategory) setSelectedCategories([selectedCategory]);
    else setSelectedCategories([]);
  }, [selectedCategory]);

  const filteredProducts = useMemo(() => {
    let result = [...products];
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(query) || p.description?.toLowerCase().includes(query) || p.sku?.toLowerCase().includes(query));
    }
    if (selectedCategories.length > 0) {
      result = result.filter((p) => selectedCategories.some(catId => (p.category_ids || []).includes(catId) || p.category_id === catId));
    }
    result = result.filter((p) => p.price >= currentPriceRange[0] && p.price <= currentPriceRange[1]);
    if (inStockOnly) result = result.filter((p) => p.catalog_status !== 'out_of_stock');
    switch (sortBy) {
      case "price-asc": result.sort((a, b) => a.price - b.price); break;
      case "price-desc": result.sort((a, b) => b.price - a.price); break;
      case "name-asc": result.sort((a, b) => a.name.localeCompare(b.name, "ru")); break;
      case "name-desc": result.sort((a, b) => b.name.localeCompare(a.name, "ru")); break;
    }
    return result;
  }, [products, searchQuery, selectedCategories, currentPriceRange, inStockOnly, sortBy]);

  const currentCategory = useMemo(() => selectedCategory ? categories.find(c => c.id === selectedCategory) || null : null, [selectedCategory, categories]);

  const productsByCategory = useMemo(() => {
    if (selectedCategory) return null;
    const orderedCategories: { category: typeof categories[0]; products: typeof products }[] = [];
    categories.forEach(cat => {
      const catProducts = products.filter(p => (p.category_ids || []).includes(cat.id) || p.category_id === cat.id);
      if (catProducts.length > 0) orderedCategories.push({ category: cat, products: catProducts });
    });
    const uncategorized = products.filter(p => (p.category_ids || []).length === 0 && !p.category_id);
    return { orderedCategories, uncategorized };
  }, [selectedCategory, products, categories]);

  const handleAddToCart = (product: typeof products[0], imageRect?: { x: number; y: number }) => {
    if (imageRect && product.images?.[0]) triggerFlyToCart(product.images[0], imageRect.x, imageRect.y);
    addToCart({ productId: product.id, name: product.name, price: product.price, image: product.images?.[0], unit: product.unit || "" });
  };

  const getCartQuantity = (productId: string): number => cart.find(i => i.productId === productId)?.quantity || 0;

  // SEO
  useEffect(() => {
    if (store) {
      const displayName = store.retail_name || store.name;
      document.title = store.seo_title || `${displayName} — Интернет-витрина`;
      const metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription) metaDescription.setAttribute("content", store.seo_description || store.description || `Интернет-витрина ${displayName}`);
    }
  }, [store]);

  if (loading) {
    return (
      <div className="retail-theme min-h-screen bg-background flex">
        <div className="hidden lg:block w-64 border-r p-6 space-y-4">
          <Skeleton className="h-12 w-32" />
          <div className="space-y-2 pt-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        </div>
        <div className="flex-1 p-6">
          <Skeleton className="h-12 w-full mb-6" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-3"><Skeleton className="aspect-square rounded-lg" /><Skeleton className="h-4 w-3/4" /><Skeleton className="h-12 w-full" /></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !store) {
    return (
      <div className="retail-theme min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Витрина не найдена</h1>
          <p className="text-muted-foreground">{error || "Витрина не активирована"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="retail-theme min-h-screen bg-background flex">
      <div className="hidden lg:block">
        <RetailLayoutSidebar store={store as any} categories={categories} products={products as any} selectedCategory={selectedCategory} onCategorySelect={setSelectedCategory} />
      </div>
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-80 p-0">
          <div className="h-full">
            <RetailLayoutSidebar store={store as any} categories={categories} products={products as any} selectedCategory={selectedCategory} onCategorySelect={(cat) => { setSelectedCategory(cat); setMobileMenuOpen(false); }} />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex-1 flex flex-col min-w-0">
        <RetailTopBar store={store as any} cartItemsCount={cartItemsCount} onCartClick={() => setIsOpen(true)} searchQuery={searchQuery} onSearchChange={setSearchQuery} favoritesCount={favoritesCount} onFavoritesClick={() => setFavoritesOpen(true)} cartIconRef={cartIconRef} />

        <main className="flex-1 px-4 lg:px-6 py-6">
          {selectedCategory && <CategoryHeader category={currentCategory} productCount={filteredProducts.length} />}

          {searchQuery && !selectedCategory && (
            <>
              <div className="mb-8">
                <h1 className="text-3xl lg:text-4xl font-light tracking-tight text-foreground font-serif">Результаты поиска: "{searchQuery}"</h1>
                <p className="text-muted-foreground mt-2">Найдено товаров: {filteredProducts.length}</p>
                <div className="mt-6 h-px bg-border" />
              </div>
              {filteredProducts.length === 0 ? (
                <div className="text-center py-12"><p className="text-muted-foreground">Товары не найдены</p><Button variant="link" onClick={() => setSearchQuery("")} className="mt-2">Очистить поиск</Button></div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {filteredProducts.map((product, index) => (
                    <div key={product.id} className="relative">
                      <RetailProductCard product={product as any} onAddToCart={handleAddToCart as any} onUpdateQuantity={updateQuantity} cartQuantity={getCartQuantity(product.id)} isFavorite={isFavorite(product.id)} onToggleFavorite={toggleFavorite} index={index} expandedCardId={expandedCardId} onExpandChange={setExpandedCardId} expandedDescriptionCardId={expandedDescriptionCardId} onDescriptionExpandChange={setExpandedDescriptionCardId} fontSettings={store?.retail_theme?.fonts} />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {!selectedCategory && !searchQuery && productsByCategory && (
            <>
              <div className="mb-8">
                <h1 className="text-3xl lg:text-4xl font-light tracking-tight text-foreground font-serif">Все товары</h1>
                <div className="mt-6 h-px bg-border" />
              </div>
              {productsByCategory.orderedCategories.map(({ category, products: catProducts }) => (
                <CategoryProductsSection key={category.id} category={category} products={catProducts as any}
                  renderProductCard={(product: any, index: number, isCarousel?: boolean) => (
                    <RetailProductCard product={product} onAddToCart={handleAddToCart as any} onUpdateQuantity={updateQuantity} cartQuantity={getCartQuantity(product.id)} isFavorite={isFavorite(product.id)} onToggleFavorite={toggleFavorite} index={index} isCarousel={isCarousel} expandedCardId={expandedCardId} onExpandChange={setExpandedCardId} expandedDescriptionCardId={expandedDescriptionCardId} onDescriptionExpandChange={setExpandedDescriptionCardId} fontSettings={store?.retail_theme?.fonts} />
                  )} />
              ))}
              {productsByCategory.uncategorized.length > 0 && (
                <div className="mt-8">
                  <h2 className="text-xl font-semibold mb-4">Другие товары</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {productsByCategory.uncategorized.map((product, index) => (
                      <div key={product.id} className="relative">
                        <RetailProductCard product={product as any} onAddToCart={handleAddToCart as any} onUpdateQuantity={updateQuantity} cartQuantity={getCartQuantity(product.id)} isFavorite={isFavorite(product.id)} onToggleFavorite={toggleFavorite} index={index} expandedCardId={expandedCardId} onExpandChange={setExpandedCardId} expandedDescriptionCardId={expandedDescriptionCardId} onDescriptionExpandChange={setExpandedDescriptionCardId} fontSettings={store?.retail_theme?.fonts} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {selectedCategory && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {filteredProducts.map((product, index) => (
                <div key={product.id} className="relative">
                  <RetailProductCard product={product as any} onAddToCart={handleAddToCart as any} onUpdateQuantity={updateQuantity} cartQuantity={getCartQuantity(product.id)} isFavorite={isFavorite(product.id)} onToggleFavorite={toggleFavorite} index={index} expandedCardId={expandedCardId} onExpandChange={setExpandedCardId} expandedDescriptionCardId={expandedDescriptionCardId} onDescriptionExpandChange={setExpandedDescriptionCardId} fontSettings={store?.retail_theme?.fonts} />
                </div>
              ))}
            </div>
          )}
        </main>

        <RetailFooter store={store as any} />
      </div>

      {/* Mobile bottom navigation */}
      <RetailMobileNav
        cartItemsCount={cartItemsCount}
        favoritesCount={favoritesCount}
        onCategoriesClick={() => {
          if (mobileCatalogOpen) { setMobileCatalogOpen(false); }
          else { setIsOpen(false); setFavoritesOpen(false); setMobileCatalogOpen(true); }
        }}
        onCartClick={() => {
          if (isOpen) { setIsOpen(false); }
          else { setMobileCatalogOpen(false); setFavoritesOpen(false); setIsOpen(true); }
        }}
        onFavoritesClick={() => {
          if (favoritesOpen) { setFavoritesOpen(false); }
          else { setMobileCatalogOpen(false); setIsOpen(false); setFavoritesOpen(true); }
        }}
        onPromotionsClick={() => { setMobileCatalogOpen(false); setIsOpen(false); setFavoritesOpen(false); }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        cartIconRef={cartIconRef}
      />

      {/* Mobile catalog sheet */}
      <RetailCatalogSheet
        open={mobileCatalogOpen}
        onOpenChange={setMobileCatalogOpen}
        categories={categories}
        selectedCategory={selectedCategory}
        onCategorySelect={setSelectedCategory}
        storeName={store?.retail_name || store?.name || ""}
      />

      {/* Favorites */}
      {!isMobile && (
        <RetailFavoritesDrawer
          open={favoritesOpen}
          onOpenChange={setFavoritesOpen}
          products={products as any}
          favoriteIds={favorites}
          onToggleFavorite={toggleFavorite}
          onAddToCart={handleAddToCart as any}
          getCartQuantity={getCartQuantity}
        />
      )}
      {isMobile && (
        <RetailFavoritesSheet
          open={favoritesOpen}
          onOpenChange={setFavoritesOpen}
          products={products as any}
          favoriteIds={favorites}
          onToggleFavorite={toggleFavorite}
          onAddToCart={handleAddToCart as any}
          getCartQuantity={getCartQuantity}
        />
      )}

      {/* Cart */}
      {!isMobile && (
        <RetailCartDrawer
          open={isOpen}
          onOpenChange={setIsOpen}
          cart={cart as any}
          cartTotal={cartTotal}
          onUpdateQuantity={updateQuantity}
          onRemove={removeFromCart}
        />
      )}
      {isMobile && (
        <RetailCartSheet
          open={isOpen}
          onOpenChange={setIsOpen}
          cart={cart as any}
          cartTotal={cartTotal}
          onUpdateQuantity={updateQuantity}
          onRemove={removeFromCart}
        />
      )}

      {/* Fly to cart animation */}
      <FlyToCartAnimation cartIconRef={isMobile ? cartIconRef : cartIconRef} />
    </div>
  );
}
