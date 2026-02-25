import React, { useState, useCallback } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Check, X, Package, Clock, ChevronsUpDown, EyeOff, Copy, RotateCcw, 
  Loader2, ShoppingCart, Eye, Camera, FileText, Upload, Phone, MapPin, User
} from "lucide-react";
import { Order } from "@/hooks/useOrders";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Status config
const STATUS_CONFIG: Record<string, { label: string; color: string; bgClass: string }> = {
  pending: { label: "Новый", color: "text-amber-800 dark:text-amber-200", bgClass: "bg-amber-100 dark:bg-amber-900/50 border-amber-200 dark:border-amber-700" },
  processing: { label: "Принят", color: "text-blue-800 dark:text-blue-200", bgClass: "bg-blue-100 dark:bg-blue-900/50 border-blue-200 dark:border-blue-700" },
  shipped: { label: "Отправлен", color: "text-purple-800 dark:text-purple-200", bgClass: "bg-purple-100 dark:bg-purple-900/50 border-purple-200 dark:border-purple-700" },
  delivered: { label: "Выполнен", color: "text-green-800 dark:text-green-200", bgClass: "bg-green-100 dark:bg-green-900/50 border-green-200 dark:border-green-700" },
  cancelled: { label: "Отменён", color: "text-red-800 dark:text-red-200", bgClass: "bg-red-100 dark:bg-red-900/50 border-red-200 dark:border-red-700" },
  forming: { label: "Формируется", color: "text-gray-800 dark:text-gray-200", bgClass: "bg-gray-100 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700" },
};

const STATUS_FLOW: Record<string, string[]> = {
  pending: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
};

interface OrderAttachment {
  id: string;
  order_id: string;
  file_url: string;
  file_name: string;
  file_type: string;
  attachment_type: "photo" | "document";
  created_at: string;
}

function OrderStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 ${config.bgClass} ${config.color} font-medium`}>
      {config.label}
    </Badge>
  );
}

function OrderCollapsedInfo({ order }: { order: Order }) {
  const customerName = order.shipping_address?.name || order.customer_name || order.guest_name || "";
  const phone = order.shipping_address?.phone || order.guest_phone || "";
  const address = order.shipping_address?.address || "";
  // Try to extract city from address (first part before comma)
  const city = address ? address.split(",")[0]?.trim() : "";
  
  return (
    <div className="flex-1 min-w-0">
      {/* Row 1: Status badges + price */}
      <div className="flex items-center justify-between gap-2 mb-0.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <OrderStatusBadge status={order.status} />
          {order.shipping_address?.source === "retail" && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-primary/10 text-primary border-primary/30">
              Розница
            </Badge>
          )}
        </div>
        <span className="font-bold text-base sm:text-lg tabular-nums whitespace-nowrap">
          {order.total.toLocaleString()} ₽
        </span>
      </div>
      
      {/* Row 2: Customer name + phone */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {customerName && (
            <span className="font-semibold text-sm text-foreground truncate">
              {customerName}
            </span>
          )}
          {!customerName && (
            <span className="font-medium text-sm text-foreground truncate">
              {order.order_number}
            </span>
          )}
        </div>
        {phone && (
          <a 
            href={`tel:${phone}`} 
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-primary hover:underline whitespace-nowrap flex items-center gap-0.5 flex-shrink-0"
          >
            <Phone className="h-3 w-3" />
            <span className="hidden sm:inline">{phone}</span>
            <span className="sm:hidden">{phone.slice(-4)}</span>
          </a>
        )}
      </div>
      
      {/* Row 3: Order number + items + date + city */}
      <div className="flex items-center justify-between gap-2 mt-0.5 text-[11px] sm:text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5 min-w-0">
          {customerName && (
            <span className="truncate">{order.order_number}</span>
          )}
          {order.items && order.items.length > 0 && (
            <span className="whitespace-nowrap">• {order.items.length} поз.</span>
          )}
          <span className="flex items-center gap-0.5 whitespace-nowrap">
            <Clock className="h-3 w-3 flex-shrink-0" />
            {new Date(order.created_at).toLocaleString("ru-RU", {
              day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
            })}
          </span>
        </div>
        {city && (
          <span className="flex items-center gap-0.5 truncate max-w-[100px] sm:max-w-[160px]">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            {city}
          </span>
        )}
      </div>
    </div>
  );
}

function OrderAttachments({ 
  orderId, 
  storeId,
  attachments, 
  onRefresh 
}: { 
  orderId: string; 
  storeId: string;
  attachments: OrderAttachment[];
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  
  const photos = attachments.filter(a => a.attachment_type === "photo");
  const docs = attachments.filter(a => a.attachment_type === "document");
  
  const handleUpload = async (type: "photo" | "document") => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = type === "photo" ? "image/*" : "*";
    
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files || files.length === 0) return;
      
      setUploading(true);
      try {
        for (const file of Array.from(files)) {
          const ext = file.name.split(".").pop() || "bin";
          const path = `${storeId}/${orderId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
          
          const { error: uploadError } = await supabase.storage
            .from("order-attachments")
            .upload(path, file);
          
          if (uploadError) throw uploadError;
          
          const { data: urlData } = supabase.storage
            .from("order-attachments")
            .getPublicUrl(path);
          
          const { error: insertError } = await (supabase as any)
            .from("order_attachments")
            .insert({
              order_id: orderId,
              file_url: urlData.publicUrl,
              file_name: file.name,
              file_type: file.type || "application/octet-stream",
              attachment_type: type,
            });
          
          if (insertError) throw insertError;
        }
        
        toast({ title: type === "photo" ? "Фото загружены" : "Документы загружены" });
        onRefresh();
      } catch (err: any) {
        console.error("Upload error:", err);
        toast({ title: "Ошибка загрузки", description: err.message, variant: "destructive" });
      } finally {
        setUploading(false);
      }
    };
    
    input.click();
  };
  
  return (
    <div className="space-y-3">
      {/* Photos section */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Camera className="h-3.5 w-3.5" /> Фото ({photos.length})
          </span>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 text-xs gap-1" 
            onClick={() => handleUpload("photo")}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            Загрузить
          </Button>
        </div>
        {photos.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {photos.map(p => (
              <a key={p.id} href={p.file_url} target="_blank" rel="noopener noreferrer"
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border border-border hover:border-primary transition-colors"
              >
                <img src={p.file_url} alt={p.file_name} className="w-full h-full object-cover" />
              </a>
            ))}
          </div>
        )}
      </div>
      
      {/* Documents section */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <FileText className="h-3.5 w-3.5" /> Документы ({docs.length})
          </span>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 text-xs gap-1" 
            onClick={() => handleUpload("document")}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            Загрузить
          </Button>
        </div>
        {docs.length > 0 && (
          <div className="space-y-1">
            {docs.map(d => (
              <a key={d.id} href={d.file_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-primary hover:underline py-1"
              >
                <FileText className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{d.file_name}</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface OrdersSectionProps {
  orders: Order[];
  loading: boolean;
  updateOrderStatus: (orderId: string, status: Order["status"]) => void;
  storeId: string;
}

export function OrdersSection({ orders, loading, updateOrderStatus, storeId }: OrdersSectionProps) {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [hiddenOrders, setHiddenOrders] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(`hidden_orders_${storeId}`);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });
  const [showHiddenOrders, setShowHiddenOrders] = useState(false);
  const [hidingOrderId, setHidingOrderId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Record<string, OrderAttachment[]>>({});
  const [loadingAttachments, setLoadingAttachments] = useState<Set<string>>(new Set());
  
  // Persist hidden orders
  React.useEffect(() => {
    if (storeId) {
      if (hiddenOrders.size > 0) {
        localStorage.setItem(`hidden_orders_${storeId}`, JSON.stringify([...hiddenOrders]));
      } else {
        localStorage.removeItem(`hidden_orders_${storeId}`);
      }
    }
  }, [hiddenOrders, storeId]);
  
  const handleHideOrder = (orderId: string) => {
    setHidingOrderId(orderId);
    setTimeout(() => {
      setHiddenOrders(prev => new Set(prev).add(orderId));
      setHidingOrderId(null);
    }, 400);
  };
  
  const handleRestoreOrder = (orderId: string) => {
    setHiddenOrders(prev => {
      const next = new Set(prev);
      next.delete(orderId);
      return next;
    });
  };
  
  const fetchAttachments = useCallback(async (orderId: string) => {
    if (loadingAttachments.has(orderId) || attachments[orderId]) return;
    setLoadingAttachments(prev => new Set(prev).add(orderId));
    try {
      const { data, error } = await (supabase as any)
        .from("order_attachments")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });
      if (!error && data) {
        setAttachments(prev => ({ ...prev, [orderId]: data as OrderAttachment[] }));
      }
    } catch (e) {
      console.error("Error fetching attachments:", e);
    } finally {
      setLoadingAttachments(prev => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  }, [attachments, loadingAttachments]);
  
  const refreshAttachments = (orderId: string) => {
    setAttachments(prev => {
      const next = { ...prev };
      delete next[orderId];
      return next;
    });
    // Re-fetch
    setTimeout(() => {
      setLoadingAttachments(prev => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
      fetchAttachments(orderId);
    }, 100);
  };
  
  const handleCopyOrder = async (order: Order) => {
    if (!order.items || order.items.length === 0) return;
    const statusLabel = STATUS_CONFIG[order.status]?.label || order.status;
    const dateStr = new Date(order.created_at).toLocaleDateString("ru-RU");
    const timeStr = new Date(order.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    
    let text = `📦 ЗАКАЗ ${order.order_number}\n`;
    text += `📅 ${dateStr} в ${timeStr}\n`;
    text += `📍 Статус: ${statusLabel}\n`;
    const name = order.shipping_address?.name || order.customer_name || order.guest_name;
    if (name) text += `👤 Клиент: ${name}\n`;
    const phone = order.shipping_address?.phone || order.guest_phone;
    if (phone) text += `📱 Телефон: ${phone}\n`;
    text += `─────────────────────\n\n🛒 ТОВАРЫ:\n\n`;
    order.items.forEach((item, idx) => {
      text += `${idx + 1}. ${item.product_name}\n   ${item.quantity} шт × ${item.price.toLocaleString()} ₽ = ${item.total.toLocaleString()} ₽\n`;
    });
    text += `\n─────────────────────\n`;
    text += `💰 ИТОГО: ${order.total.toLocaleString()} ₽\n`;
    if (order.shipping_address?.address) {
      text += `\n🏠 Адрес: ${order.shipping_address.address}\n`;
    }
    if (order.shipping_address?.comment) {
      text += `💬 ${order.shipping_address.comment}\n`;
    }
    
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Заказ скопирован", description: "Можно вставить в мессенджер" });
    } catch {
      toast({ title: "Не удалось скопировать", variant: "destructive" });
    }
  };
  
  const toggleExpand = (orderId: string, open: boolean) => {
    setExpandedOrders(prev => {
      const next = new Set(prev);
      if (open) { next.add(orderId); fetchAttachments(orderId); }
      else next.delete(orderId);
      return next;
    });
  };
  
  const renderOrderCard = (order: Order, isHidden = false) => {
    const isExpanded = expandedOrders.has(order.id);
    
    return (
      <div 
        key={order.id}
        className={`transition-all duration-300 ${
          hidingOrderId === order.id ? "opacity-0 -translate-x-full scale-95" : "opacity-100 translate-x-0 scale-100"
        }`}
      >
        <Collapsible
          open={isExpanded}
          onOpenChange={(open) => toggleExpand(order.id, open)}
          className={`rounded-lg border ${isHidden ? "bg-muted/30 border-border/50" : "bg-card border-border"}`}
        >
          <CollapsibleTrigger asChild>
            <button className="w-full p-3 sm:p-4 text-left hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-muted/50 flex items-center justify-center">
                  <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                
                <OrderCollapsedInfo order={order} />
                
                {/* Action buttons */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {isHidden ? (
                    <div
                      onClick={(e) => { e.stopPropagation(); handleRestoreOrder(order.id); }}
                      className="w-8 h-8 rounded-full bg-muted/50 hover:bg-muted flex items-center justify-center cursor-pointer transition-colors"
                      title="Восстановить"
                    >
                      <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  ) : (
                    <>
                      <div
                        onClick={(e) => { e.stopPropagation(); handleHideOrder(order.id); }}
                        className="w-8 h-8 rounded-full bg-muted/50 hover:bg-destructive/20 flex items-center justify-center cursor-pointer transition-colors group"
                        title="Скрыть"
                      >
                        <EyeOff className="h-3.5 w-3.5 text-muted-foreground group-hover:text-destructive transition-colors" />
                      </div>
                      <div
                        onClick={(e) => { e.stopPropagation(); handleCopyOrder(order); }}
                        className="w-8 h-8 rounded-full bg-muted/50 hover:bg-muted flex items-center justify-center cursor-pointer transition-colors"
                        title="Скопировать"
                      >
                        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </>
                  )}
                </div>
              </div>
            </button>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <div className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-3">
              {/* Order items */}
              {order.items && order.items.length > 0 && (
                <div className="border-t border-border pt-3">
                  <div className="space-y-2">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{item.product_name}</div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span>{item.quantity} шт</span>
                            <span>·</span>
                            <span>{item.price.toLocaleString()} ₽/шт</span>
                          </div>
                        </div>
                        <div className="font-bold text-sm text-primary tabular-nums flex-shrink-0">
                          {item.total.toLocaleString()} ₽
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-dashed border-border">
                    <span className="text-sm text-muted-foreground">
                      Итого ({order.items.length} {order.items.length === 1 ? "товар" : order.items.length < 5 ? "товара" : "товаров"})
                    </span>
                    <span className="font-bold text-base sm:text-lg">{order.total.toLocaleString()} ₽</span>
                  </div>
                </div>
              )}
              
              {/* Shipping address */}
              {order.shipping_address && (
                <div className="bg-muted/30 rounded-lg p-3 text-sm">
                  {order.shipping_address.name && (
                    <div className="flex items-center gap-2 mb-1">
                      <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="font-medium">{order.shipping_address.name}</span>
                    </div>
                  )}
                  {order.shipping_address.phone && (
                    <div className="flex items-center gap-2 mb-1">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <a href={`tel:${order.shipping_address.phone}`} className="text-primary hover:underline">
                        {order.shipping_address.phone}
                      </a>
                    </div>
                  )}
                  {order.shipping_address.address && (
                    <div className="flex items-start gap-2 mb-1">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <span>{order.shipping_address.address}</span>
                    </div>
                  )}
                  {order.shipping_address.comment && (
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <span>💬</span>
                      <span className="italic">{order.shipping_address.comment}</span>
                    </div>
                  )}
                </div>
              )}
              
              {/* Guest info (if no shipping_address) */}
              {!order.shipping_address && (order.guest_name || order.guest_phone) && (
                <div className="bg-muted/30 rounded-lg p-3 text-sm">
                  {order.guest_name && (
                    <div className="flex items-center gap-2 mb-1">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium">{order.guest_name}</span>
                    </div>
                  )}
                  {order.guest_phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                      <a href={`tel:${order.guest_phone}`} className="text-primary hover:underline">
                        {order.guest_phone}
                      </a>
                    </div>
                  )}
                </div>
              )}
              
              {/* Attachments (photos + documents) */}
              <div className="border-t border-border pt-3">
                <OrderAttachments 
                  orderId={order.id}
                  storeId={storeId}
                  attachments={attachments[order.id] || []}
                  onRefresh={() => refreshAttachments(order.id)}
                />
              </div>
              
              {/* Status change */}
              {STATUS_FLOW[order.status] && STATUS_FLOW[order.status].length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                  {order.status === "pending" && (
                    <>
                      <Button size="sm" className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700" onClick={() => updateOrderStatus(order.id, "processing" as any)}>
                        <Check className="h-3 w-3 mr-1" /> Принять
                      </Button>
                      <Button size="sm" variant="destructive" className="flex-1 sm:flex-none" onClick={() => updateOrderStatus(order.id, "cancelled" as any)}>
                        <X className="h-3 w-3 mr-1" /> Отменить
                      </Button>
                    </>
                  )}
                  {order.status === "processing" && (
                    <>
                      <Button size="sm" className="flex-1 sm:flex-none bg-purple-600 hover:bg-purple-700" onClick={() => updateOrderStatus(order.id, "shipped" as any)}>
                        <Package className="h-3 w-3 mr-1" /> Отправлен
                      </Button>
                      <Button size="sm" variant="destructive" className="flex-1 sm:flex-none" onClick={() => updateOrderStatus(order.id, "cancelled" as any)}>
                        <X className="h-3 w-3 mr-1" /> Отменить
                      </Button>
                    </>
                  )}
                  {order.status === "shipped" && (
                    <Button size="sm" className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700" onClick={() => updateOrderStatus(order.id, "delivered" as any)}>
                      <Check className="h-3 w-3 mr-1" /> Выполнен
                    </Button>
                  )}
                </div>
              )}
              
              {/* Status selector for any manual change */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Статус:</span>
                <Select
                  value={order.status}
                  onValueChange={(value) => updateOrderStatus(order.id, value as any)}
                >
                  <SelectTrigger className="h-7 w-auto min-w-[120px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Новый</SelectItem>
                    <SelectItem value="processing">Принят</SelectItem>
                    <SelectItem value="shipped">Отправлен</SelectItem>
                    <SelectItem value="delivered">Выполнен</SelectItem>
                    <SelectItem value="cancelled">Отменён</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    );
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (orders.length === 0) {
    return (
      <div className="bg-card rounded-lg border border-border p-8 text-center">
        <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="font-medium text-foreground mb-2">Нет заказов</h3>
        <p className="text-sm text-muted-foreground">
          Заказы появятся здесь, когда покупатели оформят их через прайс-листы
        </p>
      </div>
    );
  }
  
  const visibleOrders = orders.filter(o => !hiddenOrders.has(o.id));
  const hiddenOrdersList = orders.filter(o => hiddenOrders.has(o.id));
  
  return (
    <div className="space-y-4">
      {/* Hidden orders toggle */}
      {hiddenOrders.size > 0 && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHiddenOrders(!showHiddenOrders)}
            className={`gap-1.5 ${showHiddenOrders ? "bg-muted border-muted-foreground/50" : ""}`}
          >
            <Eye className={`h-3.5 w-3.5 ${showHiddenOrders ? "" : "opacity-50"}`} />
            Скрытые ({hiddenOrders.size})
          </Button>
        </div>
      )}
      
      {showHiddenOrders ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <EyeOff className="h-4 w-4" />
            <span>Скрытые заказы</span>
          </div>
          {hiddenOrdersList.length === 0 ? (
            <div className="bg-card rounded-lg border border-border p-8 text-center">
              <EyeOff className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium text-foreground mb-2">Нет скрытых заказов</h3>
            </div>
          ) : (
            hiddenOrdersList.map(order => renderOrderCard(order, true))
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {visibleOrders.length === 0 ? (
            <div className="bg-card rounded-lg border border-border p-8 text-center">
              <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium text-foreground mb-2">Нет видимых заказов</h3>
              <p className="text-sm text-muted-foreground">
                {hiddenOrders.size > 0
                  ? `${hiddenOrders.size} заказов скрыто. Нажмите «Скрытые» для просмотра.`
                  : "Заказы появятся здесь"}
              </p>
            </div>
          ) : (
            visibleOrders.map(order => renderOrderCard(order))
          )}
        </div>
      )}
    </div>
  );
}
