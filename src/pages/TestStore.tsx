import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingCart, Settings, FolderOpen, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Product,
  Catalog,
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

const CATALOGS_STORAGE_KEY = "admin_catalogs";
const PRODUCTS_STORAGE_KEY = "admin_all_products";

// Индикатор порции
function PortionIndicator({ type }: { type: "full" | "half" | "quarter" }) {
  return (
    <div className="w-3.5 h-3.5 rounded-full overflow-hidden border border-primary bg-background">
      {type === "full" && <div className="w-full h-full bg-primary" />}
      {type === "half" && <div className="w-1/2 h-full bg-primary" />}
      {type === "quarter" && (
        <div className="w-1/2 h-1/2 bg-primary" style={{ borderBottomRightRadius: "100%" }} />
      )}
    </div>
  );
}

// Карточка товара
function ProductCard({ 
  product, 
  cart, 
  onAddToCart 
}: { 
  product: Product;
  cart: CartItem[];
  onAddToCart: (productId: string, variantIndex: number, price: number) => void;
}) {
  const getCartQuantity = (variantIndex: number) => {
    const item = cart.find(
      (c) => c.productId === product.id && c.variantIndex === variantIndex
    );
    return item?.quantity || 0;
  };

  // Расчёт цен с учётом наценки
  const salePrice = calculateSalePrice(product.buyPrice || product.pricePerUnit, product.markup) || product.pricePerUnit;
  
  const packagingPrices = calculatePackagingPrices(
    salePrice,
    product.unitWeight,
    product.packagingType,
    product.customVariantPrices,
    product.portionPrices
  );

  const getFullPrice = () => {
    if (packagingPrices) {
      return packagingPrices.full;
    }
    if (product.productType === "weight" && product.weightVariants) {
      const fullVariant = product.weightVariants.find(v => v.type === "full");
      return fullVariant ? salePrice * fullVariant.weight : null;
    }
    if (product.productType === "piece" && product.pieceVariants) {
      const boxVariant = product.pieceVariants.find(v => v.type === "box");
      return boxVariant ? salePrice * boxVariant.quantity : null;
    }
    return null;
  };

  const fullPrice = getFullPrice();

  return (
    <div className="flex gap-1.5 px-1.5 py-0.5 h-[calc((100vh-44px)/8)] min-h-[72px] bg-background border-b border-border">
      {/* Изображение */}
      <div className="relative w-14 h-14 flex-shrink-0 rounded overflow-hidden bg-muted self-center">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover"
        />
        {product.isHit && (
          <Badge className="absolute -top-0.5 -left-0.5 bg-destructive text-destructive-foreground text-[8px] px-1 py-0 rounded leading-tight">
            ХИТ
          </Badge>
        )}
      </div>

      {/* Контент справа */}
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-0">
        {/* Строка 1: Название */}
        <div className="relative overflow-hidden">
          <h3 className="font-medium text-xs text-foreground leading-tight whitespace-nowrap pr-6">
            {product.name}
          </h3>
          <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-background to-transparent" />
        </div>

        {/* Строка 2: Цена за кг и за головку */}
        <p className="text-[10px] text-muted-foreground leading-tight">
          {formatPrice(salePrice)}/{product.unit}
          {fullPrice && (
            <span className="ml-1">
              · головка ~{formatPrice(fullPrice)}
            </span>
          )}
        </p>

        {/* Строка 3: Кнопки */}
        <div className="flex items-center gap-0.5 mt-0.5 flex-wrap">
          {product.inStock ? (
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
                          {formatPrice(packagingPrices.full)}
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
                          {formatPrice(packagingPrices.half)}
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
                          {formatPrice(packagingPrices.quarter)}
                        </span>
                      </button>
                    );
                  })()}
                </>
              ) : (
                <>
                  {product.productType === "weight" && product.weightVariants?.map((variant, idx) => {
                    const qty = getCartQuantity(idx);
                    const price = salePrice * variant.weight;
                    return (
                      <button
                        key={variant.type}
                        onClick={() => onAddToCart(product.id, idx, price)}
                        className="relative flex items-center gap-1 h-7 px-2 rounded border border-border hover:border-primary hover:bg-primary/5 transition-all"
                      >
                        {qty > 0 && (
                          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center">
                            {qty}
                          </span>
                        )}
                        <PortionIndicator type={variant.type} />
                        <span className="text-[9px] font-medium text-foreground">
                          {formatPrice(price)}
                        </span>
                      </button>
                    );
                  })}

                  {product.productType === "piece" && product.pieceVariants?.map((variant, idx) => {
                    const qty = getCartQuantity(idx);
                    const price = salePrice * variant.quantity;
                    return (
                      <button
                        key={variant.type}
                        onClick={() => onAddToCart(product.id, idx, price)}
                        className="relative flex items-center gap-1 h-7 px-2 rounded border border-border hover:border-primary hover:bg-primary/5 transition-all"
                      >
                        {qty > 0 && (
                          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center">
                            {qty}
                          </span>
                        )}
                        <span className={`w-3 h-3 rounded-full flex items-center justify-center text-[8px] font-bold ${
                          variant.type === "box" ? "bg-primary text-primary-foreground" : "border border-primary text-primary"
                        }`}>
                          {variant.quantity}
                        </span>
                        <span className="text-[9px] font-medium text-foreground">
                          {formatPrice(price)}
                        </span>
                      </button>
                    );
                  })}
                </>
              )}
            </>
          ) : (
            <span className="text-[10px] text-muted-foreground">Нет в наличии</span>
          )}
        </div>
      </div>
    </div>
  );
}

// Шапка
function StoreHeader({ 
  cart, 
  catalogs, 
  selectedCatalog, 
  onSelectCatalog 
}: { 
  cart: CartItem[];
  catalogs: Catalog[];
  selectedCatalog: Catalog | null;
  onSelectCatalog: (catalog: Catalog | null) => void;
}) {
  const navigate = useNavigate();
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <header className="sticky top-0 z-50 bg-background border-b border-border">
      <div className="h-12 flex items-center justify-between px-3">
        <div>
          <h1 className="font-bold text-sm text-foreground leading-tight">Сыры & Хамон</h1>
          <p className="text-[10px] text-muted-foreground leading-tight">Оптовый прайс-лист</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/admin")}
            className="flex items-center gap-1 bg-muted hover:bg-muted/80 transition-colors rounded-full py-1.5 px-3"
          >
            <Settings className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">Управление</span>
          </button>

          <button className="relative flex items-center gap-1.5 bg-primary/10 hover:bg-primary/20 transition-colors rounded-full py-1.5 px-3">
            <ShoppingCart className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-foreground">{formatPrice(totalPrice)}</span>
            {totalItems > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                {totalItems}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Селектор прайс-листа */}
      <div className="h-10 flex items-center px-3 border-t border-border bg-muted/30">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors">
            <FolderOpen className="w-4 h-4" />
            <span>{selectedCatalog?.name || "Все товары"}</span>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
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
                onClick={() => onSelectCatalog(catalog)}
                className="cursor-pointer"
              >
                <span className={selectedCatalog?.id === catalog.id ? "font-semibold" : ""}>
                  {catalog.name}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {catalog.productIds.length}
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
      </div>
    </header>
  );
}

export default function TestStore() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [selectedCatalog, setSelectedCatalog] = useState<Catalog | null>(null);

  // Загрузка прайс-листов и товаров из localStorage
  useEffect(() => {
    const storedCatalogs = localStorage.getItem(CATALOGS_STORAGE_KEY);
    if (storedCatalogs) {
      try {
        const parsed = JSON.parse(storedCatalogs);
        setCatalogs(parsed);
      } catch (e) {
        console.error("Error parsing catalogs:", e);
      }
    }

    const storedProducts = localStorage.getItem(PRODUCTS_STORAGE_KEY);
    if (storedProducts) {
      try {
        const parsed = JSON.parse(storedProducts);
        setAllProducts(parsed);
      } catch (e) {
        console.error("Error parsing products:", e);
      }
    }
  }, []);

  // Фильтрация товаров по выбранному каталогу и скрытие hidden товаров
  const displayProducts = (selectedCatalog
    ? allProducts.filter(p => selectedCatalog.productIds.includes(p.id))
    : allProducts
  ).filter(p => p.status !== "hidden");

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

  return (
    <div className="h-screen bg-background flex flex-col">
      <StoreHeader 
        cart={cart} 
        catalogs={catalogs}
        selectedCatalog={selectedCatalog}
        onSelectCatalog={setSelectedCatalog}
      />
      <main className="flex-1 overflow-auto">
        {displayProducts.length > 0 ? (
          displayProducts.map((product) => (
            <ProductCard 
              key={product.id} 
              product={product} 
              cart={cart}
              onAddToCart={handleAddToCart}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <FolderOpen className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              {selectedCatalog 
                ? `В прайс-листе "${selectedCatalog.name}" нет товаров`
                : "Нет доступных товаров"}
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
