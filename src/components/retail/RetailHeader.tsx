import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ShoppingCart, Search, Menu, X, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { RetailStore, RetailCategory } from "@/hooks/useRetailStore";

interface RetailHeaderProps {
  store: RetailStore;
  categories: RetailCategory[];
  cartItemsCount: number;
  onCartClick: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCategory: string | null;
  onCategorySelect: (categoryId: string | null) => void;
}

export function RetailHeader({
  store,
  categories,
  cartItemsCount,
  onCartClick,
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategorySelect,
}: RetailHeaderProps) {
  const { subdomain } = useParams();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const logoUrl = store.retail_logo_url || store.logo_url;

  return (
    <header className="sticky top-0 z-50 bg-background border-b">
      {/* Top bar with contacts */}
      <div className="hidden md:block bg-muted/50 border-b">
        <div className="container mx-auto px-4 py-1.5 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            {store.contact_phone && (
              <a href={`tel:${store.contact_phone}`} className="flex items-center gap-1 hover:text-foreground transition-colors">
                <Phone className="h-3 w-3" />
                {store.contact_phone}
              </a>
            )}
            {store.contact_email && (
              <a href={`mailto:${store.contact_email}`} className="flex items-center gap-1 hover:text-foreground transition-colors">
                <Mail className="h-3 w-3" />
                {store.contact_email}
              </a>
            )}
          </div>
          {store.address && (
            <span>{store.address}</span>
          )}
        </div>
      </div>

      {/* Main header */}
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Mobile menu button */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80">
              <div className="flex flex-col gap-4 mt-6">
                <h3 className="font-semibold text-lg">Категории</h3>
                <nav className="flex flex-col gap-1">
                  <button
                    onClick={() => {
                      onCategorySelect(null);
                      setMobileMenuOpen(false);
                    }}
                    className={cn(
                      "text-left px-3 py-2 rounded-lg transition-colors",
                      selectedCategory === null
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    )}
                  >
                    Все товары
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => {
                        onCategorySelect(cat.id);
                        setMobileMenuOpen(false);
                      }}
                      className={cn(
                        "text-left px-3 py-2 rounded-lg transition-colors flex items-center justify-between",
                        selectedCategory === cat.id
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      )}
                    >
                      <span>{cat.name}</span>
                      {cat.product_count !== undefined && cat.product_count > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {cat.product_count}
                        </Badge>
                      )}
                    </button>
                  ))}
                </nav>

                {/* Mobile contacts */}
                <div className="mt-6 pt-6 border-t space-y-3">
                  {store.contact_phone && (
                    <a href={`tel:${store.contact_phone}`} className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      {store.contact_phone}
                    </a>
                  )}
                  {store.contact_email && (
                    <a href={`mailto:${store.contact_email}`} className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      {store.contact_email}
                    </a>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>

          {/* Logo */}
          <Link to={`/retail/${subdomain}`} className="flex items-center gap-2 flex-shrink-0">
            {logoUrl ? (
              <img src={logoUrl} alt={store.name} className="h-8 w-auto max-w-[120px] object-contain" />
            ) : (
              <span className="font-bold text-xl">{store.name}</span>
            )}
          </Link>

          {/* Desktop search */}
          <div className="hidden md:flex flex-1 max-w-xl">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Поиск товаров..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-9 w-full"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Mobile search toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setSearchOpen(!searchOpen)}
            >
              {searchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
            </Button>

            {/* Cart */}
            <Button
              variant="outline"
              size="icon"
              className="relative"
              onClick={onCartClick}
            >
              <ShoppingCart className="h-5 w-5" />
              {cartItemsCount > 0 && (
                <Badge
                  className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
                >
                  {cartItemsCount > 99 ? "99+" : cartItemsCount}
                </Badge>
              )}
            </Button>
          </div>
        </div>

        {/* Mobile search bar */}
        {searchOpen && (
          <div className="md:hidden mt-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Поиск товаров..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-9 w-full"
                autoFocus
              />
            </div>
          </div>
        )}
      </div>

      {/* Desktop categories nav */}
      <nav className="hidden md:block border-t bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-1 overflow-x-auto py-2 scrollbar-hide">
            <Button
              variant={selectedCategory === null ? "default" : "ghost"}
              size="sm"
              onClick={() => onCategorySelect(null)}
              className="flex-shrink-0"
            >
              Все товары
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat.id}
                variant={selectedCategory === cat.id ? "default" : "ghost"}
                size="sm"
                onClick={() => onCategorySelect(cat.id)}
                className="flex-shrink-0"
              >
                {cat.name}
                {cat.product_count !== undefined && cat.product_count > 0 && (
                  <Badge variant="secondary" className="ml-1.5 text-xs">
                    {cat.product_count}
                  </Badge>
                )}
              </Button>
            ))}
          </div>
        </div>
      </nav>
    </header>
  );
}
