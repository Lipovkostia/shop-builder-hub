import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useCustomerCatalogs, CartItem, CatalogProduct, CustomerCatalog } from "@/hooks/useCustomerCatalogs";
import { useCustomerOrders } from "@/hooks/useOrders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2, 
  LogOut, 
  Package, 
  Loader2,
  FolderOpen,
  Filter,
  Image
} from "lucide-react";

// Форматирование цены с пробелом
function formatPriceSpaced(price: number): string {
  return Math.round(price).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

// Форматирование цены с символом рубля
function formatPrice(price: number): string {
  return `${formatPriceSpaced(price)} ₽`;
}

// Индикатор порции (SVG для чёткости)
function PortionIndicator({ type }: { type: "full" | "half" | "quarter" | "portion" }) {
  const size = 14;
  const r = 5;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
      {/* Фоновый круг */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary" />
      
      {type === "full" && (
        <circle cx={cx} cy={cy} r={r} className="fill-primary" />
      )}
      
      {type === "half" && (
        <path 
          d={`M ${cx} ${cy - r} A ${r} ${r} 0 0 0 ${cx} ${cy + r} Z`}
          className="fill-primary"
        />
      )}
      
      {type === "quarter" && (
        <path 
          d={`M ${cx} ${cy} L ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${cx + r} ${cy} Z`}
          className="fill-primary"
        />
      )}
      
      {type === "portion" && (
        <circle cx={cx} cy={cy} r={2} className="fill-primary" />
      )}
    </svg>
  );
}

interface LocalCartItem {
  productId: string;
  variantIndex: number;
  quantity: number;
  price: number;
}

// Карточка товара в стиле TestStore
function ProductCard({ 
  product, 
  cart, 
  onAddToCart,
  showImages = true
}: { 
  product: CatalogProduct;
  cart: LocalCartItem[];
  onAddToCart: (productId: string, variantIndex: number, price: number) => void;
  showImages?: boolean;
}) {
  const getCartQuantity = (variantIndex: number) => {
    const item = cart.find(
      (c) => c.productId === product.id && c.variantIndex === variantIndex
    );
    return item?.quantity || 0;
  };

  const basePrice = product.price;
  const unitWeight = product.unit_weight || 1;
  const isHead = product.packaging_type === 'head' && unitWeight > 0;

  // Расчёт цен
  const fullPrice = product.price_full || basePrice * unitWeight;
  const halfPrice = product.price_half || basePrice * (unitWeight / 2);
  const quarterPrice = product.price_quarter || basePrice * (unitWeight / 4);
  const portionPrice = product.price_portion || null;

  const inStock = product.quantity > 0;
  const image = product.images?.[0] || "";

  return (
    <div className={`flex gap-1.5 px-1.5 py-0.5 bg-background border-b border-border ${showImages ? 'h-[calc((100vh-44px)/8)] min-h-[72px]' : 'h-9 min-h-[36px]'}`}>
      {/* Изображение */}
      {showImages && (
        <div className="relative w-14 h-14 flex-shrink-0 rounded overflow-hidden bg-muted self-center">
          {image ? (
            <img
              src={image}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-6 h-6 text-muted-foreground" />
            </div>
          )}
        </div>
      )}

      {/* Контент справа */}
      <div className={`flex-1 min-w-0 flex ${showImages ? 'flex-col justify-center gap-0' : 'flex-row items-center gap-2'}`}>
        {/* Название */}
        <div className={`relative overflow-hidden ${showImages ? '' : 'flex-1 min-w-0'}`}>
          <h3 className={`font-medium text-foreground leading-tight whitespace-nowrap ${showImages ? 'text-xs pr-6' : 'text-[11px]'}`}>
            {product.name}
          </h3>
          {showImages && <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-background to-transparent" />}
        </div>

        {/* Цена за кг */}
        <p className={`text-muted-foreground leading-tight ${showImages ? 'text-[10px]' : 'text-[9px] whitespace-nowrap'}`}>
          {formatPrice(basePrice)}/{product.unit}
          {showImages && isHead && (
            <span className="ml-1">
              · головка ~{formatPrice(fullPrice)}
            </span>
          )}
        </p>

        {/* Кнопки */}
        <div className={`flex items-center gap-0.5 flex-wrap ${showImages ? 'mt-0.5' : ''}`}>
          {inStock ? (
            <>
              {isHead ? (
                <>
                  {/* Целая */}
                  {(() => {
                    const qty = getCartQuantity(0);
                    return (
                      <button
                        onClick={() => onAddToCart(product.id, 0, fullPrice)}
                        className="relative flex items-center gap-1 h-7 px-2 rounded border border-border hover:border-primary hover:bg-primary/5 transition-all"
                      >
                        {qty > 0 && (
                          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center">
                            {qty}
                          </span>
                        )}
                        <PortionIndicator type="full" />
                        <span className="text-[9px] font-medium text-foreground">
                          {formatPriceSpaced(fullPrice)}
                        </span>
                      </button>
                    );
                  })()}
                  {/* Половина */}
                  {(() => {
                    const qty = getCartQuantity(1);
                    return (
                      <button
                        onClick={() => onAddToCart(product.id, 1, halfPrice)}
                        className="relative flex items-center gap-1 h-7 px-2 rounded border border-border hover:border-primary hover:bg-primary/5 transition-all"
                      >
                        {qty > 0 && (
                          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center">
                            {qty}
                          </span>
                        )}
                        <PortionIndicator type="half" />
                        <span className="text-[9px] font-medium text-foreground">
                          {formatPriceSpaced(halfPrice)}
                        </span>
                      </button>
                    );
                  })()}
                  {/* Четверть */}
                  {(() => {
                    const qty = getCartQuantity(2);
                    return (
                      <button
                        onClick={() => onAddToCart(product.id, 2, quarterPrice)}
                        className="relative flex items-center gap-1 h-7 px-2 rounded border border-border hover:border-primary hover:bg-primary/5 transition-all"
                      >
                        {qty > 0 && (
                          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center">
                            {qty}
                          </span>
                        )}
                        <PortionIndicator type="quarter" />
                        <span className="text-[9px] font-medium text-foreground">
                          {formatPriceSpaced(quarterPrice)}
                        </span>
                      </button>
                    );
                  })()}
                  {/* Порция */}
                  {portionPrice && (
                    (() => {
                      const qty = getCartQuantity(3);
                      return (
                        <button
                          onClick={() => onAddToCart(product.id, 3, portionPrice)}
                          className="relative flex items-center gap-1 h-7 px-2 rounded border border-border hover:border-primary hover:bg-primary/5 transition-all"
                        >
                          {qty > 0 && (
                            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center">
                              {qty}
                            </span>
                          )}
                          <PortionIndicator type="portion" />
                          <span className="text-[9px] font-medium text-foreground">
                            {formatPriceSpaced(portionPrice)}
                          </span>
                        </button>
                      );
                    })()
                  )}
                </>
              ) : (
                // Простой товар (штучный)
                (() => {
                  const qty = getCartQuantity(0);
                  return (
                    <button
                      onClick={() => onAddToCart(product.id, 0, basePrice)}
                      className="relative flex items-center gap-1 h-7 px-2 rounded border border-border hover:border-primary hover:bg-primary/5 transition-all"
                    >
                      {qty > 0 && (
                        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center">
                          {qty}
                        </span>
                      )}
                      <Plus className="w-3 h-3 text-primary" />
                      <span className="text-[9px] font-medium text-foreground">
                        {formatPriceSpaced(basePrice)}
                      </span>
                    </button>
                  );
                })()
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

// Шапка магазина
function CustomerHeader({ 
  cart, 
  catalogs, 
  selectedCatalog, 
  onSelectCatalog,
  showImages,
  onToggleImages,
  onOpenCart,
  onSignOut
}: { 
  cart: LocalCartItem[];
  catalogs: CustomerCatalog[];
  selectedCatalog: CustomerCatalog | null;
  onSelectCatalog: (catalog: CustomerCatalog | null) => void;
  showImages: boolean;
  onToggleImages: () => void;
  onOpenCart: () => void;
  onSignOut: () => void;
}) {
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <header className="sticky top-0 z-50 bg-background border-b border-border">
      <div className="h-12 flex items-center justify-between px-3 relative">
        <button 
          onClick={onOpenCart}
          className="relative flex items-center gap-1.5 bg-primary/10 hover:bg-primary/20 transition-colors rounded-full py-1.5 px-3"
        >
          <ShoppingCart className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">{formatPrice(totalPrice)}</span>
          {totalItems > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
              {totalItems}
            </span>
          )}
        </button>

        <button
          onClick={onSignOut}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 bg-muted hover:bg-muted/80 transition-colors rounded-full"
        >
          <LogOut className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Панель управления с иконками */}
      <div className="h-10 flex items-center justify-between px-3 border-t border-border bg-muted/30">
        <div className="flex items-center gap-1">
          {/* Селектор прайс-листа */}
          <DropdownMenu>
            <DropdownMenuTrigger className="p-2 rounded hover:bg-muted transition-colors">
              <FolderOpen className="w-4 h-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[200px] bg-popover z-50">
              {catalogs.map((catalog) => (
                <DropdownMenuItem
                  key={catalog.id}
                  onClick={() => onSelectCatalog(catalog)}
                  className="cursor-pointer"
                >
                  <div className="flex flex-col">
                    <span className={selectedCatalog?.id === catalog.id ? "font-semibold" : ""}>
                      {catalog.store_name}
                    </span>
                    <span className="text-xs text-muted-foreground">{catalog.catalog_name}</span>
                  </div>
                </DropdownMenuItem>
              ))}
              {catalogs.length === 0 && (
                <DropdownMenuItem disabled>
                  <span className="text-muted-foreground">Нет прайс-листов</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Фильтр */}
          <button className="p-2 rounded hover:bg-muted transition-colors">
            <Filter className="w-4 h-4 text-muted-foreground" />
          </button>

          {/* Переключатель изображений */}
          <button 
            onClick={onToggleImages}
            className={`p-2 rounded transition-colors ${showImages ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground'}`}
          >
            <Image className="w-4 h-4" />
          </button>
        </div>

        {/* Название выбранного каталога */}
        <span className="text-xs text-muted-foreground truncate max-w-[150px]">
          {selectedCatalog ? `${selectedCatalog.store_name} — ${selectedCatalog.catalog_name}` : "Выберите прайс-лист"}
        </span>
      </div>
    </header>
  );
}

const CustomerDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, signOut, loading: authLoading } = useAuth();
  const { 
    catalogs, 
    loading: catalogsLoading, 
    currentCatalog, 
    setCurrentCatalog,
    products,
    productsLoading 
  } = useCustomerCatalogs();
  const { createOrder, loading: orderLoading } = useCustomerOrders();

  const [cart, setCart] = useState<LocalCartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [showImages, setShowImages] = useState(true);
  
  // Checkout form
  const [checkoutName, setCheckoutName] = useState("");
  const [checkoutPhone, setCheckoutPhone] = useState("");
  const [checkoutAddress, setCheckoutAddress] = useState("");
  const [checkoutComment, setCheckoutComment] = useState("");

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/customer-auth");
    }
  }, [user, authLoading, navigate]);

  const getProductById = (productId: string) => products.find(p => p.id === productId);

  const getVariantLabel = (product: CatalogProduct, variantIndex: number): string => {
    const isHead = product.packaging_type === 'head' && (product.unit_weight || 0) > 0;
    if (isHead) {
      switch (variantIndex) {
        case 0: return 'Целая';
        case 1: return '½';
        case 2: return '¼';
        case 3: return 'Порция';
        default: return '';
      }
    }
    return '';
  };

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

    const product = getProductById(productId);
    if (product) {
      toast({
        title: "Добавлено в корзину",
        description: product.name,
      });
    }
  };

  const updateCartQuantity = (index: number, delta: number) => {
    setCart(prev => {
      const updated = [...prev];
      updated[index].quantity += delta;
      if (updated[index].quantity <= 0) {
        return updated.filter((_, i) => i !== index);
      }
      return updated;
    });
  };

  const removeFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleCheckout = async () => {
    if (!currentCatalog || cart.length === 0) return;

    const items = cart.map(item => {
      const product = getProductById(item.productId);
      return {
        productId: item.productId,
        productName: product ? product.name + (getVariantLabel(product, item.variantIndex) ? ` (${getVariantLabel(product, item.variantIndex)})` : '') : 'Товар',
        quantity: item.quantity,
        price: item.price,
      };
    });

    const orderId = await createOrder({
      storeId: currentCatalog.store_id,
      items,
      shippingAddress: {
        name: checkoutName,
        phone: checkoutPhone,
        address: checkoutAddress,
        comment: checkoutComment || undefined,
      },
    });

    if (orderId) {
      setCart([]);
      setIsCheckoutOpen(false);
      setIsCartOpen(false);
      setCheckoutName("");
      setCheckoutPhone("");
      setCheckoutAddress("");
      setCheckoutComment("");
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  if (authLoading || catalogsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (catalogs.length === 0) {
    return (
      <div className="h-screen bg-background flex flex-col">
        <header className="sticky top-0 z-50 bg-background border-b border-border">
          <div className="h-12 flex items-center justify-between px-3">
            <span className="font-semibold">Мои прайс-листы</span>
            <button
              onClick={handleSignOut}
              className="p-1.5 bg-muted hover:bg-muted/80 transition-colors rounded-full"
            >
              <LogOut className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </header>
        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <Package className="w-12 h-12 text-muted-foreground mb-3" />
          <h3 className="font-medium text-foreground mb-2">Нет доступных прайс-листов</h3>
          <p className="text-sm text-muted-foreground">
            Попросите продавца поделиться ссылкой на прайс-лист
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col">
      <CustomerHeader 
        cart={cart} 
        catalogs={catalogs}
        selectedCatalog={currentCatalog}
        onSelectCatalog={(catalog) => catalog && setCurrentCatalog(catalog)}
        showImages={showImages}
        onToggleImages={() => setShowImages(!showImages)}
        onOpenCart={() => setIsCartOpen(true)}
        onSignOut={handleSignOut}
      />
      
      <main className="flex-1 overflow-auto">
        {productsLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : products.length > 0 ? (
          products.map((product) => (
            <ProductCard 
              key={product.id} 
              product={product} 
              cart={cart}
              onAddToCart={handleAddToCart}
              showImages={showImages}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <FolderOpen className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              {currentCatalog 
                ? `В прайс-листе "${currentCatalog.catalog_name}" нет товаров`
                : "Выберите прайс-лист"}
            </p>
          </div>
        )}
      </main>

      {/* Cart Sheet */}
      <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Корзина</SheetTitle>
            <SheetDescription>
              {cart.length === 0 ? "Корзина пуста" : `${cart.length} позиций`}
            </SheetDescription>
          </SheetHeader>
          
          <div className="flex-1 overflow-y-auto py-4">
            {cart.map((item, index) => {
              const product = getProductById(item.productId);
              if (!product) return null;
              
              return (
                <div key={`${item.productId}-${item.variantIndex}`} className="flex items-center gap-3 py-3 border-b border-border">
                  <div className="w-12 h-12 rounded bg-muted flex items-center justify-center flex-shrink-0">
                    {product.images?.[0] ? (
                      <img 
                        src={product.images[0]} 
                        alt={product.name}
                        className="w-full h-full object-cover rounded"
                      />
                    ) : (
                      <Package className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{product.name}</p>
                    {getVariantLabel(product, item.variantIndex) && (
                      <p className="text-xs text-muted-foreground">{getVariantLabel(product, item.variantIndex)}</p>
                    )}
                    <p className="text-sm text-primary">{formatPrice(item.price)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7"
                      onClick={() => updateCartQuantity(index, -1)}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-6 text-center text-sm">{item.quantity}</span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7"
                      onClick={() => updateCartQuantity(index, 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 text-destructive"
                      onClick={() => removeFromCart(index)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          
          {cart.length > 0 && (
            <SheetFooter className="flex-col gap-3">
              <div className="flex justify-between w-full text-lg font-semibold">
                <span>Итого:</span>
                <span>{formatPrice(cartTotal)}</span>
              </div>
              <Button 
                className="w-full" 
                onClick={() => {
                  setIsCartOpen(false);
                  setIsCheckoutOpen(true);
                }}
              >
                Оформить заказ
              </Button>
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>

      {/* Checkout Dialog */}
      <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Оформление заказа</DialogTitle>
            <DialogDescription>
              Заполните данные для доставки
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Имя</Label>
              <Input
                id="name"
                value={checkoutName}
                onChange={(e) => setCheckoutName(e.target.value)}
                placeholder="Ваше имя"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Телефон</Label>
              <Input
                id="phone"
                value={checkoutPhone}
                onChange={(e) => setCheckoutPhone(e.target.value)}
                placeholder="+7 (999) 123-45-67"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Адрес доставки</Label>
              <Input
                id="address"
                value={checkoutAddress}
                onChange={(e) => setCheckoutAddress(e.target.value)}
                placeholder="Город, улица, дом, квартира"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="comment">Комментарий (необязательно)</Label>
              <Input
                id="comment"
                value={checkoutComment}
                onChange={(e) => setCheckoutComment(e.target.value)}
                placeholder="Дополнительные пожелания"
              />
            </div>
            
            <div className="pt-4 border-t border-border">
              <div className="flex justify-between text-lg font-semibold">
                <span>Итого:</span>
                <span>{formatPrice(cartTotal)}</span>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsCheckoutOpen(false)}
            >
              Отмена
            </Button>
            <Button 
              onClick={handleCheckout}
              disabled={!checkoutName || !checkoutPhone || !checkoutAddress || orderLoading}
            >
              {orderLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Подтвердить заказ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomerDashboard;
