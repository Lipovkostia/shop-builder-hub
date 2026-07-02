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

    const [settingsRes, partnersRes, homepageCatsRes] = await Promise.all([
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
      supabase
        .from("homepage_catalogs")
        .select("id, catalog_id, access_code, is_active, sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
    ]);

    const settings = settingsRes.data as any;
    const partnersData = partnersRes.data;
    const homepageVersion = settings?.homepage_version || "new";
    const homepageCats = (homepageCatsRes.data || []) as any[];

    let priceLists: Array<{ id: string | null; access_code: string }> = homepageCats.map((c) => ({
      id: c.id,
      access_code: c.access_code,
    }));
    if (priceLists.length === 0 && settings?.catalog_access_code) {
      priceLists = [{ id: null, access_code: settings.catalog_access_code }];
    }

    // === Mode A: linked seller catalog(s) ===
    if (priceLists.length > 0) {
      const hcIds = priceLists.filter((p) => p.id).map((p) => p.id!) as string[];
      const [catExRes, prodExRes, catalogsRes] = await Promise.all([
        hcIds.length
          ? supabase.from("homepage_catalog_category_excludes").select("homepage_catalog_id, category_id").in("homepage_catalog_id", hcIds)
          : Promise.resolve({ data: [] as any[] }),
        hcIds.length
          ? supabase.from("homepage_catalog_product_excludes").select("homepage_catalog_id, product_id").in("homepage_catalog_id", hcIds)
          : Promise.resolve({ data: [] as any[] }),
        supabase.from("catalogs").select("id, store_id, access_code").in("access_code", priceLists.map((p) => p.access_code)),
      ]);

      const catalogByCode = new Map<string, { id: string; store_id: string }>();
      (catalogsRes.data || []).forEach((c: any) => catalogByCode.set(c.access_code, { id: c.id, store_id: c.store_id }));

      const catExBy = new Map<string, Set<string>>();
      (catExRes.data || []).forEach((r: any) => {
        if (!catExBy.has(r.homepage_catalog_id)) catExBy.set(r.homepage_catalog_id, new Set());
        catExBy.get(r.homepage_catalog_id)!.add(r.category_id);
      });
      const prodExBy = new Map<string, Set<string>>();
      (prodExRes.data || []).forEach((r: any) => {
        if (!prodExBy.has(r.homepage_catalog_id)) prodExBy.set(r.homepage_catalog_id, new Set());
        prodExBy.get(r.homepage_catalog_id)!.add(r.product_id);
      });

      const products: any[] = [];
      const seenProductIds = new Set<string>();
      const categories: any[] = [];
      const seenCatKeys = new Set<string>();

      for (const pl of priceLists) {
        const prodEx = pl.id ? prodExBy.get(pl.id) : undefined;
        const catEx = pl.id ? catExBy.get(pl.id) : undefined;

        const productsResult = await supabase.rpc("get_catalog_products_public", { _access_code: pl.access_code });
        const rows = (productsResult.data || []) as any[];

        for (const p of rows) {
          if (seenProductIds.has(p.product_id)) continue;
          if (prodEx?.has(p.product_id)) continue;
          if (catEx && p.category_id && catEx.has(p.category_id)) continue;
          seenProductIds.add(p.product_id);
          products.push({
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
            access_code: pl.access_code,
            homepage_catalog_id: pl.id,
          });
        }

        const catRow = catalogByCode.get(pl.access_code);
        if (catRow) {
          const { data: catSettings } = await supabase
            .from("catalog_category_settings")
            .select("category_id, sort_order, parent_category_id, custom_name")
            .eq("catalog_id", catRow.id)
            .order("sort_order", { ascending: true });

          if (catSettings && catSettings.length > 0) {
            const ids = catSettings.map((c: any) => c.category_id);
            const { data: catNames } = await supabase.from("categories").select("id, name").in("id", ids);
            const nameMap = new Map((catNames || []).map((c: any) => [c.id, c.name]));
            for (const c of catSettings) {
              if (catEx?.has(c.category_id)) continue;
              const key = `${pl.access_code}|${c.category_id}`;
              if (seenCatKeys.has(key)) continue;
              seenCatKeys.add(key);
              categories.push({
                id: c.category_id,
                name: c.custom_name || nameMap.get(c.category_id) || "—",
                parent_id: c.parent_category_id || null,
                sort_order: c.sort_order,
                access_code: pl.access_code,
                homepage_catalog_id: pl.id,
              });
            }
          } else {
            const seen = new Map<string, string>();
            for (const p of rows) {
              if (catEx?.has(p.category_id)) continue;
              if (p.category_id && p.category_name && !seen.has(p.category_id)) seen.set(p.category_id, p.category_name);
            }
            Array.from(seen.entries()).forEach(([id, name], i) => {
              const key = `${pl.access_code}|${id}`;
              if (seenCatKeys.has(key)) return;
              seenCatKeys.add(key);
              categories.push({ id, name, parent_id: null, sort_order: i, access_code: pl.access_code, homepage_catalog_id: pl.id });
            });
          }
        }
      }

      return new Response(
        JSON.stringify({
          data: products,
          categories,
          partners: partnersData || [],
          homepage_version: homepageVersion,
          price_lists: priceLists,
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
