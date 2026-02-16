import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_WELCOME_BOT_TOKEN");

  try {
    if (!TELEGRAM_BOT_TOKEN) {
      console.error("TELEGRAM_WELCOME_BOT_TOKEN is not configured");
      return new Response(JSON.stringify({ ok: false, error: "Welcome bot token not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return new Response("OK", { status: 200 });
    }

    // Get bot info (verify token)
    if (body.action === "getme") {
      const response = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`
      );
      const result = await response.json();
      console.log("Welcome bot getMe result:", JSON.stringify(result));
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get webhook info
    if (body.action === "info") {
      const response = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`
      );
      const result = await response.json();
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Setup webhook
    if (body.action === "setup") {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const webhookUrl = `${supabaseUrl}/functions/v1/telegram-welcome-bot`;
      console.log("Setting up welcome bot webhook:", webhookUrl);

      const response = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook?url=${encodeURIComponent(webhookUrl)}`
      );
      const result = await response.json();
      console.log("Welcome bot webhook setup result:", result);

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle Telegram update
    const update = body;
    console.log("Welcome bot received update:", JSON.stringify(update));

    const message = update.message;
    if (!message) {
      return new Response("OK", { status: 200 });
    }

    const chatId = message.chat.id.toString();
    const text = message.text || "";

    // Send welcome message on /start or any first interaction
    if (text === "/start" || text.startsWith("/start")) {
      await sendTgMsg(
        TELEGRAM_BOT_TOKEN,
        chatId,
        "👋 Добро пожаловать!\n\nПроходите на торговую площадку https://9999999999.ru/\n\nПродавайте и покупайте товары оптом и в розницу."
      );
    }

    return new Response("OK", { status: 200 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Error processing welcome bot webhook:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function sendTgMsg(token: string, chatId: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    const result = await res.json();
    if (!result.ok) {
      console.error("Telegram API error:", result);
      return false;
    }
    return true;
  } catch (e) {
    console.error("Error sending Telegram message:", e);
    return false;
  }
}
