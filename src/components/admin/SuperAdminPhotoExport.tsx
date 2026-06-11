import { useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Download, FolderTree, FolderArchive, Image as ImageIcon, Loader2, Search, CheckSquare, Square, X, History, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface StoreOpt { id: string; name: string; subdomain: string }
interface Row {
  id: string;
  name: string;
  store_id: string;
  store_name: string;
  category_id: string | null;
  category_name: string | null;
  images: string[];
}

type Mode = "by_product" | "by_category" | "flat";

interface HistoryEntry {
  id: string;
  filename: string;
  mode: Mode;
  createdAt: number;
  products: number;
  photos: number;
  failed: number;
  size: number;
  storeName: string;
}

const sanitize = (s: string) =>
  (s || "untitled").replace(/[\\/:*?"<>|\u0000-\u001F]+/g, "_").replace(/\s+/g, " ").trim().slice(0, 120) || "untitled";

const extFromUrl = (u: string) => {
  try {
    const path = new URL(u).pathname;
    const m = path.match(/\.([a-zA-Z0-9]{2,5})$/);
    return (m ? m[1] : "jpg").toLowerCase();
  } catch { return "jpg"; }
};

async function fetchBlob(url: string, signal: AbortSignal, retries = 2): Promise<Blob | null> {
  for (let i = 0; i <= retries; i++) {
    if (signal.aborted) return null;
    try {
      const r = await fetch(url, { cache: "no-store", signal });
      if (r.ok) return await r.blob();
    } catch (e: any) {
      if (e?.name === "AbortError") return null;
    }
    await new Promise((r) => setTimeout(r, 250 * (i + 1)));
  }
  return null;
}

async function mapLimit<T, R>(items: T[], limit: number, signal: AbortSignal, fn: (it: T, idx: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (true) {
        if (signal.aborted) return;
        const idx = i++;
        if (idx >= items.length) return;
        out[idx] = await fn(items[idx], idx);
      }
    })
  );
  return out;
}

// --- IndexedDB history (stores ZIP blobs locally) ---
const DB_NAME = "photo-export-history";
const STORE = "exports";
const MAX_HISTORY = 10;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function dbPut(entry: HistoryEntry & { blob: Blob }) {
  const db = await openDB();
  return new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(entry);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}
async function dbList(): Promise<(HistoryEntry & { blob: Blob })[]> {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => res((req.result as any[]) || []);
    req.onerror = () => rej(req.error);
  });
}
async function dbDelete(id: string) {
  const db = await openDB();
  return new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

function fmtSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
function fmtDate(ts: number) {
  return new Date(ts).toLocaleString("ru-RU");
}
const modeLabel: Record<Mode, string> = {
  by_product: "По товарам",
  by_category: "По категориям",
  flat: "Единый список",
};

export default function SuperAdminPhotoExport() {
  const [stores, setStores] = useState<StoreOpt[]>([]);
  const [storeId, setStoreId] = useState<string>("all");
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<Mode>("by_product");

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const abortRef = useRef<AbortController | null>(null);

  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const refreshHistory = async () => {
    try {
      const all = await dbList();
      all.sort((a, b) => b.createdAt - a.createdAt);
      setHistory(all.map(({ blob, ...meta }) => meta));
    } catch {}
  };

  useEffect(() => {
    supabase.from("stores").select("id,name,subdomain").order("name").then(({ data }) => {
      setStores((data as any) || []);
    });
    refreshHistory();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      let q = supabase
        .from("products")
        .select("id,name,store_id,category_id,images, stores(name), categories(name)")
        .not("images", "is", null)
        .is("deleted_at", null)
        .limit(5000);
      if (storeId !== "all") q = q.eq("store_id", storeId);
      const { data, error } = await q;
      if (error) throw error;
      const mapped: Row[] = ((data as any[]) || [])
        .map((p) => ({
          id: p.id,
          name: p.name,
          store_id: p.store_id,
          store_name: p.stores?.name || "—",
          category_id: p.category_id,
          category_name: p.categories?.name || null,
          images: Array.isArray(p.images) ? p.images.filter((u: any) => typeof u === "string" && u.trim()) : [],
        }))
        .filter((r) => r.images.length > 0);
      setRows(mapped);
      setSelected(new Set(mapped.map((r) => r.id)));
      toast.success(`Загружено товаров с фото: ${mapped.length}`);
    } catch (e: any) {
      toast.error(e?.message || "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      r.name.toLowerCase().includes(q) ||
      r.store_name.toLowerCase().includes(q) ||
      (r.category_name || "").toLowerCase().includes(q)
    );
  }, [rows, search]);

  const totalImages = useMemo(
    () => rows.filter((r) => selected.has(r.id)).reduce((a, r) => a + r.images.length, 0),
    [rows, selected]
  );

  const toggle = (id: string) => {
    setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const selectAll = () => setSelected(new Set(filtered.map((r) => r.id)));
  const clearAll = () => setSelected(new Set());

  const cancelExport = () => {
    abortRef.current?.abort();
    toast.message("Отмена...");
  };

  const exportZip = async (m: Mode) => {
    const targets = rows.filter((r) => selected.has(r.id));
    if (!targets.length) { toast.error("Выберите товары"); return; }
    const total = targets.reduce((a, r) => a + r.images.length, 0);
    if (!total) { toast.error("Нет фотографий"); return; }

    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setProgress({ done: 0, total });

    try {
      const zip = new JSZip();
      const nameCounts = new Map<string, number>();
      const safeFolder = (base: string) => {
        const n = nameCounts.get(base) || 0;
        nameCounts.set(base, n + 1);
        return n === 0 ? base : `${base} (${n + 1})`;
      };

      const productFolder = new Map<string, string>();
      for (const r of targets) {
        let path: string;
        const pName = sanitize(r.name);
        if (m === "by_product") {
          path = safeFolder(pName);
        } else if (m === "by_category") {
          const cat = sanitize(r.category_name || "Без категории");
          path = `${cat}/${pName}`;
          const key = path;
          const n = nameCounts.get(key) || 0;
          nameCounts.set(key, n + 1);
          if (n > 0) path = `${cat}/${pName} (${n + 1})`;
        } else {
          path = "";
        }
        productFolder.set(r.id, path);
      }

      type Job = { url: string; folder: string; idx: number; productName: string };
      const jobs: Job[] = [];
      for (const r of targets) {
        const folder = productFolder.get(r.id) || "";
        r.images.forEach((u, i) => jobs.push({ url: u, folder, idx: i, productName: sanitize(r.name) }));
      }

      const flatNames = new Set<string>();
      const uniqueFlat = (base: string, ext: string) => {
        let n = base;
        let i = 1;
        while (flatNames.has(`${n}.${ext}`)) { n = `${base} (${++i})`; }
        flatNames.add(`${n}.${ext}`);
        return `${n}.${ext}`;
      };

      let done = 0;
      let failed = 0;
      await mapLimit(jobs, 8, controller.signal, async (job) => {
        const blob = await fetchBlob(job.url, controller.signal);
        done++;
        setProgress({ done, total });
        if (!blob) { failed++; return; }
        const ext = extFromUrl(job.url);
        if (m === "flat") {
          const fname = uniqueFlat(`${job.productName} - ${job.idx + 1}`, ext);
          zip.file(fname, blob);
        } else {
          zip.file(`${job.folder}/${job.idx + 1}.${ext}`, blob);
        }
      });

      if (controller.signal.aborted) {
        toast.message("Экспорт отменён");
        return;
      }

      toast.message("Упаковка архива...");
      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 4 } });
      if (controller.signal.aborted) { toast.message("Экспорт отменён"); return; }

      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      const filename = `photos_${m}_${stamp}.zip`;

      const a = document.createElement("a");
      const url = URL.createObjectURL(blob);
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      // Save to history (IndexedDB)
      try {
        const entry = {
          id: crypto.randomUUID(),
          filename,
          mode: m,
          createdAt: Date.now(),
          products: targets.length,
          photos: done - failed,
          failed,
          size: blob.size,
          storeName: storeId === "all" ? "Все магазины" : (stores.find((s) => s.id === storeId)?.name || "—"),
          blob,
        };
        await dbPut(entry);
        // Trim history
        const all = await dbList();
        if (all.length > MAX_HISTORY) {
          const sorted = all.sort((a, b) => b.createdAt - a.createdAt);
          for (const old of sorted.slice(MAX_HISTORY)) await dbDelete(old.id);
        }
        await refreshHistory();
      } catch (e) {
        console.warn("History save failed", e);
      }

      toast.success(`Готово: ${done - failed} фото${failed ? `, ошибок: ${failed}` : ""}`);
    } catch (e: any) {
      if (e?.name === "AbortError") toast.message("Экспорт отменён");
      else toast.error(e?.message || "Ошибка экспорта");
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  };

  const redownload = async (id: string) => {
    try {
      const all = await dbList();
      const item = all.find((x) => x.id === id);
      if (!item) { toast.error("Файл не найден"); return; }
      const a = document.createElement("a");
      const url = URL.createObjectURL(item.blob);
      a.href = url;
      a.download = item.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e?.message || "Ошибка скачивания");
    }
  };

  const removeHistory = async (id: string) => {
    await dbDelete(id);
    await refreshHistory();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ImageIcon className="h-5 w-5" /> Экспорт фотографий товаров</CardTitle>
          <CardDescription>
            Скачайте все фото товаров в ZIP. Три режима: по товару, по категориям, единым списком.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <div className="space-y-1">
              <Label>Магазин</Label>
              <Select value={storeId} onValueChange={setStoreId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все магазины</SelectItem>
                  {stores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name} ({s.subdomain})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Поиск</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8" placeholder="Товар, категория, магазин" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
            <div className="flex items-end">
              <Button onClick={load} disabled={loading || busy}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                Загрузить товары
              </Button>
            </div>
          </div>

          {rows.length > 0 && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">Товаров: {rows.length}</Badge>
                <Badge variant="secondary">Выбрано: {selected.size}</Badge>
                <Badge>Фото к выгрузке: {totalImages}</Badge>
                <div className="ml-auto flex gap-2">
                  <Button size="sm" variant="outline" onClick={selectAll} disabled={busy}><CheckSquare className="h-4 w-4 mr-1" />Выбрать все</Button>
                  <Button size="sm" variant="outline" onClick={clearAll} disabled={busy}><Square className="h-4 w-4 mr-1" />Снять</Button>
                </div>
              </div>

              <div className="grid gap-2 md:grid-cols-3">
                <Button
                  variant={mode === "by_product" ? "default" : "outline"}
                  onClick={() => { setMode("by_product"); exportZip("by_product"); }}
                  disabled={busy || !selected.size}
                  className="h-auto py-3 flex-col items-start text-left"
                >
                  <div className="flex items-center gap-2 font-medium"><FolderArchive className="h-4 w-4" /> По товарам</div>
                  <div className="text-xs opacity-80 mt-1">Папка = название товара, внутри его фото</div>
                </Button>
                <Button
                  variant={mode === "by_category" ? "default" : "outline"}
                  onClick={() => { setMode("by_category"); exportZip("by_category"); }}
                  disabled={busy || !selected.size}
                  className="h-auto py-3 flex-col items-start text-left"
                >
                  <div className="flex items-center gap-2 font-medium"><FolderTree className="h-4 w-4" /> По категориям</div>
                  <div className="text-xs opacity-80 mt-1">Категория / Товар / фото.jpg</div>
                </Button>
                <Button
                  variant={mode === "flat" ? "default" : "outline"}
                  onClick={() => { setMode("flat"); exportZip("flat"); }}
                  disabled={busy || !selected.size}
                  className="h-auto py-3 flex-col items-start text-left"
                >
                  <div className="flex items-center gap-2 font-medium"><ImageIcon className="h-4 w-4" /> Все в одну папку</div>
                  <div className="text-xs opacity-80 mt-1">Имя файла = название товара</div>
                </Button>
              </div>

              {busy && (
                <div className="space-y-2">
                  <Progress value={progress.total ? (progress.done / progress.total) * 100 : 0} />
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">Скачано {progress.done} из {progress.total}</div>
                    <Button size="sm" variant="destructive" onClick={cancelExport}>
                      <X className="h-4 w-4 mr-1" /> Отменить
                    </Button>
                  </div>
                </div>
              )}

              <div className="max-h-[480px] overflow-auto border rounded-md">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="p-2 text-left w-8"></th>
                      <th className="p-2 text-left">Товар</th>
                      <th className="p-2 text-left">Магазин</th>
                      <th className="p-2 text-left">Категория</th>
                      <th className="p-2 text-right">Фото</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr key={r.id} className="border-t hover:bg-muted/50">
                        <td className="p-2"><Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} /></td>
                        <td className="p-2">{r.name}</td>
                        <td className="p-2 text-muted-foreground">{r.store_name}</td>
                        <td className="p-2 text-muted-foreground">{r.category_name || "—"}</td>
                        <td className="p-2 text-right">{r.images.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><History className="h-5 w-5" /> История экспортов</CardTitle>
          <CardDescription>
            Последние {MAX_HISTORY} архивов сохраняются локально в браузере — можно скачать повторно.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="text-sm text-muted-foreground">История пуста</div>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-2 text-left">Дата</th>
                    <th className="p-2 text-left">Файл</th>
                    <th className="p-2 text-left">Режим</th>
                    <th className="p-2 text-left">Магазин</th>
                    <th className="p-2 text-right">Товаров</th>
                    <th className="p-2 text-right">Фото</th>
                    <th className="p-2 text-right">Размер</th>
                    <th className="p-2 text-right">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id} className="border-t hover:bg-muted/50">
                      <td className="p-2 whitespace-nowrap">{fmtDate(h.createdAt)}</td>
                      <td className="p-2 font-mono text-xs">{h.filename}</td>
                      <td className="p-2">{modeLabel[h.mode]}</td>
                      <td className="p-2 text-muted-foreground">{h.storeName}</td>
                      <td className="p-2 text-right">{h.products}</td>
                      <td className="p-2 text-right">
                        {h.photos}{h.failed ? <span className="text-destructive"> / {h.failed}✗</span> : null}
                      </td>
                      <td className="p-2 text-right">{fmtSize(h.size)}</td>
                      <td className="p-2 text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" onClick={() => redownload(h.id)}>
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => removeHistory(h.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
