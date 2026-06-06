import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FIRECRAWL_V2 = "https://api.firecrawl.dev/v2";

interface ParsedProduct {
  name?: string;
  category?: string;
  image?: string;
  description?: string;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-zа-я0-9]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

function absoluteUrl(url: string, base: string): string {
  try { return new URL(url, base).toString(); } catch { return url; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  try {
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!firecrawlKey) throw new Error("FIRECRAWL_API_KEY is not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Auth: require super admin
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) throw new Error("Unauthorized");
    const { data: userData } = await supabase.auth.getUser(token);
    const userId = userData?.user?.id;
    if (!userId) throw new Error("Unauthorized");
    const { data: roleOk } = await supabase.rpc("has_platform_role", {
      _user_id: userId, _role: "super_admin",
    });
    if (!roleOk) throw new Error("Forbidden");

    const body = await req.json().catch(() => ({}));
    const url: string = (body?.url || "").trim();
    const limit: number = Math.min(Math.max(Number(body?.limit) || 80, 1), 200);
    if (!url) throw new Error("url required");

    const host = new URL(url).host;

    // 1) Map URLs
    const mapRes = await fetch(`${FIRECRAWL_V2}/map`, {
      method: "POST",
      headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, limit: 500, includeSubdomains: false }),
    });
    const mapJson = await mapRes.json();
    if (!mapRes.ok) throw new Error(`Firecrawl map: ${mapJson?.error || mapRes.status}`);
    const allLinks: string[] = (mapJson?.links || mapJson?.data?.links || [])
      .map((l: any) => typeof l === "string" ? l : l?.url)
      .filter(Boolean);

    // Heuristic: product pages usually have /product/ /shop/ /catalog/ /tovar/ /item/
    const productPatterns = /\/(product|products|tovar|tovary|item|items|shop|catalog|katalog|p)\//i;
    const candidateLinks = allLinks.filter((l) => productPatterns.test(l)).slice(0, limit);

    const linksToScrape = candidateLinks.length > 0 ? candidateLinks : allLinks.slice(0, Math.min(20, limit));

    // 2) Scrape each with JSON extraction, in small parallel batches
    const schema = {
      type: "object",
      properties: {
        name: { type: "string", description: "Название товара" },
        category: { type: "string", description: "Категория товара (хлебные крошки или раздел)" },
        image: { type: "string", description: "Главное изображение товара (полный URL)" },
        description: { type: "string", description: "Короткое описание" },
      },
      required: ["name"],
    };

    const results: { url: string; data?: ParsedProduct; error?: string }[] = [];
    const batchSize = 5;
    for (let i = 0; i < linksToScrape.length; i += batchSize) {
      const batch = linksToScrape.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(async (link) => {
        try {
          const r = await fetch(`${FIRECRAWL_V2}/scrape`, {
            method: "POST",
            headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              url: link,
              formats: [{ type: "json", schema }],
              onlyMainContent: true,
            }),
          });
          const j = await r.json();
          if (!r.ok) return { url: link, error: j?.error || `HTTP ${r.status}` };
          const extracted = j?.data?.json || j?.json || j?.data?.extract || null;
          if (!extracted?.name) return { url: link, error: "no name" };
          return { url: link, data: extracted as ParsedProduct };
        } catch (err) {
          return { url: link, error: err instanceof Error ? err.message : String(err) };
        }
      }));
      results.push(...batchResults);
    }

    // 3) Upsert categories
    const catNames = Array.from(new Set(
      results
        .map((r) => r.data?.category?.trim())
        .filter((c): c is string => !!c && c.length > 1 && c.length < 120),
    ));
    const catMap = new Map<string, string>(); // name -> id

    // Load existing
    if (catNames.length > 0) {
      const { data: existing } = await supabase
        .from("homepage_categories")
        .select("id, name")
        .in("name", catNames);
      for (const c of existing || []) catMap.set((c as any).name, (c as any).id);

      const toCreate = catNames.filter((n) => !catMap.has(n));
      if (toCreate.length > 0) {
        const { data: inserted } = await supabase
          .from("homepage_categories")
          .insert(toCreate.map((name, idx) => ({
            name, slug: slugify(name), sort_order: idx, is_active: true,
          })))
          .select("id, name");
        for (const c of inserted || []) catMap.set((c as any).name, (c as any).id);
      }
    }

    // 4) Insert products (skip duplicates via source_url unique index)
    let added = 0;
    let skipped = 0;
    let failed = 0;
    const errors: string[] = [];

    const toInsert = results
      .filter((r) => r.data)
      .map((r) => {
        const d = r.data!;
        const img = d.image ? absoluteUrl(d.image, r.url) : null;
        return {
          name: d.name!.trim().slice(0, 500),
          description: d.description?.slice(0, 2000) || null,
          image_url: img,
          images: img ? [img] : [],
          category_id: d.category ? (catMap.get(d.category.trim()) || null) : null,
          source_url: r.url,
          source_site: host,
          is_active: true,
        };
      });

    // Insert one by one to handle conflicts gracefully
    for (const row of toInsert) {
      const { error } = await supabase.from("homepage_products").insert(row);
      if (!error) added++;
      else if ((error as any).code === "23505") skipped++;
      else { failed++; if (errors.length < 5) errors.push(error.message); }
    }

    const failedResults = results.filter((r) => r.error);

    return new Response(JSON.stringify({
      ok: true,
      mapped: allLinks.length,
      scraped: linksToScrape.length,
      extracted: toInsert.length,
      added,
      skipped_duplicates: skipped,
      failed_inserts: failed,
      scrape_errors: failedResults.length,
      errors: errors.slice(0, 5),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("homepage-parse-site error:", e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
