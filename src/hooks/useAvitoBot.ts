import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface AvitoBot {
  id: string;
  store_id: string;
  avito_account_id: string | null;
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
  telegram_bot_token: string | null;
  telegram_chat_id: string | null;
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
  { id: "openai/gpt-4.1-nano", label: "GPT 4.1 Nano", desc: "Самая дешёвая и быстрая от OpenAI." },
  { id: "openai/gpt-4.1-mini", label: "GPT 4.1 Mini", desc: "Лучшее соотношение цены/качества." },
  { id: "openai/gpt-4.1", label: "GPT 4.1", desc: "Мощная модель от OpenAI." },
  { id: "openai/gpt-4o-mini", label: "GPT 4o Mini", desc: "Быстрая мультимодальная модель." },
  { id: "openai/o4-mini", label: "GPT o4 Mini", desc: "Модель с цепочкой рассуждений. В 3-6 раз дороже mini." },
  { id: "openai/gpt-5.2", label: "GPT 5.2", desc: "Самая продвинутая от OpenAI." },
  { id: "google/gemini-2.5-flash-lite", label: "Gemini Flash Lite 2.5", desc: "Быстрая и дешёвая." },
  { id: "google/gemini-2.5-flash", label: "Gemini Flash 2.5", desc: "Баланс скорости и качества." },
  { id: "google/gemini-3-flash-preview", label: "Gemini Flash 3", desc: "Быстрая нового поколения." },
  { id: "google/gemini-2.5-pro", label: "Gemini PRO 2.5", desc: "Мощная для сложных задач." },
  { id: "anthropic/claude-sonnet-4.6", label: "Claude Sonnet 4.6", desc: "Сильная модель от Anthropic." },
  { id: "anthropic/claude-haiku-4.5", label: "Claude Haiku 4.5", desc: "Быстрая и дешёвая от Anthropic." },
  { id: "deepseek/deepseek-r1", label: "DeepSeek R1", desc: "Модель с рассуждениями." },
  { id: "deepseek/deepseek-v3", label: "DeepSeek V3", desc: "Универсальная модель." },
  { id: "qwen/qwen3-235b", label: "Qwen3 235B", desc: "Крупная открытая модель." },
  { id: "moonshotai/kimi-k2.5", label: "Kimi K2.5", desc: "Продвинутая модель от Moonshot." },
];

export { AI_MODELS };

export function useAvitoBots(storeId: string | null) {
  const { toast } = useToast();
  const [bots, setBots] = useState<AvitoBot[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchBots = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("avito_bots")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setBots((data || []) as AvitoBot[]);
    } catch (err: any) {
      console.error("Error fetching avito bots:", err);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    fetchBots();
  }, [fetchBots]);

  const createBot = useCallback(async (name: string, avitoAccountId?: string | null) => {
    if (!storeId) return null;
    setSaving(true);
    try {
      const { data, error } = await (supabase as any)
        .from("avito_bots")
        .insert({
          store_id: storeId,
          name,
          avito_account_id: avitoAccountId || null,
        })
        .select()
        .single();
      if (error) throw error;
      setBots(prev => [...prev, data as AvitoBot]);
      toast({ title: "Бот создан" });
      return data as AvitoBot;
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
      return null;
    } finally {
      setSaving(false);
    }
  }, [storeId, toast]);

  const duplicateBot = useCallback(async (botId: string) => {
    if (!storeId) return null;
    const source = bots.find(b => b.id === botId);
    if (!source) return null;
    setSaving(true);
    try {
      const { id, created_at, updated_at, ...rest } = source as any;
      const { data, error } = await (supabase as any)
        .from("avito_bots")
        .insert({
          ...rest,
          store_id: storeId,
          name: `${source.name} (копия)`,
          is_active: false,
        })
        .select()
        .single();
      if (error) throw error;

      // Copy QA pairs
      const { data: qaItems } = await (supabase as any)
        .from("avito_bot_qa")
        .select("*")
        .eq("bot_id", botId);
      if (qaItems?.length) {
        await (supabase as any).from("avito_bot_qa").insert(
          qaItems.map((q: any) => ({ bot_id: data.id, question: q.question, answer: q.answer, match_mode: q.match_mode, is_active: q.is_active, sort_order: q.sort_order }))
        );
      }

      // Copy sales stages
      const { data: stages } = await (supabase as any)
        .from("avito_bot_sales_stages")
        .select("*")
        .eq("bot_id", botId);
      if (stages?.length) {
        await (supabase as any).from("avito_bot_sales_stages").insert(
          stages.map((s: any) => ({ bot_id: data.id, name: s.name, instructions: s.instructions, action_type: s.action_type, is_active: s.is_active, sort_order: s.sort_order }))
        );
      }

      setBots(prev => [...prev, data as AvitoBot]);
      toast({ title: "Робот дублирован" });
      return data as AvitoBot;
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
      return null;
    } finally {
      setSaving(false);
    }
  }, [storeId, bots, toast]);

  const saveBot = useCallback(async (botId: string, updates: Partial<AvitoBot>) => {
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("avito_bots")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", botId);
      if (error) throw error;
      setBots(prev => prev.map(b => b.id === botId ? { ...b, ...updates } : b));
      toast({ title: "Настройки бота сохранены" });
      return true;
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
      return false;
    } finally {
      setSaving(false);
    }
  }, [toast]);

  const deleteBot = useCallback(async (botId: string) => {
    try {
      const { error } = await (supabase as any)
        .from("avito_bots")
        .delete()
        .eq("id", botId);
      if (error) throw error;
      setBots(prev => prev.filter(b => b.id !== botId));
      toast({ title: "Бот удалён" });
      return true;
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
      return false;
    }
  }, [toast]);

  const toggleBot = useCallback(async (botId: string, active: boolean) => {
    return saveBot(botId, { is_active: active } as any);
  }, [saveBot]);

  const processMessages = useCallback(async (botId: string) => {
    if (!storeId) return;
    try {
      const { data, error } = await supabase.functions.invoke("avito-bot", {
        body: { action: "process_messages", store_id: storeId, bot_id: botId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Сообщения обработаны", description: `Обработано: ${data?.processed || 0}` });
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    }
  }, [storeId, toast]);

  const fetchChats = useCallback(async (botId?: string) => {
    if (!storeId) return [];
    try {
      const { data, error } = await (supabase as any)
        .from("avito_bot_chats")
        .select("*")
        .eq("store_id", storeId)
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      return (data || []) as AvitoBotChat[];
    } catch (err: any) {
      console.error("Error fetching bot chats:", err);
      return [];
    }
  }, [storeId]);

  return {
    bots,
    loading,
    saving,
    createBot,
    duplicateBot,
    saveBot,
    deleteBot,
    toggleBot,
    processMessages,
    fetchChats,
    refetch: fetchBots,
  };
}

// Keep backward compat
export function useAvitoBot(storeId: string | null) {
  const multi = useAvitoBots(storeId);
  const bot = multi.bots[0] || null;
  const [chats, setChats] = useState<AvitoBotChat[]>([]);

  useEffect(() => {
    if (storeId) {
      multi.fetchChats().then(setChats);
    }
  }, [storeId]);

  return {
    bot,
    chats,
    loading: multi.loading,
    saving: multi.saving,
    saveBot: (updates: Partial<AvitoBot>) => bot ? multi.saveBot(bot.id, updates) : Promise.resolve(false),
    toggleBot: (active: boolean) => bot ? multi.toggleBot(bot.id, active) : Promise.resolve(false),
    processMessages: () => bot ? multi.processMessages(bot.id) : Promise.resolve(),
    refetchBot: multi.refetch,
    refetchChats: () => multi.fetchChats().then(setChats),
  };
}
