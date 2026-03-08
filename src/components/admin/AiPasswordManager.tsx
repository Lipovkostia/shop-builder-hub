import { useState, useEffect } from "react";
import { Key, Save, Loader2, Eye, EyeOff, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function AiPasswordManager() {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);

  useEffect(() => {
    loadPassword();
  }, []);

  const loadPassword = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("ai_platform_settings")
        .select("id, ai_password")
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setCurrentPassword(data.ai_password || "");
        setSettingsId(data.id);
      }
    } catch (err) {
      console.error("Error loading AI password:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!newPassword.trim()) {
      toast({ title: "Введите новый пароль", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      if (settingsId) {
        const { error } = await (supabase as any)
          .from("ai_platform_settings")
          .update({ ai_password: newPassword.trim(), updated_at: new Date().toISOString() })
          .eq("id", settingsId);
        if (error) throw error;
      } else {
        const { data, error } = await (supabase as any)
          .from("ai_platform_settings")
          .insert({ ai_password: newPassword.trim() })
          .select("id")
          .single();
        if (error) throw error;
        setSettingsId(data.id);
      }

      setCurrentPassword(newPassword.trim());
      setNewPassword("");
      toast({ title: "Пароль сохранён", description: "Новый пароль для доступа к ИИ установлен" });
    } catch (err: any) {
      console.error("Error saving AI password:", err);
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-500" />
          Доступ к ИИ
        </CardTitle>
        <CardDescription>
          Управление паролем для доступа продавцов к функциям искусственного интеллекта.
          Продавцы должны ввести этот пароль в настройках профиля, чтобы разблокировать ИИ.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Текущий пароль</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type={showPassword ? "text" : "password"}
                value={currentPassword}
                readOnly
                className="pr-10 bg-muted"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Новый пароль</Label>
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="Введите новый пароль"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleSave} disabled={saving || !newPassword.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span className="ml-2 hidden sm:inline">Сохранить</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
