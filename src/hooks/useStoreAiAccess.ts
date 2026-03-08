import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface StoreAiAccess {
  id?: string;
  store_id: string;
  is_unlocked: boolean;
  seo_enabled: boolean;
  avito_descriptions_enabled: boolean;
  avito_bot_enabled: boolean;
  ai_assistant_enabled: boolean;
  product_descriptions_enabled: boolean;
  unlocked_at: string | null;
}

const defaultAccess: Omit<StoreAiAccess, "store_id"> = {
  is_unlocked: false,
  seo_enabled: true,
  avito_descriptions_enabled: true,
  avito_bot_enabled: true,
  ai_assistant_enabled: true,
  product_descriptions_enabled: true,
  unlocked_at: null,
};

export function useStoreAiAccess(storeId: string | null) {
  const [access, setAccess] = useState<StoreAiAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);

  const fetchAccess = useCallback(async () => {
    if (!storeId) {
      setAccess(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("store_ai_access")
        .select("*")
        .eq("store_id", storeId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setAccess({
          id: data.id,
          store_id: data.store_id,
          is_unlocked: data.is_unlocked,
          seo_enabled: data.seo_enabled,
          avito_descriptions_enabled: data.avito_descriptions_enabled,
          avito_bot_enabled: data.avito_bot_enabled,
          ai_assistant_enabled: data.ai_assistant_enabled,
          product_descriptions_enabled: data.product_descriptions_enabled,
          unlocked_at: data.unlocked_at,
        });
      } else {
        setAccess({ store_id: storeId, ...defaultAccess });
      }
    } catch (err) {
      console.error("Error fetching AI access:", err);
      setAccess({ store_id: storeId, ...defaultAccess });
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    fetchAccess();
  }, [fetchAccess]);

  const verifyPassword = useCallback(
    async (password: string): Promise<boolean> => {
      if (!storeId) return false;
      setVerifying(true);
      try {
        const { data, error } = await supabase.rpc("verify_ai_password", {
          _password: password,
        });
        if (error) throw error;
        if (!data) return false;

        // Password correct — upsert store_ai_access
        const { data: existing } = await supabase
          .from("store_ai_access")
          .select("id")
          .eq("store_id", storeId)
          .maybeSingle();

        if (existing) {
          await supabase
            .from("store_ai_access")
            .update({
              is_unlocked: true,
              unlocked_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("store_id", storeId);
        } else {
          await supabase.from("store_ai_access").insert({
            store_id: storeId,
            is_unlocked: true,
            unlocked_at: new Date().toISOString(),
          });
        }

        await fetchAccess();
        return true;
      } catch (err) {
        console.error("Error verifying AI password:", err);
        return false;
      } finally {
        setVerifying(false);
      }
    },
    [storeId, fetchAccess]
  );

  const updateFeature = useCallback(
    async (feature: string, enabled: boolean) => {
      if (!storeId) return;
      try {
        const { data: existing } = await supabase
          .from("store_ai_access")
          .select("id")
          .eq("store_id", storeId)
          .maybeSingle();

        const updateData: Record<string, unknown> = {
          [feature]: enabled,
          updated_at: new Date().toISOString(),
        };

        if (existing) {
          await supabase
            .from("store_ai_access")
            .update(updateData)
            .eq("store_id", storeId);
        } else {
          await supabase.from("store_ai_access").insert({
            store_id: storeId,
            ...updateData,
          });
        }

        await fetchAccess();
      } catch (err) {
        console.error("Error updating AI feature:", err);
      }
    },
    [storeId, fetchAccess]
  );

  const disableAi = useCallback(async () => {
    if (!storeId) return;
    try {
      await supabase
        .from("store_ai_access")
        .update({
          is_unlocked: false,
          unlocked_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("store_id", storeId);
      await fetchAccess();
    } catch (err) {
      console.error("Error disabling AI:", err);
    }
  }, [storeId, fetchAccess]);

  return {
    access,
    loading,
    verifying,
    verifyPassword,
    updateFeature,
    disableAi,
    refetch: fetchAccess,
    isFeatureEnabled: (feature: string) => {
      if (!access || !access.is_unlocked) return false;
      switch (feature) {
        case "seo": return access.seo_enabled;
        case "avito_descriptions": return access.avito_descriptions_enabled;
        case "avito_bot": return access.avito_bot_enabled;
        case "ai_assistant": return access.ai_assistant_enabled;
        case "product_descriptions": return access.product_descriptions_enabled;
        default: return false;
      }
    },
  };
}
