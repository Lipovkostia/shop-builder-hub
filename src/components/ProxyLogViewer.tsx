import { useEffect, useMemo, useState } from "react";
import { proxyLog, type ProxyLogEntry } from "@/integrations/supabase/proxy";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, Trash2, X } from "lucide-react";
import { toast } from "sonner";

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour12: false }) + "." + String(d.getMilliseconds()).padStart(3, "0");
}

function statusColor(status?: number): string {
  if (status == null) return "bg-muted text-muted-foreground";
  if (status >= 500) return "bg-red-600 text-white";
  if (status >= 400) return "bg-orange-500 text-white";
  if (status >= 300) return "bg-yellow-500 text-black";
  if (status >= 200) return "bg-green-600 text-white";
  return "bg-muted text-muted-foreground";
}

export function ProxyLogViewer() {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<ProxyLogEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    const unsub = proxyLog.subscribe(setEntries);
    return () => { unsub(); };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+[ или Cmd+[
      if ((e.ctrlKey || e.metaKey) && e.key === "[") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) =>
      e.url.toLowerCase().includes(q) ||
      e.method.toLowerCase().includes(q) ||
      (e.status != null && String(e.status).includes(q))
    );
  }, [entries, filter]);

  const selected = filtered.find((e) => e.id === selectedId) ?? filtered[0];

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`Скопировано: ${label}`);
    } catch {
      toast.error("Не удалось скопировать");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] p-0 flex flex-col">
        <DialogHeader className="px-4 py-3 border-b flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
            <DialogTitle>Журнал запросов через прокси</DialogTitle>
            <span className="text-xs text-muted-foreground">Ctrl+[ — открыть/закрыть · {entries.length} записей</span>
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Фильтр URL / метод / статус"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="h-8 w-64"
            />
            <Button size="sm" variant="outline" onClick={() => proxyLog.clear()}>
              <Trash2 className="h-4 w-4 mr-1" /> Очистить
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <div className="flex-1 min-h-0 grid grid-cols-[minmax(360px,40%)_1fr]">
          {/* список */}
          <div className="border-r min-h-0 flex flex-col">
            <ScrollArea className="flex-1">
              <div className="divide-y">
                {filtered.length === 0 ? (
                  <div className="p-6 text-sm text-muted-foreground text-center">Запросов пока нет</div>
                ) : filtered.map((e) => {
                  const isSel = selected?.id === e.id;
                  const path = (() => {
                    try { const u = new URL(e.url); return u.pathname + u.search; } catch { return e.url; }
                  })();
                  return (
                    <button
                      key={e.id}
                      onClick={() => setSelectedId(e.id)}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-accent/50 ${isSel ? "bg-accent" : ""}`}
                    >
                      <div className="flex items-center gap-2">
                        <Badge className={statusColor(e.status)}>{e.status ?? (e.error ? "ERR" : "…")}</Badge>
                        <span className="font-mono font-semibold">{e.method}</span>
                        <span className="ml-auto text-muted-foreground">{e.durationMs != null ? `${e.durationMs}ms` : ""}</span>
                        <span className="text-muted-foreground">{formatTime(e.ts)}</span>
                      </div>
                      <div className="mt-1 font-mono truncate text-[11px]" title={path}>{path}</div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* детали */}
          <div className="min-h-0 flex flex-col">
            {!selected ? (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                Выберите запрос слева
              </div>
            ) : (
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={statusColor(selected.status)}>
                      {selected.status ?? (selected.error ? "ERROR" : "pending")}
                      {selected.statusText ? ` ${selected.statusText}` : ""}
                    </Badge>
                    <span className="font-mono font-semibold">{selected.method}</span>
                    {selected.durationMs != null && <span className="text-xs text-muted-foreground">{selected.durationMs}ms</span>}
                    <span className="text-xs text-muted-foreground">{new Date(selected.ts).toLocaleString()}</span>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-xs font-semibold text-muted-foreground">URL (через прокси)</div>
                      <Button size="sm" variant="ghost" onClick={() => copy(selected.url, "URL")}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    <pre className="text-xs bg-muted/50 p-2 rounded font-mono break-all whitespace-pre-wrap">{selected.url}</pre>
                    {selected.originalUrl !== selected.url && (
                      <>
                        <div className="text-xs font-semibold text-muted-foreground mt-2 mb-1">Оригинальный URL</div>
                        <pre className="text-xs bg-muted/50 p-2 rounded font-mono break-all whitespace-pre-wrap">{selected.originalUrl}</pre>
                      </>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-xs font-semibold text-muted-foreground">Запрос (cURL)</div>
                      <Button size="sm" variant="ghost" onClick={() => copy(selected.curl, "cURL")}>
                        <Copy className="h-3 w-3 mr-1" /> Копировать
                      </Button>
                    </div>
                    <pre className="text-xs bg-muted/50 p-2 rounded font-mono whitespace-pre-wrap break-all">{selected.curl}</pre>
                  </div>

                  {selected.error && (
                    <div>
                      <div className="text-xs font-semibold text-red-500 mb-1">Ошибка</div>
                      <pre className="text-xs bg-red-500/10 text-red-700 dark:text-red-300 p-2 rounded font-mono whitespace-pre-wrap">{selected.error}</pre>
                    </div>
                  )}

                  {selected.responseHeaders && (
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground mb-1">Заголовки ответа</div>
                      <pre className="text-xs bg-muted/50 p-2 rounded font-mono whitespace-pre-wrap">{Object.entries(selected.responseHeaders).map(([k, v]) => `${k}: ${v}`).join("\n")}</pre>
                    </div>
                  )}

                  {selected.responseBody != null && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-xs font-semibold text-muted-foreground">
                          Тело ответа {selected.responseBodyTruncated ? "(усечено)" : ""}
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => copy(selected.responseBody ?? "", "тело ответа")}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <pre className="text-xs bg-muted/50 p-2 rounded font-mono whitespace-pre-wrap break-all max-h-[50vh] overflow-auto">{selected.responseBody}</pre>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
