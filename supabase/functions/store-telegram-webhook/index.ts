import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function tg(token: string, method: string, body?: unknown) {
  return fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("OK");
  try {
    const url = new URL(req.url);
    const storeId = url.searchParams.get("store");
    if (!storeId) return new Response("missing store", { status: 400 });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: cfg } = await admin
      .from("store_telegram_bots")
      .select("bot_token, webhook_secret, webapp_url, welcome_message, enabled")
      .eq("store_id", storeId)
      .maybeSingle();

    if (!cfg || !cfg.enabled) return new Response("disabled", { status: 200 });

    const provided = req.headers.get("X-Telegram-Bot-Api-Secret-Token");
    if (provided !== cfg.webhook_secret) {
      return new Response("unauthorized", { status: 401 });
    }

    const update = await req.json().catch(() => ({} as any));
    const msg = update.message;
    if (!msg?.text) return new Response("OK");
    const chatId = msg.chat.id;
    const text = (msg.text as string).trim();

    if (text.startsWith("/start") || text === "/shop") {
      const { data: store } = await admin
        .from("stores")
        .select("name")
        .eq("id", storeId)
        .maybeSingle();

      const greeting =
        cfg.welcome_message ||
        `👋 Добро пожаловать в *${store?.name || "магазин"}*!\n\nНажмите кнопку ниже, чтобы открыть каталог товаров.`;

      await tg(cfg.bot_token, "sendMessage", {
        chat_id: chatId,
        text: greeting,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🛒 Открыть магазин", web_app: { url: cfg.webapp_url } }],
          ],
        },
      });
    } else {
      await tg(cfg.bot_token, "sendMessage", {
        chat_id: chatId,
        text: "Используйте кнопку ниже или /start, чтобы открыть магазин 🛒",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🛒 Открыть магазин", web_app: { url: cfg.webapp_url } }],
          ],
        },
      });
    }

    return new Response("OK");
  } catch (e) {
    console.error("webhook error:", e);
    return new Response("OK"); // always 200 to Telegram
  }
});
