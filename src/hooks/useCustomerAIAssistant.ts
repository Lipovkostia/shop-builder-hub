import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface FoundItem {
  productId: string;
  productName: string;
  variantIndex: number;
  variantLabel: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  weight?: number;
  available: boolean;
  matchReason: string;
  suggestion?: {
    productId: string;
    productName: string;
    reason: string;
  };
}

export interface CustomerAIResponse {
  items: FoundItem[];
  summary: string;
  totalPrice: number;
  recognized_text?: string;
  unavailableCount: number;
  error?: string;
}

export type CustomerAssistantState = 
  | "idle" 
  | "recording" 
  | "processing" 
  | "confirming" 
  | "adding" 
  | "done" 
  | "error";

export function useCustomerAIAssistant(catalogId: string | null) {
  const { toast } = useToast();
  const [state, setState] = useState<CustomerAssistantState>("idle");
  const [response, setResponse] = useState<CustomerAIResponse | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setState("idle");
    setResponse(null);
    setSelectedItems(new Set());
    setError(null);
  }, []);

  const searchProducts = useCallback(async (query: string) => {
    if (!catalogId || !query.trim()) return;

    setState("processing");
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("ai-customer-assistant", {
        body: { catalogId, query },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const result = data as CustomerAIResponse;
      setResponse(result);
      // Pre-select only available items
      setSelectedItems(new Set(result.items.filter(i => i.available).map(i => i.productId)));
      setState("confirming");

    } catch (err) {
      console.error("Customer AI search error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setState("error");
      toast({
        title: "Ошибка AI",
        description: err instanceof Error ? err.message : "Не удалось выполнить запрос",
        variant: "destructive",
      });
    }
  }, [catalogId, toast]);

  const searchWithAudio = useCallback(async (audioBlob: Blob) => {
    if (!catalogId) return;

    setState("processing");
    setError(null);

    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");
      formData.append("catalogId", catalogId);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-customer-assistant`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Voice search failed");
      }

      const result = await response.json() as CustomerAIResponse;
      
      if (result.error) {
        throw new Error(result.error);
      }

      setResponse(result);
      setSelectedItems(new Set(result.items.filter(i => i.available).map(i => i.productId)));
      setState("confirming");

    } catch (err) {
      console.error("Voice search error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setState("error");
      toast({
        title: "Ошибка распознавания",
        description: err instanceof Error ? err.message : "Не удалось распознать речь",
        variant: "destructive",
      });
    }
  }, [catalogId, toast]);

  const repeatOrder = useCallback(async (orderId: string) => {
    if (!catalogId) return;

    setState("processing");
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("ai-customer-assistant", {
        body: { catalogId, repeatOrderId: orderId },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const result = data as CustomerAIResponse;
      setResponse(result);
      setSelectedItems(new Set(result.items.filter(i => i.available).map(i => i.productId)));
      setState("confirming");

    } catch (err) {
      console.error("Repeat order error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setState("error");
      toast({
        title: "Ошибка повторения заказа",
        description: err instanceof Error ? err.message : "Не удалось повторить заказ",
        variant: "destructive",
      });
    }
  }, [catalogId, toast]);

  const toggleItem = useCallback((productId: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (response?.items) {
      setSelectedItems(new Set(response.items.filter(i => i.available).map(i => i.productId)));
    }
  }, [response]);

  const deselectAll = useCallback(() => {
    setSelectedItems(new Set());
  }, []);

  const updateItemQuantity = useCallback((productId: string, newQuantity: number) => {
    if (!response || newQuantity < 1) return;
    
    setResponse(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map(item => {
          if (item.productId === productId) {
            const newTotalPrice = item.unitPrice * newQuantity;
            const newWeight = item.weight ? (item.weight / item.quantity) * newQuantity : undefined;
            return {
              ...item,
              quantity: newQuantity,
              totalPrice: newTotalPrice,
              weight: newWeight,
            };
          }
          return item;
        }),
      };
    });
  }, [response]);

  const getSelectedItems = useCallback(() => {
    if (!response) return [];
    return response.items.filter(i => selectedItems.has(i.productId));
  }, [response, selectedItems]);

  const getSelectedTotal = useCallback(() => {
    return getSelectedItems().reduce((sum, item) => sum + item.totalPrice, 0);
  }, [getSelectedItems]);

  return {
    state,
    setState,
    response,
    selectedItems,
    error,
    reset,
    searchProducts,
    searchWithAudio,
    repeatOrder,
    toggleItem,
    selectAll,
    deselectAll,
    updateItemQuantity,
    getSelectedItems,
    getSelectedTotal,
  };
}
