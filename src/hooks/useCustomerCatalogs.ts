import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface CustomerCatalog {
  id: string;
  catalog_id: string;
  catalog_name: string;
  catalog_description: string | null;
  store_id: string;
  store_name: string;
  store_logo: string | null;
  granted_at: string;
  store_customer_id: string; // ID записи в store_customers для синхронизации корзины
}

export interface CatalogProduct {
  id: string;
  name: string;
  sku?: string | null;
  description: string | null;
  price: number;
  compare_price: number | null;
  unit: string;
  unit_weight: number | null;
  packaging_type: string | null;
  images: string[];
  is_active: boolean;
  buy_price: number | null;
  markup_type: string | null;
  markup_value: number | null;
  price_full: number | null;
  price_half: number | null;
  price_quarter: number | null;
  price_portion: number | null;
  portion_weight: number | null;
  quantity: number;
  moysklad_id?: string | null; // For MoySklad order sync
  // Catalog-specific settings
  catalog_status?: string | null;
  catalog_markup_type?: string | null;
  catalog_markup_value?: number | null;
  catalog_portion_prices?: {
    full?: number | null;
    half?: number | null;
    quarter?: number | null;
    portion?: number | null;
  } | null;
  // Categories assigned in catalog
  catalog_categories?: string[] | null;
}

export interface CartItem {
  product: CatalogProduct;
  quantity: number;
  variant?: 'full' | 'half' | 'quarter' | 'portion';
}

const CATALOG_STORAGE_KEY = 'customer_selected_catalog_id';

export function useCustomerCatalogs(impersonateUserId?: string) {
  const { toast } = useToast();
  const [catalogs, setCatalogs] = useState<CustomerCatalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentCatalog, setCurrentCatalogState] = useState<CustomerCatalog | null>(null);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);

  // Wrapper to save selected catalog to localStorage
  const setCurrentCatalog = useCallback((catalog: CustomerCatalog | null) => {
    setCurrentCatalogState(catalog);
    if (catalog) {
      localStorage.setItem(CATALOG_STORAGE_KEY, catalog.catalog_id);
    } else {
      localStorage.removeItem(CATALOG_STORAGE_KEY);
    }
  }, []);

  // Fetch all catalogs the customer has access to
  const fetchCatalogs = useCallback(async () => {
    try {
      setLoading(true);
      
      // Get user ID - either impersonated or current user
      let userId = impersonateUserId;
      if (!userId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        userId = user.id;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", userId)
        .single();

      if (!profile) return;

      // Get store_customer records
      const { data: storeCustomers } = await supabase
        .from("store_customers")
        .select("id, store_id")
        .eq("profile_id", profile.id);

      if (!storeCustomers || storeCustomers.length === 0) {
        setCatalogs([]);
        return;
      }

      const storeCustomerIds = storeCustomers.map(sc => sc.id);

      // Get catalog access records
      const { data: accessRecords, error } = await supabase
        .from("customer_catalog_access")
        .select(`
          id,
          catalog_id,
          granted_at,
          store_customer_id
        `)
        .in("store_customer_id", storeCustomerIds);

      if (error) throw error;

      if (!accessRecords || accessRecords.length === 0) {
        setCatalogs([]);
        return;
      }

      // Get catalog details
      const catalogIds = accessRecords.map(ar => ar.catalog_id);
      const { data: catalogsData } = await supabase
        .from("catalogs")
        .select("id, name, description, store_id")
        .in("id", catalogIds);

      if (!catalogsData) {
        setCatalogs([]);
        return;
      }

      // Get store details
      const storeIds = [...new Set(catalogsData.map(c => c.store_id))];
      const { data: storesData } = await supabase
        .from("stores")
        .select("id, name, logo_url")
        .in("id", storeIds);

      // Combine data
      const customerCatalogs: CustomerCatalog[] = accessRecords.map(ar => {
        const catalog = catalogsData.find(c => c.id === ar.catalog_id);
        const store = storesData?.find(s => s.id === catalog?.store_id);
        
        return {
          id: ar.id,
          catalog_id: ar.catalog_id,
          catalog_name: catalog?.name || "Без названия",
          catalog_description: catalog?.description || null,
          store_id: catalog?.store_id || "",
          store_name: store?.name || "Магазин",
          store_logo: store?.logo_url || null,
          granted_at: ar.granted_at,
          store_customer_id: ar.store_customer_id, // ID для синхронизации корзины
        };
      });

      setCatalogs(customerCatalogs);
      
      // Try to restore previously selected catalog from localStorage
      if (customerCatalogs.length > 0 && !currentCatalog) {
        const savedCatalogId = localStorage.getItem(CATALOG_STORAGE_KEY);
        const savedCatalog = savedCatalogId 
          ? customerCatalogs.find(c => c.catalog_id === savedCatalogId) 
          : null;
        
        // Use saved catalog if found, otherwise use first catalog
        setCurrentCatalog(savedCatalog || customerCatalogs[0]);
      }
    } catch (error: any) {
      console.error("Error fetching customer catalogs:", error);
      toast({
        title: "Ошибка загрузки каталогов",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast, currentCatalog]);

  // Fetch products for current catalog using the same RPC as guest view
  // This ensures prices are calculated server-side with correct priority:
  // catalog fixed price > product fixed price > price field > buy_price + markup
  const fetchProducts = useCallback(async (catalogId: string) => {
    try {
      setProductsLoading(true);

      // Get the catalog's access_code to use the public RPC function
      // which already handles all pricing logic correctly server-side
      const { data: catalog } = await supabase
        .from("catalogs")
        .select("access_code")
        .eq("id", catalogId)
        .single();

      if (!catalog?.access_code) {
        setProducts([]);
        return;
      }

      // Use the same RPC as guest view - it correctly handles all price priorities
      const { data, error } = await supabase
        .rpc('get_catalog_products_public', { _access_code: catalog.access_code });

      if (error) throw error;

      if (!data || data.length === 0) {
        setProducts([]);
        return;
      }

      const mappedProducts: CatalogProduct[] = data.map((row: any) => {
        // product_price already has all markup/fixed price logic applied server-side
        const finalPrice = Number(row.product_price) || 0;

        // Parse portion prices from JSON
        let portionPrices: CatalogProduct['catalog_portion_prices'] = null;
        if (row.setting_portion_prices) {
          try {
            const pp = typeof row.setting_portion_prices === 'string'
              ? JSON.parse(row.setting_portion_prices)
              : row.setting_portion_prices;
            portionPrices = {
              full: pp.fullPrice ?? pp.full ?? null,
              half: pp.halfPricePerKg ?? pp.half ?? null,
              quarter: pp.quarterPricePerKg ?? pp.quarter ?? null,
              portion: pp.portionPrice ?? pp.portion ?? null,
            };
            if (portionPrices.full != null) portionPrices.full = Number(portionPrices.full);
            if (portionPrices.half != null) portionPrices.half = Number(portionPrices.half);
            if (portionPrices.quarter != null) portionPrices.quarter = Number(portionPrices.quarter);
            if (portionPrices.portion != null) portionPrices.portion = Number(portionPrices.portion);
          } catch {
            portionPrices = null;
          }
        }

        return {
          id: row.product_id,
          name: row.product_name,
          sku: row.product_sku ?? null,
          description: row.product_description,
          price: finalPrice,
          compare_price: row.product_compare_price ? Number(row.product_compare_price) : null,
          unit: row.product_unit || "кг",
          unit_weight: row.product_unit_weight ? Number(row.product_unit_weight) : null,
          packaging_type: row.product_packaging_type,
          images: row.product_images || [],
          is_active: true,
          buy_price: null, // not exposed via public RPC for security
          markup_type: row.setting_markup_type,
          markup_value: row.setting_markup_value ? Number(row.setting_markup_value) : null,
          price_full: row.product_price_full ? Number(row.product_price_full) : null,
          price_half: row.product_price_half ? Number(row.product_price_half) : null,
          price_quarter: row.product_price_quarter ? Number(row.product_price_quarter) : null,
          price_portion: row.product_price_portion ? Number(row.product_price_portion) : null,
          portion_weight: row.product_portion_weight ? Number(row.product_portion_weight) : null,
          quantity: row.product_quantity || 0,
          catalog_status: row.setting_status || null,
          catalog_markup_type: row.setting_markup_type || null,
          catalog_markup_value: row.setting_markup_value ? Number(row.setting_markup_value) : null,
          catalog_portion_prices: portionPrices,
          catalog_categories: row.setting_categories || null,
          moysklad_id: null,
        };
      });

      setProducts(mappedProducts);
    } catch (error: any) {
      console.error("Error fetching catalog products:", error);
      toast({
        title: "Ошибка загрузки товаров",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProductsLoading(false);
    }
  }, [toast]);

  // Add catalog access for a customer
  const addCatalogAccess = useCallback(async (catalogId: string, storeId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Не авторизован");

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!profile) throw new Error("Профиль не найден");

      // Check if already a customer of this store
      let { data: storeCustomer } = await supabase
        .from("store_customers")
        .select("id")
        .eq("profile_id", profile.id)
        .eq("store_id", storeId)
        .single();

      // If not a customer, create record
      if (!storeCustomer) {
        const { data: newCustomer, error: customerError } = await supabase
          .from("store_customers")
          .insert({
            profile_id: profile.id,
            store_id: storeId,
          })
          .select()
          .single();

        if (customerError) throw customerError;
        storeCustomer = newCustomer;
      }

      // Add catalog access
      const { error: accessError } = await supabase
        .from("customer_catalog_access")
        .insert({
          store_customer_id: storeCustomer.id,
          catalog_id: catalogId,
        });

      if (accessError) {
        if (accessError.message.includes("duplicate")) {
          toast({
            title: "Уже добавлено",
            description: "Этот прайс-лист уже есть в вашем списке",
          });
          return true;
        }
        throw accessError;
      }

      toast({
        title: "Прайс-лист добавлен",
        description: "Теперь вы можете просматривать товары",
      });

      await fetchCatalogs();
      return true;
    } catch (error: any) {
      console.error("Error adding catalog access:", error);
      toast({
        title: "Ошибка добавления",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  }, [toast, fetchCatalogs]);

  // Extract access code from URL or use as-is
  const extractAccessCode = (input: string): string => {
    const trimmed = input.trim();
    
    // Try to parse as URL
    try {
      const url = new URL(trimmed);
      // Extract last path segment (e.g., /catalog/1857c058 -> 1857c058)
      const pathParts = url.pathname.split('/').filter(Boolean);
      if (pathParts.length > 0) {
        return pathParts[pathParts.length - 1];
      }
    } catch {
      // Not a valid URL, check if it contains /catalog/ pattern
      const match = trimmed.match(/\/catalog\/([a-zA-Z0-9]+)/);
      if (match) {
        return match[1];
      }
    }
    
    // Return as-is if no URL pattern found
    return trimmed;
  };

  // Add catalog by access code (from link)
  const addCatalogByCode = useCallback(async (input: string) => {
    try {
      const accessCode = extractAccessCode(input);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Не авторизован");

      // Use RPC function with SECURITY DEFINER to bypass RLS
      // This allows users without existing access to lookup catalog info
      const { data: catalogResult, error: catalogError } = await supabase
        .rpc("get_catalog_by_access_code", { _access_code: accessCode })
        .single();

      if (catalogError || !catalogResult) {
        throw new Error("Прайс-лист не найден. Проверьте ссылку.");
      }

      const catalog = {
        id: catalogResult.id,
        store_id: catalogResult.store_id,
        name: catalogResult.name,
      };

      // Get profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!profile) throw new Error("Профиль не найден");

      // Check if already a customer of this store
      let { data: storeCustomer } = await supabase
        .from("store_customers")
        .select("id")
        .eq("profile_id", profile.id)
        .eq("store_id", catalog.store_id)
        .single();

      // If not a customer, create record
      if (!storeCustomer) {
        const { data: newCustomer, error: customerError } = await supabase
          .from("store_customers")
          .insert({
            profile_id: profile.id,
            store_id: catalog.store_id,
          })
          .select()
          .single();

        if (customerError) throw customerError;
        storeCustomer = newCustomer;
      }

      // Check if already has access
      const { data: existingAccess } = await supabase
        .from("customer_catalog_access")
        .select("id")
        .eq("store_customer_id", storeCustomer.id)
        .eq("catalog_id", catalog.id)
        .single();

      if (existingAccess) {
        toast({
          title: "Уже добавлено",
          description: `Прайс-лист "${catalog.name}" уже есть в вашем списке`,
        });
        return { success: true, catalogName: catalog.name };
      }

      // Add catalog access
      const { error: accessError } = await supabase
        .from("customer_catalog_access")
        .insert({
          store_customer_id: storeCustomer.id,
          catalog_id: catalog.id,
        });

      if (accessError) throw accessError;

      toast({
        title: "Прайс-лист добавлен",
        description: `"${catalog.name}" добавлен в ваш список`,
      });

      await fetchCatalogs();
      return { success: true, catalogName: catalog.name };
    } catch (error: any) {
      console.error("Error adding catalog by code:", error);
      toast({
        title: "Ошибка добавления",
        description: error.message,
        variant: "destructive",
      });
      return { success: false, error: error.message };
    }
  }, [toast, fetchCatalogs]);

  // Initial fetch
  useEffect(() => {
    fetchCatalogs();
  }, [fetchCatalogs]);

  // Fetch products when catalog changes
  useEffect(() => {
    if (currentCatalog) {
      fetchProducts(currentCatalog.catalog_id);
    }
  }, [currentCatalog, fetchProducts]);

  return {
    catalogs,
    loading,
    currentCatalog,
    setCurrentCatalog,
    products,
    productsLoading,
    addCatalogAccess,
    addCatalogByCode,
    refetch: fetchCatalogs,
  };
}
