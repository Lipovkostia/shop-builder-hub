import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface AvitoBot {
  id: string;
  store_id: string;
  name: string;
  is_active: boolean;
  mode: "smart" | "pro";
  system_prompt: string;
  lead_conditions: string[];
  escalation_rules: string[];
  completion_rules: string[];
  schedule_mode: "24/7" | "no_response" | "schedule";
  schedule_config: any;
  reactivation_messages: { delay_minutes: number; message: string }[];
  ai_model: string;
  upgrade_after_messages: number;
  upgrade_model: string | null;
  response_delay_seconds: number;
  max_responses: number | null;
  pro_seller_mode: boolean;
  telegram_notification_format: string;
  created_at: string;
  updated_at: string;
}

export interface AvitoBotChat {
  id: string;
  store_id: string;
  avito_chat_id: string;
  avito_user_id: string;
  avito_user_name: string;
  status: string;
  last_message_at: string;
  messages_count: number;
  bot_responses_count: number;
  is_escalated: boolean;
  is_lead: boolean;
  lead_data: any;
  created_at: string;
}

export interface AvitoBotMessage {
  id: string;
  chat_id: string;
  role: string;
  content: string;
  avito_message_id: string | null;
  created_at: string;
}

const AI_MODELS = [
  { id: "google/gemini-2.5-flash-lite", label: "Gemini Flash Lite 2.5", desc: "Быстрая и дешёвая. Для простых задач." },
  { id: "google/gemini-2.5-flash", label: "Gemini Flash 2.5", desc: "Баланс скорости и качества." },
  { id: "google/gemini-3-flash-preview", label: "Gemini Flash 3", desc: "Быстрая нового поколения." },
  { id: "google/gemini-2.5-pro", label: "Gemini PRO 2.5", desc: "Мощная для сложных задач." },
  { id: "google/gemini-3.1-pro-preview", label: "Gemini PRO 3.1", desc: "Самая продвинутая от Google." },
  { id: "openai/gpt-5-nano", label: "GPT 5 Nano", desc: "Дешёвая и быстрая от OpenAI." },
  { id: "openai/gpt-5-mini", label: "GPT 5 Mini", desc: "Средний баланс цена/качество." },
  { id: "openai/gpt-5", label: "GPT 5", desc: "Мощная модель от OpenAI." },
  { id: "openai/gpt-5.2", label: "GPT 5.2", desc: "Самая продвинутая от OpenAI." },
];

export { AI_MODELS };

export function useAvitoBot(storeId: string | null) {
  const { toast } = useToast();
  const [bot, setBot] = useState<AvitoBot | null>(null);
  const [chats, setChats] = useState<AvitoBotChat[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchBot = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("avito_bots")
        .select("*")
        .eq("store_id", storeId)
        .maybeSingle();
      if (error) throw error;
      setBot(data as AvitoBot | null);
    } catch (err: any) {
      console.error("Error fetching avito bot:", err);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  const fetchChats = useCallback(async () => {
    if (!storeId) return;
    try {
      const { data, error } = await (supabase as any)
        .from("avito_bot_chats")
        .select("*")
        .eq("store_id", storeId)
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      setChats((data || []) as AvitoBotChat[]);
    } catch (err: any) {
      console.error("Error fetching bot chats:", err);
    }
  }, [storeId]);

  useEffect(() => {
    fetchBot();
    fetchChats();
  }, [fetchBot, fetchChats]);

  const saveBot = useCallback(async (updates: Partial<AvitoBot>) => {
    if (!storeId) return false;
    setSaving(true);
    try {
      if (bot) {
        const { error } = await (supabase as any)
          .from("avito_bots")
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq("id", bot.id);
        if (error) throw error;
        setBot(prev => prev ? { ...prev, ...updates } : prev);
      } else {
        const { data, error } = await (supabase as any)
          .from("avito_bots")
          .insert({ store_id: storeId, ...updates })
          .select()
          .single();
        if (error) throw error;
        setBot(data as AvitoBot);
      }
      toast({ title: "Настройки бота сохранены" });
      return true;
    } catch (err: any) {
      console.error("Error saving bot:", err);
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
      return false;
    } finally {
      setSaving(false);
    }
  }, [storeId, bot, toast]);

  const toggleBot = useCallback(async (active: boolean) => {
    return saveBot({ is_active: active });
  }, [saveBot]);

  const processMessages = useCallback(async () => {
    if (!storeId) return;
    try {
      const { data, error } = await supabase.functions.invoke("avito-bot", {
        body: { action: "process_messages", store_id: storeId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Сообщения обработаны", description: `Обработано: ${data?.processed || 0}` });
      await fetchChats();
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    }
  }, [storeId, toast, fetchChats]);

  return {
    bot,
    chats,
    loading,
    saving,
    saveBot,
    toggleBot,
    processMessages,
    refetchBot: fetchBot,
    refetchChats: fetchChats,
  };
}
