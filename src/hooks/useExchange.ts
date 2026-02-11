import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ExchangeRequest {
  id: string;
  store_id: string;
  created_by: string;
  status: "active" | "closed";
  created_at: string;
  updated_at: string;
  items?: ExchangeRequestItem[];
  responses?: ExchangeResponse[];
  items_count?: number;
  responses_count?: number;
}

export interface ExchangeRequestItem {
  id: string;
  request_id: string;
  product_id: string | null;
  custom_name: string | null;
  unit: string;
  created_at: string;
  product_name?: string; // joined from products
}

export interface ExchangeResponse {
  id: string;
  request_id: string;
  responder_store_id: string;
  created_at: string;
  items?: ExchangeResponseItem[];
  store_name?: string;
}

export interface ExchangeResponseItem {
  id: string;
  response_id: string;
  request_item_id: string;
  price: number;
}

export function useExchange(storeId: string | null) {
  const [myRequests, setMyRequests] = useState<ExchangeRequest[]>([]);
  const [allRequests, setAllRequests] = useState<ExchangeRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchMyRequests = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const { data: requests, error } = await supabase
        .from("exchange_requests")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch items and response counts for each request
      const enriched = await Promise.all(
        (requests || []).map(async (req: any) => {
          const [itemsRes, responsesRes] = await Promise.all([
            supabase
              .from("exchange_request_items")
              .select("*, products(name)")
              .eq("request_id", req.id),
            supabase
              .from("exchange_responses")
              .select("id, responder_store_id, created_at, stores(name)")
              .eq("request_id", req.id),
          ]);

          const items = (itemsRes.data || []).map((item: any) => ({
            ...item,
            product_name: item.products?.name || item.custom_name,
          }));

          const responses = (responsesRes.data || []).map((resp: any) => ({
            ...resp,
            store_name: (resp as any).stores?.name,
          }));

          return {
            ...req,
            items,
            responses,
            items_count: items.length,
            responses_count: responses.length,
          };
        })
      );

      setMyRequests(enriched);
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [storeId, toast]);

  const fetchAllRequests = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const { data: requests, error } = await supabase
        .from("exchange_requests")
        .select("*")
        .eq("status", "active")
        .neq("store_id", storeId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const enriched = await Promise.all(
        (requests || []).map(async (req: any) => {
          const { data: items } = await supabase
            .from("exchange_request_items")
            .select("*, products(name)")
            .eq("request_id", req.id);

          return {
            ...req,
            items: (items || []).map((item: any) => ({
              ...item,
              product_name: item.products?.name || item.custom_name,
            })),
            items_count: (items || []).length,
          };
        })
      );

      setAllRequests(enriched);
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [storeId, toast]);

  const createRequest = useCallback(
    async (items: { product_id?: string; custom_name?: string; unit?: string }[]) => {
      if (!storeId) return;
      try {
        // Get current user's profile id
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Не авторизован");

        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (!profile) throw new Error("Профиль не найден");

        const { data: request, error } = await supabase
          .from("exchange_requests")
          .insert({ store_id: storeId, created_by: profile.id })
          .select()
          .single();

        if (error) throw error;

        const itemsToInsert = items.map((item) => ({
          request_id: request.id,
          product_id: item.product_id || null,
          custom_name: item.custom_name || null,
          unit: item.unit || "шт",
        }));

        const { error: itemsError } = await supabase
          .from("exchange_request_items")
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;

        toast({ title: "Заявка создана", description: "Заявка отправлена на биржу" });
        await fetchMyRequests();
      } catch (err: any) {
        toast({ title: "Ошибка", description: err.message, variant: "destructive" });
      }
    },
    [storeId, toast, fetchMyRequests]
  );

  const closeRequest = useCallback(
    async (requestId: string) => {
      try {
        const { error } = await supabase
          .from("exchange_requests")
          .update({ status: "closed" })
          .eq("id", requestId);

        if (error) throw error;
        toast({ title: "Заявка закрыта" });
        await fetchMyRequests();
      } catch (err: any) {
        toast({ title: "Ошибка", description: err.message, variant: "destructive" });
      }
    },
    [toast, fetchMyRequests]
  );

  const submitResponse = useCallback(
    async (requestId: string, prices: { request_item_id: string; price: number }[]) => {
      if (!storeId) return;
      try {
        const { data: response, error } = await supabase
          .from("exchange_responses")
          .insert({ request_id: requestId, responder_store_id: storeId })
          .select()
          .single();

        if (error) throw error;

        const itemsToInsert = prices
          .filter((p) => p.price > 0)
          .map((p) => ({
            response_id: response.id,
            request_item_id: p.request_item_id,
            price: p.price,
          }));

        if (itemsToInsert.length > 0) {
          const { error: itemsError } = await supabase
            .from("exchange_response_items")
            .insert(itemsToInsert);

          if (itemsError) throw itemsError;
        }

        toast({ title: "Предложение отправлено", description: "Ваши цены отправлены автору заявки" });
        await fetchAllRequests();
      } catch (err: any) {
        toast({ title: "Ошибка", description: err.message, variant: "destructive" });
      }
    },
    [storeId, toast, fetchAllRequests]
  );

  const fetchResponseItems = useCallback(
    async (requestId: string): Promise<ExchangeResponse[]> => {
      try {
        const { data: responses, error } = await supabase
          .from("exchange_responses")
          .select("*, stores(name)")
          .eq("request_id", requestId);

        if (error) throw error;

        const enriched = await Promise.all(
          (responses || []).map(async (resp: any) => {
            const { data: items } = await supabase
              .from("exchange_response_items")
              .select("*")
              .eq("response_id", resp.id);

            return {
              ...resp,
              store_name: resp.stores?.name,
              items: items || [],
            };
          })
        );

        return enriched;
      } catch {
        return [];
      }
    },
    []
  );

  useEffect(() => {
    if (storeId) {
      fetchMyRequests();
      fetchAllRequests();
    }
  }, [storeId, fetchMyRequests, fetchAllRequests]);

  return {
    myRequests,
    allRequests,
    loading,
    createRequest,
    closeRequest,
    submitResponse,
    fetchResponseItems,
    refetchMyRequests: fetchMyRequests,
    refetchAllRequests: fetchAllRequests,
  };
}
