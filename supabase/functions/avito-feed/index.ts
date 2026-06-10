import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildPromoAutoXml(raw: string): string {
  const items = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).map((line) => {
    const [region, budget] = line.split('|').map((s) => (s ?? '').trim());
    const parts: string[] = [];
    if (region) parts.push(`        <Region>${escapeXml(region)}</Region>`);
    if (budget) parts.push(`        <Budget>${escapeXml(budget)}</Budget>`);
    return parts.length ? `      <Item>\n${parts.join('\n')}\n      </Item>` : '';
  }).filter(Boolean);
  return items.length ? `    <PromoAutoOptions>\n${items.join('\n')}\n    </PromoAutoOptions>\n` : '';
}

function buildPromoManualXml(raw: string): string {
  const items = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).map((line) => {
    const [region, bid, limit] = line.split('|').map((s) => (s ?? '').trim());
    const parts: string[] = [];
    if (region) parts.push(`        <Region>${escapeXml(region)}</Region>`);
    if (bid)    parts.push(`        <Bid>${escapeXml(bid)}</Bid>`);
    if (limit)  parts.push(`        <DailyLimit>${escapeXml(limit)}</DailyLimit>`);
    return parts.length ? `      <Item>\n${parts.join('\n')}\n      </Item>` : '';
  }).filter(Boolean);
  return items.length ? `    <PromoManualOptions>\n${items.join('\n')}\n    </PromoManualOptions>\n` : '';
}

function applyTitlePrefix(title: string, prefix: string): string {
  const p = (prefix || '').trim();
  if (!p) return title || '';
  const t = (title || '').trim();
  if (/^опт\b[\s:.,\-]*/i.test(t)) return t;
  return `${p} ${t}`.replace(/\s{2,}/g, ' ').trim();
}

function applyDescriptionFirstLine(desc: string, firstLine: string): string {
  const fl = (firstLine || '').trim();
  if (!fl) return desc || '';
  const d = (desc || '').trim();
  if (d.slice(0, 300).toLowerCase().includes(fl.toLowerCase())) return d;
  return d ? `${fl}\n\n${d}` : fl;
}




Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const storeId = url.searchParams.get("store_id");
    const accountIdParam = url.searchParams.get("account") || url.searchParams.get("account_id");

    if (!storeId) {
      return new Response("Missing store_id", { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get avito account: by id if provided, else default-for-store
    let avitoAccount: any = null;
    if (accountIdParam) {
      const { data } = await supabase
        .from("avito_accounts").select("*").eq("id", accountIdParam).maybeSingle();
      avitoAccount = data;
    } else {
      const { data } = await supabase
        .from("avito_accounts").select("*")
        .eq("store_id", storeId)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(1);
      avitoAccount = (data && data[0]) || null;
    }
    const accountId = avitoAccount?.id || null;

    const fd = (avitoAccount?.feed_defaults && typeof avitoAccount.feed_defaults === 'object') ? avitoAccount.feed_defaults as any : {};

    // Defaults from DB (feed_defaults), fallback to query params for backward compat
    const defaultAddress = fd.address || url.searchParams.get("address") || "";
    const defaultCategory = fd.category || url.searchParams.get("category") || "Продукты питания";
    const defaultGoodsType = fd.goodsSubType || url.searchParams.get("goods_type") || "Товар приобретен на продажу";
    const defaultAdType = fd.goodsType || url.searchParams.get("ad_type") || "Товар приобретен на продажу";
    const defaultListingFee = fd.listingFee || "Package";
    const defaultContactMethod = fd.contactMethod || "По телефону и в сообщениях";
    const defaultContactPhone = fd.contactPhone || "";
    const defaultManagerName = fd.managerName || "";
    const defaultEmail = fd.email || "";
    const defaultCompanyName = fd.companyName || "";
    const defaultTargetAudience = fd.targetAudience || "";
    const defaultTitlePrefix = (fd.titlePrefix !== undefined && fd.titlePrefix !== null)
      ? String(fd.titlePrefix)
      : "Опт:";
    const defaultDescriptionFirstLine = (fd.descriptionFirstLine !== undefined && fd.descriptionFirstLine !== null)
      ? String(fd.descriptionFirstLine)
      : "Продажа только в опт от 15 тыс. ₽ заказ";
    const applyGlobalPrefix = fd.applyGlobalPrefix !== false; // default ON
    const defaultPriceSource: "manual" | "moysklad" = (fd.priceSource === "manual") ? "manual" : "moysklad";

    function resolvePrice(params: any, productPrice: number | null | undefined, source?: string): number {
      const eff = (source === "manual" || source === "moysklad") ? source : defaultPriceSource;
      if (eff === "manual") {
        const v = Number(params.Price ?? params.price);
        return Number.isFinite(v) && v > 0 ? v : 0;
      }
      // moysklad/sync
      const ms = Number(productPrice);
      if (Number.isFinite(ms) && ms > 0) return ms;
      const fallback = Number(params.Price ?? params.price);
      return Number.isFinite(fallback) && fallback > 0 ? fallback : 0;
    }


    // Get feed products with product data; scope by account_id (if any) and optionally by tab_id
    const tabId = url.searchParams.get("tab_id");
    let feedQuery = supabase
      .from("avito_feed_products")
      .select("*, products(*)")
      .eq("store_id", storeId);
    if (accountId) feedQuery = feedQuery.eq("account_id", accountId);
    if (tabId) feedQuery = feedQuery.eq("tab_id", tabId);
    const { data: feedProducts, error } = await feedQuery;

    if (error) throw error;

    // Get listing variants (unique duplicates) — mixed into the feed as separate ads
    const { data: variants } = await supabase
      .from("avito_listing_variants")
      .select("*, products:source_product_id(*)")
      .eq("store_id", storeId)
      .in("status", ["draft", "queued", "published", "moderation_error"]);

    const hasAny = (feedProducts && feedProducts.length > 0) || (variants && variants.length > 0);
    if (!hasAny) {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<Ads FormatVersion="3" Target="Avito.ru">\n</Ads>`;
      return new Response(xml, {
        headers: { ...corsHeaders, "Content-Type": "application/xml; charset=UTF-8" },
      });
    }

    // Build XML
    let ads = '';
    let skippedExcluded = 0;
    for (const fp of feedProducts) {
      const product = (fp as any).products;
      if (!product || product.deleted_at) continue;

      const params = (fp.avito_params && typeof fp.avito_params === 'object') ? fp.avito_params : {};
      if (params.excluded_from_feed === true) { skippedExcluded++; continue; }

      // ID должен быть уникальным в рамках Avito-аккаунта. Чтобы карточки одного товара
      // в разных вкладках-городах не считались дублями, добавляем к ID суффикс вкладки.
      const tabSuffix = fp.tab_id ? `-${String(fp.tab_id).replace(/-/g, '').substring(0, 6)}` : '';
      const id = product.id.substring(0, 8) + tabSuffix;
      const rawTitle = params.title || product.name || "Товар";
      const rawDescription = params.description || product.description || product.name || "";
      const finalTitle = applyGlobalPrefix ? applyTitlePrefix(rawTitle, defaultTitlePrefix) : rawTitle;
      const finalDescription = applyGlobalPrefix ? applyDescriptionFirstLine(rawDescription, defaultDescriptionFirstLine) : rawDescription;
      const title = escapeXml(finalTitle);
      const description = escapeXml(finalDescription);
      const price = params.Price || params.price || product.price || 0;
      // Defensive split: if category is a hierarchical path "A---B---C", use level 2 as <Category> and leaf as <GoodsType>
      let rawCategory = fp.avito_category || params.category || defaultCategory;
      let derivedGoodsSubType = params.GoodsType || params.goodsSubType || "";
      if (typeof rawCategory === "string" && rawCategory.includes("---")) {
        const parts = rawCategory.split("---").map((s: string) => s.trim()).filter(Boolean);
        rawCategory = parts.length >= 2 ? parts[1] : parts[0];
        if (!derivedGoodsSubType && parts.length >= 3) derivedGoodsSubType = parts[parts.length - 1];
      }
      const category = escapeXml(rawCategory);
      const selectedImages: string[] = Array.isArray(params.avitoImages) && params.avitoImages.length > 0
        ? params.avitoImages
        : (product.images || []);
      const images = selectedImages;
      const address = escapeXml(fp.avito_address || params.address || defaultAddress);
      const adType = escapeXml(params.adType || params.goodsType || defaultAdType);
      const goodsType = escapeXml(derivedGoodsSubType || defaultGoodsType);
      const listingFee = escapeXml(params.listingFee || defaultListingFee);
      const contactMethod = escapeXml(params.contactMethod || defaultContactMethod);
      const contactPhone = escapeXml(params.contactPhone || defaultContactPhone);
      const managerName = escapeXml(params.managerName || defaultManagerName);
      const email = escapeXml(params.email || defaultEmail);
      const companyName = escapeXml(params.companyName || defaultCompanyName);
      const avitoNumber = params.avitoNumber || '';
      const avitoStatus = params.avitoStatus || '';

      let imagesXml = "";
      if (images.length > 0) {
        imagesXml = "    <Images>\n";
        for (const img of images.slice(0, 10)) {
          if (/[_\-](thumb|small|xs|50x|100x|150x)/i.test(img)) continue;
          imagesXml += `      <Image url="${escapeXml(img)}" />\n`;
        }
        imagesXml += "    </Images>\n";
      }

      ads += `  <Ad>\n`;
      ads += `    <Id>${escapeXml(id)}</Id>\n`;
      ads += `    <AdType>${adType}</AdType>\n`;
      ads += `    <Title>${title}</Title>\n`;
      ads += `    <Description>${description}</Description>\n`;
      ads += `    <Price>${price}</Price>\n`;
      ads += `    <Category>${category}</Category>\n`;
      if (address) {
        ads += `    <Address>${address}</Address>\n`;
      }
      if (goodsType) {
        ads += `    <GoodsType>${goodsType}</GoodsType>\n`;
      }
      // Required fields for publishing
      ads += `    <ListingFee>${listingFee}</ListingFee>\n`;
      ads += `    <ContactMethod>${contactMethod}</ContactMethod>\n`;
      if (contactPhone) {
        ads += `    <ContactPhone>${contactPhone}</ContactPhone>\n`;
      }
      if (managerName) {
        ads += `    <ManagerName>${managerName}</ManagerName>\n`;
      }
      if (email) {
        ads += `    <Email>${email}</Email>\n`;
      }
      if (companyName) {
        ads += `    <CompanyName>${companyName}</CompanyName>\n`;
      }
      if (avitoNumber) {
        ads += `    <AvitoId>${escapeXml(avitoNumber)}</AvitoId>\n`;
      }
      // Promo settings — per Avito spec, container with nested <Item>
      const promo = params.promo || '';
      if (promo) {
        ads += `    <Promo>${escapeXml(promo)}</Promo>\n`;
        if (promo === 'Manual') {
          let raw = String(params.promoManualOptions || '').trim();
          if (!raw) {
            const legacy = [params.promoRegion, params.promoPrice, params.promoLimit]
              .map((v: any) => (v == null ? '' : String(v))).join('|');
            if (legacy.replace(/\|/g, '').trim()) raw = legacy;
          }
          ads += buildPromoManualXml(raw);
        } else if (promo.startsWith('Auto')) {
          let raw = String(params.promoAutoOptions || '').trim();
          if (!raw) {
            const legacy = [params.promoRegion, params.promoBudget]
              .map((v: any) => (v == null ? '' : String(v))).join('|');
            if (legacy.replace(/\|/g, '').trim()) raw = legacy;
          }
          ads += buildPromoAutoXml(raw);
        }
      }
      // CPC bid
      const cpcBid = params.cpcBid || '';
      if (cpcBid) {
        ads += `    <CPC>${escapeXml(String(cpcBid))}</CPC>\n`;
      }
      ads += imagesXml;
      // Additional params — skip keys already handled above
      const skipKeys = new Set([
        'Price', 'price', 'title', 'description', 'category', 'address',
        'avitoId', 'avitoNumber', 'listingFee', 'contactMethod', 'contactPhone',
        'managerName', 'email', 'companyName', 'avitoStatus', 'dateEnd',
        'goodsType', 'goodsSubType', 'targetAudience', 'includeVAT',
        'adType', 'AdType', 'GoodsType',
        'promo', 'promoRegion', 'promoBudget', 'promoPrice', 'promoLimit', 'promoManualOptions',
        'cpcBid', 'CompanyName', 'Email', 'AvitoId', 'ManagerName', 'ContactPhone',
      ]);
      for (const [key, value] of Object.entries(params)) {
        if (value && !skipKeys.has(key)) {
          ads += `    <${escapeXml(key)}>${escapeXml(String(value))}</${escapeXml(key)}>\n`;
        }
      }
      ads += `  </Ad>\n`;
    }

    // Append variant ads (unique duplicates of products). Each variant gets a unique <Id>
    // prefixed with "v-" so Avito treats it as a separate listing.
    for (const v of (variants || [])) {
      const product = (v as any).products;
      if (!product || product.deleted_at) continue;
      if (v.status === "archived") continue;

      const id = `v-${String(v.id).substring(0, 10)}`;
      const params = (v.avito_params && typeof v.avito_params === "object") ? v.avito_params : {};
      const rawTitleV = v.title || product.name || "Товар";
      const rawDescriptionV = v.description || product.description || product.name || "";
      const finalTitleV = applyGlobalPrefix ? applyTitlePrefix(rawTitleV, defaultTitlePrefix) : rawTitleV;
      const finalDescriptionV = applyGlobalPrefix ? applyDescriptionFirstLine(rawDescriptionV, defaultDescriptionFirstLine) : rawDescriptionV;
      const title = escapeXml(finalTitleV);
      const description = escapeXml(finalDescriptionV);
      const price = v.price ?? params.Price ?? params.price ?? product.price ?? 0;
      let rawCategoryV = v.avito_category || params.category || defaultCategory;
      let derivedGoodsSubTypeV = params.GoodsType || params.goodsSubType || "";
      if (typeof rawCategoryV === "string" && rawCategoryV.includes("---")) {
        const parts = rawCategoryV.split("---").map((s: string) => s.trim()).filter(Boolean);
        rawCategoryV = parts.length >= 2 ? parts[1] : parts[0];
        if (!derivedGoodsSubTypeV && parts.length >= 3) derivedGoodsSubTypeV = parts[parts.length - 1];
      }
      const category = escapeXml(rawCategoryV);
      const images = (v.images && v.images.length ? v.images : product.images) || [];
      const address = escapeXml(v.avito_address || params.address || defaultAddress);
      const adType = escapeXml(params.adType || params.goodsType || defaultAdType);
      const goodsType = escapeXml(derivedGoodsSubTypeV || defaultGoodsType);
      const listingFee = escapeXml(params.listingFee || defaultListingFee);
      const contactMethod = escapeXml(params.contactMethod || defaultContactMethod);
      const contactPhone = escapeXml(params.contactPhone || defaultContactPhone);
      const managerName = escapeXml(params.managerName || defaultManagerName);
      const email = escapeXml(params.email || defaultEmail);
      const companyName = escapeXml(params.companyName || defaultCompanyName);

      let imagesXml = "";
      if (images.length > 0) {
        imagesXml = "    <Images>\n";
        for (const img of images.slice(0, 10)) {
          if (/[_\-](thumb|small|xs|50x|100x|150x)/i.test(img)) continue;
          imagesXml += `      <Image url="${escapeXml(img)}" />\n`;
        }
        imagesXml += "    </Images>\n";
      }

      ads += `  <Ad>\n`;
      ads += `    <Id>${escapeXml(id)}</Id>\n`;
      ads += `    <AdType>${adType}</AdType>\n`;
      ads += `    <Title>${title}</Title>\n`;
      ads += `    <Description>${description}</Description>\n`;
      ads += `    <Price>${price}</Price>\n`;
      ads += `    <Category>${category}</Category>\n`;
      if (address) ads += `    <Address>${address}</Address>\n`;
      if (goodsType) ads += `    <GoodsType>${goodsType}</GoodsType>\n`;
      ads += `    <ListingFee>${listingFee}</ListingFee>\n`;
      ads += `    <ContactMethod>${contactMethod}</ContactMethod>\n`;
      if (contactPhone) ads += `    <ContactPhone>${contactPhone}</ContactPhone>\n`;
      if (managerName) ads += `    <ManagerName>${managerName}</ManagerName>\n`;
      if (email) ads += `    <Email>${email}</Email>\n`;
      if (companyName) ads += `    <CompanyName>${companyName}</CompanyName>\n`;
      ads += imagesXml;
      ads += `  </Ad>\n`;
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<Ads FormatVersion="3" Target="Avito.ru">\n${ads}</Ads>`;

    return new Response(xml, {
      headers: { ...corsHeaders, "Content-Type": "application/xml; charset=UTF-8" },
    });
  } catch (err: any) {
    console.error("Avito feed error:", err);
    return new Response(`Error: ${err.message}`, {
      status: 500,
      headers: corsHeaders,
    });
  }
});
