import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// Published storefront origin used to build the WebApp URL.
const PUBLIC_ORIGIN = "https://shopify-on-sub.lovable.app";

function tg(token: string, method: string, body?: unknown) {
  return fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  }).then((r) => r.json());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");
    if (!jwt) {
      return json({ error: "Unauthorized" }, 401);
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    const user = userRes?.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const body = await req.json().catch(() => ({}));
    const { storeId, action, botToken, welcomeMessage, enabled } = body as {
      storeId?: string;
      action?: string;
      botToken?: string;
      welcomeMessage?: string;
      enabled?: boolean;
    };

    if (!storeId) return json({ error: "storeId required" }, 400);

    // Ownership check
    const { data: store } = await admin
      .from("stores")
      .select("id, subdomain, name, owner_id, profiles:owner_id(user_id)")
      .eq("id", storeId)
      .maybeSingle();
    if (!store) return json({ error: "Store not found" }, 404);
    const ownerUserId = (store as any).profiles?.user_id;
    if (ownerUserId !== user.id) return json({ error: "Forbidden" }, 403);

    const subdomain = (store as any).subdomain as string;
    const webappUrl = `${PUBLIC_ORIGIN}/retail/${subdomain}`;

    if (action === "save") {
      if (!botToken || !/^\d+:[\w-]+$/.test(botToken)) {
        return json({ error: "Некорректный токен бота" }, 400);
      }

      // Validate token
      const meRes = await tg(botToken, "getMe");
      if (!meRes.ok) {
        return json({ error: meRes.description || "Не удалось проверить токен" }, 400);
      }
      const botUsername = meRes.result.username as string;
      const botId = meRes.result.id as number;

      // Upsert row (get / generate webhook_secret)
      const { data: existing } = await admin
        .from("store_telegram_bots")
        .select("webhook_secret")
        .eq("store_id", storeId)
        .maybeSingle();

      const webhookSecret =
        existing?.webhook_secret ||
        crypto.getRandomValues(new Uint8Array(24)).reduce(
          (acc, b) => acc + b.toString(16).padStart(2, "0"),
          ""
        );

      const webhookUrl = `${SUPABASE_URL}/functions/v1/store-telegram-webhook?store=${storeId}`;
      const hookRes = await tg(botToken, "setWebhook", {
        url: webhookUrl,
        secret_token: webhookSecret,
        allowed_updates: ["message", "callback_query"],
        drop_pending_updates: true,
      });
      if (!hookRes.ok) {
        return json({ error: "setWebhook: " + (hookRes.description || "ошибка") }, 400);
      }

      // Set the persistent chat menu button to open WebApp
      await tg(botToken, "setChatMenuButton", {
        menu_button: {
          type: "web_app",
          text: "🛒 Открыть магазин",
          web_app: { url: webappUrl },
        },
      });

      await tg(botToken, "setMyCommands", {
        commands: [
          { command: "start", description: "Открыть магазин" },
          { command: "shop", description: "Каталог товаров" },
        ],
      });

      const { error: upErr } = await admin
        .from("store_telegram_bots")
        .upsert(
          {
            store_id: storeId,
            bot_token: botToken,
            bot_username: botUsername,
            bot_id: botId,
            webhook_secret: webhookSecret,
            webhook_set: true,
            enabled: enabled ?? true,
            welcome_message: welcomeMessage ?? null,
            webapp_url: webappUrl,
            last_error: null,
          },
          { onConflict: "store_id" }
        );
      if (upErr) return json({ error: upErr.message }, 500);

      return json({ ok: true, bot_username: botUsername, webapp_url: webappUrl });
    }

    if (action === "delete") {
      const { data: row } = await admin
        .from("store_telegram_bots")
        .select("bot_token")
        .eq("store_id", storeId)
        .maybeSingle();
      if (row?.bot_token) {
        await tg(row.bot_token, "deleteWebhook", { drop_pending_updates: true });
      }
      await admin.from("store_telegram_bots").delete().eq("store_id", storeId);
      return json({ ok: true });
    }

    if (action === "update") {
      const { error } = await admin
        .from("store_telegram_bots")
        .update({
          welcome_message: welcomeMessage ?? null,
          enabled: enabled ?? true,
        })
        .eq("store_id", storeId);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
