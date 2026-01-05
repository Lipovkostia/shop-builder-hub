import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface MoyskladAccount {
  id: string;
  store_id: string;
  login: string;
  password: string;
  name: string;
  last_sync: string | null;
  created_at: string;
  updated_at: string;
}

export function useMoyskladAccounts(storeId: string | null) {
  const [accounts, setAccounts] = useState<MoyskladAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAccounts = useCallback(async () => {
    if (!storeId) {
      setAccounts([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("moysklad_accounts")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error("Error fetching MoySklad accounts:", error);
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const createAccount = useCallback(
    async (account: Omit<MoyskladAccount, "id" | "created_at" | "updated_at">) => {
      if (!storeId) return null;

      try {
        const { data, error } = await supabase
          .from("moysklad_accounts")
          .insert({
            store_id: storeId,
            login: account.login,
            password: account.password,
            name: account.name,
            last_sync: account.last_sync,
          })
          .select()
          .single();

        if (error) throw error;
        setAccounts((prev) => [...prev, data]);
        return data;
      } catch (error) {
        console.error("Error creating MoySklad account:", error);
        return null;
      }
    },
    [storeId]
  );

  const updateAccount = useCallback(
    async (accountId: string, updates: Partial<MoyskladAccount>) => {
      try {
        const { data, error } = await supabase
          .from("moysklad_accounts")
          .update(updates)
          .eq("id", accountId)
          .select()
          .single();

        if (error) throw error;
        setAccounts((prev) =>
          prev.map((acc) => (acc.id === accountId ? data : acc))
        );
        return data;
      } catch (error) {
        console.error("Error updating MoySklad account:", error);
        return null;
      }
    },
    []
  );

  const deleteAccount = useCallback(async (accountId: string) => {
    try {
      const { error } = await supabase
        .from("moysklad_accounts")
        .delete()
        .eq("id", accountId);

      if (error) throw error;
      setAccounts((prev) => prev.filter((acc) => acc.id !== accountId));
      return true;
    } catch (error) {
      console.error("Error deleting MoySklad account:", error);
      return false;
    }
  }, []);

  return {
    accounts,
    loading,
    createAccount,
    updateAccount,
    deleteAccount,
    refetch: fetchAccounts,
  };
}
