import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PlaygroundMessage {
  id: string;
  store_id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  image_urls: string[];
  model: string | null;
  created_at: string;
}

export function useImagePlayground(storeId: string | null) {
  const [messages, setMessages] = useState<PlaygroundMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!storeId) { setMessages([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("image_playground_messages" as any)
      .select("*")
      .eq("store_id", storeId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) console.error("playground load", error);
    setMessages(((data ?? []) as unknown) as PlaygroundMessage[]);
    setLoading(false);
  }, [storeId]);

  useEffect(() => { load(); }, [load]);

  const uploadAttachment = async (file: File): Promise<string | null> => {
    if (!storeId) return null;
    const ext = file.name.split(".").pop() || "png";
    const path = `playground/${storeId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file, {
      contentType: file.type || "image/png",
      upsert: false,
    });
    if (error) { toast.error(error.message); return null; }
    return supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
  };

  const send = async (params: {
    prompt: string;
    model: string;
    aspect_ratio: string;
    image_urls: string[];
  }) => {
    if (!storeId) { toast.error("Не выбран магазин"); return; }
    if (!params.prompt.trim() && params.image_urls.length === 0) {
      toast.info("Введите промпт или приложите изображение");
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-playground-image", {
        body: { ...params, store_id: storeId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? String(e));
    } finally {
      setSending(false);
    }
  };

  const clearHistory = async () => {
    if (!storeId) return;
    const { error } = await supabase.from("image_playground_messages" as any).delete().eq("store_id", storeId);
    if (error) { toast.error(error.message); return; }
    setMessages([]);
    toast.success("История очищена");
  };

  return { messages, loading, sending, send, uploadAttachment, reload: load, clearHistory };
}
