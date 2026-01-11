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

  const fetchOrganizations = useCallback(async () => {
    if (!login || !password) return;

    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke("moysklad", {
        body: {
          action: "get_organizations",
          login,
          password,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setOrganizations(data.organizations || []);
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

  const fetchCounterparties = useCallback(async () => {
    if (!login || !password) return;

    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke("moysklad", {
        body: {
          action: "get_counterparties",
          login,
          password,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setCounterparties(data.counterparties || []);
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
