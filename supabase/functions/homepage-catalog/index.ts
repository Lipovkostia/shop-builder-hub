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

    const [settingsRes, partnersRes] = await Promise.all([
      supabase
        .from("landing_settings")
        .select("homepage_version, catalog_access_code")
        .eq("id", "default")
        .maybeSingle(),
      supabase
        .from("landing_retail_partners")
        .select("id, name, url, image_url, sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
    ]);

    const settings = settingsRes.data as any;
    const partnersData = partnersRes.data;
    const homepageVersion = settings?.homepage_version || "new";
    const accessCode: string | null = settings?.catalog_access_code || null;

    // === Mode A: linked seller catalog (preferred when configured) ===
    if (accessCode) {
      const [productsResult, catalogResult] = await Promise.all([
        supabase.rpc("get_catalog_products_public", { _access_code: accessCode }),
        supabase
          .from("catalogs")
          .select("id, store_id")
          .eq("access_code", accessCode)
          .maybeSingle(),
      ]);

      const rows = (productsResult.data || []) as any[];

      const products = rows.map((p) => ({
        id: p.product_id,
        name: p.product_name,
        description: p.product_description,
        image: p.product_images?.[0] || null,
        images_count: p.product_images?.length || 0,
        category_id: p.category_id,
        setting_categories: p.setting_categories || (p.category_id ? [p.category_id] : []),
        category: p.category_name || null,
        source_url: null,
        price: p.product_price,
        unit: p.product_unit,
        sku: p.product_sku,
      }));

      // Categories from catalog_category_settings (hierarchy)
      let categories: any[] = [];
      if (catalogResult.data) {
        const { data: catSettings } = await supabase
          .from("catalog_category_settings")
          .select("category_id, sort_order, parent_category_id, custom_name")
          .eq("catalog_id", catalogResult.data.id)
          .order("sort_order", { ascending: true });

        if (catSettings && catSettings.length > 0) {
          const ids = catSettings.map((c: any) => c.category_id);
          const { data: catNames } = await supabase
            .from("categories")
            .select("id, name")
            .in("id", ids);
          const nameMap = new Map((catNames || []).map((c: any) => [c.id, c.name]));
          categories = catSettings.map((c: any) => ({
            id: c.category_id,
            name: c.custom_name || nameMap.get(c.category_id) || "—",
            parent_id: c.parent_category_id || null,
            sort_order: c.sort_order,
          }));
        } else {
          // Fallback: derive categories from products
          const seen = new Map<string, string>();
          for (const p of rows) {
            if (p.category_id && p.category_name && !seen.has(p.category_id)) {
              seen.set(p.category_id, p.category_name);
            }
          }
          categories = Array.from(seen.entries()).map(([id, name], i) => ({
            id, name, parent_id: null, sort_order: i,
          }));
        }
      }

      return new Response(
        JSON.stringify({
          data: products,
          categories,
          partners: partnersData || [],
          homepage_version: homepageVersion,
          source: "catalog",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // === Mode B: legacy parsed catalog (only when no catalog is linked) ===
    const [categoriesRes, productsRes] = await Promise.all([
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
    ]);

    const categories = (categoriesRes.data || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      parent_id: c.parent_id,
      sort_order: c.sort_order,
    }));

    const products = (productsRes.data || []).map((p: any) => ({
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
        homepage_version: homepageVersion,
        source: "parsed",
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
