import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMoyskladOrderSync } from "@/hooks/useMoyskladOrderSync";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Package,
  Loader2,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  CheckCircle2,
  Clock,
  Truck,
  XCircle,
  FileText,
  ArrowLeft,
} from "lucide-react";

interface OrderItem {
  id: string;
  product_name: string;
  product_id: string | null;
  quantity: number;
  price: number;
  total: number;
}

interface CRMOrder {
  id: string;
  order_number: string;
  status: string;
  total: number;
  subtotal: number;
  created_at: string;
  updated_at: string;
  store_id: string;
  notes: string | null;
  moysklad_order_id: string | null;
  moysklad_status: string | null;
  moysklad_data: any;
  shipping_address: {
    name?: string;
    phone?: string;
    address?: string;
    comment?: string;
  } | null;
  items: OrderItem[];
  store_name?: string;
}

function formatPrice(price: number): string {
  return `${Math.round(price).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ₽`;
}

function formatPriceRaw(price: number): string {
  return Math.round(price).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  pending: { label: "Новый", icon: Clock, color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
  forming: { label: "Формируется", icon: Package, color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  processing: { label: "В обработке", icon: Package, color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  shipped: { label: "Отправлен", icon: Truck, color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" },
  delivered: { label: "Доставлен", icon: CheckCircle2, color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  cancelled: { label: "Отменён", icon: XCircle, color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
};

export function CustomerCRMOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<CRMOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const { syncing, syncedData, syncErrors, lastSyncTime, syncOrders } = useMoyskladOrderSync();

  const fetchOrders = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: prof } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();
      if (!prof) return;

      const { data: storeCustomers } = await supabase
        .from("store_customers")
        .select("id, store_id")
        .eq("profile_id", prof.id);
      if (!storeCustomers || storeCustomers.length === 0) { setOrders([]); return; }

      const customerIds = storeCustomers.map(sc => sc.id);
      const storeIds = [...new Set(storeCustomers.map(sc => sc.store_id))];

      // Fetch store names
      const { data: stores } = await supabase
        .from("stores")
        .select("id, name")
        .in("id", storeIds);
      const storeMap = new Map((stores || []).map(s => [s.id, s.name]));

      const { data: ordersData } = await supabase
        .from("orders")
        .select("*")
        .in("customer_id", customerIds)
        .order("created_at", { ascending: false });

      if (!ordersData || ordersData.length === 0) { setOrders([]); return; }

      const orderIds = ordersData.map(o => o.id);
      const { data: itemsData } = await supabase
        .from("order_items")
        .select("*")
        .in("order_id", orderIds);

      const mapped: CRMOrder[] = ordersData.map(o => ({
        id: o.id,
        order_number: o.order_number,
        status: o.status,
        total: Number(o.total),
        subtotal: Number(o.subtotal),
        created_at: o.created_at,
        updated_at: o.updated_at,
        store_id: o.store_id,
        notes: o.notes,
        moysklad_order_id: o.moysklad_order_id || null,
        moysklad_status: o.moysklad_status || null,
        moysklad_data: o.moysklad_data || null,
        shipping_address: o.shipping_address as CRMOrder["shipping_address"],
        items: (itemsData || [])
          .filter(i => i.order_id === o.id)
          .map(i => ({
            id: i.id,
            product_name: i.product_name,
            product_id: i.product_id,
            quantity: i.quantity,
            price: Number(i.price),
            total: Number(i.total),
          })),
        store_name: storeMap.get(o.store_id) || "",
      }));

      setOrders(mapped);
    } catch (e) {
      console.error("Error fetching CRM orders:", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Auto-sync MoySklad
  useEffect(() => {
    if (orders.length > 0 && !loading) {
      const ordersWithMs = orders
        .filter(o => o.moysklad_order_id)
        .map(o => ({
          id: o.id,
          moysklad_order_id: o.moysklad_order_id!,
          store_id: o.store_id,
        }));
      if (ordersWithMs.length > 0) {
        syncOrders(ordersWithMs);
      }
    }
  }, [orders, loading]);

  const handleRefresh = () => {
    fetchOrders();
    const ordersWithMs = orders
      .filter(o => o.moysklad_order_id)
      .map(o => ({
        id: o.id,
        moysklad_order_id: o.moysklad_order_id!,
        store_id: o.store_id,
      }));
    if (ordersWithMs.length > 0) {
      syncOrders(ordersWithMs);
    }
  };

  const selectedOrder = selectedOrderId ? orders.find(o => o.id === selectedOrderId) : null;

  if (selectedOrder) {
    return (
      <OrderDetailView
        order={selectedOrder}
        msData={syncedData[selectedOrder.id] || (selectedOrder.moysklad_data ? {
          status: selectedOrder.moysklad_status,
          positions: selectedOrder.moysklad_data?.positions || [],
          sum: selectedOrder.moysklad_data?.sum || 0,
        } : null)}
        syncError={syncErrors[selectedOrder.id] === true}
        syncing={syncing}
        onBack={() => setSelectedOrderId(null)}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Package className="w-10 h-10 mx-auto mb-3 opacity-50" />
        <p className="text-sm font-medium">Заказов пока нет</p>
        <p className="text-xs mt-1">Ваши заказы появятся здесь</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Заказы</span>
          <Badge variant="secondary" className="text-[10px]">{orders.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          {lastSyncTime && (
            <span className="text-[10px] text-muted-foreground">
              {lastSyncTime.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={syncing}
            className="p-1.5 rounded hover:bg-muted transition-colors"
            title="Обновить"
          >
            <RotateCcw className={`w-3.5 h-3.5 text-muted-foreground ${syncing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Orders list */}
      <div className="space-y-2">
        {orders.map(order => {
          const msData = syncedData[order.id] || (order.moysklad_data ? {
            status: order.moysklad_status,
            positions: order.moysklad_data?.positions || [],
            sum: order.moysklad_data?.sum || 0,
          } : null);
          const msStatus = msData?.status || order.moysklad_status;
          const sc = statusConfig[order.status] || statusConfig.pending;
          const StatusIcon = sc.icon;
          const positionsCount = msData?.positions?.length || order.items.length;
          const totalSum = msData?.sum && msData.sum > 0 ? msData.sum : order.total;

          // Calculate total weight from positions
          const totalWeight = msData?.positions?.reduce((sum: number, p: any) => sum + (p.quantity || 0), 0) || 0;

          return (
            <button
              key={order.id}
              onClick={() => setSelectedOrderId(order.id)}
              className="w-full text-left p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-muted/30 transition-all group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">#{order.order_number}</span>
                  {/* CRM sync indicator */}
                  {order.moysklad_order_id && (
                    <div className={`w-2 h-2 rounded-full ${
                      syncing ? 'bg-amber-400 animate-pulse' :
                      syncErrors[order.id] === true ? 'bg-destructive' :
                      msData ? 'bg-green-500' :
                      'bg-muted-foreground/40'
                    }`} />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {msStatus ? (
                    <Badge variant="outline" className="text-[10px] font-medium">
                      {msStatus}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className={`${sc.color} border-0 text-[10px]`}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {sc.label}
                    </Badge>
                  )}
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-3">
                  <span>{new Date(order.created_at).toLocaleDateString('ru-RU')}</span>
                  {order.store_name && <span className="text-foreground/60">{order.store_name}</span>}
                  <span>{positionsCount} поз.</span>
                  {totalWeight > 0 && (
                    <span>Вес: {Number.isInteger(totalWeight) ? totalWeight : totalWeight.toFixed(1)} кг</span>
                  )}
                </div>
                <span className="font-bold text-sm text-foreground">{formatPrice(totalSum)}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Detailed order view - MoySklad-style table
function OrderDetailView({
  order,
  msData,
  syncError,
  syncing,
  onBack,
}: {
  order: CRMOrder;
  msData: any;
  syncError: boolean;
  syncing: boolean;
  onBack: () => void;
}) {
  const msStatus = msData?.status || order.moysklad_status;
  const positions = msData?.positions || [];
  const totalSum = msData?.sum && msData.sum > 0 ? msData.sum : order.total;
  const sc = statusConfig[order.status] || statusConfig.pending;

  // Use MoySklad positions if available, otherwise local items
  const useMs = positions.length > 0;
  const displayItems = useMs
    ? positions.map((p: any, i: number) => ({
        index: i + 1,
        name: p.name || `Позиция ${i + 1}`,
        quantity: p.quantity || 0,
        unit: p.unit || 'шт',
        price: p.price || 0,
        total: (p.quantity || 0) * (p.price || 0),
      }))
    : order.items.map((item, i) => ({
        index: i + 1,
        name: item.product_name,
        quantity: item.quantity,
        unit: 'шт',
        price: item.price,
        total: item.total,
      }));

  const totalQuantity = displayItems.reduce((sum: number, item: any) => sum + item.quantity, 0);
  const totalWeight = useMs
    ? positions.reduce((sum: number, p: any) => sum + (p.quantity || 0), 0)
    : 0;

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* Header with back button */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-base">Заказ #{order.order_number}</h3>
            {order.moysklad_order_id && (
              <div className={`w-2.5 h-2.5 rounded-full ${
                syncing ? 'bg-amber-400 animate-pulse' :
                syncError ? 'bg-destructive' :
                msData ? 'bg-green-500' :
                'bg-muted-foreground/40'
              }`} title={
                syncing ? 'Синхронизация...' :
                syncError ? 'Ошибка синхронизации' :
                msData ? 'Синхронизировано с CRM' :
                'Ожидание синхронизации'
              } />
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {new Date(order.created_at).toLocaleDateString('ru-RU', {
              day: '2-digit', month: 'long', year: 'numeric',
            })}
            {order.store_name && ` · ${order.store_name}`}
          </p>
        </div>
        <div>
          {msStatus ? (
            <Badge variant="outline" className="text-xs font-medium">
              {msStatus}
            </Badge>
          ) : (
            <Badge variant="secondary" className={`${sc.color} border-0 text-xs`}>
              {sc.label}
            </Badge>
          )}
        </div>
      </div>

      {/* Shipping info */}
      {order.shipping_address && (
        <div className="p-3 bg-muted/50 rounded-lg text-xs space-y-1">
          {order.shipping_address.name && (
            <p><span className="text-muted-foreground">Получатель:</span> {order.shipping_address.name}</p>
          )}
          {order.shipping_address.phone && (
            <p><span className="text-muted-foreground">Телефон:</span> {order.shipping_address.phone}</p>
          )}
          {order.shipping_address.address && (
            <p><span className="text-muted-foreground">Адрес:</span> {order.shipping_address.address}</p>
          )}
          {order.shipping_address.comment && (
            <p><span className="text-muted-foreground">Комментарий:</span> {order.shipping_address.comment}</p>
          )}
        </div>
      )}

      {/* Positions table - MoySklad-style */}
      <div className="border border-border rounded-lg overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[2rem_1fr_4.5rem_4rem_5.5rem_5.5rem] bg-muted/60 border-b border-border text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          <div className="px-2 py-2 text-center">№</div>
          <div className="px-2 py-2">Наименование</div>
          <div className="px-2 py-2 text-right">Кол-во</div>
          <div className="px-2 py-2 text-center">Ед.</div>
          <div className="px-2 py-2 text-right">Цена</div>
          <div className="px-2 py-2 text-right">Сумма</div>
        </div>

        {/* Table rows */}
        <div className="divide-y divide-border">
          {displayItems.map((item: any) => (
            <div
              key={item.index}
              className="grid grid-cols-[2rem_1fr_4.5rem_4rem_5.5rem_5.5rem] hover:bg-muted/30 transition-colors"
            >
              <div className="px-2 py-2 text-[11px] text-muted-foreground text-center">
                {item.index}
              </div>
              <div className="px-2 py-2 text-[11px] text-foreground leading-tight break-words">
                {item.name}
              </div>
              <div className="px-2 py-2 text-[11px] text-foreground text-right font-medium">
                {Number.isInteger(item.quantity) ? item.quantity : item.quantity.toFixed(1)}
              </div>
              <div className="px-2 py-2 text-[11px] text-muted-foreground text-center">
                {item.unit}
              </div>
              <div className="px-2 py-2 text-[11px] text-foreground text-right">
                {formatPriceRaw(item.price)}
              </div>
              <div className="px-2 py-2 text-[11px] text-foreground text-right font-medium">
                {formatPriceRaw(item.total)}
              </div>
            </div>
          ))}
        </div>

        {/* Table footer */}
        <div className="border-t border-border bg-muted/30">
          <div className="grid grid-cols-[2rem_1fr_4.5rem_4rem_5.5rem_5.5rem]">
            <div className="px-2 py-2" />
            <div className="px-2 py-2 text-[10px] text-muted-foreground font-medium">
              Всего: {displayItems.length} поз.
            </div>
            <div className="px-2 py-2 text-[11px] text-foreground text-right font-bold">
              {Number.isInteger(totalQuantity)
                ? totalQuantity
                : totalQuantity.toFixed(1)}
            </div>
            <div className="px-2 py-2 text-[11px] text-muted-foreground text-center">
              {totalWeight > 0 ? 'кг' : ''}
            </div>
            <div className="px-2 py-2" />
            <div className="px-2 py-2 text-[11px] text-foreground text-right font-bold">
              {formatPriceRaw(totalSum)}
            </div>
          </div>
        </div>
      </div>

      {/* Total summary */}
      <div className="flex justify-end">
        <div className="space-y-1 text-right">
          <div className="flex items-center justify-end gap-4">
            <span className="text-xs text-muted-foreground">Промежуточный итог</span>
            <span className="text-sm font-medium w-24 text-right">{formatPrice(order.subtotal)}</span>
          </div>
          {msData?.sum && msData.sum > 0 && msData.sum !== order.subtotal && (
            <div className="flex items-center justify-end gap-4">
              <span className="text-xs text-muted-foreground">Итог из CRM</span>
              <span className="text-sm font-medium w-24 text-right">{formatPrice(msData.sum)}</span>
            </div>
          )}
          <div className="flex items-center justify-end gap-4 pt-1 border-t border-border">
            <span className="text-sm font-bold">Общая стоимость</span>
            <span className="text-lg font-bold w-24 text-right">{formatPrice(totalSum)}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {order.notes && (
        <div className="p-3 bg-muted/50 rounded-lg">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Примечание</p>
          <p className="text-xs text-foreground">{order.notes}</p>
        </div>
      )}
    </div>
  );
}
