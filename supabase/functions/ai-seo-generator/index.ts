import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ProductInput {
  id: string;
  name: string;
  description?: string;
  category_name?: string;
  price?: number;
  unit?: string;
  sku?: string;
}

interface SeoOutput {
  productId: string;
  seo_title: string;
  seo_description: string;
  seo_keywords: string[];
  seo_schema: object;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { productIds, storeId, storeName, mode = "single", storeType = "wholesale" } = await req.json();

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      throw new Error("productIds array is required");
    }

    if (!storeId) {
      throw new Error("storeId is required");
    }

    const VSEGPT_API_KEY = Deno.env.get("VSEGPT_API_KEY");
    if (!VSEGPT_API_KEY) {
      throw new Error("VSEGPT_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check AI access for this store
    const { data: aiAccess } = await supabase
      .from("store_ai_access")
      .select("is_unlocked, seo_enabled")
      .eq("store_id", storeId)
      .maybeSingle();

    if (!aiAccess?.is_unlocked || !aiAccess?.seo_enabled) {
      return new Response(
        JSON.stringify({ error: "ИИ-функции не активированы. Включите доступ к ИИ в настройках профиля." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch products data
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select(`
        id,
        name,
        description,
        price,
        unit,
        sku,
        category_id,
        categories:category_id (name)
      `)
      .in("id", productIds)
      .eq("store_id", storeId);

    if (productsError) {
      throw new Error(`Failed to fetch products: ${productsError.message}`);
    }

    if (!products || products.length === 0) {
      throw new Error("No products found");
    }

    const results: SeoOutput[] = [];
    let gatewayError: { code: number; message: string } | null = null;

    // Process products (in batches for bulk mode to avoid rate limits)
    for (const product of products) {
      const categoryName = (product.categories as any)?.name || "Товары";
      
      const isRetail = storeType === "retail";
      const storeTypeLabel = isRetail ? "розничного интернет-магазина" : "B2B интернет-магазина";
      const buyAction = isRetail ? "Купите" : "Купите оптом";
      const targetAudience = isRetail ? "для розничных покупателей" : "для B2B, оптовых закупок";
      const keywordHint = isRetail 
        ? "релевантных ключевых слов для розничной покупки (купить, цена, заказать, доставка)" 
        : "релевантных ключевых слов для оптовых закупок";
      const titleHint = isRetail 
        ? 'включи название товара и "купить" или "цена"' 
        : 'включи название товара и "оптом" или "купить оптом"';

      const prompt = `Ты — SEO-эксперт для российского ${storeTypeLabel} "${storeName || 'Магазин'}".

Сгенерируй SEO-метаданные для товара:

ТОВАР:
- Название: ${product.name}
- Категория: ${categoryName}
- Описание: ${product.description || "нет описания"}
- Цена: ${product.price ? `${product.price} ₽` : "не указана"}
- Единица: ${product.unit || "шт"}
- Артикул: ${product.sku || "не указан"}

ТРЕБОВАНИЯ:
1. seo_title: 55-65 символов, ${titleHint}
2. seo_description: 145-160 символов, начни с действия (${buyAction}, Закажите), укажи преимущества ${targetAudience}
3. seo_keywords: 5-8 ${keywordHint}
4. seo_schema: JSON-LD разметка Product для Schema.org

Верни ТОЛЬКО JSON без markdown, без \`\`\`json:
{
  "seo_title": "...",
  "seo_description": "...",
  "seo_keywords": ["...", "..."],
  "seo_schema": {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "...",
    "description": "...",
    "sku": "...",
    "offers": {
      "@type": "Offer",
      "price": "...",
      "priceCurrency": "RUB",
      "availability": "https://schema.org/InStock"
    }
  }
}`;

      try {
        const response = await fetch("https://api.vsegpt.ru/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${VSEGPT_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "openai/gpt-4.1-mini",
            messages: [
              { role: "system", content: "Ты SEO-эксперт. Отвечай ТОЛЬКО валидным JSON без markdown форматирования." },
              { role: "user", content: prompt },
            ],
            temperature: 0.7,
            max_tokens: 1000,
          }),
        });

        if (!response.ok) {
          if (response.status === 429) {
            gatewayError = {
              code: 429,
              message: "Превышен лимит запросов к ИИ. Подождите немного и попробуйте снова.",
            };
            break;
          }

          if (response.status === 402) {
            gatewayError = {
              code: 402,
              message: "Закончились кредиты ИИ. Пополните баланс Workspace Usage, чтобы продолжить генерацию.",
            };
            break;
          }

          throw new Error(`AI API error: ${response.status}`);
        }

        const aiResponse = await response.json();
        const content = aiResponse.choices?.[0]?.message?.content;

        if (!content) {
          console.error("No content in AI response for product:", product.id);
          continue;
        }

        // Parse AI response (handle potential markdown wrapping)
        let seoData;
        try {
          // Remove markdown code blocks if present
          let cleanContent = content.trim();
          if (cleanContent.startsWith("```json")) {
            cleanContent = cleanContent.slice(7);
          } else if (cleanContent.startsWith("```")) {
            cleanContent = cleanContent.slice(3);
          }
          if (cleanContent.endsWith("```")) {
            cleanContent = cleanContent.slice(0, -3);
          }
          seoData = JSON.parse(cleanContent.trim());
        } catch (_parseError) {
          console.error("Failed to parse AI response for product:", product.id, content);
          continue;
        }

        // Save to database
        const { error: updateError } = await supabase
          .from("products")
          .update({
            seo_title: seoData.seo_title,
            seo_description: seoData.seo_description,
            seo_keywords: seoData.seo_keywords,
            seo_schema: seoData.seo_schema,
            seo_generated_at: new Date().toISOString(),
          })
          .eq("id", product.id);

        if (updateError) {
          console.error("Failed to update product SEO:", product.id, updateError);
          continue;
        }

        results.push({
          productId: product.id,
          seo_title: seoData.seo_title,
          seo_description: seoData.seo_description,
          seo_keywords: seoData.seo_keywords,
          seo_schema: seoData.seo_schema,
        });

        // Add small delay between requests in bulk mode
        if (mode === "bulk" && products.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (productError) {
        console.error("Error processing product:", product.id, productError);
        continue;
      }
    }

    if (gatewayError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: gatewayError.message,
          code: gatewayError.code,
          processed: results.length,
          total: productIds.length,
          results,
        }),
        {
          status: gatewayError.code,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (results.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "ИИ не смог сгенерировать SEO для выбранных товаров. Проверьте описание товара и попробуйте снова.",
          code: 500,
          processed: 0,
          total: productIds.length,
          results: [],
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        total: productIds.length,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("ai-seo-generator error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
