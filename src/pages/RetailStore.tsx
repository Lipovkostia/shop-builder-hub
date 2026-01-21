import { useState, useMemo, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useRetailStore } from "@/hooks/useRetailStore";
import { useRetailCart } from "@/hooks/useRetailCart";
import { useRetailFavorites } from "@/hooks/useRetailFavorites";
import { RetailLayoutSidebar } from "@/components/retail/RetailLayoutSidebar";
import { RetailTopBar } from "@/components/retail/RetailTopBar";
import { RetailProductCard } from "@/components/retail/RetailProductCard";
import { RetailSidebar } from "@/components/retail/RetailSidebar";
import { RetailCartDrawer } from "@/components/retail/RetailCartDrawer";
import { RetailFooter } from "@/components/retail/RetailFooter";
import { CategoryHeader } from "@/components/retail/CategoryHeader";
import { RetailMobileNav } from "@/components/retail/RetailMobileNav";
import { RetailCatalogSheet } from "@/components/retail/RetailCatalogSheet";
type SortOption = "default" | "price-asc" | "price-desc" | "name-asc" | "name-desc";
type ViewMode = "grid" | "list";

export default function RetailStore() {
  const { subdomain } = useParams();
  const { store, products, categories, loading, error } = useRetailStore(subdomain);
  const { cart, cartTotal, cartItemsCount, isOpen, setIsOpen, addToCart, updateQuantity, removeFromCart } = useRetailCart(store?.id || null);
  const { favorites, favoritesCount, toggleFavorite, isFavorite } = useRetailFavorites(store?.id || null);

  // State for favorites sheet
  const [favoritesOpen, setFavoritesOpen] = useState(false);

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>("default");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [mobileCatalogOpen, setMobileCatalogOpen] = useState(false);

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

    // Category filter
    if (selectedCategories.length > 0) {
      result = result.filter((p) => p.category_id && selectedCategories.includes(p.category_id));
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

  const handleAddToCart = (product: typeof products[0]) => {
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
      document.title = store.seo_title || `${store.name} — Интернет-магазин`;
      const metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription) {
        metaDescription.setAttribute(
          "content",
          store.seo_description || store.description || `Интернет-магазин ${store.name}`
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
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onMobileMenuClick={() => setMobileMenuOpen(true)}
        />

        {/* Main content */}
        <main className="flex-1 px-4 lg:px-6 py-6">
          {/* Category header */}
          <CategoryHeader 
            category={currentCategory} 
            productCount={filteredProducts.length} 
          />

          {/* No toolbar - filters and sorting removed */}

          {/* Products grid */}
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
              className={
                viewMode === "grid"
                  ? "grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4"
                  : "flex flex-col gap-4"
              }
            >
              {filteredProducts.map((product) => (
                <RetailProductCard
                  key={product.id}
                  product={product}
                  onAddToCart={handleAddToCart}
                  onUpdateQuantity={updateQuantity}
                  cartQuantity={getCartQuantity(product.id)}
                  isFavorite={isFavorite(product.id)}
                  onToggleFavorite={toggleFavorite}
                />
              ))}
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
          setIsOpen(false);
          setFavoritesOpen(false);
          setMobileCatalogOpen(true);
        }}
        onCartClick={() => {
          setMobileCatalogOpen(false);
          setFavoritesOpen(false);
          setIsOpen(true);
        }}
        onFavoritesClick={() => {
          setMobileCatalogOpen(false);
          setIsOpen(false);
          setFavoritesOpen(true);
        }}
        onPromotionsClick={() => {
          setMobileCatalogOpen(false);
          setIsOpen(false);
          setFavoritesOpen(false);
          /* TODO: navigate to promotions */
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
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

      {/* Favorites sheet */}
      <Sheet open={favoritesOpen} onOpenChange={setFavoritesOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Избранное ({favoritesCount})</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4 overflow-y-auto max-h-[calc(100vh-120px)]">
            {favorites.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Добавьте товары в избранное, нажав на сердечко
              </p>
            ) : (
              products
                .filter((p) => favorites.includes(p.id))
                .map((product) => (
                  <RetailProductCard
                    key={product.id}
                    product={product}
                    onAddToCart={handleAddToCart}
                    onUpdateQuantity={updateQuantity}
                    cartQuantity={getCartQuantity(product.id)}
                    isFavorite={true}
                    onToggleFavorite={toggleFavorite}
                  />
                ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Cart drawer */}
      <RetailCartDrawer
        open={isOpen}
        onOpenChange={setIsOpen}
        cart={cart}
        cartTotal={cartTotal}
        onUpdateQuantity={updateQuantity}
        onRemove={removeFromCart}
      />
    </div>
  );
}
