import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ImageReference {
  id: string;
  store_id: string | null;
  name: string;
  image_url: string;
  is_system: boolean;
  sort_order: number;
}

const STORAGE_KEY = "image_generation_references_v1";

function readReferences(storeId: string | null): ImageReference[] {
  if (!storeId || typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}:${storeId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeReferences(storeId: string, refs: ImageReference[]) {
  localStorage.setItem(`${STORAGE_KEY}:${storeId}`, JSON.stringify(refs));
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function useImageReferences(storeId: string | null) {
  const [customRefs, setCustomRefs] = useState<ImageReference[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setCustomRefs(readReferences(storeId));
    setLoading(false);
  }, [storeId]);

  useEffect(() => { load(); }, [load]);

  const refs = useMemo(
    () => customRefs.sort((a, b) => Number(b.is_system) - Number(a.is_system) || a.sort_order - b.sort_order),
    [customRefs],
  );

  const upload = async (file: File): Promise<string | null> => {
    if (!storeId) { toast.error("Не выбран магазин"); return null; }
    const ext = file.name.split(".").pop() || "png";
    const path = `references/${storeId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file, {
      contentType: file.type || "image/png",
      upsert: false,
    });
    if (error) {
      toast.warning("Картинка сохранена локально; если генерация по ней не сработает, проверьте доступ к загрузке файлов");
      return await fileToDataUrl(file);
    }
    return supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
  };

  const create = async (name: string, image_url: string) => {
    if (!storeId) { toast.error("Не выбран магазин"); return; }
    if (!name.trim()) { toast.error("Укажите название"); return; }
    if (!image_url) { toast.error("Загрузите картинку"); return; }
    const next: ImageReference[] = [
      ...customRefs,
      {
        id: crypto.randomUUID(),
        store_id: storeId,
        name: name.trim(),
        image_url,
        is_system: false,
        sort_order: Date.now(),
      },
    ];
    writeReferences(storeId, next);
    setCustomRefs(next);
    toast.success("Референс сохранён");
  };

  const remove = async (id: string) => {
    if (!storeId) { toast.error("Не выбран магазин"); return; }
    const next = customRefs.filter((r) => r.id !== id);
    writeReferences(storeId, next);
    setCustomRefs(next);
    toast.success("Удалено");
  };

  return { refs, loading, reload: load, upload, create, remove };
}