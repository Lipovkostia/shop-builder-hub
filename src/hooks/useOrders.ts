import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  price: number;
  total: number;
}

export interface Order {
  id: string;
  order_number: string;
  store_id: string;
  customer_id: string | null;
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  subtotal: number;
  shipping_cost: number | null;
  discount: number | null;
  total: number;
  shipping_address: {
    name?: string;
    phone?: string;
    address?: string;
    comment?: string;
  } | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
  customer_name?: string;
  customer_email?: string;
}

export interface CreateOrderData {
  storeId: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    price: number;
  }>;
  shippingAddress: {
    name: string;
    phone: string;
    address: string;
    comment?: string;
  };
}

// Hook for seller's admin panel
export function useStoreOrders(storeId: string | null) {
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchOrders = useCallback(async () => {
    if (!storeId) return;

    try {
      setLoading(true);

      const { data: ordersData, error } = await supabase
        .from("orders")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get order items for all orders
      const orderIds = ordersData?.map(o => o.id) || [];
      
      let itemsData: any[] = [];
      if (orderIds.length > 0) {
        const { data: items } = await supabase
          .from("order_items")
          .select("*")
          .in("order_id", orderIds);
        itemsData = items || [];
      }

      // Get customer info
      const customerIds = ordersData?.map(o => o.customer_id).filter(Boolean) || [];
      let customersData: any[] = [];
      if (customerIds.length > 0) {
        const { data: storeCustomers } = await supabase
          .from("store_customers")
          .select("id, profile_id")
          .in("id", customerIds as string[]);

        if (storeCustomers && storeCustomers.length > 0) {
          const profileIds = storeCustomers.map(sc => sc.profile_id);
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, full_name, email")
            .in("id", profileIds);
          
          customersData = storeCustomers.map(sc => {
            const profile = profiles?.find(p => p.id === sc.profile_id);
            return {
              store_customer_id: sc.id,
              name: profile?.full_name || "",
              email: profile?.email || "",
            };
          });
        }
      }

      const mappedOrders: Order[] = (ordersData || []).map(o => {
        const orderItems = itemsData.filter(i => i.order_id === o.id);
        const customer = customersData.find(c => c.store_customer_id === o.customer_id);
        
        return {
          id: o.id,
          order_number: o.order_number,
          store_id: o.store_id,
          customer_id: o.customer_id,
          status: o.status as Order["status"],
          subtotal: Number(o.subtotal),
          shipping_cost: o.shipping_cost ? Number(o.shipping_cost) : null,
          discount: o.discount ? Number(o.discount) : null,
          total: Number(o.total),
          shipping_address: o.shipping_address as Order["shipping_address"],
          notes: o.notes,
          created_at: o.created_at,
          updated_at: o.updated_at,
          items: orderItems.map(i => ({
            id: i.id,
            order_id: i.order_id,
            product_id: i.product_id,
            product_name: i.product_name,
            quantity: i.quantity,
            price: Number(i.price),
            total: Number(i.total),
          })),
          customer_name: customer?.name,
          customer_email: customer?.email,
        };
      });

      setOrders(mappedOrders);
    } catch (error: any) {
      console.error("Error fetching orders:", error);
      toast({
        title: "Ошибка загрузки заказов",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [storeId, toast]);

  const updateOrderStatus = useCallback(async (orderId: string, status: Order["status"]) => {
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status })
        .eq("id", orderId);

      if (error) throw error;

      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
      
      toast({
        title: "Статус обновлён",
      });
    } catch (error: any) {
      console.error("Error updating order status:", error);
      toast({
        title: "Ошибка обновления",
        description: error.message,
        variant: "destructive",
      });
    }
  }, [toast]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return {
    orders,
    loading,
    updateOrderStatus,
    refetch: fetchOrders,
  };
}

// Hook for fetching customer's orders history
export function useCustomerOrdersHistory() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!profile) return;

      // Get all store_customer records for this profile
      const { data: storeCustomers } = await supabase
        .from("store_customers")
        .select("id")
        .eq("profile_id", profile.id);

      if (!storeCustomers || storeCustomers.length === 0) return;

      const customerIds = storeCustomers.map(sc => sc.id);

      // Get orders for all store_customer records
      const { data: ordersData, error } = await supabase
        .from("orders")
        .select("*")
        .in("customer_id", customerIds)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get order items
      const orderIds = ordersData?.map(o => o.id) || [];
      let itemsData: any[] = [];
      if (orderIds.length > 0) {
        const { data: items } = await supabase
          .from("order_items")
          .select("*")
          .in("order_id", orderIds);
        itemsData = items || [];
      }

      const mappedOrders: Order[] = (ordersData || []).map(o => ({
        id: o.id,
        order_number: o.order_number,
        store_id: o.store_id,
        customer_id: o.customer_id,
        status: o.status as Order["status"],
        subtotal: Number(o.subtotal),
        shipping_cost: o.shipping_cost ? Number(o.shipping_cost) : null,
        discount: o.discount ? Number(o.discount) : null,
        total: Number(o.total),
        shipping_address: o.shipping_address as Order["shipping_address"],
        notes: o.notes,
        created_at: o.created_at,
        updated_at: o.updated_at,
        items: itemsData.filter(i => i.order_id === o.id).map(i => ({
          id: i.id,
          order_id: i.order_id,
          product_id: i.product_id,
          product_name: i.product_name,
          quantity: i.quantity,
          price: Number(i.price),
          total: Number(i.total),
        })),
      }));

      setOrders(mappedOrders);
    } catch (error: any) {
      console.error("Error fetching customer orders:", error);
      toast({
        title: "Ошибка загрузки заказов",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return {
    orders,
    loading,
    refetch: fetchOrders,
  };
}

// Hook for customer's order placement
export function useCustomerOrders() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const createOrder = useCallback(async (data: CreateOrderData): Promise<string | null> => {
    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Не авторизован");

      // Get profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!profile) throw new Error("Профиль не найден");

      // Get store_customer record
      const { data: storeCustomer } = await supabase
        .from("store_customers")
        .select("id")
        .eq("profile_id", profile.id)
        .eq("store_id", data.storeId)
        .single();

      if (!storeCustomer) throw new Error("Вы не являетесь клиентом этого магазина");

      // Calculate totals
      const subtotal = data.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const total = subtotal;

      // Generate order number
      const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;

      // Create order
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          store_id: data.storeId,
          customer_id: storeCustomer.id,
          order_number: orderNumber,
          subtotal,
          total,
          shipping_address: data.shippingAddress,
          status: "pending",
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = data.items.map(item => ({
        order_id: order.id,
        product_id: item.productId,
        product_name: item.productName,
        quantity: item.quantity,
        price: item.price,
        total: item.price * item.quantity,
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems);

      if (itemsError) throw itemsError;

      toast({
        title: "Заказ оформлен!",
        description: `Номер заказа: ${orderNumber}`,
      });

      return order.id;
    } catch (error: any) {
      console.error("Error creating order:", error);
      toast({
        title: "Ошибка оформления заказа",
        description: error.message,
        variant: "destructive",
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  return {
    createOrder,
    loading,
  };
}
