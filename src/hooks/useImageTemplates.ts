import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ImageTemplate {
  id: string;
  store_id: string | null;
  name: string;
  prompt_template: string;
  default_aspect_ratio: string | null;
  is_system: boolean;
  sort_order: number;
}

export function useImageTemplates(storeId: string | null) {
  const [templates, setTemplates] = useState<ImageTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("image_generation_templates" as any)
        .select("*")
        .or(`is_system.eq.true${storeId ? `,store_id.eq.${storeId}` : ""}`)
        .order("is_system", { ascending: false })
        .order("sort_order", { ascending: true });
      if (error) throw error;
      setTemplates((data ?? []) as unknown as ImageTemplate[]);
    } catch (e: any) {
      console.error("load templates", e);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (input: { name: string; prompt_template: string; default_aspect_ratio?: string }) => {
    if (!storeId) return;
    const { error } = await supabase.from("image_generation_templates" as any).insert({
      store_id: storeId,
      name: input.name,
      prompt_template: input.prompt_template,
      default_aspect_ratio: input.default_aspect_ratio ?? "1:1",
      is_system: false,
    } as any);
    if (error) {
      toast.error(`Не удалось создать шаблон: ${error.message}`);
      return;
    }
    toast.success("Шаблон создан");
    await load();
  };

  const update = async (id: string, input: Partial<Pick<ImageTemplate, "name" | "prompt_template" | "default_aspect_ratio">>) => {
    const { error } = await supabase.from("image_generation_templates" as any).update(input as any).eq("id", id);
    if (error) {
      toast.error(`Не удалось обновить: ${error.message}`);
      return;
    }
    toast.success("Шаблон обновлён");
    await load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("image_generation_templates" as any).delete().eq("id", id);
    if (error) {
      toast.error(`Не удалось удалить: ${error.message}`);
      return;
    }
    toast.success("Шаблон удалён");
    await load();
  };

  return { templates, loading, reload: load, create, update, remove };
}
