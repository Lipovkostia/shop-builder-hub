// Edge function: generate-product-image
// Универсальный прокси к внешнему сервису генерации изображений.
// Пользователь укажет провайдер позже — поддерживаем несколько форматов через IMAGE_GEN_PROVIDER.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface RequestBody {
  product_id: string;
  source_image_url?: string | null;
  prompt: string;
  aspect_ratio?: string;
  width?: number;
  height?: number;
  n?: number;
  quality?: "low" | "medium" | "high";
}

const PROVIDER = (Deno.env.get("IMAGE_GEN_PROVIDER") ?? "lovable").toLowerCase();
const API_KEY = Deno.env.get("IMAGE_GEN_API_KEY") ?? "";
const PROVIDER_BASE = Deno.env.get("IMAGE_GEN_BASE_URL") ?? "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function aspectToSize(ar?: string, w?: number, h?: number): { width: number; height: number } {
  if (w && h) return { width: w, height: h };
  const map: Record<string, [number, number]> = {
    "1:1": [1024, 1024],
    "16:9": [1536, 864],
    "9:16": [864, 1536],
    "4:3": [1280, 960],
    "3:4": [960, 1280],
    "2:3": [832, 1248],
    "3:2": [1248, 832],
    "21:9": [1792, 768],
  };
  const [W, H] = map[ar ?? "1:1"] ?? [1024, 1024];
  return { width: W, height: H };
}

async function generateViaLovable(prompt: string, size: { width: number; height: number }, sourceUrl?: string | null): Promise<string> {
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY не настроен");
  const messages: any[] = [];
  const userContent: any[] = [{ type: "text", text: prompt }];
  if (sourceUrl) {
    userContent.push({ type: "image_url", image_url: { url: sourceUrl } });
  }
  messages.push({ role: "user", content: userContent });

  const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3.1-flash-image-preview",
      messages,
      modalities: ["image", "text"],
      size: `${size.width}x${size.height}`,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Lovable AI ошибка [${res.status}]: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error("Lovable AI: пустой ответ");
  return b64;
}

async function generateViaCustom(prompt: string, size: { width: number; height: number }, sourceUrl?: string | null): Promise<string> {
  if (!API_KEY) throw new Error("IMAGE_GEN_API_KEY не настроен. Добавьте секрет с ключом вашего сервиса генерации.");
  if (!PROVIDER_BASE) throw new Error("IMAGE_GEN_BASE_URL не настроен. Укажите URL вашего API.");
  const res = await fetch(PROVIDER_BASE, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      width: size.width,
      height: size.height,
      image: sourceUrl ?? undefined,
    }),
  });
  if (!res.ok) throw new Error(`Внешний API ошибка [${res.status}]: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const b64 = data?.b64_json ?? data?.image_b64 ?? data?.images?.[0]?.b64_json;
  if (b64) return b64;
  const url = data?.url ?? data?.image_url ?? data?.images?.[0]?.url;
  if (url) {
    const imgRes = await fetch(url);
    const buf = new Uint8Array(await imgRes.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    return btoa(bin);
  }
  throw new Error("Не удалось распарсить ответ внешнего API");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Не авторизовано" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Неверный токен" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as RequestBody;
    if (!body.product_id || !body.prompt) {
      return new Response(JSON.stringify({ error: "product_id и prompt обязательны" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const size = aspectToSize(body.aspect_ratio, body.width, body.height);
    const finalPrompt = body.prompt.replace(/\{product_name\}/g, product.name ?? "товар");

    let b64: string;
    try {
      if (PROVIDER === "custom") {
        b64 = await generateViaCustom(finalPrompt, size, body.source_image_url);
      } else {
        b64 = await generateViaLovable(finalPrompt, size, body.source_image_url);
      }
    } catch (genErr: any) {
      // Записываем неудачный job
      await admin.from("image_generation_jobs").insert({
        store_id: product.store_id,
        product_id: product.id,
        source_image_url: body.source_image_url,
        prompt: finalPrompt,
        aspect_ratio: body.aspect_ratio,
        width: size.width,
        height: size.height,
        status: "error",
        error_message: String(genErr?.message ?? genErr),
      });
      return new Response(JSON.stringify({ error: String(genErr?.message ?? genErr) }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Загружаем в storage
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const path = `${product.id}/ai/${Date.now()}_${Math.floor(Math.random() * 9999)}.png`;
    const { error: upErr } = await admin.storage
      .from("product-images")
      .upload(path, bytes, { contentType: "image/png", upsert: false });
    if (upErr) throw new Error(`Storage: ${upErr.message}`);

    const { data: pub } = admin.storage.from("product-images").getPublicUrl(path);
    const url = pub.publicUrl;

    await admin.from("image_generation_jobs").insert({
      store_id: product.store_id,
      product_id: product.id,
      source_image_url: body.source_image_url,
      prompt: finalPrompt,
      aspect_ratio: body.aspect_ratio,
      width: size.width,
      height: size.height,
      result_image_url: url,
      status: "success",
    });

    return new Response(JSON.stringify({ url, prompt: finalPrompt }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("generate-product-image error:", err);
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
