import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Package, Plus, Save, Search, Trash2, Upload, X } from "lucide-react";
import { UPLOAD_PRESETS, validateUpload, type UploadPreset } from "@/lib/uploadValidation";
import ImageCropperDialog from "@/components/admin/ImageCropperDialog";

interface SideBlock {
  id: string;
  title: string;
  subtitle?: string;
  image_url?: string | null;
  url?: string | null;
  product_id?: string | null;
}

interface HeaderNavLink { id: string; label: string; url: string; highlight?: boolean; }
interface HeaderPromoChip { id: string; label: string; url?: string; icon?: string; accent?: boolean; }
interface HeaderConfig {
  tagline?: string;
  catalog_button_label?: string;
  new_link_label?: string;
  sales_link_label?: string;
  search_placeholder?: string;
  search_hint_prefix?: string;
  search_hint_word?: string;
  address_button_label?: string;
  delivery_prefix?: string;
  delivery_time?: string;
  rating_value?: string;
  cart_label?: string;
  login_label?: string;
  use_categories_as_chips?: boolean;
  top_nav: HeaderNavLink[];
  promo_chips: HeaderPromoChip[];
}

const DEFAULT_HEADER: HeaderConfig = {
  tagline: "радуем вас каждый день",
  catalog_button_label: "Каталог",
  new_link_label: "Новинки",
  sales_link_label: "Скидки",
  search_placeholder: "Поиск",
  search_hint_prefix: "Например,",
  search_hint_word: "красная икра",
  address_button_label: "Указать адрес доставки",
  delivery_prefix: "Ближайшая доставка",
  delivery_time: "сегодня с 18:00",
  rating_value: "5",
  cart_label: "0 ₽",
  login_label: "Вход",
  use_categories_as_chips: true,
  top_nav: [
    { id: "n1", label: "Доставка и оплата", url: "#delivery" },
    { id: "n2", label: "Отзывы", url: "#reviews" },
    { id: "n3", label: "Рецепты", url: "#recipes" },
    { id: "n4", label: "Бизнесу", url: "#business" },
    { id: "n5", label: "Устричные бары", url: "#bars", highlight: true },
  ],
  promo_chips: [],
};

const CHIP_ICONS = ["flame", "bag", "sparkles", "badge", "store", "truck", "percent", "star"];

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
  header_config: HeaderConfig;
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
  header_config: DEFAULT_HEADER,
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

interface PickerProduct { id: string; name: string; image: string | null; description?: string | null }

function SizeBadge({ preset }: { preset: UploadPreset }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
      <span className="rounded-md bg-primary px-2 py-0.5 font-semibold text-primary-foreground">
        Размер {preset.targetWidth}×{preset.targetHeight} px
      </span>
      <span className="text-muted-foreground">
        {preset.formatsLabel} · до {Math.round(preset.maxBytes / 1024 / 1024)} МБ. Любую картинку можно обрезать под нужный размер.
      </span>
    </div>
  );
}

function ProductPickerPopover({
  products,
  currentId,
  onPick,
  onClear,
}: {
  products: PickerProduct[];
  currentId?: string | null;
  onPick: (p: PickerProduct) => void;
  onClear: () => void;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(
    () => {
      const s = q.trim().toLowerCase();
      const list = s ? products.filter((p) => p.name.toLowerCase().includes(s)) : products;
      return list.slice(0, 50);
    },
    [products, q],
  );
  const current = currentId ? products.find((p) => p.id === currentId) : null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <Package className="h-3.5 w-3.5" />
          {current ? `Товар: ${current.name.slice(0, 24)}` : "Выбрать товар из каталога"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-2" align="start">
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск товара…" className="h-8 pl-7 text-xs" />
        </div>
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {products.length === 0 && <p className="p-3 text-xs text-muted-foreground">Товары не загружены.</p>}
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => onPick(p)}
              className={`flex w-full items-center gap-2 rounded-md border p-1.5 text-left text-xs hover:bg-muted ${currentId === p.id ? "border-primary bg-primary/5" : "border-transparent"}`}
            >
              {p.image ? (
                <img src={p.image} alt="" className="h-9 w-9 shrink-0 rounded-sm object-cover" />
              ) : (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-muted"><Package className="h-4 w-4 text-muted-foreground" /></div>
              )}
              <span className="line-clamp-2 flex-1">{p.name}</span>
            </button>
          ))}
        </div>
        {current && (
          <button onClick={onClear} className="mt-2 w-full rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive hover:bg-destructive/5">
            Отвязать товар
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default function HomepageHeroManager() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [form, setForm] = useState<HeroSettings>(EMPTY);
  const [missingTable, setMissingTable] = useState(false);
  const [cropState, setCropState] = useState<{ target: string; file: File; preset: UploadPreset } | null>(null);
  const [products, setProducts] = useState<PickerProduct[]>([]);

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
        header_config: {
          ...DEFAULT_HEADER,
          ...(data.header_config || {}),
          top_nav: Array.isArray(data.header_config?.top_nav) ? data.header_config.top_nav : DEFAULT_HEADER.top_nav,
          promo_chips: Array.isArray(data.header_config?.promo_chips) ? data.header_config.promo_chips : [],
        },
      });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Load products for the side-block product picker
  useEffect(() => {
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/homepage-catalog`)
      .then((r) => r.json())
      .then((json) => {
        const list: PickerProduct[] = (json?.data || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          image: p.image || null,
          description: p.description || null,
        }));
        setProducts(list);
      })
      .catch(() => { /* ignore */ });
  }, []);

  const save = async () => {
    setSaving(true);
    const payload: any = { ...form, id: "default", updated_at: new Date().toISOString() };
    let { error } = await (supabase as any)
      .from("homepage_hero_settings")
      .upsert(payload, { onConflict: "id" });
    if (error && /header_config/i.test(String(error.message || ""))) {
      const { header_config, ...rest } = payload;
      const retry = await (supabase as any)
        .from("homepage_hero_settings")
        .upsert(rest, { onConflict: "id" });
      error = retry.error;
      if (!error) {
        toast({
          title: "Сохранено частично",
          description: "Настройки шапки не сохранены — примените миграцию docs/migrations-pending/20260709120000_hero_header_config.sql",
          variant: "destructive",
        });
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    if (error) {
      toast({ title: "Ошибка сохранения", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Сохранено", description: "Главная страница обновлена." });
  };

  const requestUpload = (target: "hero" | string, file: File) => {
    const preset = target === "hero" ? UPLOAD_PRESETS.heroBanner : UPLOAD_PRESETS.heroSideBlock;
    const check = validateUpload(file, preset);
    if (!check.ok) {
      toast({ title: "Файл не подходит", description: check.error, variant: "destructive" });
      return;
    }
    setCropState({ target, file, preset });
  };

  const uploadBlob = async (target: "hero" | string, blob: Blob, mime: string) => {
    setUploading(target);
    const ext = mime.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
    const path = `hero/${target}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("landing-info").upload(path, blob, {
      upsert: true,
      contentType: mime,
      cacheControl: "3600",
    });
    if (error) {
      toast({ title: "Ошибка загрузки", description: error.message, variant: "destructive" });
      setUploading(null);
      return;
    }
    const { data } = supabase.storage.from("landing-info").getPublicUrl(path);
    if (!data?.publicUrl) {
      toast({ title: "Ошибка", description: "Не удалось получить публичную ссылку.", variant: "destructive" });
      setUploading(null);
      return;
    }
    if (target === "hero") {
      setForm((f) => ({ ...f, hero_image_url: data.publicUrl }));
    } else {
      setForm((f) => ({
        ...f,
        side_blocks: f.side_blocks.map((b) => (b.id === target ? { ...b, image_url: data.publicUrl } : b)),
      }));
    }
    toast({ title: "Загружено", description: "Не забудьте сохранить изменения." });
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
        <CardHeader>
          <CardTitle className="text-base">Шапка сайта</CardTitle>
          <CardDescription>Тексты и ссылки в верхней панели, поиске и промо-строке.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1.5"><Label>Подпись под названием</Label>
              <Input value={form.header_config.tagline || ""} onChange={(e) => setForm((f) => ({ ...f, header_config: { ...f.header_config, tagline: e.target.value } }))} /></div>
            <div className="space-y-1.5"><Label>Текст кнопки «Каталог»</Label>
              <Input value={form.header_config.catalog_button_label || ""} onChange={(e) => setForm((f) => ({ ...f, header_config: { ...f.header_config, catalog_button_label: e.target.value } }))} /></div>
            <div className="space-y-1.5"><Label>Ссылка «Новинки»</Label>
              <Input value={form.header_config.new_link_label || ""} onChange={(e) => setForm((f) => ({ ...f, header_config: { ...f.header_config, new_link_label: e.target.value } }))} /></div>
            <div className="space-y-1.5"><Label>Ссылка «Скидки»</Label>
              <Input value={form.header_config.sales_link_label || ""} onChange={(e) => setForm((f) => ({ ...f, header_config: { ...f.header_config, sales_link_label: e.target.value } }))} /></div>
            <div className="space-y-1.5"><Label>Плейсхолдер поиска</Label>
              <Input value={form.header_config.search_placeholder || ""} onChange={(e) => setForm((f) => ({ ...f, header_config: { ...f.header_config, search_placeholder: e.target.value } }))} /></div>
            <div className="space-y-1.5"><Label>Подсказка поиска — префикс</Label>
              <Input value={form.header_config.search_hint_prefix || ""} onChange={(e) => setForm((f) => ({ ...f, header_config: { ...f.header_config, search_hint_prefix: e.target.value } }))} /></div>
            <div className="space-y-1.5"><Label>Подсказка поиска — слово</Label>
              <Input value={form.header_config.search_hint_word || ""} onChange={(e) => setForm((f) => ({ ...f, header_config: { ...f.header_config, search_hint_word: e.target.value } }))} /></div>
            <div className="space-y-1.5"><Label>Кнопка «Адрес доставки»</Label>
              <Input value={form.header_config.address_button_label || ""} onChange={(e) => setForm((f) => ({ ...f, header_config: { ...f.header_config, address_button_label: e.target.value } }))} /></div>
            <div className="space-y-1.5"><Label>Префикс «Доставка»</Label>
              <Input value={form.header_config.delivery_prefix || ""} onChange={(e) => setForm((f) => ({ ...f, header_config: { ...f.header_config, delivery_prefix: e.target.value } }))} /></div>
            <div className="space-y-1.5"><Label>Время доставки</Label>
              <Input value={form.header_config.delivery_time || ""} onChange={(e) => setForm((f) => ({ ...f, header_config: { ...f.header_config, delivery_time: e.target.value } }))} /></div>
            <div className="space-y-1.5"><Label>Рейтинг (пусто — скрыть)</Label>
              <Input value={form.header_config.rating_value || ""} onChange={(e) => setForm((f) => ({ ...f, header_config: { ...f.header_config, rating_value: e.target.value } }))} /></div>
            <div className="space-y-1.5"><Label>Текст на корзине</Label>
              <Input value={form.header_config.cart_label || ""} onChange={(e) => setForm((f) => ({ ...f, header_config: { ...f.header_config, cart_label: e.target.value } }))} /></div>
            <div className="space-y-1.5"><Label>Кнопка «Вход»</Label>
              <Input value={form.header_config.login_label || ""} onChange={(e) => setForm((f) => ({ ...f, header_config: { ...f.header_config, login_label: e.target.value } }))} /></div>
          </div>

          {/* Top nav links */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Верхние ссылки (Доставка, Отзывы, …)</Label>
              <Button size="sm" variant="outline" onClick={() => setForm((f) => ({ ...f, header_config: { ...f.header_config, top_nav: [...f.header_config.top_nav, { id: uid(), label: "Новая ссылка", url: "#" }] } }))}>
                <Plus className="h-4 w-4" /> Добавить
              </Button>
            </div>
            <div className="space-y-2">
              {form.header_config.top_nav.map((l) => (
                <div key={l.id} className="grid gap-2 rounded-md border p-2 md:grid-cols-[1fr_1fr_auto_auto]">
                  <Input placeholder="Название" value={l.label} onChange={(e) => setForm((f) => ({ ...f, header_config: { ...f.header_config, top_nav: f.header_config.top_nav.map((x) => x.id === l.id ? { ...x, label: e.target.value } : x) } }))} />
                  <Input placeholder="Ссылка (#hash или https://...)" value={l.url} onChange={(e) => setForm((f) => ({ ...f, header_config: { ...f.header_config, top_nav: f.header_config.top_nav.map((x) => x.id === l.id ? { ...x, url: e.target.value } : x) } }))} />
                  <label className="flex items-center gap-1.5 whitespace-nowrap text-xs">
                    <input type="checkbox" checked={!!l.highlight} onChange={(e) => setForm((f) => ({ ...f, header_config: { ...f.header_config, top_nav: f.header_config.top_nav.map((x) => x.id === l.id ? { ...x, highlight: e.target.checked } : x) } }))} />
                    Акцент
                  </label>
                  <Button variant="ghost" size="icon" onClick={() => setForm((f) => ({ ...f, header_config: { ...f.header_config, top_nav: f.header_config.top_nav.filter((x) => x.id !== l.id) } }))} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          </div>

          {/* Promo chips */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-semibold">Промо-строка (плашки под поиском)</Label>
                <p className="text-xs text-muted-foreground">Если пусто — показываются категории с товарами.</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setForm((f) => ({ ...f, header_config: { ...f.header_config, use_categories_as_chips: false, promo_chips: [...f.header_config.promo_chips, { id: uid(), label: "Новая плашка", url: "", icon: "flame" }] } }))}>
                <Plus className="h-4 w-4" /> Добавить
              </Button>
            </div>
            {form.header_config.promo_chips.length > 0 && (
              <label className="flex items-center gap-1.5 text-xs">
                <input type="checkbox" checked={form.header_config.use_categories_as_chips !== false} onChange={(e) => setForm((f) => ({ ...f, header_config: { ...f.header_config, use_categories_as_chips: e.target.checked } }))} />
                Дополнительно показывать категории (если ручные пусты)
              </label>
            )}
            <div className="space-y-2">
              {form.header_config.promo_chips.map((c) => (
                <div key={c.id} className="grid gap-2 rounded-md border p-2 md:grid-cols-[1fr_1fr_120px_auto_auto]">
                  <Input placeholder="Текст плашки" value={c.label} onChange={(e) => setForm((f) => ({ ...f, header_config: { ...f.header_config, promo_chips: f.header_config.promo_chips.map((x) => x.id === c.id ? { ...x, label: e.target.value } : x) } }))} />
                  <Input placeholder="Ссылка (необязательно)" value={c.url || ""} onChange={(e) => setForm((f) => ({ ...f, header_config: { ...f.header_config, promo_chips: f.header_config.promo_chips.map((x) => x.id === c.id ? { ...x, url: e.target.value } : x) } }))} />
                  <select className="h-9 rounded-md border bg-background px-2 text-sm" value={c.icon || "flame"} onChange={(e) => setForm((f) => ({ ...f, header_config: { ...f.header_config, promo_chips: f.header_config.promo_chips.map((x) => x.id === c.id ? { ...x, icon: e.target.value } : x) } }))}>
                    {CHIP_ICONS.map((i) => <option key={i} value={i}>{i}</option>)}
                  </select>
                  <label className="flex items-center gap-1.5 whitespace-nowrap text-xs">
                    <input type="checkbox" checked={!!c.accent} onChange={(e) => setForm((f) => ({ ...f, header_config: { ...f.header_config, promo_chips: f.header_config.promo_chips.map((x) => x.id === c.id ? { ...x, accent: e.target.checked } : x) } }))} />
                    Акцент
                  </label>
                  <Button variant="ghost" size="icon" onClick={() => setForm((f) => ({ ...f, header_config: { ...f.header_config, promo_chips: f.header_config.promo_chips.filter((x) => x.id !== c.id) } }))} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

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
                <UploadHint preset={UPLOAD_PRESETS.heroBanner} />
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
                <UploadHint preset={UPLOAD_PRESETS.heroSideBlock} />
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
