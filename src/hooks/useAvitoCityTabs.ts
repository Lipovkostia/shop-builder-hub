import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { uniqueifyTitle, uniqueifyDescription, applyMarkup } from "@/lib/avitoUniqueify";

export interface AvitoCityTab {
  id: string;
  store_id: string;
  name: string;
  city: string | null;
  address: string | null;
  markup_percent: number;
  is_default: boolean;
  sort_order: number;
  spreadsheet_id: string | null;
  spreadsheet_url: string | null;
  created_at: string;
  updated_at: string;
}

const ACTIVE_KEY = (storeId: string) => `avito_active_city_tab_${storeId}`;

export function useAvitoCityTabs(storeId: string | null) {
  const [tabs, setTabs] = useState<AvitoCityTab[]>([]);
  const [activeTabId, setActiveTabIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const setActiveTabId = useCallback(
    (id: string | null) => {
      setActiveTabIdState(id);
      if (storeId && id) localStorage.setItem(ACTIVE_KEY(storeId), id);
    },
    [storeId],
  );

  const fetchTabs = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("avito_city_tabs")
        .select("*")
        .eq("store_id", storeId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      let list = (data || []) as AvitoCityTab[];

      // Если вкладок нет — создаём дефолтную автоматом.
      if (list.length === 0) {
        const { data: created, error: cErr } = await (supabase as any)
          .from("avito_city_tabs")
          .insert({ store_id: storeId, name: "Основная", markup_percent: 0, is_default: true, sort_order: 0 })
          .select()
          .single();
        if (!cErr && created) list = [created as AvitoCityTab];
      }

      setTabs(list);

      const saved = localStorage.getItem(ACTIVE_KEY(storeId));
      const active = list.find((t) => t.id === saved) || list[0];
      setActiveTabIdState(active?.id || null);
    } catch (e: any) {
      console.error("avito_city_tabs fetch error", e);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    fetchTabs();
  }, [fetchTabs]);

  const createTab = useCallback(
    async (input: {
      name: string;
      city?: string;
      address?: string;
      markupPercent?: number;
      sourceTabId?: string | null;
    }) => {
      if (!storeId) return null;
      try {
        const { data: created, error } = await (supabase as any)
          .from("avito_city_tabs")
          .insert({
            store_id: storeId,
            name: input.name.trim(),
            city: input.city?.trim() || null,
            address: input.address?.trim() || null,
            markup_percent: input.markupPercent ?? 30,
            is_default: false,
            sort_order: tabs.length,
          })
          .select()
          .single();
        if (error) throw error;
        const newTab = created as AvitoCityTab;

        // Дублирование карточек из исходной вкладки
        if (input.sourceTabId) {
          const { data: src } = await (supabase as any)
            .from("avito_city_listings")
            .select("*")
            .eq("tab_id", input.sourceTabId);
          const sourceListings = (src || []) as any[];

          if (sourceListings.length > 0) {
            // Подтянем оригинальные продукты для title/description/price
            const pids = sourceListings.map((l) => l.product_id);
            const { data: prods } = await (supabase as any)
              .from("products")
              .select("id, name, description, price")
              .in("id", pids);
            const prodMap = new Map((prods || []).map((p: any) => [p.id, p]));

            const city = newTab.city || newTab.name;
            const rows = sourceListings.map((l) => {
              const p: any = prodMap.get(l.product_id) || {};
              const baseTitle = l.title_override || p.name || "";
              const baseDesc = l.description_override || p.description || "";
              const basePrice =
                l.price_override != null ? Number(l.price_override) : Number(p.price) || 0;
              const seed = `${newTab.id}:${l.product_id}`;
              return {
                tab_id: newTab.id,
                store_id: storeId,
                product_id: l.product_id,
                title_override: uniqueifyTitle(baseTitle, city, seed),
                description_override: uniqueifyDescription(baseDesc, city, seed),
                price_override: applyMarkup(basePrice, newTab.markup_percent),
                photo_order: l.photo_order
                  ? [...(l.photo_order as number[]).slice(1), (l.photo_order as number[])[0]]
                  : null,
                avito_params: l.avito_params || null,
                group_id: l.group_id || null,
              };
            });

            // Чанками по 200
            for (let i = 0; i < rows.length; i += 200) {
              const chunk = rows.slice(i, i + 200);
              const { error: insErr } = await (supabase as any)
                .from("avito_city_listings")
                .insert(chunk);
              if (insErr) throw insErr;
            }
          }
        }

        toast.success(`Вкладка «${newTab.name}» создана`);
        await fetchTabs();
        setActiveTabId(newTab.id);
        return newTab;
      } catch (e: any) {
        console.error(e);
        toast.error(e?.message || "Не удалось создать вкладку");
        return null;
      }
    },
    [storeId, tabs.length, fetchTabs, setActiveTabId],
  );

  const updateTab = useCallback(
    async (id: string, patch: Partial<AvitoCityTab>) => {
      try {
        const { error } = await (supabase as any)
          .from("avito_city_tabs")
          .update({ ...patch, updated_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
        setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } as AvitoCityTab : t)));
      } catch (e: any) {
        toast.error(e?.message || "Не удалось обновить вкладку");
      }
    },
    [],
  );

  const deleteTab = useCallback(
    async (id: string) => {
      const tab = tabs.find((t) => t.id === id);
      if (!tab) return;
      if (tab.is_default) {
        toast.error("Нельзя удалить основную вкладку");
        return;
      }
      if (!confirm(`Удалить вкладку «${tab.name}» вместе со всеми карточками?`)) return;
      try {
        const { error } = await (supabase as any).from("avito_city_tabs").delete().eq("id", id);
        if (error) throw error;
        toast.success("Вкладка удалена");
        await fetchTabs();
      } catch (e: any) {
        toast.error(e?.message || "Не удалось удалить вкладку");
      }
    },
    [tabs, fetchTabs],
  );

  const activeTab = tabs.find((t) => t.id === activeTabId) || null;

  return {
    tabs,
    activeTab,
    activeTabId,
    setActiveTabId,
    loading,
    createTab,
    updateTab,
    deleteTab,
    refetch: fetchTabs,
  };
}
