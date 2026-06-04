import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TelegramSubscriber {
  chat_id: number;
  tg_user_id?: number;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  language_code?: string | null;
  joined_at: string;
  last_seen_at: string;
}

const BUCKET = "ai-history";
const PREFIX = "_telegram_subscribers";

export function useTelegramSubscribers(storeId: string | null) {
  const [items, setItems] = useState<TelegramSubscriber[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const folder = `${PREFIX}/${storeId}`;
      const { data: files, error } = await supabase.storage
        .from(BUCKET)
        .list(folder, { limit: 1000, sortBy: { column: "created_at", order: "desc" } });
      if (error || !files) {
        setItems([]);
        return;
      }
      const jsons = files.filter((f) => f.name.endsWith(".json"));
      const results = await Promise.all(
        jsons.map(async (f) => {
          const { data } = await supabase.storage
            .from(BUCKET)
            .download(`${folder}/${f.name}`);
          if (!data) return null;
          try {
            return JSON.parse(await data.text()) as TelegramSubscriber;
          } catch {
            return null;
          }
        }),
      );
      const list = results.filter((x): x is TelegramSubscriber => !!x);
      list.sort((a, b) => (b.last_seen_at || "").localeCompare(a.last_seen_at || ""));
      setItems(list);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    load();
  }, [load]);

  return { items, loading, reload: load };
}
