import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Product {
  id: string;
  name: string;
  sku?: string;
  buy_price?: number;
  price?: number;
  markup_type?: string;
  markup_value?: number;
  is_active?: boolean;
}

interface FoundProduct {
  id: string;
  name: string;
  reason: string;
  current_status?: string;
  new_status?: string;
  current_markup?: { type: string; value: number };
  new_markup?: { type: string; value: number };
}

interface AIResponse {
  action: "hide" | "show" | "update_prices" | "find" | "analyze";
  products: FoundProduct[];
  summary: string;
  recognized_text?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const contentType = req.headers.get("content-type") || "";
    
    let storeId: string;
    let query: string;
    let audioBlob: Blob | null = null;
    
    // Handle both FormData (with audio) and JSON requests
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      storeId = formData.get("storeId") as string;
      query = formData.get("query") as string || "";
      const audioFile = formData.get("audio");
      if (audioFile && audioFile instanceof Blob) {
        audioBlob = audioFile;
      }
    } else {
      const body = await req.json();
      storeId = body.storeId;
      query = body.query;
    }

    if (!storeId) {
      return new Response(
        JSON.stringify({ error: "storeId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // If audio provided, transcribe it first with ElevenLabs
    let recognizedText = query;
    if (audioBlob) {
      const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
      if (!ELEVENLABS_API_KEY) {
        return new Response(
          JSON.stringify({ error: "ElevenLabs API key not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Convert blob to form data for ElevenLabs
      const audioFormData = new FormData();
      audioFormData.append("file", audioBlob, "audio.webm");
      audioFormData.append("model_id", "scribe_v1");
      audioFormData.append("language_code", "rus");

      const sttResponse = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
        },
        body: audioFormData,
      });

      if (!sttResponse.ok) {
        const errorText = await sttResponse.text();
        console.error("ElevenLabs STT error:", errorText);
        return new Response(
          JSON.stringify({ error: "Speech recognition failed", details: errorText }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const sttResult = await sttResponse.json();
      recognizedText = sttResult.text || "";
      console.log("Recognized text:", recognizedText);
    }

    if (!recognizedText?.trim()) {
      return new Response(
        JSON.stringify({ error: "No query provided and no speech recognized" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch all products for the store
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, name, sku, buy_price, price, markup_type, markup_value, is_active")
      .eq("store_id", storeId);

    if (productsError) {
      console.error("Products fetch error:", productsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch products" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build product list for AI context
    const productList = (products || []).map((p: Product) => ({
      id: p.id,
      name: p.name,
      sku: p.sku || "",
      buyPrice: p.buy_price || 0,
      price: p.price || 0,
      markupType: p.markup_type || "percent",
      markupValue: p.markup_value || 0,
      isActive: p.is_active !== false,
    }));

    // Call Lovable AI for product matching
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Lovable AI API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `Ты AI-помощник продавца B2B каталога. Анализируй товары и выполняй команды пользователя.

Доступные действия:
- hide: скрыть товары (изменить статус на hidden)
- show: показать товары (изменить статус на in_stock)
- update_prices: изменить наценку на товары
- find: найти товары по критериям
- analyze: анализ и статистика по товарам

Правила:
1. Если пользователь просит "скрыть", "убрать", "спрятать" - используй action: "hide"
2. Если пользователь просит "показать", "вернуть", "восстановить" - используй action: "show"
3. Если пользователь просит изменить цену, наценку - используй action: "update_prices"
4. Если пользователь просит найти, показать список - используй action: "find"
5. Ищи товары по частичному совпадению названия (fuzzy match)
6. Учитывай синонимы: "сёмга" = "семга", "рыба" включает лосось, форель, сёмгу и т.д.
7. Для каждого найденного товара укажи причину (reason) почему он выбран

Товары магазина (${productList.length} шт):
${JSON.stringify(productList.slice(0, 200), null, 2)}
${productList.length > 200 ? `\n... и ещё ${productList.length - 200} товаров` : ""}`;

    const userPrompt = `Запрос пользователя: "${recognizedText}"

Найди соответствующие товары и определи действие. Верни результат через tool calling.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "process_products",
              description: "Process products based on user command",
              parameters: {
                type: "object",
                properties: {
                  action: {
                    type: "string",
                    enum: ["hide", "show", "update_prices", "find", "analyze"],
                    description: "Action to perform",
                  },
                  products: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string", description: "Product ID" },
                        name: { type: "string", description: "Product name" },
                        reason: { type: "string", description: "Why this product was selected" },
                        new_markup_type: { type: "string", enum: ["percent", "rubles"], description: "New markup type if changing prices" },
                        new_markup_value: { type: "number", description: "New markup value if changing prices" },
                      },
                      required: ["id", "name", "reason"],
                    },
                  },
                  summary: {
                    type: "string",
                    description: "Brief summary of what will be done",
                  },
                },
                required: ["action", "products", "summary"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "process_products" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI processing failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResult = await aiResponse.json();
    console.log("AI result:", JSON.stringify(aiResult, null, 2));

    // Extract tool call result
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(
        JSON.stringify({ 
          error: "AI did not return structured response",
          recognized_text: recognizedText,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let result: AIResponse;
    try {
      const args = JSON.parse(toolCall.function.arguments);
      result = {
        action: args.action,
        products: args.products || [],
        summary: args.summary || "",
        recognized_text: recognizedText,
      };
    } catch (e) {
      console.error("Failed to parse AI response:", e);
      return new Response(
        JSON.stringify({ 
          error: "Failed to parse AI response",
          recognized_text: recognizedText,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Enrich products with current data
    const productMap = new Map(productList.map(p => [p.id, p]));
    result.products = result.products.map(p => {
      const current = productMap.get(p.id);
      return {
        ...p,
        current_status: current?.isActive ? "in_stock" : "hidden",
        current_markup: current ? { type: current.markupType, value: current.markupValue } : undefined,
      };
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("AI Assistant error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
