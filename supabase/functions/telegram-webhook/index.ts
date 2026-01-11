import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!TELEGRAM_BOT_TOKEN) {
      console.error("TELEGRAM_BOT_TOKEN is not configured");
      return new Response("Bot token not configured", { status: 500 });
    }

    const update = await req.json();
    console.log("Received Telegram update:", JSON.stringify(update));

    // Process /start command with store_id parameter
    const message = update.message;
    if (!message?.text) {
      return new Response("OK", { status: 200 });
    }

    const text = message.text;
    const chatId = message.chat.id.toString();

    // Check for /start command with store_id parameter
    if (text.startsWith("/start ")) {
      const storeId = text.split(" ")[1];
      
      if (!storeId) {
        await sendTelegramMessage(chatId, "❌ Ошибка: не указан ID магазина.");
        return new Response("OK", { status: 200 });
      }

      // Create Supabase client with service role
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Verify store exists
      const { data: store, error: storeError } = await supabase
        .from("stores")
        .select("id, name")
        .eq("id", storeId)
        .single();

      if (storeError || !store) {
        console.error("Store not found:", storeError);
        await sendTelegramMessage(chatId, "❌ Магазин не найден. Проверьте ссылку.");
        return new Response("OK", { status: 200 });
      }

      // Save chat_id to notification settings
      const { error: upsertError } = await supabase
        .from("store_notification_settings")
        .upsert(
          {
            store_id: storeId,
            notification_telegram: chatId,
            telegram_enabled: true,
          },
          { onConflict: "store_id" }
        );

      if (upsertError) {
        console.error("Error saving notification settings:", upsertError);
        await sendTelegramMessage(chatId, "❌ Ошибка сохранения настроек. Попробуйте позже.");
        return new Response("OK", { status: 200 });
      }

      // Send success confirmation
      await sendTelegramMessage(
        chatId,
        `✅ Бот успешно подключен к магазину "${store.name}"!\n\nТеперь вы будете получать уведомления о новых заказах.`
      );

      console.log(`Successfully connected Telegram for store ${storeId}, chat ${chatId}`);
    } else if (text === "/start") {
      // Just /start without parameter
      await sendTelegramMessage(
        chatId,
        "👋 Привет! Этот бот отправляет уведомления о новых заказах.\n\n" +
        "Чтобы подключить бота, перейдите в настройки вашего магазина и нажмите кнопку «Подключить Telegram»."
      );
    }

    return new Response("OK", { status: 200 });
  } catch (error: any) {
    console.error("Error processing webhook:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function sendTelegramMessage(chatId: string, text: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: "HTML",
        }),
      }
    );

    const result = await response.json();
    if (!result.ok) {
      console.error("Telegram API error:", result);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Error sending Telegram message:", error);
    return false;
  }
}
