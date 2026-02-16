import { useState } from 'react';
import { Bot, CheckCircle, ExternalLink, Loader2, Send } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface TelegramBotSectionProps {
  session: { access_token: string } | null;
}

export default function TelegramBotSection({ session }: TelegramBotSectionProps) {
  const { toast } = useToast();
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [webhookSet, setWebhookSet] = useState(false);

  const setupWebhook = async () => {
    if (!session?.access_token) return;
    setIsSettingUp(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-webhook`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'setup' }),
        }
      );
      const data = await res.json();
      if (data.ok) {
        setWebhookSet(true);
        toast({ title: 'Готово', description: 'Вебхук Telegram успешно установлен' });
      } else {
        throw new Error(data.description || 'Ошибка установки вебхука');
      }
    } catch (e: any) {
      toast({ title: 'Ошибка', description: e.message, variant: 'destructive' });
    } finally {
      setIsSettingUp(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Telegram бот</h2>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            @torgopt_bot
          </CardTitle>
          <CardDescription>
            Бот отправляет приветственное сообщение новым пользователям с ссылкой на торговую площадку.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-4 bg-muted/50">
            <p className="text-sm font-medium mb-1">Приветственное сообщение:</p>
            <p className="text-sm text-muted-foreground whitespace-pre-line">
              👋 Добро пожаловать!{'\n\n'}
              Проходите на торговую площадку https://9999999999.ru/{'\n\n'}
              Продавайте и покупайте товары оптом и в розницу.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={setupWebhook} disabled={isSettingUp}>
              {isSettingUp ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : webhookSet ? (
                <CheckCircle className="h-4 w-4 mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              {webhookSet ? 'Вебхук установлен' : 'Установить вебхук'}
            </Button>
            <Button variant="outline" asChild>
              <a href="https://t.me/torgopt_bot" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Открыть бота
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
