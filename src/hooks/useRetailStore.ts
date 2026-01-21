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
  retail_catalog_id: string | null;
  // Contact fields for mobile header
  retail_phone: string | null;
  telegram_username: string | null;
  whatsapp_phone: string | null;
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
    if (!store?.id) return;

    // If no catalog is selected, show NO products
    if (!store.retail_catalog_id) {
      setProducts([]);
      return;
    }

    try {
      // Fetch products from the selected catalog only
      const { data, error: productsError } = await supabase
        .from("product_catalog_visibility")
        .select(`
          products!inner (
            id,
            name,
            description,
            price,
            buy_price,
            compare_price,
            images,
            unit,
            sku,
            quantity,
            slug,
            packaging_type,
            category_id,
            is_active,
            deleted_at,
            categories!products_category_id_fkey (
              name
            )
          )
        `)
        .eq("catalog_id", store.retail_catalog_id);

      if (productsError) throw productsError;

      // Fetch catalog product settings for pricing, status, and categories
      const { data: settingsData } = await supabase
        .from("catalog_product_settings")
        .select("product_id, markup_type, markup_value, status, categories")
        .eq("catalog_id", store.retail_catalog_id);

      const settingsMap = new Map(
        (settingsData || []).map(s => [s.product_id, s])
      );

      // Orderable statuses - product is available for purchase
      // in_stock, pre_order, visible, or null (default) = show product
      // hidden, out_of_stock = hide product
      const formattedProducts: RetailProduct[] = (data || [])
        .map((item: any) => {
          const p = item.products;
          if (!p || !p.is_active || p.deleted_at) return null;

          const settings = settingsMap.get(p.id);
          const status = settings?.status || null;

          // Hide products with status 'hidden' or 'out_of_stock'
          if (status === 'hidden' || status === 'out_of_stock') {
            return null;
          }

          // Calculate price with catalog markup
          let calculatedPrice = p.price;
          if (p.buy_price && p.buy_price > 0 && settings) {
            if (settings.markup_type === 'percent') {
              calculatedPrice = p.buy_price * (1 + (settings.markup_value || 0) / 100);
            } else if (settings.markup_type === 'fixed' || settings.markup_type === 'rubles') {
              calculatedPrice = p.buy_price + (settings.markup_value || 0);
            }
          }
          // Use product price if it's set and higher than 0, otherwise use calculated price
          const finalPrice = p.price > 0 ? p.price : calculatedPrice;

          // Skip products with no valid price
          if (finalPrice <= 0) return null;

          // Get category from catalog settings first, fall back to product category_id
          const catalogCategories = settings?.categories as string[] | null;
          const primaryCategoryId = catalogCategories && catalogCategories.length > 0 
            ? catalogCategories[0] 
            : p.category_id;

          return {
            id: p.id,
            name: p.name,
            description: p.description,
            price: finalPrice,
            compare_price: p.compare_price,
            images: p.images || [],
            unit: p.unit || "шт",
            sku: p.sku,
            quantity: p.quantity,
            slug: p.slug,
            packaging_type: p.packaging_type || "piece",
            category_id: primaryCategoryId,
            category_ids: catalogCategories || (p.category_id ? [p.category_id] : []),
            category_name: p.categories?.name,
            is_active: p.is_active,
            catalog_status: status, // Pass catalog status
          };
        })
        .filter(Boolean) as RetailProduct[];

      setProducts(formattedProducts);
    } catch (err) {
      console.error("Error fetching products:", err);
    }
  }, [store?.id, store?.retail_catalog_id]);

  const fetchCategories = useCallback(async () => {
    if (!store?.id) return;

    try {
      const { data, error: catError } = await supabase
        .from("categories")
        .select("id, name, slug, image_url")
        .eq("store_id", store.id)
        .order("sort_order");

      if (catError) throw catError;

      // Count products per category using category_ids array
      const categoriesWithCount = (data || []).map((cat) => ({
        ...cat,
        product_count: products.filter((p) => 
          p.category_ids.includes(cat.id) || p.category_id === cat.id
        ).length,
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
