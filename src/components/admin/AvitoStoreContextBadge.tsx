import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Store as StoreIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Маленький индикатор «вы сейчас в магазине X».
 * Помогает понять, почему в разделе Авито могут «не отображаться» аккаунты —
 * если у пользователя несколько магазинов, активный store_id может отличаться
 * от того, в котором эти аккаунты сохранены.
 */
export function AvitoStoreContextBadge({ storeId }: { storeId: string | null }) {
  const [info, setInfo] = useState<{ name: string; subdomain: string } | null>(null);

  useEffect(() => {
    if (!storeId) {
      setInfo(null);
      return;
    }
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("stores")
        .select("name,subdomain")
        .eq("id", storeId)
        .maybeSingle();
      if (!cancel && data) setInfo({ name: data.name, subdomain: data.subdomain });
    })();
    return () => {
      cancel = true;
    };
  }, [storeId]);

  if (!storeId) {
    return (
      <Badge variant="outline" className="gap-1 text-amber-600 border-amber-400/50">
        Магазин не выбран
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1">
      <StoreIcon className="h-3 w-3" />
      Магазин: {info ? `${info.name} (${info.subdomain})` : "…"}
    </Badge>
  );
}
