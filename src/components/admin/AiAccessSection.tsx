import React, { useState } from "react";
import { Sparkles, Lock, Unlock, Key, Bot, FileText, Search, MessageCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useStoreAiAccess } from "@/hooks/useStoreAiAccess";
import { useToast } from "@/hooks/use-toast";

interface AiAccessSectionProps {
  storeId: string;
}

const AI_FEATURES = [
  {
    key: "seo_enabled",
    feature: "seo",
    label: "SEO-генерация",
    description: "Генерация мета-тегов, описаний и ключевых слов для товаров",
    icon: Search,
  },
  {
    key: "avito_descriptions_enabled",
    feature: "avito_descriptions",
    label: "Описания для Авито",
    description: "Генерация заголовков и описаний товаров для Авито",
    icon: FileText,
  },
  {
    key: "avito_bot_enabled",
    feature: "avito_bot",
    label: "Авито-бот",
    description: "AI-чатбот для автоматических ответов на Авито",
    icon: Bot,
  },
  {
    key: "ai_assistant_enabled",
    feature: "ai_assistant",
    label: "ИИ-помощник",
    description: "Голосовой и текстовый ассистент в админ-панели",
    icon: MessageCircle,
  },
  {
    key: "product_descriptions_enabled",
    feature: "product_descriptions",
    label: "Описания товаров",
    description: "Генерация описаний товаров с помощью ИИ",
    icon: FileText,
  },
];

export function AiAccessSection({ storeId }: AiAccessSectionProps) {
  const { access, loading, verifying, verifyPassword, updateFeature, disableAi } = useStoreAiAccess(storeId);
  const [password, setPassword] = useState("");
  const { toast } = useToast();

  const handleUnlock = async () => {
    if (!password.trim()) {
      toast({ title: "Введите пароль", variant: "destructive" });
      return;
    }
    const ok = await verifyPassword(password.trim());
    if (ok) {
      toast({ title: "ИИ активирован", description: "Возможности искусственного интеллекта включены" });
      setPassword("");
    } else {
      toast({ title: "Неверный пароль", description: "Обратитесь к администратору платформы", variant: "destructive" });
    }
  };

  const handleDisable = async () => {
    await disableAi();
    toast({ title: "ИИ деактивирован" });
  };

  if (loading) {
    return (
      <div className="bg-card rounded-lg border border-border p-4 flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Загрузка настроек ИИ...</span>
      </div>
    );
  }

  const isUnlocked = access?.is_unlocked ?? false;

  return (
    <div className="bg-card rounded-lg border border-border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500" />
          Возможности ИИ
        </Label>
        <Badge variant={isUnlocked ? "default" : "secondary"} className="gap-1">
          {isUnlocked ? (
            <>
              <Unlock className="w-3 h-3" />
              Активен
            </>
          ) : (
            <>
              <Lock className="w-3 h-3" />
              Заблокирован
            </>
          )}
        </Badge>
      </div>

      {!isUnlocked ? (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Для использования функций ИИ введите пароль доступа. Запросите его у администратора платформы.
          </p>
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="Пароль доступа к ИИ"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="flex-1"
              onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
            />
            <Button onClick={handleUnlock} disabled={verifying || !password} size="sm">
              {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Выберите, какие ИИ-функции вы хотите использовать:
          </p>
          {AI_FEATURES.map((feat) => {
            const Icon = feat.icon;
            const enabled = (access as any)?.[feat.key] ?? true;
            return (
              <div
                key={feat.key}
                className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/30 border border-border/50"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{feat.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{feat.description}</p>
                  </div>
                </div>
                <Switch
                  checked={enabled}
                  onCheckedChange={(checked) => updateFeature(feat.key, checked)}
                  className="shrink-0 ml-2"
                />
              </div>
            );
          })}
          <div className="pt-2 border-t border-border">
            <Button variant="outline" size="sm" onClick={handleDisable} className="w-full gap-2 text-destructive">
              <Lock className="w-3.5 h-3.5" />
              Отключить ИИ
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
