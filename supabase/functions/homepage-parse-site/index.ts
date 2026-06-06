import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FIRECRAWL_V2 = "https://api.firecrawl.dev/v2";

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
    const rawLimit = Number(body?.limit);
    const limit: number = rawLimit && rawLimit > 0 ? Math.floor(rawLimit) : 5000;
    if (!url) throw new Error("url required");

    const host = new URL(url).host;

    const schema = {
      type: "object",
      properties: {
        is_product: { type: "boolean", description: "true только если это страница КОНКРЕТНОГО товара (не категория, не список, не статья)" },
        name: { type: "string", description: "Название товара" },
        category_path: {
          type: "array", items: { type: "string" },
          description: "Хлебные крошки категории от верхнего к нижнему, без названия товара",
        },
        category: { type: "string" },
        image: { type: "string", description: "Главное фото товара (полный URL)" },
        images: { type: "array", items: { type: "string" } },
        description: { type: "string" },
        price: { type: "number" },
        currency: { type: "string" },
      },
      required: ["is_product"],
    };

    // 1. Запускаем асинхронный crawl — Firecrawl сам обойдёт все ссылки внутри сайта.
    const crawlStart = await fetch(`${FIRECRAWL_V2}/crawl`, {
      method: "POST",
      headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        limit,
        maxDiscoveryDepth: 5,
        allowSubdomains: false,
        crawlEntireDomain: true,
        scrapeOptions: {
          formats: [{ type: "json", schema }],
          onlyMainContent: true,
        },
      }),
    });
    const crawlJson = await crawlStart.json();
    if (!crawlStart.ok) throw new Error(`Firecrawl crawl: ${crawlJson?.error || crawlStart.status}`);
    const jobId: string | undefined = crawlJson?.id || crawlJson?.data?.id;
    if (!jobId) throw new Error("Firecrawl: no crawl job id");

    // Категории кеш
    const catIdByKey = new Map<string, string>();
    async function ensureCategory(path: string[]): Promise<string | null> {
      const clean = path.map((s) => s.trim()).filter((s) => s && s.length < 120);
      if (clean.length === 0) return null;
      let parentId: string | null = null;
      let key = "";
      for (let level = 0; level < clean.length; level++) {
        const name = clean[level];
        key = key ? `${key} / ${name}` : name;
        if (catIdByKey.has(key)) { parentId = catIdByKey.get(key)!; continue; }
        const q = supabase.from("homepage_categories").select("id").eq("name", name).limit(1);
        const { data: found } = parentId ? await q.eq("parent_id", parentId) : await q.is("parent_id", null);
        let id: string | null = found && found[0] ? (found[0] as any).id : null;
        if (!id) {
          const { data: inserted } = await supabase
            .from("homepage_categories")
            .insert({ name, slug: slugify(name), parent_id: parentId, sort_order: level, is_active: true })
            .select("id").single();
          id = inserted ? (inserted as any).id : null;
        }
        if (!id) return parentId;
        catIdByKey.set(key, id);
        parentId = id;
      }
      return parentId;
    }

    const seen = new Set<string>();

    async function ingestDoc(doc: any) {
      const srcUrl: string = doc?.metadata?.sourceURL || doc?.metadata?.url || doc?.url || "";
      if (!srcUrl || seen.has(srcUrl)) return;
      const ex = doc?.json || doc?.extract || doc?.data?.json || null;
      if (!ex) return;
      // фильтруем: только товары
      if (ex.is_product !== true || !ex.name) return;
      seen.add(srcUrl);

      // дубль по source_url
      const { data: exist } = await supabase
        .from("homepage_products").select("id").eq("source_url", srcUrl).limit(1);
      if (exist && exist[0]) return;

      const path: string[] = Array.isArray(ex.category_path) && ex.category_path.length
        ? ex.category_path : (ex.category ? [ex.category] : []);
      const leafId = await ensureCategory(path);

      const mainImg = ex.image ? absoluteUrl(ex.image, srcUrl) : null;
      const extra = Array.isArray(ex.images) ? ex.images.map((x: string) => absoluteUrl(x, srcUrl)) : [];
      const allImages = Array.from(new Set([mainImg, ...extra].filter(Boolean) as string[]));

      await supabase.from("homepage_products").insert({
        name: String(ex.name).trim().slice(0, 500),
        description: typeof ex.description === "string" ? ex.description.slice(0, 2000) : null,
        image_url: mainImg,
        images: allImages,
        category_id: leafId,
        category_path: path.length ? path : null,
        price: parsePrice(ex.price),
        currency: typeof ex.currency === "string" ? ex.currency.slice(0, 8) : null,
        source_url: srcUrl,
        source_site: host,
        is_active: true,
      });
    }

    const backgroundJob = async () => {
      const startedAt = Date.now();
      const maxMs = 25 * 60 * 1000; // 25 минут
      let lastTotal = 0;

      while (Date.now() - startedAt < maxMs) {
        let next: string | null = `${FIRECRAWL_V2}/crawl/${jobId}`;
        let pages = 0;
        let status = "scraping";
        let total = 0;
        let completed = 0;
        while (next) {
          const r: Response = await fetch(next, {
            headers: { Authorization: `Bearer ${firecrawlKey}` },
          });
          const j: any = await r.json();
          if (!r.ok) { console.error("crawl poll error:", j); break; }
          status = j?.status || status;
          total = j?.total ?? total;
          completed = j?.completed ?? completed;
          const docs: any[] = j?.data || [];
          for (const d of docs) {
            await ingestDoc(d);
            pages++;
          }
          next = j?.next || null;
        }
        if (pages !== lastTotal) {
          console.log(`[parse-site] crawl ${jobId}: ${completed}/${total} status=${status} ingested=${seen.size}`);
          lastTotal = pages;
        }
        if (status === "completed" || status === "failed" || status === "cancelled") break;
        await new Promise((res) => setTimeout(res, 5000));
      }
      console.log(`[parse-site] done ${host}: ingested ${seen.size} products`);
    };

    // @ts-ignore
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(backgroundJob().catch((e) => console.error("background job failed:", e)));
    } else {
      backgroundJob().catch((e) => console.error("background job failed:", e));
    }

    return new Response(JSON.stringify({
      ok: true,
      started: true,
      job_id: jobId,
      message: `Запущен полный обход сайта ${host} (до ${limit} страниц). Товары появятся в каталоге по мере обработки — обновите страницу через 1–3 минуты.`,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("homepage-parse-site error:", e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
