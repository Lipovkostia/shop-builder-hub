import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface MoyskladOrderData {
  status: string | null;
  sum: number;
  positions: Array<{
    name: string;
    quantity: number;
    price: number;
    sum: number;
  }>;
  name: string | null;
  updated: string | null;
}

/**
 * Hook to sync order statuses from MoySklad.
 * Given a list of orders with moysklad_order_id, fetches their current status from MoySklad API.
 * Credentials are looked up server-side by store_id, so customers don't need direct access.
 */
export function useMoyskladOrderSync() {
  const [syncing, setSyncing] = useState(false);
  const [syncedData, setSyncedData] = useState<Record<string, MoyskladOrderData>>({});
  const [syncErrors, setSyncErrors] = useState<Record<string, boolean>>({});
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  const syncOrders = useCallback(async (
    orders: Array<{ id: string; moysklad_order_id: string | null; store_id: string }>
  ) => {
    // Filter orders that have moysklad_order_id
    const msOrders = orders.filter(o => o.moysklad_order_id);
    if (msOrders.length === 0) return;

    setSyncing(true);
    const newErrors: Record<string, boolean> = {};
    
    try {
      // Group by store_id to batch requests
      const byStore: Record<string, typeof msOrders> = {};
      for (const o of msOrders) {
        if (!byStore[o.store_id]) byStore[o.store_id] = [];
        byStore[o.store_id].push(o);
      }

      const allResults: Record<string, MoyskladOrderData> = {};

      for (const [storeId, storeOrders] of Object.entries(byStore)) {
        // Split into small batches to prevent edge function timeout on large order lists
        const batchSize = 3;

        for (let i = 0; i < storeOrders.length; i += batchSize) {
          const batchOrders = storeOrders.slice(i, i + batchSize);
          const msOrderIds = batchOrders.map(o => o.moysklad_order_id!);

          // Build mapping: moysklad_order_id -> local order id (for server-side DB persist)
          const localOrderMap: Record<string, string> = {};
          for (const order of batchOrders) {
            localOrderMap[order.moysklad_order_id!] = order.id;
          }

          // Pass store_id to edge function — it looks up credentials & persists data server-side
          const { data, error } = await supabase.functions.invoke("moysklad", {
            body: {
              action: "sync_order_statuses",
              store_id: storeId,
              order_ids: msOrderIds,
              local_order_map: localOrderMap,
            },
          });

          if (error || !data?.results) {
            console.error("MoySklad sync error:", error || data);
            for (const order of batchOrders) {
              newErrors[order.id] = true;
            }
            continue;
          }

          // Map results back using our order IDs
          for (const order of batchOrders) {
            const msData = data.results[order.moysklad_order_id!];
            if (msData && !msData.error) {
              allResults[order.id] = msData;
              newErrors[order.id] = false;
            } else {
              newErrors[order.id] = true;
            }
          }
        }
      }

      setSyncedData(allResults);
      setSyncErrors(newErrors);
      setLastSyncTime(new Date());
    } catch (e) {
      console.error("MoySklad order sync failed:", e);
      for (const order of msOrders) {
        newErrors[order.id] = true;
      }
      setSyncErrors(newErrors);
    } finally {
      setSyncing(false);
    }
  }, []);

  return { syncing, syncedData, syncErrors, lastSyncTime, syncOrders };
}
