import { useState, useEffect, useCallback } from "react";
import { Search, Plus, Trash2, Loader2, Star, ChevronUp, ChevronDown, Link2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface FeaturedProduct {
  id: string;
  product_id: string;
  sort_order: number;
  name: string;
  sku: string | null;
  price: number;
  unit: string | null;
  images_count: number;
  store_name: string;
  category: string | null;
}

interface SearchProduct {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  unit: string | null;
  images_count: number;
  store_name: string;
  is_featured: boolean;
}

export default function FeaturedProductsManager() {
  const { session } = useAuth();
  const { toast } = useToast();
  const [featured, setFeatured] = useState<FeaturedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  // Catalog link state
  const [catalogLink, setCatalogLink] = useState("");
  const [savedAccessCode, setSavedAccessCode] = useState<string | null>(null);
  const [savingLink, setSavingLink] = useState(false);

  // Load saved catalog access code
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data } = await supabase
          .from("landing_settings" as any)
          .select("catalog_access_code")
          .eq("id", "default")
          .single();
        if (data && (data as any).catalog_access_code) {
          const code = (data as any).catalog_access_code;
          setSavedAccessCode(code);
          setCatalogLink(code);
        }
      } catch (e) {
        console.error("Failed to load landing settings:", e);
      }
    };
    loadSettings();
  }, []);

  // Extract access code from link or raw code
  const extractAccessCode = (input: string): string => {
    const trimmed = input.trim();
    // If it's a URL like /catalog/XXXX or ?catalog=XXXX
    const catalogMatch = trimmed.match(/\/catalog\/([a-zA-Z0-9]+)/);
    if (catalogMatch) return catalogMatch[1];
    // If it contains access_code= or code=
    const codeMatch = trimmed.match(/[?&](?:access_code|code)=([a-zA-Z0-9]+)/);
    if (codeMatch) return codeMatch[1];
    // Otherwise treat as raw access code
    return trimmed;
  };

  const saveCatalogLink = async () => {
    const accessCode = extractAccessCode(catalogLink);
    if (!accessCode) {
      toast({ title: "Введите ссылку или код доступа", variant: "destructive" });
      return;
    }

    setSavingLink(true);
    try {
      const { error } = await supabase
        .from("landing_settings" as any)
        .update({ catalog_access_code: accessCode, updated_at: new Date().toISOString() } as any)
        .eq("id", "default");

      if (error) throw error;
      setSavedAccessCode(accessCode);
      toast({ title: "Каталог привязан", description: `Код доступа: ${accessCode}` });
      // Reload products
      fetchFeatured();
    } catch (e: any) {
      toast({ title: "Ошибка сохранения", description: e.message, variant: "destructive" });
    } finally {
      setSavingLink(false);
    }
  };

  const unlinkCatalog = async () => {
    setSavingLink(true);
    try {
      const { error } = await supabase
        .from("landing_settings" as any)
        .update({ catalog_access_code: null, updated_at: new Date().toISOString() } as any)
        .eq("id", "default");

      if (error) throw error;
      setSavedAccessCode(null);
      setCatalogLink("");
      toast({ title: "Каталог отвязан" });
      fetchFeatured();
    } catch (e: any) {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    } finally {
      setSavingLink(false);
    }
  };

  const fetchFeatured = useCallback(async () => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/landing-products`
      );
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      setFeatured(
        (json.data || []).map((p: any, idx: number) => ({
          id: p.featured_id || p.id,
          product_id: p.id,
          sort_order: p.sort_order ?? idx,
          name: p.name,
          sku: p.sku,
          price: p.price,
          unit: p.unit,
          images_count: p.images_count,
          store_name: p.store_name,
          category: p.category,
        }))
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeatured();
  }, [fetchFeatured]);

  const searchProducts = useCallback(async () => {
    if (!searchQuery.trim() || !session?.access_token) return;
    setSearching(true);
    try {
      const params = new URLSearchParams({
        action: "products",
        search: searchQuery,
        page: "1",
        limit: "20",
      });
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/super-admin-stats?${params}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (!res.ok) throw new Error("Search failed");
      const json = await res.json();
      const featuredIds = new Set(featured.map((f) => f.product_id));
      setSearchResults(
        (json.data || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          price: p.price,
          unit: p.unit,
          images_count: p.images_count || 0,
          store_name: p.store_name,
          is_featured: featuredIds.has(p.id),
        }))
      );
    } catch (e) {
      console.error(e);
    } finally {
      setSearching(false);
    }
  }, [searchQuery, session, featured]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) searchProducts();
      else setSearchResults([]);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchProducts]);

  const addToFeatured = async (productId: string) => {
    setAdding(productId);
    try {
      const maxOrder = featured.length > 0 ? Math.max(...featured.map((f) => f.sort_order)) + 1 : 0;
      const { error } = await supabase.from("featured_products").insert({
        product_id: productId,
        sort_order: maxOrder,
      });
      if (error) throw error;
      toast({ title: "Товар добавлен на витрину" });
      await fetchFeatured();
    } catch (e: any) {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    } finally {
      setAdding(null);
    }
  };

  const removeFromFeatured = async (featuredId: string) => {
    setRemoving(featuredId);
    try {
      const { error } = await supabase.from("featured_products").delete().eq("id", featuredId);
      if (error) throw error;
      toast({ title: "Товар убран с витрины" });
      await fetchFeatured();
    } catch (e: any) {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    } finally {
      setRemoving(null);
    }
  };

  const moveFeatured = async (featuredId: string, direction: "up" | "down") => {
    const idx = featured.findIndex((f) => f.id === featuredId);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= featured.length) return;

    const a = featured[idx];
    const b = featured[swapIdx];

    await Promise.all([
      supabase.from("featured_products").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("featured_products").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    await fetchFeatured();
  };

  const isCatalogLinked = !!savedAccessCode;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Star className="h-5 w-5 text-amber-500" />
        <div>
          <h2 className="text-lg font-semibold">Витрина главной страницы</h2>
          <p className="text-sm text-muted-foreground">
            Товары, которые видят посетители на главной. Сейчас: {featured.length}
          </p>
        </div>
      </div>

      {/* Catalog link section */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary" />
          <Label className="font-medium">Привязка прайс-листа</Label>
        </div>
        <p className="text-xs text-muted-foreground">
          Вставьте ссылку на прайс-лист или его код доступа. Товары из этого прайс-листа будут автоматически отображаться на главной странице с учётом категорий.
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="Ссылка на прайс-лист или код доступа..."
            value={catalogLink}
            onChange={(e) => setCatalogLink(e.target.value)}
            className="flex-1"
          />
          <Button
            onClick={saveCatalogLink}
            disabled={savingLink || !catalogLink.trim()}
            size="sm"
          >
            {savingLink ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
            Привязать
          </Button>
          {isCatalogLinked && (
            <Button
              variant="outline"
              onClick={unlinkCatalog}
              disabled={savingLink}
              size="sm"
            >
              Отвязать
            </Button>
          )}
        </div>
        {isCatalogLinked && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              <Check className="h-3 w-3 mr-1" />
              Привязан каталог: {savedAccessCode}
            </Badge>
          </div>
        )}
      </div>

      {/* Manual search (only when no catalog linked) */}
      {!isCatalogLinked && (
        <div className="space-y-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск товаров для добавления на витрину..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {searchResults.length > 0 && (
            <div className="rounded-lg border bg-card max-h-64 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="h-8">
                    <TableHead className="text-xs">Название</TableHead>
                    <TableHead className="text-xs">Арт.</TableHead>
                    <TableHead className="text-xs text-right">Цена</TableHead>
                    <TableHead className="text-xs">Магазин</TableHead>
                    <TableHead className="text-xs w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {searchResults.map((p) => (
                    <TableRow key={p.id} className="h-8">
                      <TableCell className="text-xs font-medium">{p.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.sku || "—"}</TableCell>
                      <TableCell className="text-xs text-right">{p.price.toLocaleString("ru-RU")} ₽</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.store_name}</TableCell>
                      <TableCell>
                        {p.is_featured ? (
                          <Badge variant="secondary" className="text-[10px]">На витрине</Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-xs"
                            disabled={adding === p.id}
                            onClick={() => addToFeatured(p.id)}
                          >
                            {adding === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3 mr-1" />}
                            Добавить
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {searching && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Поиск...
            </div>
          )}
        </div>
      )}

      {/* Current product list */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="h-9">
              <TableHead className="text-xs w-10">#</TableHead>
              <TableHead className="text-xs">Название</TableHead>
              <TableHead className="text-xs">Арт.</TableHead>
              <TableHead className="text-xs text-right">Цена</TableHead>
              <TableHead className="text-xs">Ед.</TableHead>
              <TableHead className="text-xs">Категория</TableHead>
              <TableHead className="text-xs">Магазин</TableHead>
              {!isCatalogLinked && <TableHead className="text-xs w-24">Действия</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : featured.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                  {isCatalogLinked
                    ? "В привязанном каталоге нет товаров. Проверьте код доступа."
                    : "Витрина пуста. Привяжите прайс-лист или найдите товары через поиск."}
                </TableCell>
              </TableRow>
            ) : (
              featured.map((f, idx) => (
                <TableRow key={f.id + "-" + idx} className="h-9">
                  <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                  <TableCell className="text-xs font-medium">{f.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{f.sku || "—"}</TableCell>
                  <TableCell className="text-xs text-right">{f.price.toLocaleString("ru-RU")} ₽</TableCell>
                  <TableCell className="text-xs">{f.unit || "шт"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{f.category || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{f.store_name}</TableCell>
                  {!isCatalogLinked && (
                    <TableCell>
                      <div className="flex items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          disabled={idx === 0}
                          onClick={() => moveFeatured(f.id, "up")}
                        >
                          <ChevronUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          disabled={idx === featured.length - 1}
                          onClick={() => moveFeatured(f.id, "down")}
                        >
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          disabled={removing === f.id}
                          onClick={() => removeFromFeatured(f.id)}
                        >
                          {removing === f.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
