import React, { useState, useEffect, useRef, useCallback } from "react";
import { Bot, MessageCircle, Settings, Users, Sparkles, Power, Save, Plus, Trash2, Clock, Shield, Bell, Zap, ChevronRight, RefreshCw, KeyRound, ArrowLeft, Edit, HelpCircle, PlayCircle, Send, Loader2, Package, MessageSquarePlus, History } from "lucide-react";
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

type TopLevel = "bots" | "accounts" | "chats";
type BotSection = "general" | "prompt" | "qa" | "leads" | "escalation" | "completion" | "schedule" | "reactivation" | "model" | "delay" | "limits" | "pro" | "notifications" | "telegram" | "debug";

const botSidebarItems: { id: BotSection; label: string; icon: React.ElementType }[] = [
  { id: "general", label: "Основные", icon: Bot },
  { id: "prompt", label: "Промпт", icon: Sparkles },
  { id: "qa", label: "Вопрос-ответ", icon: HelpCircle },
  { id: "leads", label: "Лиды", icon: Users },
  { id: "escalation", label: "Эскалация", icon: Shield },
  { id: "completion", label: "Завершение", icon: ChevronRight },
  { id: "schedule", label: "График", icon: Clock },
  { id: "reactivation", label: "Реактивация", icon: RefreshCw },
  { id: "model", label: "Модель ИИ", icon: Zap },
  { id: "delay", label: "Задержка", icon: Clock },
  { id: "limits", label: "Лимиты", icon: Shield },
  { id: "pro", label: "Про-режим", icon: Sparkles },
  { id: "notifications", label: "Уведомления", icon: Bell },
  { id: "telegram", label: "Telegram", icon: Bell },
  { id: "debug", label: "Отладка", icon: PlayCircle },
];

// ===== Debounced Q&A Input =====
function DebouncedInput({ value: externalValue, onChange, ...props }: { value: string; onChange: (val: string) => void } & Omit<React.ComponentProps<typeof Input>, "value" | "onChange">) {
  const [value, setValue] = useState(externalValue);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setValue(externalValue);
  }, [externalValue]);

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

  useEffect(() => {
    setValue(externalValue);
  }, [externalValue]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    setValue(newVal);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => onChange(newVal), 600);
  };

  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

  return <Textarea {...props} value={value} onChange={handleChange} />;
}

export function AvitoBotSection({ storeId }: AvitoBotSectionProps) {
  const { toast } = useToast();
  const { bots, loading, saving, createBot, saveBot, deleteBot, toggleBot, processMessages, fetchChats, refetch } = useAvitoBots(storeId);
  
  const [topLevel, setTopLevel] = useState<TopLevel>("bots");
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
  const [botForm, setBotForm] = useState<Partial<AvitoBot> & { telegram_bot_token?: string; telegram_chat_id?: string }>({});
  const [qaItems, setQaItems] = useState<QAItem[]>([]);
  const [qaLoading, setQaLoading] = useState(false);

  const editingBot = bots.find(b => b.id === editingBotId) || null;

  const loadAccounts = async () => {
    if (!storeId) return;
    setAccountsLoading(true);
    try {
      const { data, error } = await supabase
        .from("avito_accounts")
        .select("*")
        .eq("store_id", storeId);
      if (error) throw error;
      setAccounts((data || []) as AvitoAccount[]);
    } catch (err: any) {
      console.error(err);
    } finally {
      setAccountsLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, [storeId]);

  useEffect(() => {
    if (editingBot) {
      setBotForm({
        name: editingBot.name || "",
        mode: editingBot.mode || "smart",
        system_prompt: editingBot.system_prompt || "",
        lead_conditions: Array.isArray(editingBot.lead_conditions) ? editingBot.lead_conditions : [],
        escalation_rules: Array.isArray(editingBot.escalation_rules) ? editingBot.escalation_rules : [],
        completion_rules: Array.isArray(editingBot.completion_rules) ? editingBot.completion_rules : [],
        schedule_mode: (editingBot.schedule_mode as any) || "24/7",
        reactivation_messages: Array.isArray(editingBot.reactivation_messages) ? editingBot.reactivation_messages : [],
        ai_model: editingBot.ai_model || "google/gemini-3-flash-preview",
        upgrade_after_messages: editingBot.upgrade_after_messages || 0,
        upgrade_model: editingBot.upgrade_model || null,
        response_delay_seconds: editingBot.response_delay_seconds || 60,
        max_responses: editingBot.max_responses,
        pro_seller_mode: editingBot.pro_seller_mode || false,
        telegram_notification_format: editingBot.telegram_notification_format || "summary",
        avito_account_id: (editingBot as any).avito_account_id || null,
        telegram_bot_token: (editingBot as any).telegram_bot_token || "",
        telegram_chat_id: (editingBot as any).telegram_chat_id || "",
      });
      loadQAItems(editingBot.id);
    }
  }, [editingBot]);

  const loadQAItems = async (botId: string) => {
    setQaLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("avito_bot_qa")
        .select("*")
        .eq("bot_id", botId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      setQaItems((data || []) as QAItem[]);
    } catch (err: any) {
      console.error("Error loading Q&A:", err);
    } finally {
      setQaLoading(false);
    }
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
      const { error } = await supabase
        .from("avito_accounts")
        .insert({
          store_id: storeId,
          client_id: newAccountClientId,
          client_secret: newAccountClientSecret,
          profile_name: newAccountName || null,
        } as any);
      if (error) throw error;
      toast({ title: "Аккаунт добавлен" });
      setNewAccountClientId("");
      setNewAccountClientSecret("");
      setNewAccountName("");
      loadAccounts();
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    }
  };

  const handleDeleteAccount = async (id: string) => {
    try {
      const { error } = await supabase.from("avito_accounts").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Аккаунт удалён" });
      loadAccounts();
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    }
  };

  const loadChats = async () => {
    const c = await fetchChats();
    setChats(c);
  };

  useEffect(() => {
    if (topLevel === "chats") loadChats();
  }, [topLevel]);

  const handleAddQA = async () => {
    if (!editingBotId) return;
    try {
      const { error } = await (supabase as any)
        .from("avito_bot_qa")
        .insert({
          bot_id: editingBotId,
          question: "",
          answer: "",
          match_mode: "fuzzy",
          sort_order: qaItems.length,
        });
      if (error) throw error;
      loadQAItems(editingBotId);
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    }
  };

  const handleUpdateQA = async (id: string, updates: Partial<QAItem>) => {
    try {
      const { error } = await (supabase as any)
        .from("avito_bot_qa")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
      setQaItems(prev => prev.map(q => q.id === id ? { ...q, ...updates } : q));
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    }
  };

  const handleDeleteQA = async (id: string) => {
    try {
      const { error } = await (supabase as any)
        .from("avito_bot_qa")
        .delete()
        .eq("id", id);
      if (error) throw error;
      setQaItems(prev => prev.filter(q => q.id !== id));
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Загрузка...</div>;
  }

  if (editingBotId && editingBot) {
    return <BotEditor
      bot={editingBot}
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
      onDelete={async () => { await deleteBot(editingBotId); setEditingBotId(null); }}
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
          {[
            { id: "bots" as TopLevel, label: "Роботы", icon: Bot },
            { id: "accounts" as TopLevel, label: "Аккаунты Авито", icon: KeyRound },
            { id: "chats" as TopLevel, label: "Чаты", icon: MessageCircle },
          ].map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setTopLevel(item.id)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors text-left",
                  topLevel === item.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {item.label}
                {item.id === "bots" && bots.length > 0 && (
                  <Badge variant="secondary" className="ml-auto text-xs">{bots.length}</Badge>
                )}
                {item.id === "accounts" && accounts.length > 0 && (
                  <Badge variant="secondary" className="ml-auto text-xs">{accounts.length}</Badge>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1">
        <ScrollArea className="h-[calc(100vh-180px)]">
          <div className="max-w-3xl p-6">
            {topLevel === "bots" && (
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
              />
            )}
            {topLevel === "accounts" && (
              <AccountsView
                accounts={accounts}
                loading={accountsLoading}
                newName={newAccountName}
                setNewName={setNewAccountName}
                newClientId={newAccountClientId}
                setNewClientId={setNewAccountClientId}
                newClientSecret={newAccountClientSecret}
                setNewClientSecret={setNewAccountClientSecret}
                onAdd={handleAddAccount}
                onDelete={handleDeleteAccount}
              />
            )}
            {topLevel === "chats" && (
              <ChatsView chats={chats} onRefresh={loadChats} />
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

// ===== BOTS LIST =====
function BotsListView({ bots, accounts, showNewBot, setShowNewBot, newBotName, setNewBotName, newBotAccountId, setNewBotAccountId, onCreateBot, onEditBot, onToggle }: {
  bots: AvitoBot[];
  accounts: AvitoAccount[];
  showNewBot: boolean;
  setShowNewBot: (v: boolean) => void;
  newBotName: string;
  setNewBotName: (v: string) => void;
  newBotAccountId: string;
  setNewBotAccountId: (v: string) => void;
  onCreateBot: () => void;
  onEditBot: (id: string) => void;
  onToggle: (id: string, active: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Роботы</h2>
          <p className="text-sm text-muted-foreground">Создавайте и настраивайте роботов для автоматических ответов на Авито</p>
        </div>
        <Button onClick={() => setShowNewBot(true)}>
          <Plus className="h-4 w-4 mr-1" /> Новый робот
        </Button>
      </div>

      {showNewBot && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div>
              <Label>Имя робота</Label>
              <Input value={newBotName} onChange={e => setNewBotName(e.target.value)} placeholder="Например: Помощница Вероника" />
            </div>
            <div>
              <Label>Привязать к аккаунту Авито</Label>
              <Select value={newBotAccountId} onValueChange={setNewBotAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите аккаунт (необязательно)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Без привязки</SelectItem>
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.profile_name || a.client_id}</SelectItem>
                  ))}
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
          <p className="text-sm text-muted-foreground">Создайте первого робота, чтобы начать автоматизировать ответы на Авито</p>
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
                        {bot.is_active && <Badge className="bg-green-500/20 text-green-700 border-green-300 text-xs">Активен</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <span>{AI_MODELS.find(m => m.id === bot.ai_model)?.label || bot.ai_model}</span>
                      </div>
                      <div className="text-xs mt-0.5 flex items-center gap-1.5">
                        {account ? (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <KeyRound className="h-3 w-3" />
                            {account.profile_name || account.client_id}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-amber-600">
                            <KeyRound className="h-3 w-3" />
                            Аккаунт не привязан
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
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
  accounts: AvitoAccount[];
  loading: boolean;
  newName: string;
  setNewName: (v: string) => void;
  newClientId: string;
  setNewClientId: (v: string) => void;
  newClientSecret: string;
  setNewClientSecret: (v: string) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Аккаунты Авито</h2>
        <p className="text-sm text-muted-foreground">Подключайте несколько аккаунтов Авито и привязывайте к ним роботов</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Добавить аккаунт</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Название (для себя)</Label>
            <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Магазин электроники" />
          </div>
          <div>
            <Label>Client ID</Label>
            <Input value={newClientId} onChange={e => setNewClientId(e.target.value)} placeholder="Авито Client ID" />
          </div>
          <div>
            <Label>Client Secret</Label>
            <Input type="password" value={newClientSecret} onChange={e => setNewClientSecret(e.target.value)} placeholder="Авито Client Secret" />
          </div>
          <Button onClick={onAdd} disabled={!newClientId || !newClientSecret}>
            <Plus className="h-4 w-4 mr-1" /> Добавить аккаунт
          </Button>
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
                </div>
                <Button variant="ghost" size="icon" onClick={() => onDelete(acc.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ===== CHATS VIEW =====
function ChatsView({ chats, onRefresh }: { chats: AvitoBotChat[]; onRefresh: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Чаты</h2>
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4 mr-1" /> Обновить
        </Button>
      </div>
      {chats.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Чатов пока нет. Включите робота и он начнёт обрабатывать сообщения с Авито.
        </p>
      ) : (
        <div className="space-y-2">
          {chats.map(chat => (
            <Card key={chat.id} className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-sm">{chat.avito_user_name || "Пользователь"}</span>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">Сообщений: {chat.messages_count}</Badge>
                    <Badge variant="outline" className="text-xs">Ответов бота: {chat.bot_responses_count}</Badge>
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
      )}
    </div>
  );
}

// ===== BOT EDITOR (dual pane) =====
function BotEditor({ bot, botForm, setBotForm, botSection, setBotSection, saving, accounts, storeId, qaItems, qaLoading, onAddQA, onUpdateQA, onDeleteQA, onSave, onBack, onToggle, onProcess, onDelete }: {
  bot: AvitoBot;
  botForm: Partial<AvitoBot> & { telegram_bot_token?: string; telegram_chat_id?: string };
  setBotForm: React.Dispatch<React.SetStateAction<Partial<AvitoBot> & { telegram_bot_token?: string; telegram_chat_id?: string }>>;
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
  
  // Debug state
  const [debugMessages, setDebugMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [debugInput, setDebugInput] = useState("");
  const [debugLoading, setDebugLoading] = useState(false);
  const [debugSessionId, setDebugSessionId] = useState<string | null>(null);
  const [debugSessions, setDebugSessions] = useState<{ id: string; created_at: string; avito_user_name: string | null }[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [avitoItems, setAvitoItems] = useState<AvitoItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  // VseGPT models
  const [vsegptModels, setVsegptModels] = useState<VseGPTModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);

  const debugEndRef = useRef<HTMLDivElement>(null);

  const updateForm = (updates: Partial<AvitoBot> & { telegram_bot_token?: string; telegram_chat_id?: string }) => setBotForm(prev => ({ ...prev, ...updates }));

  const addListItem = (field: "lead_conditions" | "escalation_rules" | "completion_rules") => {
    const arr = (botForm[field] as string[]) || [];
    updateForm({ [field]: [...arr, ""] } as any);
  };
  const updateListItem = (field: "lead_conditions" | "escalation_rules" | "completion_rules", index: number, value: string) => {
    const arr = [...((botForm[field] as string[]) || [])];
    arr[index] = value;
    updateForm({ [field]: arr } as any);
  };
  const removeListItem = (field: "lead_conditions" | "escalation_rules" | "completion_rules", index: number) => {
    const arr = ((botForm[field] as string[]) || []).filter((_, i) => i !== index);
    updateForm({ [field]: arr } as any);
  };

  // Scroll to bottom of debug chat
  useEffect(() => {
    setTimeout(() => {
      debugEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 100);
  }, [debugMessages, debugLoading]);

  // Load debug sessions
  const loadDebugSessions = useCallback(async () => {
    try {
      const { data } = await (supabase as any)
        .from("avito_bot_chats")
        .select("id, created_at, avito_user_name")
        .eq("store_id", storeId || bot.store_id)
        .eq("avito_chat_id", `debug_${bot.id}`)
        .order("created_at", { ascending: false });
      setDebugSessions(data || []);
    } catch {
      // ignore
    }
  }, [bot.id, storeId]);

  // Create new debug session
  const createDebugSession = useCallback(async () => {
    try {
      const sid = storeId || bot.store_id;
      const { data, error } = await (supabase as any)
        .from("avito_bot_chats")
        .insert({
          store_id: sid,
          avito_chat_id: `debug_${bot.id}_${Date.now()}`,
          avito_user_id: "debug",
          avito_user_name: `Отладка ${new Date().toLocaleString("ru-RU")}`,
          status: "active",
        })
        .select()
        .single();
      if (error) throw error;
      setDebugSessionId(data.id);
      setDebugMessages([]);
      loadDebugSessions();
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    }
  }, [bot.id, storeId, toast, loadDebugSessions]);

  // Load session messages
  const loadSessionMessages = useCallback(async (sessionId: string) => {
    setDebugSessionId(sessionId);
    try {
      const { data } = await (supabase as any)
        .from("avito_bot_messages")
        .select("*")
        .eq("chat_id", sessionId)
        .order("created_at", { ascending: true });
      if (data) {
        setDebugMessages(data.map((m: any) => ({ role: m.role as "user" | "assistant", content: m.content })));
      }
    } catch {
      // ignore
    }
  }, []);

  // Load avito items
  const [itemsError, setItemsError] = useState<string | null>(null);
  const loadAvitoItems = useCallback(async () => {
    setItemsLoading(true);
    setItemsError(null);
    try {
      const { data, error } = await supabase.functions.invoke("avito-bot", {
        body: { action: "list_items", bot_id: bot.id, store_id: storeId || bot.store_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAvitoItems(data.items || []);
    } catch (err: any) {
      console.error("Failed to load Avito items:", err);
      setItemsError(err.message || "Не удалось загрузить товары");
    } finally {
      setItemsLoading(false);
    }
  }, [bot.id, storeId]);

  // Load VseGPT models
  const loadVsegptModels = useCallback(async () => {
    setModelsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("avito-bot", {
        body: { action: "fetch_models" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setVsegptModels(data.models || []);
    } catch (err: any) {
      console.error("Failed to load VseGPT models:", err);
    } finally {
      setModelsLoading(false);
    }
  }, []);

  // Load debug sessions and items when debug tab is opened
  useEffect(() => {
    if (botSection === "debug") {
      loadDebugSessions();
      loadAvitoItems();
    }
  }, [botSection, loadDebugSessions, loadAvitoItems]);

  // Load models when model tab is opened
  useEffect(() => {
    if (botSection === "model") {
      loadVsegptModels();
    }
  }, [botSection, loadVsegptModels]);

  const handleDebugSend = async () => {
    if (!debugInput.trim() || debugLoading) return;
    const userMsg = debugInput.trim();
    setDebugInput("");
    setDebugMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setDebugLoading(true);

    // If no session, create one first
    let sessionId = debugSessionId;
    if (!sessionId) {
      try {
        const sid = storeId || bot.store_id;
        const { data, error } = await (supabase as any)
          .from("avito_bot_chats")
          .insert({
            store_id: sid,
            avito_chat_id: `debug_${bot.id}_${Date.now()}`,
            avito_user_id: "debug",
            avito_user_name: `Отладка ${new Date().toLocaleString("ru-RU")}`,
            status: "active",
          })
          .select()
          .single();
        if (error) throw error;
        sessionId = data.id;
        setDebugSessionId(data.id);
        loadDebugSessions();
      } catch (err: any) {
        toast({ title: "Ошибка создания сессии", description: err.message, variant: "destructive" });
        setDebugLoading(false);
        return;
      }
    }

    try {
      const { data, error } = await supabase.functions.invoke("avito-bot", {
        body: { 
          action: "debug_chat", 
          bot_id: bot.id, 
          message: userMsg, 
          item_id: selectedItemId,
          debug_session_id: sessionId,
          store_id: storeId || bot.store_id,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setDebugMessages(prev => [...prev, { role: "assistant", content: data.response || "..." }]);
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
      setDebugMessages(prev => [...prev, { role: "assistant", content: `Ошибка: ${err.message}` }]);
    } finally {
      setDebugLoading(false);
    }
  };

  const renderSection = () => {
    switch (botSection) {
      case "general":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-1">Назовите бота</h2>
              <p className="text-sm text-muted-foreground mb-3">Название поможет различать ботов.</p>
              <Input value={botForm.name || ""} onChange={e => updateForm({ name: e.target.value })} placeholder="Мой Авитобот" />
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-1">Аккаунт Авито</h2>
              <p className="text-sm text-muted-foreground mb-3">Привяжите робота к аккаунту Авито, чтобы он мог отвечать на сообщения и загружать товары в отладке.</p>
              {!(botForm as any).avito_account_id || (botForm as any).avito_account_id === "none" ? (
                <div className="mb-3 p-3 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-sm flex items-center gap-2">
                  <KeyRound className="h-4 w-4 flex-shrink-0" />
                  Робот не привязан к аккаунту. Без привязки отладка и автоответы не будут работать.
                </div>
              ) : null}
              <Select value={(botForm as any).avito_account_id || "none"} onValueChange={v => updateForm({ avito_account_id: v === "none" ? null : v } as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите аккаунт" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Не привязан</SelectItem>
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.profile_name || a.client_id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {accounts.length === 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  У вас нет аккаунтов Авито. Перейдите в раздел «Аккаунты Авито» в боковом меню, чтобы добавить.
                </p>
              )}
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-1">Статус бота</h2>
              <div className="flex items-center gap-3 mt-2">
                <Switch checked={bot.is_active} onCheckedChange={onToggle} />
                <span className="text-sm">{bot.is_active ? "Бот активен" : "Бот выключен"}</span>
                {bot.is_active && <Badge className="bg-green-500/20 text-green-700 border-green-300">Работает</Badge>}
              </div>
            </div>

            <Separator />

            <div>
              <h2 className="text-lg font-semibold mb-1">Режим настройки</h2>
              <p className="text-sm text-muted-foreground mb-3">Умная настройка подойдет для всех. Опытные могут попробовать режим для профессионалов.</p>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => updateForm({ mode: "smart" } as any)} className={cn("p-4 rounded-lg border-2 text-left transition-colors", botForm.mode === "smart" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30")}>
                  <span className="text-2xl mb-2 block">🐱</span>
                  <span className="font-medium">Умная настройка</span>
                </button>
                <button onClick={() => updateForm({ mode: "pro" } as any)} className={cn("p-4 rounded-lg border-2 text-left transition-colors", botForm.mode === "pro" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30")}>
                  <span className="text-2xl mb-2 block">💻</span>
                  <span className="font-medium">Для профессионалов</span>
                </button>
              </div>
            </div>

            <Separator />
            <div className="flex items-center gap-2">
              <Button onClick={onProcess} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-1" /> Проверить сообщения
              </Button>
              <span className="text-xs text-muted-foreground">Запустить обработку новых сообщений вручную</span>
            </div>
          </div>
        );

      case "prompt":
        return (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold mb-1">Что бот должен знать?</h2>
            <p className="text-sm text-muted-foreground mb-3">Введите, что должен знать бот. Схема: ключевые задачи, техники убеждения, ограничения, персона бота, примеры диалогов.</p>
            <Textarea value={botForm.system_prompt || ""} onChange={e => updateForm({ system_prompt: e.target.value })} placeholder="Ты — продавец на Авито..." className="min-h-[300px]" />
          </div>
        );

      case "qa":
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold mb-1">База вопросов и ответов</h2>
              <p className="text-sm text-muted-foreground mb-3">Добавьте типовые вопросы и ответы. Бот будет использовать их при общении с клиентами.</p>
            </div>
            
            {qaLoading ? (
              <div className="text-center py-8 text-muted-foreground">Загрузка...</div>
            ) : (
              <>
                {qaItems.map((qa, i) => (
                  <Card key={qa.id} className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">#{i + 1}</span>
                      <div className="flex items-center gap-2">
                        <Select value={qa.match_mode} onValueChange={v => onUpdateQA(qa.id, { match_mode: v as "exact" | "fuzzy" })}>
                          <SelectTrigger className="w-32 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fuzzy">Примерное</SelectItem>
                            <SelectItem value="exact">Точное</SelectItem>
                          </SelectContent>
                        </Select>
                        <Switch checked={qa.is_active} onCheckedChange={v => onUpdateQA(qa.id, { is_active: v })} />
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDeleteQA(qa.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Вопрос клиента</Label>
                      <DebouncedInput 
                        value={qa.question} 
                        onChange={val => onUpdateQA(qa.id, { question: val })} 
                        placeholder="Например: Какая доставка?" 
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Ответ бота</Label>
                      <DebouncedTextarea 
                        value={qa.answer} 
                        onChange={val => onUpdateQA(qa.id, { answer: val })} 
                        placeholder="Доставляем в течение 1-2 дней..." 
                        className="min-h-[80px]"
                      />
                    </div>
                  </Card>
                ))}

                <Button variant="outline" onClick={onAddQA}>
                  <Plus className="h-4 w-4 mr-1" /> Добавить вопрос-ответ
                </Button>
              </>
            )}
          </div>
        );

      case "leads":
        return <ListEditor title="Когда создавать лид?" desc="По умолчанию лид создаётся при получении контакта клиента." items={(botForm.lead_conditions as string[]) || []} onAdd={() => addListItem("lead_conditions")} onUpdate={(i, v) => updateListItem("lead_conditions", i, v)} onRemove={(i) => removeListItem("lead_conditions", i)} placeholder="Условие создания лида..." />;

      case "escalation":
        return <ListEditor title="Когда бот должен попросить помощи?" desc="Укажите случаи, когда бот обязан передать диалог человеку." items={(botForm.escalation_rules as string[]) || []} onAdd={() => addListItem("escalation_rules")} onUpdate={(i, v) => updateListItem("escalation_rules", i, v)} onRemove={(i) => removeListItem("escalation_rules", i)} placeholder="Правило эскалации..." />;

      case "completion":
        return <ListEditor title="Когда считать диалог завершённым?" desc="Опишите признаки завершённого диалога." items={(botForm.completion_rules as string[]) || []} onAdd={() => addListItem("completion_rules")} onUpdate={(i, v) => updateListItem("completion_rules", i, v)} onRemove={(i) => removeListItem("completion_rules", i)} placeholder="Признак завершения..." />;

      case "schedule":
        return (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold mb-1">График работы бота</h2>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: "24/7", label: "Круглосуточно", icon: "🕐" },
                { value: "no_response", label: "Не отвечать вне часов", icon: "🚫" },
                { value: "schedule", label: "По расписанию", icon: "📅" },
              ].map(opt => (
                <button key={opt.value} onClick={() => updateForm({ schedule_mode: opt.value as any })} className={cn("p-3 rounded-lg border-2 text-left text-sm transition-colors", botForm.schedule_mode === opt.value ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30")}>
                  <span className="text-lg block mb-1">{opt.icon}</span>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        );

      case "reactivation": {
        const msgs = (botForm.reactivation_messages as any[]) || [];
        return (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold mb-1">Реактивация замерших диалогов</h2>
            <p className="text-sm text-muted-foreground mb-3">Серия сообщений для возврата клиента в диалог.</p>
            {msgs.map((msg, i) => (
              <div key={i} className="flex gap-2 items-start">
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2 items-center">
                    <Label className="text-xs whitespace-nowrap">Через (мин):</Label>
                    <Input type="number" value={msg.delay_minutes} onChange={e => { const u = [...msgs]; u[i] = { ...msg, delay_minutes: parseInt(e.target.value) || 0 }; updateForm({ reactivation_messages: u } as any); }} className="w-24" />
                  </div>
                  <Textarea value={msg.message} onChange={e => { const u = [...msgs]; u[i] = { ...msg, message: e.target.value }; updateForm({ reactivation_messages: u } as any); }} placeholder="Сообщение..." className="min-h-[60px]" />
                </div>
                <Button variant="ghost" size="icon" onClick={() => updateForm({ reactivation_messages: msgs.filter((_, idx) => idx !== i) } as any)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => updateForm({ reactivation_messages: [...msgs, { delay_minutes: 60, message: "" }] } as any)}>
              <Plus className="h-4 w-4 mr-1" /> Добавить сообщение
            </Button>
          </div>
        );
      }

      case "model": {
        // Group VseGPT models by provider
        const modelGroups: Record<string, VseGPTModel[]> = {};
        for (const m of vsegptModels) {
          const provider = m.id.split("/")[0] || "other";
          if (!modelGroups[provider]) modelGroups[provider] = [];
          modelGroups[provider].push(m);
        }
        const providerLabels: Record<string, string> = {
          openai: "OpenAI",
          google: "Google",
          anthropic: "Anthropic",
          deepseek: "DeepSeek",
          qwen: "Qwen",
          meta: "Meta",
          mistralai: "Mistral",
          cohere: "Cohere",
          moonshotai: "Moonshot",
        };

        return (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold mb-1">Модель искусственного интеллекта</h2>
            <p className="text-sm text-muted-foreground mb-3">Выберите модель из доступных на VseGPT. Чем сложнее взаимодействие, тем более продвинутую модель стоит выбрать.</p>
            
            {modelsLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                Загрузка моделей...
              </div>
            ) : vsegptModels.length > 0 ? (
              <div className="space-y-4">
                {/* Current selection */}
                <div className="p-3 rounded-lg border-2 border-primary bg-primary/5">
                  <span className="text-xs text-muted-foreground">Текущая модель:</span>
                  <span className="font-medium block">{botForm.ai_model || "не выбрана"}</span>
                </div>
                
                {/* Search/Select */}
                <Select value={botForm.ai_model || ""} onValueChange={v => updateForm({ ai_model: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите модель" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[400px]">
                    {Object.entries(modelGroups)
                      .sort(([a], [b]) => {
                        const order = ["openai", "google", "anthropic", "deepseek", "qwen", "meta", "mistralai"];
                        return (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 99 : order.indexOf(b));
                      })
                      .map(([provider, models]) => (
                        <React.Fragment key={provider}>
                          <SelectItem value={`__group_${provider}`} disabled className="font-semibold text-xs text-muted-foreground">
                            — {providerLabels[provider] || provider} —
                          </SelectItem>
                          {models.map(m => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.id}
                            </SelectItem>
                          ))}
                        </React.Fragment>
                      ))}
                  </SelectContent>
                </Select>

                {/* Quick picks for popular models */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Популярные модели:</Label>
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
              /* Fallback to static list */
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
              <h2 className="text-lg font-semibold mb-1">Делать бота умнее после нескольких сообщений</h2>
              <div className="flex items-center gap-3">
                <Select value={(botForm.upgrade_after_messages || 0) > 0 ? "upgrade" : "none"} onValueChange={v => updateForm({ upgrade_after_messages: v === "none" ? 0 : 5 })}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Не делать</SelectItem>
                    <SelectItem value="upgrade">Переключить модель после</SelectItem>
                  </SelectContent>
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
                  <Label className="text-sm mb-1 block">Модель для продвинутых сообщений:</Label>
                  {vsegptModels.length > 0 ? (
                    <Select value={botForm.upgrade_model || ""} onValueChange={v => updateForm({ upgrade_model: v || null })}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Выберите модель" /></SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        {vsegptModels.map(m => <SelectItem key={m.id} value={m.id}>{m.id}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Select value={botForm.upgrade_model || ""} onValueChange={v => updateForm({ upgrade_model: v || null })}>
                      <SelectTrigger className="w-64"><SelectValue placeholder="Выберите модель" /></SelectTrigger>
                      <SelectContent>{AI_MODELS.map(m => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
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
            <p className="text-sm text-muted-foreground mb-3">Рекомендуемая задержка: 1 минута и более.</p>
            <div className="flex items-center gap-3">
              <Input type="number" value={botForm.response_delay_seconds || 0} onChange={e => updateForm({ response_delay_seconds: parseInt(e.target.value) || 0 })} className="w-24" min={0} />
              <span className="text-sm text-muted-foreground">секунд</span>
            </div>
          </div>
        );

      case "limits":
        return (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold mb-1">Максимальное количество ответов</h2>
            <p className="text-sm text-muted-foreground mb-3">Помогает уменьшить количество сжигаемых токенов.</p>
            <div className="flex items-center gap-3">
              <Input type="number" value={botForm.max_responses || ""} onChange={e => updateForm({ max_responses: e.target.value ? parseInt(e.target.value) : null })} className="w-24" min={1} placeholder="∞" />
              <span className="text-sm text-muted-foreground">ответов (пусто = без ограничений)</span>
            </div>
          </div>
        );

      case "pro":
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">Режим профессионального продавца</h2>
              <Badge variant="secondary">Бета</Badge>
            </div>
            <p className="text-sm text-muted-foreground">Экспериментальный режим продавца. Может как улучшить, так и ухудшить продажи.</p>
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
            <p className="text-sm text-muted-foreground mb-3">Как вы хотите получать информацию о новых сообщениях?</p>
            <div className="grid grid-cols-2 gap-3">
              {[{ value: "summary", label: "Краткая сводка" }, { value: "full", label: "Полный диалог" }].map(opt => (
                <button key={opt.value} onClick={() => updateForm({ telegram_notification_format: opt.value })} className={cn("p-3 rounded-lg border-2 text-sm transition-colors", botForm.telegram_notification_format === opt.value ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30")}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        );

      case "telegram":
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <TelegramIcon className="h-5 w-5 text-[#0088cc]" />
              <h2 className="text-lg font-semibold">Уведомления в Telegram</h2>
            </div>
            <p className="text-sm text-muted-foreground">Подключите Telegram-бота для получения уведомлений о новых сообщениях.</p>

            <Card className="bg-blue-50/50 border-blue-200">
              <CardContent className="pt-4 space-y-3">
                <p className="text-sm">
                  <strong>Инструкция:</strong>
                </p>
                <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
                  <li>Создайте бота в Telegram через <a href="https://t.me/BotFather" target="_blank" rel="noopener" className="text-primary underline">@BotFather</a></li>
                  <li>Скопируйте токен бота и вставьте ниже</li>
                  <li>Напишите вашему боту любое сообщение</li>
                  <li>Получите ваш Chat ID через <a href="https://t.me/userinfobot" target="_blank" rel="noopener" className="text-primary underline">@userinfobot</a></li>
                </ol>
              </CardContent>
            </Card>

            <div>
              <Label>Токен Telegram бота</Label>
              <Input 
                value={botForm.telegram_bot_token || ""} 
                onChange={e => updateForm({ telegram_bot_token: e.target.value })} 
                placeholder="123456789:ABCdefGhIJKlmnoPQRstuVWXyz" 
              />
            </div>
            <div>
              <Label>Chat ID (ваш или группы)</Label>
              <Input 
                value={botForm.telegram_chat_id || ""} 
                onChange={e => updateForm({ telegram_chat_id: e.target.value })} 
                placeholder="123456789" 
              />
            </div>

            {botForm.telegram_bot_token && botForm.telegram_chat_id && (
              <Badge className="bg-green-500/20 text-green-700 border-green-300">
                ✓ Telegram подключён
              </Badge>
            )}
          </div>
        );

      case "debug":
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <PlayCircle className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Режим отладки</h2>
            </div>
            <p className="text-sm text-muted-foreground">Протестируйте бота в реальном времени. Выберите товар справа, чтобы задать контекст объявления.</p>

            <div className="flex gap-4">
              {/* Chat panel */}
              <div className="flex-1 min-w-0">
                {/* Session controls */}
                <div className="flex items-center gap-2 mb-3">
                  <Button variant="outline" size="sm" onClick={createDebugSession}>
                    <MessageSquarePlus className="h-4 w-4 mr-1" /> Новый диалог
                  </Button>
                  {debugSessions.length > 0 && (
                    <Select value={debugSessionId || ""} onValueChange={v => v && loadSessionMessages(v)}>
                      <SelectTrigger className="w-48 h-8 text-xs">
                        <SelectValue placeholder="История диалогов" />
                      </SelectTrigger>
                      <SelectContent>
                        {debugSessions.map(s => (
                          <SelectItem key={s.id} value={s.id} className="text-xs">
                            {s.avito_user_name || new Date(s.created_at).toLocaleString("ru-RU")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {selectedItemId && (
                    <Badge variant="secondary" className="text-xs">
                      📦 {avitoItems.find(i => i.id === selectedItemId)?.title?.substring(0, 30) || selectedItemId}
                    </Badge>
                  )}
                </div>

                <Card className="min-h-[400px] flex flex-col">
                  <CardHeader className="pb-2 border-b">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Bot className="h-4 w-4" />
                      Тестовый диалог с {bot.name || "ботом"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col p-0">
                    <ScrollArea className="flex-1 p-4" style={{ maxHeight: "calc(100vh - 400px)", minHeight: "300px" }}>
                      {debugMessages.length === 0 ? (
                        <div className="text-center text-muted-foreground text-sm py-8">
                          Начните диалог, отправив сообщение ниже
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {debugMessages.map((msg, i) => (
                            <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                              <div className={cn(
                                "max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                                msg.role === "user" 
                                  ? "bg-primary text-primary-foreground" 
                                  : "bg-muted"
                              )}>
                                {msg.content}
                              </div>
                            </div>
                          ))}
                          {debugLoading && (
                            <div className="flex justify-start">
                              <div className="bg-muted rounded-lg px-3 py-2 text-sm flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Бот думает...
                              </div>
                            </div>
                          )}
                          <div ref={debugEndRef} />
                        </div>
                      )}
                    </ScrollArea>
                    <div className="p-3 border-t flex gap-2">
                      <Input 
                        value={debugInput} 
                        onChange={e => setDebugInput(e.target.value)} 
                        placeholder="Введите сообщение..." 
                        onKeyDown={e => e.key === "Enter" && handleDebugSend()}
                        disabled={debugLoading}
                      />
                      <Button onClick={handleDebugSend} disabled={!debugInput.trim() || debugLoading}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Avito items panel */}
              <div className="w-64 flex-shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs font-medium">Товары на Авито</Label>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={loadAvitoItems} disabled={itemsLoading}>
                    <RefreshCw className={cn("h-3 w-3", itemsLoading && "animate-spin")} />
                  </Button>
                </div>
                <ScrollArea className="h-[450px]">
                  {itemsLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground text-xs py-4 justify-center">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Загрузка...
                    </div>
                  ) : avitoItems.length === 0 ? (
                    <div className="text-center text-muted-foreground text-xs py-4">
                      <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      {itemsError ? (
                        <p className="text-destructive">{itemsError}</p>
                      ) : (
                        <p>Нет товаров или аккаунт не привязан</p>
                      )}
                      <Button variant="outline" size="sm" className="mt-2" onClick={loadAvitoItems}>
                        <RefreshCw className="h-3 w-3 mr-1" /> Повторить
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <button
                        onClick={() => setSelectedItemId(null)}
                        className={cn(
                          "w-full text-left p-2 rounded-md text-xs transition-colors",
                          !selectedItemId ? "bg-primary/10 border border-primary/30" : "hover:bg-muted border border-transparent"
                        )}
                      >
                        Без контекста товара
                      </button>
                      {avitoItems.map(item => (
                        <button
                          key={item.id}
                          onClick={() => setSelectedItemId(item.id)}
                          className={cn(
                            "w-full text-left p-2 rounded-md text-xs transition-colors",
                            selectedItemId === item.id ? "bg-primary/10 border border-primary/30" : "hover:bg-muted border border-transparent"
                          )}
                        >
                          <div className="flex gap-2 items-start">
                            {item.image && (
                              <img src={item.image} className="w-10 h-10 rounded object-cover flex-shrink-0" alt="" />
                            )}
                            <div className="min-w-0">
                              <div className="font-medium truncate">{item.title}</div>
                              {item.price > 0 && <div className="text-muted-foreground">{item.price.toLocaleString()} ₽</div>}
                            </div>
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

      default:
        return null;
    }
  };

  return (
    <div className="flex gap-0 -mx-4 -mt-4 min-h-[calc(100vh-180px)]">
      <div className="w-56 flex-shrink-0 border-r border-border bg-muted/30">
        <div className="p-3 border-b border-border">
          <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2">
            <ArrowLeft className="h-4 w-4" /> Назад к роботам
          </button>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm truncate">{bot.name || "Робот"}</span>
          </div>
        </div>
        <ScrollArea className="h-[calc(100vh-280px)]">
          <div className="p-2 space-y-0.5">
            {botSidebarItems.map(item => {
              const Icon = item.icon;
              return (
                <button key={item.id} onClick={() => setBotSection(item.id)} className={cn("w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors text-left", botSection === item.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </ScrollArea>
        <div className="p-2 border-t border-border">
          <Button variant="ghost" size="sm" className="w-full text-destructive hover:text-destructive" onClick={onDelete}>
            <Trash2 className="h-4 w-4 mr-1" /> Удалить робота
          </Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <ScrollArea className="flex-1">
          <div className={cn("p-6", botSection === "debug" ? "max-w-none" : "max-w-2xl")}>{renderSection()}</div>
        </ScrollArea>
        <div className="border-t border-border p-3 flex items-center justify-between bg-card">
          <span className="text-sm text-muted-foreground">Заполните все необходимые поля и сохраните изменения</span>
          <Button onClick={onSave} disabled={saving}>
            <Save className="h-4 w-4 mr-1" />
            {saving ? "Сохранение..." : "Сохранить"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ===== Reusable List Editor =====
function ListEditor({ title, desc, items, onAdd, onUpdate, onRemove, placeholder }: {
  title: string; desc: string; items: string[];
  onAdd: () => void; onUpdate: (i: number, v: string) => void; onRemove: (i: number) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold mb-1">{title}</h2>
        <p className="text-sm text-muted-foreground mb-3">{desc}</p>
      </div>
      {items.map((item, i) => (
        <div key={i} className="flex gap-2">
          <Input value={item} onChange={e => onUpdate(i, e.target.value)} placeholder={placeholder} />
          <Button variant="ghost" size="icon" onClick={() => onRemove(i)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={onAdd}>
        <Plus className="h-4 w-4 mr-1" /> Добавить
      </Button>
    </div>
  );
}
