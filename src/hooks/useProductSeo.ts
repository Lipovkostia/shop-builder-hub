import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SeoData {
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string[] | null;
  seo_og_image: string | null;
  seo_schema: object | null;
  seo_canonical_url: string | null;
  seo_noindex: boolean;
  seo_generated_at: string | null;
}

interface GenerationResult {
  success: boolean;
  processed: number;
  total: number;
  results: Array<{
    productId: string;
    seo_title: string;
    seo_description: string;
    seo_keywords: string[];
    seo_schema: object;
  }>;
}

export function useProductSeo(storeId: string | null, storeName?: string, storeType: "retail" | "wholesale" = "wholesale") {
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const abortRef = useRef(false);

  const stopGeneration = useCallback(() => {
    abortRef.current = true;
  }, []);

  const generateSeo = async (productId: string): Promise<boolean> => {
    if (!storeId) return false;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-seo-generator", {
        body: { productIds: [productId], storeId, storeName, storeType, mode: "single" },
      });
      const errorCode = (error as any)?.context?.status;
      if (errorCode === 402) { toast.error("ИИ-кредиты закончились"); return false; }
      if (errorCode === 429) { toast.error("Слишком много запросов к ИИ"); return false; }
      if (error) throw error;
      if (!data?.success || !data?.processed) throw new Error(data?.error || "ИИ не сгенерировал SEO");
      toast.success("SEO-метаданные сгенерированы");
      return true;
    } catch (err) {
      console.error("Error generating SEO:", err);
      toast.error("Ошибка генерации SEO");
      return false;
    } finally {
      setGenerating(false);
    }
  };

  const generateBulkSeo = async (productIds: string[]): Promise<GenerationResult | null> => {
    if (!storeId || productIds.length === 0) return null;
    setGenerating(true);
    setProgress({ current: 0, total: productIds.length });
    abortRef.current = false;

    try {
      const batchSize = 5;
      const results: GenerationResult["results"] = [];
      
      for (let i = 0; i < productIds.length; i += batchSize) {
        if (abortRef.current) {
          toast.info(`Генерация остановлена. Обработано ${results.length} из ${productIds.length}`);
          break;
        }

        const batch = productIds.slice(i, i + batchSize);
        const { data, error } = await supabase.functions.invoke("ai-seo-generator", {
          body: { productIds: batch, storeId, storeName, storeType, mode: "bulk" },
        });

        const errorCode = (error as any)?.context?.status;
        if (errorCode === 402) { toast.error("ИИ-кредиты закончились"); break; }
        if (errorCode === 429) { toast.error("Слишком много запросов к ИИ"); break; }
        if (error) { console.error("Batch error:", error); continue; }
        if (!data?.success) { console.error("Batch failed:", data?.error); continue; }
        if (data?.results) results.push(...data.results);

        setProgress({ current: Math.min(i + batchSize, productIds.length), total: productIds.length });
        
        if (i + batchSize < productIds.length && !abortRef.current) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (results.length === 0 && !abortRef.current) {
        toast.error("ИИ не сгенерировал SEO для выбранных товаров");
        return null;
      }

      if (!abortRef.current) {
        toast.success(`SEO сгенерировано для ${results.length} из ${productIds.length} товаров`);
      }
      
      return { success: true, processed: results.length, total: productIds.length, results };
    } catch (err) {
      console.error("Error generating bulk SEO:", err);
      toast.error("Ошибка массовой генерации SEO");
      return null;
    } finally {
      setGenerating(false);
      setProgress(null);
      abortRef.current = false;
    }
  };

  const updateSeo = async (productId: string, seoData: Partial<SeoData>): Promise<boolean> => {
    setSaving(true);
    try {
      const { error } = await supabase.from("products").update(seoData as any).eq("id", productId);
      if (error) throw error;
      toast.success("SEO-настройки сохранены");
      return true;
    } catch (err) {
      console.error("Error updating SEO:", err);
      toast.error("Ошибка сохранения SEO");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const resetSeo = async (productId: string): Promise<boolean> => {
    return updateSeo(productId, {
      seo_title: null, seo_description: null, seo_keywords: null,
      seo_og_image: null, seo_schema: null, seo_canonical_url: null,
      seo_noindex: false, seo_generated_at: null,
    });
  };

  return { generating, saving, progress, generateSeo, generateBulkSeo, updateSeo, resetSeo, stopGeneration };
}
