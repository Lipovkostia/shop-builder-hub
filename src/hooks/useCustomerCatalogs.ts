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
}

export interface CatalogProduct {
  id: string;
  name: string;
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

export function useCustomerCatalogs(impersonateUserId?: string) {
  const { toast } = useToast();
  const [catalogs, setCatalogs] = useState<CustomerCatalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentCatalog, setCurrentCatalog] = useState<CustomerCatalog | null>(null);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);

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
        };
      });

      setCatalogs(customerCatalogs);
      
      // Set first catalog as current if none selected
      if (customerCatalogs.length > 0 && !currentCatalog) {
        setCurrentCatalog(customerCatalogs[0]);
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

  // Fetch products for current catalog
  const fetchProducts = useCallback(async (catalogId: string) => {
    try {
      setProductsLoading(true);

      // Get catalog to find store_id
      const { data: catalog } = await supabase
        .from("catalogs")
        .select("store_id")
        .eq("id", catalogId)
        .single();

      if (!catalog) return;

      // Get product visibility for this catalog
      const { data: visibility } = await supabase
        .from("product_catalog_visibility")
        .select("product_id")
        .eq("catalog_id", catalogId);

      if (!visibility || visibility.length === 0) {
        setProducts([]);
        return;
      }

      const productIds = visibility.map(v => v.product_id);

      // Get catalog product settings for this catalog
      const { data: catalogSettings } = await supabase
        .from("catalog_product_settings")
        .select("product_id, status, markup_type, markup_value, portion_prices, categories")
        .eq("catalog_id", catalogId);

      // Create a map for quick lookup
      const settingsMap = new Map(
        (catalogSettings || []).map(s => [s.product_id, s])
      );

      // Get products
      const { data: productsData, error } = await supabase
        .from("products")
        .select("*")
        .in("id", productIds)
        .eq("is_active", true);

      if (error) throw error;

      const mappedProducts: CatalogProduct[] = (productsData || []).map(p => {
        const settings = settingsMap.get(p.id);
        
        // Calculate final price with catalog markup if set
        let finalPrice = p.price;
        const buyPrice = p.buy_price || 0;
        
        // Priority: catalog markup > product markup > direct price
        if (settings?.markup_type && settings?.markup_value !== null && settings?.markup_value !== undefined && buyPrice > 0) {
          // Use catalog-specific markup
          if (settings.markup_type === 'percent') {
            finalPrice = buyPrice * (1 + (settings.markup_value || 0) / 100);
          } else if (settings.markup_type === 'fixed') {
            finalPrice = buyPrice + (settings.markup_value || 0);
          }
        } else if (p.markup_type && p.markup_value !== null && p.markup_value !== undefined && buyPrice > 0) {
          // Use product markup
          if (p.markup_type === 'percent') {
            finalPrice = buyPrice * (1 + (p.markup_value || 0) / 100);
          } else if (p.markup_type === 'fixed') {
            finalPrice = buyPrice + (p.markup_value || 0);
          }
        } else if (p.price === 0 && buyPrice > 0) {
          // Fallback: if price is 0 but buy_price exists, use buy_price
          finalPrice = buyPrice;
        }
        
        return {
          id: p.id,
          name: p.name,
          description: p.description,
          price: finalPrice,
          compare_price: p.compare_price,
          unit: p.unit || "кг",
          unit_weight: p.unit_weight,
          packaging_type: p.packaging_type,
          images: p.images || [],
          is_active: p.is_active ?? true,
          buy_price: p.buy_price,
          markup_type: p.markup_type,
          markup_value: p.markup_value,
          price_full: p.price_full,
          price_half: p.price_half,
          price_quarter: p.price_quarter,
          price_portion: p.price_portion,
          portion_weight: p.portion_weight,
          quantity: p.quantity ?? 0,
          // Add catalog-specific settings
          catalog_status: settings?.status || null,
          catalog_markup_type: settings?.markup_type || null,
          catalog_markup_value: settings?.markup_value || null,
          // Map portion_prices from DB format (halfPricePerKg, quarterPricePerKg, portionPrice) 
          // to expected format (half, quarter, portion)
          catalog_portion_prices: settings?.portion_prices ? (() => {
            const pp = settings.portion_prices as Record<string, number | null>;
            return {
              full: pp.fullPrice ?? pp.full ?? null,
              half: pp.halfPricePerKg ?? pp.half ?? null,
              quarter: pp.quarterPricePerKg ?? pp.quarter ?? null,
              portion: pp.portionPrice ?? pp.portion ?? null,
            };
          })() : null,
          // Categories assigned in catalog settings
          catalog_categories: settings?.categories || null,
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

      // Find catalog by access code
      const { data: catalog, error: catalogError } = await supabase
        .from("catalogs")
        .select("id, store_id, name")
        .eq("access_code", accessCode)
        .single();

      if (catalogError || !catalog) {
        throw new Error("Прайс-лист не найден. Проверьте ссылку.");
      }

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
