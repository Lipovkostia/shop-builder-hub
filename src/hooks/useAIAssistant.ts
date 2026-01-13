import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface FoundProduct {
  id: string;
  name: string;
  reason: string;
  current_status?: string;
  new_status?: string;
  current_markup?: { type: string; value: number };
  new_markup?: { type: string; value: number };
  new_markup_type?: string;
  new_markup_value?: number;
}

export interface AIAssistantResponse {
  action: "hide" | "show" | "update_prices" | "find" | "analyze";
  products: FoundProduct[];
  summary: string;
  recognized_text?: string;
  error?: string;
}

export type AssistantState = "idle" | "recording" | "processing" | "confirming" | "applying" | "done" | "error";

export function useAIAssistant(storeId: string | null) {
  const { toast } = useToast();
  const [state, setState] = useState<AssistantState>("idle");
  const [response, setResponse] = useState<AIAssistantResponse | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setState("idle");
    setResponse(null);
    setSelectedProducts(new Set());
    setError(null);
  }, []);

  const searchProducts = useCallback(async (query: string) => {
    if (!storeId || !query.trim()) return;

    setState("processing");
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("ai-assistant", {
        body: { storeId, query },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const result = data as AIAssistantResponse;
      setResponse(result);
      setSelectedProducts(new Set(result.products.map(p => p.id)));
      setState("confirming");

    } catch (err) {
      console.error("AI search error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setState("error");
      toast({
        title: "Ошибка AI",
        description: err instanceof Error ? err.message : "Не удалось выполнить запрос",
        variant: "destructive",
      });
    }
  }, [storeId, toast]);

  const searchWithAudio = useCallback(async (audioBlob: Blob) => {
    if (!storeId) return;

    setState("processing");
    setError(null);

    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");
      formData.append("storeId", storeId);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`,
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

      const result = await response.json() as AIAssistantResponse;
      
      if (result.error) {
        throw new Error(result.error);
      }

      setResponse(result);
      setSelectedProducts(new Set(result.products.map(p => p.id)));
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
  }, [storeId, toast]);

  const toggleProduct = useCallback((productId: string) => {
    setSelectedProducts(prev => {
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
    if (response?.products) {
      setSelectedProducts(new Set(response.products.map(p => p.id)));
    }
  }, [response]);

  const deselectAll = useCallback(() => {
    setSelectedProducts(new Set());
  }, []);

  return {
    state,
    setState,
    response,
    selectedProducts,
    error,
    reset,
    searchProducts,
    searchWithAudio,
    toggleProduct,
    selectAll,
    deselectAll,
  };
}
