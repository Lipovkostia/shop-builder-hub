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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify user authentication via JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("Missing or invalid Authorization header");
      return new Response(
        JSON.stringify({ error: "Unauthorized - No token provided" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    
    // Create client with anon key to verify user token
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
    
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    
    if (authError || !user) {
      console.log("Auth error:", authError?.message);
      return new Response(
        JSON.stringify({ error: "Unauthorized - Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Authenticated user:", user.id, user.email);

    // Create service role client to check platform_roles (bypass RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user has super_admin role
    const { data: roleData, error: roleError } = await supabase
      .from("platform_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (roleError) {
      console.log("Role check error:", roleError.message);
      return new Response(
        JSON.stringify({ error: "Error checking role" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!roleData) {
      console.log("User does not have super_admin role:", user.id);
      return new Response(
        JSON.stringify({ error: "Forbidden - Super admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("User has super_admin role, proceeding...");

    // Parse URL to get action
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "stats";
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const search = url.searchParams.get("search") || "";

    console.log(`Action: ${action}, page: ${page}, limit: ${limit}, search: ${search}`);

    // Get today's date at midnight for filtering
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    if (action === "stores") {
      // Fetch stores list with pagination
      let query = supabase
        .from("stores")
        .select(`
          id,
          name,
          subdomain,
          status,
          created_at,
          products_count,
          customers_count,
          profiles!stores_owner_id_fkey (
            email,
            full_name
          )
        `, { count: "exact" });

      if (search) {
        query = query.or(`name.ilike.%${search}%,subdomain.ilike.%${search}%`);
      }

      const from = (page - 1) * limit;
      const to = from + limit - 1;

      const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      const formattedStores = (data || []).map((store: any) => ({
        id: store.id,
        name: store.name,
        subdomain: store.subdomain,
        status: store.status,
        created_at: store.created_at,
        owner_email: store.profiles?.email || "N/A",
        owner_name: store.profiles?.full_name,
        products_count: store.products_count || 0,
        customers_count: store.customers_count || 0,
      }));

      return new Response(
        JSON.stringify({ data: formattedStores, total: count || 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "customers") {
      // Fetch customers list with pagination
      let query = supabase
        .from("profiles")
        .select("id, user_id, full_name, phone, email, created_at", { count: "exact" })
        .eq("role", "customer");

      if (search) {
        query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
      }

      const from = (page - 1) * limit;
      const to = from + limit - 1;

      const { data: profilesData, error: profilesError, count } = await query
        .order("created_at", { ascending: false })
        .range(from, to);

      if (profilesError) throw profilesError;

      // Get store_customers for each profile
      const profileIds = (profilesData || []).map((p: any) => p.id);
      
      let storeCustomersData: any[] = [];
      if (profileIds.length > 0) {
        const { data: scData } = await supabase
          .from("store_customers")
          .select("profile_id, store_id, stores(name)")
          .in("profile_id", profileIds);
        storeCustomersData = scData || [];
      }

      const customersWithStores = (profilesData || []).map((profile: any) => {
        const customerStores = storeCustomersData
          .filter((sc: any) => sc.profile_id === profile.id)
          .map((sc: any) => ({
            store_id: sc.store_id,
            store_name: sc.stores?.name || "Неизвестный магазин"
          }));

        return {
          id: profile.id,
          user_id: profile.user_id,
          full_name: profile.full_name,
          phone: profile.phone,
          email: profile.email,
          created_at: profile.created_at,
          stores: customerStores
        };
      });

      return new Response(
        JSON.stringify({ data: customersWithStores, total: count || 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Default: fetch stats
    console.log("Fetching stats with service role key...");

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
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "seller"),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "seller").gte("created_at", todayISO),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "customer"),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "customer").gte("created_at", todayISO),
      supabase.from("stores").select("id", { count: "exact", head: true }),
      supabase.from("stores").select("id", { count: "exact", head: true }).gte("created_at", todayISO),
      supabase.from("catalogs").select("id", { count: "exact", head: true }),
      supabase.from("catalogs").select("id", { count: "exact", head: true }).gte("created_at", todayISO),
      supabase.from("products").select("id", { count: "exact", head: true }).is("deleted_at", null),
      supabase.from("products").select("id", { count: "exact", head: true }).is("deleted_at", null).gte("created_at", todayISO),
      supabase.from("products").select("price").is("deleted_at", null),
      supabase.from("orders").select("id", { count: "exact", head: true }),
      supabase.from("orders").select("id", { count: "exact", head: true }).gte("created_at", todayISO),
    ]);

    let totalSum = 0;
    if (productsSumResult.data) {
      totalSum = productsSumResult.data.reduce((sum: number, p: any) => sum + (p.price || 0), 0);
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
    console.error("Error fetching data:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
