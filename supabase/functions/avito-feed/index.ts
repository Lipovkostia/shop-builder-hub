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

    if (!feedProducts || feedProducts.length === 0) {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<Ads FormatVersion="3" Target="Avito.ru">\n</Ads>`;
      return new Response(xml, {
        headers: { ...corsHeaders, "Content-Type": "application/xml; charset=UTF-8" },
      });
    }

    // Build XML
    let ads = '';
    for (const fp of feedProducts) {
      const product = (fp as any).products;
      if (!product || product.deleted_at) continue;

      const id = product.id.substring(0, 8);
      const params = (fp.avito_params && typeof fp.avito_params === 'object') ? fp.avito_params : {};
      const title = escapeXml(params.title || product.name || "Товар");
      const description = escapeXml(params.description || product.description || product.name || "");
      const price = params.Price || params.price || product.price || 0;
      const category = escapeXml(fp.avito_category || params.category || defaultCategory);
      const images = product.images || [];
      const address = escapeXml(fp.avito_address || params.address || defaultAddress);
      const adType = escapeXml(params.adType || params.goodsType || defaultAdType);
      const goodsType = escapeXml(params.GoodsType || params.goodsSubType || defaultGoodsType);
      const listingFee = escapeXml(params.listingFee || defaultListingFee);
      const contactMethod = escapeXml(params.contactMethod || defaultContactMethod);
      const contactPhone = escapeXml(params.contactPhone || defaultContactPhone);
      const managerName = escapeXml(params.managerName || defaultManagerName);

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
      // Promo settings
      const promo = params.promo || '';
      if (promo) {
        ads += `    <Promo>${escapeXml(promo)}</Promo>\n`;
        if (promo === 'Manual') {
          const manualOpts = [params.promoRegion, params.promoPrice, params.promoLimit].filter(Boolean).join(', ');
          if (manualOpts) ads += `    <PromoManualOptions>${escapeXml(manualOpts)}</PromoManualOptions>\n`;
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
        'promo', 'promoRegion', 'promoBudget', 'promoPrice', 'promoLimit',
        'cpcBid',
      ]);
      for (const [key, value] of Object.entries(params)) {
        if (value && !skipKeys.has(key)) {
          ads += `    <${escapeXml(key)}>${escapeXml(String(value))}</${escapeXml(key)}>\n`;
        }
      }
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
