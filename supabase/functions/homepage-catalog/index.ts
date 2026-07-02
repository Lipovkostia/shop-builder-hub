import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Emergency business override requested by admin: this supplier price list must not
// appear on the public homepage even if the DB row is still marked as active.
const FORCED_DISABLED_CATALOG_IDS = new Set(["35121234-2811-4da7-b838-36a43698d5e0"]);
const FORCED_DISABLED_ACCESS_CODES = new Set(["4fe9c6e8"]);

function isForcedDisabledCatalog(row: { catalog_id?: string | null; access_code?: string | null }) {
  return !!(
    (row.catalog_id && FORCED_DISABLED_CATALOG_IDS.has(row.catalog_id)) ||
    (row.access_code && FORCED_DISABLED_ACCESS_CODES.has(row.access_code))
  );
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function requireSuperAdmin(req: Request, supabase: ReturnType<typeof createClient>) {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return { ok: false as const, response: json({ error: "Unauthorized" }, 401) };

  const { data: userData } = await supabase.auth.getUser(token);
  const userId = userData?.user?.id;
  if (!userId) return { ok: false as const, response: json({ error: "Unauthorized" }, 401) };

  const { data: roleOk, error } = await supabase.rpc("has_platform_role", {
    _user_id: userId,
    _role: "super_admin",
  });
  if (error || !roleOk) return { ok: false as const, response: json({ error: "Forbidden" }, 403) };

  return { ok: true as const, userId };
}

async function resolveCatalogId(supabase: ReturnType<typeof createClient>, accessCode?: string | null) {
  if (!accessCode) return null;
  const { data } = await supabase.from("catalogs").select("id").eq("access_code", accessCode).maybeSingle();
  return (data as any)?.id || null;
}

async function updateHomepageProductsBySource(
  supabase: ReturnType<typeof createClient>,
  params: { is_active?: boolean; remove?: boolean; source_url_prefix?: string | null; source_site?: string | null; product_ids?: string[] },
) {
  const applyFilter = (query: any) => {
    if (params.source_url_prefix) return query.like("source_url", `${params.source_url_prefix}%`);
    if (params.source_site) return query.eq("source_site", params.source_site);
    if (params.product_ids?.length) return query.in("id", params.product_ids);
    throw new Error("No homepage product filter supplied");
  };

  if (params.remove) {
    const { data, error } = await applyFilter(supabase.from("homepage_products").delete().select("id"));
    if (error) throw error;
    return { count: data?.length || 0 };
  }

  const { data, error } = await applyFilter(
    supabase.from("homepage_products").update({ is_active: params.is_active }).select("id"),
  );
  if (error) throw error;
  return { count: data?.length || 0 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (req.method === "POST") {
      const auth = await requireSuperAdmin(req, supabase);
      if (!auth.ok) return auth.response;

      const body = await req.json().catch(() => ({}));
      const action = String(body?.action || "");

      if (action === "toggle_price_list") {
        const id = body?.id ? String(body.id) : null;
        const accessCode = body?.access_code ? String(body.access_code) : null;
        const catalogIdFromBody = body?.catalog_id ? String(body.catalog_id) : null;
        const requestedActive = Boolean(body?.is_active);
        const forcedDisabled = isForcedDisabledCatalog({ catalog_id: catalogIdFromBody, access_code: accessCode });
        const isActive = forcedDisabled ? false : requestedActive;

        let query = supabase.from("homepage_catalogs").update({ is_active: isActive }).select("id, catalog_id, access_code, is_active");
        if (id) query = query.eq("id", id);
        else if (accessCode) query = query.eq("access_code", accessCode);
        else if (catalogIdFromBody) query = query.eq("catalog_id", catalogIdFromBody);
        else return json({ error: "id, access_code or catalog_id is required" }, 400);

        const { data, error } = await query;
        if (error) throw error;

        const rows = (data || []) as any[];
        let productsUpdated = 0;
        for (const row of rows) {
          const catalogId = row.catalog_id || catalogIdFromBody || (await resolveCatalogId(supabase, row.access_code));
          if (!catalogId) continue;
          const result = await updateHomepageProductsBySource(supabase, {
            is_active: isActive,
            source_url_prefix: `catalog:${catalogId}:`,
          });
          productsUpdated += result.count;
        }

        return json({ ok: true, rows, products_updated: productsUpdated, forced_disabled: forcedDisabled });
      }

      if (action === "remove_price_list") {
        const id = body?.id ? String(body.id) : null;
        const accessCode = body?.access_code ? String(body.access_code) : null;
        let query = supabase.from("homepage_catalogs").delete().select("id, catalog_id, access_code");
        if (id) query = query.eq("id", id);
        else if (accessCode) query = query.eq("access_code", accessCode);
        else return json({ error: "id or access_code is required" }, 400);
        const { data, error } = await query;
        if (error) throw error;
        return json({ ok: true, rows: data || [] });
      }

      if (action === "toggle_homepage_products_group") {
        const result = await updateHomepageProductsBySource(supabase, {
          is_active: Boolean(body?.is_active),
          source_url_prefix: body?.source_url_prefix ? String(body.source_url_prefix) : null,
          source_site: body?.source_site ? String(body.source_site) : null,
          product_ids: Array.isArray(body?.product_ids) ? body.product_ids.map(String) : undefined,
        });
        return json({ ok: true, ...result });
      }

      if (action === "remove_homepage_products_group") {
        const result = await updateHomepageProductsBySource(supabase, {
          remove: true,
          source_url_prefix: body?.source_url_prefix ? String(body.source_url_prefix) : null,
          source_site: body?.source_site ? String(body.source_site) : null,
          product_ids: Array.isArray(body?.product_ids) ? body.product_ids.map(String) : undefined,
        });
        return json({ ok: true, ...result });
      }

      return json({ error: "Unknown action" }, 400);
    }

    const [settingsRes, partnersRes, homepageCatsRes, slidesRes, infoBlocksRes, heroRes] = await Promise.all([
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
      supabase
        .from("landing_slides")
        .select("id, title, image_url, sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("landing_info_blocks")
        .select("id, title, description, icon, image_url, sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("homepage_hero_settings")
        .select("*")
        .eq("id", "default")
        .maybeSingle()
        .then((r: any) => r, () => ({ data: null })),
    ]);

    const settings = settingsRes.data as any;
    const partnersData = partnersRes.data;
    const slidesData = slidesRes.data || [];
    const infoBlocksData = infoBlocksRes.data || [];
    const heroSettings = (heroRes as any)?.data || null;
    const homepageVersion = settings?.homepage_version || "new";
    const homepageCats = ((homepageCatsRes.data || []) as any[]).filter((c) => !isForcedDisabledCatalog(c));

    let priceLists: Array<{ id: string | null; access_code: string }> = homepageCats.map((c) => ({
      id: c.id,
      access_code: c.access_code,
    }));
    if (priceLists.length === 0 && settings?.catalog_access_code && !FORCED_DISABLED_ACCESS_CODES.has(settings.catalog_access_code)) {
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
          slides: slidesData,
          info_blocks: infoBlocksData,
          hero_settings: heroSettings,
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
        slides: slidesData,
        info_blocks: infoBlocksData,
        hero_settings: heroSettings,
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
