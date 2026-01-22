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

interface CreateRetailOrderRequest {
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
    const body: CreateRetailOrderRequest = await req.json();
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

    // Validate store exists and retail is enabled
    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id, name, retail_enabled")
      .eq("id", storeId)
      .single();

    if (storeError || !store) {
      throw new Error("Store not found");
    }

    if (!store.retail_enabled) {
      throw new Error("Retail is not enabled for this store");
    }

    // Generate unique order number with R prefix for retail
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    const orderNumber = `R${timestamp}${random}`;

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const total = subtotal;

    // Create the order with retail-specific shipping_address structure
    const shippingAddress = {
      name: customerName.trim(),
      phone: customerPhone.trim(),
      address: customerAddress.trim(),
      comment: customerComment?.trim() || null,
      source: "retail", // Important: marks this as a retail order
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
      
      console.log("Notification request sent for retail order:", orderNumber);
    } catch (notifyErr) {
      console.error("Failed to send notification (non-critical):", notifyErr);
    }

    console.log("Retail order created successfully:", {
      orderNumber,
      storeId,
      customerName: customerName.trim(),
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
    console.error("Error in create-retail-order:", error);
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
