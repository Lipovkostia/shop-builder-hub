import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Send Telegram notification
async function sendTelegramNotification(chatId: string, text: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.log("TELEGRAM_BOT_TOKEN is not configured, skipping Telegram notification");
    return false;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
        }),
      }
    );

    const result = await response.json();
    if (!result.ok) {
      console.error("Telegram API error:", result);
      return false;
    }
    console.log("Telegram notification sent successfully");
    return true;
  } catch (error) {
    console.error("Error sending Telegram notification:", error);
    return false;
  }
}

// Format order text (identical to copy order TXT format)
function formatOrderText(order: any, items: any[], customerName: string | null): string {
  const date = new Date(order.created_at);
  const dateStr = date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const timeStr = date.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const statusLabels: Record<string, string> = {
    pending: "Новый",
    processing: "В обработке",
    shipped: "Отправлен",
    delivered: "Доставлен",
    cancelled: "Отменён",
  };

  let text = `📦 ЗАКАЗ ${order.order_number}\n`;
  text += `📅 ${dateStr} в ${timeStr}\n`;
  text += `📍 Статус: ${statusLabels[order.status] || order.status}\n`;

  if (customerName) {
    text += `👤 Клиент: ${customerName}\n`;
  }

  text += `─────────────────────\n\n`;
  text += `🛒 ТОВАРЫ:\n\n`;

  items.forEach((item, index) => {
    text += `${index + 1}. ${item.product_name}\n`;
    text += `   ${item.quantity} × ${Number(item.price).toLocaleString("ru-RU")} ₽ = ${Number(item.total).toLocaleString("ru-RU")} ₽\n\n`;
  });

  text += `─────────────────────\n`;
  text += `📊 ИТОГО: ${items.length} поз.\n`;
  text += `💰 СУММА: ${Number(order.total).toLocaleString("ru-RU")} ₽\n`;

  // Shipping address if present
  const shippingAddress = order.shipping_address;
  if (shippingAddress && typeof shippingAddress === "object") {
    text += `\n─────────────────────\n`;
    text += `📬 ДОСТАВКА:\n`;
    if (shippingAddress.name) text += `👤 ${shippingAddress.name}\n`;
    if (shippingAddress.phone) text += `📱 ${shippingAddress.phone}\n`;
    if (shippingAddress.address) text += `🏠 ${shippingAddress.address}\n`;
    if (shippingAddress.comment) text += `💬 ${shippingAddress.comment}\n`;
  }

  return text;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const { orderId } = await req.json();
    if (!orderId) {
      throw new Error("orderId is required");
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      throw new Error(`Order not found: ${orderError?.message || "Unknown error"}`);
    }

    // Fetch order items
    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", orderId);

    if (itemsError) {
      throw new Error(`Failed to fetch order items: ${itemsError.message}`);
    }

    // Fetch notification settings for the store
    const { data: settings, error: settingsError } = await supabase
      .from("store_notification_settings")
      .select("*")
      .eq("store_id", order.store_id)
      .single();

    if (settingsError && settingsError.code !== "PGRST116") {
      console.error("Error fetching notification settings:", settingsError);
    }

    // Check if any notifications are enabled
    const emailEnabled = settings?.email_enabled && settings?.notification_email;
    const telegramEnabled = settings?.telegram_enabled && settings?.notification_telegram;

    if (!emailEnabled && !telegramEnabled) {
      console.log("No notifications are enabled for this store");
      return new Response(
        JSON.stringify({ success: true, message: "No notifications enabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get customer name if available
    let customerName: string | null = null;
    if (order.customer_id) {
      const { data: storeCustomer } = await supabase
        .from("store_customers")
        .select("profile_id")
        .eq("id", order.customer_id)
        .single();

      if (storeCustomer) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", storeCustomer.profile_id)
          .single();

        customerName = profile?.full_name || null;
      }
    }

    // Format the order text
    const orderText = formatOrderText(order, items || [], customerName);

    let emailId = null;
    let telegramSent = false;

    // Send email via Resend REST API (if enabled)
    if (emailEnabled && RESEND_API_KEY) {
      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "Заказы <onboarding@resend.dev>",
          to: [settings.notification_email],
          subject: `📦 Новый заказ ${order.order_number}`,
          text: orderText,
          html: `<pre style="font-family: 'SF Mono', Monaco, 'Courier New', monospace; font-size: 14px; line-height: 1.6; white-space: pre-wrap; background-color: #f8f9fa; padding: 20px; border-radius: 8px;">${orderText}</pre>`,
        }),
      });

      const emailResult = await emailResponse.json();

      if (!emailResponse.ok) {
        console.error("Resend error:", emailResult);
      } else {
        console.log("Email sent successfully:", emailResult);
        emailId = emailResult.id;
      }
    }

    // Send Telegram notification (if enabled)
    if (telegramEnabled) {
      telegramSent = await sendTelegramNotification(
        settings.notification_telegram,
        orderText
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailId, 
        telegramSent 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-order-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
