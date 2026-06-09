import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AvitoAccount {
  id: string;
  store_id: string;
  client_id: string;
  client_secret: string;
  avito_user_id: number | null;
  profile_name: string | null;
  label: string | null;
  is_default: boolean;
  sort_order: number;
  feed_defaults: any;
  last_sync: string | null;
  created_at: string;
  updated_at: string;
}

const ACTIVE_KEY = (storeId: string) => `avito_active_account_${storeId}`;

export function useAvitoAccounts(storeId: string | null) {
  const [accounts, setAccounts] = useState<AvitoAccount[]>([]);
  const [activeAccountId, setActiveAccountIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const setActiveAccountId = useCallback(
    (id: string | null) => {
      setActiveAccountIdState(id);
      if (storeId && id) localStorage.setItem(ACTIVE_KEY(storeId), id);
    },
    [storeId],
  );

  const fetchAccounts = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("avito_accounts")
        .select("*")
        .eq("store_id", storeId)
        .order("is_default", { ascending: false })
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      const list = (data || []) as AvitoAccount[];
      setAccounts(list);
      const saved = localStorage.getItem(ACTIVE_KEY(storeId));
      const active =
        list.find((a) => a.id === saved) ||
        list.find((a) => a.is_default) ||
        list[0] ||
        null;
      setActiveAccountIdState(active?.id || null);
    } catch (e: any) {
      console.error("avito_accounts fetch error", e);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const createAccount = useCallback(
    async (label: string) => {
      if (!storeId) return null;
      try {
        const { data, error } = await (supabase as any)
          .from("avito_accounts")
          .insert({
            store_id: storeId,
            client_id: "",
            client_secret: "",
            label: (label || "").trim() || "Новый аккаунт",
            is_default: false,
            sort_order: accounts.length,
          })
          .select()
          .single();
        if (error) throw error;
        const newAcc = data as AvitoAccount;
        toast.success(`Аккаунт «${newAcc.label}» создан`);
        await fetchAccounts();
        setActiveAccountId(newAcc.id);
        return newAcc;
      } catch (e: any) {
        console.error(e);
        toast.error(e?.message || "Не удалось создать аккаунт");
        return null;
      }
    },
    [storeId, accounts.length, fetchAccounts, setActiveAccountId],
  );

  const updateAccount = useCallback(
    async (id: string, patch: Partial<AvitoAccount>) => {
      try {
        const { error } = await (supabase as any)
          .from("avito_accounts")
          .update({ ...patch, updated_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
        setAccounts((prev) =>
          prev.map((a) => (a.id === id ? ({ ...a, ...patch } as AvitoAccount) : a)),
        );
      } catch (e: any) {
        toast.error(e?.message || "Не удалось обновить аккаунт");
      }
    },
    [],
  );

  const setDefaultAccount = useCallback(
    async (id: string) => {
      if (!storeId) return;
      try {
        await (supabase as any)
          .from("avito_accounts")
          .update({ is_default: false })
          .eq("store_id", storeId);
        const { error } = await (supabase as any)
          .from("avito_accounts")
          .update({ is_default: true })
          .eq("id", id);
        if (error) throw error;
        toast.success("Аккаунт установлен основным");
        await fetchAccounts();
      } catch (e: any) {
        toast.error(e?.message || "Не удалось установить основной аккаунт");
      }
    },
    [storeId, fetchAccounts],
  );

  const deleteAccount = useCallback(
    async (id: string) => {
      const acc = accounts.find((a) => a.id === id);
      if (!acc) return;
      if (accounts.length <= 1) {
        toast.error("Нельзя удалить единственный аккаунт");
        return;
      }
      if (
        !confirm(
          `Удалить аккаунт «${acc.label || acc.profile_name || "Аккаунт"}»? Все его города и карточки фида будут удалены.`,
        )
      )
        return;
      try {
        const { error } = await (supabase as any)
          .from("avito_accounts")
          .delete()
          .eq("id", id);
        if (error) throw error;
        toast.success("Аккаунт удалён");
        // If we deleted active, switch to default
        if (activeAccountId === id) {
          const next =
            accounts.find((a) => a.id !== id && a.is_default) ||
            accounts.find((a) => a.id !== id);
          setActiveAccountId(next?.id || null);
        }
        await fetchAccounts();
      } catch (e: any) {
        toast.error(e?.message || "Не удалось удалить аккаунт");
      }
    },
    [accounts, activeAccountId, fetchAccounts, setActiveAccountId],
  );

  const activeAccount = accounts.find((a) => a.id === activeAccountId) || null;

  return {
    accounts,
    activeAccount,
    activeAccountId,
    setActiveAccountId,
    loading,
    createAccount,
    updateAccount,
    setDefaultAccount,
    deleteAccount,
    refetch: fetchAccounts,
  };
}
