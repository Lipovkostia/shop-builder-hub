import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface RetailStore {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  primary_color: string;
  secondary_color: string;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  retail_enabled: boolean;
  retail_theme: {
    primaryColor?: string;
    accentColor?: string;
    headerStyle?: string;
    productCardStyle?: string;
  };
  retail_logo_url: string | null;
  seo_title: string | null;
  seo_description: string | null;
  favicon_url: string | null;
  custom_domain: string | null;
}

export interface RetailProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  compare_price: number | null;
  images: string[];
  unit: string;
  sku: string | null;
  quantity: number;
  slug: string;
  packaging_type: string;
  category_id: string | null;
  category_name?: string;
  is_active: boolean;
}

export interface RetailCategory {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  product_count?: number;
}

export function useRetailStore(subdomain: string | undefined) {
  const [store, setStore] = useState<RetailStore | null>(null);
  const [products, setProducts] = useState<RetailProduct[]>([]);
  const [categories, setCategories] = useState<RetailCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStore = useCallback(async () => {
    if (!subdomain) return;

    try {
      const { data, error: storeError } = await supabase
        .from("stores")
        .select("*")
        .eq("subdomain", subdomain)
        .eq("status", "active")
        .single();

      if (storeError) throw storeError;

      if (!data) {
        setError("Магазин не найден");
        return;
      }

      // Check if retail is enabled
      if (!data.retail_enabled) {
        setError("Розничный магазин не активирован");
        return;
      }

      setStore({
        ...data,
        retail_theme: (data.retail_theme as RetailStore["retail_theme"]) || {},
      });
    } catch (err) {
      console.error("Error fetching retail store:", err);
      setError("Ошибка загрузки магазина");
    }
  }, [subdomain]);

  const fetchProducts = useCallback(async () => {
    if (!store?.id) return;

    try {
      const { data, error: productsError } = await supabase
        .from("products")
        .select(`
          id,
          name,
          description,
          price,
          compare_price,
          images,
          unit,
          sku,
          quantity,
          slug,
          packaging_type,
          category_id,
          is_active,
          categories!products_category_id_fkey (
            name
          )
        `)
        .eq("store_id", store.id)
        .eq("is_active", true)
        .is("deleted_at", null)
        .gt("price", 0)
        .order("name");

      if (productsError) throw productsError;

      const formattedProducts: RetailProduct[] = (data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        compare_price: p.compare_price,
        images: p.images || [],
        unit: p.unit || "шт",
        sku: p.sku,
        quantity: p.quantity,
        slug: p.slug,
        packaging_type: p.packaging_type || "piece",
        category_id: p.category_id,
        category_name: p.categories?.name,
        is_active: p.is_active,
      }));

      setProducts(formattedProducts);
    } catch (err) {
      console.error("Error fetching products:", err);
    }
  }, [store?.id]);

  const fetchCategories = useCallback(async () => {
    if (!store?.id) return;

    try {
      const { data, error: catError } = await supabase
        .from("categories")
        .select("id, name, slug, image_url")
        .eq("store_id", store.id)
        .order("sort_order");

      if (catError) throw catError;

      // Count products per category
      const categoriesWithCount = (data || []).map((cat) => ({
        ...cat,
        product_count: products.filter((p) => p.category_id === cat.id).length,
      }));

      setCategories(categoriesWithCount);
    } catch (err) {
      console.error("Error fetching categories:", err);
    }
  }, [store?.id, products]);

  useEffect(() => {
    setLoading(true);
    fetchStore().finally(() => setLoading(false));
  }, [fetchStore]);

  useEffect(() => {
    if (store?.id) {
      fetchProducts();
    }
  }, [store?.id, fetchProducts]);

  useEffect(() => {
    if (store?.id && products.length > 0) {
      fetchCategories();
    }
  }, [store?.id, products.length, fetchCategories]);

  return {
    store,
    products,
    categories,
    loading,
    error,
    refetch: fetchStore,
  };
}

// Hook to resolve store by custom domain or subdomain
export function useStoreResolver() {
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  
  // Check if it's a known platform domain
  const isPlatformDomain = 
    hostname.endsWith(".lovable.app") ||
    hostname.endsWith(".lovable.dev") ||
    hostname === "localhost";

  if (isPlatformDomain) {
    return { type: "platform" as const, subdomain: null };
  }

  // It's a custom domain
  return { type: "custom_domain" as const, domain: hostname };
}

export function useStoreByCustomDomain(domain: string | null) {
  const [store, setStore] = useState<RetailStore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!domain) {
      setLoading(false);
      return;
    }

    const fetchStore = async () => {
      try {
        const { data, error: storeError } = await supabase
          .from("stores")
          .select("*")
          .eq("custom_domain", domain)
          .eq("status", "active")
          .eq("retail_enabled", true)
          .single();

        if (storeError) throw storeError;

        if (!data) {
          setError("Магазин не найден");
          return;
        }

        setStore({
          ...data,
          retail_theme: (data.retail_theme as RetailStore["retail_theme"]) || {},
        });
      } catch (err) {
        console.error("Error fetching store by domain:", err);
        setError("Ошибка загрузки магазина");
      } finally {
        setLoading(false);
      }
    };

    fetchStore();
  }, [domain]);

  return { store, loading, error };
}
