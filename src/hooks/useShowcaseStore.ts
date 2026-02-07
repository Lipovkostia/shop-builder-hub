import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ShowcaseStore {
  id: string;
  name: string;
  showcase_name: string | null;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  primary_color: string;
  secondary_color: string;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  showcase_enabled: boolean;
  showcase_theme: {
    primaryColor?: string;
    accentColor?: string;
    headerStyle?: string;
    productCardStyle?: string;
    fonts?: {
      productName?: { family?: string; size?: string };
      productPrice?: { family?: string; size?: string };
      productDescription?: { family?: string; size?: string };
      catalog?: { family?: string; size?: string };
    };
  };
  showcase_logo_url: string | null;
  showcase_seo_title: string | null;
  showcase_seo_description: string | null;
  showcase_favicon_url: string | null;
  showcase_custom_domain: string | null;
  showcase_catalog_id: string | null;
  showcase_phone: string | null;
  showcase_telegram_username: string | null;
  showcase_whatsapp_phone: string | null;
  showcase_delivery_time: string | null;
  showcase_delivery_info: string | null;
  showcase_delivery_free_from: number | null;
  showcase_delivery_region: string | null;
  showcase_footer_delivery_payment: string | null;
  showcase_footer_returns: string | null;
}

export interface ShowcaseProduct {
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
  category_ids: string[];
  category_name?: string;
  is_active: boolean;
  catalog_status: string | null;
}

export interface ShowcaseCategory {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  product_count?: number;
}

export function useShowcaseStore(subdomain: string | undefined) {
  const [store, setStore] = useState<ShowcaseStore | null>(null);
  const [products, setProducts] = useState<ShowcaseProduct[]>([]);
  const [categories, setCategories] = useState<ShowcaseCategory[]>([]);
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
      if (!data) { setError("Магазин не найден"); return; }
      const d = data as any;
      if (!d.showcase_enabled) { setError("Витрина не активирована"); return; }
      setStore({ ...d, showcase_theme: (d.showcase_theme as ShowcaseStore["showcase_theme"]) || {} });
    } catch (err) {
      console.error("Error fetching showcase store:", err);
      setError("Ошибка загрузки витрины");
    }
  }, [subdomain]);

  const fetchProducts = useCallback(async () => {
    if (!subdomain || !store?.showcase_catalog_id) { setProducts([]); return; }
    try {
      const { data, error: productsError } = await supabase
        .rpc('get_showcase_products_public' as any, { _subdomain: subdomain });
      if (productsError) throw productsError;
      const rawData = data as any[] || [];
      setProducts(rawData.map((p: any) => ({
        id: p.id, name: p.name, description: p.description,
        price: p.price, compare_price: p.compare_price,
        images: p.images || [], unit: p.unit || "шт", sku: p.sku,
        quantity: p.quantity, slug: p.slug,
        packaging_type: p.packaging_type || "piece",
        category_id: p.category_id,
        category_ids: p.category_ids || (p.category_id ? [p.category_id] : []),
        category_name: p.category_name, is_active: true,
        catalog_status: p.catalog_status,
      })));
    } catch (err) { console.error("Error fetching showcase products:", err); }
  }, [subdomain, store?.showcase_catalog_id]);

  const fetchCategories = useCallback(async () => {
    if (!store?.id) return;
    try {
      let categoriesData: any[] = [];
      if (store.showcase_catalog_id) {
        const { data, error: rpcError } = await supabase
          .rpc('get_catalog_categories_ordered' as any, { _catalog_id: store.showcase_catalog_id, _store_id: store.id });
        if (rpcError) throw rpcError;
        categoriesData = data || [];
      } else {
        const { data, error: catError } = await supabase
          .from("categories").select("id, name, slug, image_url").eq("store_id", store.id).order("sort_order");
        if (catError) throw catError;
        categoriesData = data || [];
      }
      setCategories(categoriesData.map((cat: any) => ({
        ...cat,
        product_count: products.filter((p) => p.category_ids.includes(cat.id) || p.category_id === cat.id).length,
      })));
    } catch (err) { console.error("Error fetching categories:", err); }
  }, [store?.id, store?.showcase_catalog_id, products]);

  useEffect(() => { setLoading(true); fetchStore().finally(() => setLoading(false)); }, [fetchStore]);
  useEffect(() => { if (store?.id) fetchProducts(); }, [store?.id, fetchProducts]);
  useEffect(() => { if (store?.id) fetchCategories(); }, [store?.id, products, fetchCategories]);

  return { store, products, categories, loading, error, refetch: fetchStore };
}
