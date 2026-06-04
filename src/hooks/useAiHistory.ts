import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "product-images";
const PREFIX = "_ai_history";

export interface AiHistoryItem {
  id: string;            // full storage path of image
  name: string;          // file name
  url: string;           // public url
  created_at: string;    // iso
  size: number;
  prompt: string;
  model: string;
  source: string;        // 'photo_generation' | 'avito_editor' | etc
  product_id: string | null;
}

interface AddArgs {
  url: string;
  prompt?: string;
  model?: string;
  source?: string;
  productId?: string | null;
}

function pubUrl(path: string) {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

async function fetchAsBlob(url: string): Promise<Blob> {
  const r = await fetch(url);
  if (!r.ok) throw new Error("fetch failed " + r.status);
  return await r.blob();
}

export function useAiHistory(storeId: string | null | undefined) {
  const [items, setItems] = useState<AiHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  const folder = storeId ? `${PREFIX}/${storeId}` : null;

  const load = useCallback(async () => {
    if (!folder) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .list(folder, { limit: 1000, sortBy: { column: "created_at", order: "desc" } });
      if (error) throw error;
      const files = (data ?? []).filter((f) => f.name.endsWith(".png") || f.name.endsWith(".jpg") || f.name.endsWith(".jpeg") || f.name.endsWith(".webp"));
      // Try to load sidecar metadata in bulk via list of .json files
      const metaList = (data ?? []).filter((f) => f.name.endsWith(".json"));
      const metaByBase = new Map<string, any>();
      // Fetch sidecars in parallel (limit ~30 concurrent)
      const fetchOne = async (m: { name: string }) => {
        try {
          const path = `${folder}/${m.name}`;
          const r = await fetch(pubUrl(path) + `?t=${Date.now()}`);
          if (!r.ok) return;
          const j = await r.json();
          metaByBase.set(m.name.replace(/\.json$/, ""), j);
        } catch {}
      };
      // limit concurrency
      const chunks: typeof metaList[] = [];
      for (let i = 0; i < metaList.length; i += 20) chunks.push(metaList.slice(i, i + 20));
      for (const c of chunks) await Promise.all(c.map(fetchOne));

      const arr: AiHistoryItem[] = files.map((f) => {
        const base = f.name.replace(/\.[^.]+$/, "");
        const meta = metaByBase.get(base) ?? {};
        const path = `${folder}/${f.name}`;
        return {
          id: path,
          name: f.name,
          url: pubUrl(path),
          created_at: (f as any).created_at ?? meta.created_at ?? new Date().toISOString(),
          size: (f as any).metadata?.size ?? 0,
          prompt: meta.prompt ?? "",
          model: meta.model ?? "",
          source: meta.source ?? "",
          product_id: meta.product_id ?? null,
        };
      });
      arr.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      setItems(arr);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [folder]);

  useEffect(() => { load(); }, [load]);

  const add = useCallback(async (args: AddArgs) => {
    if (!folder) return null;
    try {
      const blob = await fetchAsBlob(args.url);
      const ts = Date.now();
      const id = crypto.randomUUID();
      const ext = blob.type.includes("jpeg") || blob.type.includes("jpg") ? "jpg" : "png";
      const baseName = `${ts}_${id}`;
      const imgPath = `${folder}/${baseName}.${ext}`;
      const metaPath = `${folder}/${baseName}.json`;
      const meta = {
        prompt: args.prompt ?? "",
        model: args.model ?? "",
        source: args.source ?? "",
        product_id: args.productId ?? null,
        created_at: new Date().toISOString(),
      };
      const { error: e1 } = await supabase.storage.from(BUCKET).upload(imgPath, blob, {
        contentType: blob.type || "image/png",
        upsert: false,
      });
      if (e1) throw e1;
      await supabase.storage.from(BUCKET).upload(metaPath, new Blob([JSON.stringify(meta)], { type: "application/json" }), {
        contentType: "application/json",
        upsert: false,
      });
      return pubUrl(imgPath);
    } catch {
      return null;
    }
  }, [folder]);

  const remove = useCallback(async (item: AiHistoryItem) => {
    if (!folder) return;
    const base = item.name.replace(/\.[^.]+$/, "");
    const paths = [item.id, `${folder}/${base}.json`];
    await supabase.storage.from(BUCKET).remove(paths);
    setItems((prev) => prev.filter((x) => x.id !== item.id));
  }, [folder]);

  return { items, loading, reload: load, add, remove };
}
