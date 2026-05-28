import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ImageReference {
  id: string;
  store_id: string | null;
  name: string;
  image_url: string;
  is_system: boolean;
  sort_order: number;
}

export function useImageReferences(storeId: string | null) {
  const [refs, setRefs] = useState<ImageReference[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("image_generation_references" as any)
      .select("*")
      .or(`is_system.eq.true${storeId ? `,store_id.eq.${storeId}` : ""}`)
      .order("is_system", { ascending: false })
      .order("sort_order", { ascending: true });
    if (error) console.error("refs load", error);
    setRefs(((data ?? []) as unknown) as ImageReference[]);
    setLoading(false);
  }, [storeId]);

  useEffect(() => { load(); }, [load]);

  const upload = async (file: File): Promise<string | null> => {
    if (!storeId) { toast.error("Не выбран магазин"); return null; }
    const ext = file.name.split(".").pop() || "png";
    const path = `references/${storeId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file, {
      contentType: file.type || "image/png",
      upsert: false,
    });
    if (error) { toast.error(error.message); return null; }
    return supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
  };

  const create = async (name: string, image_url: string) => {
    if (!storeId) { toast.error("Не выбран магазин"); return; }
    if (!name.trim()) { toast.error("Укажите название"); return; }
    if (!image_url) { toast.error("Загрузите картинку"); return; }
    const { error } = await supabase.from("image_generation_references" as any).insert({
      store_id: storeId, name: name.trim(), image_url, is_system: false,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Референс сохранён");
    await load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("image_generation_references" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Удалено");
    await load();
  };

  return { refs, loading, reload: load, upload, create, remove };
}
