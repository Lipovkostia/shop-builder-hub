import { useState, useMemo, useEffect } from "react";
import { useParams } from "react-router-dom";
import { ArrowUpDown, Grid, List, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useRetailStore } from "@/hooks/useRetailStore";
import { useRetailCart } from "@/hooks/useRetailCart";
import { RetailHeader } from "@/components/retail/RetailHeader";
import { RetailProductCard } from "@/components/retail/RetailProductCard";
import { RetailSidebar } from "@/components/retail/RetailSidebar";
import { RetailCartDrawer } from "@/components/retail/RetailCartDrawer";
import { RetailFooter } from "@/components/retail/RetailFooter";

type SortOption = "default" | "price-asc" | "price-desc" | "name-asc" | "name-desc";
type ViewMode = "grid" | "list";

export default function RetailStore() {
  const { subdomain } = useParams();
  const { store, products, categories, loading, error } = useRetailStore(subdomain);
  const { cart, cartTotal, cartItemsCount, isOpen, setIsOpen, addToCart, updateQuantity, removeFromCart } = useRetailCart(store?.id || null);

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>("default");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

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
      result = result.filter((p) => p.quantity > 0);
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
      unit: product.unit,
    });
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
      <div className="min-h-screen bg-background">
        <div className="border-b">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-10 w-64" />
              <Skeleton className="h-10 w-10" />
            </div>
          </div>
        </div>
        <div className="container mx-auto px-4 py-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-square rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-6 w-1/2" />
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Магазин не найден</h1>
          <p className="text-muted-foreground">{error || "Розничный магазин не активирован"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <RetailHeader
        store={store}
        categories={categories}
        cartItemsCount={cartItemsCount}
        onCartClick={() => setIsOpen(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedCategory={selectedCategory}
        onCategorySelect={setSelectedCategory}
      />

      {/* Main content */}
      <main className="flex-1 container mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Desktop sidebar */}
          <div className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-32">
              <RetailSidebar
                categories={categories}
                selectedCategories={selectedCategories}
                onCategoryToggle={toggleCategory}
                priceRange={priceRange}
                currentPriceRange={currentPriceRange}
                onPriceRangeChange={setCurrentPriceRange}
                inStockOnly={inStockOnly}
                onInStockChange={setInStockOnly}
                onResetFilters={resetFilters}
                hasActiveFilters={hasActiveFilters}
              />
            </div>
          </div>

          {/* Products area */}
          <div className="flex-1">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2">
                {/* Mobile filters button */}
                <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm" className="lg:hidden">
                      <SlidersHorizontal className="h-4 w-4 mr-2" />
                      Фильтры
                      {hasActiveFilters && (
                        <Badge className="ml-2 h-5 w-5 p-0 flex items-center justify-center">
                          !
                        </Badge>
                      )}
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-80">
                    <SheetHeader>
                      <SheetTitle>Фильтры</SheetTitle>
                    </SheetHeader>
                    <div className="mt-6">
                      <RetailSidebar
                        categories={categories}
                        selectedCategories={selectedCategories}
                        onCategoryToggle={toggleCategory}
                        priceRange={priceRange}
                        currentPriceRange={currentPriceRange}
                        onPriceRangeChange={setCurrentPriceRange}
                        inStockOnly={inStockOnly}
                        onInStockChange={setInStockOnly}
                        onResetFilters={resetFilters}
                        hasActiveFilters={hasActiveFilters}
                      />
                    </div>
                  </SheetContent>
                </Sheet>

                <span className="text-sm text-muted-foreground">
                  {filteredProducts.length} товаров
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Sort */}
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                  <SelectTrigger className="w-[180px] h-9">
                    <ArrowUpDown className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Сортировка" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">По умолчанию</SelectItem>
                    <SelectItem value="price-asc">Сначала дешёвые</SelectItem>
                    <SelectItem value="price-desc">Сначала дорогие</SelectItem>
                    <SelectItem value="name-asc">По названию А-Я</SelectItem>
                    <SelectItem value="name-desc">По названию Я-А</SelectItem>
                  </SelectContent>
                </Select>

                {/* View mode */}
                <div className="hidden sm:flex border rounded-lg">
                  <Button
                    variant={viewMode === "grid" ? "secondary" : "ghost"}
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => setViewMode("grid")}
                  >
                    <Grid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "secondary" : "ghost"}
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => setViewMode("list")}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

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
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <RetailFooter store={store} />

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
