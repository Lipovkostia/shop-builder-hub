import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CustomDomainStore {
  id: string;
  subdomain: string;
  storeType: "retail" | "wholesale";
}

// Platform domains that should use standard routing
const PLATFORM_DOMAINS = [
  ".lovable.app",
  ".lovable.dev",
  ".lovableproject.com",
  "localhost",
  "127.0.0.1",
];

export function isPlatformDomain(hostname: string): boolean {
  return PLATFORM_DOMAINS.some(
    (domain) => hostname === domain || hostname.endsWith(domain)
  );
}

/**
 * Resolves current hostname to determine if it's a custom domain
 * and which store type (retail or wholesale) it belongs to.
 */
export function useCustomDomainResolver() {
  const [store, setStore] = useState<CustomDomainStore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCustomDomain, setIsCustomDomain] = useState(false);

  useEffect(() => {
    const hostname = typeof window !== "undefined" ? window.location.hostname : "";

    // Check if it's a platform domain
    if (isPlatformDomain(hostname)) {
      setIsCustomDomain(false);
      setLoading(false);
      return;
    }

    // It's a custom domain, try to find the store
    setIsCustomDomain(true);

    const resolveStore = async () => {
      try {
        // First, check for wholesale custom domain
        const { data: wholesaleStore, error: wholesaleError } = await supabase
          .from("stores")
          .select("id, subdomain")
          .eq("wholesale_custom_domain", hostname)
          .eq("status", "active")
          .eq("wholesale_enabled", true)
          .maybeSingle();

        if (wholesaleError) throw wholesaleError;

        if (wholesaleStore) {
          setStore({
            id: wholesaleStore.id,
            subdomain: wholesaleStore.subdomain,
            storeType: "wholesale",
          });
          setLoading(false);
          return;
        }

        // Then, check for retail custom domain
        const { data: retailStore, error: retailError } = await supabase
          .from("stores")
          .select("id, subdomain")
          .eq("custom_domain", hostname)
          .eq("status", "active")
          .eq("retail_enabled", true)
          .maybeSingle();

        if (retailError) throw retailError;

        if (retailStore) {
          setStore({
            id: retailStore.id,
            subdomain: retailStore.subdomain,
            storeType: "retail",
          });
          setLoading(false);
          return;
        }

        // No store found for this domain
        setError("Магазин не найден для этого домена");
        setLoading(false);
      } catch (err) {
        console.error("Error resolving custom domain:", err);
        setError("Ошибка загрузки магазина");
        setLoading(false);
      }
    };

    resolveStore();
  }, []);

  return {
    store,
    loading,
    error,
    isCustomDomain,
  };
}
