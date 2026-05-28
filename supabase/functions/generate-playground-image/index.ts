// Edge function: generate-playground-image
// Чат-плейграунд: модель + промпт + произвольные фото (без привязки к товару)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body {
  store_id: string;
  prompt: string;
  model?: string;
  aspect_ratio?: string;
  image_urls?: string[];
}

const KIE_API_KEY = Deno.env.get("KIE_API_KEY") ?? "";
const KIE_BASE = "https://api.kie.ai";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

const ALLOWED_AR = new Set(["1:1", "16:9", "9:16", "4:3", "3:4", "2:3", "3:2", "21:9"]);

async function kieCreateTask(model: string, input: Record<string, unknown>): Promise<string> {
  const res = await fetch(`${KIE_BASE}/api/v1/jobs/createTask`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KIE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, input }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`kie.ai createTask ${res.status}: ${text.slice(0, 400)}`);
  const json = JSON.parse(text);
  if (json?.code && json.code !== 200) throw new Error(`kie.ai code=${json.code}: ${json?.msg ?? ""}`);
  const taskId = json?.data?.taskId;
  if (!taskId) throw new Error(`Нет taskId`);
  return taskId;
}

async function kiePoll(taskId: string, timeoutMs = 180_000): Promise<string> {
  const started = Date.now();
  let delay = 2500;
  while (Date.now() - started < timeoutMs) {
    const res = await fetch(`${KIE_BASE}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, {
      headers: { Authorization: `Bearer ${KIE_API_KEY}` },
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`recordInfo ${res.status}: ${text.slice(0, 300)}`);
    const json = JSON.parse(text);
    const state = json?.data?.state;
    if (state === "success") {
      const rj = json?.data?.resultJson;
      const parsed = typeof rj === "string" ? JSON.parse(rj) : rj;
      const urls: string[] = parsed?.resultUrls ?? [];
      if (!urls.length) throw new Error("Пустой resultUrls");
      return urls[0];
    }
    if (state === "fail") throw new Error(json?.data?.failMsg ?? "Генерация не удалась");
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay + 1000, 6000);
  }
  throw new Error("Таймаут");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!KIE_API_KEY) throw new Error("KIE_API_KEY не настроен");
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Не авторизовано" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabaseAuth = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser();
    if (userErr || !userData?.user) return new Response(JSON.stringify({ error: "Неверный токен" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = (await req.json()) as Body;
    if (!body.store_id) throw new Error("store_id обязателен");
    const aspect_ratio = ALLOWED_AR.has(body.aspect_ratio ?? "") ? body.aspect_ratio! : "1:1";
    const images = (body.image_urls ?? []).filter(Boolean);
    const hasImages = images.length > 0;
    const model = body.model ?? (hasImages ? "google/nano-banana-edit" : "google/nano-banana");

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const input: Record<string, unknown> = { prompt: body.prompt || "Generate image", output_format: "png", aspect_ratio };
    if (hasImages) input.image_urls = images;

    let resultUrl: string;
    try {
      const taskId = await kieCreateTask(model, input);
      resultUrl = await kiePoll(taskId);
    } catch (genErr: unknown) {
      return new Response(JSON.stringify({ error: genErr instanceof Error ? genErr.message : String(genErr) }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // download + store
    const r = await fetch(resultUrl);
    const bytes = new Uint8Array(await r.arrayBuffer());
    const ct = r.headers.get("content-type") ?? "image/png";
    const ext = (ct.split("/")[1] ?? "png").split(";")[0];
    const path = `playground/${body.store_id}/results/${Date.now()}_${Math.floor(Math.random() * 9999)}.${ext}`;
    const { error: upErr } = await admin.storage.from("product-images").upload(path, bytes, { contentType: ct, upsert: false });
    if (upErr) throw new Error(`Storage: ${upErr.message}`);
    const url = admin.storage.from("product-images").getPublicUrl(path).data.publicUrl;

    return new Response(JSON.stringify({ url, model }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: unknown) {
    console.error("playground error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
