import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CatalogProductSetting {
  id: string;
  catalog_id: string;
  product_id: string;
  categories: string[];
  markup_type: string;
  markup_value: number;
  status: string;
  portion_prices: {
    halfPricePerKg?: number;
    quarterPricePerKg?: number;
    portionPrice?: number;
  } | null;
}

export function useCatalogProductSettings(storeId: string | null) {
  const [settings, setSettings] = useState<CatalogProductSetting[]>([]);
  const [loading, setLoading] = useState(false);

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
        setLoading(false);
        return;
      }

      const catalogIds = catalogs.map(c => c.id);

      const { data, error } = await supabase
        .from('catalog_product_settings')
        .select('*')
        .in('catalog_id', catalogIds);

      if (error) throw error;
      
      setSettings((data || []).map(s => ({
        id: s.id,
        catalog_id: s.catalog_id,
        product_id: s.product_id,
        categories: s.categories || [],
        markup_type: s.markup_type || 'percent',
        markup_value: s.markup_value || 0,
        status: s.status || 'in_stock',
        portion_prices: s.portion_prices as CatalogProductSetting['portion_prices'],
      })));
    } catch (error) {
      console.error('Error fetching catalog product settings:', error);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const getProductSettings = useCallback((catalogId: string, productId: string): CatalogProductSetting | undefined => {
    return settings.find(s => s.catalog_id === catalogId && s.product_id === productId);
  }, [settings]);

  const updateProductSettings = useCallback(async (
    catalogId: string,
    productId: string,
    updates: Partial<Omit<CatalogProductSetting, 'id' | 'catalog_id' | 'product_id'>>
  ) => {
    try {
      const existing = settings.find(s => s.catalog_id === catalogId && s.product_id === productId);

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('catalog_product_settings')
          .update({
            categories: updates.categories ?? existing.categories,
            markup_type: updates.markup_type ?? existing.markup_type,
            markup_value: updates.markup_value ?? existing.markup_value,
            status: updates.status ?? existing.status,
            portion_prices: updates.portion_prices ?? existing.portion_prices,
          })
          .eq('id', existing.id);

        if (error) throw error;

        // Update local state
        setSettings(prev => prev.map(s => 
          s.id === existing.id 
            ? { ...s, ...updates }
            : s
        ));
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('catalog_product_settings')
          .insert({
            catalog_id: catalogId,
            product_id: productId,
            categories: updates.categories || [],
            markup_type: updates.markup_type || 'percent',
            markup_value: updates.markup_value || 0,
            status: updates.status || 'in_stock',
            portion_prices: updates.portion_prices || null,
          })
          .select()
          .single();

        if (error) throw error;

        if (data) {
          setSettings(prev => [...prev, {
            id: data.id,
            catalog_id: data.catalog_id,
            product_id: data.product_id,
            categories: data.categories || [],
            markup_type: data.markup_type || 'percent',
            markup_value: data.markup_value || 0,
            status: data.status || 'in_stock',
            portion_prices: data.portion_prices as CatalogProductSetting['portion_prices'],
          }]);
        }
      }
    } catch (error) {
      console.error('Error updating catalog product settings:', error);
    }
  }, [settings]);

  return {
    settings,
    loading,
    getProductSettings,
    updateProductSettings,
    refetch: fetchSettings,
  };
}
