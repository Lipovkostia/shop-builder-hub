import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Check if email notifications are enabled
    if (!settings?.email_enabled || !settings?.notification_email) {
      console.log("Email notifications are not enabled for this store");
      return new Response(
        JSON.stringify({ success: true, message: "Email notifications not enabled" }),
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

    // Send email via Resend REST API
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
      throw new Error(`Failed to send email: ${emailResult.message || "Unknown error"}`);
    }

    console.log("Email sent successfully:", emailResult);

    return new Response(
      JSON.stringify({ success: true, emailId: emailResult.id }),
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
