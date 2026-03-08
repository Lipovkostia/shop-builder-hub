import React, { useState, useEffect } from "react";
import { Bot, MessageCircle, Settings, Users, Sparkles, Power, Save, Plus, Trash2, Clock, Shield, Bell, Zap, ChevronRight, RefreshCw } from "lucide-react";
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
import { useAvitoBot, AI_MODELS, AvitoBot } from "@/hooks/useAvitoBot";
import { cn } from "@/lib/utils";

interface AvitoBotSectionProps {
  storeId: string | null;
}

type SidebarSection = "general" | "prompt" | "leads" | "escalation" | "completion" | "schedule" | "reactivation" | "model" | "delay" | "limits" | "pro" | "notifications" | "chats";

const sidebarItems: { id: SidebarSection; label: string; icon: React.ElementType }[] = [
  { id: "general", label: "Основные", icon: Bot },
  { id: "prompt", label: "Промпт", icon: Sparkles },
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
  { id: "chats", label: "Чаты", icon: MessageCircle },
];

export function AvitoBotSection({ storeId }: AvitoBotSectionProps) {
  const { bot, chats, loading, saving, saveBot, toggleBot, processMessages } = useAvitoBot(storeId);
  const [activeSection, setActiveSection] = useState<SidebarSection>("general");

  // Local state for editing
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"smart" | "pro">("smart");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [leadConditions, setLeadConditions] = useState<string[]>([]);
  const [escalationRules, setEscalationRules] = useState<string[]>([]);
  const [completionRules, setCompletionRules] = useState<string[]>([]);
  const [scheduleMode, setScheduleMode] = useState<"24/7" | "no_response" | "schedule">("24/7");
  const [reactivationMessages, setReactivationMessages] = useState<{ delay_minutes: number; message: string }[]>([]);
  const [aiModel, setAiModel] = useState("google/gemini-3-flash-preview");
  const [upgradeAfter, setUpgradeAfter] = useState(0);
  const [upgradeModel, setUpgradeModel] = useState<string | null>(null);
  const [responseDelay, setResponseDelay] = useState(60);
  const [maxResponses, setMaxResponses] = useState<number | null>(null);
  const [proSellerMode, setProSellerMode] = useState(false);
  const [notificationFormat, setNotificationFormat] = useState("summary");

  // Sync from bot
  useEffect(() => {
    if (bot) {
      setName(bot.name || "");
      setMode(bot.mode as "smart" | "pro" || "smart");
      setSystemPrompt(bot.system_prompt || "");
      setLeadConditions(Array.isArray(bot.lead_conditions) ? bot.lead_conditions : []);
      setEscalationRules(Array.isArray(bot.escalation_rules) ? bot.escalation_rules : []);
      setCompletionRules(Array.isArray(bot.completion_rules) ? bot.completion_rules : []);
      setScheduleMode(bot.schedule_mode as any || "24/7");
      setReactivationMessages(Array.isArray(bot.reactivation_messages) ? bot.reactivation_messages : []);
      setAiModel(bot.ai_model || "google/gemini-3-flash-preview");
      setUpgradeAfter(bot.upgrade_after_messages || 0);
      setUpgradeModel(bot.upgrade_model || null);
      setResponseDelay(bot.response_delay_seconds || 60);
      setMaxResponses(bot.max_responses);
      setProSellerMode(bot.pro_seller_mode || false);
      setNotificationFormat(bot.telegram_notification_format || "summary");
    }
  }, [bot]);

  const handleSave = async () => {
    await saveBot({
      name,
      mode,
      system_prompt: systemPrompt,
      lead_conditions: leadConditions,
      escalation_rules: escalationRules,
      completion_rules: completionRules,
      schedule_mode: scheduleMode,
      reactivation_messages: reactivationMessages,
      ai_model: aiModel,
      upgrade_after_messages: upgradeAfter,
      upgrade_model: upgradeModel,
      response_delay_seconds: responseDelay,
      max_responses: maxResponses,
      pro_seller_mode: proSellerMode,
      telegram_notification_format: notificationFormat,
    });
  };

  const addListItem = (setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter(prev => [...prev, ""]);
  };

  const updateListItem = (setter: React.Dispatch<React.SetStateAction<string[]>>, index: number, value: string) => {
    setter(prev => prev.map((item, i) => i === index ? value : item));
  };

  const removeListItem = (setter: React.Dispatch<React.SetStateAction<string[]>>, index: number) => {
    setter(prev => prev.filter((_, i) => i !== index));
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Загрузка...</div>;
  }

  const renderSection = () => {
    switch (activeSection) {
      case "general":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-1">Назовите бота</h2>
              <p className="text-sm text-muted-foreground mb-3">Название поможет различать ботов, когда у вас их будет много.</p>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Мой Авитобот" />
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-1">Статус бота</h2>
              <div className="flex items-center gap-3 mt-2">
                <Switch checked={bot?.is_active || false} onCheckedChange={active => toggleBot(active)} />
                <span className="text-sm">{bot?.is_active ? "Бот активен" : "Бот выключен"}</span>
                {bot?.is_active && <Badge className="bg-green-500/20 text-green-700 border-green-300">Работает</Badge>}
              </div>
            </div>

            <Separator />

            <div>
              <h2 className="text-lg font-semibold mb-1">Режим настройки</h2>
              <p className="text-sm text-muted-foreground mb-3">
                Умная настройка подойдет для всех пользователей. Опытные пользователи могут попробовать режим для профессионалов.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setMode("smart")}
                  className={cn(
                    "p-4 rounded-lg border-2 text-left transition-colors",
                    mode === "smart" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"
                  )}
                >
                  <span className="text-2xl mb-2 block">🐱</span>
                  <span className="font-medium">Умная настройка</span>
                </button>
                <button
                  onClick={() => setMode("pro")}
                  className={cn(
                    "p-4 rounded-lg border-2 text-left transition-colors",
                    mode === "pro" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"
                  )}
                >
                  <span className="text-2xl mb-2 block">💻</span>
                  <span className="font-medium">Для профессионалов</span>
                </button>
              </div>
            </div>

            <Separator />

            <div className="flex items-center gap-2">
              <Button onClick={() => processMessages()} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-1" /> Проверить сообщения
              </Button>
              <span className="text-xs text-muted-foreground">Запустить обработку новых сообщений вручную</span>
            </div>
          </div>
        );

      case "prompt":
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold mb-1">Что бот должен знать?</h2>
              <p className="text-sm text-muted-foreground mb-3">
                Введите или надиктуйте, что должен знать бот, чтобы быть вашим продавцом. Вот примерная схема промпта:
              </p>
              <ul className="text-sm text-muted-foreground list-disc pl-5 mb-3 space-y-1">
                <li>Ключевые задачи</li>
                <li>Техники убеждения</li>
                <li>Ограничения</li>
                <li>Персона бота</li>
                <li>Примеры успешных диалогов</li>
              </ul>
            </div>
            <Textarea
              value={systemPrompt}
              onChange={e => setSystemPrompt(e.target.value)}
              placeholder="Ты — продавец на Авито. Твоя задача — помочь клиенту с выбором товара и оформить заказ..."
              className="min-h-[300px]"
            />
          </div>
        );

      case "leads":
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold mb-1">Когда создавать лид?</h2>
              <p className="text-sm text-muted-foreground mb-3">
                По умолчанию, бот создает лид как только клиент отправил любой из трех своих контактов: email, телефон или Телеграм. 
                Здесь вы можете изменить условия создания лида.
              </p>
            </div>
            {leadConditions.map((cond, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={cond}
                  onChange={e => updateListItem(setLeadConditions, i, e.target.value)}
                  placeholder="Условие создания лида..."
                />
                <Button variant="ghost" size="icon" onClick={() => removeListItem(setLeadConditions, i)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => addListItem(setLeadConditions)}>
              <Plus className="h-4 w-4 mr-1" /> Добавить
            </Button>
          </div>
        );

      case "escalation":
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold mb-1">Когда бот должен попросить помощи?</h2>
              <p className="text-sm text-muted-foreground mb-3">
                По умолчанию, при недостатке информации для ответа бот просит помощи оператора. 
                Вы можете дополнительно указать, в каких случаях бот обязан передать диалог человеку.
              </p>
            </div>
            {escalationRules.map((rule, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={rule}
                  onChange={e => updateListItem(setEscalationRules, i, e.target.value)}
                  placeholder="Правило эскалации..."
                />
                <Button variant="ghost" size="icon" onClick={() => removeListItem(setEscalationRules, i)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => addListItem(setEscalationRules)}>
              <Plus className="h-4 w-4 mr-1" /> Добавить
            </Button>
          </div>
        );

      case "completion":
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold mb-1">Когда считать диалог завершённым?</h2>
              <p className="text-sm text-muted-foreground mb-3">
                При необходимости опишите признаки завершённого диалога — то есть не требующего последующих ответов от бота.
              </p>
            </div>
            {completionRules.map((rule, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={rule}
                  onChange={e => updateListItem(setCompletionRules, i, e.target.value)}
                  placeholder="Признак завершения..."
                />
                <Button variant="ghost" size="icon" onClick={() => removeListItem(setCompletionRules, i)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => addListItem(setCompletionRules)}>
              <Plus className="h-4 w-4 mr-1" /> Добавить
            </Button>
          </div>
        );

      case "schedule":
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold mb-1">График работы бота</h2>
              <p className="text-sm text-muted-foreground mb-3">
                Установите время, в которое бот будет отвечать клиентам.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: "24/7", label: "В режиме 24/7", icon: "🕐" },
                { value: "no_response", label: "Если вы не отвечаете...", icon: "💤" },
                { value: "schedule", label: "По графику", icon: "📅" },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setScheduleMode(opt.value as any)}
                  className={cn(
                    "p-3 rounded-lg border-2 text-left text-sm transition-colors",
                    scheduleMode === opt.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/30"
                  )}
                >
                  <span className="text-lg block mb-1">{opt.icon}</span>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        );

      case "reactivation":
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold mb-1">Реактивация замерших диалогов</h2>
              <p className="text-sm text-muted-foreground mb-3">
                Серия сообщений для попытки вернуть клиента в диалог после того как он перестал отвечать.
              </p>
            </div>
            {reactivationMessages.map((msg, i) => (
              <div key={i} className="flex gap-2 items-start">
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2 items-center">
                    <Label className="text-xs whitespace-nowrap">Через (мин):</Label>
                    <Input
                      type="number"
                      value={msg.delay_minutes}
                      onChange={e => {
                        const updated = [...reactivationMessages];
                        updated[i] = { ...msg, delay_minutes: parseInt(e.target.value) || 0 };
                        setReactivationMessages(updated);
                      }}
                      className="w-24"
                    />
                  </div>
                  <Textarea
                    value={msg.message}
                    onChange={e => {
                      const updated = [...reactivationMessages];
                      updated[i] = { ...msg, message: e.target.value };
                      setReactivationMessages(updated);
                    }}
                    placeholder="Сообщение для клиента..."
                    className="min-h-[60px]"
                  />
                </div>
                <Button variant="ghost" size="icon" onClick={() => setReactivationMessages(prev => prev.filter((_, idx) => idx !== i))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReactivationMessages(prev => [...prev, { delay_minutes: 60, message: "" }])}
            >
              <Plus className="h-4 w-4 mr-1" /> Добавить сообщение
            </Button>
          </div>
        );

      case "model":
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold mb-1">Модель искусственного интеллекта</h2>
              <p className="text-sm text-muted-foreground mb-3">
                Чем сложнее взаимодействие с клиентом, тем более продвинутую модель ИИ стоит выбрать.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {AI_MODELS.map(m => (
                <button
                  key={m.id}
                  onClick={() => setAiModel(m.id)}
                  className={cn(
                    "p-3 rounded-lg border-2 text-left text-sm transition-colors",
                    aiModel === m.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/30"
                  )}
                >
                  <span className="font-medium block">{m.label}</span>
                  <span className="text-xs text-muted-foreground">{m.desc}</span>
                </button>
              ))}
            </div>

            <Separator />

            <div>
              <h2 className="text-lg font-semibold mb-1">Делать бота умнее после нескольких сообщений</h2>
              <p className="text-sm text-muted-foreground mb-3">
                Первые сообщения обычно простые — для них можно использовать дешёвую модель, а потом переключиться на продвинутую.
              </p>
              <div className="flex items-center gap-3">
                <Select value={upgradeAfter > 0 ? "upgrade" : "none"} onValueChange={v => setUpgradeAfter(v === "none" ? 0 : 5)}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Не делать</SelectItem>
                    <SelectItem value="upgrade">Переключить модель после</SelectItem>
                  </SelectContent>
                </Select>
                {upgradeAfter > 0 && (
                  <>
                    <Input
                      type="number"
                      value={upgradeAfter}
                      onChange={e => setUpgradeAfter(parseInt(e.target.value) || 0)}
                      className="w-20"
                      min={1}
                    />
                    <span className="text-sm text-muted-foreground">сообщений</span>
                  </>
                )}
              </div>
              {upgradeAfter > 0 && (
                <div className="mt-3">
                  <Label className="text-sm mb-1 block">Модель для продвинутых сообщений:</Label>
                  <Select value={upgradeModel || ""} onValueChange={v => setUpgradeModel(v || null)}>
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Выберите модель" />
                    </SelectTrigger>
                    <SelectContent>
                      {AI_MODELS.map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        );

      case "delay":
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold mb-1">Задержка ответов</h2>
              <p className="text-sm text-muted-foreground mb-3">
                Задержка ответов поможет, если вы не хотите, чтобы ваш клиент догадался, что общается с ботом. 
                Она также полезна, если человек пишет короткими фразами — бот дождётся, пока клиент сформулирует мысль полностью. 
                Рекомендуемая задержка: 1 минута и более.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                value={responseDelay}
                onChange={e => setResponseDelay(parseInt(e.target.value) || 0)}
                className="w-24"
                min={0}
              />
              <span className="text-sm text-muted-foreground">секунд</span>
            </div>
          </div>
        );

      case "limits":
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold mb-1">Максимальное количество ответов</h2>
              <p className="text-sm text-muted-foreground mb-3">
                Количество ответов, которое бот может отправить в одном диалоге. Помогает уменьшить количество сжигаемых токенов. 
                При достижении лимита бот будет поставлен на паузу.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                value={maxResponses || ""}
                onChange={e => setMaxResponses(e.target.value ? parseInt(e.target.value) : null)}
                className="w-24"
                min={1}
                placeholder="∞"
              />
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
            <p className="text-sm text-muted-foreground">
              Экспериментальный режим, в котором бот начинает вести себя как продавец. 
              Этот режим может как улучшить, так и ухудшить ваши продажи: всё зависит от настроек выше.
            </p>
            <div className="flex items-center gap-3">
              <Switch checked={proSellerMode} onCheckedChange={setProSellerMode} />
              <span className="text-sm">{proSellerMode ? "Включён" : "Выключен"}</span>
            </div>
          </div>
        );

      case "notifications":
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold mb-1">Как формировать уведомление в Telegram?</h2>
              <p className="text-sm text-muted-foreground mb-3">
                Как вы хотели бы получать информацию о лидах и диалогах бота?
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: "summary", label: "Краткая сводка" },
                { value: "full", label: "Полный диалог" },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setNotificationFormat(opt.value)}
                  className={cn(
                    "p-3 rounded-lg border-2 text-sm transition-colors",
                    notificationFormat === opt.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/30"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        );

      case "chats":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Чаты бота</h2>
              <Button variant="outline" size="sm" onClick={() => processMessages()}>
                <RefreshCw className="h-4 w-4 mr-1" /> Обновить
              </Button>
            </div>
            {chats.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Чатов пока нет. Включите бота и он начнёт обрабатывать сообщения с Авито.
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
                        {new Date(chat.last_message_at).toLocaleString("ru-RU")}
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex gap-0 -mx-4 -mt-4 min-h-[calc(100vh-180px)]">
      {/* Left Sidebar */}
      <div className="w-56 flex-shrink-0 border-r border-border bg-muted/30">
        <div className="p-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm">Авитобот</span>
          </div>
        </div>
        <ScrollArea className="h-[calc(100vh-240px)]">
          <div className="p-2 space-y-0.5">
            {sidebarItems.map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors text-left",
                    activeSection === item.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Right Content */}
      <div className="flex-1 flex flex-col">
        <ScrollArea className="flex-1">
          <div className="max-w-2xl p-6">
            {renderSection()}
          </div>
        </ScrollArea>

        {/* Bottom bar */}
        {activeSection !== "chats" && (
          <div className="border-t border-border p-3 flex items-center justify-between bg-card">
            <span className="text-sm text-muted-foreground">
              Заполните все необходимые поля и сохраните изменения
            </span>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-1" />
              {saving ? "Сохранение..." : "Сохранить"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
