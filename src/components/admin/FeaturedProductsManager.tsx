import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Loader2, Star, Link2, Check, Settings2, GripVertical, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import HomepageCatalogSettingsSheet from "./HomepageCatalogSettingsSheet";

interface HomepageCatalog {
  id: string;
  catalog_id: string | null;
  access_code: string;
  is_active: boolean;
  sort_order: number;
  catalog_name?: string | null;
  store_name?: string | null;
  products_count?: number;
}

interface FeaturedProduct {
  id: string;
  product_id: string;
  name: string;
  sku: string | null;
  price: number;
  unit: string | null;
  category: string | null;
  store_name: string;
  access_code?: string | null;
  homepage_catalog_id?: string | null;
}

export default function FeaturedProductsManager() {
  const { toast } = useToast();
  const [priceLists, setPriceLists] = useState<HomepageCatalog[]>([]);
  const [featured, setFeatured] = useState<FeaturedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCode, setNewCode] = useState("");
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [settingsFor, setSettingsFor] = useState<HomepageCatalog | null>(null);

  const extractAccessCode = (input: string): string => {
    const t = input.trim();
    const m1 = t.match(/\/catalog\/([a-zA-Z0-9]+)/);
    if (m1) return m1[1];
    const m2 = t.match(/[?&](?:access_code|code)=([a-zA-Z0-9]+)/);
    if (m2) return m2[1];
    return t;
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      // 1) price lists
      const { data: hcs, error: hcErr } = await supabase
        .from("homepage_catalogs" as any)
        .select("id, catalog_id, access_code, is_active, sort_order")
        .order("sort_order", { ascending: true });
      if (hcErr) throw hcErr;

      // Enrich with catalog/store info
      const codes = ((hcs || []) as any[]).map((h: any) => h.access_code);
      let catalogsById = new Map<string, { name: string | null; store_id: string | null }>();
      let storesById = new Map<string, string>();
      if (codes.length > 0) {
        const { data: cats } = await supabase
          .from("catalogs")
          .select("id, name, store_id, access_code")
          .in("access_code", codes);
        (cats || []).forEach((c: any) => catalogsById.set(c.access_code, { name: c.name, store_id: c.store_id }));
        const storeIds = Array.from(new Set((cats || []).map((c: any) => c.store_id).filter(Boolean)));
        if (storeIds.length) {
          const { data: stores } = await supabase.from("stores").select("id, name").in("id", storeIds);
          (stores || []).forEach((s: any) => storesById.set(s.id, s.name));
        }
      }
      const enriched: HomepageCatalog[] = ((hcs || []) as any[]).map((h: any) => {
        const c = catalogsById.get(h.access_code);
        return {
          ...h,
          catalog_name: c?.name || null,
          store_name: c?.store_id ? storesById.get(c.store_id) || null : null,
        };
      });
      setPriceLists(enriched);

      // 2) products via edge fn (respects excludes)
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/landing-products`);
      if (res.ok) {
        const json = await res.json();
        setFeatured(
          (json.data || []).map((p: any) => ({
            id: p.id,
            product_id: p.id,
            name: p.name,
            sku: p.sku,
            price: p.price,
            unit: p.unit,
            category: p.category,
            store_name: p.store_name,
            access_code: p.access_code || null,
            homepage_catalog_id: p.homepage_catalog_id || null,
          }))
        );
      }
    } catch (e: any) {
      console.error(e);
      toast({ title: "Ошибка загрузки", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const addPriceList = async () => {
    const code = extractAccessCode(newCode);
    if (!code) {
      toast({ title: "Введите ссылку или код доступа", variant: "destructive" });
      return;
    }
    setAdding(true);
    try {
      // find catalog by code
      const { data: cat } = await supabase.from("catalogs").select("id").eq("access_code", code).maybeSingle();
      const maxOrder = priceLists.length > 0 ? Math.max(...priceLists.map((p) => p.sort_order)) + 1 : 0;
      const { error } = await supabase.from("homepage_catalogs" as any).insert({
        access_code: code,
        catalog_id: cat?.id || null,
        is_active: true,
        sort_order: maxOrder,
      });
      if (error) throw error;
      setNewCode("");
      toast({ title: "Прайс-лист добавлен", description: `Код: ${code}` });
      await fetchAll();
    } catch (e: any) {
      const msg = e.message?.includes("duplicate") ? "Этот прайс-лист уже добавлен" : e.message;
      toast({ title: "Ошибка", description: msg, variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const toggleActive = async (pl: HomepageCatalog, is_active: boolean) => {
    setBusyId(pl.id);
    try {
      const { error } = await supabase.from("homepage_catalogs" as any).update({ is_active }).eq("id", pl.id);
      if (error) throw error;
      await fetchAll();
    } catch (e: any) {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const removePriceList = async (pl: HomepageCatalog) => {
    if (!confirm(`Убрать прайс-лист "${pl.catalog_name || pl.access_code}" с главной страницы?`)) return;
    setBusyId(pl.id);
    try {
      const { error } = await supabase.from("homepage_catalogs" as any).delete().eq("id", pl.id);
      if (error) throw error;
      toast({ title: "Прайс-лист убран" });
      await fetchAll();
    } catch (e: any) {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const move = async (pl: HomepageCatalog, dir: "up" | "down") => {
    const idx = priceLists.findIndex((p) => p.id === pl.id);
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= priceLists.length) return;
    const other = priceLists[swapIdx];
    await Promise.all([
      supabase.from("homepage_catalogs" as any).update({ sort_order: other.sort_order }).eq("id", pl.id),
      supabase.from("homepage_catalogs" as any).update({ sort_order: pl.sort_order }).eq("id", other.id),
    ]);
    await fetchAll();
  };

  const countsByHc = new Map<string, number>();
  featured.forEach((f) => {
    if (f.homepage_catalog_id) countsByHc.set(f.homepage_catalog_id, (countsByHc.get(f.homepage_catalog_id) || 0) + 1);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Star className="h-5 w-5 text-amber-500" />
        <div>
          <h2 className="text-lg font-semibold">Витрина главной страницы</h2>
          <p className="text-sm text-muted-foreground">
            Отображается {featured.length} товар(ов) из {priceLists.filter((p) => p.is_active).length} активных прайс-листов
          </p>
        </div>
      </div>

      {/* Add price list */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary" />
          <Label className="font-medium">Добавить прайс-лист на главную</Label>
        </div>
        <p className="text-xs text-muted-foreground">
          Вставьте ссылку на прайс-лист или его код доступа. Можно добавить сразу несколько — их товары объединятся на главной.
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="Ссылка на прайс-лист или код доступа..."
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addPriceList()}
            className="flex-1"
          />
          <Button onClick={addPriceList} disabled={adding || !newCode.trim()} size="sm">
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
            Добавить
          </Button>
        </div>
      </div>

      {/* Price list manager */}
      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-2 flex items-center justify-between">
          <div className="text-sm font-medium">Подключённые прайс-листы</div>
          <Badge variant="outline" className="text-xs">{priceLists.length}</Badge>
        </div>
        {loading ? (
          <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
        ) : priceLists.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Ни один прайс-лист не подключён. Добавьте первый по ссылке или коду доступа выше.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="h-9">
                <TableHead className="w-10"></TableHead>
                <TableHead className="text-xs">Прайс-лист</TableHead>
                <TableHead className="text-xs">Магазин</TableHead>
                <TableHead className="text-xs">Код</TableHead>
                <TableHead className="text-xs text-center">Товаров</TableHead>
                <TableHead className="text-xs text-center w-24">Активен</TableHead>
                <TableHead className="text-xs w-32">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {priceLists.map((pl, idx) => (
                <TableRow key={pl.id} className="h-10">
                  <TableCell className="text-muted-foreground">
                    <div className="flex flex-col">
                      <button
                        className="disabled:opacity-30"
                        disabled={idx === 0}
                        onClick={() => move(pl, "up")}
                      >
                        <ChevronUp className="h-3 w-3" />
                      </button>
                      <button
                        className="disabled:opacity-30"
                        disabled={idx === priceLists.length - 1}
                        onClick={() => move(pl, "down")}
                      >
                        <ChevronDown className="h-3 w-3" />
                      </button>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs font-medium">
                    {pl.catalog_name || <span className="text-destructive">Не найден</span>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{pl.store_name || "—"}</TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">{pl.access_code}</TableCell>
                  <TableCell className="text-xs text-center">{countsByHc.get(pl.id) || 0}</TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={pl.is_active}
                      disabled={busyId === pl.id}
                      onCheckedChange={(v) => toggleActive(pl, v)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setSettingsFor(pl)}
                        title="Настроить категории и товары"
                      >
                        <Settings2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        disabled={busyId === pl.id}
                        onClick={() => removePriceList(pl)}
                      >
                        {busyId === pl.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Displayed products */}
      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-2 flex items-center justify-between">
          <div className="text-sm font-medium">Товары на главной</div>
          <Badge variant="outline" className="text-xs">{featured.length}</Badge>
        </div>
        <div className="max-h-[500px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="h-9">
                <TableHead className="text-xs w-10">#</TableHead>
                <TableHead className="text-xs">Название</TableHead>
                <TableHead className="text-xs">Арт.</TableHead>
                <TableHead className="text-xs text-right">Цена</TableHead>
                <TableHead className="text-xs">Категория</TableHead>
                <TableHead className="text-xs">Магазин</TableHead>
                <TableHead className="text-xs">Прайс</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="h-24 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
              ) : featured.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground text-xs">
                  Нет отображаемых товаров. Добавьте активный прайс-лист.
                </TableCell></TableRow>
              ) : featured.map((f, idx) => (
                <TableRow key={f.id + "-" + idx} className="h-9">
                  <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                  <TableCell className="text-xs font-medium">{f.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{f.sku || "—"}</TableCell>
                  <TableCell className="text-xs text-right">{f.price?.toLocaleString("ru-RU")} ₽</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{f.category || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{f.store_name}</TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">{f.access_code || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {settingsFor && (
        <HomepageCatalogSettingsSheet
          catalog={settingsFor}
          onClose={() => setSettingsFor(null)}
          onChanged={fetchAll}
        />
      )}
    </div>
  );
}
