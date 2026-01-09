import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ProductCategoryAssignment {
  product_id: string;
  category_id: string;
}

export function useProductCategories(storeId: string | null) {
  const { toast } = useToast();
  const [productCategories, setProductCategories] = useState<Record<string, Set<string>>>({});
  const [loading, setLoading] = useState(false);

  // Fetch all product-category assignments for the store
  const fetchProductCategories = useCallback(async () => {
    if (!storeId) return;

    setLoading(true);
    try {
      // Get all products for this store first
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("id")
        .eq("store_id", storeId);

      if (productsError) throw productsError;

      const productIds = products?.map(p => p.id) || [];
      
      if (productIds.length === 0) {
        setProductCategories({});
        setLoading(false);
        return;
      }

      // Get category assignments for these products
      const { data: assignments, error } = await supabase
        .from("product_category_assignments")
        .select("product_id, category_id")
        .in("product_id", productIds);

      if (error) throw error;

      // Convert to a map of product_id -> Set<category_id>
      const categoriesMap: Record<string, Set<string>> = {};
      assignments?.forEach(assignment => {
        if (!categoriesMap[assignment.product_id]) {
          categoriesMap[assignment.product_id] = new Set();
        }
        categoriesMap[assignment.product_id].add(assignment.category_id);
      });

      setProductCategories(categoriesMap);
    } catch (error) {
      console.error("Error fetching product categories:", error);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    fetchProductCategories();
  }, [fetchProductCategories]);

  // Get category IDs for a specific product
  const getProductCategoryIds = useCallback((productId: string): string[] => {
    return Array.from(productCategories[productId] || []);
  }, [productCategories]);

  // Set categories for a product (replace all)
  const setProductCategoryAssignments = useCallback(async (productId: string, categoryIds: string[]) => {
    try {
      // Delete existing assignments
      await supabase
        .from("product_category_assignments")
        .delete()
        .eq("product_id", productId);

      // Insert new assignments
      if (categoryIds.length > 0) {
        const { error } = await supabase
          .from("product_category_assignments")
          .insert(categoryIds.map(categoryId => ({
            product_id: productId,
            category_id: categoryId,
          })));

        if (error) throw error;
      }

      // Update local state
      setProductCategories(prev => ({
        ...prev,
        [productId]: new Set(categoryIds),
      }));
    } catch (error) {
      console.error("Error setting product categories:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось обновить категории товара",
        variant: "destructive",
      });
    }
  }, [toast]);

  // Toggle a single category for a product
  const toggleProductCategory = useCallback(async (productId: string, categoryId: string) => {
    const currentCategories = productCategories[productId] || new Set();
    const newCategories = new Set(currentCategories);

    if (newCategories.has(categoryId)) {
      newCategories.delete(categoryId);
      
      // Delete the assignment
      await supabase
        .from("product_category_assignments")
        .delete()
        .eq("product_id", productId)
        .eq("category_id", categoryId);
    } else {
      newCategories.add(categoryId);
      
      // Insert the assignment
      await supabase
        .from("product_category_assignments")
        .insert({
          product_id: productId,
          category_id: categoryId,
        });
    }

    setProductCategories(prev => ({
      ...prev,
      [productId]: newCategories,
    }));
  }, [productCategories]);

  return {
    productCategories,
    loading,
    getProductCategoryIds,
    setProductCategoryAssignments,
    toggleProductCategory,
    refetch: fetchProductCategories,
  };
}
