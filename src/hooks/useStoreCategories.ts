import { useState, useEffect } from "react";
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

  useEffect(() => {
    if (!storeId) {
      setCategories([]);
      return;
    }

    const fetchCategories = async () => {
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
    };

    fetchCategories();
  }, [storeId]);

  return { categories, loading };
}
