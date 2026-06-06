// Edge function: generate-playground-image
// Чат-плейграунд: модель + промпт + произвольные фото (без привязки к товару).
// Поддерживает как фото, так и видео модели kie.ai.

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

function normalizeKieModelName(model: string): string {
  const aliases: Record<string, string> = {
    "kling/v2.5-turbo-pro/image-to-video": "kling/v2-5-turbo-image-to-video-pro",
    "kling/v2.5-turbo-pro/text-to-video": "kling/v2-5-turbo-text-to-video-pro",
    "bytedance/seedance-v1-lite-image-to-video": "bytedance/v1-lite-image-to-video",
    "bytedance/seedance-v1-lite-text-to-video": "bytedance/v1-lite-text-to-video",
    "bytedance/seedance-v1-pro-image-to-video": "bytedance/v1-pro-image-to-video",
    "bytedance/seedance-v1-pro-text-to-video": "bytedance/v1-pro-text-to-video",
    "minimax/hailuo-02-image-to-video": "hailuo/02-image-to-video-standard",
    "minimax/hailuo-02-text-to-video": "hailuo/02-text-to-video-standard",
  };
  return aliases[model] ?? model;
}

async function kieCreateVeoTask(input: Record<string, unknown>): Promise<string> {
  const res = await fetch(`${KIE_BASE}/api/v1/veo/generate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KIE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`kie.ai veo generate ${res.status}: ${text.slice(0, 400)}`);
  const json = JSON.parse(text);
  if (json?.code && json.code !== 200) throw new Error(`kie.ai veo code=${json.code}: ${json?.msg ?? ""}`);
  const taskId = json?.data?.taskId;
  if (!taskId) throw new Error(`kie.ai veo: нет taskId`);
  return taskId;
}

async function kiePollVeo(taskId: string, timeoutMs = 900_000): Promise<string> {
  const started = Date.now();
  let delay = 5000;
  while (Date.now() - started < timeoutMs) {
    const res = await fetch(`${KIE_BASE}/api/v1/veo/record-info?taskId=${encodeURIComponent(taskId)}`, {
      headers: { Authorization: `Bearer ${KIE_API_KEY}` },
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`veo recordInfo ${res.status}: ${text.slice(0, 300)}`);
    const json = JSON.parse(text);
    if (json?.code && json.code !== 200) throw new Error(`kie.ai veo code=${json.code}: ${json?.msg ?? ""}`);
    const data = json?.data;
    if (data?.successFlag === 1) {
      const urls = data?.response?.resultUrls ?? data?.response?.originUrls ?? data?.response?.fullResultUrls ?? [];
      const arr = typeof urls === "string" ? [urls] : urls;
      if (!arr.length) throw new Error("Пустой resultUrls");
      return arr[0];
    }
    if (data?.successFlag === 2 || data?.successFlag === 3) throw new Error(data?.errorMessage ?? data?.errorCode ?? "Veo генерация не удалась");
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay + 2000, 12000);
  }
  throw new Error("Veo: таймаут");
}

async function kiePoll(taskId: string, timeoutMs = 600_000): Promise<string> {
  const started = Date.now();
  let delay = 3000;
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
      let urls: string[] = parsed?.resultUrls ?? parsed?.videoUrls ?? parsed?.videos ?? [];
      if (typeof urls === "string") urls = [urls];
      if (!urls.length) throw new Error("Пустой resultUrls");
      return urls[0];
    }
    if (state === "fail") throw new Error(json?.data?.failMsg ?? json?.data?.failCode ?? "Генерация не удалась");
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay + 1000, 8000);
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
    const rawModel = body.model ?? (hasImages ? "google/nano-banana-edit" : "google/nano-banana");

    // Разбираем суффикс: `:1K|:2K|:4K` (разрешение) или `:5s|:10s|:Ns` (длительность видео)
    let model = rawModel;
    let resolution: "1K" | "2K" | "4K" | null = null;
    let durationSec: number | null = null;
    const resMatch = rawModel.match(/^(.*):(1K|2K|4K)$/);
    const durMatch = rawModel.match(/^(.*):(\d+)s$/);
    if (resMatch) { model = resMatch[1]; resolution = resMatch[2] as "1K" | "2K" | "4K"; }
    else if (durMatch) { model = durMatch[1]; durationSec = parseInt(durMatch[2], 10); }

    const isVideo = /^(kling|bytedance\/seedance|minimax\/hailuo|google\/veo)/.test(model);
    const firstImage = images[0] ?? null;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const input: Record<string, unknown> = {
      prompt: body.prompt || (isVideo ? "Animate the scene naturally" : "Generate image"),
    };

    if (isVideo) {
      if (durationSec) input.duration = String(durationSec);
      input.aspect_ratio = aspect_ratio;
      if (model.includes("image-to-video") && firstImage) input.image_url = firstImage;
      if (model.startsWith("kling/")) { input.cfg_scale = 0.5; input.negative_prompt = ""; }
      if (model.includes("bytedance/seedance")) input.resolution = "720p";
      if (model.includes("minimax/hailuo")) input.resolution = "768P";
    } else {
      input.output_format = "png";
      input.aspect_ratio = aspect_ratio;
      if (hasImages) input.image_urls = images;
      if (resolution && (model === "nano-banana-2" || model === "nano-banana-pro")) {
        input.resolution = resolution;
        if (hasImages) { delete input.image_urls; input.image_input = images; }
      }
    }

    let resultUrl: string;
    try {
      const taskId = await kieCreateTask(model, input);
      resultUrl = await kiePoll(taskId);
    } catch (genErr: unknown) {
      return new Response(JSON.stringify({ error: genErr instanceof Error ? genErr.message : String(genErr) }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Скачиваем и сохраняем в storage
    const r = await fetch(resultUrl);
    const bytes = new Uint8Array(await r.arrayBuffer());
    const ct = r.headers.get("content-type") ?? (isVideo ? "video/mp4" : "image/png");
    const isVideoResult = isVideo || ct.startsWith("video/");
    const bucket = isVideoResult ? "product-videos" : "product-images";
    const ext = isVideoResult ? ((ct.split("/")[1] ?? "mp4").split(";")[0]) : ((ct.split("/")[1] ?? "png").split(";")[0]);
    const finalCT = isVideoResult && !ct.startsWith("video/") ? "video/mp4" : ct;
    const path = `playground/${body.store_id}/results/${Date.now()}_${Math.floor(Math.random() * 9999)}.${ext}`;
    const { error: upErr } = await admin.storage.from(bucket).upload(path, bytes, { contentType: finalCT, upsert: false });
    if (upErr) throw new Error(`Storage: ${upErr.message}`);
    const url = admin.storage.from(bucket).getPublicUrl(path).data.publicUrl;

    return new Response(JSON.stringify({ url, model: rawModel, kind: isVideoResult ? "video" : "image" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: unknown) {
    console.error("playground error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
