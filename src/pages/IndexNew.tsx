import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  ChevronDown,
  ChevronRight,
  ImageIcon,
  Loader2,
  LogIn,
  Mail,
  MessageCircle,
  Phone,
  Search,
  ShoppingBag,
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

const CACHE_KEY = "homepage_catalog_cache_v1";

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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [expandedCats, setExpandedCats] = useState<string[]>([]);
  const [quickView, setQuickView] = useState<ShopProduct | null>(null);

  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const json = JSON.parse(cached);
        if (json.data) {
          setProducts(json.data);
          setCategories(json.categories || []);
          setPartners(json.partners || []);
          setSlides(json.slides || []);
          setInfoBlocks(json.info_blocks || []);
          setLoading(false);
        }
      }
    } catch { /* ignore */ }

    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/homepage-catalog`)
      .then((r) => r.json())
      .then((json) => {
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(json)); } catch { /* ignore */ }
        setProducts(json.data || []);
        setCategories(json.categories || []);
        setPartners(json.partners || []);
        setSlides(json.slides || []);
        setInfoBlocks(json.info_blocks || []);
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

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1680px] items-center gap-3 px-4 py-3 lg:px-6">
          <Link to="/" className="flex items-center gap-2 whitespace-nowrap">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <ShoppingBag className="h-5 w-5" />
            </span>
            <span className="hidden text-xl font-bold tracking-normal text-foreground sm:block">9999999999</span>
          </Link>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по товарам и категориям…"
              className="h-11 rounded-md border-2 pl-11 text-base focus-visible:ring-primary lg:h-12"
            />
          </div>
          <div className="hidden items-center gap-3 text-xs text-muted-foreground xl:flex">
            <a href="tel:+79999999999" className="flex items-center gap-1.5 hover:text-primary">
              <Phone className="h-4 w-4" /> +7 999 999-99-99
            </a>
            <a href="https://t.me/zakaz9999999999_bot" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-primary">
              <MessageCircle className="h-4 w-4" /> Telegram
            </a>
          </div>
          <Link to="/auth?tab=customer" className="shrink-0">
            <Button variant="outline" size="sm" className="gap-1.5 px-2.5 sm:px-3">
              <LogIn className="h-4 w-4" />
              <span className="hidden sm:inline">Вход</span>
            </Button>
          </Link>
        </div>
      </header>

      <section className="border-b border-border bg-card">
        <div className="mx-auto grid max-w-[1680px] gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:px-6">
          <div className="relative min-h-[280px] overflow-hidden rounded-md bg-secondary lg:min-h-[360px]">
            {heroMedia[0]?.image_url ? (
              <img src={heroMedia[0].image_url} alt={heroMedia[0].title} className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0 gradient-hero" />
            )}
            <div className="absolute inset-0 bg-foreground/55" />
            <div className="relative z-10 flex h-full min-h-[280px] flex-col justify-end p-5 lg:min-h-[360px] lg:p-8">
              <div className="max-w-3xl">
                <div className="mb-3 inline-flex items-center gap-2 rounded-md bg-card/90 px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm">
                  <BadgeCheck className="h-4 w-4 text-primary" /> Опт, розница и предложения поставщиков
                </div>
                <h1 className="text-3xl font-bold leading-tight text-primary-foreground sm:text-4xl lg:text-6xl">
                  Торговая витрина 9999999999
                </h1>
                <p className="mt-3 max-w-2xl text-base font-medium leading-relaxed text-primary-foreground/90 lg:text-lg">
                  Собирайте ассортимент, находите поставщиков и переходите к покупке через проверенные розничные точки.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button onClick={() => document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth" })} className="gap-2">
                    Смотреть товары <ArrowRight className="h-4 w-4" />
                  </Button>
                  <Button variant="secondary" asChild>
                    <a href="https://t.me/zakaz9999999999_bot" target="_blank" rel="noopener noreferrer">Связаться</a>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <aside className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {(heroMedia.slice(1, 3).length > 0 ? heroMedia.slice(1, 3) : infoBlocks.slice(0, 2)).map((item) => (
              <div key={item.id} className="min-h-[132px] overflow-hidden rounded-md border border-border bg-card shadow-sm">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.title} className="h-24 w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-24 items-center justify-center bg-muted text-muted-foreground"><ImageIcon className="h-6 w-6" /></div>
                )}
                <div className="p-3">
                  <p className="line-clamp-2 text-sm font-semibold leading-snug">{item.title}</p>
                </div>
              </div>
            ))}
            <div className="rounded-md border border-border bg-secondary p-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Контакты</p>
              <div className="mt-3 space-y-2 text-sm">
                <a href="tel:+79999999999" className="flex items-center gap-2 hover:text-primary"><Phone className="h-4 w-4" /> +7 999 999-99-99</a>
                <a href="https://t.me/zakaz9999999999_bot" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-primary"><MessageCircle className="h-4 w-4" /> Telegram-бот</a>
                <a href="mailto:info@9999999999.ru" className="flex items-center gap-2 hover:text-primary"><Mail className="h-4 w-4" /> info@9999999999.ru</a>
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