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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - No token provided" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
    
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: roleData, error: roleError } = await supabase
      .from("platform_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (roleError) {
      return new Response(
        JSON.stringify({ error: "Error checking role" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "Forbidden - Super admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "stats";
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const search = url.searchParams.get("search") || "";

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    // ========== HISTORY ACTION ==========
    if (action === "history") {
      const days = parseInt(url.searchParams.get("days") || "30");
      
      // Build date range for the last N days
      const dates: string[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - i);
        dates.push(d.toISOString().split("T")[0]);
      }
      
      const startDate = dates[0] + "T00:00:00.000Z";
      
      // Fetch all records created since startDate with just created_at
      const [sellers, customers, stores, catalogs, products, orders] = await Promise.all([
        supabase.from("profiles").select("created_at").eq("role", "seller").gte("created_at", startDate),
        supabase.from("profiles").select("created_at").eq("role", "customer").gte("created_at", startDate),
        supabase.from("stores").select("created_at").gte("created_at", startDate),
        supabase.from("catalogs").select("created_at").gte("created_at", startDate),
        supabase.from("products").select("created_at").is("deleted_at", null).gte("created_at", startDate),
        supabase.from("orders").select("created_at").gte("created_at", startDate),
      ]);

      // Also get totals before startDate for cumulative counts
      const [sellersTotal, customersTotal, storesTotal, catalogsTotal, productsTotal, ordersTotal] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "seller").lt("created_at", startDate),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "customer").lt("created_at", startDate),
        supabase.from("stores").select("id", { count: "exact", head: true }).lt("created_at", startDate),
        supabase.from("catalogs").select("id", { count: "exact", head: true }).lt("created_at", startDate),
        supabase.from("products").select("id", { count: "exact", head: true }).is("deleted_at", null).lt("created_at", startDate),
        supabase.from("orders").select("id", { count: "exact", head: true }).lt("created_at", startDate),
      ]);

      function countByDay(rows: any[] | null): Record<string, number> {
        const counts: Record<string, number> = {};
        (rows || []).forEach((r: any) => {
          const day = r.created_at?.split("T")[0];
          if (day) counts[day] = (counts[day] || 0) + 1;
        });
        return counts;
      }

      const sellersByDay = countByDay(sellers.data);
      const customersByDay = countByDay(customers.data);
      const storesByDay = countByDay(stores.data);
      const catalogsByDay = countByDay(catalogs.data);
      const productsByDay = countByDay(products.data);
      const ordersByDay = countByDay(orders.data);

      // Build cumulative history
      let cumSellers = sellersTotal.count || 0;
      let cumCustomers = customersTotal.count || 0;
      let cumStores = storesTotal.count || 0;
      let cumCatalogs = catalogsTotal.count || 0;
      let cumProducts = productsTotal.count || 0;
      let cumOrders = ordersTotal.count || 0;

      const history = dates.map(date => {
        cumSellers += sellersByDay[date] || 0;
        cumCustomers += customersByDay[date] || 0;
        cumStores += storesByDay[date] || 0;
        cumCatalogs += catalogsByDay[date] || 0;
        cumProducts += productsByDay[date] || 0;
        cumOrders += ordersByDay[date] || 0;

        return {
          date,
          sellers: cumSellers,
          customers: cumCustomers,
          stores: cumStores,
          catalogs: cumCatalogs,
          products: cumProducts,
          orders: cumOrders,
          // daily deltas
          d_sellers: sellersByDay[date] || 0,
          d_customers: customersByDay[date] || 0,
          d_stores: storesByDay[date] || 0,
          d_catalogs: catalogsByDay[date] || 0,
          d_products: productsByDay[date] || 0,
          d_orders: ordersByDay[date] || 0,
        };
      });

      return new Response(
        JSON.stringify({ history }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "stores") {
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

    if (action === "products") {
      const sort = url.searchParams.get("sort") || "created_at";
      const order = url.searchParams.get("order") || "desc";

      let query = supabase
        .from("products")
        .select(`
          id,
          name,
          sku,
          price,
          buy_price,
          quantity,
          created_at,
          is_active,
          canonical_product_id,
          store_id,
          stores!products_store_id_fkey (
            id,
            name,
            subdomain
          )
        `, { count: "exact" })
        .is("deleted_at", null);

      if (search) {
        query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
      }

      const linked = url.searchParams.get("linked");
      if (linked === "true") {
        query = query.not("canonical_product_id", "is", null);
      } else if (linked === "false") {
        query = query.is("canonical_product_id", null);
      }

      const from = (page - 1) * limit;
      const to = from + limit - 1;

      const { data, error, count } = await query
        .order(sort, { ascending: order === "asc" })
        .range(from, to);

      if (error) throw error;

      const formattedProducts = (data || []).map((product: any) => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        price: product.price,
        buy_price: product.buy_price,
        quantity: product.quantity,
        created_at: product.created_at,
        is_active: product.is_active,
        canonical_product_id: product.canonical_product_id,
        store_id: product.store_id,
        store_name: product.stores?.name || "Неизвестный магазин",
        store_subdomain: product.stores?.subdomain || "",
        is_new_today: new Date(product.created_at) >= today
      }));

      return new Response(
        JSON.stringify({ data: formattedProducts, total: count || 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Default: fetch stats
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
