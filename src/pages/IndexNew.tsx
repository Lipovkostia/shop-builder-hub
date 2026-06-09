import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, ChevronDown, ChevronRight, LogIn, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface ShopProduct {
  id: string;
  name: string;
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

const CACHE_KEY = "homepage_catalog_cache_v1";

export default function IndexNew() {
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [expandedCats, setExpandedCats] = useState<string[]>([]);
  const [quickView, setQuickView] = useState<ShopProduct | null>(null);

  useEffect(() => {
    // cache-first
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const json = JSON.parse(cached);
        if (json.data) {
          setProducts(json.data);
          setCategories(json.categories || []);
          setPartners(json.partners || []);
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
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Direct product counts per category id
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

  // Build category tree (only categories that have products, directly or via descendants)
  const { roots, childMap, totalCounts } = useMemo(() => {
    const allChildMap = new Map<string, ShopCategory[]>();
    for (const c of categories) {
      if (c.parent_id) {
        const arr = allChildMap.get(c.parent_id) || [];
        arr.push(c);
        allChildMap.set(c.parent_id, arr);
      }
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

    // Keep only categories whose subtree has products
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

  // Collect selected + descendant ids
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

  const toggleExpand = (id: string) => {
    setExpandedCats((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-card border-b border-border">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-3 flex items-center gap-3 lg:gap-6">
          <Link to="/" className="text-xl lg:text-2xl font-bold tracking-tight whitespace-nowrap">
            <span className="text-primary">Витрина</span>
          </Link>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск товара…"
              className="pl-11 h-11 lg:h-12 text-base rounded-xl border-2 focus-visible:ring-primary"
            />
          </div>
          <Link to="/auth?tab=customer" className="hidden sm:block">
            <Button variant="outline" size="sm" className="gap-2">
              <LogIn className="h-4 w-4" /> Вход
            </Button>
          </Link>
        </div>
      </header>

      {/* Main grid */}
      <h1 className="sr-only">Наш ассортимент</h1>
      <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-4 lg:py-6 grid grid-cols-1 lg:grid-cols-[240px_1fr_280px] gap-4 lg:gap-6">
        {/* Left: Catalog */}
        <aside className="lg:sticky lg:top-[76px] lg:self-start lg:max-h-[calc(100vh-96px)]">
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Каталог</h2>
            </div>
            <ScrollArea className="max-h-[60vh] lg:max-h-[calc(100vh-160px)]">
              <nav className="p-2">
                <button
                  onClick={() => setSelectedCat(null)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                    !selectedCat ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted text-foreground"
                  )}
                >
                  Все товары
                </button>
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
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between gap-2",
                          isSel ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted text-foreground"
                        )}
                      >
                        <span className="truncate">{cat.name}</span>
                        {kids.length > 0 && (expanded ? <ChevronDown className="h-3.5 w-3.5 opacity-60 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 opacity-60 shrink-0" />)}
                      </button>
                      {expanded && kids.length > 0 && (
                        <div className="ml-3 mt-0.5 border-l border-border pl-2 space-y-0.5">
                          {kids.map((k) => (
                            <button
                              key={k.id}
                              onClick={() => setSelectedCat(k.id)}
                              className={cn(
                                "w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors block",
                                selectedCat === k.id ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted text-muted-foreground hover:text-foreground"
                              )}
                            >
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

        {/* Middle: Products */}
        <main className="min-w-0">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <p className="text-lg">Ничего не найдено</p>
              <p className="text-sm mt-1">Попробуйте изменить запрос или категорию</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setQuickView(p)}
                  className="group text-left bg-card rounded-xl border border-border overflow-hidden hover:border-primary/40 hover:shadow-md transition-all"
                >
                  <div className="aspect-square bg-muted overflow-hidden">
                    {p.image ? (
                      <img
                        src={p.image}
                        alt={p.name}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">нет фото</div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium leading-snug line-clamp-2 text-foreground">{p.name}</p>
                    {p.category && <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground line-clamp-1">{p.category}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </main>

        {/* Right: Partners */}
        <aside id="partners" className="lg:sticky lg:top-[76px] lg:self-start lg:max-h-[calc(100vh-96px)]">
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="font-semibold text-sm leading-tight">Где купить в розницу</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Наши партнёры</p>
            </div>
            <ScrollArea className="max-h-[60vh] lg:max-h-[calc(100vh-160px)]">
              <div className="p-3 space-y-3">
                {partners.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">
                    Скоро здесь появятся наши партнёры
                  </p>
                ) : (
                  partners.map((pt) => (
                    <a
                      key={pt.id}
                      href={pt.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-xl overflow-hidden border border-border hover:border-primary/50 hover:shadow-md transition-all group"
                    >
                      {pt.image_url ? (
                        <div className="aspect-[4/3] bg-muted overflow-hidden">
                          <img src={pt.image_url} alt={pt.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        </div>
                      ) : null}
                      <div className="px-3 py-2 bg-card">
                        <p className="text-sm font-medium line-clamp-1">{pt.name}</p>
                      </div>
                    </a>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </aside>
      </div>

      {/* Quick view modal */}
      {quickView && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setQuickView(null)}
        >
          <div
            className="bg-card rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between p-4 border-b border-border">
              <h3 className="text-lg font-semibold pr-4">{quickView.name}</h3>
              <button onClick={() => setQuickView(null)} className="p-1 rounded hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>
            {quickView.image && (
              <div className="bg-muted">
                <img src={quickView.image} alt={quickView.name} className="w-full max-h-[60vh] object-contain" />
              </div>
            )}
            <div className="p-4 space-y-3">
              {quickView.category && (
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{quickView.category}</p>
              )}
              <Button
                className="w-full"
                onClick={() => {
                  setQuickView(null);
                  document.getElementById("partners")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                Где купить
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
