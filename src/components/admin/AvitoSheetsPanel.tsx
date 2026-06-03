import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { FileSpreadsheet, RefreshCw, ExternalLink, Loader2, ArrowDownToLine, AlertTriangle, Upload, Link2, X } from "lucide-react";
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

function extractSpreadsheetId(url: string): string | null {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(url.trim())) return url.trim();
  return null;
}

export function AvitoSheetsPanel({ storeId }: Props) {
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [connecting, setConnecting] = useState(false);
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

  const callAction = async (action: "sync" | "pull") => {
    const setter = action === "pull" ? setPulling : setSyncing;
    setter(true);
    try {
      const { data, error } = await supabase.functions.invoke("avito-sheets-sync", {
        body: { action, storeId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(
        action === "pull"
          ? `Обновлено из таблицы: ${(data as any)?.updated ?? 0}`
          : `Выгружено в таблицу: ${(data as any)?.rows ?? 0} строк`,
      );
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Ошибка синхронизации");
    } finally {
      setter(false);
    }
  };

  const connectSpreadsheet = async () => {
    const spreadsheetId = extractSpreadsheetId(urlInput);
    if (!spreadsheetId) {
      toast.error("Не удалось распознать ссылку. Вставьте ссылку вида https://docs.google.com/spreadsheets/d/…");
      return;
    }
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("avito-sheets-sync", {
        body: { action: "connect_spreadsheet", storeId, spreadsheetId, spreadsheetUrl: urlInput.trim() },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Таблица подключена");
      setUrlInput("");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Не удалось подключить таблицу. Проверьте, что у таблицы открыт доступ «Редактор по ссылке».");
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    if (!confirm("Отключить таблицу? Данные в самой таблице не пострадают.")) return;
    await supabase.from("store_google_integrations" as any).delete().eq("store_id", storeId);
    toast.success("Отключено");
    await load();
  };

  const importErrorsFromFile = async (file: File) => {
    try {
      const text = await file.text();
      let parsed: any[] = [];
      try {
        const j = JSON.parse(text);
        parsed = Array.isArray(j) ? j : j.errors || [];
      } catch {
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
      <div className="flex items-center gap-3 flex-wrap">
        <FileSpreadsheet className="h-5 w-5 text-emerald-600 shrink-0" />
        <div className="flex-1 min-w-[200px]">
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

      {!integration?.spreadsheet_id ? (
        <div className="mt-3 space-y-2">
          <div className="text-xs text-muted-foreground">
            <b>Шаг 1.</b> В Google Sheets создайте пустую таблицу и откройте доступ «Редактор для всех, у кого есть ссылка».<br />
            <b>Шаг 2.</b> Скопируйте ссылку из адресной строки браузера и вставьте сюда.<br />
            <b>Шаг 3.</b> Нажмите «Подключить», затем «Выгрузить товары в таблицу».
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="https://docs.google.com/spreadsheets/d/…"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="bg-background"
              onKeyDown={(e) => e.key === "Enter" && connectSpreadsheet()}
            />
            <Button
              size="sm"
              onClick={connectSpreadsheet}
              disabled={connecting || !urlInput.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
            >
              {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              Подключить таблицу
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              onClick={() => callAction("sync")}
              disabled={syncing}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Выгрузить товары в таблицу
            </Button>
            <Button size="sm" variant="outline" onClick={() => callAction("pull")} disabled={pulling}>
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
                  Открыть таблицу
                </a>
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={disconnect} className="text-muted-foreground hover:text-destructive ml-auto">
              <X className="h-4 w-4" />
              Отключить
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Убедитесь, что в Google Таблице открыт доступ <b>«Редактор» для всех, у кого есть ссылка</b>. Затем нажмите <b>«Выгрузить товары в таблицу»</b> — все товары из вкладки «Лента» попадут на лист «Товары». Повторное нажатие перезапишет данные актуальными.
          </p>
        </>
      )}
    </Card>
  );
}
