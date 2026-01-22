import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface FormingOrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  unit?: string;
  portionType?: string;
}

export interface FormingOrder {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  items: FormingOrderItem[];
  subtotal: number;
  total: number;
  lastActivityAt: string;
  createdAt: string;
}

export function useFormingOrders(storeId: string | null) {
  const [formingOrders, setFormingOrders] = useState<FormingOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchFormingOrders = useCallback(async () => {
    if (!storeId) return;

    setIsLoading(true);
    try {
      // First get orders with status 'forming'
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          id,
          customer_id,
          subtotal,
          total,
          created_at,
          last_activity_at,
          order_items (
            id,
            product_id,
            product_name,
            quantity,
            price
          )
        `)
        .eq('store_id', storeId)
        .eq('status', 'forming' as any)
        .order('last_activity_at', { ascending: false }) as any;

      if (error) throw error;

      if (!orders || orders.length === 0) {
        setFormingOrders([]);
        setIsLoading(false);
        return;
      }

      // Get customer IDs and fetch their profile info
      const customerIds: string[] = [...new Set(orders.map((o: any) => o.customer_id).filter(Boolean))] as string[];
      
      let customerProfiles: Record<string, { name: string; phone: string | null }> = {};
      
      if (customerIds.length > 0) {
        // Get store_customers with profile info
        const { data: storeCustomers } = await supabase
          .from('store_customers')
          .select(`
            id,
            profile_id,
            profiles!inner (
              full_name,
              phone
            )
          `)
          .in('id', customerIds) as any;
        
        if (storeCustomers) {
          for (const sc of storeCustomers) {
            customerProfiles[sc.id] = {
              name: sc.profiles?.full_name || 'Покупатель',
              phone: sc.profiles?.phone || null,
            };
          }
        }
      }

      const formattedOrders: FormingOrder[] = (orders || []).map((order: any) => ({
        id: order.id,
        customerId: order.customer_id,
        customerName: customerProfiles[order.customer_id]?.name || 'Неизвестный покупатель',
        customerPhone: customerProfiles[order.customer_id]?.phone,
        items: (order.order_items || []).map((item: any) => ({
          id: item.id,
          productId: item.product_id,
          productName: item.product_name,
          quantity: item.quantity,
          price: item.price,
          unit: item.unit,
          portionType: item.portion_type,
        })),
        subtotal: order.subtotal || 0,
        total: order.total || 0,
        lastActivityAt: order.last_activity_at || order.created_at,
        createdAt: order.created_at,
      }));

      setFormingOrders(formattedOrders);
    } catch (error) {
      console.error('Error fetching forming orders:', error);
    } finally {
      setIsLoading(false);
    }
  }, [storeId]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!storeId) return;

    fetchFormingOrders();

    const channel = supabase
      .channel(`forming-orders-${storeId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `store_id=eq.${storeId}`,
        },
        (payload) => {
          console.log('Order change:', payload);
          fetchFormingOrders();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_items',
        },
        (payload) => {
          console.log('Order item change:', payload);
          fetchFormingOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [storeId, fetchFormingOrders]);

  // Helper to get activity status
  const getActivityStatus = (lastActivityAt: string): 'active' | 'idle' | 'abandoned' => {
    const now = new Date();
    const lastActivity = new Date(lastActivityAt);
    const diffMinutes = (now.getTime() - lastActivity.getTime()) / (1000 * 60);

    if (diffMinutes < 5) return 'active';
    if (diffMinutes < 30) return 'idle';
    return 'abandoned';
  };

  // Helper to format time ago
  const formatTimeAgo = (dateString: string): string => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffMinutes < 1) return 'только что';
    if (diffMinutes < 60) return `${diffMinutes} мин назад`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} ч назад`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} дн назад`;
  };

  return {
    formingOrders,
    isLoading,
    refetch: fetchFormingOrders,
    getActivityStatus,
    formatTimeAgo,
  };
}
