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
      const title = escapeXml(product.name || "Товар");
      const description = escapeXml(product.description || product.name || "");
      // Use price from avito_params if available (catalog price), otherwise product base price
      const price = (fp.avito_params && fp.avito_params.Price) ? fp.avito_params.Price : (product.price || 0);
      const category = escapeXml(fp.avito_category || "Товары для дома");
      const images = product.images || [];
      const address = escapeXml(fp.avito_address || "");

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
      // Additional params from avito_params
      if (fp.avito_params && typeof fp.avito_params === 'object') {
        for (const [key, value] of Object.entries(fp.avito_params)) {
          if (value && key !== 'Price') {
            ads += `    <${escapeXml(key)}>${escapeXml(String(value))}</${escapeXml(key)}>\n`;
          }
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
