import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

type StoreType = "retail" | "wholesale" | null;

interface CustomDomainStore {
  id: string;
  subdomain: string;
  name: string;
  retail_name: string | null;
  wholesale_name: string | null;
  custom_domain: string | null;
  wholesale_custom_domain: string | null;
  retail_enabled: boolean | null;
  wholesale_enabled: boolean | null;
}

interface UseCustomDomainStoreResult {
  store: CustomDomainStore | null;
  storeType: StoreType;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to find a store by custom domain.
 * Checks both custom_domain (Retail) and wholesale_custom_domain (Wholesale).
 */
export function useCustomDomainStore(hostname: string | null): UseCustomDomainStoreResult {
  const [store, setStore] = useState<CustomDomainStore | null>(null);
  const [storeType, setStoreType] = useState<StoreType>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hostname) {
      setLoading(false);
      return;
    }

    const fetchStore = async () => {
      setLoading(true);
      setError(null);

      try {
        // First, try to find by retail custom_domain
        const { data: retailStore, error: retailError } = await supabase
          .from("stores")
          .select("id, subdomain, name, retail_name, wholesale_name, custom_domain, wholesale_custom_domain, retail_enabled, wholesale_enabled")
          .eq("custom_domain", hostname)
          .eq("status", "active")
          .eq("retail_enabled", true)
          .maybeSingle();

        if (retailError && retailError.code !== "PGRST116") {
          throw retailError;
        }

        if (retailStore) {
          setStore(retailStore);
          setStoreType("retail");
          setLoading(false);
          return;
        }

        // If not found in retail, try wholesale_custom_domain
        const { data: wholesaleStore, error: wholesaleError } = await supabase
          .from("stores")
          .select("id, subdomain, name, retail_name, wholesale_name, custom_domain, wholesale_custom_domain, retail_enabled, wholesale_enabled")
          .eq("wholesale_custom_domain", hostname)
          .eq("status", "active")
          .eq("wholesale_enabled", true)
          .maybeSingle();

        if (wholesaleError && wholesaleError.code !== "PGRST116") {
          throw wholesaleError;
        }

        if (wholesaleStore) {
          setStore(wholesaleStore);
          setStoreType("wholesale");
          setLoading(false);
          return;
        }

        // Not found in either
        setStore(null);
        setStoreType(null);
        setError("Магазин не найден для данного домена");
      } catch (err: any) {
        console.error("Error fetching store by custom domain:", err);
        setError(err.message || "Ошибка при поиске магазина");
        setStore(null);
        setStoreType(null);
      } finally {
        setLoading(false);
      }
    };

    fetchStore();
  }, [hostname]);

  return { store, storeType, loading, error };
}
