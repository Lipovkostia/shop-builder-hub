import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useVisibilityRefetch } from "@/hooks/useVisibilityRefetch";
import { logActivity } from "@/hooks/useActivityLogs";

export interface Catalog {
  id: string;
  store_id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  sort_order: number;
  access_code: string;
  created_at: string;
  updated_at: string;
}

export interface ProductCatalogVisibility {
  id: string;
  product_id: string;
  catalog_id: string;
  created_at: string;
}

export function useStoreCatalogs(storeId: string | null) {
  const { toast } = useToast();
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [productVisibility, setProductVisibility] = useState<Record<string, Set<string>>>({});
  const [loading, setLoading] = useState(false);

  // Fetch all catalogs for the store
  const fetchCatalogs = useCallback(async () => {
    if (!storeId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("catalogs")
        .select("*")
        .eq("store_id", storeId)
        .order("sort_order", { ascending: true });

      if (error) throw error;
      setCatalogs(data || []);
    } catch (error: any) {
      console.error("Error fetching catalogs:", error);
      toast({
        title: "Ошибка загрузки каталогов",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [storeId, toast]);

  // Fetch product visibility for all catalogs
  const fetchProductVisibility = useCallback(async () => {
    if (!storeId) return;

    try {
      const { data, error } = await supabase
        .from("product_catalog_visibility")
        .select(`
          id,
          product_id,
          catalog_id,
          catalogs!inner(store_id)
        `)
        .eq("catalogs.store_id", storeId);

      if (error) throw error;

      const visibility: Record<string, Set<string>> = {};
      (data || []).forEach((row: any) => {
        if (!visibility[row.product_id]) {
          visibility[row.product_id] = new Set();
        }
        visibility[row.product_id].add(row.catalog_id);
      });
      setProductVisibility(visibility);
    } catch (error: any) {
      console.error("Error fetching product visibility:", error);
    }
  }, [storeId]);

  // Create a new catalog
  const createCatalog = useCallback(async (name: string, description?: string) => {
    if (!storeId) return null;

    try {
      const { data, error } = await supabase
        .from("catalogs")
        .insert({
          store_id: storeId,
          name,
          description: description || null,
          sort_order: catalogs.length,
        })
        .select()
        .single();

      if (error) throw error;
      
      setCatalogs(prev => [...prev, data]);
      
      // Log activity
      logActivity({
        storeId,
        actionType: 'create',
        entityType: 'catalog',
        entityId: data.id,
        entityName: name,
      });
      
      toast({
        title: "Каталог создан",
        description: `Прайс-лист "${name}" успешно создан`,
      });
      return data;
    } catch (error: any) {
      console.error("Error creating catalog:", error);
      toast({
        title: "Ошибка создания каталога",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }
  }, [storeId, catalogs.length, toast]);

  // Update a catalog
  const updateCatalog = useCallback(async (catalogId: string, updates: Partial<Catalog>) => {
    const catalog = catalogs.find(c => c.id === catalogId);
    try {
      const { data, error } = await supabase
        .from("catalogs")
        .update(updates)
        .eq("id", catalogId)
        .select()
        .single();

      if (error) throw error;
      
      setCatalogs(prev => prev.map(c => c.id === catalogId ? data : c));
      
      // Log activity for name changes
      if (storeId && updates.name && catalog?.name !== updates.name) {
        logActivity({
          storeId,
          actionType: 'update',
          entityType: 'catalog',
          entityId: catalogId,
          entityName: data.name,
          details: { field: 'name', old_value: catalog?.name, new_value: updates.name },
        });
      }
      
      return data;
    } catch (error: any) {
      console.error("Error updating catalog:", error);
      toast({
        title: "Ошибка обновления каталога",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }
  }, [storeId, catalogs, toast]);

  // Delete a catalog
  const deleteCatalog = useCallback(async (catalogId: string) => {
    const catalog = catalogs.find(c => c.id === catalogId);
    try {
      const { error } = await supabase
        .from("catalogs")
        .delete()
        .eq("id", catalogId);

      if (error) throw error;
      
      setCatalogs(prev => prev.filter(c => c.id !== catalogId));
      
      // Log activity
      if (storeId && catalog) {
        logActivity({
          storeId,
          actionType: 'delete',
          entityType: 'catalog',
          entityId: catalogId,
          entityName: catalog.name,
        });
      }
      
      toast({
        title: "Каталог удалён",
      });
      return true;
    } catch (error: any) {
      console.error("Error deleting catalog:", error);
      toast({
        title: "Ошибка удаления каталога",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  }, [storeId, catalogs, toast]);

  // Toggle product visibility in a catalog
  const toggleProductVisibility = useCallback(async (productId: string, catalogId: string) => {
    const isVisible = productVisibility[productId]?.has(catalogId);

    try {
      if (isVisible) {
        // Remove from catalog
        const { error } = await supabase
          .from("product_catalog_visibility")
          .delete()
          .eq("product_id", productId)
          .eq("catalog_id", catalogId);

        if (error) throw error;

        setProductVisibility(prev => {
          const newSet = new Set(prev[productId]);
          newSet.delete(catalogId);
          return { ...prev, [productId]: newSet };
        });
      } else {
        // Add to catalog - use upsert to avoid duplicate key error
        const { error } = await supabase
          .from("product_catalog_visibility")
          .upsert(
            { product_id: productId, catalog_id: catalogId },
            { onConflict: "product_id,catalog_id", ignoreDuplicates: true }
          );

        if (error) throw error;

        setProductVisibility(prev => {
          const newSet = new Set(prev[productId] || []);
          newSet.add(catalogId);
          return { ...prev, [productId]: newSet };
        });
      }
    } catch (error: any) {
      console.error("Error toggling product visibility:", error);
      toast({
        title: "Ошибка изменения видимости",
        description: error.message,
        variant: "destructive",
      });
    }
  }, [productVisibility, toast]);

  // Set product visibility for multiple catalogs at once
  const setProductCatalogs = useCallback(async (productId: string, catalogIds: string[]) => {
    const currentCatalogIds = Array.from(productVisibility[productId] || []);
    const toAdd = catalogIds.filter(id => !currentCatalogIds.includes(id));
    const toRemove = currentCatalogIds.filter(id => !catalogIds.includes(id));

    try {
      // Remove old visibility
      if (toRemove.length > 0) {
        const { error } = await supabase
          .from("product_catalog_visibility")
          .delete()
          .eq("product_id", productId)
          .in("catalog_id", toRemove);

        if (error) throw error;
      }

      // Add new visibility - use upsert to avoid duplicate key error
      if (toAdd.length > 0) {
        const { error } = await supabase
          .from("product_catalog_visibility")
          .upsert(
            toAdd.map(catalog_id => ({ product_id: productId, catalog_id })),
            { onConflict: "product_id,catalog_id", ignoreDuplicates: true }
          );

        if (error) throw error;
      }

      setProductVisibility(prev => ({
        ...prev,
        [productId]: new Set(catalogIds),
      }));
    } catch (error: any) {
      console.error("Error setting product catalogs:", error);
      toast({
        title: "Ошибка изменения прайс-листов",
        description: error.message,
        variant: "destructive",
      });
    }
  }, [productVisibility, toast]);

  // Bulk remove products from a catalog
  const removeProductsFromCatalog = useCallback(async (productIds: string[], catalogId: string) => {
    if (productIds.length === 0) return;
    
    try {
      const { error } = await supabase
        .from("product_catalog_visibility")
        .delete()
        .in("product_id", productIds)
        .eq("catalog_id", catalogId);

      if (error) throw error;

      // Update local state
      setProductVisibility(prev => {
        const updated = { ...prev };
        productIds.forEach(productId => {
          if (updated[productId]) {
            const newSet = new Set(updated[productId]);
            newSet.delete(catalogId);
            updated[productId] = newSet;
          }
        });
        return updated;
      });

      toast({
        title: "Товары убраны из прайс-листа",
        description: `Убрано ${productIds.length} товар(ов)`,
      });
    } catch (error: any) {
      console.error("Error removing products from catalog:", error);
      toast({
        title: "Ошибка удаления из прайс-листа",
        description: error.message,
        variant: "destructive",
      });
    }
  }, [toast]);

  // Initial fetch
  useEffect(() => {
    fetchCatalogs();
    fetchProductVisibility();
  }, [fetchCatalogs, fetchProductVisibility]);

  // Refetch when page becomes visible (user returns from admin panel or another app)
  useVisibilityRefetch(() => {
    fetchCatalogs();
    fetchProductVisibility();
  }, !!storeId);

  return {
    catalogs,
    productVisibility,
    loading,
    createCatalog,
    updateCatalog,
    deleteCatalog,
    toggleProductVisibility,
    setProductCatalogs,
    removeProductsFromCatalog,
    refetch: () => {
      fetchCatalogs();
      fetchProductVisibility();
    },
  };
}
