// Avito ⇄ Google Sheets sync (initial: create + push)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_SHEETS = "https://connector-gateway.lovable.dev/google_sheets/v4";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const GOOGLE_SHEETS_API_KEY = Deno.env.get("GOOGLE_SHEETS_API_KEY")!;

function authHeaders() {
  return {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": GOOGLE_SHEETS_API_KEY,
    "Content-Type": "application/json",
  };
}

async function gw(path: string, init: RequestInit = {}) {
  const r = await fetch(`${GATEWAY_SHEETS}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init.headers || {}) },
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Sheets ${r.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

const HEADERS = [
  "product_id", "sku", "title", "price", "description",
  "category", "address", "group", "images_count", "status", "updated_at",
];

function rowFromProduct(p: any, fp: any) {
  const params = fp?.avito_params || {};
  return [
    p.id,
    p.sku || "",
    params.Title || p.name || "",
    params.Price ?? p.price ?? "",
    params.Description || p.description || "",
    fp?.avito_category || "",
    fp?.avito_address || "",
    "",
    (p.images || []).length,
    p.is_active ? "active" : "inactive",
    new Date().toISOString(),
  ];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { action, storeId } = await req.json();
    if (!storeId) throw new Error("storeId required");

    // Verify store ownership
    const { data: profile } = await supabase.from("profiles").select("id").eq("user_id", user.id).maybeSingle();
    const { data: store } = await supabase.from("stores").select("id, name, owner_id").eq("id", storeId).maybeSingle();
    if (!store || store.owner_id !== profile?.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get or create integration
    let { data: integration } = await supabase
      .from("store_google_integrations")
      .select("*")
      .eq("store_id", storeId)
      .maybeSingle();

    if (action === "create_spreadsheet" || (action === "sync" && !integration?.spreadsheet_id)) {
      const created = await gw("/spreadsheets", {
        method: "POST",
        body: JSON.stringify({
          properties: { title: `Авито · ${store.name} · ${new Date().toLocaleDateString("ru-RU")}` },
          sheets: [
            { properties: { title: "Товары", gridProperties: { rowCount: 1000, columnCount: 20 } } },
            { properties: { title: "Ошибки" } },
            { properties: { title: "Лог" } },
          ],
        }),
      });
      const spreadsheetId = created.spreadsheetId;
      const spreadsheetUrl = created.spreadsheetUrl;

      // Write header row
      await gw(`/spreadsheets/${spreadsheetId}/values/Товары!A1:K1?valueInputOption=RAW`, {
        method: "PUT",
        body: JSON.stringify({ values: [HEADERS] }),
      });

      const up = await supabase
        .from("store_google_integrations")
        .upsert({ store_id: storeId, spreadsheet_id: spreadsheetId, spreadsheet_url: spreadsheetUrl, updated_at: new Date().toISOString() }, { onConflict: "store_id" })
        .select()
        .single();
      integration = up.data;

      if (action === "create_spreadsheet") {
        return new Response(JSON.stringify({ ok: true, spreadsheetId, spreadsheetUrl }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!integration?.spreadsheet_id) throw new Error("No spreadsheet linked");

    // Push products
    const { data: feedProducts } = await supabase
      .from("avito_feed_products")
      .select("product_id, avito_category, avito_address, avito_params")
      .eq("store_id", storeId);

    const productIds = (feedProducts || []).map(f => f.product_id);
    if (productIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, rows: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: products } = await supabase
      .from("products")
      .select("id, name, sku, price, description, images, is_active")
      .in("id", productIds);

    const fpMap = new Map((feedProducts || []).map(f => [f.product_id, f]));
    const rows = (products || []).map(p => rowFromProduct(p, fpMap.get(p.id)));

    // Clear and write
    await gw(`/spreadsheets/${integration.spreadsheet_id}/values/Товары!A2:Z10000:clear`, { method: "POST", body: "{}" });
    await gw(`/spreadsheets/${integration.spreadsheet_id}/values/Товары!A2?valueInputOption=RAW`, {
      method: "PUT",
      body: JSON.stringify({ values: rows }),
    });

    await supabase
      .from("store_google_integrations")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("store_id", storeId);

    return new Response(JSON.stringify({ ok: true, rows: rows.length, spreadsheetUrl: integration.spreadsheet_url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("avito-sheets-sync error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
