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

    // Store-level defaults from query params
    const defaultAddress = url.searchParams.get("address") || "";
    const defaultCategory = url.searchParams.get("category") || "Продукты питания";
    const defaultGoodsType = url.searchParams.get("goods_type") || "Товар приобретен на продажу";
    const defaultAdType = url.searchParams.get("ad_type") || "Товар приобретен на продажу";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get avito account for address default
    const { data: avitoAccount } = await supabase
      .from("avito_accounts")
      .select("*")
      .eq("store_id", storeId)
      .single();

    // Get store info
    const { data: store } = await supabase
      .from("stores")
      .select("name")
      .eq("id", storeId)
      .single();

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
      const category = escapeXml(fp.avito_category || params.category || "Продукты питания");
      const images = product.images || [];
      const address = escapeXml(fp.avito_address || params.address || "");

      let imagesXml = "";
      if (images.length > 0) {
        imagesXml = "    <Images>\n";
        for (const img of images.slice(0, 10)) {
          imagesXml += `      <Image url="${escapeXml(img)}" />\n`;
        }
        imagesXml += "    </Images>\n";
      }

      ads += `  <Ad>\n`;
      ads += `    <Id>${escapeXml(id)}</Id>\n`;
      ads += `    <Title>${title}</Title>\n`;
      ads += `    <Description>${description}</Description>\n`;
      ads += `    <Price>${price}</Price>\n`;
      ads += `    <Category>${category}</Category>\n`;
      if (address) {
        ads += `    <Address>${address}</Address>\n`;
      }
      ads += imagesXml;
      // Additional params — skip keys already handled above and Excel-only fields
      const skipKeys = new Set([
        'Price', 'price', 'title', 'description', 'category', 'address',
        'avitoId', 'avitoNumber', 'listingFee', 'contactMethod', 'contactPhone',
        'managerName', 'email', 'companyName', 'avitoStatus', 'dateEnd',
        'goodsType', 'goodsSubType', 'targetAudience', 'includeVAT',
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
