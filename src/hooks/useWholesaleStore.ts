import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface WholesaleStore {
  id: string;
  name: string;
  wholesale_name: string | null;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  primary_color: string;
  secondary_color: string;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  wholesale_enabled: boolean;
  wholesale_theme: {
    primaryColor?: string;
    accentColor?: string;
    headerStyle?: string;
    productCardStyle?: string;
  };
  wholesale_logo_url: string | null;
  wholesale_seo_title: string | null;
  wholesale_seo_description: string | null;
  wholesale_custom_domain: string | null;
  seo_title: string | null;
  seo_description: string | null;
  favicon_url: string | null;
  custom_domain: string | null;
  wholesale_catalog_id: string | null;
  wholesale_min_order_amount: number | null;
  retail_phone: string | null;
  telegram_username: string | null;
  whatsapp_phone: string | null;
  // Livestream fields
  wholesale_livestream_enabled: boolean;
  wholesale_livestream_url: string | null;
  wholesale_livestream_title: string | null;
}

export interface WholesaleProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  compare_price: number | null;
  buy_price: number | null;
  images: string[];
  unit: string;
  sku: string | null;
  quantity: number;
  slug: string;
  packaging_type: string;
  category_id: string | null;
  category_ids: string[];
  category_name?: string;
  is_active: boolean;
  catalog_status: string | null;
  // SEO fields
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string[] | null;
  seo_schema: object | null;
}

export interface WholesaleCategory {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  product_count?: number;
}

export function useWholesaleStore(subdomain: string | undefined) {
  const [store, setStore] = useState<WholesaleStore | null>(null);
  const [products, setProducts] = useState<WholesaleProduct[]>([]);
  const [categories, setCategories] = useState<WholesaleCategory[]>([]);
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

      // Check if wholesale is enabled
      if (!data.wholesale_enabled) {
        setError("Оптовый магазин не активирован");
        return;
      }

      setStore({
        ...data,
        wholesale_theme: (data.wholesale_theme as WholesaleStore["wholesale_theme"]) || {},
      });
    } catch (err) {
      console.error("Error fetching wholesale store:", err);
      setError("Ошибка загрузки магазина");
    }
  }, [subdomain]);

  const fetchProducts = useCallback(async () => {
    if (!subdomain) return;
    
    // If no catalog is selected, show NO products
    if (!store?.wholesale_catalog_id) {
      setProducts([]);
      return;
    }

    try {
      // Use the public RPC function that bypasses RLS
      const { data, error: productsError } = await supabase
        .rpc('get_wholesale_products_public' as any, { _subdomain: subdomain });

      if (productsError) throw productsError;

      const rawData = data as any[] || [];
      const formattedProducts: WholesaleProduct[] = rawData.map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        compare_price: p.compare_price,
        buy_price: p.buy_price,
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
        seo_title: p.seo_title,
        seo_description: p.seo_description,
        seo_keywords: p.seo_keywords,
        seo_schema: p.seo_schema,
      }));

      setProducts(formattedProducts);
    } catch (err) {
      console.error("Error fetching products:", err);
    }
  }, [subdomain, store?.wholesale_catalog_id]);

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

// Get single product by slug for SEO page
export function useWholesaleProduct(subdomain: string | undefined, slug: string | undefined) {
  const { store, products, loading, error } = useWholesaleStore(subdomain);
  
  const product = products.find(p => p.slug === slug) || null;
  
  return {
    store,
    product,
    loading,
    error: product ? null : (loading ? null : "Товар не найден"),
  };
}
