import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  unit: string;
  moyskladId?: string;
}

interface CreateWholesaleOrderRequest {
  storeId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerComment?: string | null;
  items: OrderItem[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: CreateWholesaleOrderRequest = await req.json();
    const { storeId, customerName, customerPhone, customerAddress, customerComment, items } = body;

    // Validate required fields
    if (!storeId) {
      throw new Error("storeId is required");
    }
    if (!customerName?.trim()) {
      throw new Error("customerName is required");
    }
    if (!customerPhone?.trim()) {
      throw new Error("customerPhone is required");
    }
    if (!customerAddress?.trim()) {
      throw new Error("customerAddress is required");
    }
    if (!items || items.length === 0) {
      throw new Error("items are required");
    }

    // Create Supabase client with service role to bypass RLS
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate store exists and wholesale is enabled
    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id, name, wholesale_enabled, wholesale_min_order_amount")
      .eq("id", storeId)
      .single();

    if (storeError || !store) {
      throw new Error("Store not found");
    }

    if (!store.wholesale_enabled) {
      throw new Error("Wholesale is not enabled for this store");
    }

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const total = subtotal;

    // Check minimum order amount
    const minAmount = store.wholesale_min_order_amount || 0;
    if (total < minAmount) {
      throw new Error(`Минимальная сумма заказа: ${minAmount} ₽`);
    }

    // Generate unique order number with W prefix for wholesale
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    const orderNumber = `W${timestamp}${random}`;

    // Create the order with wholesale-specific shipping_address structure
    const shippingAddress = {
      name: customerName.trim(),
      phone: customerPhone.trim(),
      address: customerAddress.trim(),
      comment: customerComment?.trim() || null,
      source: "wholesale", // Important: marks this as a wholesale order
    };

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        order_number: orderNumber,
        store_id: storeId,
        customer_id: null,
        guest_name: customerName.trim(),
        guest_phone: customerPhone.trim(),
        is_guest_order: true,
        shipping_address: shippingAddress,
        notes: customerComment?.trim() || null,
        subtotal,
        total,
        status: "pending",
      })
      .select()
      .single();

    if (orderError) {
      console.error("Error creating order:", orderError);
      throw new Error(`Failed to create order: ${orderError.message}`);
    }

    // Create order items
    const orderItems = items.map(item => ({
      order_id: order.id,
      product_id: item.productId || null,
      product_name: item.productName,
      quantity: item.quantity,
      price: item.price,
      total: item.price * item.quantity,
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItems);

    if (itemsError) {
      console.error("Error creating order items:", itemsError);
      // Try to delete the order if items failed
      await supabase.from("orders").delete().eq("id", order.id);
      throw new Error(`Failed to create order items: ${itemsError.message}`);
    }

    // Try to sync with MoySklad if enabled
    let moyskladOrderId: string | null = null;
    try {
      const { data: syncSettings } = await supabase
        .from("store_sync_settings")
        .select("sync_orders_enabled, moysklad_organization_id, moysklad_counterparty_id")
        .eq("store_id", storeId)
        .maybeSingle();

      if (
        syncSettings?.sync_orders_enabled &&
        syncSettings?.moysklad_organization_id &&
        syncSettings?.moysklad_counterparty_id
      ) {
        // Get MoySklad account credentials
        const { data: moyskladAccount } = await supabase
          .from("moysklad_accounts")
          .select("login, password")
          .eq("store_id", storeId)
          .limit(1)
          .maybeSingle();

        if (moyskladAccount) {
          // Prepare positions - include all items with moysklad_id
          const moyskladPositions = items
            .filter(item => item.moyskladId)
            .map(item => ({
              moysklad_id: item.moyskladId!,
              product_name: item.productName,
              quantity: item.quantity,
              price: Math.round(item.price * 100), // Convert to kopecks
            }));

          if (moyskladPositions.length > 0) {
            // Build order comment from shipping address
            let orderComment = `Оптовый заказ ${orderNumber}\n`;
            if (customerName) orderComment += `Клиент: ${customerName}\n`;
            if (customerPhone) orderComment += `Телефон: ${customerPhone}\n`;
            if (customerAddress) orderComment += `Адрес: ${customerAddress}\n`;
            if (customerComment) orderComment += `Комментарий: ${customerComment}`;

            const moyskladResult = await supabase.functions.invoke("moysklad", {
              body: {
                action: "create_customerorder",
                login: moyskladAccount.login,
                password: moyskladAccount.password,
                order: {
                  name: orderNumber,
                  description: orderComment.trim(),
                  organization_id: syncSettings.moysklad_organization_id,
                  counterparty_id: syncSettings.moysklad_counterparty_id,
                  positions: moyskladPositions,
                },
              },
            });

            if (moyskladResult.data?.order?.id) {
              moyskladOrderId = moyskladResult.data.order.id;
              // Save MoySklad order ID
              await supabase
                .from("orders")
                .update({ moysklad_order_id: moyskladOrderId })
                .eq("id", order.id);
              
              console.log("Order synced to MoySklad:", moyskladOrderId);
            }
          }
        }
      }
    } catch (moyskladError) {
      console.error("Failed to sync order to MoySklad (non-critical):", moyskladError);
      // Don't fail the order creation if MoySklad sync fails
    }

    // Send notification to store owner (non-blocking)
    try {
      const notificationUrl = `${supabaseUrl}/functions/v1/send-order-notification`;
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
      
      await fetch(notificationUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${anonKey}`,
        },
        body: JSON.stringify({ orderId: order.id }),
      });
      
      console.log("Notification request sent for wholesale order:", orderNumber);
    } catch (notifyErr) {
      console.error("Failed to send notification (non-critical):", notifyErr);
    }

    console.log("Wholesale order created successfully:", {
      orderNumber,
      storeId,
      customerName: customerName.trim(),
      itemsCount: items.length,
      total,
      moyskladOrderId,
    });

    return new Response(
      JSON.stringify({
        success: true,
        orderNumber,
        orderId: order.id,
        total,
        moyskladOrderId,
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  } catch (error: any) {
    console.error("Error in create-wholesale-order:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
