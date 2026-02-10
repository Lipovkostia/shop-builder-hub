import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useVisibilityRefetch } from "@/hooks/useVisibilityRefetch";

export interface CatalogProductSetting {
  id: string;
  catalog_id: string;
  product_id: string;
  categories: string[];
  markup_type: string;
  markup_value: number;
  status: string;
  fixed_price: number | null;
  is_fixed_price: boolean;
  portion_prices: {
    halfPricePerKg?: number;
    quarterPricePerKg?: number;
    portionPrice?: number;
  } | null;
}

// Helper to format a raw DB record into our interface
const formatSetting = (raw: any): CatalogProductSetting => ({
  id: raw.id,
  catalog_id: raw.catalog_id,
  product_id: raw.product_id,
  categories: raw.categories || [],
  markup_type: raw.markup_type || 'percent',
  markup_value: raw.markup_value || 0,
  status: raw.status || 'in_stock',
  fixed_price: raw.fixed_price ?? null,
  is_fixed_price: raw.is_fixed_price ?? false,
  portion_prices: raw.portion_prices as CatalogProductSetting['portion_prices'],
});

export function useCatalogProductSettings(storeId: string | null) {
  const [settings, setSettings] = useState<CatalogProductSetting[]>([]);
  const [loading, setLoading] = useState(false);
  const catalogIdsRef = useRef<string[]>([]);

  const fetchSettings = useCallback(async () => {
    if (!storeId) return;
    
    setLoading(true);
    try {
      // Get all catalogs for this store first
      const { data: catalogs } = await supabase
        .from('catalogs')
        .select('id')
        .eq('store_id', storeId);

      if (!catalogs || catalogs.length === 0) {
        setSettings([]);
        catalogIdsRef.current = [];
        setLoading(false);
        return;
      }

      const catalogIds = catalogs.map(c => c.id);
      catalogIdsRef.current = catalogIds;

      // Fetch in batches to avoid Supabase 1000-row default limit
      let allData: any[] = [];
      for (const catalogId of catalogIds) {
        let offset = 0;
        const batchSize = 1000;
        let hasMore = true;
        while (hasMore) {
          const { data: batch, error } = await supabase
            .from('catalog_product_settings')
            .select('*')
            .eq('catalog_id', catalogId)
            .range(offset, offset + batchSize - 1);
          if (error) throw error;
          if (batch && batch.length > 0) {
            allData.push(...batch);
            offset += batchSize;
            hasMore = batch.length === batchSize;
          } else {
            hasMore = false;
          }
        }
      }
      
      setSettings(allData.map(formatSetting));
    } catch (error) {
      console.error('Error fetching catalog product settings:', error);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  // Initial fetch
  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Refetch when page becomes visible (user returns from admin panel or another app)
  useVisibilityRefetch(fetchSettings, !!storeId);

  // Realtime subscription for catalog_product_settings
  useEffect(() => {
    if (!storeId) return;

    const channel = supabase
      .channel(`catalog-product-settings-${storeId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "catalog_product_settings",
        },
        (payload) => {
          const record = (payload.new || payload.old) as any;

          // If catalogs list isn't loaded yet, do a refresh and wait for next events
          if (catalogIdsRef.current.length === 0) {
            fetchSettings();
            return;
          }

          // Only process if the catalog belongs to our store
          if (!record || !catalogIdsRef.current.includes(record.catalog_id)) return;

          if (payload.eventType === "INSERT") {
            const newSetting = formatSetting(payload.new);
            setSettings((prev) => {
              if (prev.some((s) => s.id === newSetting.id)) return prev;
              return [...prev, newSetting];
            });
            return;
          }

          if (payload.eventType === "UPDATE") {
            const updated = formatSetting(payload.new);
            setSettings((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
            return;
          }

          if (payload.eventType === "DELETE") {
            const deletedId = (payload.old as any).id;
            setSettings((prev) => prev.filter((s) => s.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [storeId, fetchSettings]);

  const getProductSettings = useCallback((catalogId: string, productId: string): CatalogProductSetting | undefined => {
    const setting = settings.find(s => s.catalog_id === catalogId && s.product_id === productId);
    if (setting) return setting;
    
    // Fallback: if no setting for this catalog, return a partial setting with just the status
    // from any other catalog (since status is synced across all catalogs)
    const anySettingWithStatus = settings.find(s => s.product_id === productId);
    if (anySettingWithStatus) {
      return {
        id: `fallback_${catalogId}_${productId}`,
        catalog_id: catalogId,
        product_id: productId,
        categories: [], // Default - catalog-specific fields are not inherited
        markup_type: 'percent',
        markup_value: 0,
        status: anySettingWithStatus.status, // Use synced status
        fixed_price: null, // Catalog-specific - not inherited
        is_fixed_price: false,
        portion_prices: null,
      };
    }
    
    return undefined;
  }, [settings]);

  const updateProductSettings = useCallback(async (
    catalogId: string,
    productId: string,
    updates: Partial<Omit<CatalogProductSetting, 'id' | 'catalog_id' | 'product_id'>>,
    syncStatusToAllCatalogs: boolean = true // По умолчанию синхронизируем статус во все прайс-листы
  ) => {
    const existing = settings.find(s => s.catalog_id === catalogId && s.product_id === productId);

    // If status is being updated and syncStatusToAllCatalogs is true, 
    // also update status in all other catalogs where product exists
    const shouldSyncStatus = syncStatusToAllCatalogs && updates.status !== undefined;
    const otherCatalogSettings = shouldSyncStatus 
      ? settings.filter(s => s.product_id === productId && s.catalog_id !== catalogId)
      : [];

    // Optimistic update - apply immediately
    if (existing) {
      setSettings(prev => prev.map(s => {
        if (s.id === existing.id) {
          return { ...s, ...updates };
        }
        // Sync status to other catalogs
        if (shouldSyncStatus && s.product_id === productId && s.catalog_id !== catalogId) {
          return { ...s, status: updates.status! };
        }
        return s;
      }));
    } else {
      // For new settings, add optimistically with temp id
      const tempId = `temp_${catalogId}_${productId}`;
      const newSetting: CatalogProductSetting = {
        id: tempId,
        catalog_id: catalogId,
        product_id: productId,
        categories: updates.categories || [],
        markup_type: updates.markup_type || 'percent',
        markup_value: updates.markup_value || 0,
        status: updates.status || 'in_stock',
        fixed_price: updates.fixed_price ?? null,
        is_fixed_price: updates.is_fixed_price ?? false,
        portion_prices: updates.portion_prices || null,
      };
      setSettings(prev => {
        const updated = [...prev, newSetting];
        // Also update status in other catalogs
        if (shouldSyncStatus) {
          return updated.map(s => 
            s.product_id === productId && s.catalog_id !== catalogId 
              ? { ...s, status: updates.status! }
              : s
          );
        }
        return updated;
      });
    }

    try {
      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('catalog_product_settings')
          .update({
            categories: updates.categories ?? existing.categories,
            markup_type: updates.markup_type ?? existing.markup_type,
            markup_value: updates.markup_value ?? existing.markup_value,
            status: updates.status ?? existing.status,
            fixed_price: updates.fixed_price ?? existing.fixed_price,
            is_fixed_price: updates.is_fixed_price ?? existing.is_fixed_price,
            portion_prices: updates.portion_prices ?? existing.portion_prices,
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Upsert new (handles race conditions when record already exists)
        const { data, error } = await supabase
          .from('catalog_product_settings')
          .upsert({
            catalog_id: catalogId,
            product_id: productId,
            categories: updates.categories || [],
            markup_type: updates.markup_type || 'percent',
            markup_value: updates.markup_value || 0,
            status: updates.status || 'in_stock',
            fixed_price: updates.fixed_price ?? null,
            is_fixed_price: updates.is_fixed_price ?? false,
            portion_prices: updates.portion_prices || null,
          }, { onConflict: 'catalog_id,product_id' })
          .select()
          .single();

        if (error) throw error;

        // Replace temp entry with real one
        if (data) {
          const tempId = `temp_${catalogId}_${productId}`;
          setSettings(prev => prev.map(s => 
            s.id === tempId 
              ? {
                  id: data.id,
                  catalog_id: data.catalog_id,
                  product_id: data.product_id,
                  categories: data.categories || [],
                  markup_type: data.markup_type || 'percent',
                  markup_value: data.markup_value || 0,
                  status: data.status || 'in_stock',
                  fixed_price: data.fixed_price ?? null,
                  is_fixed_price: data.is_fixed_price ?? false,
                  portion_prices: data.portion_prices as CatalogProductSetting['portion_prices'],
                }
              : s
          ));
        }
      }

      // Sync status to all catalogs of this store (status column in "Прайс-листы")
      if (shouldSyncStatus) {
        let catalogIds = catalogIdsRef.current || [];

        // Fallback: if catalogs weren't loaded yet, fetch them once
        if (catalogIds.length === 0 && storeId) {
          const { data: catalogs, error: catalogsError } = await supabase
            .from('catalogs')
            .select('id')
            .eq('store_id', storeId);

          if (catalogsError) throw catalogsError;
          catalogIds = (catalogs || []).map(c => c.id);
          catalogIdsRef.current = catalogIds;
        }

        if (catalogIds.length > 0) {
          // Update status only for existing settings (don't create new ones with upsert)
          // This prevents overwriting other fields like categories
          const { error: syncError } = await supabase
            .from('catalog_product_settings')
            .update({ status: updates.status })
            .eq('product_id', productId)
            .in('catalog_id', catalogIds);

          if (syncError) throw syncError;

          // For catalogs where settings don't exist yet, create them with just status
          const existingCatalogIds = new Set(
            settings
              .filter(s => s.product_id === productId)
              .map(s => s.catalog_id)
          );
          const newCatalogIds = catalogIds.filter(cid => !existingCatalogIds.has(cid));
          
          if (newCatalogIds.length > 0) {
            const { error: insertError } = await supabase
              .from('catalog_product_settings')
              .insert(
                newCatalogIds.map((cid) => ({
                  catalog_id: cid,
                  product_id: productId,
                  status: updates.status,
                }))
              );

            if (insertError) throw insertError;
          }

          // Ensure UI reflects newly created rows
          await fetchSettings();
        }
      }
    } catch (error) {
      console.error('Error updating catalog product settings:', error);
      // Revert on error
      await fetchSettings();
    }
  }, [settings, fetchSettings]);

  return {
    settings,
    loading,
    getProductSettings,
    updateProductSettings,
    refetch: fetchSettings,
  };
}
