import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, RefreshCw, ExternalLink, Loader2, ArrowDownToLine, AlertTriangle, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  storeId: string;
}

interface Integration {
  spreadsheet_id: string | null;
  spreadsheet_url: string | null;
  last_synced_at: string | null;
}

export function AvitoSheetsPanel({ storeId }: Props) {
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [errorsCount, setErrorsCount] = useState(0);

  const load = async () => {
    const { data } = await supabase
      .from("store_google_integrations" as any)
      .select("spreadsheet_id, spreadsheet_url, last_synced_at")
      .eq("store_id", storeId)
      .maybeSingle();
    setIntegration(data as any);
    const { count } = await supabase
      .from("avito_listing_errors" as any)
      .select("*", { count: "exact", head: true })
      .eq("store_id", storeId)
      .eq("resolved", false);
    setErrorsCount(count || 0);
  };

  useEffect(() => { load(); }, [storeId]);

  const callSync = async (action: "create_spreadsheet" | "sync" | "pull") => {
    const setter = action === "create_spreadsheet" ? setLoading : action === "pull" ? setPulling : setSyncing;
    setter(true);
    try {
      const { data, error } = await supabase.functions.invoke("avito-sheets-sync", {
        body: { action, storeId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(
        action === "create_spreadsheet"
          ? "Google Таблица создана"
          : action === "pull"
          ? `Обновлено из таблицы: ${(data as any)?.updated ?? 0}`
          : `Синхронизировано: ${(data as any)?.rows ?? 0} строк`,
      );
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Ошибка синхронизации");
    } finally {
      setter(false);
    }
  };

  const importErrorsFromFile = async (file: File) => {
    try {
      const text = await file.text();
      let parsed: any[] = [];
      try {
        const j = JSON.parse(text);
        parsed = Array.isArray(j) ? j : j.errors || [];
      } catch {
        // CSV: ad_id,field,severity,message
        const lines = text.split(/\r?\n/).filter(Boolean);
        const header = lines[0].split(",").map((s) => s.trim().toLowerCase());
        parsed = lines.slice(1).map((line) => {
          const cols = line.split(",");
          const obj: any = {};
          header.forEach((h, i) => (obj[h] = cols[i]?.trim()));
          return obj;
        });
      }
      const { data, error } = await supabase.functions.invoke("avito-sheets-sync", {
        body: { action: "import_errors", storeId, errors: parsed },
      });
      if (error) throw error;
      toast.success(`Импортировано ошибок: ${(data as any)?.imported ?? 0}`);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Не удалось импортировать");
    }
  };

  return (
    <Card className="p-4 mb-4 border-emerald-500/30 bg-emerald-500/5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
          <div>
            <div className="font-medium text-sm">Google Таблицы</div>
            <div className="text-xs text-muted-foreground">
              {integration?.spreadsheet_id
                ? `Связано · последняя синхронизация: ${
                    integration.last_synced_at
                      ? new Date(integration.last_synced_at).toLocaleString("ru-RU")
                      : "—"
                  }`
                : "Не подключено"}
            </div>
          </div>
          {integration?.spreadsheet_id && (
            <Badge variant="outline" className="border-emerald-500/50 text-emerald-700">
              онлайн-экспорт
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!integration?.spreadsheet_id ? (
            <Button size="sm" onClick={() => callSync("create_spreadsheet")} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
              Создать таблицу
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                onClick={() => callSync("sync")}
                disabled={syncing}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Обновить товары в Google Таблице
              </Button>
              <Button size="sm" variant="outline" onClick={() => callSync("pull")} disabled={pulling}>
                {pulling ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDownToLine className="h-4 w-4" />}
                Загрузить из таблицы
              </Button>
              <label className="inline-flex">
                <input
                  type="file"
                  accept=".json,.csv,text/csv,application/json"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && importErrorsFromFile(e.target.files[0])}
                />
                <Button size="sm" variant="outline" asChild>
                  <span><Upload className="h-4 w-4" />Импорт ошибок</span>
                </Button>
              </label>
              {errorsCount > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" /> {errorsCount}
                </Badge>
              )}
              {integration.spreadsheet_url && (
                <Button size="sm" variant="ghost" asChild>
                  <a href={integration.spreadsheet_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Открыть
                  </a>
                </Button>
              )}
            </>
          )}
        </div>
      </div>
      {!integration?.spreadsheet_id && (
        <p className="text-xs text-muted-foreground mt-3">
          После создания в таблице появятся листы «Товары», «Ошибки», «Лог». Правки можно делать прямо в таблице — кнопка «Загрузить из таблицы» подтянет их обратно в систему.
        </p>
      )}
    </Card>
  );
}
