import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check super_admin role
    const { data: roleData } = await supabase
      .from("platform_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch unlinked products (limit to 200 for AI processing)
    const { data: products, error: fetchError } = await supabase
      .from("products")
      .select("id, name, sku, store_id, stores!inner(name)")
      .is("canonical_product_id", null)
      .is("deleted_at", null)
      .eq("is_active", true)
      .order("name")
      .limit(200);

    if (fetchError) throw fetchError;

    if (!products || products.length < 2) {
      return new Response(JSON.stringify({ groups: [], message: "Недостаточно несопоставленных товаров" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build product list for AI
    const productList = products.map((p: any, i: number) => 
      `${i}|${p.name}|${p.sku || ""}|${(p.stores as any)?.name || ""}`
    ).join("\n");

    const systemPrompt = `Ты — эксперт по сопоставлению товаров. Тебе дан список товаров от разных продавцов в формате "index|название|артикул|магазин".

Найди группы товаров, которые являются одним и тем же продуктом (одинаковый или очень похожий товар, просто от разных продавцов или с небольшими вариациями в названии).

ВАЖНО:
- Группируй ТОЛЬКО действительно похожие товары (один и тот же продукт)
- НЕ группируй товары одного типа/категории, если это разные продукты
- Учитывай вес, размер, производителя в названии — "Сыр Гауда 200г" и "Сыр Гауда 1кг" это РАЗНЫЕ товары
- Минимум 2 товара в группе
- Предложи название для мастер-товара каждой группы`;

    const userPrompt = `Вот список товаров:\n${productList}`;

    // Call AI
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_matches",
              description: "Return groups of matching products",
              parameters: {
                type: "object",
                properties: {
                  groups: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        canonical_name: { type: "string", description: "Suggested master product name" },
                        product_indices: {
                          type: "array",
                          items: { type: "integer" },
                          description: "Indices of matching products from the list",
                        },
                      },
                      required: ["canonical_name", "product_indices"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["groups"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_matches" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Превышен лимит запросов, попробуйте позже" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Необходимо пополнить баланс AI" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      throw new Error("AI gateway error");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ groups: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    
    // Map indices back to real product data
    const groups = (parsed.groups || [])
      .map((g: any) => ({
        canonical_name: g.canonical_name,
        products: (g.product_indices || [])
          .filter((idx: number) => idx >= 0 && idx < products.length)
          .map((idx: number) => {
            const p = products[idx] as any;
            return {
              id: p.id,
              name: p.name,
              sku: p.sku,
              store_id: p.store_id,
              store_name: p.stores?.name || "",
            };
          }),
      }))
      .filter((g: any) => g.products.length >= 2);

    return new Response(JSON.stringify({ groups }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
