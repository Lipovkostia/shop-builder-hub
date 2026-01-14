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

  // Merges new items into existing response, avoiding duplicates
  const mergeItems = useCallback((existingItems: FoundItem[], newItems: FoundItem[]): FoundItem[] => {
    const existingIds = new Set(existingItems.map(i => i.productId));
    const uniqueNewItems = newItems.filter(i => !existingIds.has(i.productId));
    return [...existingItems, ...uniqueNewItems];
  }, []);

  const searchProducts = useCallback(async (query: string, appendMode: boolean = false) => {
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
      
      if (appendMode && response) {
        // Merge new items with existing ones
        const mergedItems = mergeItems(response.items, result.items);
        const newAvailableIds = result.items.filter(i => i.available).map(i => i.productId);
        
        setResponse({
          ...result,
          items: mergedItems,
          summary: `${response.summary}. ${result.summary}`,
          unavailableCount: mergedItems.filter(i => !i.available).length,
        });
        // Add new available items to selection
        setSelectedItems(prev => new Set([...prev, ...newAvailableIds]));
      } else {
        setResponse(result);
        // Pre-select only available items
        setSelectedItems(new Set(result.items.filter(i => i.available).map(i => i.productId)));
      }
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
  }, [catalogId, toast, response, mergeItems]);

  const searchWithAudio = useCallback(async (audioBlob: Blob, appendMode: boolean = false) => {
    if (!catalogId) return;

    setState("processing");
    setError(null);

    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");
      formData.append("catalogId", catalogId);

      const fetchResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-customer-assistant`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: formData,
        }
      );

      if (!fetchResponse.ok) {
        const errorData = await fetchResponse.json();
        throw new Error(errorData.error || "Voice search failed");
      }

      const result = await fetchResponse.json() as CustomerAIResponse;
      
      if (result.error) {
        throw new Error(result.error);
      }

      if (appendMode && response) {
        // Merge new items with existing ones
        const mergedItems = mergeItems(response.items, result.items);
        const newAvailableIds = result.items.filter(i => i.available).map(i => i.productId);
        
        setResponse({
          ...result,
          items: mergedItems,
          summary: `${response.summary}. ${result.summary}`,
          unavailableCount: mergedItems.filter(i => !i.available).length,
        });
        setSelectedItems(prev => new Set([...prev, ...newAvailableIds]));
      } else {
        setResponse(result);
        setSelectedItems(new Set(result.items.filter(i => i.available).map(i => i.productId)));
      }
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
  }, [catalogId, toast, response, mergeItems]);

  const repeatOrder = useCallback(async (orderId: string, appendMode: boolean = false) => {
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
      
      if (appendMode && response) {
        const mergedItems = mergeItems(response.items, result.items);
        const newAvailableIds = result.items.filter(i => i.available).map(i => i.productId);
        
        setResponse({
          ...result,
          items: mergedItems,
          summary: `${response.summary}. ${result.summary}`,
          unavailableCount: mergedItems.filter(i => !i.available).length,
        });
        setSelectedItems(prev => new Set([...prev, ...newAvailableIds]));
      } else {
        setResponse(result);
        setSelectedItems(new Set(result.items.filter(i => i.available).map(i => i.productId)));
      }
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
  }, [catalogId, toast, response, mergeItems]);

  // Remove a single item from the list
  const removeItem = useCallback((productId: string) => {
    setResponse(prev => {
      if (!prev) return prev;
      const newItems = prev.items.filter(i => i.productId !== productId);
      return {
        ...prev,
        items: newItems,
        unavailableCount: newItems.filter(i => !i.available).length,
      };
    });
    setSelectedItems(prev => {
      const next = new Set(prev);
      next.delete(productId);
      return next;
    });
  }, []);

  // Check if we have items (for badge display)
  const itemCount = response?.items?.length ?? 0;

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
    itemCount,
    reset,
    searchProducts,
    searchWithAudio,
    repeatOrder,
    toggleItem,
    selectAll,
    deselectAll,
    updateItemQuantity,
    removeItem,
    getSelectedItems,
    getSelectedTotal,
  };
}
