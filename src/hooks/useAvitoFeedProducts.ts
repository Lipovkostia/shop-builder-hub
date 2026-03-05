import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface AvitoFeedProduct {
  id: string;
  store_id: string;
  product_id: string;
  avito_category: string | null;
  avito_address: string | null;
  avito_params: any;
  created_at: string;
}

export function useAvitoFeedProducts(storeId: string | null) {
  const { toast } = useToast();
  const [feedProducts, setFeedProducts] = useState<AvitoFeedProduct[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchFeedProducts = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("avito_feed_products")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setFeedProducts(data || []);
    } catch (err: any) {
      console.error("Error fetching avito feed products:", err);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    fetchFeedProducts();
  }, [fetchFeedProducts]);

  const addProductsToFeed = useCallback(async (productIds: string[]) => {
    if (!storeId) return false;
    try {
      const existing = new Set(feedProducts.map(fp => fp.product_id));
      const newIds = productIds.filter(id => !existing.has(id));
      if (newIds.length === 0) {
        toast({ title: "Все выбранные товары уже в фиде Авито" });
        return true;
      }
      const rows = newIds.map(pid => ({ store_id: storeId, product_id: pid }));
      const { error } = await supabase.from("avito_feed_products").insert(rows);
      if (error) throw error;
      toast({ title: `Добавлено ${newIds.length} товар(ов) в фид Авито` });
      await fetchFeedProducts();
      return true;
    } catch (err: any) {
      console.error("Error adding to avito feed:", err);
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
      return false;
    }
  }, [storeId, feedProducts, fetchFeedProducts, toast]);

  const removeProductFromFeed = useCallback(async (productId: string) => {
    if (!storeId) return;
    try {
      const { error } = await supabase
        .from("avito_feed_products")
        .delete()
        .eq("store_id", storeId)
        .eq("product_id", productId);
      if (error) throw error;
      setFeedProducts(prev => prev.filter(fp => fp.product_id !== productId));
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    }
  }, [storeId, toast]);

  const removeProductsFromFeed = useCallback(async (productIds: string[]) => {
    if (!storeId) return;
    try {
      const { error } = await supabase
        .from("avito_feed_products")
        .delete()
        .eq("store_id", storeId)
        .in("product_id", productIds);
      if (error) throw error;
      setFeedProducts(prev => prev.filter(fp => !productIds.includes(fp.product_id)));
      toast({ title: `Удалено ${productIds.length} товар(ов) из фида Авито` });
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    }
  }, [storeId, toast]);

  const feedProductIds = new Set(feedProducts.map(fp => fp.product_id));

  return {
    feedProducts,
    feedProductIds,
    loading,
    addProductsToFeed,
    removeProductFromFeed,
    removeProductsFromFeed,
    refetch: fetchFeedProducts,
  };
}
