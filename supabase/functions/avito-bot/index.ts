// Avito Bot Edge Function v3
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AVITO_TOKEN_URL = "https://api.avito.ru/token";
const AVITO_API_BASE = "https://api.avito.ru";
const AI_GATEWAY = "https://api.vsegpt.ru/v1/chat/completions";
const VSEGPT_MODELS_URL = "https://api.vsegpt.ru/v1/models";

async function getAvitoToken(clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch(AVITO_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) throw new Error(`Avito auth failed [${res.status}]`);
  const data = await res.json();
  return data.access_token;
}

async function getAIResponse(
  messages: { role: string; content: string }[],
  model: string,
  apiKey: string
): Promise<string> {
  const res = await fetch(AI_GATEWAY, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
    }),
  });

  if (res.status === 429) throw new Error("Rate limit exceeded");
  if (res.status === 402) throw new Error("Payment required");
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI error [${res.status}]: ${t}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

async function getAvitoListingInfo(token: string, userId: number, itemId: string): Promise<{ title: string; description: string; price: number; category: string; url: string } | null> {
  try {
    const res = await fetch(`${AVITO_API_BASE}/core/v1/accounts/${userId}/items/${itemId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      console.error(`Avito listing fetch failed [${res.status}] for item ${itemId}`);
      return null;
    }
    const data = await res.json();
    const price = data.price || data.price_string || 0;
    return {
      title: data.title || "",
      description: data.description || data.body || "",
      price: typeof price === "string" ? parseInt(price.replace(/\D/g, ""), 10) || 0 : price,
      category: data.category?.name || "",
      url: data.url || `https://www.avito.ru/${itemId}`,
    };
  } catch (err) {
    console.error("getAvitoListingInfo error:", err);
    return null;
  }
}

function normalizeForMatch(value: string): string {
  return (value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreTitleMatch(candidate: string, query: string): number {
  const c = normalizeForMatch(candidate);
  const q = normalizeForMatch(query);
  if (!c || !q) return 0;
  if (c === q) return 100;
  if (c.includes(q) || q.includes(c)) return 80;

  const qTokens = q.split(" ").filter(Boolean);
  if (qTokens.length === 0) return 0;
  const hitCount = qTokens.filter((t) => c.includes(t)).length;
  return Math.round((hitCount / qTokens.length) * 60);
}

async function getLocalListingInfo(
  supabase: ReturnType<typeof createClient>,
  storeId: string,
  itemId?: string,
  itemTitle?: string
): Promise<{ title: string; description: string; price: number; category: string; url: string } | null> {
  try {
    const { data, error } = await supabase
      .from("avito_feed_products")
      .select("product_id, avito_category, avito_params, products(name, description, price)")
      .eq("store_id", storeId)
      .limit(1000);

    if (error || !data?.length) return null;

    const normalizedItemId = (itemId || "").trim();
    const normalizedTitle = normalizeForMatch(itemTitle || "");

    type Candidate = {
      title: string;
      description: string;
      price: number;
      category: string;
      score: number;
    };

    let best: Candidate | null = null;

    for (const row of data as any[]) {
      const params = (row.avito_params && typeof row.avito_params === "object") ? row.avito_params : {};
      const product = row.products || {};

      const title = String(params.title || product.name || "").trim();
      const description = String(params.description || product.description || "").trim();
      const rawPrice = params.Price ?? params.price ?? product.price ?? 0;
      const price = typeof rawPrice === "string"
        ? parseInt(rawPrice.replace(/\D/g, ""), 10) || 0
        : Number(rawPrice) || 0;
      const category = String(row.avito_category || params.category || "").trim();

      const avitoIdCandidates = [
        String(params.avitoNumber || "").trim(),
        String(params.AvitoId || "").trim(),
        String(params.avitoId || "").trim(),
        String(params.Id || "").trim(),
        String(params.itemId || "").trim(),
      ].filter(Boolean);

      let score = 0;
      if (normalizedItemId && avitoIdCandidates.includes(normalizedItemId)) {
        score = 200;
      } else if (normalizedTitle) {
        score = scoreTitleMatch(title, normalizedTitle);
      }

      if (!best || score > best.score) {
        best = { title, description, price, category, score };
      }
    }

    if (!best || best.score <= 0) return null;

    return {
      title: best.title,
      description: best.description,
      price: best.price,
      category: best.category,
      url: "",
    };
  } catch (err) {
    console.error("getLocalListingInfo error:", err);
    return null;
  }
}

function mergeListingInfo(
  localListing: { title: string; description: string; price: number; category: string; url: string } | null,
  apiListing: { title: string; description: string; price: number; category: string; url: string } | null
): { title: string; description: string; price: number; category: string; url: string } | null {
  if (!localListing && !apiListing) return null;

  return {
    title: localListing?.title || apiListing?.title || "",
    description: localListing?.description || apiListing?.description || "",
    price: (localListing?.price && localListing.price > 0) ? localListing.price : (apiListing?.price || 0),
    category: localListing?.category || apiListing?.category || "",
    url: apiListing?.url || localListing?.url || "",
  };
}

async function sendTelegramNotification(
  botToken: string,
  chatId: string,
  message: string
): Promise<void> {
  if (!botToken || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
      }),
    });
  } catch (err) {
    console.error("Telegram notification error:", err);
  }
}

function buildQAContext(qaItems: Array<{ question: string; answer: string; match_mode: string }>): string {
  if (!qaItems || qaItems.length === 0) return "";
  
  const qaText = qaItems.map((qa, i) => {
    const mode = qa.match_mode === "exact" ? "(точное совпадение)" : "(примерное)";
    return `${i + 1}. Вопрос ${mode}: "${qa.question}"\n   Ответ: "${qa.answer}"`;
  }).join("\n");
  
  return `\n\n--- БАЗА ВОПРОСОВ И ОТВЕТОВ ---\nКогда клиент задаёт вопрос из списка ниже, используй соответствующий ответ:\n${qaText}\n--- КОНЕЦ БАЗЫ ---\n`;
}

function buildSmartSetupPrompt(data: any): string {
  if (!data || typeof data !== "object") return "";
  const parts: string[] = [];
  
  parts.push("Ты — виртуальный ассистент продавца на Авито. Твоя задача — помогать клиентам с информацией о товарах и услугах, отвечать на вопросы и помогать с оформлением заказа.");
  
  if (data.company_info) {
    parts.push(`\n\n--- ИНФОРМАЦИЯ О ПРОДАВЦЕ ---\n${data.company_info}`);
  }
  if (data.pricing_info) {
    parts.push(`\n\n--- ЦЕНООБРАЗОВАНИЕ И СКИДКИ ---\n${data.pricing_info}`);
  }
  if (data.delivery_info) {
    parts.push(`\n\n--- ДОСТАВКА, ОПЛАТА И ГАРАНТИИ ---\n${data.delivery_info}`);
  }
  if (data.customer_interaction) {
    parts.push(`\n\n--- ВЗАИМОДЕЙСТВИЕ С КЛИЕНТОМ ---\n${data.customer_interaction}`);
  }
  
  if (Array.isArray(data.custom_blocks)) {
    for (const block of data.custom_blocks) {
      if (block?.content?.trim()) {
        const title = block.title?.trim() || "ДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ";
        parts.push(`\n\n--- ${title.toUpperCase()} ---\n${block.content}`);
      }
    }
  }
  
  parts.push("\n\nВАЖНО: Всегда будь вежливым и профессиональным. Отвечай по существу.");
  return parts.join("");
}

function buildPersonalityPrompt(bot: any): string {
  const parts: string[] = [];
  const p = bot.personality_config;
  const ins = bot.instructions_config;
  const rules: string[] = bot.rules_list || [];

  if (p && typeof p === "object") {
    const pParts: string[] = [];
    if (p.bot_name) pParts.push(`Тебя зовут ${p.bot_name}.`);
    if (p.character_traits) pParts.push(`Твои черты характера: ${p.character_traits}.`);
    if (p.communication_style) pParts.push(`Стиль общения: ${p.communication_style}.`);
    if (p.tone) pParts.push(`Тон: ${p.tone}.`);
    if (p.emoji_usage) {
      const emojiMap: Record<string, string> = { none: "Не используй эмодзи.", minimal: "Используй эмодзи очень умеренно, 1-2 на сообщение.", moderate: "Можешь умеренно использовать эмодзи.", frequent: "Активно используй эмодзи." };
      pParts.push(emojiMap[p.emoji_usage] || "");
    }
    if (p.greeting_style) pParts.push(`Приветствуй клиента так: "${p.greeting_style}"`);
    if (pParts.length > 0) parts.push(`\n\n--- ЛИЧНОСТЬ ---\n${pParts.join(" ")}`);
  }

  if (ins && typeof ins === "object") {
    const iParts: string[] = [];
    if (ins.main_goal) iParts.push(`Главная цель: ${ins.main_goal}`);
    if (ins.responsibilities) iParts.push(`Обязанности: ${ins.responsibilities}`);
    if (ins.forbidden_actions) iParts.push(`Запрещено: ${ins.forbidden_actions}`);
    if (ins.response_format) iParts.push(`Формат ответов: ${ins.response_format}`);
    if (ins.knowledge_boundaries) iParts.push(`Границы знаний: ${ins.knowledge_boundaries}`);
    if (iParts.length > 0) parts.push(`\n\n--- ДОЛЖНОСТНЫЕ ИНСТРУКЦИИ ---\n${iParts.join("\n")}`);
  }

  if (rules.length > 0) {
    const rulesText = rules.map((r: string, i: number) => `${i + 1}. ${r}`).join("\n");
    parts.push(`\n\n--- ПРАВИЛА ---\nСтрого следуй этим правилам:\n${rulesText}`);
  }

  return parts.join("");
}

function getEffectiveSystemPrompt(bot: any): string {
  let base = "";
  if (bot.mode === "smart" && bot.smart_setup_data) {
    const smartPrompt = buildSmartSetupPrompt(bot.smart_setup_data);
    if (smartPrompt) base = smartPrompt;
  }
  if (!base) {
    base = bot.system_prompt || "Ты — помощник продавца на Авито. Отвечай вежливо и помогай с вопросами о товарах.";
  }
  // Append personality, instructions, rules from structured config
  base += buildPersonalityPrompt(bot);

  // Append handoff instructions if handoff_rules exist
  const handoffRules = bot.handoff_rules;
  if (Array.isArray(handoffRules) && handoffRules.length > 0) {
    const handoffText = handoffRules
      .filter((r: any) => r.target_bot_id && r.trigger_topics?.length > 0)
      .map((r: any, i: number) => `${i + 1}. Темы: ${r.trigger_topics.join(", ")} → ${r.description || "переключить на специалиста"}`)
      .join("\n");
    if (handoffText) {
      base += `\n\n--- ПЕРЕКЛЮЧЕНИЕ НА ДРУГОГО СПЕЦИАЛИСТА ---\nЕсли клиент задаёт вопрос на одну из этих тем, ответь: "[HANDOFF:номер_правила]" в начале ответа, а затем вежливо сообщи что передаёшь клиента специалисту.\n${handoffText}\n--- КОНЕЦ ПРАВИЛ ПЕРЕКЛЮЧЕНИЯ ---`;
    }
  }

  return base;
}

// Check if bot should work right now based on schedule
function isBotWithinSchedule(bot: any): boolean {
  if (!bot.schedule_mode || bot.schedule_mode === "24/7") return true;
  
  const config = bot.schedule_config;
  if (!config || typeof config !== "object") return true;
  
  const now = new Date();
  // Use Moscow time (UTC+3) as default
  const offset = config.timezone_offset ?? 3;
  const utcHours = now.getUTCHours();
  const localHours = (utcHours + offset + 24) % 24;
  const localMinutes = now.getUTCMinutes();
  const currentTime = localHours * 60 + localMinutes;
  
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const dayOfWeek = now.getUTCDay();
  // Adjust day if timezone offset shifts the day
  const localDay = dayNames[dayOfWeek];
  
  if (bot.schedule_mode === "schedule" && config.days) {
    const dayConfig = config.days[localDay];
    if (!dayConfig || !dayConfig.enabled) return false;
    
    const startParts = (dayConfig.start || "09:00").split(":");
    const endParts = (dayConfig.end || "18:00").split(":");
    const startMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1] || "0");
    const endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1] || "0");
    
    return currentTime >= startMinutes && currentTime <= endMinutes;
  }
  
  return true;
}

// Check if seller sent stop command in this chat
function hasSellerStopCommand(messages: any[], sellerId: number | string, stopCommand: string): boolean {
  if (!stopCommand) return false;
  const cmd = stopCommand.trim().toLowerCase();
  if (!cmd) return false;
  
  // Check last 10 messages from seller for stop command
  const sellerMsgs = messages
    .filter(m => String(m.author_id) === String(sellerId))
    .slice(-10);
  
  return sellerMsgs.some(m => {
    const text = (m.content?.text || m.text || "").trim().toLowerCase();
    return text === cmd || text.startsWith(cmd + " ");
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vsegptApiKey = Deno.env.get("VSEGPT_API_KEY");
    if (!vsegptApiKey) throw new Error("VSEGPT_API_KEY is not configured");

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { action, store_id, bot_id, message, item_id, debug_session_id } = await req.json();

    // Check AI access for this store
    if (store_id && action !== "fetch_models" && action !== "bot_stats") {
      const { data: aiAccess } = await supabase
        .from("store_ai_access")
        .select("is_unlocked, avito_bot_enabled")
        .eq("store_id", store_id)
        .maybeSingle();

      if (!aiAccess?.is_unlocked || !aiAccess?.avito_bot_enabled) {
        return new Response(
          JSON.stringify({ error: "ИИ-функции не активированы. Включите доступ к ИИ в настройках профиля." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ===== BOT STATS (for dashboard) =====
    if (action === "bot_stats") {
      if (!store_id) throw new Error("store_id required");
      
      const { data: bots } = await supabase
        .from("avito_bots")
        .select("id, name, is_active, ai_model, avito_account_id, schedule_mode, seller_stop_command, created_at")
        .eq("store_id", store_id);
      
      const { data: chats } = await supabase
        .from("avito_bot_chats")
        .select("id, avito_user_name, messages_count, bot_responses_count, is_lead, is_escalated, last_message_at, status, store_id")
        .eq("store_id", store_id)
        .order("last_message_at", { ascending: false })
        .limit(100);
      
      const { data: accounts } = await supabase
        .from("avito_accounts")
        .select("id, profile_name, client_id, avito_user_id")
        .eq("store_id", store_id);
      
      // Count total messages
      const { count: totalMessages } = await supabase
        .from("avito_bot_messages")
        .select("id", { count: "exact", head: true })
        .eq("store_id", store_id);

      // Filter out debug chats for real stats
      const realChats = (chats || []).filter(c => !c.avito_user_name?.startsWith("Отладка"));
      const totalBotResponses = realChats.reduce((sum, c) => sum + (c.bot_responses_count || 0), 0);
      const totalLeads = realChats.filter(c => c.is_lead).length;
      const totalEscalated = realChats.filter(c => c.is_escalated).length;
      
      return new Response(
        JSON.stringify({
          success: true,
          stats: {
            bots_total: (bots || []).length,
            bots_active: (bots || []).filter(b => b.is_active).length,
            accounts_total: (accounts || []).length,
            accounts_connected: (accounts || []).filter(a => a.avito_user_id).length,
            chats_total: realChats.length,
            messages_total: totalMessages || 0,
            bot_responses_total: totalBotResponses,
            leads_total: totalLeads,
            escalated_total: totalEscalated,
          },
          recent_chats: realChats.slice(0, 10),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== FETCH VSEGPT MODELS =====
    if (action === "fetch_models") {
      const res = await fetch(VSEGPT_MODELS_URL, {
        headers: { Authorization: `Bearer ${vsegptApiKey}` },
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Models fetch failed [${res.status}]: ${t}`);
      }
      const data = await res.json();
      const models = (data.data || [])
        .filter((m: any) => m.id && !m.id.startsWith("img-") && !m.id.startsWith("dall-") && !m.id.startsWith("tts-") && !m.id.startsWith("stt-") && !m.id.startsWith("whisper"))
        .map((m: any) => ({
          id: m.id,
          name: m.id,
          owned_by: m.owned_by || "",
        }));
      return new Response(
        JSON.stringify({ success: true, models }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== LIST AVITO ITEMS =====
    if (action === "list_items") {
      if (!bot_id) throw new Error("bot_id required");

      const { data: bot, error: botErr } = await supabase
        .from("avito_bots")
        .select("*")
        .eq("id", bot_id)
        .single();
      if (botErr || !bot) throw new Error("Бот не найден");

      let accQuery = supabase.from("avito_accounts").select("*");
      if (bot.avito_account_id) {
        accQuery = accQuery.eq("id", bot.avito_account_id);
      } else if (store_id) {
        accQuery = accQuery.eq("store_id", store_id);
      } else {
        throw new Error("Аккаунт Авито не привязан");
      }
      const { data: account, error: accErr } = await accQuery.single();
      if (accErr || !account) throw new Error("Авито аккаунт не найден");

      const token = await getAvitoToken(account.client_id, account.client_secret);
      let userId = account.avito_user_id;
      
      if (!userId) {
        try {
          const selfRes = await fetch(`${AVITO_API_BASE}/core/v1/accounts/self`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (selfRes.ok) {
            const selfData = await selfRes.json();
            userId = selfData.id;
            if (userId) {
              await supabase.from("avito_accounts").update({ avito_user_id: userId }).eq("id", account.id);
            }
          }
        } catch {}
      }
      if (!userId) throw new Error("Не удалось определить Авито user_id. Проверьте API-ключи аккаунта.");

      const res = await fetch(
        `${AVITO_API_BASE}/core/v1/items?per_page=50&status=active`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Avito items failed [${res.status}]: ${t}`);
      }
      const data = await res.json();
      const items = (data.resources || []).map((item: any) => ({
        id: String(item.id),
        title: item.title || "",
        price: item.price || 0,
        url: item.url || "",
        image: item.images?.[0]?.["640x480"] || item.images?.[0]?.["default"] || "",
        category: item.category?.name || "",
      }));

      return new Response(
        JSON.stringify({ success: true, items }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== DEBUG CHAT =====
    if (action === "debug_chat") {
      if (!bot_id || !message) throw new Error("bot_id and message required");

      const { data: bot, error: botErr } = await supabase
        .from("avito_bots")
        .select("*")
        .eq("id", bot_id)
        .single();

      if (botErr || !bot) throw new Error("Бот не найден");

      const { data: qaItems } = await supabase
        .from("avito_bot_qa")
        .select("*")
        .eq("bot_id", bot_id)
        .eq("is_active", true);

      const qaContext = buildQAContext(qaItems || []);

      let listingContext = "";
      if (item_id) {
        try {
          const localListing = await getLocalListingInfo(supabase, bot.store_id, String(item_id));

          let apiListing: { title: string; description: string; price: number; category: string; url: string } | null = null;
          let accQuery = supabase.from("avito_accounts").select("*");
          if (bot.avito_account_id) {
            accQuery = accQuery.eq("id", bot.avito_account_id);
          } else {
            accQuery = accQuery.eq("store_id", bot.store_id);
          }

          const { data: account } = await accQuery.single();
          if (account) {
            const token = await getAvitoToken(account.client_id, account.client_secret);
            let uid = account.avito_user_id;
            if (!uid) {
              try {
                const selfRes = await fetch(`${AVITO_API_BASE}/core/v1/accounts/self`, {
                  headers: { Authorization: `Bearer ${token}` },
                });
                if (selfRes.ok) {
                  const selfData = await selfRes.json();
                  uid = selfData.id;
                  if (uid) await supabase.from("avito_accounts").update({ avito_user_id: uid }).eq("id", account.id);
                }
              } catch {}
            }
            if (uid) {
              apiListing = await getAvitoListingInfo(token, uid, item_id);
            }
          }

          const listing = mergeListingInfo(localListing, apiListing);
          if (listing) {
            listingContext = `\n\n--- КОНТЕКСТ ТЕКУЩЕГО ОБЪЯВЛЕНИЯ (клиент спрашивает именно про этот товар) ---\nНазвание товара: ${listing.title}\nЦена: ${listing.price} ₽\nКатегория: ${listing.category}\nОписание товара:\n${listing.description}\n${listing.url ? `Ссылка: ${listing.url}\n` : ""}--- КОНЕЦ КОНТЕКСТА ОБЪЯВЛЕНИЯ ---\n\nВАЖНО: Клиент пишет тебе по поводу этого конкретного объявления. Отвечай в контексте этого товара, знай его название, цену и описание. Если спрашивают цену — называй цену из контекста.`;
          }
        } catch (e) {
          console.error("Failed to fetch listing for debug:", e);
        }
      }

      const systemPrompt = getEffectiveSystemPrompt(bot) + listingContext + qaContext;
      const proSuffix = bot.pro_seller_mode
        ? "\n\nВеди себя как профессиональный продавец. Используй техники продаж."
        : "";

      const conversationMessages: { role: string; content: string }[] = [
        { role: "system", content: systemPrompt + proSuffix },
      ];

      if (debug_session_id) {
        const { data: prevMsgs } = await supabase
          .from("avito_bot_messages")
          .select("*")
          .eq("chat_id", debug_session_id)
          .order("created_at", { ascending: true });
        if (prevMsgs) {
          for (const m of prevMsgs) {
            conversationMessages.push({ role: m.role === "assistant" ? "assistant" : "user", content: m.content });
          }
        }
      }

      conversationMessages.push({ role: "user", content: message });

      const model = bot.ai_model || "openai/gpt-4.1-mini";
      const aiResponse = await getAIResponse(conversationMessages, model, vsegptApiKey);

      if (debug_session_id) {
        await supabase.from("avito_bot_messages").insert([
          { chat_id: debug_session_id, store_id: store_id || bot.store_id, role: "user", content: message },
          { chat_id: debug_session_id, store_id: store_id || bot.store_id, role: "assistant", content: aiResponse },
        ]);
      }

      return new Response(
        JSON.stringify({ success: true, response: aiResponse }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== PROCESS MESSAGES =====
    if (action === "process_messages") {
      let botQuery = supabase.from("avito_bots").select("*");
      if (bot_id) {
        botQuery = botQuery.eq("id", bot_id);
      } else {
        botQuery = botQuery.eq("store_id", store_id);
      }
      const { data: bot, error: botErr } = await botQuery.single();

      if (botErr || !bot) throw new Error("Бот не найден. Сначала создайте и сохраните настройки бота.");
      if (!bot.is_active) throw new Error("Бот выключен. Включите бота в настройках.");

      // Check schedule
      if (!isBotWithinSchedule(bot)) {
        return new Response(
          JSON.stringify({ success: true, processed: 0, total_chats: 0, skipped_reason: "outside_schedule" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let accQuery = supabase.from("avito_accounts").select("*");
      if (bot.avito_account_id) {
        accQuery = accQuery.eq("id", bot.avito_account_id);
      } else {
        accQuery = accQuery.eq("store_id", store_id);
      }
      const { data: account, error: accErr } = await accQuery.single();

      if (accErr || !account) throw new Error("Авито аккаунт не подключён. Привяжите аккаунт к роботу.");

      const token = await getAvitoToken(account.client_id, account.client_secret);
      const userId = account.avito_user_id;
      if (!userId) throw new Error("Авито user_id не найден. Переподключите аккаунт.");

      const { data: qaItems } = await supabase
        .from("avito_bot_qa")
        .select("*")
        .eq("bot_id", bot.id)
        .eq("is_active", true);

      const qaContext = buildQAContext(qaItems || []);

      const chatsRes = await fetch(
        `${AVITO_API_BASE}/messenger/v2/accounts/${userId}/chats?unread_only=true`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!chatsRes.ok) {
        const t = await chatsRes.text();
        throw new Error(`Avito chats failed [${chatsRes.status}]: ${t}`);
      }

      const chatsData = await chatsRes.json();
      const avitoChats = chatsData.chats || [];
      let processed = 0;
      let skippedStopCommand = 0;

      const stopCommand = bot.seller_stop_command || "/stop";

      for (const chat of avitoChats) {
        try {
          const chatId = chat.id;
          const lastMsg = chat.last_message;
          const itemId = chat.context?.value?.id;

          if (!lastMsg || lastMsg.author_id === userId) continue;

          // Filter by allowed_item_ids if configured
          const allowedIds = bot.allowed_item_ids;
          if (Array.isArray(allowedIds) && allowedIds.length > 0 && itemId) {
            if (!allowedIds.includes(String(itemId))) continue;
          }

          let { data: dbChat } = await supabase
            .from("avito_bot_chats")
            .select("*")
            .eq("store_id", store_id)
            .eq("avito_chat_id", String(chatId))
            .maybeSingle();

          if (!dbChat) {
            const { data: newChat, error: chatCreateErr } = await supabase
              .from("avito_bot_chats")
              .insert({
                store_id,
                avito_chat_id: String(chatId),
                avito_user_id: String(lastMsg.author_id),
                avito_user_name: chat.users?.[0]?.name || "",
              })
              .select()
              .single();
            if (chatCreateErr) {
              console.error("Chat create error:", chatCreateErr);
              continue;
            }
            dbChat = newChat;
          }

          if (dbChat.is_escalated) continue;
          if (bot.max_responses && dbChat.bot_responses_count >= bot.max_responses) continue;

          // Fetch messages to check for seller stop command
          const msgsRes = await fetch(
            `${AVITO_API_BASE}/messenger/v3/accounts/${userId}/chats/${chatId}/messages/?limit=20`,
            { headers: { Authorization: `Bearer ${token}` } }
          );

          if (!msgsRes.ok) continue;
          const msgsData = await msgsRes.json();
          const avitoMessages = (msgsData.messages || []).reverse();

          // Check if seller sent stop command in this chat
          if (hasSellerStopCommand(avitoMessages, userId, stopCommand)) {
            // Mark as escalated so bot doesn't respond anymore
            await supabase
              .from("avito_bot_chats")
              .update({ is_escalated: true, status: "seller_takeover", updated_at: new Date().toISOString() })
              .eq("id", dbChat.id);
            skippedStopCommand++;
            console.log(`Chat ${chatId}: seller stop command detected, marking as escalated`);
            // Debug notification for stop command
            if (bot.telegram_debug_notifications && bot.telegram_bot_token && bot.telegram_chat_id) {
              const scUserName = chat.users?.[0]?.name || "—";
              await sendTelegramNotification(bot.telegram_bot_token, bot.telegram_chat_id,
                `🛠 <b>Отладка — стоп-команда</b>\n\n🛑 Бот остановлен в чате с ${scUserName}\nКоманда: <code>${stopCommand}</code>`);
            }
            continue;
          }

          let listingContext = "";
          if (itemId) {
            const localListing = await getLocalListingInfo(
              supabase,
              store_id,
              String(itemId),
              chat.context?.value?.title || chat.item?.title || ""
            );
            const apiListing = await getAvitoListingInfo(token, userId, String(itemId));
            const listing = mergeListingInfo(localListing, apiListing);

            if (listing) {
              listingContext = `\n\n--- КОНТЕКСТ ТЕКУЩЕГО ОБЪЯВЛЕНИЯ ---\nНазвание товара: ${listing.title}\nЦена: ${listing.price} ₽\nКатегория: ${listing.category}\nОписание товара:\n${listing.description}\n--- КОНЕЦ КОНТЕКСТА ---\n\nВАЖНО: Клиент пишет по поводу этого конкретного объявления. Отвечай в контексте этого товара. Если спрашивают цену — называй цену из контекста.`;
            }
          }

          const basePrompt = getEffectiveSystemPrompt(bot);
          const proSuffix = bot.pro_seller_mode
            ? "\n\nВеди себя как профессиональный продавец. Используй техники продаж, задавай уточняющие вопросы."
            : "";

          const systemPrompt = basePrompt + listingContext + qaContext + proSuffix;

          const conversationMessages: { role: string; content: string }[] = [
            { role: "system", content: systemPrompt },
          ];

          for (const msg of avitoMessages) {
            const role = String(msg.author_id) === String(userId) ? "assistant" : "user";
            const text = msg.content?.text || msg.text || "";
            if (text) {
              conversationMessages.push({ role, content: text });
            }
          }

          let model = bot.ai_model || "google/gemini-3-flash-preview";
          if (bot.upgrade_after_messages > 0 && bot.upgrade_model && dbChat.bot_responses_count >= bot.upgrade_after_messages) {
            model = bot.upgrade_model;
          }

          const aiResponse = await getAIResponse(conversationMessages, model, vsegptApiKey);
          if (!aiResponse) continue;

          // Apply response delay
          if (bot.response_delay_seconds > 0) {
            await new Promise(resolve => setTimeout(resolve, Math.min(bot.response_delay_seconds * 1000, 30000)));
          }

          const sendRes = await fetch(
            `${AVITO_API_BASE}/messenger/v1/accounts/${userId}/chats/${chatId}/messages`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                message: { text: aiResponse },
                type: "text",
              }),
            }
          );

          if (!sendRes.ok) {
            const t = await sendRes.text();
            console.error(`Failed to send message [${sendRes.status}]: ${t}`);
            continue;
          }

          await supabase.from("avito_bot_messages").insert([
            {
              chat_id: dbChat.id,
              store_id,
              role: "user",
              content: lastMsg.content?.text || lastMsg.text || "",
            },
            {
              chat_id: dbChat.id,
              store_id,
              role: "assistant",
              content: aiResponse,
            },
          ]);

          await supabase
            .from("avito_bot_chats")
            .update({
              messages_count: (dbChat.messages_count || 0) + 1,
              bot_responses_count: (dbChat.bot_responses_count || 0) + 1,
              last_message_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", dbChat.id);

          if (bot.telegram_bot_token && bot.telegram_chat_id) {
            const userName = chat.users?.[0]?.name || "Пользователь";
            const userMsg = lastMsg.content?.text || lastMsg.text || "";
            const itemId = chat.context?.value?.id;
            const itemTitle = chat.context?.value?.title || chat.item?.title || "";
            const itemUrl = itemId ? `https://www.avito.ru/${itemId}` : "";
            const isNewChat = dbChat.messages_count <= 1;
            let notifText = "";
            
            if (bot.telegram_notification_format === "detailed") {
              notifText = `💬 <b>Авито — сообщение</b>\n\n` +
                `👤 <b>Клиент:</b> ${userName}\n`;
              if (itemTitle) notifText += `📦 <b>Объявление:</b> ${itemTitle}\n`;
              if (itemUrl) notifText += `🔗 <a href="${itemUrl}">Открыть на Авито</a>\n`;
              notifText += `\n📝 <b>Сообщение:</b>\n${userMsg}\n\n` +
                `🤖 <b>Ответ бота:</b>\n${aiResponse}\n\n` +
                `📊 <b>Статистика чата:</b> ${(dbChat.messages_count || 0) + 1} сообщ. / ${(dbChat.bot_responses_count || 0) + 1} ответов бота`;
              if (isNewChat) notifText = `🆕 <b>НОВЫЙ ЧАТ</b>\n\n` + notifText;
            } else if (bot.telegram_notification_format === "full") {
              notifText = `💬 <b>Новое сообщение на Авито</b>\n\n` +
                `👤 <b>От:</b> ${userName}\n`;
              if (itemTitle) notifText += `📦 <b>Объявление:</b> ${itemTitle}\n`;
              if (itemUrl) notifText += `🔗 <a href="${itemUrl}">Открыть на Авито</a>\n`;
              notifText += `\n📝 <b>Сообщение:</b> ${userMsg}\n\n` +
                `🤖 <b>Ответ бота:</b> ${aiResponse}`;
            } else {
              notifText = `💬 Новое сообщение от ${userName}`;
              if (itemTitle) notifText += ` (${itemTitle})`;
              notifText += `:\n"${userMsg.substring(0, 100)}${userMsg.length > 100 ? '...' : ''}"`;
              if (itemUrl) notifText += `\n🔗 ${itemUrl}`;
            }
            
            await sendTelegramNotification(bot.telegram_bot_token, bot.telegram_chat_id, notifText);

            // New chat notification
            if (isNewChat && bot.telegram_new_chat_notifications !== false) {
              // Already included in detailed format above, skip duplicate
              if (bot.telegram_notification_format !== "detailed") {
                const newChatMsg = `🆕 <b>Новый чат на Авито!</b>\n\n👤 ${userName}` +
                  (itemTitle ? `\n📦 ${itemTitle}` : "") +
                  (itemUrl ? `\n🔗 <a href="${itemUrl}">Открыть</a>` : "");
                await sendTelegramNotification(bot.telegram_bot_token, bot.telegram_chat_id, newChatMsg);
              }
            }
          }

          processed++;
        } catch (chatErr: any) {
          console.error("Error processing chat:", chatErr);
          // Debug notification
          if (bot.telegram_debug_notifications && bot.telegram_bot_token && bot.telegram_chat_id) {
            await sendTelegramNotification(bot.telegram_bot_token, bot.telegram_chat_id,
              `🛠 <b>Отладка — ошибка</b>\n\n❌ Ошибка при обработке чата:\n<code>${(chatErr.message || String(chatErr)).substring(0, 200)}</code>`);
          }
        }
      }

      // Debug summary notification
      if (bot.telegram_debug_notifications && bot.telegram_bot_token && bot.telegram_chat_id) {
        const debugMsg = `🛠 <b>Отладка — итог обработки</b>\n\n` +
          `🤖 Бот: ${bot.name}\n` +
          `📨 Всего чатов: ${avitoChats.length}\n` +
          `✅ Обработано: ${processed}\n` +
          `🛑 Стоп-команд: ${skippedStopCommand}\n` +
          `🕐 ${new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })}`;
        await sendTelegramNotification(bot.telegram_bot_token, bot.telegram_chat_id, debugMsg);
      }

      return new Response(
        JSON.stringify({ success: true, processed, total_chats: avitoChats.length, skipped_stop_command: skippedStopCommand }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== AUTO PROCESS ALL (called by cron) =====
    if (action === "auto_process_all") {
      const { data: allBots, error: botsErr } = await supabase
        .from("avito_bots")
        .select("id, store_id, is_active, schedule_mode, schedule_config, avito_account_id")
        .eq("is_active", true);

      if (botsErr || !allBots?.length) {
        return new Response(
          JSON.stringify({ success: true, processed_bots: 0, message: "No active bots" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const results: any[] = [];
      for (const b of allBots) {
        if (!isBotWithinSchedule(b)) {
          results.push({ bot_id: b.id, skipped: "outside_schedule" });
          continue;
        }
        if (!b.avito_account_id) {
          results.push({ bot_id: b.id, skipped: "no_account" });
          continue;
        }

        // Check AI access
        const { data: aiAccess } = await supabase
          .from("store_ai_access")
          .select("is_unlocked, avito_bot_enabled")
          .eq("store_id", b.store_id)
          .maybeSingle();

        if (!aiAccess?.is_unlocked || !aiAccess?.avito_bot_enabled) {
          results.push({ bot_id: b.id, skipped: "ai_disabled" });
          continue;
        }

        try {
          // Recursively call process_messages for this bot
          const processReq = new Request(req.url, {
            method: "POST",
            headers: req.headers,
            body: JSON.stringify({ action: "process_messages", store_id: b.store_id, bot_id: b.id }),
          });
          // Instead of recursive call, inline a simplified fetch to self
          const url = `${supabaseUrl}/functions/v1/avito-bot`;
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({ action: "process_messages", store_id: b.store_id, bot_id: b.id }),
          });
          const data = await res.json();
          results.push({ bot_id: b.id, ...data });
        } catch (err: any) {
          results.push({ bot_id: b.id, error: err.message });
        }
      }

      return new Response(
        JSON.stringify({ success: true, processed_bots: allBots.length, results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Avito bot error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
