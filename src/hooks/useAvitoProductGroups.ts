import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface AvitoProductGroup {
  id: string;
  store_id: string;
  name: string;
  color: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export const AVITO_GROUP_COLORS: { value: string; label: string; cls: string }[] = [
  { value: "slate", label: "Серый", cls: "bg-slate-500" },
  { value: "emerald", label: "Зелёный", cls: "bg-emerald-500" },
  { value: "amber", label: "Янтарь", cls: "bg-amber-500" },
  { value: "rose", label: "Розовый", cls: "bg-rose-500" },
  { value: "sky", label: "Голубой", cls: "bg-sky-500" },
  { value: "violet", label: "Фиолет", cls: "bg-violet-500" },
  { value: "orange", label: "Оранж", cls: "bg-orange-500" },
  { value: "teal", label: "Бирюза", cls: "bg-teal-500" },
];

export function colorClass(color: string | undefined | null): string {
  const found = AVITO_GROUP_COLORS.find(c => c.value === color);
  return found?.cls || "bg-slate-500";
}

export function useAvitoProductGroups(storeId: string | null) {
  const { toast } = useToast();
  const [groups, setGroups] = useState<AvitoProductGroup[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchGroups = useCallback(async () => {
    if (!storeId) { setGroups([]); return; }
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("avito_product_groups")
        .select("*")
        .eq("store_id", storeId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      setGroups((data || []) as AvitoProductGroup[]);
    } catch (err: any) {
      console.error("Error fetching avito groups:", err);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  const createGroup = useCallback(async (name: string, color = "slate") => {
    if (!storeId || !name.trim()) return null;
    try {
      const nextOrder = groups.length > 0 ? Math.max(...groups.map(g => g.sort_order)) + 1 : 0;
      const { data, error } = await (supabase as any)
        .from("avito_product_groups")
        .insert({ store_id: storeId, name: name.trim(), color, sort_order: nextOrder })
        .select()
        .single();
      if (error) throw error;
      setGroups(prev => [...prev, data as AvitoProductGroup]);
      toast({ title: `Группа «${name.trim()}» создана` });
      return data as AvitoProductGroup;
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
      return null;
    }
  }, [storeId, groups, toast]);

  const updateGroup = useCallback(async (id: string, patch: Partial<Pick<AvitoProductGroup, "name" | "color" | "sort_order">>) => {
    try {
      const { error } = await (supabase as any)
        .from("avito_product_groups")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      setGroups(prev => prev.map(g => g.id === id ? { ...g, ...patch } as AvitoProductGroup : g));
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    }
  }, [toast]);

  const deleteGroup = useCallback(async (id: string) => {
    try {
      // Clear group_id on all feed products referencing this group
      await (supabase as any)
        .from("avito_feed_products")
        .update({ group_id: null })
        .eq("group_id", id);
      const { error } = await (supabase as any)
        .from("avito_product_groups")
        .delete()
        .eq("id", id);
      if (error) throw error;
      setGroups(prev => prev.filter(g => g.id !== id));
      toast({ title: "Группа удалена" });
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    }
  }, [toast]);

  return { groups, loading, createGroup, updateGroup, deleteGroup, refetch: fetchGroups };
}
