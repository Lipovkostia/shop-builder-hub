// Edge function: generate-product-image
// Генерация фото товара через kie.ai + сохранение результата в storage.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface RequestBody {
  product_id: string;
  source_image_url?: string | null;
  reference_image_url?: string | null;
  image_urls?: string[] | null; // новый формат: упорядоченный список изображений (1, 2, 3...)
  prompt?: string | null;
  aspect_ratio?: string;
  width?: number;
  height?: number;
  n?: number;
  quality?: "low" | "medium" | "high";
  model?: string;
}

const KIE_API_KEY = Deno.env.get("KIE_API_KEY") ?? "";
const KIE_BASE = "https://api.kie.ai";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const ALLOWED_AR = new Set(["1:1", "16:9", "9:16", "4:3", "3:4", "2:3", "3:2", "21:9"]);

// Маппинг aspect_ratio -> image_size для Seedream 4
function mapAspectToSeedreamSize(ar: string): string {
  switch (ar) {
    case "1:1": return "square_hd";
    case "4:3": return "landscape_4_3";
    case "3:4": return "portrait_4_3";
    case "3:2": return "landscape_3_2";
    case "2:3": return "portrait_3_2";
    case "16:9": return "landscape_16_9";
    case "9:16": return "portrait_16_9";
    case "21:9": return "landscape_21_9";
    default: return "square_hd";
  }
}

async function kieCreateTask(model: string, input: Record<string, unknown>): Promise<string> {
  const res = await fetch(`${KIE_BASE}/api/v1/jobs/createTask`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KIE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, input }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`kie.ai createTask ${res.status}: ${text.slice(0, 400)}`);
  let json: Record<string, unknown>;
  try { json = JSON.parse(text); } catch { throw new Error(`kie.ai createTask: некорректный JSON: ${text.slice(0, 200)}`); }
  if (json?.code && json.code !== 200) throw new Error(`kie.ai createTask code=${json.code}: ${json?.msg ?? "ошибка"}`);
  const taskId = json?.data?.taskId;
  if (!taskId) throw new Error(`kie.ai createTask: нет taskId. Ответ: ${text.slice(0, 200)}`);
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
    if (!res.ok) throw new Error(`kie.ai recordInfo ${res.status}: ${text.slice(0, 300)}`);
    let json: Record<string, unknown>;
    try { json = JSON.parse(text); } catch { throw new Error("kie.ai recordInfo: некорректный JSON"); }
    const state = json?.data?.state;
    if (state === "success") {
      const rj = json?.data?.resultJson;
      let urls: string[] = [];
      try {
        const parsed = typeof rj === "string" ? JSON.parse(rj) : rj;
        urls = parsed?.resultUrls ?? [];
      } catch { /* noop */ }
      if (!urls.length) throw new Error("kie.ai: пустой resultUrls");
      return urls[0];
    }
    if (state === "fail") throw new Error(`kie.ai: ${json?.data?.failMsg ?? json?.data?.failCode ?? "генерация не удалась"}`);
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay + 1000, 6000);
  }
  throw new Error("kie.ai: таймаут ожидания результата");
}

async function fetchAsBytes(url: string): Promise<{ bytes: Uint8Array; contentType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Не удалось скачать результат: ${res.status}`);
  const contentType = res.headers.get("content-type") ?? "image/png";
  return { bytes: new Uint8Array(await res.arrayBuffer()), contentType };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!KIE_API_KEY) {
      return new Response(JSON.stringify({ error: "KIE_API_KEY не настроен" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Не авторизовано" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Неверный токен" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as RequestBody;
    if (!body.product_id) {
      return new Response(JSON.stringify({ error: "product_id обязателен" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: product } = await admin
      .from("products")
      .select("id, name, store_id, images")
      .eq("id", body.product_id)
      .maybeSingle();
    if (!product) {
      return new Response(JSON.stringify({ error: "Товар не найден" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const productImage = body.source_image_url || null;
    const referenceImage = body.reference_image_url || null;
    const extraImages = Array.isArray(body.image_urls) ? body.image_urls.filter(Boolean) : [];
    const userPrompt = (body.prompt ?? "").replaceAll("{product_name}", product.name).trim();

    if (!userPrompt && !productImage && !referenceImage && extraImages.length === 0) {
      return new Response(JSON.stringify({ error: "Нужен промпт или изображение" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Если изображение пришло data URL — загрузим в storage, чтобы kie.ai мог его скачать
    async function ensureUrl(maybeDataUrl: string): Promise<string> {
      if (!maybeDataUrl.startsWith("data:")) return maybeDataUrl;
      const match = maybeDataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) return maybeDataUrl;
      const ct = match[1];
      const b64 = match[2];
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const ext = (ct.split("/")[1] ?? "png").split(";")[0];
      const path = `${product.id}/refs/${Date.now()}_${Math.floor(Math.random()*9999)}.${ext}`;
      const { error } = await admin.storage.from("product-images").upload(path, bin, { contentType: ct, upsert: false });
      if (error) throw new Error(`Reference upload: ${error.message}`);
      return admin.storage.from("product-images").getPublicUrl(path).data.publicUrl;
    }

    // Собираем упорядоченный список: товар, затем референс, затем доп. изображения.
    // Если клиент уже прислал image_urls — используем его как есть.
    const images: string[] = [];
    if (extraImages.length > 0) {
      for (const u of extraImages) images.push(await ensureUrl(u));
    } else {
      if (productImage) images.push(await ensureUrl(productImage));
      if (referenceImage) images.push(await ensureUrl(referenceImage));
    }

    const hasImages = images.length > 0;
    const rawModel = body.model ?? (hasImages ? "google/nano-banana-edit" : "google/nano-banana");
    const aspect_ratio = ALLOWED_AR.has(body.aspect_ratio ?? "") ? body.aspect_ratio! : "1:1";

    // Разбираем суффикс разрешения (`:1K|:2K|:4K`)
    let model = rawModel;
    let resolution: "1K" | "2K" | "4K" | null = null;
    const resMatch = rawModel.match(/^(.*):(1K|2K|4K)$/);
    if (resMatch) {
      model = resMatch[1];
      resolution = resMatch[2] as "1K" | "2K" | "4K";
    }

    let finalPrompt: string;
    if (hasImages && images.length >= 2) {
      const numbered = images.map((_, i) => `Изображение #${i + 1}`).join(", ");
      const header =
        `Тебе передано ${images.length} изображени${images.length === 2 ? "я" : "й"} в строгом порядке: ${numbered}. ` +
        `Изображение #1 — это товар "${product.name}" (главный объект, сохрани его форму, упаковку, этикетку, цвета и пропорции БЕЗ изменений). ` +
        `Изображения #2${images.length > 2 ? `…#${images.length}` : ""} — референсы (стиль, фон, окружение, персонажи, текстуры). ` +
        `Следуй инструкции пользователя ниже и используй изображения по их номерам. Не добавляй текст и не искажай товар.\n\n` +
        `Инструкция пользователя:\n`;
      finalPrompt = header + (userPrompt || `Помести товар (#1) в сцену/стиль из остальных изображений. Сделай реалистичное коммерческое фото.`);
    } else {
      finalPrompt = userPrompt || `Сгенерируй качественное коммерческое фото товара: ${product.name}`;
    }

    // Маппинг aspect_ratio → image_size для моделей, у которых параметр называется image_size
    // и принимает символьные значения вида "square_hd" / "landscape_16_9"
    const aspectToImageSizeSymbolic = (ar: string): string => {
      switch (ar) {
        case "1:1": return "square_hd";
        case "4:3": return "landscape_4_3";
        case "3:4": return "portrait_4_3";
        case "3:2": return "landscape_3_2";
        case "2:3": return "portrait_3_2";
        case "16:9": return "landscape_16_9";
        case "9:16": return "portrait_16_9";
        case "21:9": return "landscape_21_9";
        default: return "square_hd";
      }
    };

    // Каждая модель kie.ai принимает свой набор параметров.
    // Документация: https://docs.kie.ai/market/...
    const input: Record<string, unknown> = { prompt: finalPrompt };

    if (model === "nano-banana-2") {
      // Nano Banana 2: image_input (массив URL), resolution: 1K/2K/4K, aspect_ratio, output_format
      input.aspect_ratio = aspect_ratio;
      input.resolution = resolution ?? "1K";
      input.output_format = "png";
      if (hasImages) input.image_input = images;
    } else if (model === "bytedance/seedream-v4-text-to-image") {
      // Seedream 4 text-to-image: image_size + image_resolution (без входных изображений)
      input.image_size = mapAspectToSeedreamSize(aspect_ratio);
      input.image_resolution = resolution ?? "2K";
      input.max_images = 1;
    } else if (model === "bytedance/seedream-v4-edit") {
      // Seedream 4 Edit: image_urls, image_size, image_resolution
      input.image_size = mapAspectToSeedreamSize(aspect_ratio);
      input.image_resolution = resolution ?? "2K";
      input.max_images = 1;
      if (hasImages) input.image_urls = images;
    } else {
      // Nano Banana / Nano Banana Edit (google/*): prompt, image_urls, aspect_ratio, output_format
      input.aspect_ratio = aspect_ratio;
      input.output_format = "png";
      if (hasImages) input.image_urls = images;
    }


    const hasJobsTable = await admin.from("image_generation_jobs").select("id").limit(1).then(({ error }) => !error);

    let resultUrl: string;
    try {
      const taskId = await kieCreateTask(model, input);
      resultUrl = await kiePoll(taskId);
    } catch (genErr: unknown) {
      if (hasJobsTable) {
        const errorRow: Record<string, unknown> = {
          store_id: product.store_id,
          product_id: product.id,
          source_image_url: body.source_image_url ?? null,
          reference_image_url: body.reference_image_url ?? null,
          model: rawModel,
          prompt: finalPrompt,
          aspect_ratio,
          status: "error",
          error_message: genErr instanceof Error ? genErr.message : String(genErr),
        };
        const { error: insertErr } = await admin.from("image_generation_jobs").insert(errorRow);
        if (insertErr) {
          delete errorRow.reference_image_url;
          delete errorRow.model;
          await admin.from("image_generation_jobs").insert(errorRow);
        }
      }
      return new Response(JSON.stringify({ error: genErr instanceof Error ? genErr.message : String(genErr) }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { bytes, contentType } = await fetchAsBytes(resultUrl);
    const ext = (contentType.split("/")[1] ?? "png").split(";")[0];
    const path = `${product.id}/ai/${Date.now()}_${Math.floor(Math.random() * 9999)}.${ext}`;
    const { error: upErr } = await admin.storage.from("product-images").upload(path, bytes, { contentType, upsert: false });
    if (upErr) throw new Error(`Storage: ${upErr.message}`);

    const url = admin.storage.from("product-images").getPublicUrl(path).data.publicUrl;

    if (hasJobsTable) {
      const successRow: Record<string, unknown> = {
        store_id: product.store_id,
        product_id: product.id,
        source_image_url: body.source_image_url ?? null,
        reference_image_url: body.reference_image_url ?? null,
        model: rawModel,
        prompt: finalPrompt,
        aspect_ratio,
        result_image_url: url,
        status: "success",
      };
      const { error: insertErr } = await admin.from("image_generation_jobs").insert(successRow);
      if (insertErr) {
        delete successRow.reference_image_url;
        delete successRow.model;
        await admin.from("image_generation_jobs").insert(successRow);
      }
    }

    return new Response(JSON.stringify({ url, prompt: finalPrompt, model }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    console.error("generate-product-image error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});