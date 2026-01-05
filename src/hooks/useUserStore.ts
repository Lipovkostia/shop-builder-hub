import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Store {
  id: string;
  owner_id: string;
  subdomain: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  status: "pending" | "active" | "suspended";
  products_count: number | null;
  customers_count: number | null;
  created_at: string;
  updated_at: string;
}

export function useUserStore() {
  const { profile, loading: authLoading } = useAuth();
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserStore = useCallback(async () => {
    if (!profile?.id) {
      setStore(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .eq("owner_id", profile.id)
        .maybeSingle();

      if (error) throw error;
      setStore(data);
    } catch (error) {
      console.error("Error fetching user store:", error);
      setStore(null);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    if (!authLoading) {
      fetchUserStore();
    }
  }, [authLoading, fetchUserStore]);

  return {
    store,
    storeId: store?.id || null,
    loading: authLoading || loading,
    refetch: fetchUserStore,
  };
}

export function useStoreBySubdomain(subdomain: string | undefined) {
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!subdomain) {
      setLoading(false);
      return;
    }

    const fetchStore = async () => {
      try {
        const { data, error } = await supabase
          .from("stores")
          .select("*")
          .eq("subdomain", subdomain)
          .eq("status", "active")
          .maybeSingle();

        if (error) throw error;
        
        if (!data) {
          setError("Магазин не найден");
        } else {
          setStore(data);
        }
      } catch (err: any) {
        console.error("Error fetching store:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStore();
  }, [subdomain]);

  return { store, loading, error };
}

export function useIsStoreOwner(storeId: string | null) {
  const { profile } = useAuth();
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storeId || !profile?.id) {
      setIsOwner(false);
      setLoading(false);
      return;
    }

    const checkOwnership = async () => {
      try {
        const { data, error } = await supabase
          .from("stores")
          .select("id")
          .eq("id", storeId)
          .eq("owner_id", profile.id)
          .maybeSingle();

        if (error) throw error;
        setIsOwner(!!data);
      } catch (error) {
        console.error("Error checking store ownership:", error);
        setIsOwner(false);
      } finally {
        setLoading(false);
      }
    };

    checkOwnership();
  }, [storeId, profile?.id]);

  return { isOwner, loading };
}
