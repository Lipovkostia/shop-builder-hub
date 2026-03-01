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
      // Group by store_id to use correct credentials
      const byStore: Record<string, typeof msOrders> = {};
      for (const o of msOrders) {
        if (!byStore[o.store_id]) byStore[o.store_id] = [];
        byStore[o.store_id].push(o);
      }

      const allResults: Record<string, MoyskladOrderData> = {};

      for (const [storeId, storeOrders] of Object.entries(byStore)) {
        // Get moysklad credentials for this store
        const { data: account } = await supabase
          .from("moysklad_accounts")
          .select("login, password")
          .eq("store_id", storeId)
          .limit(1)
          .maybeSingle();

        if (!account) {
          // Mark all orders from this store as error
          for (const order of storeOrders) {
            newErrors[order.id] = true;
          }
          continue;
        }

        const msOrderIds = storeOrders.map(o => o.moysklad_order_id!);

        const { data, error } = await supabase.functions.invoke("moysklad", {
          body: {
            action: "sync_order_statuses",
            login: account.login,
            password: account.password,
            order_ids: msOrderIds,
          },
        });

        if (error || !data?.results) {
          console.error("MoySklad sync error:", error || data);
          for (const order of storeOrders) {
            newErrors[order.id] = true;
          }
          continue;
        }

        // Map results back using our order IDs
        for (const order of storeOrders) {
          const msData = data.results[order.moysklad_order_id!];
          if (msData && !msData.error) {
            allResults[order.id] = msData;
            newErrors[order.id] = false;

            // Update order in DB with synced status and positions
            await supabase
              .from("orders")
              .update({
                moysklad_status: msData.status || null,
                moysklad_data: {
                  positions: msData.positions,
                  sum: msData.sum,
                  updated: msData.updated,
                },
              })
              .eq("id", order.id);
          } else {
            newErrors[order.id] = true;
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
