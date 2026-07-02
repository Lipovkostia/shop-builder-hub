import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Save, Trash2, Upload, X } from "lucide-react";

interface SideBlock {
  id: string;
  title: string;
  subtitle?: string;
  image_url?: string | null;
  url?: string | null;
}

interface HeroSettings {
  id?: string;
  site_name: string;
  hero_badge: string;
  hero_title: string;
  hero_subtitle: string;
  hero_image_url: string;
  hero_overlay_opacity: number;
  cta_primary_label: string;
  cta_primary_url: string;
  cta_secondary_label: string;
  cta_secondary_url: string;
  contact_phone: string;
  contact_phone_label: string;
  contact_telegram_url: string;
  contact_telegram_label: string;
  contact_whatsapp_url: string;
  contact_email: string;
  contact_address: string;
  side_blocks: SideBlock[];
}

const EMPTY: HeroSettings = {
  site_name: "",
  hero_badge: "",
  hero_title: "",
  hero_subtitle: "",
  hero_image_url: "",
  hero_overlay_opacity: 0.55,
  cta_primary_label: "",
  cta_primary_url: "",
  cta_secondary_label: "",
  cta_secondary_url: "",
  contact_phone: "",
  contact_phone_label: "",
  contact_telegram_url: "",
  contact_telegram_label: "",
  contact_whatsapp_url: "",
  contact_email: "",
  contact_address: "",
  side_blocks: [],
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export default function HomepageHeroManager() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [form, setForm] = useState<HeroSettings>(EMPTY);
  const [missingTable, setMissingTable] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("homepage_hero_settings")
      .select("*")
      .eq("id", "default")
      .maybeSingle();
    if (error) {
      if (String(error.message || "").includes("relation") || (error as any).code === "42P01") {
        setMissingTable(true);
      } else {
        toast({ title: "Ошибка загрузки", description: error.message, variant: "destructive" });
      }
      setLoading(false);
      return;
    }
    if (data) {
      setForm({
        ...EMPTY,
        ...data,
        hero_overlay_opacity: Number(data.hero_overlay_opacity ?? 0.55),
        side_blocks: Array.isArray(data.side_blocks) ? data.side_blocks : [],
      });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    const payload = { ...form, id: "default", updated_at: new Date().toISOString() };
    const { error } = await (supabase as any)
      .from("homepage_hero_settings")
      .upsert(payload, { onConflict: "id" });
    setSaving(false);
    if (error) {
      toast({ title: "Ошибка сохранения", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Сохранено", description: "Главная страница обновлена." });
  };

  const uploadImage = async (target: "hero" | string, file: File) => {
    setUploading(target);
    const ext = file.name.split(".").pop();
    const path = `hero/${target}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("landing-info").upload(path, file, { upsert: true });
    if (error) {
      toast({ title: "Ошибка загрузки", description: error.message, variant: "destructive" });
      setUploading(null);
      return;
    }
    const { data } = supabase.storage.from("landing-info").getPublicUrl(path);
    if (target === "hero") {
      setForm((f) => ({ ...f, hero_image_url: data.publicUrl }));
    } else {
      setForm((f) => ({
        ...f,
        side_blocks: f.side_blocks.map((b) => (b.id === target ? { ...b, image_url: data.publicUrl } : b)),
      }));
    }
    setUploading(null);
  };

  const addBlock = () => {
    setForm((f) => ({ ...f, side_blocks: [...f.side_blocks, { id: uid(), title: "Новый блок", image_url: null, url: null }] }));
  };
  const removeBlock = (id: string) => {
    setForm((f) => ({ ...f, side_blocks: f.side_blocks.filter((b) => b.id !== id) }));
  };
  const patchBlock = (id: string, patch: Partial<SideBlock>) => {
    setForm((f) => ({ ...f, side_blocks: f.side_blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) }));
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (missingTable) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Настройки главной страницы</CardTitle>
          <CardDescription>Требуется применить миграцию базы данных</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Таблица <code>homepage_hero_settings</code> ещё не создана в базе. Примените миграцию{" "}
          <code>docs/migrations-pending/20260702180000_homepage_hero_settings.sql</code>, затем перезагрузите страницу.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Главная страница — оформление</h3>
          <p className="text-sm text-muted-foreground">
            Управляйте баннером, кнопками, контактами и правыми блоками, отображаемыми на главной.
          </p>
        </div>
        <Button onClick={save} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Сохранить
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Главный баннер</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label>Фоновое изображение</Label>
            <div className="flex items-start gap-3">
              <div className="relative h-28 w-48 shrink-0 overflow-hidden rounded-md border bg-muted">
                {form.hero_image_url ? (
                  <>
                    <img src={form.hero_image_url} alt="hero" className="h-full w-full object-cover" />
                    <button
                      onClick={() => setForm((f) => ({ ...f, hero_image_url: "" }))}
                      className="absolute right-1 top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </>
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">Нет фото</div>
                )}
              </div>
              <div className="space-y-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted">
                  {uploading === "hero" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Загрузить
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage("hero", f); e.currentTarget.value = ""; }}
                  />
                </label>
                <Input
                  placeholder="или вставьте URL"
                  value={form.hero_image_url}
                  onChange={(e) => setForm({ ...form, hero_image_url: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Название сайта (в шапке)</Label>
            <Input value={form.site_name} onChange={(e) => setForm({ ...form, site_name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Плашка над заголовком</Label>
            <Input value={form.hero_badge} onChange={(e) => setForm({ ...form, hero_badge: e.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Заголовок (H1)</Label>
            <Input value={form.hero_title} onChange={(e) => setForm({ ...form, hero_title: e.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Подзаголовок</Label>
            <Textarea rows={2} value={form.hero_subtitle} onChange={(e) => setForm({ ...form, hero_subtitle: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Прозрачность затемнения (0–1)</Label>
            <Input
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={form.hero_overlay_opacity}
              onChange={(e) => setForm({ ...form, hero_overlay_opacity: Number(e.target.value) })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Кнопки под заголовком</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Основная кнопка — текст</Label>
            <Input value={form.cta_primary_label} onChange={(e) => setForm({ ...form, cta_primary_label: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Основная кнопка — ссылка (#catalog для скролла, https://… для перехода)</Label>
            <Input value={form.cta_primary_url} onChange={(e) => setForm({ ...form, cta_primary_url: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Вторая кнопка — текст</Label>
            <Input value={form.cta_secondary_label} onChange={(e) => setForm({ ...form, cta_secondary_label: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Вторая кнопка — ссылка</Label>
            <Input value={form.cta_secondary_url} onChange={(e) => setForm({ ...form, cta_secondary_url: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Контакты (в шапке и в правом блоке)</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Телефон (номер для tel:)</Label>
            <Input placeholder="+79991234567" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Телефон — как показывать</Label>
            <Input placeholder="+7 999 123-45-67" value={form.contact_phone_label} onChange={(e) => setForm({ ...form, contact_phone_label: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Telegram — ссылка</Label>
            <Input placeholder="https://t.me/…" value={form.contact_telegram_url} onChange={(e) => setForm({ ...form, contact_telegram_url: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Telegram — подпись</Label>
            <Input placeholder="Telegram-бот" value={form.contact_telegram_label} onChange={(e) => setForm({ ...form, contact_telegram_label: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>WhatsApp — ссылка</Label>
            <Input placeholder="https://wa.me/…" value={form.contact_whatsapp_url} onChange={(e) => setForm({ ...form, contact_whatsapp_url: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input placeholder="info@example.com" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Адрес / короткое описание</Label>
            <Input value={form.contact_address} onChange={(e) => setForm({ ...form, contact_address: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <div>
            <CardTitle className="text-base">Правые баннеры возле героя</CardTitle>
            <CardDescription>До двух блоков рядом с главным баннером на большом экране.</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={addBlock} className="gap-1.5"><Plus className="h-4 w-4" /> Добавить</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {form.side_blocks.length === 0 && (
            <p className="text-sm text-muted-foreground">Нет блоков — используются автоматические изображения из слайдера.</p>
          )}
          {form.side_blocks.map((b) => (
            <div key={b.id} className="grid gap-3 rounded-md border p-3 md:grid-cols-[128px_1fr_auto]">
              <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded-md border bg-muted">
                {b.image_url ? (
                  <img src={b.image_url} alt={b.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">Нет фото</div>
                )}
              </div>
              <div className="space-y-2">
                <Input value={b.title} onChange={(e) => patchBlock(b.id, { title: e.target.value })} placeholder="Заголовок блока" />
                <Input value={b.url || ""} onChange={(e) => patchBlock(b.id, { url: e.target.value })} placeholder="Ссылка (необязательно)" />
                <div className="flex items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-xs hover:bg-muted">
                    {uploading === b.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                    Загрузить фото
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(b.id, f); e.currentTarget.value = ""; }}
                    />
                  </label>
                  <Input value={b.image_url || ""} onChange={(e) => patchBlock(b.id, { image_url: e.target.value })} placeholder="или URL картинки" className="h-8 text-xs" />
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeBlock(b.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Сохранить изменения
        </Button>
      </div>
    </div>
  );
}
