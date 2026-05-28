import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ImagePrompt {
  id: string;
  store_id: string | null;
  name: string;
  prompt_template: string;
  default_aspect_ratio: string | null;
  is_system: boolean;
  sort_order: number;
}

export interface PromptInput {
  name: string;
  prompt_template: string;
  default_aspect_ratio?: string;
}

export function useImagePrompts(storeId: string | null) {
  const [prompts, setPrompts] = useState<ImagePrompt[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("image_generation_prompts" as any)
      .select("*")
      .or(`is_system.eq.true${storeId ? `,store_id.eq.${storeId}` : ""}`)
      .order("is_system", { ascending: false })
      .order("sort_order", { ascending: true });
    if (error) console.error("prompts load", error);
    setPrompts(((data ?? []) as unknown) as ImagePrompt[]);
    setLoading(false);
  }, [storeId]);

  useEffect(() => { load(); }, [load]);

  const create = async (input: PromptInput) => {
    if (!storeId) { toast.error("Не выбран магазин"); return; }
    if (!input.name.trim()) { toast.error("Укажите название"); return; }
    if (!input.prompt_template.trim()) { toast.error("Укажите текст промпта"); return; }
    const { error } = await supabase.from("image_generation_prompts" as any).insert({
      store_id: storeId,
      name: input.name.trim(),
      prompt_template: input.prompt_template,
      default_aspect_ratio: input.default_aspect_ratio ?? "1:1",
      is_system: false,
    } as any);
    if (error) { toast.error(`Не удалось сохранить: ${error.message}`); return; }
    toast.success("Промпт сохранён");
    await load();
  };

  const update = async (id: string, input: Partial<PromptInput>) => {
    const { error } = await supabase.from("image_generation_prompts" as any).update(input as any).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Обновлено");
    await load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("image_generation_prompts" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Удалено");
    await load();
  };

  return { prompts, loading, reload: load, create, update, remove };
}
