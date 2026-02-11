import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get landing settings to find catalog access code
    const { data: settings } = await supabase
      .from("landing_settings")
      .select("catalog_access_code")
      .eq("id", "default")
      .single();

    const accessCode = settings?.catalog_access_code;

    if (accessCode) {
      // Fetch products and category hierarchy in parallel
      const [productsResult, catalogResult] = await Promise.all([
        supabase.rpc("get_catalog_products_public", { _access_code: accessCode }),
        supabase.from("catalogs").select("id, store_id").eq("access_code", accessCode).maybeSingle(),
      ]);

      if (productsResult.error) throw productsResult.error;

      const products = (productsResult.data || []).map((p: any) => ({
        id: p.product_id,
        name: p.product_name,
        sku: p.product_sku,
        price: p.product_price,
        unit: p.product_unit,
        image: p.product_images?.[0] || null,
        images_count: p.product_images?.length || 0,
        quantity: p.product_quantity,
        category: p.category_name || null,
        category_id: p.category_id || null,
        setting_categories: p.setting_categories || [],
        store_name: p.store_name || "",
      }));

      // Fetch category hierarchy from catalog_category_settings
      let categories: any[] = [];
      if (catalogResult.data) {
        const { data: catSettings } = await supabase
          .from("catalog_category_settings")
          .select("category_id, sort_order, parent_category_id, custom_name")
          .eq("catalog_id", catalogResult.data.id)
          .order("sort_order", { ascending: true });

        if (catSettings && catSettings.length > 0) {
          const categoryIds = catSettings.map((c: any) => c.category_id);
          const { data: catNames } = await supabase
            .from("categories")
            .select("id, name")
            .in("id", categoryIds);

          const nameMap = new Map((catNames || []).map((c: any) => [c.id, c.name]));

          categories = catSettings.map((c: any) => ({
            id: c.category_id,
            name: c.custom_name || nameMap.get(c.category_id) || "Unknown",
            parent_id: c.parent_category_id || null,
            sort_order: c.sort_order,
          }));
        }
      }

      return new Response(
        JSON.stringify({ data: products, categories }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fallback: use featured_products if no catalog linked
    const { data: featured, error } = await supabase
      .from("featured_products")
      .select(`
        id,
        sort_order,
        product_id,
        products!inner (
          id,
          name,
          sku,
          price,
          unit,
          images,
          quantity,
          is_active,
          category_id,
          store_id,
          stores!products_store_id_fkey (
            name,
            subdomain
          ),
          categories!products_category_id_fkey (
            name
          )
        )
      `)
      .order("sort_order", { ascending: true });

    if (error) throw error;

    const products = (featured || [])
      .filter((f: any) => f.products?.is_active !== false)
      .map((f: any) => ({
        id: f.products.id,
        featured_id: f.id,
        name: f.products.name,
        sku: f.products.sku,
        price: f.products.price,
        unit: f.products.unit,
        image: f.products.images?.[0] || null,
        images_count: f.products.images?.length || 0,
        quantity: f.products.quantity,
        category: f.products.categories?.name || null,
        store_name: f.products.stores?.name || "",
        store_subdomain: f.products.stores?.subdomain || "",
        sort_order: f.sort_order,
      }));

    return new Response(
      JSON.stringify({ data: products, categories: [] }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("landing-products error:", error);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
