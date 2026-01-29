import { useState } from "react";
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

export function useProductSeo(storeId: string | null, storeName?: string) {
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  // Generate SEO for single product
  const generateSeo = async (productId: string): Promise<boolean> => {
    if (!storeId) return false;

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-seo-generator", {
        body: {
          productIds: [productId],
          storeId,
          storeName,
          mode: "single",
        },
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || "Ошибка генерации SEO");
      }

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

  // Generate SEO for multiple products (bulk)
  const generateBulkSeo = async (productIds: string[]): Promise<GenerationResult | null> => {
    if (!storeId || productIds.length === 0) return null;

    setGenerating(true);
    setProgress({ current: 0, total: productIds.length });

    try {
      // Process in batches of 5 to avoid timeouts
      const batchSize = 5;
      const results: GenerationResult["results"] = [];
      
      for (let i = 0; i < productIds.length; i += batchSize) {
        const batch = productIds.slice(i, i + batchSize);
        
        const { data, error } = await supabase.functions.invoke("ai-seo-generator", {
          body: {
            productIds: batch,
            storeId,
            storeName,
            mode: "bulk",
          },
        });

        if (error) {
          console.error("Batch error:", error);
          continue;
        }

        if (data?.results) {
          results.push(...data.results);
        }

        setProgress({ current: Math.min(i + batchSize, productIds.length), total: productIds.length });
        
        // Add delay between batches
        if (i + batchSize < productIds.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      toast.success(`SEO сгенерировано для ${results.length} из ${productIds.length} товаров`);
      
      return {
        success: true,
        processed: results.length,
        total: productIds.length,
        results,
      };
    } catch (err) {
      console.error("Error generating bulk SEO:", err);
      toast.error("Ошибка массовой генерации SEO");
      return null;
    } finally {
      setGenerating(false);
      setProgress(null);
    }
  };

  // Manually update SEO fields
  const updateSeo = async (productId: string, seoData: Partial<SeoData>): Promise<boolean> => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("products")
        .update(seoData as any)
        .eq("id", productId);

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

  // Reset SEO fields
  const resetSeo = async (productId: string): Promise<boolean> => {
    return updateSeo(productId, {
      seo_title: null,
      seo_description: null,
      seo_keywords: null,
      seo_og_image: null,
      seo_schema: null,
      seo_canonical_url: null,
      seo_noindex: false,
      seo_generated_at: null,
    });
  };

  return {
    generating,
    saving,
    progress,
    generateSeo,
    generateBulkSeo,
    updateSeo,
    resetSeo,
  };
}
