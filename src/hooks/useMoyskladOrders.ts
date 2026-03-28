import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface MoyskladOrganization {
  id: string;
  name: string;
}

export interface MoyskladCounterparty {
  id: string;
  name: string;
  phone?: string;
  email?: string;
}

export interface MoyskladOrderPosition {
  moysklad_id: string;
  product_name: string;
  quantity: number;
  price: number; // in kopecks!
}

export interface CreateMoyskladOrderData {
  name: string;
  description?: string;
  organization_id: string;
  counterparty_id: string;
  positions: MoyskladOrderPosition[];
}

export function useMoyskladOrders(login: string | null, password: string | null) {
  const { toast } = useToast();
  const [organizations, setOrganizations] = useState<MoyskladOrganization[]>([]);
  const [counterparties, setCounterparties] = useState<MoyskladCounterparty[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchOrganizations = useCallback(async (overrideLogin?: string | null, overridePassword?: string | null) => {
    const activeLogin = overrideLogin ?? login;
    const activePassword = overridePassword ?? password;
    if (!activeLogin || !activePassword) return;

    try {
      setLoading(true);

      const allOrganizations: MoyskladOrganization[] = [];
      let offset = 0;
      const pageLimit = 50;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase.functions.invoke("moysklad", {
          body: {
            action: "get_organizations",
            login: activeLogin,
            password: activePassword,
            organizationLimit: pageLimit,
            organizationOffset: offset,
          },
        });

        if (error) throw error;
        if (data.error) throw new Error(data.error);

        const page = data.organizations || [];
        const total = data.meta?.size ?? page.length;
        const effectiveLimit = data.meta?.limit ?? pageLimit;

        allOrganizations.push(...page);
        offset += page.length;

        hasMore = page.length > 0 && offset < total && page.length >= effectiveLimit;
      }

      setOrganizations(allOrganizations);
    } catch (error: any) {
      console.error("Error fetching organizations:", error);
      toast({
        title: "Ошибка загрузки организаций",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [login, password, toast]);

  const fetchCounterparties = useCallback(async (overrideLogin?: string | null, overridePassword?: string | null) => {
    const activeLogin = overrideLogin ?? login;
    const activePassword = overridePassword ?? password;
    if (!activeLogin || !activePassword) return;

    try {
      setLoading(true);

      const allCounterparties: MoyskladCounterparty[] = [];
      let offset = 0;
      const pageLimit = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase.functions.invoke("moysklad", {
          body: {
            action: "get_counterparties",
            login: activeLogin,
            password: activePassword,
            counterpartyLimit: pageLimit,
            counterpartyOffset: offset,
          },
        });

        if (error) throw error;
        if (data.error) throw new Error(data.error);

        const page = data.counterparties || [];
        const total = data.meta?.size ?? page.length;
        const effectiveLimit = data.meta?.limit ?? pageLimit;

        allCounterparties.push(...page);
        offset += page.length;

        hasMore = page.length > 0 && offset < total && page.length >= effectiveLimit;
      }

      setCounterparties(allCounterparties);
    } catch (error: any) {
      console.error("Error fetching counterparties:", error);
      toast({
        title: "Ошибка загрузки контрагентов",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [login, password, toast]);

  const createMoyskladOrder = useCallback(
    async (orderData: CreateMoyskladOrderData): Promise<string | null> => {
      if (!login || !password) {
        toast({
          title: "Ошибка",
          description: "Не настроено подключение к МойСклад",
          variant: "destructive",
        });
        return null;
      }

      try {
        const { data, error } = await supabase.functions.invoke("moysklad", {
          body: {
            action: "create_customerorder",
            login,
            password,
            order: orderData,
          },
        });

        if (error) throw error;
        if (data.error) throw new Error(data.error);

        return data.order?.id || null;
      } catch (error: any) {
        console.error("Error creating MoySklad order:", error);
        toast({
          title: "Ошибка создания заказа в МойСклад",
          description: error.message,
          variant: "destructive",
        });
        return null;
      }
    },
    [login, password, toast]
  );

  return {
    organizations,
    counterparties,
    loading,
    fetchOrganizations,
    fetchCounterparties,
    createMoyskladOrder,
  };
}
