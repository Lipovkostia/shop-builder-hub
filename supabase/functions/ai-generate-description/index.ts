import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { productNames, maxChars = 200, storeId } = await req.json();
    
    if (!productNames || !Array.isArray(productNames) || productNames.length === 0) {
      return new Response(JSON.stringify({ error: "productNames array is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Check AI access for this store and get model
    let aiModel = "openai/gpt-4.1-mini";
    if (storeId) {
      const { data: aiAccess } = await sb
        .from("store_ai_access")
        .select("is_unlocked, product_descriptions_enabled, product_descriptions_model")
        .eq("store_id", storeId)
        .maybeSingle();

      if (!aiAccess?.is_unlocked || !aiAccess?.product_descriptions_enabled) {
        return new Response(JSON.stringify({ error: "ИИ-функции не активированы. Включите доступ к ИИ в настройках профиля." }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      aiModel = aiAccess.product_descriptions_model || "openai/gpt-4.1-mini";
    }

    const VSEGPT_API_KEY = Deno.env.get("VSEGPT_API_KEY");
    if (!VSEGPT_API_KEY) throw new Error("VSEGPT_API_KEY is not configured");

    const results: Record<string, string> = {};
    const batchSize = 10;

    for (let i = 0; i < productNames.length; i += batchSize) {
      const batch = productNames.slice(i, i + batchSize);
      
      const productList = batch.map((item: { id: string; name: string }, idx: number) => 
        `${idx + 1}. ID: ${item.id} — "${item.name}"`
      ).join("\n");

      const response = await fetch("https://api.vsegpt.ru/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${VSEGPT_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: aiModel,
          messages: [
            {
              role: "system",
              content: `Ты — копирайтер для интернет-магазина. Генерируй краткие, привлекательные описания товаров на русском языке. Каждое описание должно быть не более ${maxChars} символов. Описание должно подчёркивать преимущества товара и быть полезным для покупателя. Не используй маркетинговый спам и восклицательные знаки. Пиши естественно и информативно. ВАЖНО: Ответь ТОЛЬКО валидным JSON объектом без markdown-форматирования, без тройных обратных кавычек. Формат: {"ID1": "описание1", "ID2": "описание2"}`,
            },
            {
              role: "user",
              content: `Сгенерируй описания для следующих товаров. Верни JSON объект, где ключ — ID товара, значение — описание.\n\n${productList}`,
            },
          ],
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Превышен лимит запросов, попробуйте позже" }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Недостаточно средств для AI-генерации" }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const t = await response.text();
        console.error("AI gateway error:", response.status, t);
        throw new Error("AI gateway error");
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      
      if (content) {
        try {
          // Strip markdown code fences if present
          const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
          const parsed = JSON.parse(cleaned);
          Object.assign(results, parsed);
        } catch (parseErr) {
          console.error("Failed to parse AI response:", content, parseErr);
        }
      }
    }

    return new Response(JSON.stringify({ descriptions: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-description error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
