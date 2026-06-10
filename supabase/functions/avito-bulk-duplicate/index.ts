// Edge function: avito-bulk-duplicate
// Создаёт N уникальных дублей товара (как РЕАЛЬНЫЕ products, привязанные к исходному
// через duplicate_of_product_id). Для каждого дубля копируются строки avito_feed_products
// (по всем городам/группам) с уникальными заголовком/описанием/фото/ценой/артикулом.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface DuplicateOptions {
  // Strategies
  titleStrategy?: "ai" | "shuffle" | "prefix" | "suffix" | "epithet" | "none";
  titleExtras?: string[];
  descStrategy?: "ai" | "prepend" | "append" | "wrap" | "none";
  descExtraTop?: string;
  descExtraBottom?: string;
  // Back-compat / other
  rewriteTitle?: boolean;
  rewriteDescription?: boolean;
  reuploadImages?: boolean;
  jitterPrice?: boolean;
  instruction?: string;
}

function shuffleWords(s: string, seed: number): string {
  if (!s) return s;
  // Keep first capitalized word in place; shuffle middle tokens; preserve trailing punctuation.
  const tokens = s.trim().split(/\s+/);
  if (tokens.length < 3) return s;
  const first = tokens[0];
  const middle = tokens.slice(1, tokens.length - 1);
  const last = tokens[tokens.length - 1];
  // simple seeded shuffle
  for (let i = middle.length - 1; i > 0; i--) {
    seed = (seed * 9301 + 49297) % 233280;
    const j = Math.floor((seed / 233280) * (i + 1));
    [middle[i], middle[j]] = [middle[j], middle[i]];
  }
  return [first, ...middle, last].join(" ");
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
  while (arr.length < count) arr.push({});
  return arr.slice(0, count);
}

async function reuploadImage(opts: {
  sb: any;
  sourceUrl: string;
  storeId: string;
  productId: string;
  dupProductId: string;
  idx: number;
}): Promise<string | null> {
  const { sb, sourceUrl, storeId, productId, dupProductId, idx } = opts;
  try {
    const res = await fetch(sourceUrl);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type");
    const ext = fileExtFromUrl(sourceUrl, ct);
    const buf = new Uint8Array(await res.arrayBuffer());
    const tail = new Uint8Array(24);
    crypto.getRandomValues(tail);
    const merged = new Uint8Array(buf.length + tail.length);
    merged.set(buf, 0);
    merged.set(tail, buf.length);
    const path = `duplicates/${storeId}/${productId}/${dupProductId}/${idx}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
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

    const { data: product, error: prodErr } = await sb
      .from("products")
      .select("*")
      .eq("id", sourceProductId)
      .maybeSingle();
    if (prodErr || !product) {
      return new Response(JSON.stringify({ error: "Товар не найден" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Все строки фида исходного товара (по всем городам/группам)
    const { data: feedRows } = await sb
      .from("avito_feed_products")
      .select("*")
      .eq("store_id", storeId)
      .eq("product_id", sourceProductId);

    const primaryFeed = feedRows && feedRows[0];
    const baseParams = (primaryFeed?.avito_params as Record<string, any>) || {};
    const baseTitle: string = baseParams.title || product.name || "";
    const baseDescription: string = baseParams.description || product.description || "";
    const basePrice: number | null =
      (baseParams.price != null ? Number(baseParams.price) : null) ??
      (product.price != null ? Number(product.price) : null);
    const baseImages: string[] = Array.isArray(baseParams.avitoImages) && baseParams.avitoImages.length
      ? baseParams.avitoImages
      : (Array.isArray(product.images) ? product.images : []);

    // AI access
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

    // Сколько уже существует дублей у этого товара (для нумерации)
    const { count: existingDups } = await sb
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("duplicate_of_product_id", sourceProductId);
    const baseSeed = existingDups || 0;

    const createdProductIds: string[] = [];
    const errors: Array<{ i: number; error: string }> = [];

    for (let i = 0; i < count; i++) {
      const seed = baseSeed + i + 1;
      const newProductId = crypto.randomUUID();
      const aiVariant = texts[i] || {};
      const newTitle = (rewriteTitle && aiVariant.title)
        ? String(aiVariant.title).slice(0, 100)
        : `${baseTitle} (дубль ${seed})`;
      const article = `ART-${shortHash(sourceProductId + seed)}-${rand(100, 999)}`;
      let newDescription = (rewriteDescription && aiVariant.description)
        ? String(aiVariant.description)
        : baseDescription;
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
            dupProductId: newProductId,
            idx,
          });
          if (u) uploaded.push(u);
        }
        if (uploaded.length > 0) {
          newImages = uploaded.sort(() => (Math.random() < 0.5 ? -1 : 1));
        } else {
          newImages = baseImages.map((u) => {
            const sep = u.includes("?") ? "&" : "?";
            return `${u}${sep}v=${shortHash(newProductId + idx)}`;
          });
        }
      }

      // Готовим строку нового товара (клон, с заменёнными полями)
      const baseSlug = (product.slug || `dup-${shortHash(sourceProductId)}`).slice(0, 60);
      const newSlug = `${baseSlug}-d${seed}-${shortHash(newProductId).toLowerCase()}`;

      const productInsert: Record<string, any> = {
        ...product,
        id: newProductId,
        slug: newSlug,
        name: newTitle,
        description: newDescription,
        price: newPrice ?? product.price,
        images: newImages,
        sku: article,
        moysklad_id: null,
        moysklad_account_id: null,
        auto_sync: false,
        canonical_product_id: null,
        duplicate_of_product_id: sourceProductId,
        source: "avito_duplicate",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };

      const { error: insProdErr } = await sb.from("products").insert(productInsert);
      if (insProdErr) {
        errors.push({ i, error: `products: ${insProdErr.message}` });
        continue;
      }

      // Клонируем строки avito_feed_products для нового товара
      if (feedRows && feedRows.length > 0) {
        const feedInserts = feedRows.map((fr: any) => {
          const params = { ...(fr.avito_params || {}) };
          params.title = newTitle;
          params.description = newDescription;
          if (newPrice != null) {
            params.price = newPrice;
            params.Price = newPrice;
          }
          params.avitoImages = newImages;
          params.article = article;
          // Очищаем модерационные следы, чтобы при следующей выгрузке считалось новым
          delete params.moderation;
          delete params.avitoId;
          delete params.avitoNumber;
          return {
            store_id: storeId,
            product_id: newProductId,
            avito_category: fr.avito_category,
            avito_address: fr.avito_address,
            avito_params: params,
            tab_id: fr.tab_id,
            group_id: fr.group_id,
            account_id: fr.account_id,
            photo_order: fr.photo_order,
          };
        });
        const { error: feedErr } = await sb.from("avito_feed_products").insert(feedInserts);
        if (feedErr) {
          errors.push({ i, error: `feed: ${feedErr.message}` });
        }
      }

      createdProductIds.push(newProductId);
    }

    return new Response(JSON.stringify({
      created: createdProductIds.length,
      productIds: createdProductIds,
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
