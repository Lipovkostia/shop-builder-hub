import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface RetailStore {
  id: string;
  name: string;
  retail_name: string | null;
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
    fonts?: {
      productName?: {
        family?: string;
        size?: string;
      };
      productPrice?: {
        family?: string;
        size?: string;
      };
      productDescription?: {
        family?: string;
        size?: string;
      };
      catalog?: {
        family?: string;
        size?: string;
      };
    };
  };
  retail_logo_url: string | null;
  seo_title: string | null;
  seo_description: string | null;
  favicon_url: string | null;
  custom_domain: string | null;
  retail_catalog_id: string | null;
  // Contact fields for mobile header
  retail_phone: string | null;
  telegram_username: string | null;
  whatsapp_phone: string | null;
  // Delivery info fields
  retail_delivery_time: string | null;
  retail_delivery_info: string | null;
  retail_delivery_free_from: number | null;
  retail_delivery_region: string | null;
  // Footer content fields
  retail_footer_delivery_payment: string | null;
  retail_footer_returns: string | null;
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
  category_ids: string[]; // All categories from catalog settings
  category_name?: string;
  is_active: boolean;
  catalog_status: string | null; // Status from catalog_product_settings
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
    if (!subdomain) return;
    
    // If no catalog is selected, show NO products
    if (!store?.retail_catalog_id) {
      setProducts([]);
      return;
    }

    try {
      // Use the public RPC function that bypasses RLS
      // Note: This function is created via migration and may not be in generated types
      const { data, error: productsError } = await supabase
        .rpc('get_retail_products_public' as any, { _subdomain: subdomain });

      if (productsError) throw productsError;

      const rawData = data as any[] || [];
      const formattedProducts: RetailProduct[] = rawData.map((p: any) => ({
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
        category_ids: p.category_ids || (p.category_id ? [p.category_id] : []),
        category_name: p.category_name,
        is_active: true,
        catalog_status: p.catalog_status,
      }));

      setProducts(formattedProducts);
    } catch (err) {
      console.error("Error fetching products:", err);
    }
  }, [subdomain, store?.retail_catalog_id]);

  const fetchCategories = useCallback(async () => {
    if (!store?.id) return;

    try {
      let categoriesData: { id: string; name: string; slug: string; image_url: string | null }[] = [];
      
      // Use catalog-specific ordering if retail catalog is set
      if (store.retail_catalog_id) {
        const { data, error: rpcError } = await supabase
          .rpc('get_catalog_categories_ordered' as any, {
            _catalog_id: store.retail_catalog_id,
            _store_id: store.id
          });
        
        if (rpcError) throw rpcError;
        categoriesData = data || [];
      } else {
        // Fallback to global sort order
        const { data, error: catError } = await supabase
          .from("categories")
          .select("id, name, slug, image_url")
          .eq("store_id", store.id)
          .order("sort_order");

        if (catError) throw catError;
        categoriesData = data || [];
      }

      // Count products per category using category_ids array
      const categoriesWithCount = categoriesData.map((cat) => ({
        ...cat,
        product_count: products.filter((p) => 
          p.category_ids.includes(cat.id) || p.category_id === cat.id
        ).length,
      }));

      setCategories(categoriesWithCount);
    } catch (err) {
      console.error("Error fetching categories:", err);
    }
  }, [store?.id, store?.retail_catalog_id, products]);

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
    if (store?.id) {
      fetchCategories();
    }
  }, [store?.id, products, fetchCategories]);

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
