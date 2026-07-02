import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { FileText, Trash2, Loader2, Eye, EyeOff } from "lucide-react";

const sb: any = supabase;
const FORCED_DISABLED_CATALOG_IDS = new Set(["35121234-2811-4da7-b838-36a43698d5e0"]);

function isForcedDisabledGroup(g: Group) {
  return !!(
    (g.catalogId && FORCED_DISABLED_CATALOG_IDS.has(g.catalogId)) ||
    (g.sourceUrlPrefix && Array.from(FORCED_DISABLED_CATALOG_IDS).some((id) => g.sourceUrlPrefix === `catalog:${id}:`)) ||
    g.label.toLowerCase().includes("оптовый прайс у2")
  );
}

interface HProduct {
  id: string;
  is_active: boolean;
  source_url: string | null;
  source_site: string | null;
}

interface Props {
  products: HProduct[];
  onChanged: () => void;
}

interface Group {
  key: string; // catalogId or "manual" / "site:<host>"
  label: string;
  total: number;
  active: number;
  productIds: string[];
  isManual: boolean;
  catalogId: string | null;
  sourceSite: string | null;
  sourceUrlPrefix: string | null;
}

function groupProducts(products: HProduct[]): Group[] {
  const map = new Map<string, Group>();
  for (const p of products) {
    let key = "manual";
    let label = "Добавлено вручную";
    let isManual = true;

    const src = p.source_url || "";
    const m = src.match(/^catalog:([^:]+):/);
    let catalogId: string | null = null;
    let sourceUrlPrefix: string | null = null;
    if (m) {
      catalogId = m[1];
      sourceUrlPrefix = `catalog:${m[1]}:`;
      key = `catalog:${m[1]}`;
      label = p.source_site || `Прайс-лист ${m[1].slice(0, 8)}`;
      isManual = false;
    } else if (src && /^https?:/.test(src)) {
      try {
        const host = new URL(src).host;
        key = `site:${host}`;
        label = p.source_site || host;
        isManual = false;
      } catch {}
    } else if (p.source_site) {
      key = `site:${p.source_site}`;
      label = p.source_site;
      isManual = false;
    }

    let g = map.get(key);
    if (!g) {
      g = { key, label, total: 0, active: 0, productIds: [], isManual, catalogId, sourceSite: p.source_site || null, sourceUrlPrefix };
      map.set(key, g);
    }
    g.total += 1;
    if (p.is_active) g.active += 1;
    g.productIds.push(p.id);
    // Prefer non-empty label
    if (!g.label && label) g.label = label;
  }
  return Array.from(map.values()).sort((a, b) => {
    if (a.isManual !== b.isManual) return a.isManual ? 1 : -1;
    return b.total - a.total;
  });
}

export default function ConnectedPriceListsPanel({ products, onChanged }: Props) {
  const { toast } = useToast();
  const groups = useMemo(() => groupProducts(products), [products]);
  const [busy, setBusy] = useState<string | null>(null);

  const setActive = async (g: Group, active: boolean) => {
    setBusy(g.key);
    try {
      // Проверяем сессию — RLS требует super_admin
      const { data: sess } = await sb.auth.getSession();
      if (!sess?.session) {
        throw new Error("Нет активной сессии. Войдите заново под super_admin.");
      }

      if (active && isForcedDisabledGroup(g)) {
        throw new Error("Оптовый прайс У2 принудительно отключён для главной страницы.");
      }

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/homepage-catalog`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sess.session.access_token}`,
        },
        body: JSON.stringify({
          action: "toggle_homepage_products_group",
          is_active: active,
          source_url_prefix: g.sourceUrlPrefix,
          source_site: g.sourceSite,
          product_ids: g.sourceUrlPrefix || g.sourceSite ? undefined : g.productIds,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      if (!json.count) {
        throw new Error(
          "0 строк обновлено. Скорее всего у аккаунта нет прав super_admin — войдите под lipovkostia@gmail.com."
        );
      }
      toast({
        title: active ? "Прайс включён" : "Прайс скрыт",
        description: `${g.label} · ${json.count} товаров`,
      });
      onChanged();
    } catch (e: any) {
      console.error("[ConnectedPriceListsPanel] setActive failed", e);
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const removeGroup = async (g: Group) => {
    if (!confirm(`Удалить все ${g.total} товаров прайса «${g.label}» с главной?`)) return;
    setBusy(g.key);
    try {
      const { data: sess } = await sb.auth.getSession();
      if (!sess?.session) throw new Error("Нет активной сессии. Войдите заново под super_admin.");
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/homepage-catalog`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sess.session.access_token}`,
        },
        body: JSON.stringify({
          action: "remove_homepage_products_group",
          source_url_prefix: g.sourceUrlPrefix,
          source_site: g.sourceSite,
          product_ids: g.sourceUrlPrefix || g.sourceSite ? undefined : g.productIds,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      toast({ title: "Удалено", description: `${g.label} · ${g.total} товаров` });
      onChanged();
    } catch (e: any) {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  if (groups.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" /> Подключённые прайс-листы
        </CardTitle>
        <CardDescription>
          Управляйте отображением на главной: выключите тумблер, чтобы скрыть все товары прайса, или удалите прайс целиком.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
          {groups.map((g) => {
            const allActive = g.active === g.total;
            const noneActive = g.active === 0;
            const isBusy = busy === g.key;
            const forcedDisabled = isForcedDisabledGroup(g);
            return (
              <div
                key={g.key}
                className="flex items-center gap-3 p-3 border rounded-lg bg-card"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{g.label}</span>
                    {g.isManual && (
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5">вручную</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                    <span>Товаров: {g.total}</span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      {noneActive ? (
                        <>
                          <EyeOff className="h-3 w-3" /> скрыто
                        </>
                      ) : allActive ? (
                        <>
                          <Eye className="h-3 w-3" /> показано {g.active}
                        </>
                      ) : (
                        <>частично: {g.active}/{g.total}</>
                      )}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {isBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : (
                    <Switch
                      checked={forcedDisabled ? false : allActive}
                      onCheckedChange={(v) => setActive(g, v)}
                      disabled={forcedDisabled && !allActive}
                      aria-label="Показывать этот прайс"
                    />
                  )}
                  {!g.isManual && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => removeGroup(g)}
                      disabled={isBusy}
                      title="Удалить все товары прайса с главной"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
