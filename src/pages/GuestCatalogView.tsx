import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useGuestCatalog, GuestProduct, GuestCartItem, StoreCategory } from "@/hooks/useGuestCatalog";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
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
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { FullscreenImageViewer } from "@/components/ui/fullscreen-image-viewer";
import { useToast } from "@/hooks/use-toast";
import { CustomerAIAssistantBanner } from "@/components/customer/CustomerAIAssistantBanner";
import { CustomerAIAssistantPanel } from "@/components/customer/CustomerAIAssistantPanel";
import { useCustomerAIAssistant, FoundItem } from "@/hooks/useCustomerAIAssistant";
import { 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2, 
  LogIn, 
  Package,
  Loader2,
  Check,
  LayoutGrid,
  Search,
  X,
  Image,
  Filter,
  User,
  Store,
  Phone,
  MessageCircle,
  Sparkles
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Utility functions
function formatPriceSpaced(price: number): string {
  return Math.round(price).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function formatPrice(price: number): string {
  return `${formatPriceSpaced(price)} ₽`;
}

// Portion indicator component
function PortionIndicator({ type }: { type: "full" | "half" | "quarter" | "portion" }) {
  const size = 14;
  const r = 5;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary" />
      {type === "full" && <circle cx={cx} cy={cy} r={r} className="fill-primary" />}
      {type === "half" && <path d={`M ${cx} ${cy - r} A ${r} ${r} 0 0 0 ${cx} ${cy + r} Z`} className="fill-primary" />}
      {type === "quarter" && <path d={`M ${cx} ${cy} L ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${cx + r} ${cy} Z`} className="fill-primary" />}
      {type === "portion" && <circle cx={cx} cy={cy} r={2} className="fill-primary" />}
    </svg>
  );
}

// Product card component
function GuestProductCard({ 
  product, 
  cart, 
  onAddToCart,
  showImages = true,
  isExpanded = false,
  onImageClick,
  onOpenFullscreen,
  isDescriptionExpanded = false,
  onNameClick
}: { 
  product: GuestProduct;
  cart: GuestCartItem[];
  onAddToCart: (productId: string, productName: string, variantIndex: number, price: number, unit: string | null, unitWeight: number | null, images: string[] | null, packagingType: string | null) => void;
  showImages?: boolean;
  isExpanded?: boolean;
  onImageClick?: () => void;
  onOpenFullscreen?: (imageIndex: number) => void;
  isDescriptionExpanded?: boolean;
  onNameClick?: () => void;
}) {
  const getCartQuantity = (variantIndex: number) => {
    const item = cart.find(c => c.productId === product.id && c.variantIndex === variantIndex);
    return item?.quantity || 0;
  };

  const basePrice = product.price;
  const unitWeight = product.unit_weight || 1;
  
  const catalogPrices = product.catalog_portion_prices;
  
  const hasHalfPrice = catalogPrices?.half != null || product.price_half != null;
  const hasQuarterPrice = catalogPrices?.quarter != null || product.price_quarter != null;
  const hasPortionPrice = catalogPrices?.portion != null || product.price_portion != null;
  
  const hasAnyVariantPrice = hasHalfPrice || hasQuarterPrice || hasPortionPrice;
  const hasVariantPrices = hasAnyVariantPrice;
  
  const hasFullPrice = catalogPrices?.full != null || product.price_full != null || hasAnyVariantPrice || (unitWeight > 1);
  
  const fullPricePerKg = catalogPrices?.full || product.price_full || basePrice;
  const halfPricePerKg = catalogPrices?.half || product.price_half || basePrice;
  const quarterPricePerKg = catalogPrices?.quarter || product.price_quarter || basePrice;
  const portionPrice = catalogPrices?.portion || product.price_portion || null;
  
  const fullPrice = fullPricePerKg * unitWeight;
  const halfPrice = halfPricePerKg * (unitWeight / 2);
  const quarterPrice = quarterPricePerKg * (unitWeight / 4);

  const catalogStatus = product.catalog_status;
  const canOrder = catalogStatus ? catalogStatus === "in_stock" || catalogStatus === "pre_order" : product.quantity > 0;

  const statusLabels: Record<string, string> = {
    in_stock: "В наличии",
    pre_order: "Под заказ",
    out_of_stock: "Нет в наличии",
    coming_soon: "Ожидается",
    hidden: "Скрыт",
  };
  const statusLabel = catalogStatus ? (statusLabels[catalogStatus] || "Нет в наличии") : null;
  const image = product.images?.[0] || "";

  const descInnerRef = useRef<HTMLDivElement>(null);
  const [descHeight, setDescHeight] = useState(0);

  useEffect(() => {
    if (!showImages || !product.description) return;
    if (isDescriptionExpanded) {
      requestAnimationFrame(() => {
        setDescHeight(descInnerRef.current?.scrollHeight ?? 0);
      });
    } else {
      setDescHeight(0);
    }
  }, [isDescriptionExpanded, showImages, product.description]);

  return (
    <>
      <div className={`flex gap-1.5 px-1.5 py-0.5 bg-background border-b border-border transition-all ${showImages ? 'min-h-[72px] h-auto' : (isDescriptionExpanded ? 'min-h-[36px] h-auto' : 'h-9 min-h-[36px]')}`}>
        {showImages && (
          <button 
            onClick={onImageClick}
            className="relative w-14 h-14 flex-shrink-0 rounded overflow-hidden bg-muted self-start cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
          >
            {image ? (
              <img src={image} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-6 h-6 text-muted-foreground" />
              </div>
            )}
            {(product.images?.length || 0) > 1 && (
              <div className="absolute bottom-0.5 right-0.5 bg-black/60 text-white text-[8px] px-1 rounded">
                {product.images?.length}
              </div>
            )}
          </button>
        )}

        <div className={`flex-1 min-w-0 flex ${showImages ? 'flex-col justify-start gap-0' : 'flex-row items-center gap-2'}`}>
          <div className={`${showImages ? '' : 'flex-1 min-w-0 overflow-hidden flex flex-col justify-center'}`}>
            <div className="flex items-center gap-1">
              {catalogStatus === "pre_order" && (
                <span className={`inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 flex-shrink-0 ${showImages ? 'mr-1.5 text-xs' : 'mr-1'}`}>
                  <span className={`rounded-full bg-blue-500 ${showImages ? 'w-2 h-2' : 'w-1.5 h-1.5'}`} />
                  {showImages && <span>под заказ</span>}
                </span>
              )}
              <button 
                onClick={onNameClick}
                className={`relative overflow-hidden text-left flex-1 min-w-0 ${product.description ? 'cursor-pointer hover:text-primary transition-colors' : ''}`}
              >
                <h3 className={`font-medium text-foreground leading-tight ${showImages ? 'text-lg pr-6' : 'text-[11px] pr-4'} ${isDescriptionExpanded ? 'text-primary whitespace-normal break-words' : 'whitespace-nowrap'}`}>
                  {product.name}
                </h3>
                {!isDescriptionExpanded && (
                  <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-background to-transparent pointer-events-none" />
                )}
              </button>
            </div>
            
            <p className={`text-muted-foreground leading-tight ${showImages ? 'text-xs' : 'text-[11px]'}`}>
              {formatPrice(basePrice)}/{product.unit}
              {showImages && hasVariantPrices && unitWeight > 0 && (
                <span className="ml-1">
                  · {unitWeight}{product.unit === 'шт' ? 'шт' : 'кг'} ~{formatPrice(fullPrice)}{product.packaging_type ? `/${product.packaging_type}` : ''}
                </span>
              )}
            </p>
          </div>
          
          {showImages && product.description && (
            <div
              className="overflow-hidden"
              style={{
                maxHeight: isDescriptionExpanded ? descHeight : 0,
                opacity: isDescriptionExpanded ? 1 : 0,
                transition: "max-height 320ms ease-in-out, opacity 200ms ease-in-out",
                willChange: "max-height",
              }}
            >
              <div ref={descInnerRef}>
                <p className="text-xs text-muted-foreground leading-relaxed py-1 pr-2 break-words whitespace-normal max-w-full">
                  {product.description}
                </p>
              </div>
            </div>
          )}

          <div className={`flex items-center gap-0.5 flex-wrap flex-shrink-0 ${showImages ? 'mt-0.5 justify-end ml-auto' : 'justify-end'}`}>
            {canOrder ? (
              <>
              {hasPortionPrice && portionPrice && (() => {
                  const qty = getCartQuantity(3);
                  return (
                    <button
                      onClick={() => onAddToCart(product.id, product.name, 3, portionPrice, product.unit, unitWeight, product.images, product.packaging_type)}
                      className={`relative flex items-center gap-1 rounded border border-border hover:border-primary hover:bg-primary/5 transition-all h-7 px-2`}
                    >
                      {qty > 0 && (
                        <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground font-bold rounded-full flex items-center justify-center w-3.5 h-3.5 text-[9px]">
                          {qty}
                        </span>
                      )}
                      <PortionIndicator type="portion" />
                      <span className="font-medium text-foreground text-sm">{formatPriceSpaced(portionPrice)}</span>
                    </button>
                  );
                })()}
                {hasQuarterPrice && (() => {
                  const qty = getCartQuantity(2);
                  return (
                    <button
                      onClick={() => onAddToCart(product.id, product.name, 2, quarterPrice, product.unit, unitWeight, product.images, product.packaging_type)}
                      className={`relative flex items-center gap-1 rounded border border-border hover:border-primary hover:bg-primary/5 transition-all h-7 px-2`}
                    >
                      {qty > 0 && (
                        <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground font-bold rounded-full flex items-center justify-center w-3.5 h-3.5 text-[9px]">
                          {qty}
                        </span>
                      )}
                      <PortionIndicator type="quarter" />
                      <span className="font-medium text-foreground text-sm">{formatPriceSpaced(quarterPrice)}</span>
                    </button>
                  );
                })()}
                {hasHalfPrice && (() => {
                  const qty = getCartQuantity(1);
                  return (
                    <button
                      onClick={() => onAddToCart(product.id, product.name, 1, halfPrice, product.unit, unitWeight, product.images, product.packaging_type)}
                      className={`relative flex items-center gap-1 rounded border border-border hover:border-primary hover:bg-primary/5 transition-all h-7 px-2`}
                    >
                      {qty > 0 && (
                        <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground font-bold rounded-full flex items-center justify-center w-3.5 h-3.5 text-[9px]">
                          {qty}
                        </span>
                      )}
                      <PortionIndicator type="half" />
                      <span className="font-medium text-foreground text-sm">{formatPriceSpaced(halfPrice)}</span>
                    </button>
                  );
                })()}
                {hasFullPrice && (() => {
                  const qty = getCartQuantity(0);
                  return (
                    <button
                      onClick={() => onAddToCart(product.id, product.name, 0, fullPrice, product.unit, unitWeight, product.images, product.packaging_type)}
                      className={`relative flex items-center gap-1 rounded border border-border hover:border-primary hover:bg-primary/5 transition-all h-7 px-2`}
                    >
                      {qty > 0 && (
                        <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground font-bold rounded-full flex items-center justify-center w-3.5 h-3.5 text-[9px]">
                          {qty}
                        </span>
                      )}
                      <PortionIndicator type="full" />
                      <span className="font-medium text-foreground text-sm">{formatPriceSpaced(fullPrice)}</span>
                    </button>
                  );
                })()}
                {!hasVariantPrices && !hasFullPrice && (() => {
                  const qty = getCartQuantity(0);
                  return (
                    <button
                      onClick={() => onAddToCart(product.id, product.name, 0, basePrice, product.unit, unitWeight, product.images, product.packaging_type)}
                      className={`relative flex items-center gap-1 rounded border border-border hover:border-primary hover:bg-primary/5 transition-all h-7 px-2`}
                    >
                      {qty > 0 && (
                        <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground font-bold rounded-full flex items-center justify-center w-3.5 h-3.5 text-[9px]">
                          {qty}
                        </span>
                      )}
                      <Plus className="w-3 h-3 text-primary" />
                      <span className="font-medium text-foreground text-sm">{formatPriceSpaced(basePrice)}</span>
                    </button>
                  );
                })()}
              </>
            ) : (
              <span className={`text-muted-foreground ${showImages ? 'text-xs' : 'text-[10px]'}`}>
                {statusLabel || "Нет в наличии"}
              </span>
            )}
          </div>
        </div>
      </div>

      {!showImages && (
        <Collapsible open={isDescriptionExpanded}>
          <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
            {product.description && (
              <div className="px-3 py-2 bg-muted/30 border-b border-border">
                <p className="text-[10px] text-muted-foreground leading-relaxed whitespace-normal break-words">
                  {product.description}
                </p>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}
      
      <Collapsible open={isExpanded}>
        <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
          {(product.images?.length || 0) > 0 && (
            <div className="overflow-x-auto bg-muted/30 border-b border-border">
              <div className="flex gap-2 p-2">
                {product.images?.map((img, idx) => (
                  <button 
                    key={idx}
                    onClick={() => onOpenFullscreen?.(idx)}
                    className="w-32 h-32 flex-shrink-0 rounded overflow-hidden bg-muted cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                  >
                    <img src={img} alt={`${product.name} ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </>
  );
}

// Main component
const GuestCatalogView = () => {
  const { accessCode } = useParams<{ accessCode: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile, loading: authLoading } = useAuth();

  const {
    catalogInfo,
    products,
    categories: storeCategories,
    cart,
    loading,
    productsLoading,
    error,
    addToCart,
    addItemsToCart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    cartTotal,
    cartItemsCount,
  } = useGuestCatalog(accessCode);

  // Handler for AI assistant adding items to cart
  const handleAIAddToCart = (items: FoundItem[]) => {
    if (!catalogInfo || items.length === 0) return;

    const cartItems: GuestCartItem[] = items.map(item => {
      const product = products.find(p => p.id === item.productId);
      return {
        productId: item.productId,
        productName: item.productName,
        variantIndex: item.variantIndex,
        quantity: item.quantity,
        price: item.unitPrice,
        unit: product?.unit || null,
        unit_weight: product?.unit_weight || null,
        images: product?.images || null,
        packaging_type: product?.packaging_type || null,
      };
    });

    addItemsToCart(cartItems);
    setCartOpen(true);
    toast({
      title: "Товары добавлены в корзину",
      description: `${items.length} ${items.length === 1 ? 'товар' : items.length < 5 ? 'товара' : 'товаров'}`,
    });
  };

  // UI state
  const [showImages, setShowImages] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [descriptionExpandedId, setDescriptionExpandedId] = useState<string | null>(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Cart & checkout state
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestAddress, setGuestAddress] = useState("");
  const [guestComment, setGuestComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCartImages, setShowCartImages] = useState(true);
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  
  // AI Assistant hook
  const assistant = useCustomerAIAssistant(catalogInfo?.id || null);

  // Success state
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [lastOrderNumber, setLastOrderNumber] = useState("");

  // Fullscreen image viewer
  const [fullscreenProduct, setFullscreenProduct] = useState<GuestProduct | null>(null);
  const [fullscreenIndex, setFullscreenIndex] = useState(0);

  // Detect mobile
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Get available categories from products' catalog_categories
  const availableCategories = useMemo(() => {
    // Collect unique category IDs from all products
    const categoryIds = [...new Set(
      products
        .flatMap(p => p.catalog_categories || [])
        .filter(Boolean)
    )];
    
    // Map to category info and sort
    return categoryIds
      .map(id => {
        const cat = storeCategories.find(c => c.id === id);
        return cat ? { id: cat.id, name: cat.name, sort_order: cat.sort_order } : null;
      })
      .filter((c): c is { id: string; name: string; sort_order: number | null } => c !== null)
      .sort((a, b) => {
        const orderA = a.sort_order ?? 999999;
        const orderB = b.sort_order ?? 999999;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name, 'ru');
      });
  }, [products, storeCategories]);

  // Get unique statuses
  const availableStatuses = useMemo(() => {
    const statusSet = new Set<string>();
    products.forEach(p => {
      if (p.catalog_status) statusSet.add(p.catalog_status);
    });
    const statusLabels: Record<string, string> = {
      in_stock: "В наличии",
      pre_order: "Под заказ",
      out_of_stock: "Нет в наличии",
      coming_soon: "Ожидается",
    };
    return Array.from(statusSet).map(s => ({ value: s, label: statusLabels[s] || s }));
  }, [products]);

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      // Filter by category - use catalog_categories array
      if (selectedCategory) {
        const productCategories = p.catalog_categories || [];
        if (!productCategories.includes(selectedCategory)) return false;
      }
      if (selectedStatus && p.catalog_status !== selectedStatus) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return p.name.toLowerCase().includes(q) || 
               p.sku?.toLowerCase().includes(q) ||
               p.description?.toLowerCase().includes(q);
      }
      return true;
    });
  }, [products, selectedCategory, selectedStatus, searchQuery]);

  // Handle checkout submission
  const handleCheckout = async () => {
    if (!guestName.trim() || !guestPhone.trim() || !guestAddress.trim()) {
      toast({
        title: "Заполните данные",
        description: "Укажите имя, телефон и адрес для оформления заказа",
        variant: "destructive",
      });
      return;
    }

    if (cart.length === 0) {
      toast({
        title: "Корзина пуста",
        description: "Добавьте товары для оформления заказа",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Use edge function for reliable guest order creation
      const { data, error } = await supabase.functions.invoke('create-guest-order', {
        body: {
          accessCode,
          guestName: guestName.trim(),
          guestPhone: guestPhone.trim(),
          guestAddress: guestAddress.trim(),
          guestComment: guestComment.trim() || undefined,
          items: cart.map(item => ({
            productId: item.productId,
            productName: item.productName,
            variantIndex: item.variantIndex,
            quantity: item.quantity,
            price: item.price,
          })),
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to create order');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to create order');
      }

      // Show success dialog
      setLastOrderNumber(data.orderNumber);
      clearCart();
      setCheckoutOpen(false);
      setCartOpen(false);
      setSuccessDialogOpen(true);

    } catch (err: any) {
      console.error('Checkout error:', err);
      toast({
        title: "Ошибка оформления",
        description: err.message || "Попробуйте ещё раз",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseSuccess = () => {
    setSuccessDialogOpen(false);
    setGuestName("");
    setGuestPhone("");
    setGuestAddress("");
    setGuestComment("");
  };

  const handleRegisterRedirect = () => {
    handleCloseSuccess();
    navigate(`/?tab=customer&catalog=${accessCode}&store=${catalogInfo?.store_id}`);
  };

  // Redirect authenticated CUSTOMERS to the access flow (sellers can stay here for testing)
  useEffect(() => {
    if (!user) return;
    if (authLoading) return;
    if (!catalogInfo) return;

    if (profile?.role === "customer") {
      navigate(`/catalog/${accessCode}`, { replace: true });
    }
  }, [user, profile, authLoading, catalogInfo, accessCode, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Загрузка каталога...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <Store className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-xl font-semibold mb-2">Каталог не найден</h1>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => navigate("/")} variant="outline">
            На главную
          </Button>
        </div>
      </div>
    );
  }

  // Helper functions for cart display (matching CustomerDashboard)
  const getVariantLabel = (variantIndex: number): string => {
    switch (variantIndex) {
      case 0: return 'Целая';
      case 1: return '½';
      case 2: return '¼';
      case 3: return 'Порция';
      default: return 'Целая';
    }
  };

  const getUnitLabel = (unit?: string | null): "кг" | "шт" => {
    const u = (unit ?? "").toString().toLowerCase().trim();
    if (u === "kg" || u === "кг" || u.includes("kg") || u.includes("кг")) return "кг";
    return "шт";
  };

  const getPortionVolume = (variantIndex: number, unitWeight: number): number => {
    switch (variantIndex) {
      case 0: return unitWeight;
      case 1: return unitWeight / 2;
      case 2: return unitWeight / 4;
      case 3: return 1;
      default: return unitWeight;
    }
  };

  // Cart content JSX - inlined to prevent focus loss issues (matching CustomerDashboard style)
  const cartContentJsx = (
    <div className="flex flex-col h-full">
      {/* Cart header with image toggle and total */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">Корзина</span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {cart.length}
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCartImages(!showCartImages)}
            className="p-1 rounded hover:bg-muted transition-colors"
          >
            <Image className={`w-4 h-4 ${showCartImages ? 'text-primary' : 'text-muted-foreground'}`} />
          </button>
          <span className="text-sm font-bold text-primary">{formatPriceSpaced(cartTotal)} ₽</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12 text-center">
            <ShoppingCart className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Корзина пуста</p>
          </div>
        ) : (
          <div className="px-3 py-2 space-y-0.5">
            {cart.map((item, idx) => {
              const variantLabel = getVariantLabel(item.variantIndex);
              const unitLabel = getUnitLabel(item.unit);
              const unitWeight = item.unit_weight || 1;
              const portionVolume = getPortionVolume(item.variantIndex, unitWeight);
              const portionVolumeFormatted = Number.isInteger(portionVolume) 
                ? portionVolume.toString() 
                : portionVolume.toFixed(1).replace('.', ',');
              const portionVolumeDisplay = `${portionVolumeFormatted} ${unitLabel}`;
              
              // Total volume for item
              const itemTotalVolume = portionVolume * item.quantity;
              const itemTotalVolumeFormatted = Number.isInteger(itemTotalVolume)
                ? itemTotalVolume.toString()
                : itemTotalVolume.toFixed(1).replace('.', ',');
              const itemTotalVolumeDisplay = `${itemTotalVolumeFormatted} ${unitLabel}`;

              return (
                <div key={`${item.productId}-${item.variantIndex}-${idx}`} className="flex gap-1.5 py-1.5 items-start">
                  {/* Product image */}
                  {showCartImages && (
                    <div className="relative w-7 h-7 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                      {item.images?.[0] ? (
                        <img src={item.images[0]} alt={item.productName} className="w-full h-full object-cover" />
                      ) : (
                        <Package className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                  )}
                  
                  {/* Name + variant */}
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <p className="font-medium text-sm truncate leading-tight">
                      {item.productName}
                    </p>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground truncate">
                      <span className="px-1 py-0.5 font-medium bg-primary/10 text-primary rounded flex-shrink-0">
                        {variantLabel}
                      </span>
                      <span className="truncate">{portionVolumeDisplay} · {formatPriceSpaced(item.price)}₽</span>
                    </div>
                  </div>
                  
                  {/* Quantity controls */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <div className="flex items-center">
                      <button 
                        className="w-5 h-5 flex items-center justify-center rounded bg-muted hover:bg-muted/80"
                        onClick={() => updateCartQuantity(item.productId, item.variantIndex, item.quantity - 1)}
                      >
                        <Minus className="h-2.5 w-2.5" />
                      </button>
                      <span className="w-4 text-center text-xs font-semibold tabular-nums">{item.quantity}</span>
                      <button 
                        className="w-5 h-5 flex items-center justify-center rounded bg-muted hover:bg-muted/80"
                        onClick={() => updateCartQuantity(item.productId, item.variantIndex, item.quantity + 1)}
                      >
                        <Plus className="h-2.5 w-2.5" />
                      </button>
                    </div>
                    
                    {/* Total + volume */}
                    <div className="text-right min-w-[52px]">
                      <div className="text-[11px] font-bold text-primary tabular-nums whitespace-nowrap">
                        {formatPriceSpaced(item.price * item.quantity)}₽
                      </div>
                      <div className="text-[9px] text-muted-foreground tabular-nums whitespace-nowrap">
                        {itemTotalVolumeDisplay}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {cart.length > 0 && (
        <div className="px-3 py-2 border-t border-border bg-muted/30 space-y-1.5">
          <Button 
            onClick={() => {
              setCartOpen(false);
              setCheckoutOpen(true);
            }} 
            className="w-full h-9 text-sm font-semibold"
          >
            Оформить {cart.length} поз. · {formatPrice(cartTotal)}
          </Button>
          <Button 
            onClick={() => navigate(`/?tab=customer&catalog=${accessCode}&store=${catalogInfo?.store_id}`)} 
            variant="ghost"
            className="w-full h-8 text-xs text-muted-foreground"
          >
            <LogIn className="w-3 h-3 mr-1" />
            Войти для сохранения заказов
          </Button>
        </div>
      )}
    </div>
  );

  // Checkout content JSX for desktop - inlined to prevent focus loss issues
  const checkoutContentJsx = (
    <div className="space-y-4 px-4 py-2">
      <div className="space-y-2">
        <Label htmlFor="guest-name">Имя</Label>
        <Input
          id="guest-name"
          placeholder="Ваше имя"
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          autoComplete="name"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="guest-phone">Телефон</Label>
        <Input
          id="guest-phone"
          type="tel"
          placeholder="+7 (999) 123-45-67"
          value={guestPhone}
          onChange={(e) => setGuestPhone(e.target.value)}
          autoComplete="tel"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="guest-address">Адрес доставки</Label>
        <Input
          id="guest-address"
          placeholder="Город, улица, дом, квартира"
          value={guestAddress}
          onChange={(e) => setGuestAddress(e.target.value)}
          autoComplete="street-address"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="guest-comment">Комментарий (необязательно)</Label>
        <Input
          id="guest-comment"
          placeholder="Дополнительные пожелания"
          value={guestComment}
          onChange={(e) => setGuestComment(e.target.value)}
        />
      </div>
      
      {/* Total only - matching CustomerDashboard */}
      <div className="pt-4 border-t border-border">
        <div className="flex justify-between text-lg font-semibold">
          <span>Итого:</span>
          <span>{formatPrice(cartTotal)}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background border-b border-border">
        <div className="h-12 flex items-center justify-between px-3 relative">
          <button 
            onClick={() => setCartOpen(true)}
            className="relative flex items-center gap-1.5 bg-primary/10 hover:bg-primary/20 transition-colors rounded-full py-1.5 px-3"
          >
            <ShoppingCart className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-foreground">{formatPrice(cartTotal)}</span>
            {cartItemsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                {cartItemsCount}
              </span>
            )}
          </button>

          {/* Category filter - center */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <DropdownMenu>
              <DropdownMenuTrigger 
                className={`p-1.5 transition-colors rounded-full ${selectedCategory ? 'bg-primary/20 text-primary' : 'bg-muted hover:bg-muted/80 text-muted-foreground'}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="min-w-[160px] bg-popover z-50">
                <DropdownMenuItem onClick={() => setSelectedCategory(null)} className="cursor-pointer">
                  <div className="flex items-center gap-2">
                    {!selectedCategory && <Check className="w-4 h-4 text-primary" />}
                    <span className={!selectedCategory ? "font-semibold" : ""}>Все категории</span>
                  </div>
                </DropdownMenuItem>
                {availableCategories.map((cat) => (
                  <DropdownMenuItem key={cat.id} onClick={() => setSelectedCategory(cat.id)} className="cursor-pointer">
                    <div className="flex items-center gap-2">
                      {selectedCategory === cat.id && <Check className="w-4 h-4 text-primary" />}
                      <span className={selectedCategory === cat.id ? "font-semibold" : ""}>{cat.name}</span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* AI and Login buttons - right */}
          <div className="flex items-center gap-2">
            {/* AI Assistant Button */}
            <button
              onClick={() => setIsAIPanelOpen(true)}
              className="relative flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 shadow-md shadow-purple-500/40 hover:shadow-purple-500/60 hover:scale-110 transition-all duration-300"
              title="AI Помощник"
            >
              <Sparkles className="w-4 h-4 text-white" />
              {assistant.itemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-white text-primary text-[10px] font-bold min-w-[16px] h-[16px] px-0.5 rounded-full flex items-center justify-center shadow-sm">
                  {assistant.itemCount}
                </span>
              )}
            </button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/?tab=customer&catalog=${accessCode}&store=${catalogInfo?.store_id}`)}
              className="text-xs"
            >
              <LogIn className="w-4 h-4 mr-1" />
              Войти
            </Button>
          </div>
        </div>

        {/* Search and controls */}
        <div className="h-10 flex items-center px-3 border-t border-border bg-muted/30 overflow-hidden">
          <div className={`flex items-center gap-1 transition-all duration-300 ease-in-out ${isSearchFocused ? 'w-0 opacity-0 overflow-hidden' : 'w-auto opacity-100'}`}>
            <button 
              onClick={() => setShowImages(!showImages)}
              className={`p-2 rounded transition-colors ${showImages ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground'}`}
            >
              <Image className="w-4 h-4" />
            </button>
          </div>

          <div className={`flex items-center transition-all duration-300 ease-in-out ${isSearchFocused ? 'flex-1 mx-0' : 'flex-1 mx-2'}`}>
            <div 
              className={`flex items-center gap-2 bg-background border border-border rounded-full transition-all duration-300 ease-in-out cursor-text ${isSearchFocused ? 'w-full px-3 py-1.5' : 'w-8 h-8 justify-center px-0'}`}
              onClick={() => {
                setIsSearchFocused(true);
                setTimeout(() => searchInputRef.current?.focus(), 50);
              }}
            >
              <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Поиск товара..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => { if (!searchQuery) setIsSearchFocused(false); }}
                className={`bg-transparent outline-none text-sm transition-all duration-300 ease-in-out ${isSearchFocused ? 'w-full opacity-100' : 'w-0 opacity-0'}`}
              />
              {isSearchFocused && searchQuery && (
                <button 
                  onClick={(e) => { e.stopPropagation(); setSearchQuery(''); searchInputRef.current?.focus(); }}
                  className="p-0.5 hover:bg-muted rounded-full"
                >
                  <X className="w-3 h-3 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>

          <div className={`flex items-center transition-all duration-300 ease-in-out ${isSearchFocused ? 'w-0 opacity-0 overflow-hidden' : 'w-auto opacity-100'}`}>
            <DropdownMenu>
              <DropdownMenuTrigger 
                className={`p-2 rounded transition-colors ${selectedStatus ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground'}`}
              >
                <Filter className="w-4 h-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[160px] bg-popover z-50">
                <DropdownMenuItem onClick={() => setSelectedStatus(null)} className="cursor-pointer">
                  <div className="flex items-center gap-2">
                    {!selectedStatus && <Check className="w-4 h-4 text-primary" />}
                    <span className={!selectedStatus ? "font-semibold" : ""}>Все статусы</span>
                  </div>
                </DropdownMenuItem>
                {availableStatuses.map((status) => (
                  <DropdownMenuItem key={status.value} onClick={() => setSelectedStatus(status.value)} className="cursor-pointer">
                    <div className="flex items-center gap-2">
                      {selectedStatus === status.value && <Check className="w-4 h-4 text-primary" />}
                      <span className={selectedStatus === status.value ? "font-semibold" : ""}>{status.label}</span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        
        {/* Store name */}
        <div className="px-3 py-1 border-t border-border bg-background">
          <p className="text-[10px] text-muted-foreground text-right truncate">
            {catalogInfo?.store_name} — {catalogInfo?.name}
          </p>
        </div>
      </header>

      {/* AI Assistant Banner */}
      {catalogInfo && (
        <CustomerAIAssistantBanner
          assistant={assistant}
          orders={[]}
          onOpenPanel={() => setIsAIPanelOpen(true)}
        />
      )}
      
      {/* AI Assistant Panel */}
      <CustomerAIAssistantPanel
        open={isAIPanelOpen}
        onOpenChange={setIsAIPanelOpen}
        assistant={assistant}
        orders={[]}
        onAddToCart={handleAIAddToCart}
      />
      <main className="flex-1 overflow-auto">
        {productsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <Package className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {searchQuery ? "Ничего не найдено" : "В каталоге пока нет товаров"}
            </p>
          </div>
        ) : (
          <div>
            {(() => {
              const renderProductCard = (product: GuestProduct) => (
                <GuestProductCard
                  key={product.id}
                  product={product}
                  cart={cart}
                  onAddToCart={addToCart}
                  showImages={showImages}
                  isExpanded={expandedProductId === product.id}
                  onImageClick={() => setExpandedProductId(expandedProductId === product.id ? null : product.id)}
                  onOpenFullscreen={(idx) => {
                    setFullscreenProduct(product);
                    setFullscreenIndex(idx);
                  }}
                  isDescriptionExpanded={descriptionExpandedId === product.id}
                  onNameClick={() => {
                    if (product.description) {
                      setDescriptionExpandedId(descriptionExpandedId === product.id ? null : product.id);
                    }
                  }}
                />
              );

              // Если выбрана конкретная категория - показать только её с заголовком
              if (selectedCategory) {
                const categoryName = availableCategories.find(c => c.id === selectedCategory)?.name || 'Категория';
                return (
                  <>
                    <div className="px-3 py-2 bg-muted/50 border-b border-border sticky top-0 z-10">
                      <span className="text-sm font-medium text-foreground">{categoryName}</span>
                    </div>
                    {filteredProducts.map(renderProductCard)}
                  </>
                );
              }

              // Если есть поисковый запрос - показать результаты без группировки
              if (searchQuery) {
                return filteredProducts.map(renderProductCard);
              }

              // Все категории - группировать продукты по категориям
              return (
                <>
                  {availableCategories.map((category) => {
                    const categoryProducts = filteredProducts.filter(
                      (p) => p.catalog_categories && p.catalog_categories.includes(category.id)
                    );
                    if (categoryProducts.length === 0) return null;

                    return (
                      <div key={category.id}>
                        <div className="px-3 py-2 bg-muted/50 border-b border-border sticky top-0 z-10">
                          <span className="text-sm font-medium text-foreground">{category.name}</span>
                        </div>
                        {categoryProducts.map(renderProductCard)}
                      </div>
                    );
                  })}

                  {/* Товары без категории */}
                  {(() => {
                    const uncategorizedProducts = filteredProducts.filter(
                      (p) => !p.catalog_categories || p.catalog_categories.length === 0
                    );
                    if (uncategorizedProducts.length === 0) return null;

                    return (
                      <div>
                        <div className="px-3 py-2 bg-muted/50 border-b border-border sticky top-0 z-10">
                          <span className="text-sm font-medium text-muted-foreground">Без категории</span>
                        </div>
                        {uncategorizedProducts.map(renderProductCard)}
                      </div>
                    );
                  })()}
                </>
              );
            })()}
          </div>
        )}
      </main>

      {/* Cart Sheet/Drawer */}
      {isMobile ? (
        <Drawer open={cartOpen} onOpenChange={setCartOpen}>
          <DrawerContent className="max-h-[85vh]">
            <DrawerHeader>
              <DrawerTitle>Корзина</DrawerTitle>
              <DrawerDescription>
                {cartItemsCount} {cartItemsCount === 1 ? 'товар' : 'товаров'} на {formatPrice(cartTotal)}
              </DrawerDescription>
            </DrawerHeader>
            {cartContentJsx}
          </DrawerContent>
        </Drawer>
      ) : (
        <Sheet open={cartOpen} onOpenChange={setCartOpen}>
          <SheetContent className="w-full sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Корзина</SheetTitle>
              <SheetDescription>
                {cartItemsCount} {cartItemsCount === 1 ? 'товар' : 'товаров'} на {formatPrice(cartTotal)}
              </SheetDescription>
            </SheetHeader>
            {cartContentJsx}
          </SheetContent>
        </Sheet>
      )}

      {/* Checkout Dialog/Drawer - mobile uses Drawer with inline buttons to prevent keyboard issues */}
      {isMobile ? (
        <Drawer open={checkoutOpen} onOpenChange={setCheckoutOpen}>
          <DrawerContent className="max-h-[85vh] flex flex-col">
            <DrawerHeader className="flex-shrink-0">
              <DrawerTitle>Оформление заказа</DrawerTitle>
              <DrawerDescription>
                Заполните данные для доставки
              </DrawerDescription>
            </DrawerHeader>
            
            {/* Scrollable content with buttons INSIDE to prevent keyboard jump */}
            <div className="flex-1 overflow-auto overscroll-contain px-4 pb-safe">
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="guest-name-mobile">Имя</Label>
                  <Input
                    id="guest-name-mobile"
                    placeholder="Ваше имя"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    autoComplete="name"
                    enterKeyHint="next"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guest-phone-mobile">Телефон</Label>
                  <Input
                    id="guest-phone-mobile"
                    type="tel"
                    inputMode="tel"
                    placeholder="+7 (999) 123-45-67"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    autoComplete="tel"
                    enterKeyHint="next"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guest-address-mobile">Адрес доставки</Label>
                  <Input
                    id="guest-address-mobile"
                    placeholder="Город, улица, дом, квартира"
                    value={guestAddress}
                    onChange={(e) => setGuestAddress(e.target.value)}
                    autoComplete="street-address"
                    enterKeyHint="next"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guest-comment-mobile">Комментарий (необязательно)</Label>
                  <Input
                    id="guest-comment-mobile"
                    placeholder="Дополнительные пожелания"
                    value={guestComment}
                    onChange={(e) => setGuestComment(e.target.value)}
                    enterKeyHint="done"
                  />
                </div>
                
                {/* Total */}
                <div className="pt-4 border-t border-border">
                  <div className="flex justify-between text-lg font-semibold">
                    <span>Итого:</span>
                    <span>{formatPrice(cartTotal)}</span>
                  </div>
                </div>
                
                {/* Buttons INSIDE scroll area - won't jump with keyboard */}
                <div className="flex gap-2 pt-4 pb-4 sticky bottom-0 bg-background">
                  <Button 
                    variant="outline" 
                    onClick={() => setCheckoutOpen(false)} 
                    className="flex-1"
                  >
                    Отмена
                  </Button>
                  <Button 
                    onClick={handleCheckout}
                    disabled={!guestName.trim() || !guestPhone.trim() || !guestAddress.trim() || isSubmitting}
                    className="flex-1"
                  >
                    {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Подтвердить
                  </Button>
                </div>
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
          <DialogContent 
            className="sm:max-w-md"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle>Оформление заказа</DialogTitle>
              <DialogDescription>
                Заполните данные для доставки
              </DialogDescription>
            </DialogHeader>
            {checkoutContentJsx}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setCheckoutOpen(false)}>
                Отмена
              </Button>
              <Button 
                onClick={handleCheckout}
                disabled={!guestName.trim() || !guestPhone.trim() || !guestAddress.trim() || isSubmitting}
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Подтвердить заказ
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Success Dialog/Drawer */}
      {isMobile ? (
        <Drawer open={successDialogOpen} onOpenChange={(open) => !open && handleCloseSuccess()}>
          <DrawerContent className="max-h-[70vh]">
            <DrawerHeader>
              <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <DrawerTitle className="text-center">Заказ оформлен!</DrawerTitle>
              <DrawerDescription className="text-center">
                Номер заказа: <span className="font-mono font-semibold">{lastOrderNumber}</span>
                <br />
                Мы свяжемся с вами в ближайшее время.
              </DrawerDescription>
            </DrawerHeader>
            
            <div className="px-4 pb-4 space-y-3">
              {/* Order details */}
              <div className="p-3 bg-muted/50 rounded-lg text-sm">
                <p><span className="text-muted-foreground">Имя:</span> {guestName}</p>
                <p><span className="text-muted-foreground">Телефон:</span> {guestPhone}</p>
                <p><span className="text-muted-foreground">Адрес:</span> {guestAddress}</p>
              </div>
              
              {/* Registration block - redirect to main page */}
              <div className="p-4 bg-primary/5 rounded-lg text-center">
                <p className="text-sm text-muted-foreground mb-3">
                  Хотите сохранять историю заказов?
                </p>
                <Button 
                  onClick={handleRegisterRedirect}
                  className="w-full"
                >
                  <User className="w-4 h-4 mr-2" />
                  Зарегистрироваться
                </Button>
              </div>
              
              <Button 
                variant="outline" 
                onClick={handleCloseSuccess}
                className="w-full"
              >
                Продолжить без регистрации
              </Button>
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={successDialogOpen} onOpenChange={(open) => !open && handleCloseSuccess()}>
          <DialogContent 
            className="sm:max-w-md"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <DialogTitle className="text-center">Заказ оформлен!</DialogTitle>
              <DialogDescription className="text-center">
                Номер заказа: <span className="font-mono font-semibold">{lastOrderNumber}</span>
                <br />
                Мы свяжемся с вами в ближайшее время.
              </DialogDescription>
            </DialogHeader>
            
            {/* Order details */}
            <div className="p-3 bg-muted/50 rounded-lg text-sm">
              <p><span className="text-muted-foreground">Имя:</span> {guestName}</p>
              <p><span className="text-muted-foreground">Телефон:</span> {guestPhone}</p>
              <p><span className="text-muted-foreground">Адрес:</span> {guestAddress}</p>
            </div>
            
            {/* Registration block - redirect to main page */}
            <div className="p-4 bg-primary/5 rounded-lg text-center">
              <p className="text-sm text-muted-foreground mb-3">
                Хотите сохранять историю заказов?
              </p>
              <Button 
                onClick={handleRegisterRedirect}
                className="w-full"
              >
                <User className="w-4 h-4 mr-2" />
                Зарегистрироваться
              </Button>
            </div>
            
            <Button 
              variant="outline" 
              onClick={handleCloseSuccess}
              className="w-full"
            >
              Продолжить без регистрации
            </Button>
          </DialogContent>
        </Dialog>
      )}

      {/* Fullscreen Image Viewer */}
      <FullscreenImageViewer
        images={fullscreenProduct?.images || []}
        currentIndex={fullscreenIndex}
        isOpen={!!fullscreenProduct}
        onClose={() => setFullscreenProduct(null)}
        onIndexChange={setFullscreenIndex}
      />
    </div>
  );
};

export default GuestCatalogView;
