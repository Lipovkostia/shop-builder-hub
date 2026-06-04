import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BUCKET = "ai-history";
const SUBS_PREFIX = "_telegram_subscribers";

function tg(token: string, method: string, body?: unknown) {
  return fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

interface Subscriber {
  chat_id: number;
  tg_user_id?: number;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  language_code?: string | null;
  joined_at: string;
  last_seen_at: string;
}

async function loadSubscriber(
  admin: ReturnType<typeof createClient>,
  storeId: string,
  chatId: number
): Promise<Subscriber | null> {
  const path = `${SUBS_PREFIX}/${storeId}/${chatId}.json`;
  const { data } = await admin.storage.from(BUCKET).download(path);
  if (!data) return null;
  try {
    return JSON.parse(await data.text()) as Subscriber;
  } catch {
    return null;
  }
}

async function saveSubscriber(
  admin: ReturnType<typeof createClient>,
  storeId: string,
  sub: Subscriber
) {
  const path = `${SUBS_PREFIX}/${storeId}/${sub.chat_id}.json`;
  const blob = new Blob([JSON.stringify(sub)], { type: "application/json" });
  await admin.storage.from(BUCKET).upload(path, blob, {
    upsert: true,
    contentType: "application/json",
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
    if (!msg) return new Response("OK");
    const chatId = msg.chat.id as number;
    const from = msg.from || {};
    const nowIso = new Date().toISOString();

    // Always upsert subscriber info from incoming message
    const existing = await loadSubscriber(admin, storeId, chatId);
    const subBase: Subscriber = {
      chat_id: chatId,
      tg_user_id: from.id,
      username: from.username ?? existing?.username ?? null,
      first_name: from.first_name ?? existing?.first_name ?? null,
      last_name: from.last_name ?? existing?.last_name ?? null,
      phone: existing?.phone ?? null,
      language_code: from.language_code ?? existing?.language_code ?? null,
      joined_at: existing?.joined_at ?? nowIso,
      last_seen_at: nowIso,
    };

    // Contact shared
    if (msg.contact?.phone_number) {
      subBase.phone = String(msg.contact.phone_number).replace(/[^\d+]/g, "");
      await saveSubscriber(admin, storeId, subBase);

      await tg(cfg.bot_token, "sendMessage", {
        chat_id: chatId,
        text: "✅ Спасибо! Ваш номер сохранён.",
        reply_markup: { remove_keyboard: true },
      });
      await tg(cfg.bot_token, "sendMessage", {
        chat_id: chatId,
        text: "Откройте каталог по кнопке ниже 👇",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🛒 Открыть магазин", web_app: { url: cfg.webapp_url } }],
          ],
        },
      });
      return new Response("OK");
    }

    const text = (msg.text as string | undefined)?.trim() ?? "";

    if (text.startsWith("/start") || text === "/shop") {
      await saveSubscriber(admin, storeId, subBase);

      const { data: store } = await admin
        .from("stores")
        .select("name")
        .eq("id", storeId)
        .maybeSingle();

      const greeting =
        cfg.welcome_message ||
        `👋 Добро пожаловать в *${store?.name || "магазин"}*!`;

      // If we don't yet have the phone — ask for contact first
      if (!subBase.phone) {
        await tg(cfg.bot_token, "sendMessage", {
          chat_id: chatId,
          text:
            `${greeting}\n\nЧтобы оформлять заказы быстрее, поделитесь номером телефона — нажмите кнопку ниже.`,
          parse_mode: "Markdown",
          reply_markup: {
            keyboard: [
              [{ text: "📱 Поделиться номером", request_contact: true }],
            ],
            resize_keyboard: true,
            one_time_keyboard: true,
          },
        });
        await tg(cfg.bot_token, "sendMessage", {
          chat_id: chatId,
          text: "Или сразу откройте каталог:",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🛒 Открыть магазин", web_app: { url: cfg.webapp_url } }],
            ],
          },
        });
      } else {
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
      }
    } else {
      await saveSubscriber(admin, storeId, subBase);
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
    return new Response("OK");
  }
});
