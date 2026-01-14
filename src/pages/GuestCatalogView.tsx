import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useGuestCatalog, GuestProduct, GuestCartItem } from "@/hooks/useGuestCatalog";
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
  MessageCircle
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
    cart,
    loading,
    productsLoading,
    error,
    addToCart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    cartTotal,
    cartItemsCount,
  } = useGuestCatalog(accessCode);

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
  const [guestComment, setGuestComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCartImages, setShowCartImages] = useState(true);

  // Success & registration state
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [lastOrderNumber, setLastOrderNumber] = useState("");
  const [lastOrderId, setLastOrderId] = useState("");
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [registerPassword, setRegisterPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);

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

  // Get unique categories from products
  const categories = useMemo(() => {
    const categoryMap = new Map<string, string>();
    products.forEach(p => {
      if (p.category_id && p.category_name) {
        categoryMap.set(p.category_id, p.category_name);
      }
    });
    return Array.from(categoryMap.entries()).map(([id, name]) => ({ id, name }));
  }, [products]);

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
      if (selectedCategory && p.category_id !== selectedCategory) return false;
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
    if (!guestName.trim() || !guestPhone.trim()) {
      toast({
        title: "Заполните данные",
        description: "Укажите имя и телефон для оформления заказа",
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

      // Show success dialog with registration option
      setLastOrderNumber(data.orderNumber);
      setLastOrderId(data.orderId);
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

  // Handle registration after order
  const handleRegister = async () => {
    if (!registerPassword || registerPassword.length < 6) {
      toast({
        title: "Слишком короткий пароль",
        description: "Пароль должен содержать минимум 6 символов",
        variant: "destructive",
      });
      return;
    }

    setIsRegistering(true);

    try {
      // Create email from phone (for Supabase auth)
      const cleanPhone = guestPhone.replace(/\D/g, '');
      const email = `${cleanPhone}@phone.local`;

      // Sign up user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password: registerPassword,
        options: {
          data: {
            full_name: guestName,
            phone: guestPhone,
          },
        },
      });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error('Ошибка создания аккаунта');
      }

      // Create profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: authData.user.id,
          email,
          full_name: guestName,
          phone: guestPhone,
          role: 'customer',
        })
        .select()
        .single();

      if (profileError) {
        console.error('Profile creation error:', profileError);
        // Profile might already exist via trigger, try to fetch it
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', authData.user.id)
          .single();
        
        if (!existingProfile) throw profileError;
      }

      const profileId = profile?.id || (await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', authData.user.id)
        .single()).data?.id;

      if (!profileId) throw new Error('Не удалось получить профиль');

      // Create store_customer record
      const { data: storeCustomer, error: scError } = await supabase
        .from('store_customers')
        .insert({
          profile_id: profileId,
          store_id: catalogInfo!.store_id,
        })
        .select()
        .single();

      if (scError && !scError.message.includes('duplicate')) {
        console.error('Store customer error:', scError);
      }

      // Get store_customer id (either just created or existing)
      const storeCustomerId = storeCustomer?.id || (await supabase
        .from('store_customers')
        .select('id')
        .eq('profile_id', profileId)
        .eq('store_id', catalogInfo!.store_id)
        .single()).data?.id;

      if (storeCustomerId) {
        // Add catalog access
        await supabase
          .from('customer_catalog_access')
          .insert({
            store_customer_id: storeCustomerId,
            catalog_id: catalogInfo!.id,
          })
          .select()
          .maybeSingle();

        // Link the guest order to this customer
        if (lastOrderId) {
          await supabase
            .from('orders')
            .update({ 
              customer_id: storeCustomerId,
              is_guest_order: false,
            })
            .eq('id', lastOrderId);
        }
      }

      toast({
        title: "Аккаунт создан!",
        description: "Теперь ваши заказы будут сохраняться в истории",
      });

      // Clear form and close dialog
      setSuccessDialogOpen(false);
      setShowRegisterForm(false);
      setRegisterPassword("");
      setGuestName("");
      setGuestPhone("");
      setGuestComment("");

      // Redirect to customer dashboard
      navigate('/customer-dashboard');

    } catch (err: any) {
      console.error('Registration error:', err);
      toast({
        title: "Ошибка регистрации",
        description: err.message || "Попробуйте ещё раз",
        variant: "destructive",
      });
    } finally {
      setIsRegistering(false);
    }
  };

  const handleCloseSuccess = () => {
    setSuccessDialogOpen(false);
    setShowRegisterForm(false);
    setRegisterPassword("");
    setGuestName("");
    setGuestPhone("");
    setGuestComment("");
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

  // Checkout content JSX - inlined to prevent focus loss issues
  const checkoutContentJsx = (
    <div className="space-y-4 p-4">
      <div className="space-y-2">
        <Label htmlFor="guest-name">Ваше имя *</Label>
        <Input
          id="guest-name"
          placeholder="Как к вам обращаться?"
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="guest-phone">Телефон *</Label>
        <Input
          id="guest-phone"
          type="tel"
          placeholder="+7 (999) 123-45-67"
          value={guestPhone}
          onChange={(e) => setGuestPhone(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="guest-comment">Комментарий</Label>
        <Input
          id="guest-comment"
          placeholder="Пожелания к заказу"
          value={guestComment}
          onChange={(e) => setGuestComment(e.target.value)}
        />
      </div>
      
      <div className="bg-muted/30 rounded-lg p-3 space-y-2">
        <div className="text-sm font-medium">Ваш заказ:</div>
        {cart.map((item, idx) => {
          const variantLabels = ['Целая', '1/2', '1/4', 'Порция'];
          return (
            <div key={idx} className="flex justify-between text-sm">
              <span className="truncate">{item.productName} ({variantLabels[item.variantIndex]}) × {item.quantity}</span>
              <span className="font-medium ml-2">{formatPrice(item.price * item.quantity)}</span>
            </div>
          );
        })}
        <div className="border-t border-border pt-2 flex justify-between font-medium">
          <span>Итого:</span>
          <span>{formatPrice(cartTotal)}</span>
        </div>
      </div>

      <Button 
        onClick={handleCheckout} 
        disabled={isSubmitting}
        className="w-full"
      >
        {isSubmitting ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Check className="w-4 h-4 mr-2" />
        )}
        Отправить заказ
      </Button>
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
                {categories.map((cat) => (
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

          {/* Login button - right */}
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

      {/* Products */}
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
            {filteredProducts.map((product) => (
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
            ))}
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

      {/* Checkout Dialog/Drawer - mobile uses Drawer to prevent off-screen issues with keyboard */}
      {isMobile ? (
        <Drawer open={checkoutOpen} onOpenChange={setCheckoutOpen}>
          <DrawerContent className="max-h-[90vh]">
            <DrawerHeader>
              <DrawerTitle>Оформление заказа</DrawerTitle>
              <DrawerDescription>
                Укажите контактные данные для связи
              </DrawerDescription>
            </DrawerHeader>
            <div className="overflow-auto max-h-[calc(90vh-120px)]">
              {checkoutContentJsx}
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
          <DialogContent 
            className="sm:max-w-md max-h-[90vh] overflow-auto"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle>Оформление заказа</DialogTitle>
              <DialogDescription>
                Укажите контактные данные для связи
              </DialogDescription>
            </DialogHeader>
            {checkoutContentJsx}
          </DialogContent>
        </Dialog>
      )}

      {/* Success Dialog/Drawer with Registration Option */}
      {isMobile ? (
        <Drawer open={successDialogOpen} onOpenChange={(open) => !open && handleCloseSuccess()}>
          <DrawerContent className="max-h-[90vh]">
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
            <div className="overflow-auto max-h-[calc(90vh-160px)] px-4 pb-4">
              {!showRegisterForm ? (
                <div className="space-y-4 pt-4">
                  <div className="p-4 bg-muted/50 rounded-lg text-center">
                    <p className="text-sm text-muted-foreground mb-3">
                      Хотите сохранять историю заказов и быстрее оформлять следующие покупки?
                    </p>
                    <Button 
                      onClick={() => setShowRegisterForm(true)}
                      className="w-full"
                    >
                      <User className="w-4 h-4 mr-2" />
                      Создать аккаунт
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
              ) : (
                <div className="space-y-4 pt-4">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm">
                      <span className="text-muted-foreground">Имя:</span> {guestName}
                    </p>
                    <p className="text-sm">
                      <span className="text-muted-foreground">Телефон:</span> {guestPhone}
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="register-password-mobile">Придумайте пароль</Label>
                    <Input
                      id="register-password-mobile"
                      type="password"
                      placeholder="Минимум 6 символов"
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Пароль нужен для входа в личный кабинет
                    </p>
                  </div>

                  <Button 
                    onClick={handleRegister}
                    disabled={isRegistering}
                    className="w-full"
                  >
                    {isRegistering ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4 mr-2" />
                    )}
                    Зарегистрироваться
                  </Button>
                  
                  <Button 
                    variant="ghost" 
                    onClick={() => setShowRegisterForm(false)}
                    className="w-full"
                  >
                    Назад
                  </Button>
                </div>
              )}
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={successDialogOpen} onOpenChange={(open) => !open && handleCloseSuccess()}>
          <DialogContent 
            className="sm:max-w-md max-h-[90vh] overflow-auto"
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

            {!showRegisterForm ? (
              <div className="space-y-4 pt-4">
                <div className="p-4 bg-muted/50 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground mb-3">
                    Хотите сохранять историю заказов и быстрее оформлять следующие покупки?
                  </p>
                  <Button 
                    onClick={() => setShowRegisterForm(true)}
                    className="w-full"
                  >
                    <User className="w-4 h-4 mr-2" />
                    Создать аккаунт
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
            ) : (
              <div className="space-y-4 pt-4">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm">
                    <span className="text-muted-foreground">Имя:</span> {guestName}
                  </p>
                  <p className="text-sm">
                    <span className="text-muted-foreground">Телефон:</span> {guestPhone}
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="register-password">Придумайте пароль</Label>
                  <Input
                    id="register-password"
                    type="password"
                    placeholder="Минимум 6 символов"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Пароль нужен для входа в личный кабинет
                  </p>
                </div>

                <Button 
                  onClick={handleRegister}
                  disabled={isRegistering}
                  className="w-full"
                >
                  {isRegistering ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 mr-2" />
                  )}
                  Зарегистрироваться
                </Button>
                
                <Button 
                  variant="ghost" 
                  onClick={() => setShowRegisterForm(false)}
                  className="w-full"
                >
                  Назад
                </Button>
              </div>
            )}
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
