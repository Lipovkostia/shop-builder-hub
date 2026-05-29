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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const storeId = url.searchParams.get("store_id");

    if (!storeId) {
      return new Response("Missing store_id", { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get avito account with feed_defaults
    const { data: avitoAccount } = await supabase
      .from("avito_accounts")
      .select("*")
      .eq("store_id", storeId)
      .single();

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

    // Get feed products with product data
    const { data: feedProducts, error } = await supabase
      .from("avito_feed_products")
      .select("*, products(*)")
      .eq("store_id", storeId);

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

      const id = product.id.substring(0, 8);
      const title = escapeXml(params.title || product.name || "Товар");
      const description = escapeXml(params.description || product.description || product.name || "");
      const price = params.Price || params.price || product.price || 0;
      const category = escapeXml(fp.avito_category || params.category || defaultCategory);
      const selectedImages: string[] = Array.isArray(params.avitoImages) && params.avitoImages.length > 0
        ? params.avitoImages
        : (product.images || []);
      const images = selectedImages;
      const address = escapeXml(fp.avito_address || params.address || defaultAddress);
      const adType = escapeXml(params.adType || params.goodsType || defaultAdType);
      const goodsType = escapeXml(params.GoodsType || params.goodsSubType || defaultGoodsType);
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
      // Promo settings
      const promo = params.promo || '';
      if (promo) {
        ads += `    <Promo>${escapeXml(promo)}</Promo>\n`;
        if (promo === 'Manual') {
          // Use promoManualOptions directly (multi-line: City|Price|Limit per line)
          const manualOpts = params.promoManualOptions || '';
          if (manualOpts) {
            ads += `    <PromoManualOptions>${escapeXml(manualOpts)}</PromoManualOptions>\n`;
          } else {
            // Fallback to legacy separate fields
            const legacyOpts = [params.promoRegion, params.promoPrice, params.promoLimit].filter(Boolean).join('|');
            if (legacyOpts) ads += `    <PromoManualOptions>${escapeXml(legacyOpts)}</PromoManualOptions>\n`;
          }
        } else if (promo.startsWith('Auto')) {
          const autoOpts = [params.promoRegion, params.promoBudget].filter(Boolean).join(', ');
          if (autoOpts) ads += `    <PromoAutoOptions>${escapeXml(autoOpts)}</PromoAutoOptions>\n`;
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
      const title = escapeXml(v.title || product.name || "Товар");
      const description = escapeXml(v.description || product.description || product.name || "");
      const price = v.price ?? params.Price ?? params.price ?? product.price ?? 0;
      const category = escapeXml(v.avito_category || params.category || defaultCategory);
      const images = (v.images && v.images.length ? v.images : product.images) || [];
      const address = escapeXml(v.avito_address || params.address || defaultAddress);
      const adType = escapeXml(params.adType || params.goodsType || defaultAdType);
      const goodsType = escapeXml(params.GoodsType || params.goodsSubType || defaultGoodsType);
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
