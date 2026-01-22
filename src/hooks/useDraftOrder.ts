import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface DraftOrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  unit?: string;
  portionType?: string;
}

export interface DraftOrder {
  id: string;
  items: DraftOrderItem[];
  subtotal: number;
  total: number;
  lastActivityAt: string;
}

export function useDraftOrder(storeId: string | null, customerId: string | null) {
  const [draftOrder, setDraftOrder] = useState<DraftOrder | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  // Load existing draft order on mount
  const loadDraftOrder = useCallback(async () => {
    if (!storeId || !customerId) return null;

    setIsLoading(true);
    try {
      // Find existing forming order for this customer and store
      const { data: order, error } = await supabase
        .from('orders')
        .select(`
          id,
          subtotal,
          total,
          order_items (
            id,
            product_id,
            product_name,
            quantity,
            price
          )
        `)
        .eq('store_id', storeId)
        .eq('customer_id', customerId)
        .eq('status', 'forming' as any)
        .maybeSingle() as any;

      if (error) throw error;

      if (order) {
        const items: DraftOrderItem[] = (order.order_items || []).map((item: any) => ({
          productId: item.product_id,
          productName: item.product_name,
          quantity: item.quantity,
          price: item.price,
          unit: item.unit,
          portionType: item.portion_type,
        }));

        setDraftOrder({
          id: order.id,
          items,
          subtotal: order.subtotal || 0,
          total: order.total || 0,
          lastActivityAt: order.last_activity_at || new Date().toISOString(),
        });

        return order.id;
      }

      return null;
    } catch (error) {
      console.error('Error loading draft order:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [storeId, customerId]);

  // Create a new draft order
  const createDraftOrder = useCallback(async (): Promise<string | null> => {
    if (!storeId || !customerId) return null;

    try {
      const { data: order, error } = await supabase
        .from('orders')
        .insert({
          store_id: storeId,
          customer_id: customerId,
          status: 'forming' as any,
          subtotal: 0,
          total: 0,
          last_activity_at: new Date().toISOString(),
        } as any)
        .select('id')
        .single();

      if (error) throw error;

      setDraftOrder({
        id: order.id,
        items: [],
        subtotal: 0,
        total: 0,
        lastActivityAt: new Date().toISOString(),
      });

      return order.id;
    } catch (error) {
      console.error('Error creating draft order:', error);
      return null;
    }
  }, [storeId, customerId]);

  // Get or create draft order
  const getOrCreateDraft = useCallback(async (): Promise<string | null> => {
    const existingId = await loadDraftOrder();
    if (existingId) return existingId;
    return await createDraftOrder();
  }, [loadDraftOrder, createDraftOrder]);

  // Sync cart items to draft order
  const syncItems = useCallback(async (items: DraftOrderItem[], orderId?: string) => {
    const targetOrderId = orderId || draftOrder?.id;
    if (!targetOrderId) return;

    setIsSyncing(true);
    try {
      // Delete existing items
      await supabase
        .from('order_items')
        .delete()
        .eq('order_id', targetOrderId);

      // Insert new items
      if (items.length > 0) {
        const orderItems = items.map(item => ({
          order_id: targetOrderId,
          product_id: item.productId,
          product_name: item.productName,
          quantity: item.quantity,
          price: item.price,
          total: item.price * item.quantity,
        }));

        const { error: insertError } = await supabase
          .from('order_items')
          .insert(orderItems as any);

        if (insertError) throw insertError;
      }

      // Calculate totals
      const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const total = subtotal;

      // Update order totals and activity
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          subtotal,
          total,
          last_activity_at: new Date().toISOString(),
        } as any)
        .eq('id', targetOrderId);

      if (updateError) throw updateError;

      setDraftOrder(prev => prev ? {
        ...prev,
        items,
        subtotal,
        total,
        lastActivityAt: new Date().toISOString(),
      } : null);

    } catch (error) {
      console.error('Error syncing items:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [draftOrder?.id]);

  // Submit order (forming -> pending)
  const submitOrder = useCallback(async (shippingAddress: string): Promise<boolean> => {
    if (!draftOrder?.id) return false;

    try {
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'pending' as any,
          shipping_address: shippingAddress,
          last_activity_at: new Date().toISOString(),
        } as any)
        .eq('id', draftOrder.id);

      if (error) throw error;

      setDraftOrder(null);
      return true;
    } catch (error) {
      console.error('Error submitting order:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось оформить заказ',
        variant: 'destructive',
      });
      return false;
    }
  }, [draftOrder?.id, toast]);

  // Discard draft order
  const discardDraft = useCallback(async (): Promise<boolean> => {
    if (!draftOrder?.id) return true;

    try {
      // Delete order items first
      await supabase
        .from('order_items')
        .delete()
        .eq('order_id', draftOrder.id);

      // Delete the order
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', draftOrder.id);

      if (error) throw error;

      setDraftOrder(null);
      return true;
    } catch (error) {
      console.error('Error discarding draft:', error);
      return false;
    }
  }, [draftOrder?.id]);

  // Load draft on mount
  useEffect(() => {
    if (storeId && customerId) {
      loadDraftOrder();
    }
  }, [storeId, customerId, loadDraftOrder]);

  return {
    draftOrder,
    isLoading,
    isSyncing,
    getOrCreateDraft,
    syncItems,
    submitOrder,
    discardDraft,
    loadDraftOrder,
  };
}
