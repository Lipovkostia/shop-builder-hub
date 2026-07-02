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

    const [{ data: settings }, { data: partnersData }, { data: homepageCats }] = await Promise.all([
      supabase
        .from("landing_settings")
        .select("catalog_access_code, homepage_version")
        .eq("id", "default")
        .single(),
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

    const homepageVersion = settings?.homepage_version || "new";
    const partners = partnersData || [];

    // Build the effective list of price lists to display.
    let priceLists: Array<{ id: string | null; access_code: string }> = [];
    if (homepageCats && homepageCats.length > 0) {
      priceLists = homepageCats.map((c: any) => ({ id: c.id, access_code: c.access_code }));
    } else if (settings?.catalog_access_code) {
      priceLists = [{ id: null, access_code: settings.catalog_access_code }];
    }

    if (priceLists.length > 0) {
      const hcIds = priceLists.filter((p) => p.id).map((p) => p.id!) as string[];

      // Fetch exclude tables + catalog rows in parallel
      const [{ data: catExcludes }, { data: prodExcludes }, { data: catalogRows }] = await Promise.all([
        hcIds.length
          ? supabase
              .from("homepage_catalog_category_excludes")
              .select("homepage_catalog_id, category_id")
              .in("homepage_catalog_id", hcIds)
          : Promise.resolve({ data: [] as any[] }),
        hcIds.length
          ? supabase
              .from("homepage_catalog_product_excludes")
              .select("homepage_catalog_id, product_id")
              .in("homepage_catalog_id", hcIds)
          : Promise.resolve({ data: [] as any[] }),
        supabase
          .from("catalogs")
          .select("id, store_id, access_code")
          .in("access_code", priceLists.map((p) => p.access_code)),
      ]);

      const catalogByCode = new Map<string, { id: string; store_id: string }>();
      (catalogRows || []).forEach((c: any) => catalogByCode.set(c.access_code, { id: c.id, store_id: c.store_id }));

      // Build exclude sets by homepage_catalog_id
      const catExcludeByHc = new Map<string, Set<string>>();
      (catExcludes || []).forEach((r: any) => {
        if (!catExcludeByHc.has(r.homepage_catalog_id)) catExcludeByHc.set(r.homepage_catalog_id, new Set());
        catExcludeByHc.get(r.homepage_catalog_id)!.add(r.category_id);
      });
      const prodExcludeByHc = new Map<string, Set<string>>();
      (prodExcludes || []).forEach((r: any) => {
        if (!prodExcludeByHc.has(r.homepage_catalog_id)) prodExcludeByHc.set(r.homepage_catalog_id, new Set());
        prodExcludeByHc.get(r.homepage_catalog_id)!.add(r.product_id);
      });

      const allProducts: any[] = [];
      const seenProductIds = new Set<string>();
      const allCategories: any[] = [];
      const seenCategoryKeys = new Set<string>();

      for (const pl of priceLists) {
        const prodExcludeSet = pl.id ? prodExcludeByHc.get(pl.id) : undefined;
        const catExcludeSet = pl.id ? catExcludeByHc.get(pl.id) : undefined;

        const { data: rows, error } = await supabase.rpc("get_catalog_products_public", { _access_code: pl.access_code });
        if (error) {
          console.error("get_catalog_products_public failed", pl.access_code, error);
          continue;
        }

        for (const p of rows || []) {
          if (seenProductIds.has(p.product_id)) continue;
          if (prodExcludeSet?.has(p.product_id)) continue;
          if (catExcludeSet && p.category_id && catExcludeSet.has(p.category_id)) continue;
          seenProductIds.add(p.product_id);
          allProducts.push({
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
            access_code: pl.access_code,
            homepage_catalog_id: pl.id,
          });
        }

        // Category tree for this price list
        const catRow = catalogByCode.get(pl.access_code);
        if (catRow) {
          const { data: catSettings } = await supabase
            .from("catalog_category_settings")
            .select("category_id, sort_order, parent_category_id, custom_name")
            .eq("catalog_id", catRow.id)
            .order("sort_order", { ascending: true });

          if (catSettings && catSettings.length > 0) {
            const categoryIds = catSettings.map((c: any) => c.category_id);
            const { data: catNames } = await supabase
              .from("categories")
              .select("id, name")
              .in("id", categoryIds);
            const nameMap = new Map((catNames || []).map((c: any) => [c.id, c.name]));

            for (const c of catSettings) {
              if (catExcludeSet?.has(c.category_id)) continue;
              const key = `${pl.access_code}|${c.category_id}`;
              if (seenCategoryKeys.has(key)) continue;
              seenCategoryKeys.add(key);
              allCategories.push({
                id: c.category_id,
                name: c.custom_name || nameMap.get(c.category_id) || "Unknown",
                parent_id: c.parent_category_id || null,
                sort_order: c.sort_order,
                access_code: pl.access_code,
                homepage_catalog_id: pl.id,
              });
            }
          }
        }
      }

      return new Response(
        JSON.stringify({
          data: allProducts,
          categories: allCategories,
          access_code: priceLists[0]?.access_code || null,
          price_lists: priceLists,
          partners,
          homepage_version: homepageVersion,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fallback: featured_products
    const { data: featured, error } = await supabase
      .from("featured_products")
      .select(`
        id, sort_order, product_id,
        products!inner (
          id, name, sku, price, unit, images, quantity, is_active, category_id, store_id,
          stores!products_store_id_fkey ( name, subdomain ),
          categories!products_category_id_fkey ( name )
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
      JSON.stringify({ data: products, categories: [], partners, homepage_version: homepageVersion }),
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
