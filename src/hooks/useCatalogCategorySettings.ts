 import { useState, useEffect, useCallback } from "react";
 import { supabase } from "@/integrations/supabase/client";
 
 export interface CatalogCategorySettings {
   id: string;
   catalog_id: string;
   category_id: string;
   custom_name: string | null;
   sort_order: number | null;
   created_at: string;
   updated_at: string;
 }
 
 export function useCatalogCategorySettings(catalogId: string | null) {
   const [settings, setSettings] = useState<CatalogCategorySettings[]>([]);
   const [loading, setLoading] = useState(false);
 
   const fetchSettings = useCallback(async () => {
     if (!catalogId) {
       setSettings([]);
       return;
     }
 
     setLoading(true);
     try {
       const { data, error } = await supabase
         .from("catalog_category_settings")
         .select("*")
         .eq("catalog_id", catalogId)
         .order("sort_order", { ascending: true, nullsFirst: false });
 
       if (error) {
         console.error("Error fetching catalog category settings:", error);
         return;
       }
 
       setSettings(data || []);
     } catch (err) {
       console.error("Error in fetchCatalogCategorySettings:", err);
     } finally {
       setLoading(false);
     }
   }, [catalogId]);
 
   useEffect(() => {
     fetchSettings();
   }, [fetchSettings]);
 
   // Get custom name for a category in this catalog
   const getCustomName = useCallback((categoryId: string): string | null => {
     const setting = settings.find(s => s.category_id === categoryId);
     return setting?.custom_name || null;
   }, [settings]);
 
   // Get sort order for a category in this catalog
   const getSortOrder = useCallback((categoryId: string): number | null => {
     const setting = settings.find(s => s.category_id === categoryId);
     return setting?.sort_order ?? null;
   }, [settings]);
 
   // Upsert (create or update) setting for a category
   const upsertSetting = useCallback(async (
     categoryId: string,
     updates: { custom_name?: string | null; sort_order?: number | null }
   ): Promise<boolean> => {
     if (!catalogId) return false;
 
     try {
       const { error } = await supabase
         .from("catalog_category_settings")
         .upsert({
           catalog_id: catalogId,
           category_id: categoryId,
           ...updates,
         }, {
           onConflict: "catalog_id,category_id",
         });
 
       if (error) throw error;
 
       // Update local state
       setSettings(prev => {
         const existing = prev.find(s => s.category_id === categoryId);
         if (existing) {
           return prev.map(s => 
             s.category_id === categoryId 
               ? { ...s, ...updates, updated_at: new Date().toISOString() }
               : s
           );
         } else {
           return [...prev, {
             id: crypto.randomUUID(),
             catalog_id: catalogId,
             category_id: categoryId,
             custom_name: updates.custom_name ?? null,
             sort_order: updates.sort_order ?? null,
             created_at: new Date().toISOString(),
             updated_at: new Date().toISOString(),
           }];
         }
       });
 
       return true;
     } catch (error) {
       console.error("Error upserting catalog category setting:", error);
       return false;
     }
   }, [catalogId]);
 
   // Update custom name for a category
   const updateCustomName = useCallback(async (categoryId: string, customName: string | null): Promise<boolean> => {
     return upsertSetting(categoryId, { custom_name: customName });
   }, [upsertSetting]);
 
   // Update sort order for multiple categories at once
   const updateSortOrders = useCallback(async (orderedCategoryIds: string[]): Promise<boolean> => {
     if (!catalogId) return false;
 
     try {
       // Build upsert data for all categories
       const upsertData = orderedCategoryIds.map((categoryId, index) => ({
         catalog_id: catalogId,
         category_id: categoryId,
         sort_order: index,
       }));
 
       const { error } = await supabase
         .from("catalog_category_settings")
         .upsert(upsertData, {
           onConflict: "catalog_id,category_id",
         });
 
       if (error) throw error;
 
       // Update local state
       setSettings(prev => {
         const updatedMap = new Map<string, CatalogCategorySettings>();
         
         // Keep existing settings
         prev.forEach(s => updatedMap.set(s.category_id, s));
         
         // Update or create new entries
         orderedCategoryIds.forEach((categoryId, index) => {
           const existing = updatedMap.get(categoryId);
           if (existing) {
             updatedMap.set(categoryId, { ...existing, sort_order: index, updated_at: new Date().toISOString() });
           } else {
             updatedMap.set(categoryId, {
               id: crypto.randomUUID(),
               catalog_id: catalogId,
               category_id: categoryId,
               custom_name: null,
               sort_order: index,
               created_at: new Date().toISOString(),
               updated_at: new Date().toISOString(),
             });
           }
         });
         
         return Array.from(updatedMap.values());
       });
 
       return true;
     } catch (error) {
       console.error("Error updating catalog category sort orders:", error);
       return false;
     }
   }, [catalogId]);
 
   // Delete setting for a category
   const deleteSetting = useCallback(async (categoryId: string): Promise<boolean> => {
     if (!catalogId) return false;
 
     try {
       const { error } = await supabase
         .from("catalog_category_settings")
         .delete()
         .eq("catalog_id", catalogId)
         .eq("category_id", categoryId);
 
       if (error) throw error;
 
       setSettings(prev => prev.filter(s => s.category_id !== categoryId));
       return true;
     } catch (error) {
       console.error("Error deleting catalog category setting:", error);
       return false;
     }
   }, [catalogId]);
 
   // Clear all custom names (reset to original)
   const clearAllCustomNames = useCallback(async (): Promise<boolean> => {
     if (!catalogId) return false;
 
     try {
       // Update all settings to clear custom_name
       const { error } = await supabase
         .from("catalog_category_settings")
         .update({ custom_name: null })
         .eq("catalog_id", catalogId);
 
       if (error) throw error;
 
       setSettings(prev => prev.map(s => ({ ...s, custom_name: null })));
       return true;
     } catch (error) {
       console.error("Error clearing custom names:", error);
       return false;
     }
   }, [catalogId]);
 
   return {
     settings,
     loading,
     getCustomName,
     getSortOrder,
     upsertSetting,
     updateCustomName,
     updateSortOrders,
     deleteSetting,
     clearAllCustomNames,
     refetch: fetchSettings,
   };
 }