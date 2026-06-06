import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DOMParser, Element } from "https://deno.land/x/deno_dom@v0.1.45/deno-dom-wasm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BEE = "https://app.scrapingbee.com/api/v1/";

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
function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

function isMissingJobsTable(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  return e?.code === "PGRST205" || /homepage_parse_jobs/i.test(e?.message || "");
}

const SKIP_EXT = /\.(jpg|jpeg|png|gif|webp|svg|ico|pdf|zip|rar|mp4|mp3|avi|mov|css|js|xml|json|woff2?|ttf|eot)(\?|$)/i;
const SKIP_SCHEMES = /^(mailto:|tel:|javascript:|whatsapp:|viber:)/i;

function normalizeUrl(u: string): string {
  try {
    const x = new URL(u);
    x.hash = "";
    // strip common tracking params
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "yclid", "gclid", "fbclid"].forEach((k) => x.searchParams.delete(k));
    return x.toString();
  } catch { return u; }
}

function pickPrice(doc: any, html: string): { price: number | null; currency: string | null } {
  // schema.org Product / Offer JSON-LD
  let price: number | null = null;
  let currency: string | null = null;
  const ldNodes = doc.querySelectorAll('script[type="application/ld+json"]');
  for (const n of ldNodes) {
    try {
      const data = JSON.parse((n as Element).textContent || "");
      const arr = Array.isArray(data) ? data : [data];
      for (const item of arr) {
        const items = Array.isArray(item?.["@graph"]) ? item["@graph"] : [item];
        for (const it of items) {
          const type = it?.["@type"];
          const isProduct = type === "Product" || (Array.isArray(type) && type.includes("Product"));
          if (!isProduct) continue;
          const offers = Array.isArray(it.offers) ? it.offers[0] : it.offers;
          if (offers) {
            const p = parsePrice(offers.price ?? offers.lowPrice ?? offers.highPrice);
            if (p != null) price = p;
            if (typeof offers.priceCurrency === "string") currency = offers.priceCurrency;
          }
        }
      }
    } catch { /* ignore */ }
  }
  // microdata / meta
  if (price == null) {
    const meta = doc.querySelector('meta[itemprop="price"], meta[property="product:price:amount"], meta[property="og:price:amount"]');
    if (meta) price = parsePrice((meta as Element).getAttribute("content"));
  }
  if (!currency) {
    const mc = doc.querySelector('meta[itemprop="priceCurrency"], meta[property="product:price:currency"], meta[property="og:price:currency"]');
    if (mc) currency = (mc as Element).getAttribute("content");
  }
  // Fallback: any element with itemprop="price"
  if (price == null) {
    const el = doc.querySelector('[itemprop="price"]');
    if (el) price = parsePrice((el as Element).getAttribute("content") || (el as Element).textContent);
  }
  // Russian RUB heuristic from text near "руб" / "₽"
  if (price == null) {
    const m = html.match(/(\d[\d\s\u00A0]{1,9}(?:[.,]\d{1,2})?)\s*(?:руб|р\.?|₽|rub)/i);
    if (m) {
      price = parsePrice(m[1]);
      if (price != null && !currency) currency = "RUB";
    }
  }
  return { price, currency };
}

function pickProductInfo(doc: any, html: string, srcUrl: string) {
  // Detect if this is a product page
  const ogType = doc.querySelector('meta[property="og:type"]')?.getAttribute("content") || "";
  let isProduct = /product/i.test(ogType);

  let name = "";
  let description = "";
  let image: string | null = null;
  const images: string[] = [];
  let categoryPath: string[] = [];

  // JSON-LD Product
  const ldNodes = doc.querySelectorAll('script[type="application/ld+json"]');
  for (const n of ldNodes) {
    try {
      const data = JSON.parse((n as Element).textContent || "");
      const arr = Array.isArray(data) ? data : [data];
      for (const item of arr) {
        const items = Array.isArray(item?.["@graph"]) ? item["@graph"] : [item];
        for (const it of items) {
          const type = it?.["@type"];
          if (type === "Product" || (Array.isArray(type) && type.includes("Product"))) {
            isProduct = true;
            if (!name && typeof it.name === "string") name = it.name;
            if (!description && typeof it.description === "string") description = it.description;
            const img = it.image;
            if (img) {
              const list = Array.isArray(img) ? img : [img];
              for (const i of list) {
                const u = typeof i === "string" ? i : i?.url;
                if (typeof u === "string") images.push(absoluteUrl(u, srcUrl));
              }
            }
            if (typeof it.category === "string") categoryPath = it.category.split(/\s*[\/>]\s*/).filter(Boolean);
          }
          if (type === "BreadcrumbList") {
            const items2 = Array.isArray(it.itemListElement) ? it.itemListElement : [];
            const path = items2
              .sort((a: any, b: any) => (a.position || 0) - (b.position || 0))
              .map((x: any) => (typeof x.name === "string" ? x.name : (typeof x.item?.name === "string" ? x.item.name : "")))
              .filter(Boolean);
            if (path.length && !categoryPath.length) categoryPath = path.slice(0, -1); // last is the product itself usually
          }
        }
      }
    } catch { /* ignore */ }
  }

  if (!name) {
    const h1 = doc.querySelector("h1");
    if (h1) name = (h1 as Element).textContent?.trim() || "";
  }
  if (!name) {
    const og = doc.querySelector('meta[property="og:title"]');
    if (og) name = og.getAttribute("content") || "";
  }
  if (!image) {
    const og = doc.querySelector('meta[property="og:image"]');
    if (og) image = absoluteUrl(og.getAttribute("content") || "", srcUrl);
  }
  if (!image && images.length) image = images[0];
  if (!description) {
    const md = doc.querySelector('meta[name="description"], meta[property="og:description"]');
    if (md) description = (md as Element).getAttribute("content") || "";
  }
  if (!categoryPath.length) {
    // breadcrumbs heuristic
    const bc = doc.querySelector('[class*="breadcrumb" i], nav[aria-label*="bread" i], ol.breadcrumb');
    if (bc) {
      const parts = Array.from(bc.querySelectorAll("a, span, li"))
        .map((el: any) => el.textContent?.trim() || "")
        .filter((s: string) => s && s.length < 60);
      if (parts.length > 1) categoryPath = parts.slice(0, -1);
    }
  }

  // Stricter product detection: must have name and a price OR explicit og:type product / JSON-LD product
  const { price, currency } = pickPrice(doc, html);

  // Heuristic: presence of price + "add to cart"-like control
  if (!isProduct && price != null) {
    if (/(в\s*корзин|купить|add\s*to\s*cart|buy\s*now|заказать)/i.test(html)) isProduct = true;
  }

  return { isProduct: !!(isProduct && name), name, description, image, images, categoryPath, price, currency };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Unauthorized" }, 401);
  const { data: userData } = await supabase.auth.getUser(token);
  const userId = userData?.user?.id;
  if (!userId) return json({ error: "Unauthorized" }, 401);
  const { data: roleOk } = await supabase.rpc("has_platform_role", { _user_id: userId, _role: "super_admin" });
  if (!roleOk) return json({ error: "Forbidden" }, 403);

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action: string = (body?.action || "start").toString();

    if (action === "status") {
      const { data, error } = await supabase
        .from("homepage_parse_jobs").select("*").order("started_at", { ascending: false }).limit(20);
      if (error) {
        if (isMissingJobsTable(error)) return json({ jobs: [], jobs_unavailable: true });
        throw error;
      }
      return json({ jobs: data || [] });
    }

    if (action === "stop") {
      const id = body?.job_id;
      if (!id) return json({ error: "job_id required" }, 400);
      const { error } = await supabase.from("homepage_parse_jobs").update({ stop_requested: true }).eq("id", id);
      if (error && !isMissingJobsTable(error)) throw error;
      return json({ ok: true });
    }

    if (action === "clear_finished") {
      const { error } = await supabase.from("homepage_parse_jobs").delete().in("status", ["completed", "failed", "cancelled", "stopped"]);
      if (error && !isMissingJobsTable(error)) throw error;
      return json({ ok: true });
    }

    // === START ===
    const beeKey = Deno.env.get("SCRAPINGBEE_API_KEY");
    if (!beeKey) throw new Error("SCRAPINGBEE_API_KEY is not configured");

    const url: string = (body?.url || "").trim();
    const rawLimit = Number(body?.limit);
    const limit: number = rawLimit && rawLimit > 0 ? Math.floor(rawLimit) : 200;
    const renderJs: boolean = !!body?.render_js;
    if (!url) return json({ error: "url required" }, 400);
    const startUrl = normalizeUrl(url);
    const host = new URL(startUrl).host;

    const { data: jobRow, error: jobErr } = await supabase
      .from("homepage_parse_jobs")
      .insert({ url: startUrl, host, status: "starting", created_by: userId })
      .select().single();
    if (jobErr && !isMissingJobsTable(jobErr)) throw jobErr;
    const dbJobId: string | null = jobRow ? (jobRow as any).id : null;

    async function updateJob(values: Record<string, unknown>) {
      if (!dbJobId) return;
      const { error } = await supabase.from("homepage_parse_jobs").update(values).eq("id", dbJobId);
      if (error && !isMissingJobsTable(error)) console.error("[parse-site] job update failed:", error);
    }

    async function isStopRequested(): Promise<boolean> {
      if (!dbJobId) return false;
      const { data, error } = await supabase
        .from("homepage_parse_jobs").select("stop_requested").eq("id", dbJobId).maybeSingle();
      if (error && isMissingJobsTable(error)) return false;
      return !!(data as any)?.stop_requested;
    }

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

    async function beeFetch(target: string): Promise<{ html: string; status: number } | null> {
      const params = new URLSearchParams({
        api_key: beeKey!,
        url: target,
        render_js: renderJs ? "true" : "false",
        block_resources: "true",
      });
      const r = await fetch(`${BEE}?${params.toString()}`);
      if (!r.ok) {
        const text = await r.text().catch(() => "");
        console.error("[bee]", r.status, target, text.slice(0, 200));
        return { html: "", status: r.status };
      }
      const html = await r.text();
      return { html, status: 200 };
    }

    const seen = new Set<string>([startUrl]);
    const queue: string[] = [startUrl];
    let ingestedCount = 0;
    let duplicatesCount = 0;
    let scrapedCount = 0;
    let failedCount = 0;

    await updateJob({ status: "scraping" });

    const backgroundJob = async () => {
      const startedAt = Date.now();
      const maxMs = 25 * 60 * 1000;
      try {
        while (queue.length && scrapedCount < limit) {
          if (Date.now() - startedAt > maxMs) {
            await updateJob({ status: "failed", last_error: "timeout (25 min)", finished_at: new Date().toISOString(), total: limit, completed: scrapedCount, ingested: ingestedCount, duplicates: duplicatesCount });
            return;
          }
          if (await isStopRequested()) {
            await updateJob({ status: "stopped", finished_at: new Date().toISOString(), total: limit, completed: scrapedCount, ingested: ingestedCount, duplicates: duplicatesCount });
            return;
          }
          const target = queue.shift()!;
          const res = await beeFetch(target);
          scrapedCount++;
          if (!res || res.status !== 200 || !res.html) {
            failedCount++;
          } else {
            try {
              const doc = new DOMParser().parseFromString(res.html, "text/html");
              if (doc) {
                // Collect links
                const anchors = doc.querySelectorAll("a[href]");
                for (const a of anchors) {
                  const href = (a as Element).getAttribute("href") || "";
                  if (!href || SKIP_SCHEMES.test(href)) continue;
                  const abs = normalizeUrl(absoluteUrl(href, target));
                  try {
                    const u = new URL(abs);
                    if (u.host !== host) continue;
                    if (SKIP_EXT.test(u.pathname)) continue;
                    if (seen.has(abs)) continue;
                    seen.add(abs);
                    if (queue.length + scrapedCount < limit) queue.push(abs);
                  } catch { /* ignore */ }
                }
                // Product detection & ingest
                const info = pickProductInfo(doc, res.html, target);
                if (info.isProduct) {
                  const { data: exist } = await supabase
                    .from("homepage_products").select("id").eq("source_url", target).limit(1);
                  if (exist && exist[0]) {
                    duplicatesCount++;
                  } else {
                    const leafId = await ensureCategory(info.categoryPath);
                    const allImages = Array.from(new Set([info.image, ...info.images].filter(Boolean) as string[]));
                    const { error: insErr } = await supabase.from("homepage_products").insert({
                      name: String(info.name).trim().slice(0, 500),
                      description: info.description ? info.description.slice(0, 2000) : null,
                      image_url: info.image,
                      images: allImages,
                      category_id: leafId,
                      category_path: info.categoryPath.length ? info.categoryPath : null,
                      price: info.price,
                      currency: info.currency ? info.currency.slice(0, 8) : null,
                      source_url: target,
                      source_site: host,
                      is_active: true,
                    });
                    if (!insErr) ingestedCount++;
                    else console.error("[insert]", insErr);
                  }
                }
              }
            } catch (e) {
              console.error("[parse]", target, e);
              failedCount++;
            }
          }

          if (scrapedCount % 5 === 0) {
            await updateJob({
              ingested: ingestedCount, duplicates: duplicatesCount,
              total: Math.min(limit, scrapedCount + queue.length), completed: scrapedCount,
              status: "scraping",
              last_error: failedCount ? `${failedCount} страниц не загрузились` : null,
            });
          }
        }

        await updateJob({
          status: "completed",
          ingested: ingestedCount, duplicates: duplicatesCount,
          total: scrapedCount, completed: scrapedCount,
          finished_at: new Date().toISOString(),
        });
        console.log(`[parse-site] done ${host}: scraped=${scrapedCount} ingested=${ingestedCount}`);
      } catch (e: any) {
        console.error("background job failed:", e);
        await updateJob({
          status: "failed", last_error: String(e?.message || e),
          ingested: ingestedCount, duplicates: duplicatesCount,
          finished_at: new Date().toISOString(),
        });
      }
    };

    // @ts-ignore
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(backgroundJob());
    } else {
      backgroundJob();
    }

    return json({
      ok: true, started: true, job_id: dbJobId,
      message: `Запущен обход сайта ${host} (до ${limit} страниц) через ScrapingBee.`,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("homepage-parse-site error:", e);
    return json({ error: msg }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
