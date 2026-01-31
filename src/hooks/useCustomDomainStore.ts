import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Store {
  id: string;
  subdomain: string;
  name: string;
  custom_domain: string | null;
  wholesale_custom_domain: string | null;
}

interface UseCustomDomainStoreResult {
  store: Store | null;
  storeType: "retail" | "wholesale" | null;
  subdomain: string | null;
  loading: boolean;
  error: string | null;
}

export function useCustomDomainStore(hostname: string): UseCustomDomainStoreResult {
  const [store, setStore] = useState<Store | null>(null);
  const [storeType, setStoreType] = useState<"retail" | "wholesale" | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function findStore() {
      setLoading(true);
      setError(null);

      try {
        // First try to find by retail custom_domain
        const { data: retailStore, error: retailError } = await supabase
          .from("stores")
          .select("id, subdomain, name, custom_domain, wholesale_custom_domain")
          .eq("custom_domain", hostname)
          .eq("status", "active")
          .eq("retail_enabled", true)
          .maybeSingle();

        if (retailStore) {
          setStore(retailStore);
          setStoreType("retail");
          setLoading(false);
          return;
        }

        // Then try to find by wholesale custom_domain
        const { data: wholesaleStore, error: wholesaleError } = await supabase
          .from("stores")
          .select("id, subdomain, name, custom_domain, wholesale_custom_domain")
          .eq("wholesale_custom_domain", hostname)
          .eq("status", "active")
          .eq("wholesale_enabled", true)
          .maybeSingle();

        if (wholesaleStore) {
          setStore(wholesaleStore);
          setStoreType("wholesale");
          setLoading(false);
          return;
        }

        // Store not found
        setStore(null);
        setStoreType(null);
        setError("Магазин не найден для этого домена");
      } catch (err) {
        console.error("Error finding store by custom domain:", err);
        setError("Ошибка при поиске магазина");
      } finally {
        setLoading(false);
      }
    }

    if (hostname) {
      findStore();
    }
  }, [hostname]);

  return {
    store,
    storeType,
    subdomain: store?.subdomain || null,
    loading,
    error,
  };
}
