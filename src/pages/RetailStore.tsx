import { useState, useMemo, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useRetailStore } from "@/hooks/useRetailStore";
import { useRetailCart } from "@/hooks/useRetailCart";
import { useRetailFavorites } from "@/hooks/useRetailFavorites";
import { useIsMobile } from "@/hooks/use-mobile";
import { RetailLayoutSidebar } from "@/components/retail/RetailLayoutSidebar";
import { RetailTopBar } from "@/components/retail/RetailTopBar";
import { RetailProductCard } from "@/components/retail/RetailProductCard";
import { RetailSidebar } from "@/components/retail/RetailSidebar";
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

interface RetailStoreProps {
  subdomain?: string;
}

export default function RetailStore({ subdomain: propSubdomain }: RetailStoreProps = {}) {
  const params = useParams();
  const subdomain = propSubdomain || params.subdomain;
  const { store, products, categories, loading, error } = useRetailStore(subdomain);
  // Use subdomain for cart/favorites storage (available immediately from URL)
  const { cart, cartTotal, cartItemsCount, isOpen, setIsOpen, addToCart, updateQuantity, removeFromCart } = useRetailCart(subdomain || null);
  const { favorites, favoritesCount, toggleFavorite, isFavorite } = useRetailFavorites(subdomain || null);
  const isMobile = useIsMobile();

  // Ref for cart icon to animate items flying to it
  const cartIconRef = useRef<HTMLButtonElement>(null);
  const mobileCartIconRef = useRef<HTMLButtonElement>(null);

  // State for favorites sheet
  const [favoritesOpen, setFavoritesOpen] = useState(false);

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>("default");
  
  const [inStockOnly, setInStockOnly] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [mobileCatalogOpen, setMobileCatalogOpen] = useState(false);
  
  // Global state for expanded card (only one card can have expanded image at a time)
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  // Global state for expanded description (only one card can have expanded description at a time)
  const [expandedDescriptionCardId, setExpandedDescriptionCardId] = useState<string | null>(null);

  // Price range calculation
  const priceRange = useMemo(() => {
    if (products.length === 0) return [0, 10000] as [number, number];
    const prices = products.map((p) => p.price);
    return [Math.min(...prices), Math.max(...prices)] as [number, number];
  }, [products]);

  const [currentPriceRange, setCurrentPriceRange] = useState<[number, number]>(priceRange);

  useEffect(() => {
    setCurrentPriceRange(priceRange);
  }, [priceRange]);

  // Load Google Fonts dynamically based on theme settings
  useEffect(() => {
    if (!store?.retail_theme?.fonts) return;

    const fonts = store.retail_theme.fonts;
    const fontFamilies = new Set<string>();

    // Collect all unique font families
    if (fonts.catalog?.family && fonts.catalog.family !== 'system' && fonts.catalog.family !== 'inherit') {
      fontFamilies.add(fonts.catalog.family);
    }
    if (fonts.productName?.family && fonts.productName.family !== 'inherit') {
      fontFamilies.add(fonts.productName.family);
    }
    if (fonts.productPrice?.family && fonts.productPrice.family !== 'inherit') {
      fontFamilies.add(fonts.productPrice.family);
    }
    if (fonts.productDescription?.family && fonts.productDescription.family !== 'inherit') {
      fontFamilies.add(fonts.productDescription.family);
    }

    if (fontFamilies.size === 0) return;

    // Create Google Fonts link
    const fontQuery = Array.from(fontFamilies)
      .map(f => f.replace(/ /g, '+') + ':wght@400;500;600;700')
      .join('&family=');
    const linkId = 'retail-google-fonts';
    
    // Remove existing link if any
    const existingLink = document.getElementById(linkId);
    if (existingLink) {
      existingLink.remove();
    }

    // Add new link
    const link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${fontQuery}&display=swap`;
    document.head.appendChild(link);

    return () => {
      const linkToRemove = document.getElementById(linkId);
      if (linkToRemove) {
        linkToRemove.remove();
      }
    };
  }, [store?.retail_theme?.fonts]);

  // Sync selected categories with single category selector
  useEffect(() => {
    if (selectedCategory) {
      setSelectedCategories([selectedCategory]);
    } else {
      setSelectedCategories([]);
    }
  }, [selectedCategory]);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.description?.toLowerCase().includes(query) ||
          p.sku?.toLowerCase().includes(query)
      );
    }

    // Category filter - check both category_id and category_ids array
    if (selectedCategories.length > 0) {
      result = result.filter((p) => {
        // Check if any selected category matches product's categories
        const productCategoryIds = p.category_ids || [];
        return selectedCategories.some(catId => 
          productCategoryIds.includes(catId) || p.category_id === catId
        );
      });
    }

    // Price filter
    result = result.filter((p) => p.price >= currentPriceRange[0] && p.price <= currentPriceRange[1]);

    // In stock filter
    if (inStockOnly) {
      result = result.filter((p) => p.catalog_status !== 'out_of_stock');
    }

    // Sort
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
  }, [products, searchQuery, selectedCategories, currentPriceRange, inStockOnly, sortBy]);

  // Get current category data
  const currentCategory = useMemo(() => {
    if (!selectedCategory) return null;
    return categories.find(c => c.id === selectedCategory) || null;
  }, [selectedCategory, categories]);

  // Group products by category for "All Products" view
  // IMPORTANT: We use an array to preserve the order from categories (which comes from catalog_category_settings)
  const productsByCategory = useMemo(() => {
    if (selectedCategory) return null; // Not needed when a specific category is selected
    
    // Build ordered array instead of Map to preserve category order
    const orderedCategories: { category: typeof categories[0]; products: typeof products }[] = [];
    
    // Iterate through categories in their sorted order (from useRetailStore)
    categories.forEach(cat => {
      const categoryProducts = products.filter(p => {
        const productCategoryIds = p.category_ids || [];
        return productCategoryIds.includes(cat.id) || p.category_id === cat.id;
      });
      
      if (categoryProducts.length > 0) {
        orderedCategories.push({ category: cat, products: categoryProducts });
      }
    });
    
    // Add uncategorized products if any
    const uncategorized = products.filter(p => {
      const productCategoryIds = p.category_ids || [];
      return productCategoryIds.length === 0 && !p.category_id;
    });
    
    return { orderedCategories, uncategorized };
  }, [selectedCategory, products, categories]);

  // Check for active filters
  const hasActiveFilters =
    selectedCategories.length > 0 ||
    inStockOnly ||
    currentPriceRange[0] !== priceRange[0] ||
    currentPriceRange[1] !== priceRange[1];

  const resetFilters = () => {
    setSelectedCategories([]);
    setSelectedCategory(null);
    setCurrentPriceRange(priceRange);
    setInStockOnly(false);
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
    setSelectedCategory(null);
  };

  const handleAddToCart = (product: typeof products[0], imageRect?: { x: number; y: number }) => {
    // Trigger fly animation if we have the position
    if (imageRect && product.images?.[0]) {
      triggerFlyToCart(product.images[0], imageRect.x, imageRect.y);
    }
    
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
      const displayName = store.retail_name || store.name;
      document.title = store.seo_title || `${displayName} — Интернет-магазин`;
      const metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription) {
        metaDescription.setAttribute(
          "content",
          store.seo_description || store.description || `Интернет-магазин ${displayName}`
        );
      }
    }
  }, [store]);

  // Loading state
  if (loading) {
    return (
      <div className="retail-theme min-h-screen bg-background flex">
        {/* Sidebar skeleton */}
        <div className="hidden lg:block w-64 border-r p-6 space-y-4">
          <Skeleton className="h-12 w-32" />
          <div className="space-y-2 pt-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>
        {/* Main content skeleton */}
        <div className="flex-1 p-6">
          <Skeleton className="h-12 w-full mb-6" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-square rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-12 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !store) {
    return (
      <div className="retail-theme min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Магазин не найден</h1>
          <p className="text-muted-foreground">{error || "Розничный магазин не активирован"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="retail-theme min-h-screen bg-background flex">
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <RetailLayoutSidebar
          store={store}
          categories={categories}
          products={products}
          selectedCategory={selectedCategory}
          onCategorySelect={setSelectedCategory}
        />
      </div>

      {/* Mobile sidebar sheet */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-80 p-0">
          <div className="h-full">
            <RetailLayoutSidebar
              store={store}
              categories={categories}
              products={products}
              selectedCategory={selectedCategory}
              onCategorySelect={(cat) => {
                setSelectedCategory(cat);
                setMobileMenuOpen(false);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <RetailTopBar
          store={store}
          cartItemsCount={cartItemsCount}
          onCartClick={() => setIsOpen(true)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          favoritesCount={favoritesCount}
          onFavoritesClick={() => setFavoritesOpen(true)}
          cartIconRef={cartIconRef}
        />

        {/* Main content */}
        <main className="flex-1 px-4 lg:px-6 py-6">
          {/* Category header - only when specific category selected */}
          {selectedCategory && (
            <CategoryHeader 
              category={currentCategory} 
              productCount={filteredProducts.length} 
            />
          )}

          {/* Search results view - when search query is active */}
          {searchQuery && !selectedCategory && (
            <>
              <div className="mb-8">
                <h1 className="text-3xl lg:text-4xl font-light tracking-tight text-foreground font-serif">
                  Результаты поиска: "{searchQuery}"
                </h1>
                <p className="text-muted-foreground mt-2">
                  Найдено товаров: {filteredProducts.length}
                </p>
                <div className="mt-6 h-px bg-border" />
              </div>

              {filteredProducts.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Товары не найдены</p>
                  <Button variant="link" onClick={() => setSearchQuery("")} className="mt-2">
                    Очистить поиск
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {filteredProducts.map((product, index) => (
                    <div key={product.id} className="relative">
                      <RetailProductCard
                        product={product}
                        onAddToCart={handleAddToCart}
                        onUpdateQuantity={updateQuantity}
                        cartQuantity={getCartQuantity(product.id)}
                        isFavorite={isFavorite(product.id)}
                        onToggleFavorite={toggleFavorite}
                        index={index}
                        expandedCardId={expandedCardId}
                        onExpandChange={setExpandedCardId}
                        expandedDescriptionCardId={expandedDescriptionCardId}
                        onDescriptionExpandChange={setExpandedDescriptionCardId}
                        fontSettings={store?.retail_theme?.fonts}
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* "All Products" view - horizontal carousels by category (only when no search) */}
          {!selectedCategory && !searchQuery && productsByCategory && (
            <>
              {/* Page title */}
              <div className="mb-8">
                <h1 className="text-3xl lg:text-4xl font-light tracking-tight text-foreground font-serif">
                  Все товары
                </h1>
                <div className="mt-6 h-px bg-border" />
              </div>

              {/* Category sections with horizontal scrolling */}
              {productsByCategory.orderedCategories.map(({ category, products: catProducts }) => (
                <CategoryProductsSection
                  key={category.id}
                  category={category}
                  products={catProducts}
                  renderProductCard={(product, index, isCarousel) => (
                    <RetailProductCard
                      product={product}
                      onAddToCart={handleAddToCart}
                      onUpdateQuantity={updateQuantity}
                      cartQuantity={getCartQuantity(product.id)}
                      isFavorite={isFavorite(product.id)}
                      onToggleFavorite={toggleFavorite}
                      index={index}
                      isCarousel={isCarousel}
                      expandedCardId={expandedCardId}
                      onExpandChange={setExpandedCardId}
                      expandedDescriptionCardId={expandedDescriptionCardId}
                      onDescriptionExpandChange={setExpandedDescriptionCardId}
                      fontSettings={store?.retail_theme?.fonts}
                    />
                  )}
                />
              ))}

              {/* Uncategorized products */}
              {productsByCategory.uncategorized.length > 0 && (
                <section className="mb-8">
                  <h2 className="text-xl lg:text-2xl font-light tracking-tight text-foreground font-serif mb-4">
                    Прочее
                  </h2>
                  <div className="relative -mx-4 lg:-mx-6">
                    <div
                      className="flex gap-4 overflow-x-auto scrollbar-hide px-4 lg:px-6 pt-4 pb-2 -mt-4 snap-x snap-mandatory"
                      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                    >
                      {productsByCategory.uncategorized.map((product, index) => (
                        <div
                          key={product.id}
                          className="flex-shrink-0 w-[45%] sm:w-[35%] md:w-[28%] lg:w-[22%] xl:w-[18%] snap-start"
                        >
                          <RetailProductCard
                            product={product}
                            onAddToCart={handleAddToCart}
                            onUpdateQuantity={updateQuantity}
                            cartQuantity={getCartQuantity(product.id)}
                            isFavorite={isFavorite(product.id)}
                            onToggleFavorite={toggleFavorite}
                            index={index}
                            isCarousel={true}
                            expandedCardId={expandedCardId}
                            onExpandChange={setExpandedCardId}
                            expandedDescriptionCardId={expandedDescriptionCardId}
                            onDescriptionExpandChange={setExpandedDescriptionCardId}
                            fontSettings={store?.retail_theme?.fonts}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )}
            </>
          )}

          {/* Single category view - grid */}
          {selectedCategory && (
            <>
              {filteredProducts.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Товары не найдены</p>
                  {hasActiveFilters && (
                    <Button variant="link" onClick={resetFilters} className="mt-2">
                      Сбросить фильтры
                    </Button>
                  )}
                </div>
              ) : (
                <div
                  className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
                >
                  {filteredProducts.map((product, index) => (
                    <div 
                      key={product.id} 
                      className="relative"
                    >
                      <RetailProductCard
                        product={product}
                        onAddToCart={handleAddToCart}
                        onUpdateQuantity={updateQuantity}
                        cartQuantity={getCartQuantity(product.id)}
                        isFavorite={isFavorite(product.id)}
                        onToggleFavorite={toggleFavorite}
                        index={index}
                        expandedCardId={expandedCardId}
                        onExpandChange={setExpandedCardId}
                        expandedDescriptionCardId={expandedDescriptionCardId}
                        onDescriptionExpandChange={setExpandedDescriptionCardId}
                        fontSettings={store?.retail_theme?.fonts}
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Empty state for "All Products" when no products at all */}
          {!selectedCategory && products.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Товары не найдены</p>
            </div>
          )}

          {/* Spacer for mobile bottom nav */}
          <div className="h-6 lg:hidden" />
        </main>

        {/* Footer */}
        <RetailFooter store={store} />
      </div>

      {/* Mobile bottom navigation */}
      <RetailMobileNav
        cartItemsCount={cartItemsCount}
        favoritesCount={favoritesCount}
        onCategoriesClick={() => {
          if (mobileCatalogOpen) {
            setMobileCatalogOpen(false);
          } else {
            setIsOpen(false);
            setFavoritesOpen(false);
            setMobileCatalogOpen(true);
          }
        }}
        onCartClick={() => {
          if (isOpen) {
            setIsOpen(false);
          } else {
            setMobileCatalogOpen(false);
            setFavoritesOpen(false);
            setIsOpen(true);
          }
        }}
        onFavoritesClick={() => {
          if (favoritesOpen) {
            setFavoritesOpen(false);
          } else {
            setMobileCatalogOpen(false);
            setIsOpen(false);
            setFavoritesOpen(true);
          }
        }}
        onPromotionsClick={() => {
          setMobileCatalogOpen(false);
          setIsOpen(false);
          setFavoritesOpen(false);
          /* TODO: navigate to promotions */
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        cartIconRef={mobileCartIconRef}
      />

      {/* Mobile catalog sheet */}
      <RetailCatalogSheet
        open={mobileCatalogOpen}
        onOpenChange={setMobileCatalogOpen}
        categories={categories}
        selectedCategory={selectedCategory}
        onCategorySelect={setSelectedCategory}
        storeName={store.name}
      />

      {/* Favorites drawer - desktop */}
      {!isMobile && (
        <RetailFavoritesDrawer
          open={favoritesOpen}
          onOpenChange={setFavoritesOpen}
          products={products}
          favoriteIds={favorites}
          onToggleFavorite={toggleFavorite}
          onAddToCart={handleAddToCart}
          getCartQuantity={getCartQuantity}
        />
      )}

      {/* Favorites sheet - mobile (slides from bottom) */}
      {isMobile && (
        <RetailFavoritesSheet
          open={favoritesOpen}
          onOpenChange={setFavoritesOpen}
          products={products}
          favoriteIds={favorites}
          onToggleFavorite={toggleFavorite}
          onAddToCart={handleAddToCart}
          getCartQuantity={getCartQuantity}
        />
      )}

      {/* Cart drawer - desktop only */}
      {!isMobile && (
        <RetailCartDrawer
          open={isOpen}
          onOpenChange={setIsOpen}
          cart={cart}
          cartTotal={cartTotal}
          onUpdateQuantity={updateQuantity}
          onRemove={removeFromCart}
        />
      )}

      {/* Cart sheet - mobile only (slides from bottom) */}
      {isMobile && (
        <RetailCartSheet
          open={isOpen}
          onOpenChange={setIsOpen}
          cart={cart}
          cartTotal={cartTotal}
          onUpdateQuantity={updateQuantity}
          onRemove={removeFromCart}
        />
      )}

      {/* Fly to cart animation */}
      <FlyToCartAnimation cartIconRef={isMobile ? mobileCartIconRef : cartIconRef} />
    </div>
  );
}
