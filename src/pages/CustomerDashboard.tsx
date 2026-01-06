import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useCustomerCatalogs, CartItem, CatalogProduct } from "@/hooks/useCustomerCatalogs";
import { useCustomerOrders } from "@/hooks/useOrders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Store, 
  Package, 
  Loader2,
  ShoppingBag,
  ChevronDown,
  Search
} from "lucide-react";

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

  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
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

  const addToCart = (product: CatalogProduct, variant?: 'full' | 'half' | 'quarter' | 'portion') => {
    setCart(prev => {
      const existingIndex = prev.findIndex(
        item => item.product.id === product.id && item.variant === variant
      );
      
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex].quantity += 1;
        return updated;
      }
      
      return [...prev, { product, quantity: 1, variant }];
    });
    
    toast({
      title: "Добавлено в корзину",
      description: product.name,
    });
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

  const getItemPrice = (item: CartItem): number => {
    const { product, variant } = item;
    switch (variant) {
      case 'full':
        return product.price_full || product.price * (product.unit_weight || 1);
      case 'half':
        return product.price_half || product.price * ((product.unit_weight || 1) / 2);
      case 'quarter':
        return product.price_quarter || product.price * ((product.unit_weight || 1) / 4);
      case 'portion':
        return product.price_portion || product.price * (product.portion_weight || 0.1);
      default:
        return product.price;
    }
  };

  const getVariantLabel = (variant?: string): string => {
    switch (variant) {
      case 'full': return 'Целая';
      case 'half': return '½';
      case 'quarter': return '¼';
      case 'portion': return 'Порция';
      default: return '';
    }
  };

  const cartTotal = cart.reduce((sum, item) => sum + getItemPrice(item) * item.quantity, 0);

  const handleCheckout = async () => {
    if (!currentCatalog || cart.length === 0) return;

    const orderId = await createOrder({
      storeId: currentCatalog.store_id,
      items: cart.map(item => ({
        productId: item.product.id,
        productName: item.product.name + (item.variant ? ` (${getVariantLabel(item.variant)})` : ''),
        quantity: item.quantity,
        price: getItemPrice(item),
      })),
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

  const filteredProducts = products.filter(p => 
    !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
          <div className="container flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <ShoppingBag className="h-6 w-6 text-primary" />
              <span className="font-display text-xl font-bold">Мои прайс-листы</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Выйти
            </Button>
          </div>
        </header>
        
        <main className="container py-12">
          <Card className="max-w-md mx-auto text-center">
            <CardHeader>
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
              <CardTitle>Нет доступных прайс-листов</CardTitle>
              <CardDescription>
                Попросите продавца поделиться ссылкой на прайс-лист
              </CardDescription>
            </CardHeader>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            {/* Store/Catalog Selector */}
            <Select
              value={currentCatalog?.id || ""}
              onValueChange={(value) => {
                const catalog = catalogs.find(c => c.id === value);
                if (catalog) setCurrentCatalog(catalog);
              }}
            >
              <SelectTrigger className="w-[200px] md:w-[300px]">
                <div className="flex items-center gap-2 truncate">
                  <Store className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">
                    {currentCatalog?.store_name} — {currentCatalog?.catalog_name}
                  </span>
                </div>
              </SelectTrigger>
              <SelectContent>
                {catalogs.map((catalog) => (
                  <SelectItem key={catalog.id} value={catalog.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{catalog.store_name}</span>
                      <span className="text-xs text-muted-foreground">{catalog.catalog_name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            {/* Cart */}
            <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="relative">
                  <ShoppingCart className="h-4 w-4" />
                  {cart.length > 0 && (
                    <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                      {cart.reduce((sum, item) => sum + item.quantity, 0)}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Корзина</SheetTitle>
                  <SheetDescription>
                    {cart.length === 0 ? "Корзина пуста" : `${cart.length} товар(ов)`}
                  </SheetDescription>
                </SheetHeader>
                
                <div className="flex-1 overflow-y-auto py-4">
                  {cart.map((item, index) => (
                    <div key={`${item.product.id}-${item.variant}`} className="flex items-center gap-3 py-3 border-b border-border">
                      <div className="w-12 h-12 rounded bg-muted flex items-center justify-center flex-shrink-0">
                        {item.product.images[0] ? (
                          <img 
                            src={item.product.images[0]} 
                            alt={item.product.name}
                            className="w-full h-full object-cover rounded"
                          />
                        ) : (
                          <Package className="h-6 w-6 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.product.name}</p>
                        {item.variant && (
                          <p className="text-xs text-muted-foreground">{getVariantLabel(item.variant)}</p>
                        )}
                        <p className="text-sm text-primary">{getItemPrice(item).toLocaleString()} ₽</p>
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
                  ))}
                </div>
                
                {cart.length > 0 && (
                  <SheetFooter className="flex-col gap-3">
                    <div className="flex justify-between w-full text-lg font-semibold">
                      <span>Итого:</span>
                      <span>{cartTotal.toLocaleString()} ₽</span>
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

            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-6">
        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск товаров..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Products Grid */}
        {productsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {searchQuery ? "Товары не найдены" : "В этом прайс-листе пока нет товаров"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredProducts.map((product) => (
              <Card key={product.id} className="overflow-hidden group">
                <div className="aspect-square bg-muted relative">
                  {product.images[0] ? (
                    <img 
                      src={product.images[0]} 
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <CardContent className="p-3">
                  <h3 className="font-medium text-sm line-clamp-2 mb-1">{product.name}</h3>
                  <p className="text-lg font-bold text-primary mb-2">
                    {product.price.toLocaleString()} ₽/{product.unit}
                  </p>
                  
                  {/* Variants or simple add button */}
                  {product.packaging_type === 'head' && product.unit_weight ? (
                    <div className="grid grid-cols-2 gap-1">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-xs h-8"
                        onClick={() => addToCart(product, 'full')}
                      >
                        Целая
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-xs h-8"
                        onClick={() => addToCart(product, 'half')}
                      >
                        ½
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-xs h-8"
                        onClick={() => addToCart(product, 'quarter')}
                      >
                        ¼
                      </Button>
                      {product.price_portion && (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="text-xs h-8"
                          onClick={() => addToCart(product, 'portion')}
                        >
                          Порция
                        </Button>
                      )}
                    </div>
                  ) : (
                    <Button 
                      size="sm" 
                      className="w-full"
                      onClick={() => addToCart(product)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      В корзину
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

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
              <Label htmlFor="checkout-name">Ваше имя *</Label>
              <Input
                id="checkout-name"
                value={checkoutName}
                onChange={(e) => setCheckoutName(e.target.value)}
                placeholder="Иван Иванов"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="checkout-phone">Телефон *</Label>
              <Input
                id="checkout-phone"
                value={checkoutPhone}
                onChange={(e) => setCheckoutPhone(e.target.value)}
                placeholder="+7 (999) 123-45-67"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="checkout-address">Адрес доставки *</Label>
              <Input
                id="checkout-address"
                value={checkoutAddress}
                onChange={(e) => setCheckoutAddress(e.target.value)}
                placeholder="Город, улица, дом, квартира"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="checkout-comment">Комментарий</Label>
              <Input
                id="checkout-comment"
                value={checkoutComment}
                onChange={(e) => setCheckoutComment(e.target.value)}
                placeholder="Дополнительная информация"
              />
            </div>

            <div className="border-t border-border pt-4">
              <div className="flex justify-between font-semibold text-lg">
                <span>Итого к оплате:</span>
                <span className="text-primary">{cartTotal.toLocaleString()} ₽</span>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCheckoutOpen(false)}>
              Отмена
            </Button>
            <Button 
              onClick={handleCheckout}
              disabled={orderLoading || !checkoutName || !checkoutPhone || !checkoutAddress}
            >
              {orderLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Подтвердить заказ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomerDashboard;
