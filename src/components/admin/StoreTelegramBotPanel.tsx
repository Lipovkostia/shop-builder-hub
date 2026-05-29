import { useEffect, useState } from "react";
import { Loader2, Send, ExternalLink, Bot, Trash2, CheckCircle2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface StoreTelegramBotPanelProps {
  storeId: string | null;
  subdomain: string;
}

interface BotRow {
  bot_username: string | null;
  bot_id: number | null;
  enabled: boolean;
  webhook_set: boolean;
  webapp_url: string | null;
  welcome_message: string | null;
}

export function StoreTelegramBotPanel({ storeId, subdomain }: StoreTelegramBotPanelProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [token, setToken] = useState("");
  const [welcome, setWelcome] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [bot, setBot] = useState<BotRow | null>(null);

  const load = async () => {
    if (!storeId) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from("store_telegram_bots")
      .select("bot_username, bot_id, enabled, webhook_set, webapp_url, welcome_message")
      .eq("store_id", storeId)
      .maybeSingle();
    if (data) {
      setBot(data);
      setWelcome(data.welcome_message || "");
      setEnabled(data.enabled);
    } else {
      setBot(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const callSetup = async (action: string, payload: Record<string, unknown> = {}) => {
    if (!storeId) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("store-telegram-setup", {
        body: { storeId, action, ...payload },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    } catch (e: any) {
      toast.error(e.message || "Ошибка");
      throw e;
    } finally {
      setSaving(false);
    }
  };

  const handleConnect = async () => {
    if (!token.trim()) {
      toast.error("Введите токен бота");
      return;
    }
    try {
      const res = await callSetup("save", {
        botToken: token.trim(),
        welcomeMessage: welcome || null,
        enabled,
      });
      toast.success(`Бот @${(res as any).bot_username} подключён!`);
      setToken("");
      await load();
    } catch {
      /* handled */
    }
  };

  const handleSaveSettings = async () => {
    try {
      await callSetup("update", { welcomeMessage: welcome || null, enabled });
      toast.success("Настройки сохранены");
      await load();
    } catch {/* */}
  };

  const handleDisconnect = async () => {
    if (!confirm("Отключить Telegram бота от магазина?")) return;
    try {
      await callSetup("delete");
      toast.success("Бот отключён");
      setBot(null);
    } catch {/* */}
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          Telegram Mini App
        </h3>
        <p className="text-sm text-muted-foreground">
          Подключите Telegram-бота, чтобы покупатели могли открыть ваш магазин прямо в Telegram —
          с категориями, товарами, фото и ценами. Каталог и цены берутся из настроек розничной
          витрины.
        </p>
      </div>

      {!bot ? (
        <div className="space-y-4">
          <Alert>
            <AlertDescription className="text-sm space-y-2">
              <p className="font-medium">Как получить токен бота:</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>
                  Откройте{" "}
                  <a
                    href="https://t.me/BotFather"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    @BotFather
                  </a>{" "}
                  в Telegram
                </li>
                <li>
                  Отправьте команду <code className="bg-muted px-1 rounded">/newbot</code> и
                  следуйте инструкциям
                </li>
                <li>Скопируйте полученный токен и вставьте ниже</li>
              </ol>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="bot-token">Токен бота</Label>
            <Input
              id="bot-token"
              type="password"
              placeholder="123456789:AAEhBOweik6ad6PsVkdjjasdkajsd"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="welcome-msg">
              Приветственное сообщение{" "}
              <span className="text-muted-foreground font-normal">(необязательно)</span>
            </Label>
            <Textarea
              id="welcome-msg"
              rows={3}
              placeholder="👋 Добро пожаловать! Нажмите кнопку ниже, чтобы открыть наш каталог."
              value={welcome}
              onChange={(e) => setWelcome(e.target.value)}
            />
          </div>

          <Button onClick={handleConnect} disabled={saving} size="lg">
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Подключить бота
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:bg-emerald-950/30 dark:border-emerald-900">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5" />
                <div>
                  <div className="font-semibold">
                    Бот @{bot.bot_username} подключён
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Вебхук установлен. Покупатели могут открыть магазин из Telegram.
                  </div>
                </div>
              </div>
              <Button variant="outline" size="sm" asChild>
                <a
                  href={`https://t.me/${bot.bot_username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4" />
                  Открыть бота
                </a>
              </Button>
            </div>
          </div>

          {bot.webapp_url && (
            <div className="space-y-2">
              <Label>URL мини-приложения</Label>
              <div className="flex gap-2">
                <Input value={bot.webapp_url} readOnly className="font-mono text-xs" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(bot.webapp_url!);
                    toast.success("Скопировано");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Это адрес витрины <code>/retail/{subdomain}</code>, который открывается в Telegram.
                Каталог и цены управляются в разделах «Розничная витрина» и «Прайс-листы».
              </p>
            </div>
          )}

          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div>
              <div className="font-medium">Бот включён</div>
              <div className="text-sm text-muted-foreground">
                Когда выключен — бот не отвечает на сообщения
              </div>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="welcome-edit">Приветственное сообщение</Label>
            <Textarea
              id="welcome-edit"
              rows={4}
              value={welcome}
              onChange={(e) => setWelcome(e.target.value)}
              placeholder="👋 Добро пожаловать в магазин! Нажмите кнопку ниже."
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSaveSettings} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Сохранить
            </Button>
            <Button variant="destructive" onClick={handleDisconnect} disabled={saving}>
              <Trash2 className="h-4 w-4" />
              Отключить бота
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
