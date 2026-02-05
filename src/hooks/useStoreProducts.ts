import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useVisibilityRefetch } from "@/hooks/useVisibilityRefetch";
import { logActivity } from "@/hooks/useActivityLogs";

export interface StoreProduct {
  id: string;
  store_id: string;
  category_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  compare_price: number | null;
  buy_price: number | null;
  markup_type: string | null;
  markup_value: number | null;
  quantity: number;
  unit: string | null;
  unit_weight: number | null;
  packaging_type: string | null;
  portion_weight: number | null;
  price_full: number | null;
  price_half: number | null;
  price_quarter: number | null;
  price_portion: number | null;
  sku: string | null;
  images: string[] | null;
  synced_moysklad_images: any;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
  // MoySklad integration fields
  moysklad_id: string | null;
  moysklad_account_id: string | null;
  auto_sync: boolean | null;
  source: string | null;
  is_fixed_price: boolean | null;
}

export function useStoreProducts(storeId: string | null) {
  const { toast } = useToast();
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const instanceIdRef = useRef(Math.random().toString(36).slice(2));

  // Fetch all products for the store (excluding deleted)
  const fetchProducts = useCallback(async () => {
    if (!storeId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("store_id", storeId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error: any) {
      console.error("Error fetching products:", error);
      toast({
        title: "Ошибка загрузки товаров",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [storeId, toast]);

  // Realtime sync (when something changes elsewhere, reflect it here)
  useEffect(() => {
    if (!storeId) return;

    const channel = supabase
      .channel(`products-store-${storeId}-${instanceIdRef.current}`)
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

          if (eventType === "INSERT") {
            const row = payload.new as StoreProduct & { deleted_at?: string | null };
            // Only add if not deleted
            if (!row.deleted_at) {
              setProducts((prev) => {
                if (prev.some((p) => p.id === row.id)) return prev;
                return [row, ...prev];
              });
            }
            return;
          }

          if (eventType === "UPDATE") {
            const row = payload.new as StoreProduct & { deleted_at?: string | null };
            // If product was soft-deleted, remove from list
            if (row.deleted_at) {
              setProducts((prev) => prev.filter((p) => p.id !== row.id));
            } else {
              // If product was restored or updated, update in list
              setProducts((prev) => {
                const exists = prev.some((p) => p.id === row.id);
                if (exists) {
                  return prev.map((p) => (p.id === row.id ? row : p));
                } else {
                  // Product was restored - add it back
                  return [row, ...prev];
                }
              });
            }
            return;
          }

          if (eventType === "DELETE") {
            const row = payload.old as { id: string };
            setProducts((prev) => prev.filter((p) => p.id !== row.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [storeId]);

  // Create a new product
  const createProduct = useCallback(
    async (product: Partial<StoreProduct>) => {
      if (!storeId) {
        toast({
          title: "Ошибка",
          description: "Магазин не выбран",
          variant: "destructive",
        });
        return null;
      }

      // Check if user is authenticated
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Требуется авторизация",
          description: "Войдите в систему для добавления товаров",
          variant: "destructive",
        });
        return null;
      }

      try {
        // Generate unique slug with timestamp suffix to avoid duplicates
        const baseSlug = product.name
          ? product.name
              .toLowerCase()
              .replace(/\s+/g, "-")
              .replace(/[^a-z0-9-а-яё]/gi, "")
          : "product";
        const uniqueSuffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const slug = `${baseSlug}-${uniqueSuffix}`;

        const { data, error } = await supabase
          .from("products")
          .insert({
            store_id: storeId,
            name: product.name || "Новый товар",
            slug,
            price: product.price || 0,
            quantity: product.quantity || 0,
            ...product,
          })
          .select()
          .single();

        if (error) {
          if (error.code === "42501") {
            throw new Error(
              "Нет прав для добавления товаров. Убедитесь, что вы владелец магазина."
            );
          }
          throw error;
        }

        // NOTE: local state will be updated by realtime too, but we keep this for snappy UI
        setProducts((prev) => [data, ...prev]);
        
        // Log activity
        logActivity({
          storeId,
          actionType: 'create',
          entityType: 'product',
          entityId: data.id,
          entityName: data.name,
          details: { price: data.price },
        });
        
        toast({
          title: "Товар создан",
          description: `"${data.name}" добавлен в каталог`,
        });
        return data;
      } catch (error: any) {
        console.error("Error creating product:", error);
        toast({
          title: "Ошибка создания товара",
          description: error.message,
          variant: "destructive",
        });
        return null;
      }
    },
    [storeId, toast]
  );

  // Update a product
  const updateProduct = useCallback(
    async (productId: string, updates: Partial<StoreProduct>) => {
      // Check if user is authenticated
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Требуется авторизация",
          description: "Войдите в систему для редактирования товаров",
          variant: "destructive",
        });
        return null;
      }

      try {
        // First, do the update without select to avoid PGRST116 on RLS block
        const { error: updateError } = await supabase
          .from("products")
          .update(updates)
          .eq("id", productId);

        if (updateError) {
          if (updateError.code === "42501") {
            throw new Error(
              "Нет прав для редактирования. Убедитесь, что вы владелец магазина."
            );
          }
          throw updateError;
        }

        // Then fetch the updated product to verify it was actually updated
        const { data: updatedProduct, error: selectError } = await supabase
          .from("products")
          .select("*")
          .eq("id", productId)
          .maybeSingle();

        if (selectError) {
          throw selectError;
        }

        // If we can't see the product after update, RLS blocked it
        if (!updatedProduct) {
          throw new Error(
            "Нет прав для редактирования. Убедитесь, что вы владелец магазина."
          );
        }

        // Update local state with the returned data (and realtime will keep everything else in sync)
        setProducts((prev) =>
          prev.map((p) => (p.id === productId ? updatedProduct : p))
        );
        
        // Log activity for significant updates (price, name)
        if (storeId && (updates.price !== undefined || updates.name !== undefined || updates.buy_price !== undefined)) {
          const product = products.find(p => p.id === productId);
          const details: Record<string, any> = {};
          if (updates.price !== undefined && product?.price !== updates.price) {
            details.field = 'price';
            details.old_value = product?.price;
            details.new_value = updates.price;
          }
          if (Object.keys(details).length > 0) {
            logActivity({
              storeId,
              actionType: 'update',
              entityType: 'product',
              entityId: productId,
              entityName: updatedProduct.name,
              details,
            });
          }
        }
        
        return updatedProduct;
      } catch (error: any) {
        console.error("Error updating product:", error);
        toast({
          title: "Ошибка обновления товара",
          description: error.message,
          variant: "destructive",
        });
        return null;
      }
    },
    [toast]
  );

  // Soft delete a product (move to trash)
  const deleteProduct = useCallback(
    async (productId: string) => {
      const product = products.find(p => p.id === productId);
      try {
        const { error } = await supabase
          .from("products")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", productId);

        if (error) throw error;

        setProducts((prev) => prev.filter((p) => p.id !== productId));
        
        // Log activity
        if (storeId && product) {
          logActivity({
            storeId,
            actionType: 'trash',
            entityType: 'product',
            entityId: productId,
            entityName: product.name,
          });
        }
        
        toast({
          title: "Товар перемещён в корзину",
          description: product ? `"${product.name}" можно восстановить из корзины` : undefined,
        });
        return true;
      } catch (error: any) {
        console.error("Error deleting product:", error);
        toast({
          title: "Ошибка удаления товара",
          description: error.message,
          variant: "destructive",
        });
        return false;
      }
    },
    [storeId, products, toast]
  );

  // Soft delete multiple products (move to trash)
  const deleteProducts = useCallback(
    async (productIds: string[]) => {
      try {
        const { error } = await supabase
          .from("products")
          .update({ deleted_at: new Date().toISOString() })
          .in("id", productIds);

        if (error) throw error;

        setProducts((prev) => prev.filter((p) => !productIds.includes(p.id)));
        toast({
          title: "Товары перемещены в корзину",
          description: `${productIds.length} товаров можно восстановить`,
        });
        return true;
      } catch (error: any) {
        console.error("Error deleting products:", error);
        toast({
          title: "Ошибка удаления товаров",
          description: error.message,
          variant: "destructive",
        });
        return false;
      }
    },
    [toast]
  );

  // Toggle product active status
  const toggleProductActive = useCallback(
    async (productId: string) => {
      const product = products.find((p) => p.id === productId);
      if (!product) return;

      return updateProduct(productId, { is_active: !product.is_active });
    },
    [products, updateProduct]
  );

  // Initial fetch
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Refetch when page becomes visible (user returns from admin panel or another app)
  useVisibilityRefetch(fetchProducts, !!storeId);

  return {
    products,
    loading,
    createProduct,
    updateProduct,
    deleteProduct,
    deleteProducts,
    toggleProductActive,
    refetch: fetchProducts,
  };
}
