import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface AvitoFeedProduct {
  id: string;
  store_id: string;
  product_id: string;
  avito_category: string | null;
  avito_address: string | null;
  avito_params: any;
  group_id: string | null;
  created_at: string;
}

export interface AvitoDefaults {
  managerName: string;
  contactPhone: string;
  email: string;
  companyName: string;
  address: string;
  category: string;
  goodsType: string;
  goodsSubType: string;
  contactMethod: string;
  listingFee: string;
  targetAudience: string;
  promo: string;
  promoRegion: string;
  promoBudget: string;
  promoPrice: string;
  promoLimit: string;
  cpcBid: string;
  titlePrefix?: string;
  descriptionFirstLine?: string;
  applyGlobalPrefix?: boolean;
}


const AVITO_DEFAULTS_KEY = "avito_defaults_";

export function useAvitoFeedProducts(storeId: string | null, activeTabId: string | null = null, accountId: string | null = null) {
  const { toast } = useToast();
  const [feedProducts, setFeedProducts] = useState<AvitoFeedProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [defaults, setDefaults] = useState<AvitoDefaults>({
    managerName: "",
    contactPhone: "",
    email: "",
    companyName: "",
    address: "",
    category: "Продукты питания",
    goodsType: "Товар от производителя",
    goodsSubType: "Мясо, птица, субпродукты",
    contactMethod: "По телефону и в сообщениях",
    listingFee: "Package",
    targetAudience: "Частные лица и бизнес",
    promo: "",
    promoRegion: "",
    promoBudget: "",
    promoPrice: "",
    promoLimit: "",
    cpcBid: "",
    titlePrefix: "Опт:",
    descriptionFirstLine: "Продажа только в опт от 15 тыс. ₽ заказ",
    applyGlobalPrefix: true,
  });


  // Load defaults from localStorage
  useEffect(() => {
    if (!storeId) return;
    const saved = localStorage.getItem(AVITO_DEFAULTS_KEY + storeId);
    if (saved) {
      try {
        setDefaults(prev => ({ ...prev, ...JSON.parse(saved) }));
      } catch {}
    }
  }, [storeId]);

  const saveDefaults = useCallback(async (newDefaults: AvitoDefaults) => {
    setDefaults(newDefaults);
    if (storeId) {
      localStorage.setItem(AVITO_DEFAULTS_KEY + storeId, JSON.stringify(newDefaults));
      // Also persist to DB for edge function access — per active account
      try {
        let q = (supabase as any).from("avito_accounts").update({ feed_defaults: newDefaults });
        if (accountId) q = q.eq("id", accountId);
        else q = q.eq("store_id", storeId);
        await q;
      } catch (err) {
        console.error("Error saving feed defaults to DB:", err);
      }
    }
  }, [storeId, accountId]);

  const fetchFeedProducts = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      let query = (supabase as any)
        .from("avito_feed_products")
        .select("*")
        .eq("store_id", storeId);
      if (accountId) query = query.eq("account_id", accountId);
      if (activeTabId) query = query.eq("tab_id", activeTabId);
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      setFeedProducts((data || []) as AvitoFeedProduct[]);
    } catch (err: any) {
      console.error("Error fetching avito feed products:", err);
    } finally {
      setLoading(false);
    }
  }, [storeId, activeTabId, accountId]);

  useEffect(() => {
    fetchFeedProducts();
  }, [fetchFeedProducts]);

  const addProductsToFeed = useCallback(async (productIds: string[], priceMap?: Record<string, number>) => {
    if (!storeId) return false;
    try {
      const existing = new Set(feedProducts.map(fp => fp.product_id));
      const newIds = productIds.filter(id => !existing.has(id));
      if (newIds.length === 0) {
        toast({ title: "Все выбранные товары уже в фиде Авито" });
        return true;
      }
      const rows = newIds.map(pid => ({
        store_id: storeId,
        account_id: accountId || null,
        tab_id: activeTabId || null,
        product_id: pid,
        ...(priceMap && priceMap[pid] ? { avito_params: { Price: priceMap[pid] } } : {}),
      }));
      const { error } = await (supabase as any).from("avito_feed_products").insert(rows);
      if (error) throw error;
      toast({ title: `Добавлено ${newIds.length} товар(ов) в фид Авито` });
      await fetchFeedProducts();
      return true;
    } catch (err: any) {
      console.error("Error adding to avito feed:", err);
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
      return false;
    }
  }, [storeId, accountId, activeTabId, feedProducts, fetchFeedProducts, toast]);

  const scopeTab = <T extends { eq: (k: string, v: any) => T }>(q: T): T =>
    (activeTabId ? q.eq("tab_id", activeTabId) : q);

  const removeProductFromFeed = useCallback(async (productId: string) => {
    if (!storeId) return;
    try {
      const { error } = await scopeTab(
        (supabase as any)
          .from("avito_feed_products")
          .delete()
          .eq("store_id", storeId)
          .eq("product_id", productId)
      );
      if (error) throw error;
      setFeedProducts(prev => prev.filter(fp => fp.product_id !== productId));
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    }
  }, [storeId, activeTabId, toast]);

  const removeProductsFromFeed = useCallback(async (productIds: string[]) => {
    if (!storeId) return;
    try {
      const { error } = await scopeTab(
        (supabase as any)
          .from("avito_feed_products")
          .delete()
          .eq("store_id", storeId)
          .in("product_id", productIds)
      );
      if (error) throw error;
      setFeedProducts(prev => prev.filter(fp => !productIds.includes(fp.product_id)));
      toast({ title: `Удалено ${productIds.length} товар(ов) из фида Авито` });
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    }
  }, [storeId, activeTabId, toast]);

  const updateProductParams = useCallback(async (productId: string, params: any) => {
    if (!storeId) return;
    try {
      const { error } = await scopeTab(
        (supabase as any)
          .from("avito_feed_products")
          .update({ avito_params: params })
          .eq("store_id", storeId)
          .eq("product_id", productId)
      );
      if (error) throw error;
      setFeedProducts(prev => prev.map(fp =>
        fp.product_id === productId ? { ...fp, avito_params: params } : fp
      ));
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    }
  }, [storeId, activeTabId, toast]);

  const assignGroup = useCallback(async (productIds: string[], groupId: string | null) => {
    if (!storeId || productIds.length === 0) return;
    try {
      const { error } = await scopeTab(
        (supabase as any)
          .from("avito_feed_products")
          .update({ group_id: groupId })
          .eq("store_id", storeId)
          .in("product_id", productIds)
      );
      if (error) throw error;
      setFeedProducts(prev => prev.map(fp =>
        productIds.includes(fp.product_id) ? { ...fp, group_id: groupId } : fp
      ));
      toast({ title: groupId ? `Перемещено ${productIds.length} в группу` : `Снято с группы: ${productIds.length}` });
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    }
  }, [storeId, activeTabId, toast]);

  const feedProductIds = new Set(feedProducts.map(fp => fp.product_id));

  return {
    feedProducts,
    feedProductIds,
    loading,
    defaults,
    saveDefaults,
    addProductsToFeed,
    removeProductFromFeed,
    removeProductsFromFeed,
    updateProductParams,
    assignGroup,
    refetch: fetchFeedProducts,
  };
}
