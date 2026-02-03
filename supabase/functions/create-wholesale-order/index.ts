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
}

interface CreateWholesaleOrderRequest {
  storeId: string;
  companyName?: string | null;
  contactName: string;
  phone: string;
  email?: string | null;
  comment?: string | null;
  items: OrderItem[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: CreateWholesaleOrderRequest = await req.json();
    const { storeId, companyName, contactName, phone, email, comment, items } = body;

    // Validate required fields
    if (!storeId) {
      throw new Error("storeId is required");
    }
    if (!contactName?.trim()) {
      throw new Error("contactName is required");
    }
    if (!phone?.trim()) {
      throw new Error("phone is required");
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
    if (store.wholesale_min_order_amount && total < store.wholesale_min_order_amount) {
      throw new Error(`Minimum order amount is ${store.wholesale_min_order_amount} RUB. Current total: ${total} RUB`);
    }

    // Generate unique order number with W prefix for wholesale
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    const orderNumber = `W${timestamp}${random}`;

    // Create the order with wholesale-specific shipping_address structure
    const shippingAddress = {
      companyName: companyName?.trim() || null,
      contactName: contactName.trim(),
      phone: phone.trim(),
      email: email?.trim() || null,
      comment: comment?.trim() || null,
      source: "wholesale", // Important: marks this as a wholesale order
    };

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        order_number: orderNumber,
        store_id: storeId,
        customer_id: null,
        guest_name: contactName.trim(),
        guest_phone: phone.trim(),
        is_guest_order: true,
        shipping_address: shippingAddress,
        notes: comment?.trim() || null,
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
      companyName: companyName?.trim() || null,
      contactName: contactName.trim(),
      itemsCount: items.length,
      total,
    });

    return new Response(
      JSON.stringify({
        success: true,
        orderNumber,
        orderId: order.id,
        total,
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
