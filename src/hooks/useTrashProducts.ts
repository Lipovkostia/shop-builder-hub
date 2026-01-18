import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { logActivity } from "@/hooks/useActivityLogs";
import { StoreProduct } from "@/hooks/useStoreProducts";

export interface TrashedProduct extends StoreProduct {
  deleted_at: string;
}

export function useTrashProducts(storeId: string | null) {
  const { toast } = useToast();
  const [trashedProducts, setTrashedProducts] = useState<TrashedProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const instanceIdRef = useRef(Math.random().toString(36).slice(2));

  // Fetch all deleted products for the store
  const fetchTrashedProducts = useCallback(async () => {
    if (!storeId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("store_id", storeId)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });

      if (error) throw error;
      setTrashedProducts(data || []);
    } catch (error: any) {
      console.error("Error fetching trashed products:", error);
      toast({
        title: "Ошибка загрузки корзины",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [storeId, toast]);

  // Realtime sync
  useEffect(() => {
    if (!storeId) return;

    const channel = supabase
      .channel(`trash-products-${storeId}-${instanceIdRef.current}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "products",
          filter: `store_id=eq.${storeId}`,
        },
        (payload) => {
          const eventType = payload.eventType;
          const newRow = payload.new as TrashedProduct | undefined;
          const oldRow = payload.old as { id: string; deleted_at: string | null } | undefined;

          if (eventType === "UPDATE") {
            // Product was moved to trash
            if (newRow?.deleted_at) {
              setTrashedProducts((prev) => {
                if (prev.some((p) => p.id === newRow.id)) {
                  return prev.map((p) => (p.id === newRow.id ? newRow : p));
                }
                return [newRow, ...prev];
              });
            } 
            // Product was restored from trash
            else if (oldRow?.deleted_at && !newRow?.deleted_at) {
              setTrashedProducts((prev) => prev.filter((p) => p.id !== newRow?.id));
            }
          }

          if (eventType === "DELETE" && oldRow) {
            setTrashedProducts((prev) => prev.filter((p) => p.id !== oldRow.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [storeId]);

  // Restore a product from trash
  const restoreProduct = useCallback(
    async (productId: string) => {
      const product = trashedProducts.find((p) => p.id === productId);
      try {
        const { error } = await supabase
          .from("products")
          .update({ deleted_at: null })
          .eq("id", productId);

        if (error) throw error;

        setTrashedProducts((prev) => prev.filter((p) => p.id !== productId));

        // Log activity
        if (storeId && product) {
          logActivity({
            storeId,
            actionType: "restore",
            entityType: "product",
            entityId: productId,
            entityName: product.name,
          });
        }

        toast({
          title: "Товар восстановлен",
          description: product ? `"${product.name}" восстановлен из корзины` : undefined,
        });
        return true;
      } catch (error: any) {
        console.error("Error restoring product:", error);
        toast({
          title: "Ошибка восстановления",
          description: error.message,
          variant: "destructive",
        });
        return false;
      }
    },
    [storeId, trashedProducts, toast]
  );

  // Restore multiple products
  const restoreProducts = useCallback(
    async (productIds: string[]) => {
      try {
        const { error } = await supabase
          .from("products")
          .update({ deleted_at: null })
          .in("id", productIds);

        if (error) throw error;

        setTrashedProducts((prev) => prev.filter((p) => !productIds.includes(p.id)));
        
        toast({
          title: "Товары восстановлены",
          description: `Восстановлено ${productIds.length} товаров`,
        });
        return true;
      } catch (error: any) {
        console.error("Error restoring products:", error);
        toast({
          title: "Ошибка восстановления",
          description: error.message,
          variant: "destructive",
        });
        return false;
      }
    },
    [toast]
  );

  // Initial fetch
  useEffect(() => {
    fetchTrashedProducts();
  }, [fetchTrashedProducts]);

  return {
    trashedProducts,
    loading,
    restoreProduct,
    restoreProducts,
    refetch: fetchTrashedProducts,
  };
}
