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

const STORAGE_KEY = "image_playground_messages_v1";

function readMessages(storeId: string | null): PlaygroundMessage[] {
  if (!storeId || typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}:${storeId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeMessages(storeId: string, messages: PlaygroundMessage[]) {
  localStorage.setItem(`${STORAGE_KEY}:${storeId}`, JSON.stringify(messages.slice(-200)));
}

export function useImagePlayground(storeId: string | null) {
  const [messages, setMessages] = useState<PlaygroundMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setMessages(readMessages(storeId));
    setLoading(false);
  }, [storeId]);

  useEffect(() => { load(); }, [load]);

  const saveMessages = useCallback((next: PlaygroundMessage[]) => {
    if (storeId) writeMessages(storeId, next);
    setMessages(next);
  }, [storeId]);

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

    const userMessage: PlaygroundMessage = {
      id: crypto.randomUUID(),
      store_id: storeId,
      user_id: "local",
      role: "user",
      content: params.prompt,
      image_urls: params.image_urls,
      model: params.model,
      created_at: new Date().toISOString(),
    };

    setSending(true);
    const withUser = [...messages, userMessage];
    saveMessages(withUser);
    try {
      const { data, error } = await supabase.functions.invoke("generate-playground-image", {
        body: { ...params, store_id: storeId },
      });
      if (error) throw error;
      const payload = data as { error?: string; url?: string; model?: string } | null;
      if (payload?.error) throw new Error(payload.error);
      const assistantMessage: PlaygroundMessage = {
        id: crypto.randomUUID(),
        store_id: storeId,
        user_id: "local",
        role: "assistant",
        content: "",
        image_urls: payload?.url ? [payload.url] : [],
        model: payload?.model ?? params.model,
        created_at: new Date().toISOString(),
      };
      saveMessages([...withUser, assistantMessage]);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      const assistantMessage: PlaygroundMessage = {
        id: crypto.randomUUID(),
        store_id: storeId,
        user_id: "local",
        role: "assistant",
        content: `Ошибка: ${message}`,
        image_urls: [],
        model: params.model,
        created_at: new Date().toISOString(),
      };
      saveMessages([...withUser, assistantMessage]);
      toast.error(message);
    } finally {
      setSending(false);
    }
  };

  const clearHistory = async () => {
    if (!storeId) return;
    writeMessages(storeId, []);
    setMessages([]);
    toast.success("История очищена");
  };

  return { messages, loading, sending, send, uploadAttachment, reload: load, clearHistory };
}