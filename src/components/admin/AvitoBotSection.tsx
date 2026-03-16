import React, { useState, useEffect, useRef, useCallback } from "react";
import { Bot, MessageCircle, Settings, Users, Sparkles, Power, Save, Plus, Trash2, Clock, Shield, Bell, Zap, ChevronRight, RefreshCw, KeyRound, ArrowLeft, Edit, HelpCircle, PlayCircle, Send, Loader2, Package, MessageSquarePlus, History, Activity, BarChart3, AlertTriangle, CheckCircle2, XCircle, Hand, User, FileText, ListChecks, Filter, Repeat, ShoppingCart, GripVertical, ArrowDown, ArrowUp, Copy, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAvitoBots, AI_MODELS, AvitoBot, AvitoBotChat } from "@/hooks/useAvitoBot";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { TelegramIcon } from "@/components/icons/TelegramIcon";
import { AvitoBotSmartSetup, SmartSetupData, buildSystemPromptFromSmartSetup } from "./AvitoBotSmartSetup";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

// Generate a stable 6-digit number from a UUID
function getBotNumber(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  return String(Math.abs(hash) % 900000 + 100000);
}

interface AvitoBotSectionProps {
  storeId: string | null;
}

interface AvitoAccount {
  id: string;
  store_id: string;
  client_id: string;
  client_secret: string;
  avito_user_id: number | null;
  profile_name: string | null;
}

interface QAItem {
  id: string;
  bot_id: string;
  question: string;
  answer: string;
  match_mode: "exact" | "fuzzy";
  is_active: boolean;
  sort_order: number;
}

interface AvitoItem {
  id: string;
  title: string;
  price: number;
  url: string;
  image: string;
  category: string;
}

interface VseGPTModel {
  id: string;
  name: string;
  owned_by: string;
}

interface DashboardStats {
  bots_total: number;
  bots_active: number;
  accounts_total: number;
  accounts_connected: number;
  chats_total: number;
  messages_total: number;
  bot_responses_total: number;
  leads_total: number;
  escalated_total: number;
  total_prompt_tokens?: number;
  total_completion_tokens?: number;
  total_tokens?: number;
  total_cost?: number;
  total_requests?: number;
  avg_cost_per_message?: number;
}

interface UsageLog {
  id: string;
  bot_id: string;
  chat_id: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost: number;
  action_type: string;
  created_at: string;
}

interface SalesStage {
  id: string;
  bot_id: string;
  name: string;
  instructions: string;
  action_type: string;
  sort_order: number;
  is_active: boolean;
}

type TopLevel = "dashboard" | "bots" | "accounts" | "chats";
type BotSection = "general" | "prompt" | "qa" | "leads" | "escalation" | "completion" | "schedule" | "reactivation" | "model" | "delay" | "limits" | "pro" | "notifications" | "telegram" | "stop_command" | "ad_filter" | "handoff" | "debug" | "usage_stats" | "sales" | "ai_settings";

const botSidebarGroups: { label: string; items: { id: BotSection; label: string; icon: React.ElementType; important?: boolean }[] }[] = [
  {
    label: "⚡ Главное",
    items: [
      { id: "general", label: "Основные", icon: Bot, important: true },
      { id: "prompt", label: "Промпт", icon: Sparkles, important: true },
      { id: "model", label: "Модель ИИ", icon: Zap, important: true },
    ],
  },
  {
    label: "🛒 Продажи",
    items: [
      { id: "sales", label: "Этапы продажи", icon: ShoppingCart },
      { id: "qa", label: "Вопрос-ответ", icon: HelpCircle },
      { id: "leads", label: "Лиды", icon: Users },
    ],
  },
  {
    label: "⚙️ Поведение",
    items: [
      { id: "schedule", label: "График", icon: Clock },
      { id: "delay", label: "Задержка", icon: Clock },
      { id: "limits", label: "Лимиты", icon: Shield },
      { id: "reactivation", label: "Реактивация", icon: RefreshCw },
      { id: "stop_command", label: "Стоп-команда", icon: Hand },
    ],
  },
  {
    label: "🔗 Интеграции",
    items: [
      { id: "ad_filter", label: "Объявления", icon: Filter },
      { id: "handoff", label: "Переключение", icon: Repeat },
      { id: "escalation", label: "Эскалация", icon: Shield },
      { id: "completion", label: "Завершение", icon: ChevronRight },
      { id: "notifications", label: "Уведомления", icon: Bell },
      { id: "telegram", label: "Telegram", icon: Bell },
    ],
  },
  {
    label: "🔧 Продвинутое",
    items: [
      { id: "pro", label: "Про-режим", icon: Sparkles },
      { id: "ai_settings", label: "AI корректировка", icon: Sparkles },
      { id: "usage_stats", label: "Статистика", icon: BarChart3 },
      { id: "debug", label: "Отладка", icon: PlayCircle },
    ],
  },
];

// Flat list for backward compat
const botSidebarItems = botSidebarGroups.flatMap(g => g.items);

// ===== Debounced Q&A Input =====
function DebouncedInput({ value: externalValue, onChange, ...props }: { value: string; onChange: (val: string) => void } & Omit<React.ComponentProps<typeof Input>, "value" | "onChange">) {
  const [value, setValue] = useState(externalValue);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => { setValue(externalValue); }, [externalValue]);
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setValue(newVal);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => onChange(newVal), 600);
  };
  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);
  return <Input {...props} value={value} onChange={handleChange} />;
}

function DebouncedTextarea({ value: externalValue, onChange, ...props }: { value: string; onChange: (val: string) => void } & Omit<React.ComponentProps<typeof Textarea>, "value" | "onChange">) {
  const [value, setValue] = useState(externalValue);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => { setValue(externalValue); }, [externalValue]);
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    setValue(newVal);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => onChange(newVal), 600);
  };
  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);
  return <Textarea {...props} value={value} onChange={handleChange} />;
}

// ===== STATUS INDICATOR =====
function BotStatusIndicator({ bot, account }: { bot: AvitoBot; account?: AvitoAccount | null }) {
  const issues: string[] = [];
  if (!bot.is_active) issues.push("Бот выключен");
  // Avito account is optional — only warn if account is linked but misconfigured
  if ((bot as any).avito_account_id && !account) issues.push("Привязанный аккаунт не найден");
  else if (account && !account.avito_user_id) issues.push("Авито user_id не определён");

  if (issues.length === 0 && bot.is_active) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
        </span>
        <span className="text-xs text-green-700 font-medium">Готов к работе</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <XCircle className="h-3 w-3 text-destructive" />
      <span className="text-xs text-destructive">{issues[0]}</span>
    </div>
  );
}

export function AvitoBotSection({ storeId }: AvitoBotSectionProps) {
  const { toast } = useToast();
  const { bots, loading, saving, createBot, duplicateBot, saveBot, deleteBot, toggleBot, processMessages, fetchChats, refetch } = useAvitoBots(storeId);
  
  const [topLevel, setTopLevel] = useState<TopLevel>("dashboard");
  const [editingBotId, setEditingBotId] = useState<string | null>(null);
  const [botSection, setBotSection] = useState<BotSection>("general");
  
  const [accounts, setAccounts] = useState<AvitoAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [newAccountClientId, setNewAccountClientId] = useState("");
  const [newAccountClientSecret, setNewAccountClientSecret] = useState("");
  const [newAccountName, setNewAccountName] = useState("");
  
  const [showNewBot, setShowNewBot] = useState(false);
  const [newBotName, setNewBotName] = useState("");
  const [newBotAccountId, setNewBotAccountId] = useState<string>("");

  const [chats, setChats] = useState<AvitoBotChat[]>([]);
  const [botForm, setBotForm] = useState<Partial<AvitoBot> & { telegram_bot_token?: string; telegram_chat_id?: string; seller_stop_command?: string; schedule_config?: any }>({});
  const [qaItems, setQaItems] = useState<QAItem[]>([]);
  const [qaLoading, setQaLoading] = useState(false);

  // Dashboard stats
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [recentChats, setRecentChats] = useState<any[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);

  const editingBot = bots.find(b => b.id === editingBotId) || null;

  const loadAccounts = async () => {
    if (!storeId) return;
    setAccountsLoading(true);
    try {
      const { data, error } = await supabase.from("avito_accounts").select("*").eq("store_id", storeId);
      if (error) throw error;
      setAccounts((data || []) as AvitoAccount[]);
    } catch (err: any) {
      console.error(err);
    } finally {
      setAccountsLoading(false);
    }
  };

  const loadDashboardStats = useCallback(async () => {
    if (!storeId) return;
    setStatsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("avito-bot", {
        body: { action: "bot_stats", store_id: storeId },
      });
      if (error) throw error;
      if (data?.stats) setDashboardStats(data.stats);
      if (data?.recent_chats) setRecentChats(data.recent_chats);
    } catch (err: any) {
      console.error("Failed to load stats:", err);
    } finally {
      setStatsLoading(false);
    }
  }, [storeId]);

  useEffect(() => { loadAccounts(); }, [storeId]);
  useEffect(() => { if (topLevel === "dashboard") loadDashboardStats(); }, [topLevel, loadDashboardStats]);

  useEffect(() => {
    if (editingBot) {
      const smartData = (editingBot as any).smart_setup_data || {};
      setBotForm({
        name: editingBot.name || "",
        mode: editingBot.mode || "smart",
        system_prompt: editingBot.system_prompt || "",
        lead_conditions: Array.isArray(editingBot.lead_conditions) ? editingBot.lead_conditions : [],
        escalation_rules: Array.isArray(editingBot.escalation_rules) ? editingBot.escalation_rules : [],
        completion_rules: Array.isArray(editingBot.completion_rules) ? editingBot.completion_rules : [],
        schedule_mode: (editingBot.schedule_mode as any) || "24/7",
        schedule_config: (editingBot as any).schedule_config || { days: {} },
        reactivation_messages: Array.isArray(editingBot.reactivation_messages) ? editingBot.reactivation_messages : [],
        ai_model: editingBot.ai_model || "google/gemini-3-flash-preview",
        upgrade_after_messages: editingBot.upgrade_after_messages || 0,
        upgrade_model: editingBot.upgrade_model || null,
        response_delay_seconds: editingBot.response_delay_seconds || 60,
        max_responses: editingBot.max_responses,
        pro_seller_mode: editingBot.pro_seller_mode || false,
        telegram_notification_format: editingBot.telegram_notification_format || "summary",
        telegram_debug_notifications: (editingBot as any).telegram_debug_notifications || false,
        telegram_new_chat_notifications: (editingBot as any).telegram_new_chat_notifications !== false,
        telegram_lead_notifications: (editingBot as any).telegram_lead_notifications !== false,
        avito_account_id: (editingBot as any).avito_account_id || null,
        telegram_bot_token: (editingBot as any).telegram_bot_token || "",
        telegram_chat_id: (editingBot as any).telegram_chat_id || "",
        seller_stop_command: (editingBot as any).seller_stop_command || "/stop",
        personality_config: (editingBot as any).personality_config || { bot_name: "", character_traits: "", communication_style: "", tone: "", emoji_usage: "", greeting_style: "" },
        instructions_config: (editingBot as any).instructions_config || { main_goal: "", responsibilities: "", forbidden_actions: "", response_format: "", knowledge_boundaries: "" },
        rules_list: Array.isArray((editingBot as any).rules_list) ? (editingBot as any).rules_list : [],
        allowed_item_ids: (editingBot as any).allowed_item_ids || null,
        max_response_chars: (editingBot as any).max_response_chars || null,
        handoff_rules: Array.isArray((editingBot as any).handoff_rules) ? (editingBot as any).handoff_rules : [],
        smart_setup_data: {
          category: smartData.category || "products",
          company_info: smartData.company_info || "",
          pricing_info: smartData.pricing_info || "",
          delivery_info: smartData.delivery_info || "",
          customer_interaction: smartData.customer_interaction || "",
          custom_blocks: smartData.custom_blocks || [],
        },
      } as any);
      loadQAItems(editingBot.id);
    }
  }, [editingBot]);

  const loadQAItems = async (botId: string) => {
    setQaLoading(true);
    try {
      const { data, error } = await (supabase as any).from("avito_bot_qa").select("*").eq("bot_id", botId).order("sort_order", { ascending: true });
      if (error) throw error;
      setQaItems((data || []) as QAItem[]);
    } catch (err: any) { console.error("Error loading Q&A:", err); } finally { setQaLoading(false); }
  };

  const handleSaveBot = async () => {
    if (!editingBotId) return;
    await saveBot(editingBotId, botForm);
  };

  const handleCreateBot = async () => {
    if (!newBotName.trim()) return;
    const bot = await createBot(newBotName.trim(), newBotAccountId || null);
    if (bot) {
      setShowNewBot(false);
      setNewBotName("");
      setNewBotAccountId("");
      setEditingBotId(bot.id);
      setBotSection("general");
    }
  };

  const handleAddAccount = async () => {
    if (!storeId || !newAccountClientId || !newAccountClientSecret) return;
    try {
      const { error } = await supabase.from("avito_accounts").insert({
        store_id: storeId, client_id: newAccountClientId, client_secret: newAccountClientSecret, profile_name: newAccountName || null,
      } as any);
      if (error) throw error;
      toast({ title: "Аккаунт добавлен" });
      setNewAccountClientId(""); setNewAccountClientSecret(""); setNewAccountName("");
      loadAccounts();
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    }
  };

  const handleDeleteAccount = async (id: string) => {
    try {
      const { error } = await supabase.from("avito_accounts").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Аккаунт удалён" }); loadAccounts();
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    }
  };

  const loadChats = async () => { const c = await fetchChats(); setChats(c); };
  useEffect(() => { if (topLevel === "chats") loadChats(); }, [topLevel]);

  const handleAddQA = async () => {
    if (!editingBotId) return;
    try {
      const { error } = await (supabase as any).from("avito_bot_qa").insert({ bot_id: editingBotId, question: "", answer: "", match_mode: "fuzzy", sort_order: qaItems.length });
      if (error) throw error;
      loadQAItems(editingBotId);
    } catch (err: any) { toast({ title: "Ошибка", description: err.message, variant: "destructive" }); }
  };

  const handleUpdateQA = async (id: string, updates: Partial<QAItem>) => {
    try {
      const { error } = await (supabase as any).from("avito_bot_qa").update(updates).eq("id", id);
      if (error) throw error;
      setQaItems(prev => prev.map(q => q.id === id ? { ...q, ...updates } : q));
    } catch (err: any) { toast({ title: "Ошибка", description: err.message, variant: "destructive" }); }
  };

  const handleDeleteQA = async (id: string) => {
    try {
      const { error } = await (supabase as any).from("avito_bot_qa").delete().eq("id", id);
      if (error) throw error;
      setQaItems(prev => prev.filter(q => q.id !== id));
    } catch (err: any) { toast({ title: "Ошибка", description: err.message, variant: "destructive" }); }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Загрузка...</div>;
  }

  if (editingBotId && editingBot) {
    return <BotEditor
      bot={editingBot}
      bots={bots}
      botForm={botForm}
      setBotForm={setBotForm}
      botSection={botSection}
      setBotSection={setBotSection}
      saving={saving}
      accounts={accounts}
      storeId={storeId}
      qaItems={qaItems}
      qaLoading={qaLoading}
      onAddQA={handleAddQA}
      onUpdateQA={handleUpdateQA}
      onDeleteQA={handleDeleteQA}
      onSave={handleSaveBot}
      onBack={() => { setEditingBotId(null); refetch(); }}
      onToggle={(active) => toggleBot(editingBotId, active)}
      onProcess={() => processMessages(editingBotId)}
      onDelete={async () => {
        if (!window.confirm("Вы уверены, что хотите удалить этого робота? Это действие нельзя отменить.")) return;
        await deleteBot(editingBotId); setEditingBotId(null);
      }}
    />;
  }

  return (
    <div className="flex gap-0 -mx-4 -mt-4 min-h-[calc(100vh-180px)]">
      <div className="w-56 flex-shrink-0 border-r border-border bg-muted/30">
        <div className="p-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm">Авито Боты</span>
          </div>
        </div>
        <div className="p-2 space-y-0.5">
          {([
            { id: "dashboard" as TopLevel, label: "Дашборд", icon: BarChart3 },
            { id: "bots" as TopLevel, label: "Роботы", icon: Bot },
            { id: "accounts" as TopLevel, label: "Аккаунты Авито", icon: KeyRound },
            { id: "chats" as TopLevel, label: "Чаты", icon: MessageCircle },
          ]).map(item => {
            const Icon = item.icon;
            return (
              <button key={item.id} onClick={() => setTopLevel(item.id)} className={cn("w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors text-left", topLevel === item.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                <Icon className="h-4 w-4 flex-shrink-0" />
                {item.label}
                {item.id === "bots" && bots.length > 0 && <Badge variant="secondary" className="ml-auto text-xs">{bots.length}</Badge>}
                {item.id === "accounts" && accounts.length > 0 && <Badge variant="secondary" className="ml-auto text-xs">{accounts.length}</Badge>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1">
        <ScrollArea className="h-[calc(100vh-180px)]">
          <div className="p-6">
            {topLevel === "dashboard" && (
              <DashboardView
                stats={dashboardStats}
                recentChats={recentChats}
                loading={statsLoading}
                bots={bots}
                accounts={accounts}
                onRefresh={loadDashboardStats}
                onEditBot={(id) => { setEditingBotId(id); setBotSection("general"); }}
                onGoToBots={() => setTopLevel("bots")}
                onGoToChats={() => setTopLevel("chats")}
              />
            )}
            {topLevel === "bots" && (
              <div className="max-w-3xl">
                <BotsListView
                  bots={bots}
                  accounts={accounts}
                  showNewBot={showNewBot}
                  setShowNewBot={setShowNewBot}
                  newBotName={newBotName}
                  setNewBotName={setNewBotName}
                  newBotAccountId={newBotAccountId}
                  setNewBotAccountId={setNewBotAccountId}
                  onCreateBot={handleCreateBot}
                  onEditBot={(id) => { setEditingBotId(id); setBotSection("general"); }}
                  onToggle={toggleBot}
                  onDuplicate={async (id) => { await duplicateBot(id); }}
                />
              </div>
            )}
            {topLevel === "accounts" && (
              <div className="max-w-3xl">
                <AccountsView
                  accounts={accounts} loading={accountsLoading}
                  newName={newAccountName} setNewName={setNewAccountName}
                  newClientId={newAccountClientId} setNewClientId={setNewAccountClientId}
                  newClientSecret={newAccountClientSecret} setNewClientSecret={setNewAccountClientSecret}
                  onAdd={handleAddAccount} onDelete={handleDeleteAccount}
                />
              </div>
            )}
            {topLevel === "chats" && (
              <div className="max-w-none">
                <ChatsView chats={chats} bots={bots} storeId={storeId} onRefresh={loadChats} />
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

// ===== DASHBOARD VIEW =====
function DashboardView({ stats, recentChats, loading, bots, accounts, onRefresh, onEditBot, onGoToBots, onGoToChats }: {
  stats: DashboardStats | null;
  recentChats: any[];
  loading: boolean;
  bots: AvitoBot[];
  accounts: AvitoAccount[];
  onRefresh: () => void;
  onEditBot: (id: string) => void;
  onGoToBots: () => void;
  onGoToChats: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Дашборд Авито Ботов</h2>
          <p className="text-sm text-muted-foreground">Обзор всех ваших роботов, чатов и аккаунтов</p>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-1", loading && "animate-spin")} /> Обновить
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Bot} label="Роботы" value={stats?.bots_total ?? bots.length} sub={`${stats?.bots_active ?? bots.filter(b => b.is_active).length} активных`} color="text-primary" />
        <StatCard icon={KeyRound} label="Аккаунты" value={stats?.accounts_total ?? accounts.length} sub={`${stats?.accounts_connected ?? 0} подключено`} color="text-amber-600" />
        <StatCard icon={MessageCircle} label="Чаты" value={stats?.chats_total ?? 0} sub={`${stats?.bot_responses_total ?? 0} ответов бота`} color="text-blue-600" />
        <StatCard icon={Users} label="Лиды" value={stats?.leads_total ?? 0} sub={`${stats?.escalated_total ?? 0} эскалировано`} color="text-green-600" />
      </div>

      {/* Usage / Cost Stats */}
      {(stats?.total_requests ?? 0) > 0 && (
        <div>
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Статистика расхода ИИ
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="py-3 px-4">
                <div className="text-xs text-muted-foreground mb-1">Запросов к ИИ</div>
                <div className="text-2xl font-bold">{stats?.total_requests ?? 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 px-4">
                <div className="text-xs text-muted-foreground mb-1">Общая стоимость</div>
                <div className="text-2xl font-bold">{(stats?.total_cost ?? 0).toFixed(4)} ₽</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 px-4">
                <div className="text-xs text-muted-foreground mb-1">Средняя цена / ответ</div>
                <div className="text-2xl font-bold">{(stats?.avg_cost_per_message ?? 0).toFixed(4)} ₽</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 px-4">
                <div className="text-xs text-muted-foreground mb-1">Всего токенов</div>
                <div className="text-2xl font-bold">{((stats?.total_tokens ?? 0) / 1000).toFixed(1)}K</div>
                <div className="text-xs text-muted-foreground">
                  Вход: {((stats?.total_prompt_tokens ?? 0) / 1000).toFixed(1)}K · Выход: {((stats?.total_completion_tokens ?? 0) / 1000).toFixed(1)}K
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Auto-processing status */}
      {bots.some(b => b.is_active) ? (
        <Card className="border-green-300 bg-green-50/50">
          <CardContent className="py-3 px-4">
            <div className="flex items-start gap-3">
              <div className="relative flex-shrink-0 mt-0.5">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-green-800">Робот активен и отвечает на сообщения</p>
                <p className="text-xs text-green-700 mt-1">
                  Автоматическая проверка новых сообщений каждые 2 минуты. Активных ботов: {bots.filter(b => b.is_active).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-amber-300 bg-amber-50/50">
          <CardContent className="py-3 px-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">Все роботы выключены</p>
                <p className="text-xs text-amber-700 mt-1">
                  Включите хотя бы одного робота, чтобы он начал автоматически отвечать клиентам на Авито.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bots Overview */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">Роботы</h3>
          <Button variant="ghost" size="sm" onClick={onGoToBots} className="text-xs">Все роботы →</Button>
        </div>
        {bots.length === 0 ? (
          <Card className="py-8 text-center">
            <Bot className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">Нет роботов. Создайте первого.</p>
            <Button size="sm" className="mt-3" onClick={onGoToBots}><Plus className="h-4 w-4 mr-1" /> Создать</Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {bots.map(bot => {
              const account = accounts.find(a => a.id === (bot as any).avito_account_id);
              return (
                <Card key={bot.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onEditBot(bot.id)}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", bot.is_active ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground")}>
                          <Bot className="h-4 w-4" />
                        </div>
                        <div>
                          <span className="font-medium text-sm">{bot.name || "Без имени"}</span>
                          <span className="ml-2 text-[10px] text-muted-foreground font-mono">#{getBotNumber(bot.id)}</span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <BotStatusIndicator bot={bot} account={account} />
                    <div className="flex gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">{AI_MODELS.find(m => m.id === bot.ai_model)?.label || bot.ai_model?.split("/").pop()}</Badge>
                      {account && <Badge variant="secondary" className="text-xs">{account.profile_name || "Аккаунт"}</Badge>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Chats */}
      {recentChats.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Последние чаты</h3>
            <Button variant="ghost" size="sm" onClick={onGoToChats} className="text-xs">Все чаты →</Button>
          </div>
          <div className="space-y-2">
            {recentChats.slice(0, 5).map((chat: any) => (
              <Card key={chat.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-sm">{chat.avito_user_name || "Пользователь"}</span>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">Сообщений: {chat.messages_count}</Badge>
                      <Badge variant="outline" className="text-xs">Ответов: {chat.bot_responses_count}</Badge>
                      {chat.is_lead && <Badge className="bg-green-500/20 text-green-700 text-xs">Лид</Badge>}
                      {chat.is_escalated && <Badge variant="destructive" className="text-xs">Эскалация</Badge>}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {chat.last_message_at ? new Date(chat.last_message_at).toLocaleString("ru-RU") : "—"}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color }: { icon: React.ElementType; label: string; value: number; sub: string; color: string }) {
  return (
    <Card>
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-2 mb-1">
          <Icon className={cn("h-4 w-4", color)} />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground">{sub}</div>
      </CardContent>
    </Card>
  );
}

// ===== BOTS LIST =====
function BotsListView({ bots, accounts, showNewBot, setShowNewBot, newBotName, setNewBotName, newBotAccountId, setNewBotAccountId, onCreateBot, onEditBot, onToggle, onDuplicate }: {
  bots: AvitoBot[]; accounts: AvitoAccount[]; showNewBot: boolean; setShowNewBot: (v: boolean) => void;
  newBotName: string; setNewBotName: (v: string) => void; newBotAccountId: string; setNewBotAccountId: (v: string) => void;
  onCreateBot: () => void; onEditBot: (id: string) => void; onToggle: (id: string, active: boolean) => void; onDuplicate: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Роботы</h2>
          <p className="text-sm text-muted-foreground">Создавайте и настраивайте роботов для автоматических ответов на Авито</p>
        </div>
        <Button onClick={() => setShowNewBot(true)}><Plus className="h-4 w-4 mr-1" /> Новый робот</Button>
      </div>

      {showNewBot && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div><Label>Имя робота</Label><Input value={newBotName} onChange={e => setNewBotName(e.target.value)} placeholder="Например: Помощница Вероника" /></div>
            <div>
              <Label>Привязать к аккаунту Авито</Label>
              <Select value={newBotAccountId} onValueChange={setNewBotAccountId}>
                <SelectTrigger><SelectValue placeholder="Выберите аккаунт (необязательно)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Без привязки</SelectItem>
                  {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.profile_name || a.client_id}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={onCreateBot} disabled={!newBotName.trim()}>Создать</Button>
              <Button variant="outline" onClick={() => setShowNewBot(false)}>Отмена</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {bots.length === 0 && !showNewBot ? (
        <Card className="py-12 text-center">
          <Bot className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">У вас пока нет роботов</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {bots.map(bot => {
            const account = accounts.find(a => a.id === (bot as any).avito_account_id);
            return (
              <Card key={bot.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onEditBot(bot.id)}>
                <CardContent className="py-3 px-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", bot.is_active ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground")}>
                      <Bot className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-medium text-sm flex items-center gap-2">
                        {bot.name || "Без имени"}
                        <span className="text-[10px] text-muted-foreground font-mono">#{getBotNumber(bot.id)}</span>
                      </div>
                      <BotStatusIndicator bot={bot} account={account} />
                      <div className="text-xs mt-0.5 flex items-center gap-1.5">
                        <Badge variant="outline" className="text-xs">{AI_MODELS.find(m => m.id === bot.ai_model)?.label || bot.ai_model}</Badge>
                        {account ? (
                          <span className="flex items-center gap-1 text-muted-foreground"><KeyRound className="h-3 w-3" />{account.profile_name || account.client_id}</span>
                        ) : (
                          <span className="flex items-center gap-1 text-amber-600"><KeyRound className="h-3 w-3" />Аккаунт не привязан</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Дублировать" onClick={() => onDuplicate(bot.id)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Switch checked={bot.is_active} onCheckedChange={active => onToggle(bot.id, active)} />
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ===== ACCOUNTS VIEW =====
function AccountsView({ accounts, loading, newName, setNewName, newClientId, setNewClientId, newClientSecret, setNewClientSecret, onAdd, onDelete }: {
  accounts: AvitoAccount[]; loading: boolean; newName: string; setNewName: (v: string) => void;
  newClientId: string; setNewClientId: (v: string) => void; newClientSecret: string; setNewClientSecret: (v: string) => void;
  onAdd: () => void; onDelete: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div><h2 className="text-xl font-semibold">Аккаунты Авито</h2><p className="text-sm text-muted-foreground">Подключайте несколько аккаунтов Авито</p></div>
      <Card>
        <CardHeader><CardTitle className="text-base">Добавить аккаунт</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Название</Label><Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Магазин электроники" /></div>
          <div><Label>Client ID</Label><Input value={newClientId} onChange={e => setNewClientId(e.target.value)} placeholder="Авито Client ID" /></div>
          <div><Label>Client Secret</Label><Input type="password" value={newClientSecret} onChange={e => setNewClientSecret(e.target.value)} placeholder="Авито Client Secret" /></div>
          <Button onClick={onAdd} disabled={!newClientId || !newClientSecret}><Plus className="h-4 w-4 mr-1" /> Добавить</Button>
        </CardContent>
      </Card>
      {accounts.length > 0 && (
        <div className="space-y-2">
          {accounts.map(acc => (
            <Card key={acc.id}>
              <CardContent className="py-3 px-4 flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">{acc.profile_name || "Аккаунт"}</div>
                  <div className="text-xs text-muted-foreground">Client ID: {acc.client_id}</div>
                  {acc.avito_user_id ? (
                    <Badge className="bg-green-500/20 text-green-700 text-xs mt-1">✓ Подключён (ID: {acc.avito_user_id})</Badge>
                  ) : (
                    <Badge variant="outline" className="text-amber-600 text-xs mt-1">User ID не определён</Badge>
                  )}
                </div>
                <Button variant="ghost" size="icon" onClick={() => onDelete(acc.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ===== CHATS VIEW (Dual-pane) =====
function ChatsView({ chats, bots, storeId, onRefresh }: { chats: AvitoBotChat[]; bots: AvitoBot[]; storeId: string | null; onRefresh: () => void }) {
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ id: string; role: string; content: string; created_at: string }[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Filter out debug chats
  const realChats = chats.filter(c => !c.avito_user_name?.startsWith("Отладка") && !c.avito_chat_id?.startsWith("debug_"));

  const selectedChat = realChats.find(c => c.id === selectedChatId);

  const loadMessages = async (chatId: string) => {
    setMessagesLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("avito_bot_messages")
        .select("*")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setMessages(data || []);
    } catch (err: any) {
      console.error("Error loading messages:", err);
    } finally {
      setMessagesLoading(false);
    }
  };

  const syncAndLoadMessages = async (chat: AvitoBotChat) => {
    if (!storeId) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("avito-bot", {
        body: { action: "sync_chat_messages", store_id: storeId, avito_chat_id: chat.avito_chat_id, db_chat_id: chat.id },
      });
      if (error) throw error;
      if (data?.messages) {
        setMessages(data.messages);
      }
    } catch (err: any) {
      console.error("Sync error:", err);
      // Fallback to local messages
      await loadMessages(chat.id);
    } finally {
      setSyncing(false);
    }
  };

  const handleSelectChat = (chat: AvitoBotChat) => {
    setSelectedChatId(chat.id);
    setReplyText("");
    syncAndLoadMessages(chat);
  };

  const handleSendReply = async () => {
    if (!selectedChat || !replyText.trim() || !storeId) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("avito-bot", {
        body: {
          action: "send_avito_message",
          store_id: storeId,
          avito_chat_id: selectedChat.avito_chat_id,
          text: replyText.trim(),
          db_chat_id: selectedChat.id,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: "seller",
        content: replyText.trim(),
        created_at: new Date().toISOString(),
      }]);
      setReplyText("");
      toast({ title: "Сообщение отправлено в Авито" });
    } catch (err: any) {
      toast({ title: "Ошибка отправки", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleResumeBot = async () => {
    if (!selectedChat) return;
    try {
      await (supabase as any)
        .from("avito_bot_chats")
        .update({ is_escalated: false, status: "active", updated_at: new Date().toISOString() })
        .eq("id", selectedChat.id);
      toast({ title: "Бот снова активен в этом чате" });
      onRefresh();
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    }
  };

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "user": return "Клиент";
      case "assistant": return "Робот";
      case "seller": return "Вы";
      default: return role;
    }
  };

  const getRoleBg = (role: string) => {
    switch (role) {
      case "user": return "bg-muted";
      case "assistant": return "bg-primary/10 border border-primary/20";
      case "seller": return "bg-blue-500/10 border border-blue-500/20";
      default: return "bg-muted";
    }
  };

  return (
    <div className="flex gap-0 -mx-6 -mt-6" style={{ height: "calc(100vh - 240px)" }}>
      {/* Chat list */}
      <div className="w-80 flex-shrink-0 border-r border-border flex flex-col">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-sm">Чаты ({realChats.length})</h2>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRefresh}><RefreshCw className="h-3.5 w-3.5" /></Button>
        </div>
        <ScrollArea className="flex-1">
          {realChats.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">Чатов пока нет</div>
          ) : (
            <div className="divide-y divide-border">
              {realChats.map(chat => {
                const isSelected = chat.id === selectedChatId;
                return (
                  <button
                    key={chat.id}
                    onClick={() => handleSelectChat(chat)}
                    className={cn(
                      "w-full text-left p-3 transition-colors hover:bg-muted/50",
                      isSelected && "bg-primary/5 border-l-2 border-l-primary"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium text-sm truncate">{chat.avito_user_name || "Пользователь"}</span>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{chat.messages_count} сообщ.</Badge>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{chat.bot_responses_count} от бота</Badge>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {chat.is_lead && <Badge className="bg-green-500/20 text-green-700 text-[10px] px-1.5 py-0">Лид</Badge>}
                          {chat.is_escalated && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Вы в чате</Badge>}
                          {chat.status === "seller_takeover" && !chat.is_escalated && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Перехвачен</Badge>}
                        </div>
                      </div>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0">
                        {chat.last_message_at ? new Date(chat.last_message_at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Chat messages pane */}
      <div className="flex-1 flex flex-col">
        {!selectedChat ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Выберите чат слева</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="p-3 border-b border-border flex items-center justify-between bg-card">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <div className="font-medium text-sm">{selectedChat.avito_user_name || "Пользователь"}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {selectedChat.messages_count} сообщ. · {selectedChat.bot_responses_count} ответов бота
                    {selectedChat.is_escalated && " · Вы ведёте диалог"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {selectedChat.is_escalated && (
                  <Button variant="outline" size="sm" className="text-xs h-7" onClick={handleResumeBot}>
                    <Bot className="h-3 w-3 mr-1" /> Вернуть боту
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => syncAndLoadMessages(selectedChat)} disabled={syncing}>
                  <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4" style={{ height: "calc(100vh - 380px)" }}>
              {messagesLoading || syncing ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-12">Сообщений пока нет</div>
              ) : (
                <div className="space-y-3">
                  {messages.map((msg, i) => (
                    <div key={msg.id || i} className={cn("flex", msg.role === "user" ? "justify-start" : "justify-end")}>
                      <div className={cn("max-w-[75%] rounded-xl px-3.5 py-2.5", getRoleBg(msg.role))}>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={cn("text-[10px] font-semibold",
                            msg.role === "user" ? "text-foreground" : msg.role === "seller" ? "text-blue-600" : "text-primary"
                          )}>
                            {getRoleLabel(msg.role)}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(msg.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Reply input */}
            <div className="p-3 border-t border-border bg-card">
              {selectedChat.is_escalated ? (
                <div className="flex gap-2">
                  <Input
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    placeholder="Написать клиенту в Авито..."
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSendReply()}
                    disabled={sending}
                    className="text-sm"
                  />
                  <Button onClick={handleSendReply} disabled={!replyText.trim() || sending} size="sm">
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted-foreground flex-1">Бот ведёт этот диалог. Чтобы подключиться — нажмите:</p>
                  <Button variant="outline" size="sm" className="text-xs h-7" onClick={async () => {
                    try {
                      await (supabase as any)
                        .from("avito_bot_chats")
                        .update({ is_escalated: true, status: "seller_takeover", updated_at: new Date().toISOString() })
                        .eq("id", selectedChat.id);
                      toast({ title: "Вы подключились к чату" });
                      onRefresh();
                    } catch {}
                  }}>
                    <Hand className="h-3 w-3 mr-1" /> Подключиться
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
// ===== SCHEDULE EDITOR =====
const WEEKDAYS = [
  { key: "monday", label: "Пн" },
  { key: "tuesday", label: "Вт" },
  { key: "wednesday", label: "Ср" },
  { key: "thursday", label: "Чт" },
  { key: "friday", label: "Пт" },
  { key: "saturday", label: "Сб" },
  { key: "sunday", label: "Вс" },
];

function ScheduleEditor({ scheduleMode, scheduleConfig, onUpdate }: {
  scheduleMode: string;
  scheduleConfig: any;
  onUpdate: (updates: { schedule_mode?: string; schedule_config?: any }) => void;
}) {
  const config = scheduleConfig || { days: {} };
  const days = config.days || {};

  const updateDay = (dayKey: string, updates: any) => {
    const newDays = { ...days, [dayKey]: { ...(days[dayKey] || { enabled: false, start: "09:00", end: "18:00" }), ...updates } };
    onUpdate({ schedule_config: { ...config, days: newDays } });
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold mb-1">График работы бота</h2>
      <p className="text-sm text-muted-foreground mb-3">Настройте когда бот должен отвечать на сообщения.</p>
      
      <div className="grid grid-cols-3 gap-3">
        {[
          { value: "24/7", label: "Круглосуточно", icon: "🕐", desc: "Бот отвечает всегда" },
          { value: "no_response", label: "Только вручную", icon: "🚫", desc: "Бот не отвечает автоматически" },
          { value: "schedule", label: "По расписанию", icon: "📅", desc: "Настройте дни и часы" },
        ].map(opt => (
          <button key={opt.value} onClick={() => onUpdate({ schedule_mode: opt.value })} className={cn("p-3 rounded-lg border-2 text-left text-sm transition-colors", scheduleMode === opt.value ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30")}>
            <span className="text-lg block mb-1">{opt.icon}</span>
            <span className="font-medium block">{opt.label}</span>
            <span className="text-xs text-muted-foreground">{opt.desc}</span>
          </button>
        ))}
      </div>

      {scheduleMode === "schedule" && (
        <Card className="mt-4">
          <CardContent className="pt-4 space-y-3">
            <Label className="text-sm font-medium">Рабочие дни и часы</Label>
            {WEEKDAYS.map(day => {
              const dayConfig = days[day.key] || { enabled: day.key !== "saturday" && day.key !== "sunday", start: "09:00", end: "18:00" };
              return (
                <div key={day.key} className="flex items-center gap-3">
                  <div className="w-8">
                    <Switch checked={dayConfig.enabled} onCheckedChange={v => updateDay(day.key, { enabled: v })} />
                  </div>
                  <span className={cn("w-8 text-sm font-medium", !dayConfig.enabled && "text-muted-foreground")}>{day.label}</span>
                  {dayConfig.enabled ? (
                    <div className="flex items-center gap-2">
                      <Input type="time" value={dayConfig.start || "09:00"} onChange={e => updateDay(day.key, { start: e.target.value })} className="w-28 h-8 text-sm" />
                      <span className="text-muted-foreground text-sm">—</span>
                      <Input type="time" value={dayConfig.end || "18:00"} onChange={e => updateDay(day.key, { end: e.target.value })} className="w-28 h-8 text-sm" />
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">Выходной</span>
                  )}
                </div>
              );
            })}
            <Separator />
            <div className="flex items-center gap-3">
              <Label className="text-xs">Часовой пояс (UTC+):</Label>
              <Input type="number" value={config.timezone_offset ?? 3} onChange={e => onUpdate({ schedule_config: { ...config, timezone_offset: parseInt(e.target.value) || 3 } })} className="w-20 h-8 text-sm" min={-12} max={14} />
              <span className="text-xs text-muted-foreground">(Москва = 3)</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ===== BOT EDITOR (dual pane) =====
function BotEditor({ bot, bots, botForm, setBotForm, botSection, setBotSection, saving, accounts, storeId, qaItems, qaLoading, onAddQA, onUpdateQA, onDeleteQA, onSave, onBack, onToggle, onProcess, onDelete }: {
  bot: AvitoBot;
  bots: AvitoBot[];
  botForm: Partial<AvitoBot> & { telegram_bot_token?: string; telegram_chat_id?: string; seller_stop_command?: string; schedule_config?: any };
  setBotForm: React.Dispatch<React.SetStateAction<any>>;
  botSection: BotSection;
  setBotSection: (s: BotSection) => void;
  saving: boolean;
  accounts: AvitoAccount[];
  storeId: string | null;
  qaItems: QAItem[];
  qaLoading: boolean;
  onAddQA: () => void;
  onUpdateQA: (id: string, updates: Partial<QAItem>) => void;
  onDeleteQA: (id: string) => void;
  onSave: () => void;
  onBack: () => void;
  onToggle: (active: boolean) => void;
  onProcess: () => void;
  onDelete: () => void;
}) {
  const { toast } = useToast();
  const account = accounts.find(a => a.id === (botForm as any).avito_account_id);
  
  // Debug state
  const [debugMessages, setDebugMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [debugInput, setDebugInput] = useState("");
  const [debugLoading, setDebugLoading] = useState(false);
  const [debugSessionId, setDebugSessionId] = useState<string | null>(null);
  const [debugSessions, setDebugSessions] = useState<{ id: string; created_at: string; avito_user_name: string | null }[]>([]);
  const [usageLogs, setUsageLogs] = useState<UsageLog[]>([]);
  const [usageLoading, setUsageLoading] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [avitoItems, setAvitoItems] = useState<AvitoItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [vsegptModels, setVsegptModels] = useState<VseGPTModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [aiFillingField, setAiFillingField] = useState<string | null>(null);

  // Sales stages state
  const [salesStages, setSalesStages] = useState<SalesStage[]>([]);
  const [salesLoading, setSalesLoading] = useState(false);

  const loadSalesStages = useCallback(async (botId: string) => {
    setSalesLoading(true);
    try {
      const { data, error } = await (supabase as any).from("avito_bot_sales_stages").select("*").eq("bot_id", botId).order("sort_order", { ascending: true });
      if (error) throw error;
      setSalesStages((data || []) as SalesStage[]);
    } catch (err: any) { console.error("Error loading sales stages:", err); } finally { setSalesLoading(false); }
  }, []);

  useEffect(() => {
    if (bot.id && botSection === "sales") {
      loadSalesStages(bot.id);
    }
  }, [bot.id, botSection, loadSalesStages]);

  const addSalesStage = async () => {
    try {
      const { data, error } = await (supabase as any).from("avito_bot_sales_stages").insert({
        bot_id: bot.id,
        name: `Этап ${salesStages.length + 1}`,
        instructions: "",
        action_type: "none",
        sort_order: salesStages.length,
      }).select().single();
      if (error) throw error;
      setSalesStages(prev => [...prev, data as SalesStage]);
      toast({ title: "Этап добавлен" });
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    }
  };

  const updateSalesStage = async (stageId: string, updates: Partial<SalesStage>) => {
    try {
      const { error } = await (supabase as any).from("avito_bot_sales_stages").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", stageId);
      if (error) throw error;
      setSalesStages(prev => prev.map(s => s.id === stageId ? { ...s, ...updates } : s));
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    }
  };

  const deleteSalesStage = async (stageId: string) => {
    try {
      const { error } = await (supabase as any).from("avito_bot_sales_stages").delete().eq("id", stageId);
      if (error) throw error;
      setSalesStages(prev => prev.filter(s => s.id !== stageId));
      toast({ title: "Этап удалён" });
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    }
  };

  const moveSalesStage = async (stageId: string, direction: "up" | "down") => {
    const idx = salesStages.findIndex(s => s.id === stageId);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= salesStages.length) return;
    const newStages = [...salesStages];
    [newStages[idx], newStages[swapIdx]] = [newStages[swapIdx], newStages[idx]];
    newStages.forEach((s, i) => s.sort_order = i);
    setSalesStages(newStages);
    await Promise.all([
      (supabase as any).from("avito_bot_sales_stages").update({ sort_order: idx }).eq("id", newStages[idx].id),
      (supabase as any).from("avito_bot_sales_stages").update({ sort_order: swapIdx }).eq("id", newStages[swapIdx].id),
    ]);
  };

  const debugEndRef = useRef<HTMLDivElement>(null);

  const updateForm = (updates: any) => setBotForm((prev: any) => ({ ...prev, ...updates }));

  // AI Fill helper — generates or improves text for a given field
  const aiFill = async (fieldKey: string, currentValue: string, context: string): Promise<string | null> => {
    setAiFillingField(fieldKey);
    try {
      const isGenerate = !currentValue.trim();
      const prompt = isGenerate
        ? `Сгенерируй текст для поля "${context}" для бота-помощника на Авито. Бот называется "${botForm.name || "Помощник"}". Верни ТОЛЬКО текст без пояснений, кратко и по делу.`
        : `Улучши и дополни следующий текст для настройки бота на Авито. Поле: "${context}". Сделай его более чётким и профессиональным, сохранив смысл. Верни ТОЛЬКО улучшенный текст без пояснений.\n\nИсходный текст:\n${currentValue}`;

      const { data: result, error } = await supabase.functions.invoke("ai-generate-description", {
        body: { prompt, store_id: storeId },
      });
      if (error) throw error;
      if (result?.error) throw new Error(result.error);
      const text = result?.description || result?.text || "";
      if (text) {
        toast({ title: isGenerate ? "Текст сгенерирован ✨" : "Текст улучшен ✨" });
        return text;
      }
    } catch (err: any) {
      toast({ title: "Ошибка ИИ", description: err.message, variant: "destructive" });
    } finally {
      setAiFillingField(null);
    }
    return null;
  };

  // AI Fill button component
  const AIFillBtn = ({ fieldKey, value, context, onResult }: { fieldKey: string; value: string; context: string; onResult: (text: string) => void }) => (
    <Button
      variant="ghost"
      size="sm"
      className="text-primary gap-1 h-7 px-2 text-xs shrink-0"
      disabled={aiFillingField === fieldKey}
      onClick={async () => {
        const result = await aiFill(fieldKey, value, context);
        if (result) onResult(result);
      }}
    >
      {aiFillingField === fieldKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
      {value.trim() ? "Улучшить" : "Заполнить ИИ"}
    </Button>
  );

  const addListItem = (field: "lead_conditions" | "escalation_rules" | "completion_rules") => {
    const arr = (botForm[field] as string[]) || [];
    updateForm({ [field]: [...arr, ""] });
  };
  const updateListItem = (field: "lead_conditions" | "escalation_rules" | "completion_rules", index: number, value: string) => {
    const arr = [...((botForm[field] as string[]) || [])]; arr[index] = value; updateForm({ [field]: arr });
  };
  const removeListItem = (field: "lead_conditions" | "escalation_rules" | "completion_rules", index: number) => {
    const arr = ((botForm[field] as string[]) || []).filter((_, i) => i !== index); updateForm({ [field]: arr });
  };

  useEffect(() => {
    setTimeout(() => { debugEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, 100);
  }, [debugMessages, debugLoading]);

  const loadDebugSessions = useCallback(async () => {
    try {
      const { data } = await (supabase as any).from("avito_bot_chats").select("id, created_at, avito_user_name").eq("store_id", storeId || bot.store_id).like("avito_chat_id", `debug_%`).order("created_at", { ascending: false });
      setDebugSessions(data || []);
    } catch {}
  }, [bot.id, storeId]);

  const createDebugSession = useCallback(async () => {
    try {
      const sid = storeId || bot.store_id;
      const { data, error } = await (supabase as any).from("avito_bot_chats").insert({ store_id: sid, avito_chat_id: `debug_${bot.id}_${Date.now()}`, avito_user_id: "debug", avito_user_name: `Отладка ${new Date().toLocaleString("ru-RU")}`, status: "active" }).select().single();
      if (error) throw error;
      setDebugSessionId(data.id); setDebugMessages([]); loadDebugSessions();
    } catch (err: any) { toast({ title: "Ошибка", description: err.message, variant: "destructive" }); }
  }, [bot.id, storeId, toast, loadDebugSessions]);

  const loadSessionMessages = useCallback(async (sessionId: string) => {
    setDebugSessionId(sessionId);
    try {
      const { data } = await (supabase as any).from("avito_bot_messages").select("*").eq("chat_id", sessionId).order("created_at", { ascending: true });
      if (data) setDebugMessages(data.map((m: any) => ({ role: m.role as "user" | "assistant", content: m.content })));
    } catch {}
  }, []);

  const [itemsError, setItemsError] = useState<string | null>(null);
  const loadAvitoItems = useCallback(async () => {
    setItemsLoading(true); setItemsError(null);
    try {
      const { data, error } = await supabase.functions.invoke("avito-bot", { body: { action: "list_items", bot_id: bot.id, store_id: storeId || bot.store_id } });
      if (error) throw error; if (data?.error) throw new Error(data.error);
      setAvitoItems(data.items || []);
    } catch (err: any) { setItemsError(err.message || "Не удалось загрузить"); } finally { setItemsLoading(false); }
  }, [bot.id, storeId]);

  const loadVsegptModels = useCallback(async () => {
    setModelsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("avito-bot", { body: { action: "fetch_models" } });
      if (error) throw error; if (data?.error) throw new Error(data.error);
      setVsegptModels(data.models || []);
    } catch (err: any) { console.error("Failed to load models:", err); } finally { setModelsLoading(false); }
  }, []);

  useEffect(() => { if (botSection === "debug") { loadDebugSessions(); loadAvitoItems(); } }, [botSection, loadDebugSessions, loadAvitoItems]);
  useEffect(() => { if (botSection === "model") { loadVsegptModels(); } }, [botSection, loadVsegptModels]);
  useEffect(() => {
    if (botSection === "usage_stats") {
      setUsageLoading(true);
      supabase.functions.invoke("avito-bot", { body: { action: "usage_stats", store_id: storeId || bot.store_id, bot_id: bot.id } })
        .then(({ data }) => { if (data?.logs) setUsageLogs(data.logs); })
        .finally(() => setUsageLoading(false));
    }
  }, [botSection]);

  const handleDebugSend = async () => {
    if (!debugInput.trim() || debugLoading) return;
    const userMsg = debugInput.trim();
    setDebugInput(""); setDebugMessages(prev => [...prev, { role: "user", content: userMsg }]); setDebugLoading(true);

    let sessionId = debugSessionId;
    if (!sessionId) {
      try {
        const sid = storeId || bot.store_id;
        const { data, error } = await (supabase as any).from("avito_bot_chats").insert({ store_id: sid, avito_chat_id: `debug_${bot.id}_${Date.now()}`, avito_user_id: "debug", avito_user_name: `Отладка ${new Date().toLocaleString("ru-RU")}`, status: "active" }).select().single();
        if (error) throw error;
        sessionId = data.id; setDebugSessionId(data.id); loadDebugSessions();
      } catch (err: any) { toast({ title: "Ошибка", description: err.message, variant: "destructive" }); setDebugLoading(false); return; }
    }

    try {
      const { data, error } = await supabase.functions.invoke("avito-bot", { body: { action: "debug_chat", bot_id: bot.id, message: userMsg, item_id: selectedItemId, debug_session_id: sessionId, store_id: storeId || bot.store_id } });
      if (error) throw error; if (data?.error) throw new Error(data.error);
      const usageInfo = data.usage ? `\n\n---\n💰 Токены: ${data.usage.prompt_tokens}→${data.usage.completion_tokens} (${data.usage.total_tokens}) · Стоимость: ${Number(data.usage.cost || 0).toFixed(6)} ₽ · Модель: ${data.usage.model || ""}` : "";
      setDebugMessages(prev => [...prev, { role: "assistant", content: (data.response || "...") + usageInfo }]);
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
      setDebugMessages(prev => [...prev, { role: "assistant", content: `Ошибка: ${err.message}` }]);
    } finally { setDebugLoading(false); }
  };

  const renderSection = () => {
    switch (botSection) {
      case "general":
        return (
          <div className="space-y-6">
            {/* ===== BIG STATUS & ACTIVATION CARD ===== */}
            <Card className={cn(
              "border-2 transition-colors",
              bot.is_active ? "border-green-400 bg-green-50/30" : "border-muted bg-muted/20"
            )}>
              <CardContent className="py-5 px-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center",
                      bot.is_active ? "bg-green-100" : "bg-muted"
                    )}>
                      {bot.is_active ? (
                        <span className="relative flex h-5 w-5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-5 w-5 bg-green-500"></span>
                        </span>
                      ) : (
                        <Power className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <h2 className="text-lg font-bold">
                        {bot.is_active ? "Робот активен" : "Робот выключен"}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {bot.is_active 
                          ? "Автоматически отвечает на сообщения клиентов каждые 2 минуты" 
                          : "Включите робота, чтобы он начал отвечать клиентам"}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="lg"
                    variant={bot.is_active ? "outline" : "default"}
                    onClick={() => onToggle(!bot.is_active)}
                    className={cn(
                      "min-w-[200px] h-12 text-base font-semibold",
                      bot.is_active 
                        ? "border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground" 
                        : "bg-green-600 hover:bg-green-700 text-white"
                    )}
                  >
                    <Power className="h-5 w-5 mr-2" />
                    {bot.is_active ? "Выключить робота" : "Запустить робота"}
                  </Button>
                </div>
                <BotStatusIndicator bot={bot} account={account} />
              </CardContent>
            </Card>

            {/* ===== WORK MODE ===== */}
            <div>
              <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" /> Режим работы
              </h2>
              <p className="text-sm text-muted-foreground mb-3">Выберите, когда робот должен отвечать на сообщения</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: "24/7", icon: "🕐", label: "Круглосуточно", desc: "24/7 без перерывов", active: (botForm.schedule_mode || "24/7") === "24/7" },
                  { value: "schedule", icon: "📅", label: "По расписанию", desc: "Настройте дни и часы", active: botForm.schedule_mode === "schedule" },
                  { value: "no_response", icon: "✋", label: "Только вручную", desc: "Бот не отвечает сам", active: botForm.schedule_mode === "no_response" },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => updateForm({ schedule_mode: opt.value })}
                    className={cn(
                      "p-4 rounded-xl border-2 text-left transition-all",
                      opt.active 
                        ? "border-primary bg-primary/5 shadow-sm" 
                        : "border-border hover:border-muted-foreground/30"
                    )}
                  >
                    <span className="text-2xl block mb-1">{opt.icon}</span>
                    <span className="font-semibold text-sm block">{opt.label}</span>
                    <span className="text-xs text-muted-foreground">{opt.desc}</span>
                    {opt.active && <Badge className="mt-2 bg-primary/20 text-primary text-xs">Выбрано</Badge>}
                  </button>
                ))}
              </div>
              {botForm.schedule_mode === "schedule" && (
                <Card className="mt-3">
                  <CardContent className="pt-4">
                    <Button variant="ghost" size="sm" onClick={() => setBotSection("schedule")} className="text-primary">
                      <Settings className="h-4 w-4 mr-1" /> Настроить график работы →
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>

            <Separator />

            {/* ===== BOT NAME ===== */}
            <div>
              <h2 className="text-lg font-semibold mb-1">Имя робота</h2>
              <Input value={botForm.name || ""} onChange={e => updateForm({ name: e.target.value })} placeholder="Мой Авитобот" />
            </div>

            {/* ===== ACCOUNT ===== */}
             <div>
              <h2 className="text-lg font-semibold mb-1">Аккаунт Авито</h2>
              {!(botForm as any).avito_account_id || (botForm as any).avito_account_id === "none" ? (
                <div className="mb-3 p-3 rounded-lg border border-blue-300 bg-blue-50 text-blue-800 text-sm flex items-center gap-2">
                  <KeyRound className="h-4 w-4 flex-shrink-0" />
                  Аккаунт Авито не привязан. Это нужно только для автоответов в Авито. Для чата на сайте магазина привязка не требуется.
                </div>
              ) : null}
              <Select value={(botForm as any).avito_account_id || "none"} onValueChange={v => updateForm({ avito_account_id: v === "none" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Выберите аккаунт" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Не привязан</SelectItem>
                  {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.profile_name || a.client_id}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* ===== SETUP MODE ===== */}
            <div>
              <h2 className="text-lg font-semibold mb-1">Режим настройки</h2>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => updateForm({ mode: "smart" })} className={cn("p-4 rounded-lg border-2 text-left transition-colors", botForm.mode === "smart" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30")}>
                  <span className="text-2xl mb-2 block">🐱</span>
                  <span className="font-medium">Умная настройка</span>
                </button>
                <button onClick={() => updateForm({ mode: "pro" })} className={cn("p-4 rounded-lg border-2 text-left transition-colors", botForm.mode === "pro" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30")}>
                  <span className="text-2xl mb-2 block">💻</span>
                  <span className="font-medium">Для профессионалов</span>
                </button>
              </div>
            </div>

            <Separator />
            <div className="flex items-center gap-2">
              <Button onClick={onProcess} variant="outline" size="sm"><RefreshCw className="h-4 w-4 mr-1" /> Проверить сообщения сейчас</Button>
              <span className="text-xs text-muted-foreground">Принудительная проверка (обычно автоматически каждые 2 мин.)</span>
            </div>
          </div>
        );

      case "prompt": {
        const personality = (botForm as any).personality_config || {};
        const instructions = (botForm as any).instructions_config || {};
        const rulesList: string[] = (botForm as any).rules_list || [];
        const isSmartMode = botForm.mode === "smart";
        return (
          <div className="space-y-6">
            {/* PERSONALITY */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4 text-primary" /> Личность робота</CardTitle>
                <CardDescription className="text-xs">Определите характер и стиль общения робота</CardDescription>
              </CardHeader>
               <CardContent className="space-y-3">
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Как зовут робота?</Label>
                  </div>
                  <Input value={personality.bot_name || ""} onChange={e => updateForm({ personality_config: { ...personality, bot_name: e.target.value } })} placeholder="Например: Анна, Помощник Алексей" />
                  <p className="text-xs text-muted-foreground mt-1">Имя, которым робот представляется клиентам</p>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Черты характера</Label>
                    <AIFillBtn fieldKey="p_traits" value={personality.character_traits || ""} context="Черты характера робота-помощника на Авито" onResult={v => updateForm({ personality_config: { ...personality, character_traits: v } })} />
                  </div>
                  <Textarea value={personality.character_traits || ""} onChange={e => updateForm({ personality_config: { ...personality, character_traits: e.target.value } })} placeholder="Дружелюбный, профессиональный, внимательный к деталям, терпеливый" className="min-h-[60px]" />
                  <p className="text-xs text-muted-foreground mt-1">Какие качества проявляет робот в общении?</p>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Стиль общения</Label>
                    <AIFillBtn fieldKey="p_style" value={personality.communication_style || ""} context="Стиль общения робота на Авито (формальный/дружеский)" onResult={v => updateForm({ personality_config: { ...personality, communication_style: v } })} />
                  </div>
                  <Textarea value={personality.communication_style || ""} onChange={e => updateForm({ personality_config: { ...personality, communication_style: e.target.value } })} placeholder="Деловой но тёплый, без канцеляризмов, простыми словами" className="min-h-[60px]" />
                  <p className="text-xs text-muted-foreground mt-1">Как робот формулирует мысли? Формально или дружески?</p>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Тон и настроение</Label>
                    <AIFillBtn fieldKey="p_tone" value={personality.tone || ""} context="Тон и настроение робота-помощника" onResult={v => updateForm({ personality_config: { ...personality, tone: v } })} />
                  </div>
                  <Input value={personality.tone || ""} onChange={e => updateForm({ personality_config: { ...personality, tone: e.target.value } })} placeholder="Позитивный, уверенный, готовый помочь" />
                </div>
                <div>
                  <Label className="text-sm">Использование эмодзи</Label>
                  <Select value={personality.emoji_usage || "moderate"} onValueChange={v => updateForm({ personality_config: { ...personality, emoji_usage: v } })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Не использовать</SelectItem>
                      <SelectItem value="minimal">Минимально (1-2 в сообщении)</SelectItem>
                      <SelectItem value="moderate">Умеренно</SelectItem>
                      <SelectItem value="frequent">Часто</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Как робот приветствует клиента?</Label>
                    <AIFillBtn fieldKey="p_greeting" value={personality.greeting_style || ""} context="Приветствие робота для клиентов на Авито" onResult={v => updateForm({ personality_config: { ...personality, greeting_style: v } })} />
                  </div>
                  <Textarea value={personality.greeting_style || ""} onChange={e => updateForm({ personality_config: { ...personality, greeting_style: e.target.value } })} placeholder="Здравствуйте! Меня зовут Анна, я помогу вам с выбором. Чем могу быть полезна?" className="min-h-[60px]" />
                </div>
              </CardContent>
            </Card>

            {/* INSTRUCTIONS */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Должностные инструкции</CardTitle>
                <CardDescription className="text-xs">Что робот должен делать и знать</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Главная цель робота</Label>
                    <AIFillBtn fieldKey="i_goal" value={instructions.main_goal || ""} context="Главная цель робота-помощника на Авито" onResult={v => updateForm({ instructions_config: { ...instructions, main_goal: v } })} />
                  </div>
                  <Textarea value={instructions.main_goal || ""} onChange={e => updateForm({ instructions_config: { ...instructions, main_goal: e.target.value } })} placeholder="Помочь клиенту выбрать товар, ответить на вопросы и довести до покупки" className="min-h-[60px]" />
                  <p className="text-xs text-muted-foreground mt-1">Какой основной результат должен достигать робот?</p>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Обязанности и зона ответственности</Label>
                    <AIFillBtn fieldKey="i_resp" value={instructions.responsibilities || ""} context="Обязанности и зона ответственности робота на Авито" onResult={v => updateForm({ instructions_config: { ...instructions, responsibilities: v } })} />
                  </div>
                  <Textarea value={instructions.responsibilities || ""} onChange={e => updateForm({ instructions_config: { ...instructions, responsibilities: e.target.value } })} placeholder="Отвечать на вопросы о товарах, ценах, доставке. Предлагать аналоги если нужного нет в наличии." className="min-h-[80px]" />
                  <p className="text-xs text-muted-foreground mt-1">Перечислите конкретные задачи робота</p>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Что робот НЕ должен делать</Label>
                    <AIFillBtn fieldKey="i_forbidden" value={instructions.forbidden_actions || ""} context="Запреты и ограничения для робота на Авито" onResult={v => updateForm({ instructions_config: { ...instructions, forbidden_actions: v } })} />
                  </div>
                  <Textarea value={instructions.forbidden_actions || ""} onChange={e => updateForm({ instructions_config: { ...instructions, forbidden_actions: e.target.value } })} placeholder="Не давать скидки без согласования, не обсуждать конкурентов, не давать личные контакты" className="min-h-[60px]" />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Формат ответов</Label>
                    <AIFillBtn fieldKey="i_format" value={instructions.response_format || ""} context="Формат и стиль ответов робота на Авито" onResult={v => updateForm({ instructions_config: { ...instructions, response_format: v } })} />
                  </div>
                  <Textarea value={instructions.response_format || ""} onChange={e => updateForm({ instructions_config: { ...instructions, response_format: e.target.value } })} placeholder="Короткие ответы до 3 предложений. Всегда задавать уточняющий вопрос." className="min-h-[60px]" />
                  <p className="text-xs text-muted-foreground mt-1">Длина ответов, структура, стиль</p>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Границы знаний</Label>
                    <AIFillBtn fieldKey="i_boundaries" value={instructions.knowledge_boundaries || ""} context="Границы знаний робота — что делать если не знает ответа" onResult={v => updateForm({ instructions_config: { ...instructions, knowledge_boundaries: v } })} />
                  </div>
                  <Textarea value={instructions.knowledge_boundaries || ""} onChange={e => updateForm({ instructions_config: { ...instructions, knowledge_boundaries: e.target.value } })} placeholder="Если не знает ответ — предложить связаться с менеджером. Не выдумывать характеристики товара." className="min-h-[60px]" />
                  <p className="text-xs text-muted-foreground mt-1">Что делать, если робот не знает ответа?</p>
                </div>
              </CardContent>
            </Card>

            {/* RULES */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2"><ListChecks className="h-4 w-4 text-primary" /> Правила работы</CardTitle>
                    <CardDescription className="text-xs">Список конкретных правил, которым робот должен следовать</CardDescription>
                  </div>
                  <AIFillBtn fieldKey="rules_gen" value={rulesList.join("; ")} context="Список правил работы для бота-помощника на Авито (верни каждое правило на новой строке)" onResult={v => {
                    const items = v.split(/[\n;]/).map((s: string) => s.replace(/^\d+\.\s*[-•]?\s*/, "").trim()).filter(Boolean);
                    updateForm({ rules_list: items });
                  }} />
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {rulesList.map((rule: string, i: number) => (
                  <div key={i} className="flex gap-2 items-start">
                    <span className="text-xs text-muted-foreground mt-2.5 w-6 flex-shrink-0">{i + 1}.</span>
                    <Input value={rule} onChange={e => {
                      const newRules = [...rulesList];
                      newRules[i] = e.target.value;
                      updateForm({ rules_list: newRules });
                    }} placeholder="Правило..." className="flex-1" />
                    <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => updateForm({ rules_list: rulesList.filter((_: any, idx: number) => idx !== i) })}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => updateForm({ rules_list: [...rulesList, ""] })}>
                  <Plus className="h-4 w-4 mr-1" /> Добавить правило
                </Button>
                {rulesList.length === 0 && (
                  <div className="text-xs text-muted-foreground space-y-1 mt-2 p-3 rounded-lg bg-muted/50">
                    <p className="font-medium">Примеры правил:</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      <li>Всегда называть цену из объявления</li>
                      <li>При вопросе о скидке предложить оптовую покупку</li>
                      <li>Не отвечать на политические вопросы</li>
                      <li>Всегда благодарить за обращение</li>
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* CLARIFYING QUESTIONS */}
            <Card className={cn("border-2 transition-colors", instructions.clarifying_questions_enabled ? "border-primary/50 bg-primary/5" : "border-border")}>
              <CardContent className="py-4 px-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", instructions.clarifying_questions_enabled ? "bg-primary/20" : "bg-muted")}>
                      <HelpCircle className={cn("h-5 w-5", instructions.clarifying_questions_enabled ? "text-primary" : "text-muted-foreground")} />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">Уточняющие вопросы</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Если много похожих товаров — бот задаёт 1-3 вопроса, чтобы сузить выбор, прежде чем показать список
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={!!instructions.clarifying_questions_enabled}
                    onCheckedChange={v => updateForm({ instructions_config: { ...instructions, clarifying_questions_enabled: v } })}
                  />
                </div>
                {instructions.clarifying_questions_enabled && (
                  <div className="mt-3 ml-13 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 space-y-1">
                    <p className="font-medium text-foreground">Как это работает:</p>
                    <p>• Клиент пишет «хамон» → в каталоге 20+ позиций</p>
                    <p>• Бот спрашивает: «Вам нарезка, блоком или нога целиком?»</p>
                    <p>• Клиент отвечает → бот показывает 3-6 подходящих товаров</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Separator />

            {/* Smart setup or raw prompt */}
            {isSmartMode ? (
              <div>
                <h2 className="text-lg font-semibold mb-1">Умная настройка контента</h2>
                <p className="text-sm text-muted-foreground mb-3">Заполните информацию о бизнесе — промпт сформируется автоматически.</p>
                <AvitoBotSmartSetup data={(botForm as any).smart_setup_data || { category: "products", company_info: "", pricing_info: "", delivery_info: "", customer_interaction: "", custom_blocks: [] }} onChange={(newData) => { updateForm({ smart_setup_data: newData }); const prompt = buildSystemPromptFromSmartSetup(newData); updateForm({ system_prompt: prompt }); }} storeId={storeId} botId={bot.id} />
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h2 className="text-lg font-semibold mb-1">Произвольный промпт (дополнительно)</h2>
                    <p className="text-sm text-muted-foreground">Все блоки выше автоматически формируют промпт. Здесь можете дополнить его вручную.</p>
                  </div>
                  <AIFillBtn fieldKey="system_prompt" value={botForm.system_prompt || ""} context="Системный промпт для бота-помощника на Авито" onResult={v => updateForm({ system_prompt: v })} />
                </div>
                <Textarea value={botForm.system_prompt || ""} onChange={e => updateForm({ system_prompt: e.target.value })} placeholder="Дополнительные инструкции..." className="min-h-[200px]" />
              </div>
            )}
          </div>
        );
      }

      case "qa":
        return (
          <div className="space-y-4">
            <div><h2 className="text-lg font-semibold mb-1">База вопросов и ответов</h2><p className="text-sm text-muted-foreground mb-3">Добавьте типовые вопросы.</p></div>
            {qaLoading ? <div className="text-center py-8 text-muted-foreground">Загрузка...</div> : (
              <>
                {qaItems.map((qa, i) => (
                  <Card key={qa.id} className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">#{i + 1}</span>
                      <div className="flex items-center gap-2">
                        <Select value={qa.match_mode} onValueChange={v => onUpdateQA(qa.id, { match_mode: v as any })}><SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fuzzy">Примерное</SelectItem><SelectItem value="exact">Точное</SelectItem></SelectContent></Select>
                        <Switch checked={qa.is_active} onCheckedChange={v => onUpdateQA(qa.id, { is_active: v })} />
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDeleteQA(qa.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </div>
                    <div><Label className="text-xs">Вопрос</Label><DebouncedInput value={qa.question} onChange={val => onUpdateQA(qa.id, { question: val })} placeholder="Какая доставка?" /></div>
                    <div><Label className="text-xs">Ответ</Label><DebouncedTextarea value={qa.answer} onChange={val => onUpdateQA(qa.id, { answer: val })} placeholder="Доставляем в течение 1-2 дней..." className="min-h-[80px]" /></div>
                  </Card>
                ))}
                <Button variant="outline" onClick={onAddQA}><Plus className="h-4 w-4 mr-1" /> Добавить</Button>
              </>
            )}
          </div>
        );

      case "leads":
        return <LeadsSection botId={bot.id} storeId={storeId!} leadConditions={(botForm.lead_conditions as string[]) || []} onAddCondition={() => addListItem("lead_conditions")} onUpdateCondition={(i, v) => updateListItem("lead_conditions", i, v)} onRemoveCondition={(i) => removeListItem("lead_conditions", i)} onAiFill={async () => {
          const result = await aiFill("leads_gen", ((botForm.lead_conditions as string[]) || []).join("; "), "Условия для создания лида в чат-боте на Авито (список через точку с запятой)");
          if (result) { const items = result.split(/[;\n]/).map((s: string) => s.replace(/^\d+\.\s*/, "").trim()).filter(Boolean); updateForm({ lead_conditions: items }); }
        }} aiFillingField={aiFillingField} />;

      case "escalation":
        return <ListEditor title="Когда передать человеку?" desc="Случаи передачи диалога." items={(botForm.escalation_rules as string[]) || []} onAdd={() => addListItem("escalation_rules")} onUpdate={(i, v) => updateListItem("escalation_rules", i, v)} onRemove={(i) => removeListItem("escalation_rules", i)} placeholder="Правило..." onAiFill={async () => {
          const result = await aiFill("escalation_gen", ((botForm.escalation_rules as string[]) || []).join("; "), "Правила эскалации (когда передать диалог человеку) для бота на Авито");
          if (result) { const items = result.split(/[;\n]/).map((s: string) => s.replace(/^\d+\.\s*/, "").trim()).filter(Boolean); updateForm({ escalation_rules: items }); }
        }} aiFillingField={aiFillingField} />;

      case "completion":
        return <ListEditor title="Когда считать завершённым?" desc="Признаки завершённого диалога." items={(botForm.completion_rules as string[]) || []} onAdd={() => addListItem("completion_rules")} onUpdate={(i, v) => updateListItem("completion_rules", i, v)} onRemove={(i) => removeListItem("completion_rules", i)} placeholder="Признак..." onAiFill={async () => {
          const result = await aiFill("completion_gen", ((botForm.completion_rules as string[]) || []).join("; "), "Признаки завершённого диалога для бота на Авито");
          if (result) { const items = result.split(/[;\n]/).map((s: string) => s.replace(/^\d+\.\s*/, "").trim()).filter(Boolean); updateForm({ completion_rules: items }); }
        }} aiFillingField={aiFillingField} />;

      case "schedule":
        return (
          <ScheduleEditor
            scheduleMode={botForm.schedule_mode || "24/7"}
            scheduleConfig={botForm.schedule_config}
            onUpdate={(updates) => updateForm(updates)}
          />
        );

      case "stop_command":
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Hand className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Стоп-команда</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Когда вы лично отправляете эту команду в чат на Авито, робот перестаёт отвечать в этом конкретном чате, 
              и вы можете продолжить общение с клиентом самостоятельно.
            </p>
            
            <Card className="bg-blue-50/50 border-blue-200">
              <CardContent className="pt-4 space-y-2">
                <p className="text-sm font-medium">Как это работает:</p>
                <ol className="text-sm space-y-1 list-decimal list-inside text-muted-foreground">
                  <li>Вы видите, что хотите ответить клиенту сами</li>
                  <li>Отправляете стоп-команду в этот чат на Авито</li>
                  <li>Робот помечает чат как «ведёт продавец» и перестаёт отвечать</li>
                  <li>Вы продолжаете общение с клиентом</li>
                </ol>
              </CardContent>
            </Card>

            <div>
              <Label>Команда остановки</Label>
              <Input 
                value={botForm.seller_stop_command || "/stop"} 
                onChange={e => updateForm({ seller_stop_command: e.target.value })} 
                placeholder="/stop" 
              />
              <p className="text-xs text-muted-foreground mt-1">
                Отправьте именно этот текст в чат на Авито, чтобы бот остановился. По умолчанию: /stop
              </p>
            </div>

            <Card className="bg-amber-50/50 border-amber-200">
              <CardContent className="pt-4">
                <p className="text-sm text-amber-800">
                  <strong>Важно:</strong> После остановки бота в чате, чтобы снова включить его — удалите флаг эскалации в разделе «Чаты».
                </p>
              </CardContent>
            </Card>
          </div>
        );

      case "reactivation": {
        const msgs = (botForm.reactivation_messages as any[]) || [];
        return (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold mb-1">Реактивация замерших диалогов</h2>
            <p className="text-sm text-muted-foreground mb-3">Серия сообщений для возврата клиента.</p>
            {msgs.map((msg, i) => (
              <div key={i} className="flex gap-2 items-start">
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2 items-center">
                    <Label className="text-xs whitespace-nowrap">Через (мин):</Label>
                    <Input type="number" value={msg.delay_minutes} onChange={e => { const u = [...msgs]; u[i] = { ...msg, delay_minutes: parseInt(e.target.value) || 0 }; updateForm({ reactivation_messages: u }); }} className="w-24" />
                  </div>
                  <div className="flex items-center gap-1">
                    <Textarea value={msg.message} onChange={e => { const u = [...msgs]; u[i] = { ...msg, message: e.target.value }; updateForm({ reactivation_messages: u }); }} placeholder="Сообщение..." className="min-h-[60px]" />
                  </div>
                  <AIFillBtn fieldKey={`reactivation_${i}`} value={msg.message || ""} context={`Сообщение реактивации #${i+1} для бота на Авито (короткое, мотивирующее вернуться к диалогу)`} onResult={v => { const u = [...msgs]; u[i] = { ...msg, message: v }; updateForm({ reactivation_messages: u }); }} />
                </div>
                <Button variant="ghost" size="icon" onClick={() => updateForm({ reactivation_messages: msgs.filter((_, idx) => idx !== i) })}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => updateForm({ reactivation_messages: [...msgs, { delay_minutes: 60, message: "" }] })}>
              <Plus className="h-4 w-4 mr-1" /> Добавить
            </Button>
          </div>
        );
      }

      case "model": {
        const modelGroups: Record<string, VseGPTModel[]> = {};
        for (const m of vsegptModels) {
          const provider = m.id.split("/")[0] || "other";
          if (!modelGroups[provider]) modelGroups[provider] = [];
          modelGroups[provider].push(m);
        }
        const providerLabels: Record<string, string> = { openai: "OpenAI", google: "Google", anthropic: "Anthropic", deepseek: "DeepSeek", qwen: "Qwen", meta: "Meta", mistralai: "Mistral", cohere: "Cohere", moonshotai: "Moonshot" };

        return (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold mb-1">Модель ИИ</h2>
            <p className="text-sm text-muted-foreground mb-3">Выберите модель из VseGPT.</p>
            {modelsLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground py-4"><Loader2 className="h-4 w-4 animate-spin" />Загрузка...</div>
            ) : vsegptModels.length > 0 ? (
              <div className="space-y-4">
                <div className="p-3 rounded-lg border-2 border-primary bg-primary/5">
                  <span className="text-xs text-muted-foreground">Текущая:</span>
                  <span className="font-medium block">{botForm.ai_model || "не выбрана"}</span>
                </div>
                <Select value={botForm.ai_model || ""} onValueChange={v => updateForm({ ai_model: v })}>
                  <SelectTrigger><SelectValue placeholder="Выберите модель" /></SelectTrigger>
                  <SelectContent className="max-h-[400px]">
                    {Object.entries(modelGroups).sort(([a], [b]) => { const order = ["openai", "google", "anthropic", "deepseek", "qwen", "meta", "mistralai"]; return (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 99 : order.indexOf(b)); }).map(([provider, models]) => (
                      <React.Fragment key={provider}>
                        <SelectItem value={`__group_${provider}`} disabled className="font-semibold text-xs text-muted-foreground">— {providerLabels[provider] || provider} —</SelectItem>
                        {models.map(m => <SelectItem key={m.id} value={m.id}>{m.id}</SelectItem>)}
                      </React.Fragment>
                    ))}
                  </SelectContent>
                </Select>
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Популярные:</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {AI_MODELS.filter(m => vsegptModels.some(vm => vm.id === m.id)).map(m => (
                      <button key={m.id} onClick={() => updateForm({ ai_model: m.id })} className={cn("p-3 rounded-lg border-2 text-left text-sm transition-colors", botForm.ai_model === m.id ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30")}>
                        <span className="font-medium block">{m.label}</span>
                        <span className="text-xs text-muted-foreground">{m.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {AI_MODELS.map(m => (
                  <button key={m.id} onClick={() => updateForm({ ai_model: m.id })} className={cn("p-3 rounded-lg border-2 text-left text-sm transition-colors", botForm.ai_model === m.id ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30")}>
                    <span className="font-medium block">{m.label}</span>
                    <span className="text-xs text-muted-foreground">{m.desc}</span>
                  </button>
                ))}
              </div>
            )}

            <Separator />
            <div>
              <h2 className="text-lg font-semibold mb-1">Апгрейд модели</h2>
              <div className="flex items-center gap-3">
                <Select value={(botForm.upgrade_after_messages || 0) > 0 ? "upgrade" : "none"} onValueChange={v => updateForm({ upgrade_after_messages: v === "none" ? 0 : 5 })}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">Не делать</SelectItem><SelectItem value="upgrade">Переключить после</SelectItem></SelectContent>
                </Select>
                {(botForm.upgrade_after_messages || 0) > 0 && (
                  <>
                    <Input type="number" value={botForm.upgrade_after_messages || 0} onChange={e => updateForm({ upgrade_after_messages: parseInt(e.target.value) || 0 })} className="w-20" min={1} />
                    <span className="text-sm text-muted-foreground">сообщений</span>
                  </>
                )}
              </div>
              {(botForm.upgrade_after_messages || 0) > 0 && (
                <div className="mt-3">
                  <Label className="text-sm mb-1 block">Модель для апгрейда:</Label>
                  <Select value={botForm.upgrade_model || ""} onValueChange={v => updateForm({ upgrade_model: v || null })}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Выберите" /></SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {(vsegptModels.length > 0 ? vsegptModels : AI_MODELS).map((m: any) => <SelectItem key={m.id} value={m.id}>{m.id || m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        );
      }

      case "delay":
        return (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold mb-1">Задержка ответов</h2>
            <p className="text-sm text-muted-foreground mb-3">Рекомендуемая: 60+ секунд.</p>
            <div className="flex items-center gap-3">
              <Input type="number" value={botForm.response_delay_seconds || 0} onChange={e => updateForm({ response_delay_seconds: parseInt(e.target.value) || 0 })} className="w-24" min={0} />
              <span className="text-sm text-muted-foreground">секунд (макс 30 сек в реальности)</span>
            </div>
          </div>
        );

      case "limits":
        return (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold mb-1">Лимиты</h2>
            
            <div className="space-y-2">
              <Label className="text-sm font-medium">Максимум ответов в чате</Label>
              <div className="flex items-center gap-3">
                <Input type="number" value={botForm.max_responses || ""} onChange={e => updateForm({ max_responses: e.target.value ? parseInt(e.target.value) : null })} className="w-24" min={1} placeholder="∞" />
                <span className="text-sm text-muted-foreground">ответов (пусто = без ограничений)</span>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-sm font-medium">Максимум символов в ответе</Label>
              <p className="text-xs text-muted-foreground">Ограничивает длину каждого сообщения робота. Помогает избежать слишком длинных ответов.</p>
              <div className="flex items-center gap-3">
                <Input type="number" value={(botForm as any).max_response_chars || ""} onChange={e => updateForm({ max_response_chars: e.target.value ? parseInt(e.target.value) : null })} className="w-28" min={50} step={50} placeholder="∞" />
                <span className="text-sm text-muted-foreground">символов (пусто = без ограничений)</span>
              </div>
              <div className="flex gap-2 mt-1">
                {[300, 500, 800, 1500].map(v => (
                  <Button key={v} variant={(botForm as any).max_response_chars === v ? "default" : "outline"} size="sm" className="text-xs h-7 px-2" onClick={() => updateForm({ max_response_chars: v })}>
                    {v}
                  </Button>
                ))}
                <Button variant={(botForm as any).max_response_chars === null || !(botForm as any).max_response_chars ? "default" : "outline"} size="sm" className="text-xs h-7 px-2" onClick={() => updateForm({ max_response_chars: null })}>
                  Без лимита
                </Button>
              </div>
            </div>
          </div>
        );

      case "pro":
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2"><h2 className="text-lg font-semibold">Про-режим продавца</h2><Badge variant="secondary">Бета</Badge></div>
            <div className="flex items-center gap-3">
              <Switch checked={botForm.pro_seller_mode || false} onCheckedChange={v => updateForm({ pro_seller_mode: v })} />
              <span className="text-sm">{botForm.pro_seller_mode ? "Включён" : "Выключен"}</span>
            </div>
          </div>
        );

      case "notifications":
        return (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold mb-1">Формат уведомлений</h2>
            <p className="text-sm text-muted-foreground">Выберите, какую информацию получать в Telegram при новых сообщениях.</p>
            <div className="grid grid-cols-1 gap-3">
              {[
                { value: "summary", label: "📩 Краткая сводка", desc: "Имя отправителя и начало сообщения" },
                { value: "full", label: "💬 Полный диалог", desc: "Сообщение клиента + ответ бота" },
                { value: "detailed", label: "📊 Расширенная", desc: "Имя, объявление, ссылка, сообщение, ответ бота, статистика чата" },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => updateForm({ telegram_notification_format: opt.value })}
                  className={cn(
                    "p-4 rounded-lg border-2 text-left transition-colors",
                    botForm.telegram_notification_format === opt.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/30"
                  )}
                >
                  <div className="font-medium text-sm">{opt.label}</div>
                  <div className="text-xs text-muted-foreground mt-1">{opt.desc}</div>
                </button>
              ))}
            </div>
            
            <Separator />
            
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Дополнительные уведомления</h3>
              <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
                <Checkbox
                  checked={(botForm as any).telegram_debug_notifications || false}
                  onCheckedChange={(v) => updateForm({ telegram_debug_notifications: !!v })}
                  className="mt-0.5"
                />
                <div>
                  <Label className="text-sm font-medium">🛠 Отладка</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Получать уведомления об ошибках, пропущенных чатах, стоп-командах и другой технической информации
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
                <Checkbox
                  checked={(botForm as any).telegram_new_chat_notifications !== false}
                  onCheckedChange={(v) => updateForm({ telegram_new_chat_notifications: !!v })}
                  className="mt-0.5"
                />
                <div>
                  <Label className="text-sm font-medium">🆕 Новые чаты</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Уведомлять при появлении нового чата (первое сообщение от клиента)
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
                <Checkbox
                  checked={(botForm as any).telegram_lead_notifications !== false}
                  onCheckedChange={(v) => updateForm({ telegram_lead_notifications: !!v })}
                  className="mt-0.5"
                />
                <div>
                  <Label className="text-sm font-medium">🎯 Лиды</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Уведомлять при обнаружении нового лида
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case "telegram":
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2"><TelegramIcon className="h-5 w-5 text-[#0088cc]" /><h2 className="text-lg font-semibold">Telegram</h2></div>
            <Card className="bg-blue-50/50 border-blue-200">
              <CardContent className="pt-4 space-y-3">
                <p className="text-sm"><strong>Инструкция:</strong></p>
                <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
                  <li>Создайте бота через <a href="https://t.me/BotFather" target="_blank" rel="noopener" className="text-primary underline">@BotFather</a></li>
                  <li>Скопируйте токен</li>
                  <li>Получите Chat ID через <a href="https://t.me/userinfobot" target="_blank" rel="noopener" className="text-primary underline">@userinfobot</a></li>
                </ol>
              </CardContent>
            </Card>
            <div><Label>Токен</Label><Input value={botForm.telegram_bot_token || ""} onChange={e => updateForm({ telegram_bot_token: e.target.value })} placeholder="123456789:ABC..." /></div>
            <div><Label>Chat ID</Label><Input value={botForm.telegram_chat_id || ""} onChange={e => updateForm({ telegram_chat_id: e.target.value })} placeholder="123456789" /></div>
            {botForm.telegram_bot_token && botForm.telegram_chat_id && <Badge className="bg-green-500/20 text-green-700 border-green-300">✓ Подключён</Badge>}
          </div>
        );

      case "ad_filter": {
        const allowedIds: string[] = (botForm as any).allowed_item_ids || [];
        const hasFilter = allowedIds.length > 0;
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Фильтр по объявлениям</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Укажите номера объявлений (ID), на которые этот робот должен отвечать. Если оставить пустым — робот отвечает на все объявления аккаунта.
            </p>
            
            <Card className="bg-blue-50/50 border-blue-200">
              <CardContent className="pt-4">
                <p className="text-sm text-blue-800">
                  <strong>Совет:</strong> Создайте несколько роботов и распределите объявления по группам. 
                  Каждый робот будет обрабатывать только свои объявления с соответствующей настройкой.
                </p>
              </CardContent>
            </Card>

            <div className="flex items-center gap-2">
              <Switch
                checked={hasFilter}
                onCheckedChange={(v) => {
                  if (!v) updateForm({ allowed_item_ids: null });
                  else updateForm({ allowed_item_ids: [] });
                }}
              />
              <span className="text-sm">{hasFilter ? "Фильтр включён — только выбранные объявления" : "Фильтр выключен — все объявления"}</span>
            </div>

            {hasFilter && (
              <div className="space-y-3">
                <Label className="text-sm">ID объявлений (по одному на строку)</Label>
                <Textarea
                  value={allowedIds.join("\n")}
                  onChange={e => {
                    const ids = e.target.value.split("\n").map(s => s.trim()).filter(Boolean);
                    updateForm({ allowed_item_ids: ids });
                  }}
                  placeholder={"123456789\n987654321\n..."}
                  className="min-h-[120px] font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Введено: {allowedIds.length} объявлений. ID можно найти в URL объявления или в разделе «Отладка».
                </p>

                {avitoItems.length > 0 && (
                  <div className="mt-3">
                    <Label className="text-sm mb-2 block">Или выберите из загруженных объявлений:</Label>
                    <div className="max-h-[300px] overflow-y-auto space-y-1 border rounded-lg p-2">
                      {avitoItems.map(item => {
                        const isChecked = allowedIds.includes(item.id);
                        return (
                          <label key={item.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer text-sm">
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={(checked) => {
                                if (checked) updateForm({ allowed_item_ids: [...allowedIds, item.id] });
                                else updateForm({ allowed_item_ids: allowedIds.filter((id: string) => id !== item.id) });
                              }}
                            />
                            <div className="flex items-center gap-2 min-w-0">
                              {item.image && <img src={item.image} className="w-8 h-8 rounded object-cover flex-shrink-0" alt="" />}
                              <div className="min-w-0">
                                <span className="block truncate">{item.title}</span>
                                <span className="text-xs text-muted-foreground">ID: {item.id} • {item.price > 0 ? `${item.price.toLocaleString()} ₽` : ""}</span>
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {avitoItems.length === 0 && (
                  <Button variant="outline" size="sm" onClick={loadAvitoItems} disabled={itemsLoading}>
                    <RefreshCw className={cn("h-4 w-4 mr-1", itemsLoading && "animate-spin")} /> Загрузить объявления с Авито
                  </Button>
                )}
              </div>
            )}
          </div>
        );
      }

      case "handoff": {
        const handoffRules: Array<{ target_bot_id: string; trigger_topics: string[]; description: string; return_back: boolean }> = (botForm as any).handoff_rules || [];
        const otherBots = bots.filter(b => b.id !== bot.id);
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Repeat className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Переключение на другого робота</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Настройте автоматическое переключение разговора на другого робота, когда клиент задаёт определённые вопросы. 
              Контекст беседы сохраняется — новый робот видит всю историю переписки.
            </p>

            {otherBots.length === 0 && (
              <Card className="bg-amber-50/50 border-amber-200">
                <CardContent className="pt-4">
                  <p className="text-sm text-amber-800">Для переключения нужен минимум один другой робот. Создайте ещё одного робота.</p>
                </CardContent>
              </Card>
            )}

            {handoffRules.map((rule, i) => (
              <Card key={i} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs">Правило #{i + 1}</Badge>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateForm({ handoff_rules: handoffRules.filter((_: any, idx: number) => idx !== i) })}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div>
                  <Label className="text-sm">Переключить на робота</Label>
                  <Select value={rule.target_bot_id || ""} onValueChange={v => {
                    const newRules = [...handoffRules];
                    newRules[i] = { ...rule, target_bot_id: v };
                    updateForm({ handoff_rules: newRules });
                  }}>
                    <SelectTrigger><SelectValue placeholder="Выберите робота" /></SelectTrigger>
                    <SelectContent>
                      {otherBots.map(b => <SelectItem key={b.id} value={b.id}>{b.name || "Робот"}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm">Триггерные темы / вопросы</Label>
                  <Textarea
                    value={(rule.trigger_topics || []).join("\n")}
                    onChange={e => {
                      const newRules = [...handoffRules];
                      newRules[i] = { ...rule, trigger_topics: e.target.value.split("\n").map(s => s.trim()).filter(Boolean) };
                      updateForm({ handoff_rules: newRules });
                    }}
                    placeholder={"гарантия\nвозврат товара\nрекламация"}
                    className="min-h-[80px]"
                  />
                  <p className="text-xs text-muted-foreground mt-1">По одной теме на строку. Если клиент задаёт вопрос на эту тему — происходит переключение.</p>
                </div>
                <div>
                  <Label className="text-sm">Описание (для ИИ)</Label>
                  <Input
                    value={rule.description || ""}
                    onChange={e => {
                      const newRules = [...handoffRules];
                      newRules[i] = { ...rule, description: e.target.value };
                      updateForm({ handoff_rules: newRules });
                    }}
                    placeholder="Этот робот специализируется на гарантийных вопросах"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={rule.return_back !== false}
                    onCheckedChange={v => {
                      const newRules = [...handoffRules];
                      newRules[i] = { ...rule, return_back: v };
                      updateForm({ handoff_rules: newRules });
                    }}
                  />
                  <span className="text-sm">Вернуть клиента обратно после завершения</span>
                </div>
              </Card>
            ))}

            <Button variant="outline" onClick={() => updateForm({ handoff_rules: [...handoffRules, { target_bot_id: "", trigger_topics: [], description: "", return_back: true }] })} disabled={otherBots.length === 0}>
              <Plus className="h-4 w-4 mr-1" /> Добавить правило переключения
            </Button>
          </div>
        );
      }

      case "usage_stats": {
        const totalCost = usageLogs.reduce((s, l) => s + Number(l.cost || 0), 0);
        const totalTokens = usageLogs.reduce((s, l) => s + (l.total_tokens || 0), 0);
        const avgCost = usageLogs.length > 0 ? totalCost / usageLogs.length : 0;
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" /><h2 className="text-lg font-semibold">Статистика расходов</h2></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card><CardContent className="py-3 px-4"><div className="text-xs text-muted-foreground">Запросов</div><div className="text-2xl font-bold">{usageLogs.length}</div></CardContent></Card>
              <Card><CardContent className="py-3 px-4"><div className="text-xs text-muted-foreground">Общая стоимость</div><div className="text-2xl font-bold">{totalCost.toFixed(4)} ₽</div></CardContent></Card>
              <Card><CardContent className="py-3 px-4"><div className="text-xs text-muted-foreground">Средняя цена/ответ</div><div className="text-2xl font-bold">{avgCost.toFixed(4)} ₽</div></CardContent></Card>
              <Card><CardContent className="py-3 px-4"><div className="text-xs text-muted-foreground">Всего токенов</div><div className="text-2xl font-bold">{(totalTokens/1000).toFixed(1)}K</div></CardContent></Card>
            </div>
            {usageLoading ? <p className="text-sm text-muted-foreground">Загрузка...</p> : (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b bg-muted/50"><th className="p-2 text-left">Время</th><th className="p-2 text-left">Модель</th><th className="p-2 text-right">Вход</th><th className="p-2 text-right">Выход</th><th className="p-2 text-right">Всего</th><th className="p-2 text-right">Стоимость</th><th className="p-2 text-left">Тип</th></tr></thead>
                      <tbody>
                        {usageLogs.slice(0, 50).map(log => (
                          <tr key={log.id} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="p-2 text-xs text-muted-foreground whitespace-nowrap">{new Date(log.created_at).toLocaleString("ru-RU")}</td>
                            <td className="p-2 text-xs font-mono">{log.model?.split("/").pop()}</td>
                            <td className="p-2 text-right text-xs">{log.prompt_tokens.toLocaleString()}</td>
                            <td className="p-2 text-right text-xs">{log.completion_tokens.toLocaleString()}</td>
                            <td className="p-2 text-right text-xs font-medium">{log.total_tokens.toLocaleString()}</td>
                            <td className="p-2 text-right text-xs font-medium">{Number(log.cost).toFixed(6)}</td>
                            <td className="p-2"><Badge variant="outline" className="text-xs">{log.action_type === "debug" ? "Отладка" : "Чат"}</Badge></td>
                          </tr>
                        ))}
                        {usageLogs.length === 0 && <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">Нет данных. Статистика начнёт собираться с новых сообщений.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        );
      }

      case "debug":
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2"><PlayCircle className="h-5 w-5 text-primary" /><h2 className="text-lg font-semibold">Отладка</h2></div>
            <p className="text-sm text-muted-foreground">Протестируйте бота.</p>
            <div className="flex gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-3">
                  <Button variant="outline" size="sm" onClick={createDebugSession}><MessageSquarePlus className="h-4 w-4 mr-1" /> Новый</Button>
                  {debugSessions.length > 0 && (
                    <Select value={debugSessionId || ""} onValueChange={v => v && loadSessionMessages(v)}>
                      <SelectTrigger className="w-48 h-8 text-xs"><SelectValue placeholder="История" /></SelectTrigger>
                      <SelectContent>{debugSessions.map(s => <SelectItem key={s.id} value={s.id} className="text-xs">{s.avito_user_name || new Date(s.created_at).toLocaleString("ru-RU")}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                  {selectedItemId && <Badge variant="secondary" className="text-xs">📦 {avitoItems.find(i => i.id === selectedItemId)?.title?.substring(0, 30) || selectedItemId}</Badge>}
                </div>
                <Card className="min-h-[400px] flex flex-col">
                  <CardHeader className="pb-2 border-b"><CardTitle className="text-sm flex items-center gap-2"><Bot className="h-4 w-4" />Тест: {bot.name || "бот"}</CardTitle></CardHeader>
                  <CardContent className="flex-1 flex flex-col p-0">
                    <ScrollArea className="flex-1 p-4 overflow-y-auto" style={{ height: "400px" }}>
                      {debugMessages.length === 0 ? (
                        <div className="text-center text-muted-foreground text-sm py-8">Начните диалог</div>
                      ) : (
                        <div className="space-y-3">
                          {debugMessages.map((msg, i) => (
                            <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                              <div className={cn("max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap", msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted")}>{msg.content}</div>
                            </div>
                          ))}
                          {debugLoading && <div className="flex justify-start"><div className="bg-muted rounded-lg px-3 py-2 text-sm flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Думает...</div></div>}
                          <div ref={debugEndRef} />
                        </div>
                      )}
                    </ScrollArea>
                    <div className="p-3 border-t flex gap-2">
                      <Input value={debugInput} onChange={e => setDebugInput(e.target.value)} placeholder="Сообщение..." onKeyDown={e => e.key === "Enter" && handleDebugSend()} disabled={debugLoading} />
                      <Button onClick={handleDebugSend} disabled={!debugInput.trim() || debugLoading}><Send className="h-4 w-4" /></Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
              <div className="w-64 flex-shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs font-medium">Товары на Авито</Label>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={loadAvitoItems} disabled={itemsLoading}><RefreshCw className={cn("h-3 w-3", itemsLoading && "animate-spin")} /></Button>
                </div>
                <ScrollArea className="h-[450px]">
                  {itemsLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground text-xs py-4 justify-center"><Loader2 className="h-4 w-4 animate-spin" />Загрузка...</div>
                  ) : avitoItems.length === 0 ? (
                    <div className="text-center text-muted-foreground text-xs py-4">
                      <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      {itemsError ? <p className="text-destructive">{itemsError}</p> : <p>Нет товаров</p>}
                      <Button variant="outline" size="sm" className="mt-2" onClick={loadAvitoItems}><RefreshCw className="h-3 w-3 mr-1" /> Повторить</Button>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <button onClick={() => setSelectedItemId(null)} className={cn("w-full text-left p-2 rounded-md text-xs transition-colors", !selectedItemId ? "bg-primary/10 border border-primary/30" : "hover:bg-muted border border-transparent")}>Без контекста</button>
                      {avitoItems.map(item => (
                        <button key={item.id} onClick={() => setSelectedItemId(item.id)} className={cn("w-full text-left p-2 rounded-md text-xs transition-colors", selectedItemId === item.id ? "bg-primary/10 border border-primary/30" : "hover:bg-muted border border-transparent")}>
                          <div className="flex gap-2 items-start">
                            {item.image && <img src={item.image} className="w-10 h-10 rounded object-cover flex-shrink-0" alt="" />}
                            <div className="min-w-0"><div className="font-medium truncate">{item.title}</div>{item.price > 0 && <div className="text-muted-foreground">{item.price.toLocaleString()} ₽</div>}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>
          </div>
        );

      case "sales":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2"><ShoppingCart className="h-5 w-5 text-primary" /> Этапы продажи</h2>
                <p className="text-sm text-muted-foreground mt-1">Настройте алгоритм продажи. Робот будет следовать этим этапам при оформлении заказа.</p>
              </div>
              <Button onClick={addSalesStage} size="sm"><Plus className="h-4 w-4 mr-1" /> Добавить этап</Button>
            </div>

            {salesLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center"><Loader2 className="h-5 w-5 animate-spin" />Загрузка...</div>
            ) : salesStages.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                  <p className="text-muted-foreground mb-2">Нет этапов продажи</p>
                  <p className="text-sm text-muted-foreground mb-4">Создайте этапы, по которым робот будет вести клиента к покупке</p>
                  <Button onClick={addSalesStage}><Plus className="h-4 w-4 mr-1" /> Создать первый этап</Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {salesStages.map((stage, idx) => (
                  <Card key={stage.id} className={cn("transition-colors", stage.is_active ? "border-border" : "border-border opacity-60")}>
                    <CardContent className="py-4 px-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-mono">{idx + 1}</Badge>
                        <DebouncedInput
                          value={stage.name}
                          onChange={val => updateSalesStage(stage.id, { name: val })}
                          className="font-semibold h-8"
                          placeholder="Название этапа"
                        />
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveSalesStage(stage.id, "up")} disabled={idx === 0}>
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveSalesStage(stage.id, "down")} disabled={idx === salesStages.length - 1}>
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                          <Switch checked={stage.is_active} onCheckedChange={v => updateSalesStage(stage.id, { is_active: v })} />
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteSalesStage(stage.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">Инструкции для робота на этом этапе</Label>
                        <DebouncedTextarea
                          value={stage.instructions}
                          onChange={val => updateSalesStage(stage.id, { instructions: val })}
                          placeholder="Опишите, что робот должен делать на этом этапе. Например: Уточни у клиента, какой товар его интересует. Предложи варианты из каталога."
                          rows={3}
                        />
                      </div>

                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">Действие</Label>
                        <Select value={stage.action_type} onValueChange={v => updateSalesStage(stage.id, { action_type: v })}>
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Без действия (только диалог)</SelectItem>
                            <SelectItem value="collect_contact">📋 Собрать контакты (имя, телефон, адрес)</SelectItem>
                            <SelectItem value="create_order">🛒 Создать заказ в сервисе</SelectItem>
                            <SelectItem value="confirm_order">✅ Подтвердить заказ</SelectItem>
                          </SelectContent>
                        </Select>
                        {stage.action_type === "collect_contact" && (
                          <p className="text-xs text-muted-foreground mt-1">Робот запросит имя, номер телефона и адрес доставки у клиента</p>
                        )}
                        {stage.action_type === "create_order" && (
                          <p className="text-xs text-muted-foreground mt-1">Робот создаст заказ в вашем сервисе. Заказ появится во вкладке «Заказы». Вам придёт уведомление.</p>
                        )}
                        {stage.action_type === "confirm_order" && (
                          <p className="text-xs text-muted-foreground mt-1">Робот подтвердит заказ и сообщит клиенту итоговую информацию</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}

                <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground space-y-2">
                  <p className="font-medium text-foreground">💡 Как это работает</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Когда клиент хочет купить товар, робот переходит к этапам продажи</li>
                    <li>На каждом этапе робот следует вашим инструкциям</li>
                    <li>Этап «Собрать контакты» — робот запросит имя, телефон и адрес</li>
                    <li>Этап «Создать заказ» — заказ автоматически появится в вашей системе</li>
                    <li>Вы получите уведомление о новом заказе</li>
                  </ol>
                </div>
              </div>
            )}
          </div>
        );

      case "ai_settings":
        return (
          <AISettingsPanel
            botForm={botForm}
            setBotForm={setBotForm}
            onSave={onSave}
            storeId={storeId}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex gap-0 -mx-4 -mt-4 min-h-[calc(100vh-180px)]">
      <div className="w-56 flex-shrink-0 border-r border-border bg-muted/30">
        <div className="p-3 border-b border-border">
          <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2">
            <ArrowLeft className="h-4 w-4" /> Назад
          </button>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm truncate">{bot.name || "Робот"}</span>
          </div>
          <div className="mt-1"><BotStatusIndicator bot={bot} account={account} /></div>
        </div>
        <ScrollArea className="h-[calc(100vh-310px)]">
          <div className="p-2 space-y-3">
            {botSidebarGroups.map(group => (
              <div key={group.label}>
                <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">{group.label}</div>
                <div className="space-y-0.5">
                  {group.items.map(item => {
                    const Icon = item.icon;
                    return (
                      <button key={item.id} onClick={() => setBotSection(item.id)} className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors text-left",
                        botSection === item.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        item.important && botSection !== item.id && "font-medium text-foreground"
                      )}>
                        <Icon className="h-4 w-4 flex-shrink-0" />{item.label}
                        {item.important && botSection !== item.id && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        <div className="p-2 border-t border-border">
          <Button variant="ghost" size="sm" className="w-full text-destructive hover:text-destructive" onClick={onDelete}><Trash2 className="h-4 w-4 mr-1" /> Удалить</Button>
        </div>
      </div>
      <div className="flex-1 flex flex-col">
        <ScrollArea className="flex-1">
          <div className={cn("p-6", (botSection === "debug" || botSection === "ai_settings") ? "max-w-none" : "max-w-2xl")}>{renderSection()}</div>
        </ScrollArea>
        <div className="border-t border-border p-3 flex items-center justify-between bg-card">
          <span className="text-sm text-muted-foreground">Заполните поля и сохраните</span>
          <Button onClick={onSave} disabled={saving}><Save className="h-4 w-4 mr-1" />{saving ? "..." : "Сохранить"}</Button>
        </div>
      </div>
    </div>
  );
}

// ===== AI SETTINGS PANEL =====
interface AISettingsMessage {
  role: "user" | "assistant";
  content: string;
  proposal?: { explanation: string; changes: { field: string; old_value: string; new_value: string }[] } | null;
}

const AGENT_MODELS = [
  { id: "openai/gpt-4.1-nano", label: "GPT 4.1 Nano", desc: "Самая дешёвая и быстрая" },
  { id: "openai/gpt-4.1-mini", label: "GPT 4.1 Mini", desc: "Лучшее соотношение цены/качества" },
  { id: "openai/gpt-4.1", label: "GPT 4.1", desc: "Мощная модель" },
  { id: "openai/gpt-4o-mini", label: "GPT 4o Mini", desc: "Быстрая мультимодальная" },
  { id: "openai/o4-mini", label: "GPT o4 Mini", desc: "С цепочкой рассуждений" },
  { id: "google/gemini-2.5-flash", label: "Gemini Flash 2.5", desc: "Баланс скорости и качества" },
  { id: "google/gemini-2.5-pro", label: "Gemini PRO 2.5", desc: "Мощная для сложных задач" },
  { id: "anthropic/claude-sonnet-4.6", label: "Claude Sonnet 4.6", desc: "Сильная от Anthropic" },
  { id: "anthropic/claude-haiku-4.5", label: "Claude Haiku 4.5", desc: "Быстрая от Anthropic" },
  { id: "deepseek/deepseek-r1", label: "DeepSeek R1", desc: "С рассуждениями" },
  { id: "deepseek/deepseek-v3", label: "DeepSeek V3", desc: "Универсальная" },
];

const SETTINGS_LABELS: Record<string, string> = {
  name: "Имя бота",
  mode: "Режим",
  system_prompt: "Системный промпт",
  ai_model: "Модель ИИ",
  response_delay_seconds: "Задержка ответа (сек)",
  max_responses: "Макс. ответов на чат",
  max_response_chars: "Макс. символов в ответе",
  schedule_mode: "Режим расписания",
  pro_seller_mode: "Про-режим продавца",
  upgrade_after_messages: "Сообщений до смены модели",
  upgrade_model: "Модель для апгрейда",
  seller_stop_command: "Стоп-команда",
  personality_config: "Личность бота",
  instructions_config: "Инструкции",
  lead_conditions: "Условия лида",
  escalation_rules: "Правила эскалации",
  completion_rules: "Правила завершения",
  reactivation_messages: "Реактивация",
  rules_list: "Правила",
  handoff_rules: "Правила переключения",
  telegram_notification_format: "Формат уведомлений",
  allowed_item_ids: "Фильтр объявлений",
};

function AISettingsPanel({ botForm, setBotForm, onSave, storeId }: {
  botForm: any;
  setBotForm: React.Dispatch<React.SetStateAction<any>>;
  onSave: () => void;
  storeId: string | null;
}) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<AISettingsMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [changedFields, setChangedFields] = useState<Set<string>>(new Set());
  const [agentModel, setAgentModel] = useState("openai/gpt-4.1-mini");
  const [editingProposals, setEditingProposals] = useState<Record<string, string>>({});
  const [expandedChanges, setExpandedChanges] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, [messages, loading]);

  const getSettingsSnapshot = () => {
    const keys = Object.keys(SETTINGS_LABELS);
    const snapshot: Record<string, any> = {};
    for (const key of keys) {
      snapshot[key] = botForm[key] ?? null;
    }
    return snapshot;
  };

  const formatValue = (val: any): string => {
    if (val === null || val === undefined || val === "") return "(пусто)";
    if (typeof val === "boolean") return val ? "Да" : "Нет";
    if (typeof val === "object") return JSON.stringify(val, null, 2);
    return String(val);
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    const newMessages: AISettingsMessage[] = [...messages, { role: "user", content: userMsg }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const apiMessages = newMessages.map(m => ({ role: m.role, content: m.content }));
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-bot-settings`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ messages: apiMessages, bot_settings: getSettingsSnapshot(), agent_model: agentModel }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || `Ошибка ${response.status}`);
      if (data?.error) throw new Error(data.error);

      if (data.type === "proposal") {
        setMessages(prev => [...prev, {
          role: "assistant",
          content: data.explanation || data.raw_message || "Предлагаю следующие изменения:",
          proposal: { explanation: data.explanation, changes: data.changes || [] },
        }]);
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: data.content || "..." }]);
      }
    } catch (err: any) {
      toast({ title: "Ошибка AI", description: err.message, variant: "destructive" });
      setMessages(prev => [...prev, { role: "assistant", content: `Ошибка: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const applyChanges = async (changes: { field: string; old_value: string; new_value: string }[]) => {
    const updates: Record<string, any> = {};
    for (const change of changes) {
      let newVal: any = change.new_value;
      // Try to parse JSON for objects/arrays
      try {
        const parsed = JSON.parse(newVal);
        if (typeof parsed === "object") newVal = parsed;
      } catch {}
      // Handle booleans
      if (newVal === "true") newVal = true;
      if (newVal === "false") newVal = false;
      // Handle null
      if (newVal === "null" || newVal === "(пусто)") newVal = null;
      // Handle numbers
      if (typeof newVal === "string" && /^\d+$/.test(newVal)) newVal = parseInt(newVal);

      updates[change.field] = newVal;
    }
    setBotForm((prev: any) => ({ ...prev, ...updates }));
    setChangedFields(prev => {
      const next = new Set(prev);
      changes.forEach(c => next.add(c.field));
      return next;
    });

    // Auto-save
    setTimeout(async () => {
      await onSave();
      toast({ title: "Настройки обновлены ✨", description: `Изменено полей: ${changes.length}` });
    }, 100);

    setMessages(prev => [...prev, { role: "assistant", content: "✅ Изменения применены и сохранены!" }]);
  };

  const settingsKeys = Object.keys(SETTINGS_LABELS);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">AI-агент настроек</h2>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Агент анализирует настройки робота и вносит правки по вашему запросу через VseGPT.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground whitespace-nowrap">Модель агента:</label>
          <select
            value={agentModel}
            onChange={e => setAgentModel(e.target.value)}
            className="text-xs border border-border rounded-md px-2 py-1.5 bg-background text-foreground max-w-[200px]"
          >
            {AGENT_MODELS.map(m => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-4" style={{ height: "calc(100vh - 360px)" }}>
        {/* Chat panel */}
        <div className="flex-1 min-w-0 flex flex-col">
          <Card className="flex-1 flex flex-col min-h-0">
            <CardHeader className="pb-2 border-b flex-shrink-0">
              <CardTitle className="text-sm flex items-center gap-2">
                <Bot className="h-4 w-4" /> Чат с AI
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col p-0 min-h-0">
              <ScrollArea className="flex-1 p-4" style={{ maxHeight: "calc(100vh - 500px)" }}>
                {messages.length === 0 ? (
                  <div className="text-center text-muted-foreground text-sm py-8">
                    <Sparkles className="h-8 w-8 mx-auto mb-3 opacity-30" />
                    <p>Напишите что хотите изменить</p>
                    <p className="text-xs mt-2 max-w-xs mx-auto">
                      Например: «Отвечай короче, максимум 200 символов» или «Будь более дружелюбным»
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((msg, mi) => (
                      <div key={mi}>
                        <div className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                          <div className={cn(
                            "max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                            msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                          )}>
                            {msg.content}
                          </div>
                        </div>
                        {msg.proposal && msg.proposal.changes.length > 0 && (
                          <div className="mt-2 ml-0 max-w-[95%]">
                            <Card className="border-primary/30 bg-primary/5">
                              <CardContent className="py-3 px-3 space-y-3">
                                <p className="text-xs font-semibold text-primary">Предлагаемые изменения:</p>
                                {msg.proposal.changes.map((change, ci) => {
                                  const editKey = `${mi}-${ci}`;
                                  const isEditing = editingProposals[editKey] !== undefined;
                                  const editedValue = editingProposals[editKey] ?? change.new_value;
                                  const isLong = (change.old_value?.length || 0) > 80 || (change.new_value?.length || 0) > 80;
                                  const isExpanded = expandedChanges[editKey];
                                  return (
                                    <div key={ci} className="text-xs space-y-1 border-b border-border/50 pb-2 last:border-0 last:pb-0">
                                      <div className="font-medium flex items-center justify-between">
                                        <span>{SETTINGS_LABELS[change.field] || change.field}</span>
                                        {isLong && (
                                          <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1.5" onClick={() => setExpandedChanges(prev => ({ ...prev, [editKey]: !prev[editKey] }))}>
                                            {isExpanded ? "Свернуть" : "Развернуть"}
                                          </Button>
                                        )}
                                      </div>
                                      <div className={cn("text-destructive bg-destructive/5 rounded p-1.5 border border-destructive/20", isExpanded || !isLong ? "whitespace-pre-wrap break-words" : "line-clamp-3")}>
                                        <span className="line-through">{change.old_value || "(пусто)"}</span>
                                      </div>
                                      {isEditing ? (
                                        <Textarea
                                          className="text-xs min-h-[60px] bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700"
                                          value={editedValue}
                                          onChange={(e) => setEditingProposals(prev => ({ ...prev, [editKey]: e.target.value }))}
                                        />
                                      ) : (
                                        <div className={cn("text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded p-1.5 border border-green-200 dark:border-green-800", isExpanded || !isLong ? "whitespace-pre-wrap break-words" : "line-clamp-3")}>
                                          {change.new_value || "(пусто)"}
                                        </div>
                                      )}
                                      <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1.5" onClick={() => {
                                        if (isEditing) {
                                          setEditingProposals(prev => { const n = { ...prev }; delete n[editKey]; return n; });
                                        } else {
                                          setEditingProposals(prev => ({ ...prev, [editKey]: change.new_value || "" }));
                                        }
                                      }}>
                                        <Pencil className="h-3 w-3 mr-0.5" /> {isEditing ? "Готово" : "Редактировать"}
                                      </Button>
                                    </div>
                                  );
                                })}
                                <div className="flex gap-2 pt-1">
                                  <Button size="sm" className="h-7 text-xs" onClick={() => {
                                    const finalChanges = msg.proposal!.changes.map((ch, ci) => {
                                      const editKey = `${mi}-${ci}`;
                                      return editingProposals[editKey] !== undefined ? { ...ch, new_value: editingProposals[editKey] } : ch;
                                    });
                                    applyChanges(finalChanges);
                                    setEditingProposals({});
                                    setExpandedChanges({});
                                  }}>
                                    <CheckCircle2 className="h-3 w-3 mr-1" /> Подтвердить
                                  </Button>
                                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => {
                                    setEditingProposals({});
                                    setExpandedChanges({});
                                    setMessages(prev => [...prev, { role: "assistant", content: "Отменено. Что хотите изменить?" }]);
                                  }}>
                                    <XCircle className="h-3 w-3 mr-1" /> Отмена
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                        )}
                      </div>
                    ))}
                    {loading && (
                      <div className="flex justify-start">
                        <div className="bg-muted rounded-lg px-3 py-2 text-sm flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" /> Анализирую...
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>
              <div className="p-3 border-t flex gap-2 flex-shrink-0">
                <Input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Опишите что изменить..."
                  onKeyDown={e => e.key === "Enter" && handleSend()}
                  disabled={loading}
                />
                <Button onClick={handleSend} disabled={!input.trim() || loading}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Settings panel */}
        <div className="w-72 flex-shrink-0">
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-2 border-b flex-shrink-0">
              <CardTitle className="text-sm flex items-center gap-2">
                <Settings className="h-4 w-4" /> Текущие настройки
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 min-h-0">
              <ScrollArea className="h-full" style={{ maxHeight: "calc(100vh - 500px)" }}>
                <div className="divide-y divide-border">
                  {settingsKeys.map(key => {
                    const isChanged = changedFields.has(key);
                    return (
                      <div key={key} className={cn(
                        "px-3 py-2 transition-colors",
                        isChanged && "bg-green-50 dark:bg-green-950/20"
                      )}>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                            {SETTINGS_LABELS[key]}
                          </span>
                          {isChanged && <CheckCircle2 className="h-3 w-3 text-green-600 flex-shrink-0" />}
                        </div>
                        <div className="text-xs mt-0.5 text-foreground break-all max-h-20 overflow-hidden">
                          {formatValue(botForm[key])}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ===== Reusable List Editor =====
function ListEditor({ title, desc, items, onAdd, onUpdate, onRemove, placeholder, onAiFill, aiFillingField }: {
  title: string; desc: string; items: string[];
  onAdd: () => void; onUpdate: (i: number, v: string) => void; onRemove: (i: number) => void;
  placeholder: string;
  onAiFill?: () => void;
  aiFillingField?: string | null;
}) {
  const isGenerating = !!aiFillingField && ["leads_gen", "escalation_gen", "completion_gen"].includes(aiFillingField);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h2 className="text-lg font-semibold mb-1">{title}</h2><p className="text-sm text-muted-foreground">{desc}</p></div>
        {onAiFill && (
          <Button variant="ghost" size="sm" className="text-primary gap-1 h-7 px-2 text-xs shrink-0" disabled={isGenerating} onClick={onAiFill}>
            {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {items.length > 0 ? "Улучшить ИИ" : "Заполнить ИИ"}
          </Button>
        )}
      </div>
      {items.map((item, i) => (
        <div key={i} className="flex gap-2">
          <Input value={item} onChange={e => onUpdate(i, e.target.value)} placeholder={placeholder} />
          <Button variant="ghost" size="icon" onClick={() => onRemove(i)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={onAdd}><Plus className="h-4 w-4 mr-1" /> Добавить</Button>
    </div>
  );
}
