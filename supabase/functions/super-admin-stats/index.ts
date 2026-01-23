import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StatsResponse {
  sellers: { total: number; today: number };
  customers: { total: number; today: number };
  stores: { total: number; today: number };
  catalogs: { total: number; today: number };
  products: { total: number; totalSum: number; today: number };
  orders: { total: number; today: number };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Simple auth check - verify temp_super_admin header
    const authHeader = req.headers.get("x-super-admin-key");
    if (authHeader !== "temp_super_admin_access") {
      console.log("Unauthorized access attempt");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create client with service role key to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get today's date at midnight for filtering
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    console.log("Fetching stats with service role key...");

    // Fetch all stats in parallel
    const [
      sellersResult,
      sellersToday,
      customersResult,
      customersToday,
      storesResult,
      storesToday,
      catalogsResult,
      catalogsToday,
      productsResult,
      productsToday,
      productsSumResult,
      ordersResult,
      ordersToday,
    ] = await Promise.all([
      // Total sellers (role = 'seller')
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "seller"),
      // Sellers registered today
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "seller").gte("created_at", todayISO),
      
      // Total customers (role = 'customer')
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "customer"),
      // Customers registered today
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "customer").gte("created_at", todayISO),
      
      // Total stores
      supabase.from("stores").select("id", { count: "exact", head: true }),
      // Stores created today
      supabase.from("stores").select("id", { count: "exact", head: true }).gte("created_at", todayISO),
      
      // Total catalogs
      supabase.from("catalogs").select("id", { count: "exact", head: true }),
      // Catalogs created today
      supabase.from("catalogs").select("id", { count: "exact", head: true }).gte("created_at", todayISO),
      
      // Total products (not deleted)
      supabase.from("products").select("id", { count: "exact", head: true }).is("deleted_at", null),
      // Products created today
      supabase.from("products").select("id", { count: "exact", head: true }).is("deleted_at", null).gte("created_at", todayISO),
      
      // Sum of product prices
      supabase.from("products").select("price").is("deleted_at", null),
      
      // Total orders
      supabase.from("orders").select("id", { count: "exact", head: true }),
      // Orders created today
      supabase.from("orders").select("id", { count: "exact", head: true }).gte("created_at", todayISO),
    ]);

    // Calculate total sum of products
    let totalSum = 0;
    if (productsSumResult.data) {
      totalSum = productsSumResult.data.reduce((sum, p) => sum + (p.price || 0), 0);
    }

    const stats: StatsResponse = {
      sellers: {
        total: sellersResult.count || 0,
        today: sellersToday.count || 0,
      },
      customers: {
        total: customersResult.count || 0,
        today: customersToday.count || 0,
      },
      stores: {
        total: storesResult.count || 0,
        today: storesToday.count || 0,
      },
      catalogs: {
        total: catalogsResult.count || 0,
        today: catalogsToday.count || 0,
      },
      products: {
        total: productsResult.count || 0,
        totalSum: Math.round(totalSum),
        today: productsToday.count || 0,
      },
      orders: {
        total: ordersResult.count || 0,
        today: ordersToday.count || 0,
      },
    };

    console.log("Stats fetched successfully:", stats);

    return new Response(
      JSON.stringify(stats),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error fetching stats:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
