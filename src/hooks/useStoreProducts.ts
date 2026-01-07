import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
}

export function useStoreProducts(storeId: string | null) {
  const { toast } = useToast();
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch all products for the store
  const fetchProducts = useCallback(async () => {
    if (!storeId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("store_id", storeId)
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

  // Create a new product
  const createProduct = useCallback(async (product: Partial<StoreProduct>) => {
    if (!storeId) {
      toast({
        title: "Ошибка",
        description: "Магазин не выбран",
        variant: "destructive",
      });
      return null;
    }

    // Check if user is authenticated
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast({
        title: "Требуется авторизация",
        description: "Войдите в систему для добавления товаров",
        variant: "destructive",
      });
      return null;
    }

    try {
      const slug = product.name 
        ? product.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-а-яё]/gi, '')
        : `product-${Date.now()}`;

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
        if (error.code === '42501') {
          throw new Error("Нет прав для добавления товаров. Убедитесь, что вы владелец магазина.");
        }
        throw error;
      }
      
      setProducts(prev => [data, ...prev]);
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
  }, [storeId, toast]);

  // Update a product
  const updateProduct = useCallback(async (productId: string, updates: Partial<StoreProduct>) => {
    // Check if user is authenticated
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast({
        title: "Требуется авторизация",
        description: "Войдите в систему для редактирования товаров",
        variant: "destructive",
      });
      return null;
    }

    try {
      const { data, error, count } = await supabase
        .from("products")
        .update(updates)
        .eq("id", productId)
        .select()
        .maybeSingle();

      if (error) {
        if (error.code === '42501') {
          throw new Error("Нет прав для редактирования. Убедитесь, что вы владелец магазина.");
        }
        throw error;
      }
      
      // If no data returned, RLS blocked the update
      if (!data) {
        throw new Error("Нет прав для редактирования. Убедитесь, что вы владелец магазина.");
      }
      
      // Update local state with the returned data
      setProducts(prev => prev.map(p => p.id === productId ? data : p));
      return data;
    } catch (error: any) {
      console.error("Error updating product:", error);
      toast({
        title: "Ошибка обновления товара",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }
  }, [toast]);

  // Delete a product
  const deleteProduct = useCallback(async (productId: string) => {
    try {
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", productId);

      if (error) throw error;
      
      setProducts(prev => prev.filter(p => p.id !== productId));
      toast({
        title: "Товар удалён",
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
  }, [toast]);

  // Delete multiple products
  const deleteProducts = useCallback(async (productIds: string[]) => {
    try {
      const { error } = await supabase
        .from("products")
        .delete()
        .in("id", productIds);

      if (error) throw error;
      
      setProducts(prev => prev.filter(p => !productIds.includes(p.id)));
      toast({
        title: "Товары удалены",
        description: `Удалено ${productIds.length} товаров`,
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
  }, [toast]);

  // Toggle product active status
  const toggleProductActive = useCallback(async (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    return updateProduct(productId, { is_active: !product.is_active });
  }, [products, updateProduct]);

  // Initial fetch
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

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
