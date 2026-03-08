import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY = "https://api.vsegpt.ru/v1/chat/completions";
const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// Batch-fetch all products
async function fetchAllProducts(supabase: any, storeId: string): Promise<any[]> {
  const PAGE_SIZE = 1000;
  let all: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, description, price, buy_price, markup_type, markup_value, is_fixed_price, unit, sku, quantity, packaging_type, images")
      .eq("store_id", storeId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("name")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

function calcPrice(p: any): number {
  if (p.price && p.price > 0) return p.price;
  if (p.buy_price && p.buy_price > 0) {
    const bp = Number(p.buy_price);
    const mt = p.markup_type || "percent";
    const mv = Number(p.markup_value || 0);
    return mt === "percent" ? Math.round(bp * (1 + mv / 100)) : Math.round(bp + mv);
  }
  return 0;
}

function buildCatalogContext(products: any[]): string {
  if (!products.length) return "Каталог пуст.";
  const lines = products.slice(0, 150).map(p => {
    const price = calcPrice(p);
    return `- [ID:${p.id}] ${p.name}${p.sku ? ` (арт. ${p.sku})` : ""}: ${price > 0 ? price + "₽" : "цена не указана"}${p.unit ? ` / ${p.unit}` : ""}${p.quantity > 0 ? "" : " (нет в наличии)"}`;
  });
  return `Каталог товаров (${products.length} позиций):\n${lines.join("\n")}`;
}

// Build system prompt from bot config
function buildSystemPrompt(bot: any, catalogContext: string, salesStages: any[]): string {
  let prompt = "";

  // Personality
  const pc = bot.personality_config || {};
  if (pc.bot_name) prompt += `Тебя зовут ${pc.bot_name}. `;
  if (pc.character_traits) prompt += `Характер: ${pc.character_traits}. `;
  if (pc.communication_style) prompt += `Стиль общения: ${pc.communication_style}. `;
  if (pc.tone) prompt += `Тон: ${pc.tone}. `;

  // Instructions
  const ic = bot.instructions_config || {};
  if (ic.main_goal) prompt += `\nГлавная задача: ${ic.main_goal}`;
  if (ic.responsibilities) prompt += `\nОбязанности: ${ic.responsibilities}`;
  if (ic.forbidden_actions) prompt += `\nЗапрещено: ${ic.forbidden_actions}`;
  if (ic.response_format) prompt += `\nФормат ответов: ${ic.response_format}`;

  // Rules
  const rules = bot.rules_list || [];
  if (rules.length > 0) {
    prompt += `\n\nПравила:\n${rules.map((r: string, i: number) => `${i + 1}. ${r}`).join("\n")}`;
  }

  // Smart setup data
  if (bot.mode === "smart" && bot.smart_setup_data) {
    const sd = bot.smart_setup_data;
    if (sd.company_info) prompt += `\n\nО компании: ${sd.company_info}`;
    if (sd.pricing_info) prompt += `\nЦены: ${sd.pricing_info}`;
    if (sd.delivery_info) prompt += `\nДоставка: ${sd.delivery_info}`;
    if (sd.customer_interaction) prompt += `\nВзаимодействие: ${sd.customer_interaction}`;
  }

  // Pro mode prompt
  if (bot.mode === "pro" && bot.system_prompt) {
    prompt += `\n\n${bot.system_prompt}`;
  }

  // Sales stages
  if (salesStages.length > 0) {
    const activeStages = salesStages.filter(s => s.is_active);
    if (activeStages.length > 0) {
      prompt += `\n\nЭтапы продажи:\n`;
      activeStages.forEach((s, i) => {
        prompt += `${i + 1}. ${s.name}: ${s.instructions}`;
        if (s.action_type === "collect_contact") prompt += ` [Собери контакт: имя, телефон, адрес]`;
        if (s.action_type === "create_order") prompt += ` [Когда все данные собраны, выведи: CREATE_ORDER:{"name":"имя","phone":"телефон","address":"адрес","items":"товары"}]`;
        prompt += "\n";
      });
    }
  }

  // Catalog
  prompt += `\n\n${catalogContext}`;

  prompt += `\n\nОтвечай кратко и по делу. Ты — помощник в интернет-магазине. Помогай с выбором товаров, ценами, оформлением заказов.`;
  prompt += `\n\nКОГДА РЕКОМЕНДУЕШЬ ТОВАРЫ: после текстового ответа ОБЯЗАТЕЛЬНО добавь на новой строке тег [PRODUCTS:id1,id2,id3] с ID рекомендуемых товаров (максимум 6). Пример: "Вот что могу предложить:\n[PRODUCTS:abc-123,def-456]". ID бери из каталога (формат [ID:xxx]). Используй этот тег КАЖДЫЙ РАЗ, когда упоминаешь конкретные товары.`;

  return prompt;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, store_id, session_id, message, visitor_id, channel, bot_id } = await req.json();
    const supabase = getSupabase();

    if (action === "get_config") {
      // Return chat config for a store
      const field = channel === "wholesale" ? "wholesale_chat_bot_id" : "retail_chat_bot_id";
      const enabledField = channel === "wholesale" ? "wholesale_chat_enabled" : "retail_chat_enabled";
      
      const { data: store } = await supabase
        .from("stores")
        .select(`${enabledField}, ${field}`)
        .eq("id", store_id)
        .single();
      
      if (!store || !(store as any)[enabledField] || !(store as any)[field]) {
        return new Response(JSON.stringify({ enabled: false }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: bot } = await supabase
        .from("avito_bots")
        .select("id, name, personality_config")
        .eq("id", (store as any)[field])
        .single();

      const botName = (bot as any)?.personality_config?.bot_name || (bot as any)?.name || "Помощник";

      return new Response(JSON.stringify({ enabled: true, bot_name: botName }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "send_message") {
      // Get or create session
      let sessionId = session_id;
      
      if (!sessionId) {
        // Get the bot_id from store
        const field = channel === "wholesale" ? "wholesale_chat_bot_id" : "retail_chat_bot_id";
        const { data: store } = await supabase
          .from("stores")
          .select(field)
          .eq("id", store_id)
          .single();
        
        const chatBotId = (store as any)?.[field];
        if (!chatBotId) throw new Error("Chat bot not configured");

        const { data: session, error: sessErr } = await supabase
          .from("storefront_chat_sessions")
          .insert({ store_id, bot_id: chatBotId, channel: channel || "retail", visitor_id: visitor_id || "anon_" + Date.now() })
          .select()
          .single();
        if (sessErr) throw sessErr;
        sessionId = session.id;
      }

      // Save user message
      await supabase.from("storefront_chat_messages").insert({ session_id: sessionId, role: "user", content: message });

      // Get session with bot_id
      const { data: session } = await supabase
        .from("storefront_chat_sessions")
        .select("bot_id, store_id")
        .eq("id", sessionId)
        .single();

      if (!session) throw new Error("Session not found");

      // Get bot config
      const { data: bot } = await supabase
        .from("avito_bots")
        .select("*")
        .eq("id", (session as any).bot_id)
        .single();

      if (!bot) throw new Error("Bot not found");

      // Get sales stages
      const { data: salesStages } = await supabase
        .from("avito_bot_sales_stages")
        .select("*")
        .eq("bot_id", (session as any).bot_id)
        .eq("is_active", true)
        .order("sort_order");

      // Get products
      const products = await fetchAllProducts(supabase, (session as any).store_id);
      const catalogContext = buildCatalogContext(products);
      const systemPrompt = buildSystemPrompt(bot, catalogContext, salesStages || []);

      // Get conversation history
      const { data: history } = await supabase
        .from("storefront_chat_messages")
        .select("role, content")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true })
        .limit(50);

      const messages = [
        { role: "system", content: systemPrompt },
        ...(history || []).map((m: any) => ({ role: m.role, content: m.content })),
      ];

      // Call AI
      const aiModel = (bot as any).ai_model || "google/gemini-3-flash-preview";
      
      let aiResponse = "";
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      const VSEGPT_KEY = Deno.env.get("VSEGPT_API_KEY");

      // Build ordered list of gateways to try
      const gateways: { url: string; key: string; name: string }[] = [];
      if (LOVABLE_API_KEY) gateways.push({ url: LOVABLE_GATEWAY, key: LOVABLE_API_KEY, name: "Lovable" });
      if (VSEGPT_KEY) gateways.push({ url: AI_GATEWAY, key: VSEGPT_KEY, name: "VseGPT" });

      if (gateways.length === 0) throw new Error("No AI API key configured");

      const requestBody = JSON.stringify({ model: aiModel, messages, max_tokens: 1000, temperature: 0.7 });
      let lastError = "";

      for (const gw of gateways) {
        try {
          console.log(`Trying ${gw.name} gateway with model ${aiModel}...`);
          const aiResp = await fetch(gw.url, {
            method: "POST",
            headers: { Authorization: `Bearer ${gw.key}`, "Content-Type": "application/json" },
            body: requestBody,
          });

          if (aiResp.ok) {
            const aiData = await aiResp.json();
            aiResponse = aiData.choices?.[0]?.message?.content || "";
            if (aiResponse) {
              console.log(`${gw.name} responded successfully`);
              break;
            }
          } else {
            const errText = await aiResp.text();
            console.error(`${gw.name} error: ${aiResp.status} ${errText}`);
            lastError = `${gw.name}: ${aiResp.status}`;
          }
        } catch (e) {
          console.error(`${gw.name} fetch error:`, e.message);
          lastError = `${gw.name}: ${e.message}`;
        }
      }

      if (!aiResponse) {
        aiResponse = "Извините, не смог ответить. Попробуйте позже.";
        console.error("All AI gateways failed. Last error:", lastError);
      }

      // Check for order creation trigger
      const orderMatch = aiResponse.match(/\[?CREATE_ORDER:\{([^}]+)\}\]?/);
      if (orderMatch) {
        try {
          const orderData = JSON.parse(`{${orderMatch[1]}}`);
          // Create order
          const orderNumber = `SC-${Date.now().toString(36).toUpperCase()}`;
          await supabase.from("orders").insert({
            store_id: (session as any).store_id,
            order_number: orderNumber,
            guest_name: orderData.name || "Клиент из чата",
            guest_phone: orderData.phone || "",
            is_guest_order: true,
            status: "new",
            subtotal: 0,
            total: 0,
            notes: `Заказ из чата магазина. Товары: ${orderData.items || "не указаны"}. Адрес: ${orderData.address || "не указан"}`,
          });
          // Clean the response
          aiResponse = aiResponse.replace(/\[?CREATE_ORDER:\{[^}]+\}\]?/, "").trim();
          if (!aiResponse) aiResponse = `✅ Заказ №${orderNumber} оформлен! Мы свяжемся с вами для подтверждения.`;
        } catch (e) {
          console.error("Order creation error:", e);
        }
      }

      // Save assistant message
      await supabase.from("storefront_chat_messages").insert({ session_id: sessionId, role: "assistant", content: aiResponse });

      return new Response(JSON.stringify({ response: aiResponse, session_id: sessionId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("storefront-chat error:", e);
    return new Response(JSON.stringify({ error: e.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
