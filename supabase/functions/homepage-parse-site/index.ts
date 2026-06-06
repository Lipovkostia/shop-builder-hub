import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FIRECRAWL_V2 = "https://api.firecrawl.dev/v2";

interface ParsedProduct {
  name?: string;
  category?: string;
  category_path?: string[];
  image?: string;
  images?: string[];
  description?: string;
  price?: number | string;
  currency?: string;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-zа-я0-9]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

function absoluteUrl(url: string, base: string): string {
  try { return new URL(url, base).toString(); } catch { return url; }
}

function parsePrice(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && isFinite(v)) return v;
  const s = String(v).replace(/\s+/g, "").replace(/[^\d.,-]/g, "").replace(",", ".");
  const m = s.match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return isFinite(n) ? n : null;
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
    // No hard cap — undefined/0/null means "parse everything we find"
    const rawLimit = Number(body?.limit);
    const limit: number | null = rawLimit && rawLimit > 0 ? Math.floor(rawLimit) : null;
    if (!url) throw new Error("url required");

    const host = new URL(url).host;

    // 1) Map URLs — pull as many as Firecrawl allows
    const mapRes = await fetch(`${FIRECRAWL_V2}/map`, {
      method: "POST",
      headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, limit: 5000, includeSubdomains: false }),
    });
    const mapJson = await mapRes.json();
    if (!mapRes.ok) throw new Error(`Firecrawl map: ${mapJson?.error || mapRes.status}`);
    const allLinks: string[] = (mapJson?.links || mapJson?.data?.links || [])
      .map((l: any) => typeof l === "string" ? l : l?.url)
      .filter(Boolean);

    const productPatterns = /\/(product|products|tovar|tovary|item|items|shop|catalog|katalog|p)\//i;
    let candidateLinks = allLinks.filter((l) => productPatterns.test(l));
    if (candidateLinks.length === 0) candidateLinks = allLinks;
    const linksToScrape = limit ? candidateLinks.slice(0, limit) : candidateLinks;

    // 2) Scrape each with JSON extraction (incl. price + hierarchical category)
    const schema = {
      type: "object",
      properties: {
        name: { type: "string", description: "Название товара" },
        category_path: {
          type: "array",
          items: { type: "string" },
          description: "Полные хлебные крошки категории от верхнего уровня к нижнему, без названия товара. Например ['Сыры','Твёрдые','Пармезан']",
        },
        category: { type: "string", description: "Категория товара (если нет хлебных крошек)" },
        image: { type: "string", description: "Главное изображение товара (полный URL)" },
        images: { type: "array", items: { type: "string" }, description: "Все фото товара" },
        description: { type: "string", description: "Короткое описание" },
        price: { type: "number", description: "Цена товара в числовом виде" },
        currency: { type: "string", description: "Валюта (RUB, USD, EUR и т.п.)" },
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

    // 3) Build hierarchical categories from category_path (or fallback to flat category)
    // catKey = path joined by " / " ; map to id
    const catIdByKey = new Map<string, string>();

    async function ensureCategory(path: string[]): Promise<string | null> {
      const clean = path.map((s) => s.trim()).filter((s) => s && s.length < 120);
      if (clean.length === 0) return null;
      let parentId: string | null = null;
      let key = "";
      for (let level = 0; level < clean.length; level++) {
        const name = clean[level];
        key = key ? `${key} / ${name}` : name;
        if (catIdByKey.has(key)) {
          parentId = catIdByKey.get(key)!;
          continue;
        }
        // Find existing by name+parent
        const query = supabase
          .from("homepage_categories")
          .select("id")
          .eq("name", name)
          .limit(1);
        const { data: found } = parentId
          ? await query.eq("parent_id", parentId)
          : await query.is("parent_id", null);
        let id: string | null = found && found[0] ? (found[0] as any).id : null;
        if (!id) {
          const { data: inserted, error: insErr } = await supabase
            .from("homepage_categories")
            .insert({
              name,
              slug: slugify(name),
              parent_id: parentId,
              sort_order: level,
              is_active: true,
            })
            .select("id")
            .single();
          if (insErr || !inserted) {
            // race: try fetch again
            const { data: again } = parentId
              ? await supabase.from("homepage_categories").select("id").eq("name", name).eq("parent_id", parentId).limit(1)
              : await supabase.from("homepage_categories").select("id").eq("name", name).is("parent_id", null).limit(1);
            id = again && again[0] ? (again[0] as any).id : null;
          } else {
            id = (inserted as any).id;
          }
        }
        if (!id) return parentId;
        catIdByKey.set(key, id);
        parentId = id;
      }
      return parentId;
    }

    // 4) Insert products
    let added = 0;
    let skipped = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const r of results) {
      if (!r.data) continue;
      const d = r.data;
      const path: string[] = Array.isArray(d.category_path) && d.category_path.length
        ? d.category_path
        : (d.category ? [d.category] : []);
      const leafId = await ensureCategory(path);

      const mainImg = d.image ? absoluteUrl(d.image, r.url) : null;
      const extra = Array.isArray(d.images) ? d.images.map((x) => absoluteUrl(x, r.url)) : [];
      const allImages = Array.from(new Set([mainImg, ...extra].filter(Boolean) as string[]));

      const row = {
        name: d.name!.trim().slice(0, 500),
        description: typeof d.description === "string" ? d.description.slice(0, 2000) : null,
        image_url: mainImg,
        images: allImages,
        category_id: leafId,
        category_path: path.length ? path : null,
        price: parsePrice(d.price),
        currency: typeof d.currency === "string" ? d.currency.slice(0, 8) : null,
        source_url: r.url,
        source_site: host,
        is_active: true,
      };

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
      extracted: results.filter((r) => r.data).length,
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
