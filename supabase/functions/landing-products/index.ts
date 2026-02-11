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
      // Fetch products from linked catalog using the public function
      const { data: catalogProducts, error } = await supabase
        .rpc("get_catalog_products_public", { _access_code: accessCode });

      if (error) throw error;

      const products = (catalogProducts || []).map((p: any) => ({
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
        store_name: p.store_name || "",
      }));

      return new Response(
        JSON.stringify({ data: products }),
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
      JSON.stringify({ data: products }),
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
