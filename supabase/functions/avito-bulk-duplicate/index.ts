// Edge function: avito-bulk-duplicate
// Создаёт N уникальных дублей объявления Авито в таблице avito_listing_variants.
// — AI-перефраз названия и описания (через VSEGPT),
// — Перезалив фото с новыми URL в bucket avito-images,
// — Хвост случайных байт в JPEG (новый md5/etag),
// — Джиттер цены,
// — Уникальный артикул ART-XXXX в описание.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface DuplicateOptions {
  rewriteTitle?: boolean;
  rewriteDescription?: boolean;
  reuploadImages?: boolean;
  jitterPrice?: boolean;
  instruction?: string;
}

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shortHash(seed: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36).toUpperCase().slice(0, 6);
}

function fileExtFromUrl(url: string, contentType?: string | null): string {
  try {
    const u = new URL(url);
    const p = u.pathname.toLowerCase();
    const m = p.match(/\.(jpe?g|png|webp|gif|bmp)$/);
    if (m) return m[1] === "jpeg" ? "jpg" : m[1];
  } catch {}
  const ct = (contentType || "").toLowerCase();
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("gif")) return "gif";
  return "jpg";
}

async function rewriteWithAi(opts: {
  apiKey: string;
  model: string;
  count: number;
  baseTitle: string;
  baseDescription: string;
  rewriteTitle: boolean;
  rewriteDescription: boolean;
  instruction?: string;
}): Promise<Array<{ title?: string; description?: string }>> {
  const {
    apiKey, model, count, baseTitle, baseDescription,
    rewriteTitle, rewriteDescription, instruction,
  } = opts;
  if (!rewriteTitle && !rewriteDescription) {
    return Array.from({ length: count }, () => ({}));
  }

  const fields: string[] = [];
  if (rewriteTitle) fields.push(`"title" (до 50 символов)`);
  if (rewriteDescription) fields.push(`"description" (сохрани характеристики, эмодзи, структуру)`);

  const sys = `Ты — копирайтер для Авито. Сгенерируй ${count} УНИКАЛЬНЫХ перефразированных вариантов объявления.
Каждый вариант должен сохранять смысл и характеристики оригинала, но отличаться словами, порядком предложений и формулировками, чтобы антифрод Авито считал каждый вариант НОВЫМ объявлением.
Поля для каждого варианта: ${fields.join(", ")}.

ЖЁСТКИЕ ОГРАНИЧЕНИЯ:
- НЕ вставляй телефоны, e-mail, ссылки, мессенджеры, контакты.
- НЕ пиши КАПСОМ слова целиком.
- НЕ используй маркетинговый спам ("СУПЕР", "АКЦИЯ!!!").
- Между вариантами тексты должны заметно отличаться (минимум 40% слов другие или другой порядок).
${instruction ? `\nДополнительная инструкция продавца: ${instruction}` : ""}

Ответь ТОЛЬКО валидным JSON без markdown: {"variants":[{"title":"...","description":"..."}, ...]}.
Если поле не запрашивается — не включай его.`;

  const user = `Оригинал:
Название: ${baseTitle}
Описание: ${baseDescription || "(нет описания)"}

Сгенерируй ${count} уникальных вариантов.`;

  const resp = await fetch("https://api.vsegpt.ru/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      temperature: 0.9,
      response_format: { type: "json_object" },
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`VSEGPT error ${resp.status}: ${t.slice(0, 300)}`);
  }
  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || "{}";
  let parsed: any = {};
  try { parsed = JSON.parse(content); } catch {
    const m = content.match(/\{[\s\S]*\}/);
    if (m) parsed = JSON.parse(m[0]);
  }
  const arr = Array.isArray(parsed?.variants) ? parsed.variants : [];
  // Дополняем, если AI вернул меньше
  while (arr.length < count) arr.push({});
  return arr.slice(0, count);
}

async function reuploadImage(opts: {
  sb: any;
  sourceUrl: string;
  storeId: string;
  productId: string;
  variantId: string;
  idx: number;
}): Promise<string | null> {
  const { sb, sourceUrl, storeId, productId, variantId, idx } = opts;
  try {
    const res = await fetch(sourceUrl);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type");
    const ext = fileExtFromUrl(sourceUrl, ct);
    const buf = new Uint8Array(await res.arrayBuffer());

    // Добавляем 24 случайных байт в конец для другого ETag/MD5/pHash payload.
    // JPEG/PNG/WEBP декодеры игнорируют хвостовые данные после конца стрима.
    const tail = new Uint8Array(24);
    crypto.getRandomValues(tail);
    const merged = new Uint8Array(buf.length + tail.length);
    merged.set(buf, 0);
    merged.set(tail, buf.length);

    const path = `duplicates/${storeId}/${productId}/${variantId}/${idx}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const { error } = await sb.storage
      .from("avito-images")
      .upload(path, merged, {
        contentType: ct || (ext === "png" ? "image/png" : "image/jpeg"),
        upsert: false,
      });
    if (error) {
      console.error("upload error", error);
      return null;
    }
    const { data: pub } = sb.storage.from("avito-images").getPublicUrl(path);
    return pub?.publicUrl || null;
  } catch (e) {
    console.error("reuploadImage failed", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const body = await req.json();
    const storeId: string = body.storeId;
    const sourceProductId: string = body.sourceProductId;
    const count: number = Math.max(1, Math.min(20, Number(body.count) || 1));
    const options: DuplicateOptions = body.options || {};
    const rewriteTitle = options.rewriteTitle !== false;
    const rewriteDescription = options.rewriteDescription !== false;
    const reuploadImages = options.reuploadImages !== false;
    const jitterPrice = options.jitterPrice !== false;
    const instruction = options.instruction;

    if (!storeId || !sourceProductId) {
      return new Response(JSON.stringify({ error: "storeId и sourceProductId обязательны" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Проверяем владельца магазина по JWT
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");
    let userId: string | null = null;
    if (jwt) {
      const { data: u } = await sb.auth.getUser(jwt);
      userId = u?.user?.id || null;
    }
    if (!userId) {
      return new Response(JSON.stringify({ error: "Не авторизован" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: ownerCheck } = await sb.rpc("is_store_owner", { _store_id: storeId, _user_id: userId });
    if (!ownerCheck) {
      return new Response(JSON.stringify({ error: "Нет доступа к магазину" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Базовые данные товара + текущая запись фида
    const { data: product, error: prodErr } = await sb
      .from("products")
      .select("id, name, description, price, images")
      .eq("id", sourceProductId)
      .maybeSingle();
    if (prodErr || !product) {
      return new Response(JSON.stringify({ error: "Товар не найден" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: feedRow } = await sb
      .from("avito_feed_products")
      .select("avito_params, avito_category, avito_address")
      .eq("store_id", storeId)
      .eq("product_id", sourceProductId)
      .limit(1)
      .maybeSingle();

    const baseParams = (feedRow?.avito_params as Record<string, any>) || {};
    const baseTitle: string = baseParams.title || product.name || "";
    const baseDescription: string = baseParams.description || product.description || "";
    const basePrice: number | null = (baseParams.price != null ? Number(baseParams.price) : null) ?? (product.price != null ? Number(product.price) : null);
    const baseImages: string[] = Array.isArray(baseParams.avitoImages) && baseParams.avitoImages.length
      ? baseParams.avitoImages
      : (Array.isArray(product.images) ? product.images : []);
    const baseCategory = feedRow?.avito_category || baseParams.category || null;
    const baseAddress = feedRow?.avito_address || baseParams.address || null;

    // Модель AI и ключ
    let aiModel = "openai/gpt-4.1-mini";
    const { data: aiAccess } = await sb
      .from("store_ai_access")
      .select("is_unlocked, avito_descriptions_enabled, avito_descriptions_model")
      .eq("store_id", storeId)
      .maybeSingle();
    if (rewriteTitle || rewriteDescription) {
      if (!aiAccess?.is_unlocked || !aiAccess?.avito_descriptions_enabled) {
        return new Response(JSON.stringify({ error: "Включите доступ к ИИ (Avito descriptions) в настройках, чтобы переписывать тексты." }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      aiModel = aiAccess.avito_descriptions_model || aiModel;
    }
    const VSEGPT_API_KEY = Deno.env.get("VSEGPT_API_KEY");
    if ((rewriteTitle || rewriteDescription) && !VSEGPT_API_KEY) {
      return new Response(JSON.stringify({ error: "VSEGPT_API_KEY не настроен" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Генерим тексты пачкой
    const texts = (rewriteTitle || rewriteDescription)
      ? await rewriteWithAi({
          apiKey: VSEGPT_API_KEY!,
          model: aiModel,
          count,
          baseTitle,
          baseDescription,
          rewriteTitle,
          rewriteDescription,
          instruction,
        })
      : Array.from({ length: count }, () => ({} as any));

    // Максимальный seed среди уже существующих вариантов
    const { data: existing } = await sb
      .from("avito_listing_variants")
      .select("unique_seed")
      .eq("source_product_id", sourceProductId)
      .order("unique_seed", { ascending: false })
      .limit(1);
    const baseSeed = (existing && existing[0]?.unique_seed) ? Number(existing[0].unique_seed) : 0;

    const createdIds: string[] = [];
    const errors: Array<{ i: number; error: string }> = [];

    for (let i = 0; i < count; i++) {
      const seed = baseSeed + i + 1;
      const variantId = crypto.randomUUID();
      const aiVariant = texts[i] || {};
      const newTitle = (rewriteTitle && aiVariant.title)
        ? String(aiVariant.title).slice(0, 50)
        : baseTitle;

      const article = `ART-${shortHash(sourceProductId + seed)}-${rand(100, 999)}`;
      let newDescription = (rewriteDescription && aiVariant.description)
        ? String(aiVariant.description)
        : baseDescription;
      // Добавляем артикул в конец, если его там ещё нет
      if (!/ART-[A-Z0-9]+-\d+/.test(newDescription)) {
        newDescription = `${newDescription}\n\nАртикул: ${article}`.trim();
      }

      let newPrice = basePrice;
      if (jitterPrice && basePrice != null && basePrice > 50) {
        const delta = rand(3, 10) * (Math.random() < 0.5 ? -1 : 1);
        newPrice = Math.max(1, Math.round(basePrice + delta));
      }

      let newImages: string[] = baseImages.slice();
      if (reuploadImages && baseImages.length > 0) {
        const uploaded: string[] = [];
        for (let idx = 0; idx < baseImages.length; idx++) {
          const u = await reuploadImage({
            sb,
            sourceUrl: baseImages[idx],
            storeId,
            productId: sourceProductId,
            variantId,
            idx,
          });
          if (u) uploaded.push(u);
        }
        if (uploaded.length > 0) {
          // Перетасуем порядок по сидy
          newImages = uploaded.sort(() => (Math.random() < 0.5 ? -1 : 1));
        } else {
          // Если ни одно фото не перезалилось — fallback к cache-bust URL
          newImages = baseImages.map((u) => {
            const sep = u.includes("?") ? "&" : "?";
            return `${u}${sep}v=${shortHash(variantId + idx)}`;
          });
        }
      }

      const newParams: Record<string, any> = {
        ...baseParams,
        title: newTitle,
        description: newDescription,
        price: newPrice ?? baseParams.price,
        avitoImages: newImages,
        article,
      };

      const { error: insErr } = await sb
        .from("avito_listing_variants")
        .insert({
          id: variantId,
          store_id: storeId,
          source_product_id: sourceProductId,
          variant_label: `Дубль ${seed}`,
          title: newTitle,
          description: newDescription,
          images: newImages,
          price: newPrice,
          avito_category: baseCategory,
          avito_address: baseAddress,
          avito_params: newParams,
          unique_seed: seed,
          status: "queued",
        });
      if (insErr) {
        errors.push({ i, error: insErr.message });
      } else {
        createdIds.push(variantId);
      }
    }

    return new Response(JSON.stringify({
      created: createdIds.length,
      variantIds: createdIds,
      errors,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("avito-bulk-duplicate error", e);
    return new Response(JSON.stringify({ error: e?.message || "Внутренняя ошибка" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
