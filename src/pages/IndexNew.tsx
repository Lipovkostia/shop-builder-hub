import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  ChevronDown,
  ChevronRight,
  Flame,
  Heart,
  ImageIcon,
  Loader2,
  LogIn,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  Percent,
  Phone,
  Search,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Truck,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface ShopProduct {
  id: string;
  name: string;
  description?: string | null;
  image: string | null;
  images_count?: number;
  category_id?: string | null;
  setting_categories?: string[];
  category?: string | null;
}

interface ShopCategory {
  id: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
}

interface Partner {
  id: string;
  name: string;
  url: string;
  image_url: string | null;
  sort_order: number;
}

interface Slide {
  id: string;
  title: string;
  image_url: string | null;
  sort_order: number;
}

interface InfoBlock {
  id: string;
  title: string;
  description: string;
  icon: string | null;
  image_url: string | null;
}

interface SideBlock {
  id?: string;
  title?: string;
  subtitle?: string;
  image_url?: string | null;
  url?: string | null;
}

interface HeaderNavLink { id?: string; label?: string; url?: string; highlight?: boolean; }
interface HeaderPromoChip { id?: string; label?: string; url?: string; icon?: string; accent?: boolean; }
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
  top_nav?: HeaderNavLink[];
  promo_chips?: HeaderPromoChip[];
  use_categories_as_chips?: boolean;
}

interface HeroSettings {
  site_name?: string | null;
  hero_badge?: string | null;
  hero_title?: string | null;
  hero_subtitle?: string | null;
  hero_image_url?: string | null;
  hero_overlay_opacity?: number | null;
  cta_primary_label?: string | null;
  cta_primary_url?: string | null;
  cta_secondary_label?: string | null;
  cta_secondary_url?: string | null;
  contact_phone?: string | null;
  contact_phone_label?: string | null;
  contact_telegram_url?: string | null;
  contact_telegram_label?: string | null;
  contact_whatsapp_url?: string | null;
  contact_email?: string | null;
  contact_address?: string | null;
  side_blocks?: SideBlock[] | null;
  header_config?: HeaderConfig | null;
}

const DEFAULT_HERO: HeroSettings = {
  site_name: "9999999999",
  hero_badge: "Опт, розница и предложения поставщиков",
  hero_title: "Торговая витрина 9999999999",
  hero_subtitle:
    "Собирайте ассортимент, находите поставщиков и переходите к покупке через проверенные розничные точки.",
  hero_overlay_opacity: 0.55,
  cta_primary_label: "Смотреть товары",
  cta_primary_url: "#catalog",
  cta_secondary_label: "Связаться",
  cta_secondary_url: "https://t.me/zakaz9999999999_bot",
  contact_phone: "+79999999999",
  contact_phone_label: "+7 999 999-99-99",
  contact_telegram_url: "https://t.me/zakaz9999999999_bot",
  contact_telegram_label: "Telegram-бот",
  contact_email: "info@9999999999.ru",
  side_blocks: [],
};

const CACHE_KEY = "homepage_catalog_cache_v2";
const LEGACY_CACHE_KEYS = ["homepage_catalog_cache_v1"];
const FORCED_DISABLED_CATALOG_IDS = new Set(["35121234-2811-4da7-b838-36a43698d5e0"]);
const FORCED_DISABLED_ACCESS_CODES = new Set(["4fe9c6e8"]);

function isForcedDisabledHomepageItem(item: any) {
  const sourceUrl = String(item?.source_url || "");
  const sourceSite = String(item?.source_site || "").toLowerCase();
  return !!(
    FORCED_DISABLED_ACCESS_CODES.has(String(item?.access_code || "")) ||
    FORCED_DISABLED_CATALOG_IDS.has(String(item?.homepage_catalog_id || "")) ||
    Array.from(FORCED_DISABLED_CATALOG_IDS).some((id) => sourceUrl.startsWith(`catalog:${id}:`)) ||
    sourceSite.includes("оптовый прайс у2")
  );
}

function normalizeHomepagePayload(json: any) {
  const disabledAccessCodes = FORCED_DISABLED_ACCESS_CODES;
  return {
    ...json,
    data: (json?.data || []).filter((p: any) => !isForcedDisabledHomepageItem(p)),
    categories: (json?.categories || []).filter((c: any) => !disabledAccessCodes.has(String(c?.access_code || ""))),
    price_lists: (json?.price_lists || []).filter((pl: any) => !disabledAccessCodes.has(String(pl?.access_code || ""))),
  };
}

const iconMap = {
  Rocket: Truck,
  Store,
  Zap: BadgeCheck,
  Shield: BadgeCheck,
  BarChart3: ShoppingBag,
  Globe: Store,
};

export default function IndexNew() {
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [infoBlocks, setInfoBlocks] = useState<InfoBlock[]>([]);
  const [hero, setHero] = useState<HeroSettings>(DEFAULT_HERO);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [expandedCats, setExpandedCats] = useState<string[]>([]);
  const [quickView, setQuickView] = useState<ShopProduct | null>(null);

  useEffect(() => {
    LEGACY_CACHE_KEYS.forEach((key) => {
      try { localStorage.removeItem(key); } catch { /* ignore */ }
    });

    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const json = normalizeHomepagePayload(JSON.parse(cached));
        if (json.data) {
          setProducts(json.data);
          setCategories(json.categories || []);
          setPartners(json.partners || []);
          setSlides(json.slides || []);
          setInfoBlocks(json.info_blocks || []);
          if (json.hero_settings) setHero({ ...DEFAULT_HERO, ...json.hero_settings });
          setLoading(false);
        }
      }
    } catch { /* ignore */ }

    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/homepage-catalog?ts=${Date.now()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        json = normalizeHomepagePayload(json);
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(json)); } catch { /* ignore */ }
        setProducts(json.data || []);
        setCategories(json.categories || []);
        setPartners(json.partners || []);
        setSlides(json.slides || []);
        setInfoBlocks(json.info_blocks || []);
        if (json.hero_settings) setHero({ ...DEFAULT_HERO, ...json.hero_settings });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const directCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of products) {
      const ids = new Set<string>([
        ...(p.category_id ? [p.category_id] : []),
        ...(p.setting_categories || []),
      ]);
      for (const id of ids) m.set(id, (m.get(id) || 0) + 1);
    }
    return m;
  }, [products]);

  const { roots, childMap, totalCounts } = useMemo(() => {
    const allChildMap = new Map<string, ShopCategory[]>();
    for (const c of categories) {
      if (!c.parent_id) continue;
      const arr = allChildMap.get(c.parent_id) || [];
      arr.push(c);
      allChildMap.set(c.parent_id, arr);
    }

    const totalCounts = new Map<string, number>();
    const computeTotal = (id: string): number => {
      if (totalCounts.has(id)) return totalCounts.get(id)!;
      let total = directCounts.get(id) || 0;
      for (const k of allChildMap.get(id) || []) total += computeTotal(k.id);
      totalCounts.set(id, total);
      return total;
    };
    for (const c of categories) computeTotal(c.id);

    const childMap = new Map<string, ShopCategory[]>();
    const roots: ShopCategory[] = [];
    for (const c of categories) {
      if ((totalCounts.get(c.id) || 0) === 0) continue;
      if (c.parent_id && (totalCounts.get(c.parent_id) || 0) > 0) {
        const arr = childMap.get(c.parent_id) || [];
        arr.push(c);
        childMap.set(c.parent_id, arr);
      } else {
        roots.push(c);
      }
    }
    return { roots, childMap, totalCounts };
  }, [categories, directCounts]);

  const selectedIds = useMemo(() => {
    if (!selectedCat) return null;
    const set = new Set<string>([selectedCat]);
    const walk = (id: string) => {
      const kids = childMap.get(id) || [];
      for (const k of kids) { set.add(k.id); walk(k.id); }
    };
    walk(selectedCat);
    return set;
  }, [selectedCat, childMap]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q)) return false;
      if (selectedIds) {
        const pids = new Set<string>([
          ...(p.category_id ? [p.category_id] : []),
          ...(p.setting_categories || []),
        ]);
        let match = false;
        for (const id of pids) if (selectedIds.has(id)) { match = true; break; }
        if (!match) return false;
      }
      return true;
    });
  }, [products, search, selectedIds]);

  const heroMedia = useMemo(() => {
    const activeSlides = slides.filter((s) => s.image_url);
    if (activeSlides.length > 0) return activeSlides.slice(0, 3);
    return products
      .filter((p) => p.image)
      .slice(0, 3)
      .map((p) => ({ id: p.id, title: p.name, image_url: p.image, sort_order: 0 }));
  }, [slides, products]);

  const featuredCategories = roots.slice(0, 7);

  const toggleExpand = (id: string) => {
    setExpandedCats((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const hc: HeaderConfig = hero.header_config || {};
  const chipIcons: Record<string, any> = { flame: Flame, bag: ShoppingBag, sparkles: Sparkles, badge: BadgeCheck, store: Store, truck: Truck, percent: Percent, star: Star };
  const defaultTopNav: HeaderNavLink[] = [
    { label: "Доставка и оплата", url: "#delivery" },
    { label: "Отзывы", url: "#reviews" },
    { label: "Рецепты", url: "#recipes" },
    { label: "Бизнесу", url: "#business" },
    { label: "Устричные бары", url: "#bars", highlight: true },
  ];
  const topNav = (hc.top_nav && hc.top_nav.length > 0) ? hc.top_nav : defaultTopNav;
  const useCatChips = hc.use_categories_as_chips !== false && (!hc.promo_chips || hc.promo_chips.length === 0);
  const chips: HeaderPromoChip[] = useCatChips
    ? featuredCategories.map((c) => ({ id: c.id, label: c.name, icon: "flame" }))
    : (hc.promo_chips || []);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-card/95 backdrop-blur-xl border-b border-border">
        {/* Top utility bar */}
        <div className="border-b border-border/60 bg-muted/40">
          <div className="mx-auto flex h-9 max-w-[1680px] items-center gap-5 px-4 text-[13px] text-foreground/80 lg:px-6">
            <nav className="hidden items-center gap-5 md:flex">
              {topNav.map((l, i) => (
                <a
                  key={l.id || i}
                  href={l.url || "#"}
                  className={cn("hover:text-primary", l.highlight && "font-medium text-primary hover:opacity-80")}
                >
                  {l.label}
                </a>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-4">
              {hero.contact_phone && (
                <a href={`tel:${hero.contact_phone}`} className="hidden items-center gap-1.5 font-medium hover:text-primary sm:flex">
                  {hero.contact_phone_label || hero.contact_phone}
                </a>
              )}
              <span className="hidden items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-xs font-medium md:inline-flex">
                <Phone className="h-3 w-3" /> 24/7
              </span>
              {hc.rating_value !== "" && (
                <span className="hidden items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 md:inline-flex">
                  <Star className="h-3 w-3 fill-amber-500 text-amber-500" /> {hc.rating_value || "5"}
                </span>
              )}
              <div className="hidden items-center gap-1.5 text-xs text-muted-foreground lg:flex">
                <Truck className="h-4 w-4" />
                <span>{hc.delivery_prefix || "Ближайшая доставка"}</span>
                <span className="font-medium text-foreground">{hc.delivery_time || "сегодня с 18:00"}</span>
              </div>
              <button className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium hover:border-primary hover:text-primary">
                <MapPin className="h-3.5 w-3.5" />
                {hc.address_button_label || "Указать адрес доставки"}
              </button>
            </div>
          </div>
        </div>

        {/* Main bar */}
        <div className="mx-auto flex max-w-[1680px] items-center gap-3 px-4 py-3 lg:px-6">
          <Link to="/" className="flex items-center gap-2 whitespace-nowrap">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ShoppingBag className="h-5 w-5" />
            </span>
            <span className="hidden leading-tight sm:block">
              <span className="block text-xl font-extrabold tracking-tight text-foreground">{hero.site_name || "Магазин"}</span>
              {(hc.tagline ?? "радуем вас каждый день") && (
                <span className="block text-[11px] text-muted-foreground">{hc.tagline ?? "радуем вас каждый день"}</span>
              )}
            </span>
          </Link>

          <Button size="lg" className="h-11 gap-2 rounded-md px-4 font-semibold">
            <span>{hc.catalog_button_label || "Каталог"}</span>
            <Menu className="h-4 w-4" />
          </Button>

          <a href="#new" className="hidden items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium hover:text-primary md:inline-flex">
            <Sparkles className="h-4 w-4 text-primary" /> {hc.new_link_label || "Новинки"}
          </a>
          <a href="#sales" className="hidden items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium hover:text-primary md:inline-flex">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-amber-950"><Percent className="h-3 w-3" /></span>
            {hc.sales_link_label || "Скидки"} <ChevronDown className="h-3 w-3" />
          </a>

          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={hc.search_placeholder || "Поиск"}
              className="h-11 rounded-md border-2 pl-11 pr-40 text-base focus-visible:ring-primary"
            />
            {(hc.search_hint_word || hc.search_hint_prefix) && (
              <span className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 text-sm text-muted-foreground lg:block">
                {hc.search_hint_prefix || "Например,"} <span className="underline">{hc.search_hint_word || "красная икра"}</span>
              </span>
            )}
          </div>

          <button aria-label="Избранное" className="hidden h-11 w-11 items-center justify-center rounded-md text-foreground hover:bg-muted md:inline-flex">
            <Heart className="h-5 w-5" />
          </button>
          <Link to="/auth?tab=customer" className="shrink-0">
            <Button variant="outline" size="lg" className="h-11 gap-2 rounded-md">
              <LogIn className="h-4 w-4" />
              <span className="hidden sm:inline">{hc.login_label || "Вход"}</span>
            </Button>
          </Link>
          <button className="relative flex h-11 items-center gap-2 rounded-md bg-muted/60 px-3 font-semibold hover:bg-muted">
            <ShoppingBag className="h-5 w-5" />
            <span className="text-sm">{hc.cart_label || "0 ₽"}</span>
          </button>
        </div>

        {/* Promo chips */}
        {chips.length > 0 && (
          <div className="border-t border-border/60">
            <div className="mx-auto flex max-w-[1680px] items-center gap-5 overflow-x-auto px-4 py-2 text-sm lg:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {chips.map((chip, i) => {
                const Icon = chipIcons[chip.icon || "flame"] || Flame;
                const content = (
                  <>
                    <Icon className={cn("h-4 w-4", chip.accent || i === 0 ? "text-primary" : "text-muted-foreground")} />
                    {chip.label}
                  </>
                );
                if (chip.url) {
                  return (
                    <a key={chip.id || i} href={chip.url} className="flex shrink-0 items-center gap-1.5 whitespace-nowrap font-medium text-foreground hover:text-primary">
                      {content}
                    </a>
                  );
                }
                return (
                  <button
                    key={chip.id || i}
                    onClick={() => chip.id && setSelectedCat(chip.id)}
                    className="flex shrink-0 items-center gap-1.5 whitespace-nowrap font-medium text-foreground hover:text-primary"
                  >
                    {content}
                  </button>
                );
              })}
              <button className="ml-auto shrink-0 rounded-full p-1 hover:bg-muted">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </header>

      <section className="border-b border-border bg-card">
        <div className="mx-auto grid max-w-[1680px] gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:px-6">
          <div className="relative min-h-[280px] overflow-hidden rounded-md bg-secondary lg:min-h-[360px]">
            {(hero.hero_image_url || heroMedia[0]?.image_url) ? (
              <img src={hero.hero_image_url || heroMedia[0]?.image_url || ""} alt={hero.hero_title || ""} className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0 gradient-hero" />
            )}
            <div className="absolute inset-0 bg-foreground" style={{ opacity: hero.hero_overlay_opacity ?? 0.55 }} />
            <div className="relative z-10 flex h-full min-h-[280px] flex-col justify-end p-5 lg:min-h-[360px] lg:p-8">
              <div className="max-w-3xl">
                {hero.hero_badge && (
                  <div className="mb-3 inline-flex items-center gap-2 rounded-md bg-card/90 px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm">
                    <BadgeCheck className="h-4 w-4 text-primary" /> {hero.hero_badge}
                  </div>
                )}
                {hero.hero_title && (
                  <h1 className="text-3xl font-bold leading-tight text-primary-foreground sm:text-4xl lg:text-6xl">
                    {hero.hero_title}
                  </h1>
                )}
                {hero.hero_subtitle && (
                  <p className="mt-3 max-w-2xl text-base font-medium leading-relaxed text-primary-foreground/90 lg:text-lg">
                    {hero.hero_subtitle}
                  </p>
                )}
                <div className="mt-5 flex flex-wrap gap-2">
                  {hero.cta_primary_label && (
                    hero.cta_primary_url?.startsWith("#") ? (
                      <Button onClick={() => document.getElementById((hero.cta_primary_url || "#catalog").slice(1))?.scrollIntoView({ behavior: "smooth" })} className="gap-2">
                        {hero.cta_primary_label} <ArrowRight className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button asChild className="gap-2">
                        <a href={hero.cta_primary_url || "#"} target={hero.cta_primary_url?.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">
                          {hero.cta_primary_label} <ArrowRight className="h-4 w-4" />
                        </a>
                      </Button>
                    )
                  )}
                  {hero.cta_secondary_label && hero.cta_secondary_url && (
                    <Button variant="secondary" asChild>
                      <a href={hero.cta_secondary_url} target={hero.cta_secondary_url.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">{hero.cta_secondary_label}</a>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <aside className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {(hero.side_blocks && hero.side_blocks.length > 0
              ? hero.side_blocks.slice(0, 2).map((b, i) => ({ id: b.id || `sb-${i}`, title: b.title || "", image_url: b.image_url || null, url: b.url || null }))
              : (heroMedia.slice(1, 3).length > 0
                ? heroMedia.slice(1, 3).map((m) => ({ id: m.id, title: m.title, image_url: m.image_url, url: null as string | null }))
                : infoBlocks.slice(0, 2).map((b) => ({ id: b.id, title: b.title, image_url: b.image_url, url: null as string | null })))
            ).map((item) => {
              const inner = (
                <>
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.title} className="h-24 w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-24 items-center justify-center bg-muted text-muted-foreground"><ImageIcon className="h-6 w-6" /></div>
                  )}
                  <div className="p-3">
                    <p className="line-clamp-2 text-sm font-semibold leading-snug">{item.title}</p>
                  </div>
                </>
              );
              return item.url ? (
                <a key={item.id} href={item.url} target={item.url.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className="min-h-[132px] overflow-hidden rounded-md border border-border bg-card shadow-sm transition-shadow hover:shadow-md">{inner}</a>
              ) : (
                <div key={item.id} className="min-h-[132px] overflow-hidden rounded-md border border-border bg-card shadow-sm">{inner}</div>
              );
            })}
            <div className="rounded-md border border-border bg-secondary p-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Контакты</p>
              <div className="mt-3 space-y-2 text-sm">
                {hero.contact_phone && (
                  <a href={`tel:${hero.contact_phone}`} className="flex items-center gap-2 hover:text-primary"><Phone className="h-4 w-4" /> {hero.contact_phone_label || hero.contact_phone}</a>
                )}
                {hero.contact_telegram_url && (
                  <a href={hero.contact_telegram_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-primary"><MessageCircle className="h-4 w-4" /> {hero.contact_telegram_label || "Telegram"}</a>
                )}
                {hero.contact_email && (
                  <a href={`mailto:${hero.contact_email}`} className="flex items-center gap-2 hover:text-primary"><Mail className="h-4 w-4" /> {hero.contact_email}</a>
                )}
                {hero.contact_address && (
                  <p className="flex items-start gap-2 text-muted-foreground"><Store className="mt-0.5 h-4 w-4 shrink-0" /> <span>{hero.contact_address}</span></p>
                )}
              </div>
            </div>
          </aside>
        </div>
      </section>


      {featuredCategories.length > 0 && (
        <div className="mx-auto flex max-w-[1680px] gap-2 overflow-x-auto px-4 py-3 lg:px-6">
          <button onClick={() => setSelectedCat(null)} className={cn("shrink-0 rounded-md border px-3 py-2 text-sm font-medium", !selectedCat ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/40")}>Все</button>
          {featuredCategories.map((cat) => (
            <button key={cat.id} onClick={() => setSelectedCat(cat.id)} className={cn("shrink-0 rounded-md border px-3 py-2 text-sm font-medium", selectedCat === cat.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/40")}>
              {cat.name} <span className="ml-1 text-xs opacity-70">{totalCounts.get(cat.id) || 0}</span>
            </button>
          ))}
        </div>
      )}

      <div id="catalog" className="mx-auto grid max-w-[1680px] grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-[260px_minmax(0,1fr)_300px] lg:gap-6 lg:px-6">
        <aside className="lg:sticky lg:top-[84px] lg:self-start">
          <div className="overflow-hidden rounded-md border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold uppercase text-muted-foreground">Каталог</h2>
            </div>
            <ScrollArea className="max-h-[58vh] lg:max-h-[calc(100vh-170px)]">
              <nav className="p-2">
                <button onClick={() => setSelectedCat(null)} className={cn("w-full rounded-md px-3 py-2 text-left text-sm transition-colors", !selectedCat ? "bg-primary/10 font-semibold text-primary" : "text-foreground hover:bg-muted")}>Все товары</button>
                {roots.map((cat) => {
                  const kids = childMap.get(cat.id) || [];
                  const expanded = expandedCats.includes(cat.id);
                  const isSel = selectedCat === cat.id;
                  return (
                    <div key={cat.id} className="mt-0.5">
                      <button
                        onClick={() => {
                          setSelectedCat(cat.id);
                          if (kids.length) toggleExpand(cat.id);
                        }}
                        className={cn("flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors", isSel ? "bg-primary/10 font-semibold text-primary" : "text-foreground hover:bg-muted")}
                      >
                        <span className="min-w-0 flex-1 truncate">{cat.name}</span>
                        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{totalCounts.get(cat.id) || 0}</span>
                        {kids.length > 0 && (expanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" />)}
                      </button>
                      {expanded && kids.length > 0 && (
                        <div className="ml-3 mt-0.5 space-y-0.5 border-l border-border pl-2">
                          {kids.map((k) => (
                            <button key={k.id} onClick={() => setSelectedCat(k.id)} className={cn("block w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors", selectedCat === k.id ? "bg-primary/10 font-semibold text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                              <span className="truncate">{k.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </nav>
            </ScrollArea>
          </div>
        </aside>

        <main className="min-w-0">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Ассортимент</h2>
              <p className="text-sm text-muted-foreground">{filtered.length.toLocaleString("ru-RU")} позиций на витрине</p>
            </div>
            {selectedCat && <Button variant="ghost" size="sm" onClick={() => setSelectedCat(null)} className="gap-1"><X className="h-4 w-4" /> Сбросить</Button>}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="rounded-md border border-border bg-card py-20 text-center text-muted-foreground">
              <p className="text-lg">Ничего не найдено</p>
              <p className="mt-1 text-sm">Попробуйте изменить запрос или категорию</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 lg:gap-4">
              {filtered.map((p) => (
                <button key={p.id} onClick={() => setQuickView(p)} className="group overflow-hidden rounded-md border border-border bg-card text-left transition-all hover:border-primary/40 hover:shadow-md">
                  <div className="aspect-square overflow-hidden bg-muted">
                    {p.image ? (
                      <img src={p.image} alt={p.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">нет фото</div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground">{p.name}</p>
                    {p.category && <p className="mt-2 line-clamp-1 text-[11px] uppercase text-muted-foreground">{p.category}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </main>

        <aside id="partners" className="space-y-4 lg:sticky lg:top-[84px] lg:self-start">
          <div className="overflow-hidden rounded-md border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold leading-tight">Баннеры и партнёры</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Управляются в SuperAdmin</p>
            </div>
            <div className="space-y-3 p-3">
              {partners.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">Скоро здесь появятся партнёры</p>
              ) : (
                partners.map((pt) => (
                  <a key={pt.id} href={pt.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-md border border-border transition-all hover:border-primary/50 hover:shadow-md">
                    {pt.image_url ? <img src={pt.image_url} alt={pt.name} loading="lazy" className="aspect-[4/3] w-full object-cover" /> : null}
                    <div className="bg-card px-3 py-2"><p className="line-clamp-1 text-sm font-medium">{pt.name}</p></div>
                  </a>
                ))
              )}
            </div>
          </div>

          {infoBlocks.length > 0 && (
            <div className="space-y-3">
              {infoBlocks.slice(0, 4).map((block) => {
                const Icon = iconMap[block.icon as keyof typeof iconMap] || BadgeCheck;
                return (
                  <div key={block.id} className="rounded-md border border-border bg-secondary p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <Icon className="h-4 w-4 text-primary" />
                      <h3 className="line-clamp-1 text-sm font-semibold">{block.title}</h3>
                    </div>
                    <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">{block.description}</p>
                  </div>
                );
              })}
            </div>
          )}
        </aside>
      </div>

      {quickView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/70 p-4 backdrop-blur-sm" onClick={() => setQuickView(null)}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-md bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-border p-4">
              <h3 className="pr-4 text-lg font-semibold">{quickView.name}</h3>
              <button onClick={() => setQuickView(null)} className="rounded-md p-1 hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            {quickView.image && <div className="bg-muted"><img src={quickView.image} alt={quickView.name} className="max-h-[60vh] w-full object-contain" /></div>}
            <div className="space-y-3 p-4">
              {quickView.category && <p className="text-xs uppercase text-muted-foreground">{quickView.category}</p>}
              {quickView.description && <p className="text-sm leading-relaxed text-muted-foreground">{quickView.description}</p>}
              <Button className="w-full" onClick={() => { setQuickView(null); document.getElementById("partners")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>Где купить</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}