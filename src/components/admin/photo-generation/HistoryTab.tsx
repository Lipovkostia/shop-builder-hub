import { useMemo, useState } from "react";
import { useAiHistory, type AiHistoryItem } from "@/hooks/useAiHistory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Download, Trash2, RefreshCw, Search, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

function fmtDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}

async function downloadUrl(url: string, name: string) {
  try {
    const r = await fetch(url);
    const blob = await r.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  } catch {
    toast.error("Не удалось скачать");
  }
}

interface Props { storeId: string; }

export function HistoryTab({ storeId }: Props) {
  const { items, loading, reload, remove } = useAiHistory(storeId);
  const [q, setQ] = useState("");
  const [src, setSrc] = useState<string>("all");
  const [preview, setPreview] = useState<AiHistoryItem | null>(null);

  const sources = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => { if (i.source) set.add(i.source); });
    return Array.from(set);
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (src !== "all" && i.source !== src) return false;
      if (q && !i.prompt.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [items, q, src]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по промпту…" className="pl-8 h-9" />
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant={src === "all" ? "default" : "outline"} onClick={() => setSrc("all")}>Все</Button>
          {sources.map((s) => (
            <Button key={s} size="sm" variant={src === s ? "default" : "outline"} onClick={() => setSrc(s)}>
              {s === "photo_generation" ? "AI Photo" : s === "avito_editor" ? "Avito" : s}
            </Button>
          ))}
        </div>
        <Button size="sm" variant="ghost" onClick={reload} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Обновить
        </Button>
        <div className="ml-auto text-xs text-muted-foreground">Всего: {filtered.length}</div>
      </div>

      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Загрузка…</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground border border-dashed rounded-lg">
          <ImageIcon className="h-10 w-10 mb-2 opacity-50" />
          <div>История пуста</div>
          <div className="text-xs mt-1">Сгенерированные изображения появятся здесь автоматически</div>
        </div>
      ) : (
        <ScrollArea className="h-[calc(100vh-280px)]">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 pr-3">
            {filtered.map((it) => (
              <div key={it.id} className="group rounded-lg border border-border bg-card overflow-hidden flex flex-col">
                <button
                  type="button"
                  onClick={() => setPreview(it)}
                  className="relative aspect-square bg-muted overflow-hidden"
                >
                  <img src={it.url} alt={it.prompt} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                </button>
                <div className="p-2 space-y-1.5 flex-1 flex flex-col">
                  <div className="text-[11px] text-muted-foreground tabular-nums">{fmtDate(it.created_at)}</div>
                  {it.prompt && <div className="text-xs line-clamp-2" title={it.prompt}>{it.prompt}</div>}
                  <div className="flex flex-wrap gap-1">
                    {it.model && <Badge variant="secondary" className="text-[10px] px-1 py-0">{it.model}</Badge>}
                    {it.source && <Badge variant="outline" className="text-[10px] px-1 py-0">{it.source === "photo_generation" ? "AI Photo" : it.source === "avito_editor" ? "Avito" : it.source}</Badge>}
                  </div>
                  <div className="flex items-center gap-1 mt-auto pt-1">
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs flex-1" onClick={() => downloadUrl(it.url, it.name)}>
                      <Download className="h-3 w-3" /> Скачать
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={async () => {
                      if (!confirm("Удалить из истории?")) return;
                      await remove(it);
                      toast.success("Удалено");
                    }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="relative max-w-5xl max-h-full flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
            <img src={preview.url} alt={preview.prompt} className="max-h-[80vh] max-w-full object-contain rounded-lg" />
            <div className="bg-background/95 backdrop-blur rounded-lg p-3 space-y-1">
              <div className="text-xs text-muted-foreground">{fmtDate(preview.created_at)} · {preview.model} · {preview.source}</div>
              {preview.prompt && <div className="text-sm whitespace-pre-wrap">{preview.prompt}</div>}
              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={() => downloadUrl(preview.url, preview.name)}>
                  <Download className="h-4 w-4" /> Скачать
                </Button>
                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(preview.url); toast.success("Ссылка скопирована"); }}>
                  Скопировать ссылку
                </Button>
                <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setPreview(null)}>Закрыть</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
