import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check } from "lucide-react";

type Version = "new" | "legacy";

export default function HomepageVersionManager() {
  const [version, setVersion] = useState<Version>("new");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    (supabase as any)
      .from("landing_settings")
      .select("homepage_version")
      .eq("id", "default")
      .maybeSingle()
      .then(({ data }: any) => {
        if (data?.homepage_version) setVersion(data.homepage_version as Version);
        setLoading(false);
      });
  }, []);

  const save = async (v: Version) => {
    setSaving(true);
    const { error } = await (supabase as any)
      .from("landing_settings")
      .upsert({ id: "default", homepage_version: v }, { onConflict: "id" });
    setSaving(false);
    if (error) {
      toast({ title: "Не удалось сохранить", description: error.message, variant: "destructive" });
      return;
    }
    setVersion(v);
    toast({ title: "Сохранено", description: v === "new" ? "Главная: новая витрина" : "Главная: старая (классическая)" });
  };

  if (loading) {
    return <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  const options: { value: Version; title: string; desc: string }[] = [
    { value: "new", title: "Новая витрина", desc: "Каталог-витрина с поиском, категориями слева и партнёрами справа. Без цен." },
    { value: "legacy", title: "Старая версия", desc: "Классическая главная с формами регистрации, демо-карзиной и блоками лендинга." },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Версия главной страницы</CardTitle>
        <CardDescription>Выберите, какая версия главной (по адресу «/») будет показываться посетителям.</CardDescription>
      </CardHeader>
      <CardContent className="grid sm:grid-cols-2 gap-3">
        {options.map((o) => {
          const active = version === o.value;
          return (
            <button
              key={o.value}
              type="button"
              disabled={saving}
              onClick={() => save(o.value)}
              className={`text-left rounded-xl border-2 p-4 transition-all ${active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
            >
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold">{o.title}</h3>
                {active && <Check className="h-5 w-5 text-primary" />}
              </div>
              <p className="text-sm text-muted-foreground">{o.desc}</p>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
