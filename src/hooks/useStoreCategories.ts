import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface StoreCategory {
  id: string;
  store_id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  sort_order: number | null;
  image_url: string | null;
}

export function useStoreCategories(storeId: string | null) {
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCategories = useCallback(async () => {
    if (!storeId) {
      setCategories([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("store_id", storeId)
        .order("sort_order", { ascending: true });

      if (error) {
        console.error("Error fetching categories:", error);
        return;
      }

      setCategories(data || []);
    } catch (err) {
      console.error("Error in fetchCategories:", err);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Realtime subscription for categories
  useEffect(() => {
    if (!storeId) return;

    const channel = supabase
      .channel(`store-categories-${storeId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "categories",
          filter: `store_id=eq.${storeId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newCategory = payload.new as StoreCategory;
            setCategories((prev) => {
              if (prev.some((c) => c.id === newCategory.id)) return prev;
              return [...prev, newCategory];
            });
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as StoreCategory;
            setCategories((prev) =>
              prev.map((c) => (c.id === updated.id ? updated : c))
            );
          } else if (payload.eventType === "DELETE") {
            const deletedId = (payload.old as any).id;
            setCategories((prev) => prev.filter((c) => c.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [storeId]);

  // Create new category (optionally as subcategory with parent_id)
  const createCategory = useCallback(async (name: string, parentId?: string | null): Promise<StoreCategory | null> => {
    if (!storeId) return null;

    // Create slug from name with unique timestamp suffix to avoid duplicates
    const baseSlug = name.toLowerCase()
      .replace(/[^a-zа-яё0-9\s-]/gi, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    
    const slug = baseSlug ? `${baseSlug}-${Date.now()}` : `category-${Date.now()}`;

    try {
      const { data, error } = await supabase
        .from('categories')
        .insert({
          store_id: storeId,
          name: name,
          slug: slug,
          parent_id: parentId || null,
        })
        .select()
        .single();

      if (error) throw error;
      
      return data as StoreCategory;
    } catch (error) {
      console.error('Error creating category:', error);
      return null;
    }
  }, [storeId]);

  // Update sort order for categories
  const updateCategoryOrder = useCallback(async (orderedIds: string[]) => {
    try {
      // Update each category with its new sort_order
      const updates = orderedIds.map((id, index) => 
        supabase
          .from('categories')
          .update({ sort_order: index })
          .eq('id', id)
      );
      
      await Promise.all(updates);
      
      // Update local state to reflect new order
      setCategories(prev => {
        const categoryMap = new Map(prev.map(c => [c.id, c]));
        return orderedIds
          .map((id, index) => {
            const cat = categoryMap.get(id);
            return cat ? { ...cat, sort_order: index } : null;
          })
          .filter((c): c is StoreCategory => c !== null);
      });
    } catch (error) {
      console.error('Error updating category order:', error);
      throw error;
    }
  }, []);

  return { categories, loading, refetch: fetchCategories, createCategory, updateCategoryOrder };
}
