import { useState, useEffect, useCallback } from "react";
import { ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface OrdersQuickAccessProps {
  storeId: string;
  onClick: () => void;
}

function formatPriceCompact(price: number): string {
  if (price >= 1000000) {
    return (price / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (price >= 1000) {
    return (price / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return Math.round(price).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function OrdersQuickAccess({ storeId, onClick }: OrdersQuickAccessProps) {
  const { user, profile } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchPendingOrders = useCallback(async () => {
    if (!user || !storeId) {
      setLoading(false);
      return;
    }

    try {
      // Get store_customer record for this user
      const { data: storeCustomer } = await supabase
        .from("store_customers")
        .select("id")
        .eq("profile_id", profile?.id)
        .eq("store_id", storeId)
        .maybeSingle();

      if (!storeCustomer) {
        setLoading(false);
        return;
      }

      // Fetch pending orders for this customer
      const { data: orders, error } = await supabase
        .from("orders")
        .select("id, total, status")
        .eq("store_id", storeId)
        .eq("customer_id", storeCustomer.id)
        .in("status", ["pending", "processing"]);

      if (error) {
        console.error("Error fetching orders:", error);
        setLoading(false);
        return;
      }

      const count = orders?.length || 0;
      const total = orders?.reduce((sum, o) => sum + Number(o.total), 0) || 0;

      setPendingCount(count);
      setPendingTotal(total);
    } catch (err) {
      console.error("Error in fetchPendingOrders:", err);
    } finally {
      setLoading(false);
    }
  }, [user, storeId, profile?.id]);

  useEffect(() => {
    fetchPendingOrders();
  }, [fetchPendingOrders]);

  // Don't show if not logged in or no pending orders
  if (!user || loading) {
    return null;
  }

  return (
    <button
      onClick={onClick}
      className="relative flex items-center gap-1.5 bg-accent/50 hover:bg-accent transition-colors rounded-full py-1.5 px-3"
      title="Мои заказы"
      aria-label={`Заказы: ${pendingCount} на сумму ${formatPriceCompact(pendingTotal)} ₽`}
    >
      <ClipboardList className="w-4 h-4 text-primary" />
      {pendingCount > 0 && (
        <>
          <span className="text-xs font-medium text-foreground">
            {formatPriceCompact(pendingTotal)} ₽
          </span>
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
            {pendingCount > 9 ? "9+" : pendingCount}
          </span>
        </>
      )}
      {pendingCount === 0 && (
        <span className="text-xs text-muted-foreground">Заказы</span>
      )}
    </button>
  );
}
