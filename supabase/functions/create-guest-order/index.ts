import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OrderItem {
  productId: string | null;
  productName: string;
  variantIndex: number;
  quantity: number;
  price: number;
}

interface CreateGuestOrderRequest {
  accessCode: string;
  guestName: string;
  guestPhone: string;
  guestComment?: string;
  items: OrderItem[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: CreateGuestOrderRequest = await req.json();
    const { accessCode, guestName, guestPhone, guestComment, items } = body;

    // Validate required fields
    if (!accessCode) {
      throw new Error("accessCode is required");
    }
    if (!guestName?.trim()) {
      throw new Error("guestName is required");
    }
    if (!guestPhone?.trim()) {
      throw new Error("guestPhone is required");
    }
    if (!items || items.length === 0) {
      throw new Error("items are required");
    }

    // Create Supabase client with service role to bypass RLS
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate access code and get catalog info
    const { data: catalogData, error: catalogError } = await supabase
      .rpc("get_catalog_by_access_code", { _access_code: accessCode });

    if (catalogError || !catalogData || catalogData.length === 0) {
      throw new Error("Invalid access code or catalog not found");
    }

    const catalog = catalogData[0] as { id: string; store_id: string; name: string };
    const storeId = catalog.store_id;
    const catalogId = catalog.id;

    // Validate that products exist in this catalog
    const productIds = items.filter(i => i.productId).map(i => i.productId);
    
    if (productIds.length > 0) {
      const { data: visibility, error: visError } = await supabase
        .from("product_catalog_visibility")
        .select("product_id")
        .eq("catalog_id", catalogId)
        .in("product_id", productIds);

      if (visError) {
        console.error("Error validating products:", visError);
      }
      
      // Log warning if some products are not in catalog (but don't block order)
      const validProductIds = new Set((visibility || []).map(v => v.product_id));
      const invalidProducts = productIds.filter(id => !validProductIds.has(id));
      if (invalidProducts.length > 0) {
        console.warn("Some products not found in catalog:", invalidProducts);
      }
    }

    // Generate unique order number
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    const orderNumber = `G${timestamp}${random}`;

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const total = subtotal;

    // Create the order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        order_number: orderNumber,
        store_id: storeId,
        customer_id: null,
        guest_name: guestName.trim(),
        guest_phone: guestPhone.trim(),
        is_guest_order: true,
        notes: guestComment?.trim() || null,
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
    const variantLabels = ["целая", "1/2", "1/4", "порция"];
    const orderItems = items.map(item => {
      const variantLabel = variantLabels[item.variantIndex] || "";
      return {
        order_id: order.id,
        product_id: item.productId || null,
        product_name: `${item.productName}${variantLabel ? ` (${variantLabel})` : ""}`,
        quantity: item.quantity,
        price: item.price,
        total: item.price * item.quantity,
      };
    });

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
      
      console.log("Notification request sent for order:", orderNumber);
    } catch (notifyErr) {
      console.error("Failed to send notification (non-critical):", notifyErr);
    }

    console.log("Guest order created successfully:", {
      orderNumber,
      storeId,
      catalogId,
      guestName: guestName.trim(),
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
    console.error("Error in create-guest-order:", error);
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
