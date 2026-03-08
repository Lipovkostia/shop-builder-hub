// Avito Bot Edge Function v2
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
    if (!res.ok) return null;
    const data = await res.json();
    return {
      title: data.title || "",
      description: data.description || data.body || "",
      price: data.price || 0,
      category: data.category?.name || "",
      url: data.url || "",
    };
  } catch {
    return null;
  }
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

    // Check AI access for this store (skip for non-AI actions like fetch_models)
    if (store_id && action !== "fetch_models") {
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
      // Filter to chat models only
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
      
      // Auto-fetch user_id if missing
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

      // Get Q&A items
      const { data: qaItems } = await supabase
        .from("avito_bot_qa")
        .select("*")
        .eq("bot_id", bot_id)
        .eq("is_active", true);

      const qaContext = buildQAContext(qaItems || []);

      // If item_id is provided, fetch listing context
      let listingContext = "";
      if (item_id) {
        try {
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
              const listing = await getAvitoListingInfo(token, uid, item_id);
              if (listing) {
                listingContext = `\n\n--- КОНТЕКСТ ТЕКУЩЕГО ОБЪЯВЛЕНИЯ (клиент спрашивает именно про этот товар) ---\nНазвание товара: ${listing.title}\nЦена: ${listing.price} ₽\nКатегория: ${listing.category}\nОписание товара:\n${listing.description}\nСсылка: ${listing.url}\n--- КОНЕЦ КОНТЕКСТА ОБЪЯВЛЕНИЯ ---\n\nВАЖНО: Клиент пишет тебе по поводу этого конкретного объявления. Отвечай в контексте этого товара, знай его название, цену и описание. Если спрашивают цену — называй цену из контекста.`;
              }
            }
          }
        } catch (e) {
          console.error("Failed to fetch listing for debug:", e);
        }
      }

      const systemPrompt = (bot.system_prompt || "Ты — помощник продавца на Авито.") + listingContext + qaContext;
      const proSuffix = bot.pro_seller_mode
        ? "\n\nВеди себя как профессиональный продавец. Используй техники продаж."
        : "";

      // Build conversation from debug session history
      const conversationMessages: { role: string; content: string }[] = [
        { role: "system", content: systemPrompt + proSuffix },
      ];

      // If debug_session_id provided, load previous messages
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

      // Save debug messages to DB if session exists
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
      // 1. Get bot config
      let botQuery = supabase.from("avito_bots").select("*");
      if (bot_id) {
        botQuery = botQuery.eq("id", bot_id);
      } else {
        botQuery = botQuery.eq("store_id", store_id);
      }
      const { data: bot, error: botErr } = await botQuery.single();

      if (botErr || !bot) throw new Error("Бот не найден. Сначала создайте и сохраните настройки бота.");
      if (!bot.is_active) throw new Error("Бот выключен. Включите бота в настройках.");

      // 2. Get Avito credentials
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

      // 3. Get Q&A items for this bot
      const { data: qaItems } = await supabase
        .from("avito_bot_qa")
        .select("*")
        .eq("bot_id", bot.id)
        .eq("is_active", true);

      const qaContext = buildQAContext(qaItems || []);

      // 4. Fetch chats from Avito
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

      // 5. Process each chat with unread messages
      for (const chat of avitoChats) {
        try {
          const chatId = chat.id;
          const lastMsg = chat.last_message;
          const itemId = chat.context?.value?.id;

          if (!lastMsg || lastMsg.author_id === userId) continue;

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

          let listingContext = "";
          if (itemId) {
            const listing = await getAvitoListingInfo(token, userId, String(itemId));
            if (listing) {
              listingContext = `\n\n--- КОНТЕКСТ ТЕКУЩЕГО ОБЪЯВЛЕНИЯ ---\nНазвание товара: ${listing.title}\nЦена: ${listing.price} ₽\nКатегория: ${listing.category}\nОписание товара:\n${listing.description}\n--- КОНЕЦ КОНТЕКСТА ---\n\nВАЖНО: Клиент пишет по поводу этого конкретного объявления. Отвечай в контексте этого товара. Если спрашивают цену — называй цену из контекста.`;
            }
          }

          const msgsRes = await fetch(
            `${AVITO_API_BASE}/messenger/v3/accounts/${userId}/chats/${chatId}/messages/?limit=20`,
            { headers: { Authorization: `Bearer ${token}` } }
          );

          if (!msgsRes.ok) continue;
          const msgsData = await msgsRes.json();
          const avitoMessages = (msgsData.messages || []).reverse();

          const basePrompt = bot.system_prompt || "Ты — помощник продавца на Авито. Отвечай вежливо и помогай с вопросами о товарах.";
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
            let notifText = "";
            
            if (bot.telegram_notification_format === "full") {
              notifText = `💬 <b>Новое сообщение на Авито</b>\n\n` +
                `👤 <b>От:</b> ${userName}\n` +
                `📝 <b>Сообщение:</b> ${userMsg}\n\n` +
                `🤖 <b>Ответ бота:</b> ${aiResponse}`;
            } else {
              notifText = `💬 Новое сообщение от ${userName}:\n"${userMsg.substring(0, 100)}${userMsg.length > 100 ? '...' : ''}"`;
            }
            
            await sendTelegramNotification(bot.telegram_bot_token, bot.telegram_chat_id, notifText);
          }

          processed++;
        } catch (chatErr) {
          console.error("Error processing chat:", chatErr);
        }
      }

      return new Response(
        JSON.stringify({ success: true, processed, total_chats: avitoChats.length }),
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
