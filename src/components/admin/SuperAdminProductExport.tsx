import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  FileSpreadsheet, Loader2, Search, CheckSquare, Square, X, History, Trash2, Download, FileText, Layers, FolderArchive,
} from "lucide-react";
import { toast } from "sonner";

interface StoreOpt { id: string; name: string; subdomain: string; products_count: number | null }
interface ProductRow {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  price: number | null;
  store_id: string;
  store_name: string;
  store_subdomain: string;
  category_name: string | null;
}

type ExportMode = "single_sheet" | "sheet_per_store" | "file_per_store";

interface HistoryEntry {
  id: string;
  filename: string;
  mode: ExportMode;
  createdAt: number;
  storesCount: number;
  productsCount: number;
  size: number;
  storesLabel: string;
}

const sanitize = (s: string) =>
  (s || "untitled").replace(/[\\/:*?"<>|\u0000-\u001F]+/g, "_").replace(/\s+/g, " ").trim().slice(0, 100) || "untitled";

const stripHtml = (s: string | null) =>
  (s || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const fmtSize = (n: number) =>
  n < 1024 ? `${n} B` :
  n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` :
  n < 1024 * 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` :
  `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;

const fmtDate = (ts: number) => new Date(ts).toLocaleString("ru-RU");

const modeLabel: Record<ExportMode, string> = {
  single_sheet: "Один лист (все товары)",
  sheet_per_store: "Один файл, лист на магазин",
  file_per_store: "Отдельный файл на магазин (ZIP)",
};

// --- IndexedDB history ---
const DB_NAME = "product-export-history";
const STORE = "exports";
const MAX_HISTORY = 15;

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

const COLUMNS = [
  { key: "store_name", label: "Магазин", width: 26 },
  { key: "store_subdomain", label: "Subdomain", width: 18 },
  { key: "category_name", label: "Категория", width: 24 },
  { key: "sku", label: "Артикул", width: 14 },
  { key: "name", label: "Название", width: 50 },
  { key: "description", label: "Описание", width: 80 },
  { key: "price", label: "Цена", width: 12 },
] as const;

function buildSheet(rows: ProductRow[]) {
  const aoa: any[][] = [COLUMNS.map((c) => c.label)];
  for (const r of rows) {
    aoa.push([
      r.store_name,
      r.store_subdomain,
      r.category_name || "",
      r.sku || "",
      r.name || "",
      stripHtml(r.description),
      r.price ?? "",
    ]);
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = COLUMNS.map((c) => ({ wch: c.width }));
  // Freeze header
  (ws as any)["!freeze"] = { xSplit: 0, ySplit: 1 };
  ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: COLUMNS.length - 1, r: rows.length } }) };
  return ws;
}

export default function SuperAdminProductExport() {
  const [stores, setStores] = useState<StoreOpt[]>([]);
  const [search, setSearch] = useState("");
  const [selectedStores, setSelectedStores] = useState<Set<string>>(new Set());
  const [loadingStores, setLoadingStores] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, label: "" });
  const abortRef = useRef<AbortController | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const [includeEmptyDesc, setIncludeEmptyDesc] = useState(true);
  const [onlyActive, setOnlyActive] = useState(true);

  const refreshHistory = async () => {
    try {
      const all = await dbList();
      all.sort((a, b) => b.createdAt - a.createdAt);
      setHistory(all.map(({ blob, ...meta }) => meta));
    } catch {}
  };

  useEffect(() => {
    (async () => {
      setLoadingStores(true);
      const { data } = await supabase
        .from("stores")
        .select("id,name,subdomain,products_count")
        .order("name");
      setStores(((data as any) || []) as StoreOpt[]);
      setLoadingStores(false);
    })();
    refreshHistory();
  }, []);

  const filteredStores = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return stores;
    return stores.filter((s) =>
      s.name.toLowerCase().includes(q) || s.subdomain.toLowerCase().includes(q),
    );
  }, [stores, search]);

  const toggleStore = (id: string) =>
    setSelectedStores((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectAll = () => setSelectedStores(new Set(filteredStores.map((s) => s.id)));
  const selectAllStores = () => setSelectedStores(new Set(stores.map((s) => s.id)));
  const clearAll = () => setSelectedStores(new Set());

  const cancel = () => {
    abortRef.current?.abort();
    toast.message("Отмена...");
  };

  async function fetchProductsForStores(ids: string[], signal: AbortSignal): Promise<ProductRow[]> {
    const out: ProductRow[] = [];
    let done = 0;
    for (const sid of ids) {
      if (signal.aborted) break;
      const store = stores.find((s) => s.id === sid);
      setProgress({ done, total: ids.length, label: `Загрузка: ${store?.name || sid}` });
      const PAGE = 1000;
      let from = 0;
      while (true) {
        if (signal.aborted) break;
        let q = supabase
          .from("products")
          .select("id,name,description,sku,price,store_id,category_id, categories(name), stores(name,subdomain)")
          .eq("store_id", sid)
          .is("deleted_at", null)
          .order("name")
          .range(from, from + PAGE - 1);
        if (onlyActive) q = q.eq("is_active", true);
        const { data, error } = await q;
        if (error) throw error;
        const rows = (data as any[]) || [];
        for (const p of rows) {
          const desc = p.description as string | null;
          if (!includeEmptyDesc && !stripHtml(desc)) continue;
          out.push({
            id: p.id,
            name: p.name,
            description: desc,
            sku: p.sku,
            price: p.price,
            store_id: p.store_id,
            store_name: p.stores?.name || store?.name || "—",
            store_subdomain: p.stores?.subdomain || store?.subdomain || "",
            category_name: p.categories?.name || null,
          });
        }
        if (rows.length < PAGE) break;
        from += PAGE;
      }
      done++;
      setProgress({ done, total: ids.length, label: "" });
    }
    return out;
  }

  const runExport = async (mode: ExportMode) => {
    const ids = Array.from(selectedStores);
    if (!ids.length) { toast.error("Выберите хотя бы один магазин"); return; }

    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setProgress({ done: 0, total: ids.length, label: "Подготовка..." });

    try {
      const allRows = await fetchProductsForStores(ids, controller.signal);
      if (controller.signal.aborted) { toast.message("Экспорт отменён"); return; }
      if (!allRows.length) { toast.error("Нет товаров для выгрузки"); return; }

      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      let blob: Blob;
      let filename: string;

      if (mode === "single_sheet") {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, buildSheet(allRows), "Товары");
        const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
        blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        filename = `products_all_${stamp}.xlsx`;
      } else if (mode === "sheet_per_store") {
        const wb = XLSX.utils.book_new();
        const byStore = new Map<string, ProductRow[]>();
        for (const r of allRows) {
          if (!byStore.has(r.store_id)) byStore.set(r.store_id, []);
          byStore.get(r.store_id)!.push(r);
        }
        const usedNames = new Set<string>();
        for (const [sid, rows] of byStore) {
          const store = stores.find((s) => s.id === sid);
          let base = sanitize(store?.name || sid).slice(0, 28) || "Магазин";
          let n = base;
          let i = 2;
          while (usedNames.has(n)) n = `${base.slice(0, 25)} ${i++}`;
          usedNames.add(n);
          XLSX.utils.book_append_sheet(wb, buildSheet(rows), n);
        }
        const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
        blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        filename = `products_by_store_${stamp}.xlsx`;
      } else {
        // file_per_store -> ZIP
        const zip = new JSZip();
        const byStore = new Map<string, ProductRow[]>();
        for (const r of allRows) {
          if (!byStore.has(r.store_id)) byStore.set(r.store_id, []);
          byStore.get(r.store_id)!.push(r);
        }
        for (const [sid, rows] of byStore) {
          const store = stores.find((s) => s.id === sid);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, buildSheet(rows), "Товары");
          const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
          const safe = sanitize(store?.name || sid);
          zip.file(`${safe} (${store?.subdomain || sid}).xlsx`, buf);
        }
        blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
        filename = `products_files_${stamp}.zip`;
      }

      const a = document.createElement("a");
      const url = URL.createObjectURL(blob);
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      // History
      const entry: HistoryEntry & { blob: Blob } = {
        id: crypto.randomUUID(),
        filename,
        mode,
        createdAt: Date.now(),
        storesCount: ids.length,
        productsCount: allRows.length,
        size: blob.size,
        storesLabel: ids.length === stores.length
          ? "Все магазины"
          : ids.length <= 3
            ? ids.map((id) => stores.find((s) => s.id === id)?.name || id).join(", ")
            : `${ids.length} магазинов`,
        blob,
      };
      try {
        await dbPut(entry);
        const all = await dbList();
        if (all.length > MAX_HISTORY) {
          const sorted = all.sort((a, b) => b.createdAt - a.createdAt);
          for (const old of sorted.slice(MAX_HISTORY)) await dbDelete(old.id);
        }
        await refreshHistory();
      } catch (e) {
        console.warn("History save failed", e);
      }

      toast.success(`Готово: ${allRows.length} товаров из ${ids.length} магазинов`);
    } catch (e: any) {
      if (e?.name === "AbortError") toast.message("Экспорт отменён");
      else toast.error(e?.message || "Ошибка экспорта");
    } finally {
      abortRef.current = null;
      setBusy(false);
      setProgress({ done: 0, total: 0, label: "" });
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

  const totalSelectedProducts = useMemo(
    () => stores.filter((s) => selectedStores.has(s.id)).reduce((a, s) => a + (s.products_count || 0), 0),
    [stores, selectedStores],
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" /> Экспорт названий и описаний в Excel
          </CardTitle>
          <CardDescription>
            Выберите магазины и режим выгрузки. Колонки: Магазин · Subdomain · Категория · Артикул · Название · Описание · Цена.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
            <div className="space-y-1">
              <Label>Поиск магазина</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8" placeholder="Название или subdomain" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
            <div className="flex items-end">
              <Button size="sm" variant="outline" onClick={selectAll} disabled={busy}>
                <CheckSquare className="h-4 w-4 mr-1" />Выбрать видимые
              </Button>
            </div>
            <div className="flex items-end">
              <Button size="sm" variant="outline" onClick={selectAllStores} disabled={busy}>
                <Layers className="h-4 w-4 mr-1" />Все магазины
              </Button>
            </div>
            <div className="flex items-end">
              <Button size="sm" variant="ghost" onClick={clearAll} disabled={busy}>
                <Square className="h-4 w-4 mr-1" />Снять
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Badge variant="secondary">Магазинов: {stores.length}</Badge>
            <Badge>Выбрано: {selectedStores.size}</Badge>
            <Badge variant="outline">~ Товаров: {totalSelectedProducts}</Badge>
            <label className="ml-auto flex items-center gap-2 text-xs">
              <Checkbox checked={onlyActive} onCheckedChange={(c) => setOnlyActive(!!c)} />
              Только активные
            </label>
            <label className="flex items-center gap-2 text-xs">
              <Checkbox checked={includeEmptyDesc} onCheckedChange={(c) => setIncludeEmptyDesc(!!c)} />
              Включать без описания
            </label>
          </div>

          <div className="max-h-[360px] overflow-auto border rounded-md">
            {loadingStores ? (
              <div className="p-6 text-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin inline mr-2" />Загрузка магазинов...
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="p-2 text-left w-8"></th>
                    <th className="p-2 text-left">Магазин</th>
                    <th className="p-2 text-left">Subdomain</th>
                    <th className="p-2 text-right">Товаров</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStores.map((s) => (
                    <tr key={s.id} className="border-t hover:bg-muted/50 cursor-pointer" onClick={() => !busy && toggleStore(s.id)}>
                      <td className="p-2"><Checkbox checked={selectedStores.has(s.id)} onCheckedChange={() => toggleStore(s.id)} disabled={busy} /></td>
                      <td className="p-2">{s.name}</td>
                      <td className="p-2 text-muted-foreground font-mono text-xs">{s.subdomain}</td>
                      <td className="p-2 text-right">{s.products_count ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="grid gap-2 md:grid-cols-3">
            <Button
              variant="default"
              onClick={() => runExport("single_sheet")}
              disabled={busy || !selectedStores.size}
              className="h-auto py-3 flex-col items-start text-left"
            >
              <div className="flex items-center gap-2 font-medium"><FileText className="h-4 w-4" /> Один лист</div>
              <div className="text-xs opacity-80 mt-1">Все товары в одной таблице</div>
            </Button>
            <Button
              variant="outline"
              onClick={() => runExport("sheet_per_store")}
              disabled={busy || !selectedStores.size}
              className="h-auto py-3 flex-col items-start text-left"
            >
              <div className="flex items-center gap-2 font-medium"><Layers className="h-4 w-4" /> Лист на магазин</div>
              <div className="text-xs opacity-80 mt-1">Один файл, отдельный лист каждому магазину</div>
            </Button>
            <Button
              variant="outline"
              onClick={() => runExport("file_per_store")}
              disabled={busy || !selectedStores.size}
              className="h-auto py-3 flex-col items-start text-left"
            >
              <div className="flex items-center gap-2 font-medium"><FolderArchive className="h-4 w-4" /> Файл на магазин (ZIP)</div>
              <div className="text-xs opacity-80 mt-1">Отдельный .xlsx на каждый магазин в архиве</div>
            </Button>
          </div>

          {busy && (
            <div className="space-y-2">
              <Progress value={progress.total ? (progress.done / progress.total) * 100 : 0} />
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  {progress.label || `Магазинов обработано: ${progress.done} / ${progress.total}`}
                </div>
                <Button size="sm" variant="destructive" onClick={cancel}>
                  <X className="h-4 w-4 mr-1" /> Отменить
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><History className="h-5 w-5" /> История экспортов товаров</CardTitle>
          <CardDescription>
            Последние {MAX_HISTORY} файлов сохраняются локально в браузере — можно скачать повторно.
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
                    <th className="p-2 text-left">Магазины</th>
                    <th className="p-2 text-right">Магазинов</th>
                    <th className="p-2 text-right">Товаров</th>
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
                      <td className="p-2 text-muted-foreground max-w-[260px] truncate" title={h.storesLabel}>{h.storesLabel}</td>
                      <td className="p-2 text-right">{h.storesCount}</td>
                      <td className="p-2 text-right">{h.productsCount}</td>
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
