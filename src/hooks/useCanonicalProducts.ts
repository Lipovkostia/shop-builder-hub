import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CanonicalProduct {
  id: string;
  canonical_name: string;
  canonical_sku: string | null;
  description: string | null;
  images: string[] | null;
  unit: string | null;
  packaging_type: string | null;
  unit_weight: number | null;
  created_at: string;
  updated_at: string;
}

export interface ProductAlias {
  id: string;
  canonical_product_id: string;
  alias_type: "name" | "sku" | "barcode" | "moysklad_id";
  alias_value: string;
  source: "moysklad" | "excel" | "manual" | "auto";
  store_id: string | null;
  created_at: string;
}

export interface LinkedProduct {
  id: string;
  name: string;
  sku: string | null;
  buy_price: number | null;
  price: number;
  store_id: string;
  store_name?: string;
  canonical_product_id: string | null;
}

export function useCanonicalProducts() {
  const queryClient = useQueryClient();

  // Fetch all canonical products with aliases count
  const { data: canonicalProducts = [], isLoading: isLoadingCanonical } = useQuery({
    queryKey: ["canonical-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("canonical_products")
        .select("*")
        .order("canonical_name");

      if (error) throw error;
      return data as CanonicalProduct[];
    },
  });

  // Fetch aliases for a canonical product
  const fetchAliases = useCallback(async (canonicalProductId: string) => {
    const { data, error } = await supabase
      .from("product_aliases")
      .select("*")
      .eq("canonical_product_id", canonicalProductId)
      .order("alias_type");

    if (error) throw error;
    return data as ProductAlias[];
  }, []);

  // Fetch products linked to a canonical product
  const fetchLinkedProducts = useCallback(async (canonicalProductId: string) => {
    const { data, error } = await supabase
      .from("products")
      .select(`
        id,
        name,
        sku,
        buy_price,
        price,
        store_id,
        canonical_product_id,
        stores!inner(name)
      `)
      .eq("canonical_product_id", canonicalProductId)
      .is("deleted_at", null);

    if (error) throw error;
    return (data || []).map((p: any) => ({
      ...p,
      store_name: p.stores?.name,
    })) as LinkedProduct[];
  }, []);

  // Fetch unlinked products (for linking UI)
  const fetchUnlinkedProducts = useCallback(async (storeId?: string) => {
    let query = supabase
      .from("products")
      .select(`
        id,
        name,
        sku,
        buy_price,
        price,
        store_id,
        canonical_product_id,
        stores!inner(name)
      `)
      .is("canonical_product_id", null)
      .is("deleted_at", null)
      .eq("is_active", true)
      .order("name");

    if (storeId) {
      query = query.eq("store_id", storeId);
    }

    const { data, error } = await query.limit(500);

    if (error) throw error;
    return (data || []).map((p: any) => ({
      ...p,
      store_name: p.stores?.name,
    })) as LinkedProduct[];
  }, []);

  // Search canonical products by name or SKU
  const searchCanonical = useCallback(async (query: string) => {
    if (!query.trim()) return [];

    const { data, error } = await supabase
      .from("canonical_products")
      .select("*")
      .or(`canonical_name.ilike.%${query}%,canonical_sku.ilike.%${query}%`)
      .limit(20);

    if (error) throw error;
    return data as CanonicalProduct[];
  }, []);

  // Create canonical product
  const createCanonicalMutation = useMutation({
    mutationFn: async (product: Partial<CanonicalProduct>) => {
      const { data, error } = await supabase
        .from("canonical_products")
        .insert({
          canonical_name: product.canonical_name!,
          canonical_sku: product.canonical_sku,
          description: product.description,
          images: product.images,
          unit: product.unit,
          packaging_type: product.packaging_type,
          unit_weight: product.unit_weight,
        })
        .select()
        .single();

      if (error) throw error;
      return data as CanonicalProduct;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["canonical-products"] });
      toast.success("Мастер-товар создан");
    },
    onError: (error) => {
      toast.error("Ошибка создания мастер-товара");
      console.error(error);
    },
  });

  // Update canonical product
  const updateCanonicalMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CanonicalProduct> & { id: string }) => {
      const { data, error } = await supabase
        .from("canonical_products")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as CanonicalProduct;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["canonical-products"] });
      toast.success("Мастер-товар обновлён");
    },
    onError: (error) => {
      toast.error("Ошибка обновления мастер-товара");
      console.error(error);
    },
  });

  // Delete canonical product
  const deleteCanonicalMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("canonical_products")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["canonical-products"] });
      toast.success("Мастер-товар удалён");
    },
    onError: (error) => {
      toast.error("Ошибка удаления мастер-товара");
      console.error(error);
    },
  });

  // Add alias to canonical product
  const addAliasMutation = useMutation({
    mutationFn: async (alias: {
      canonical_product_id: string;
      alias_type: ProductAlias["alias_type"];
      alias_value: string;
      source?: ProductAlias["source"];
      store_id?: string | null;
    }) => {
      const { data, error } = await supabase
        .from("product_aliases")
        .insert({
          canonical_product_id: alias.canonical_product_id,
          alias_type: alias.alias_type,
          alias_value: alias.alias_value,
          source: alias.source || "manual",
          store_id: alias.store_id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as ProductAlias;
    },
    onSuccess: () => {
      toast.success("Синоним добавлен");
    },
    onError: (error: any) => {
      if (error.code === "23505") {
        toast.error("Такой синоним уже существует");
      } else {
        toast.error("Ошибка добавления синонима");
      }
      console.error(error);
    },
  });

  // Delete alias
  const deleteAliasMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("product_aliases")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Синоним удалён");
    },
    onError: (error) => {
      toast.error("Ошибка удаления синонима");
      console.error(error);
    },
  });

  // Link product to canonical product
  const linkProductMutation = useMutation({
    mutationFn: async ({
      productId,
      canonicalProductId,
      addAliases = true,
    }: {
      productId: string;
      canonicalProductId: string;
      addAliases?: boolean;
    }) => {
      // Update product with canonical_product_id
      const { data: product, error: productError } = await supabase
        .from("products")
        .update({ canonical_product_id: canonicalProductId })
        .eq("id", productId)
        .select("name, sku, store_id")
        .single();

      if (productError) throw productError;

      // Optionally add aliases for the product name and SKU
      if (addAliases && product) {
        const aliases: Array<{
          canonical_product_id: string;
          alias_type: string;
          alias_value: string;
          source: string;
          store_id: string | null;
        }> = [];

        if (product.name) {
          aliases.push({
            canonical_product_id: canonicalProductId,
            alias_type: "name",
            alias_value: product.name,
            source: "auto",
            store_id: product.store_id,
          });
        }

        if (product.sku) {
          aliases.push({
            canonical_product_id: canonicalProductId,
            alias_type: "sku",
            alias_value: product.sku,
            source: "auto",
            store_id: product.store_id,
          });
        }

        if (aliases.length > 0) {
          // Ignore conflicts (duplicate aliases)
          await supabase.from("product_aliases").upsert(aliases, {
            onConflict: "idx_product_aliases_unique",
            ignoreDuplicates: true,
          });
        }
      }

      return product;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["canonical-products"] });
      toast.success("Товар привязан к мастер-товару");
    },
    onError: (error) => {
      toast.error("Ошибка привязки товара");
      console.error(error);
    },
  });

  // Unlink product from canonical product
  const unlinkProductMutation = useMutation({
    mutationFn: async (productId: string) => {
      const { error } = await supabase
        .from("products")
        .update({ canonical_product_id: null })
        .eq("id", productId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["canonical-products"] });
      toast.success("Товар отвязан от мастер-товара");
    },
    onError: (error) => {
      toast.error("Ошибка отвязки товара");
      console.error(error);
    },
  });

  // Create canonical product from existing product
  const createFromProductMutation = useMutation({
    mutationFn: async (productId: string) => {
      // Fetch product data
      const { data: product, error: fetchError } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .single();

      if (fetchError) throw fetchError;

      // Create canonical product
      const { data: canonical, error: createError } = await supabase
        .from("canonical_products")
        .insert({
          canonical_name: product.name,
          canonical_sku: product.sku,
          description: product.description,
          images: product.images,
          unit: product.unit,
          packaging_type: product.packaging_type,
          unit_weight: product.unit_weight,
        })
        .select()
        .single();

      if (createError) throw createError;

      // Link product to canonical
      const { error: linkError } = await supabase
        .from("products")
        .update({ canonical_product_id: canonical.id })
        .eq("id", productId);

      if (linkError) throw linkError;

      // Add aliases
      const aliases: Array<{
        canonical_product_id: string;
        alias_type: string;
        alias_value: string;
        source: string;
        store_id: string | null;
      }> = [];

      if (product.name) {
        aliases.push({
          canonical_product_id: canonical.id,
          alias_type: "name",
          alias_value: product.name,
          source: "manual",
          store_id: product.store_id,
        });
      }

      if (product.sku) {
        aliases.push({
          canonical_product_id: canonical.id,
          alias_type: "sku",
          alias_value: product.sku,
          source: "manual",
          store_id: product.store_id,
        });
      }

      if (aliases.length > 0) {
        await supabase.from("product_aliases").insert(aliases);
      }

      return canonical as CanonicalProduct;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["canonical-products"] });
      toast.success("Мастер-товар создан из товара");
    },
    onError: (error) => {
      toast.error("Ошибка создания мастер-товара");
      console.error(error);
    },
  });

  return {
    canonicalProducts,
    isLoadingCanonical,
    fetchAliases,
    fetchLinkedProducts,
    fetchUnlinkedProducts,
    searchCanonical,
    createCanonical: createCanonicalMutation.mutateAsync,
    updateCanonical: updateCanonicalMutation.mutateAsync,
    deleteCanonical: deleteCanonicalMutation.mutateAsync,
    addAlias: addAliasMutation.mutateAsync,
    deleteAlias: deleteAliasMutation.mutateAsync,
    linkProduct: linkProductMutation.mutateAsync,
    unlinkProduct: unlinkProductMutation.mutateAsync,
    createFromProduct: createFromProductMutation.mutateAsync,
    isCreating: createCanonicalMutation.isPending,
    isLinking: linkProductMutation.isPending,
  };
}
