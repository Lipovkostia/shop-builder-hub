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

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Auth: must be super_admin
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
      const { data } = await supabase
        .from("homepage_parse_jobs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(20);
      return json({ jobs: data || [] });
    }

    if (action === "stop") {
      const id = body?.job_id;
      if (!id) return json({ error: "job_id required" }, 400);
      await supabase.from("homepage_parse_jobs").update({ stop_requested: true }).eq("id", id);
      return json({ ok: true });
    }

    if (action === "clear_finished") {
      await supabase.from("homepage_parse_jobs").delete().in("status", ["completed", "failed", "cancelled", "stopped"]);
      return json({ ok: true });
    }

    // === START ===
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!firecrawlKey) throw new Error("FIRECRAWL_API_KEY is not configured");

    const url: string = (body?.url || "").trim();
    const rawLimit = Number(body?.limit);
    const limit: number = rawLimit && rawLimit > 0 ? Math.floor(rawLimit) : 5000;
    if (!url) return json({ error: "url required" }, 400);
    const host = new URL(url).host;

    // Create job row early so the UI can poll it immediately.
    const { data: jobRow, error: jobErr } = await supabase
      .from("homepage_parse_jobs")
      .insert({ url, host, status: "starting", created_by: userId })
      .select()
      .single();
    if (jobErr) throw jobErr;
    const dbJobId: string = (jobRow as any).id;

    const schema = {
      type: "object",
      properties: {
        is_product: { type: "boolean", description: "true только если это страница КОНКРЕТНОГО товара" },
        name: { type: "string" },
        category_path: { type: "array", items: { type: "string" } },
        category: { type: "string" },
        image: { type: "string" },
        images: { type: "array", items: { type: "string" } },
        description: { type: "string" },
        price: { type: "number" },
        currency: { type: "string" },
      },
      required: ["is_product"],
    };

    const crawlStart = await fetch(`${FIRECRAWL_V2}/crawl`, {
      method: "POST",
      headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        url, limit, maxDiscoveryDepth: 5, allowSubdomains: false, crawlEntireDomain: true,
        scrapeOptions: { formats: [{ type: "json", schema }], onlyMainContent: true },
      }),
    });
    const crawlJson = await crawlStart.json();
    if (!crawlStart.ok) {
      const msg = `Firecrawl crawl: ${crawlJson?.error || crawlStart.status}`;
      await supabase.from("homepage_parse_jobs")
        .update({ status: "failed", last_error: msg, finished_at: new Date().toISOString() })
        .eq("id", dbJobId);
      return json({ error: msg }, 500);
    }
    const firecrawlJobId: string | undefined = crawlJson?.id || crawlJson?.data?.id;
    if (!firecrawlJobId) {
      await supabase.from("homepage_parse_jobs")
        .update({ status: "failed", last_error: "no crawl job id", finished_at: new Date().toISOString() })
        .eq("id", dbJobId);
      return json({ error: "Firecrawl: no crawl job id" }, 500);
    }
    await supabase.from("homepage_parse_jobs")
      .update({ firecrawl_job_id: firecrawlJobId, status: "scraping" })
      .eq("id", dbJobId);

    // Background processing
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
    let ingestedCount = 0;
    let duplicatesCount = 0;

    async function ingestDoc(doc: any) {
      const srcUrl: string = doc?.metadata?.sourceURL || doc?.metadata?.url || doc?.url || "";
      if (!srcUrl || seen.has(srcUrl)) return;
      const ex = doc?.json || doc?.extract || doc?.data?.json || null;
      if (!ex) return;
      if (ex.is_product !== true || !ex.name) return;
      seen.add(srcUrl);

      const { data: exist } = await supabase
        .from("homepage_products").select("id").eq("source_url", srcUrl).limit(1);
      if (exist && exist[0]) { duplicatesCount++; return; }

      const path: string[] = Array.isArray(ex.category_path) && ex.category_path.length
        ? ex.category_path : (ex.category ? [ex.category] : []);
      const leafId = await ensureCategory(path);

      const mainImg = ex.image ? absoluteUrl(ex.image, srcUrl) : null;
      const extra = Array.isArray(ex.images) ? ex.images.map((x: string) => absoluteUrl(x, srcUrl)) : [];
      const allImages = Array.from(new Set([mainImg, ...extra].filter(Boolean) as string[]));

      const { error: insErr } = await supabase.from("homepage_products").insert({
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
      if (!insErr) ingestedCount++;
    }

    async function isStopRequested(): Promise<boolean> {
      const { data } = await supabase
        .from("homepage_parse_jobs").select("stop_requested").eq("id", dbJobId).maybeSingle();
      return !!(data as any)?.stop_requested;
    }

    async function updateProgress(extra: Record<string, unknown> = {}) {
      await supabase.from("homepage_parse_jobs").update({
        ingested: ingestedCount,
        duplicates: duplicatesCount,
        ...extra,
      }).eq("id", dbJobId);
    }

    async function cancelFirecrawl() {
      try {
        await fetch(`${FIRECRAWL_V2}/crawl/${firecrawlJobId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${firecrawlKey}` },
        });
      } catch (_) { /* ignore */ }
    }

    const backgroundJob = async () => {
      const startedAt = Date.now();
      const maxMs = 25 * 60 * 1000;
      try {
        while (Date.now() - startedAt < maxMs) {
          if (await isStopRequested()) {
            await cancelFirecrawl();
            await supabase.from("homepage_parse_jobs").update({
              status: "stopped", ingested: ingestedCount, duplicates: duplicatesCount,
              finished_at: new Date().toISOString(),
            }).eq("id", dbJobId);
            console.log(`[parse-site] stopped by user. ingested=${ingestedCount}`);
            return;
          }

          let next: string | null = `${FIRECRAWL_V2}/crawl/${firecrawlJobId}`;
          let status = "scraping";
          let total = 0;
          let completed = 0;
          while (next) {
            const r: Response = await fetch(next, { headers: { Authorization: `Bearer ${firecrawlKey}` } });
            const j: any = await r.json();
            if (!r.ok) { console.error("crawl poll error:", j); break; }
            status = j?.status || status;
            total = j?.total ?? total;
            completed = j?.completed ?? completed;
            const docs: any[] = j?.data || [];
            for (const d of docs) {
              if (await isStopRequested()) break;
              await ingestDoc(d);
            }
            next = j?.next || null;
            if (await isStopRequested()) break;
          }
          await updateProgress({ total, completed, status: status === "scraping" ? "scraping" : status });

          if (status === "completed" || status === "failed" || status === "cancelled") {
            await supabase.from("homepage_parse_jobs").update({
              status: status === "completed" ? "completed" : status,
              ingested: ingestedCount, duplicates: duplicatesCount, total, completed,
              finished_at: new Date().toISOString(),
            }).eq("id", dbJobId);
            console.log(`[parse-site] done ${host}: status=${status} ingested=${ingestedCount}`);
            return;
          }
          await new Promise((res) => setTimeout(res, 5000));
        }
        await supabase.from("homepage_parse_jobs").update({
          status: "failed", last_error: "timeout (25 min)",
          ingested: ingestedCount, duplicates: duplicatesCount,
          finished_at: new Date().toISOString(),
        }).eq("id", dbJobId);
      } catch (e: any) {
        console.error("background job failed:", e);
        await supabase.from("homepage_parse_jobs").update({
          status: "failed", last_error: String(e?.message || e),
          ingested: ingestedCount, duplicates: duplicatesCount,
          finished_at: new Date().toISOString(),
        }).eq("id", dbJobId);
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
      ok: true, started: true, job_id: dbJobId, firecrawl_job_id: firecrawlJobId,
      message: `Запущен полный обход сайта ${host} (до ${limit} страниц).`,
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
