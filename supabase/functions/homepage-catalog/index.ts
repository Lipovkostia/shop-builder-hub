import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const [
      { data: settings },
      { data: categoriesData },
      { data: productsData },
      { data: partnersData },
    ] = await Promise.all([
      supabase.from("landing_settings").select("homepage_version").eq("id", "default").maybeSingle(),
      supabase
        .from("homepage_categories")
        .select("id, name, parent_id, sort_order, image_url")
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("homepage_products")
        .select("id, name, description, image_url, images, category_id, source_url, sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .limit(2000),
      supabase
        .from("landing_retail_partners")
        .select("id, name, url, image_url, sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
    ]);

    const categories = (categoriesData || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      parent_id: c.parent_id,
      sort_order: c.sort_order,
    }));

    const products = (productsData || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      image: p.image_url || (p.images?.[0] ?? null),
      images_count: (p.images?.length || 0) + (p.image_url ? 1 : 0),
      category_id: p.category_id,
      setting_categories: p.category_id ? [p.category_id] : [],
      category: null,
      source_url: p.source_url,
    }));

    return new Response(
      JSON.stringify({
        data: products,
        categories,
        partners: partnersData || [],
        homepage_version: settings?.homepage_version || "new",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("homepage-catalog error:", e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
