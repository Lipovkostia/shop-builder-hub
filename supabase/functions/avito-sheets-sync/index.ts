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

    const body = await req.json();
    const { action, storeId } = body;
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

    if (action === "connect_spreadsheet") {
      const spreadsheetId = body.spreadsheetId;
      const spreadsheetUrl = body.spreadsheetUrl;
      if (!spreadsheetId) throw new Error("spreadsheetId required");

      // Verify access + fetch existing sheet titles
      let meta: any;
      try {
        meta = await gw(`/spreadsheets/${spreadsheetId}?fields=sheets.properties`);
      } catch (_e) {
        throw new Error("Не удалось открыть таблицу. Проверьте, что доступ «Редактор по ссылке» включён.");
      }
      const existing = new Set((meta.sheets || []).map((s: any) => s.properties?.title));
      const toAdd = ["Товары", "Ошибки", "Лог"].filter((t) => !existing.has(t));
      if (toAdd.length) {
        await gw(`/spreadsheets/${spreadsheetId}:batchUpdate`, {
          method: "POST",
          body: JSON.stringify({ requests: toAdd.map((title) => ({ addSheet: { properties: { title } } })) }),
        });
      }
      await gw(`/spreadsheets/${spreadsheetId}/values/Товары!A1:K1?valueInputOption=RAW`, {
        method: "PUT",
        body: JSON.stringify({ values: [HEADERS] }),
      });

      const finalUrl = spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
      const up = await supabase
        .from("store_google_integrations")
        .upsert({ store_id: storeId, spreadsheet_id: spreadsheetId, spreadsheet_url: finalUrl, updated_at: new Date().toISOString() }, { onConflict: "store_id" })
        .select()
        .single();
      integration = up.data;
      return new Response(JSON.stringify({ ok: true, spreadsheetId, spreadsheetUrl: finalUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


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

    if (action === "pull") {
      const res = await gw(`/spreadsheets/${integration.spreadsheet_id}/values/Товары!A2:K10000`);
      const values: string[][] = res.values || [];
      let updated = 0;
      for (const row of values) {
        const [product_id, _sku, title, priceRaw, description, category, address] = row;
        if (!product_id) continue;
        const price = priceRaw ? Number(String(priceRaw).replace(/[^\d.]/g, "")) : null;
        const { data: cur } = await supabase
          .from("avito_feed_products")
          .select("avito_params")
          .eq("store_id", storeId).eq("product_id", product_id).maybeSingle();
        const newParams = { ...((cur?.avito_params as any) || {}), Title: title || undefined, Price: price ?? undefined, Description: description || undefined };
        const { error } = await supabase.from("avito_feed_products").upsert({
          store_id: storeId, product_id,
          avito_category: category || null,
          avito_address: address || null,
          avito_params: newParams,
        }, { onConflict: "store_id,product_id" });
        if (!error) {
          updated++;
          await supabase.from("avito_sheets_change_log").insert({
            store_id: storeId, source: "sheet→db", product_id,
            field: "bulk", new_value: JSON.stringify({ title, price, category, address }),
          });
        }
      }
      await supabase.from("store_google_integrations").update({ last_synced_at: new Date().toISOString() }).eq("store_id", storeId);
      return new Response(JSON.stringify({ ok: true, updated }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "import_errors") {
      const list: any[] = Array.isArray(body.errors) ? body.errors : [];
      if (list.length) {
        const dbRows = list.map((e: any) => ({
          store_id: storeId,
          product_id: e.product_id || null,
          external_ad_id: e.external_ad_id || e.ad_id || null,
          field: e.field || null,
          severity: e.severity || "error",
          message: e.message || String(e),
          raw: e,
        }));
        await supabase.from("avito_listing_errors").insert(dbRows);
        const sheetRows = list.map((e: any) => [
          e.product_id || "", e.external_ad_id || e.ad_id || "", e.field || "",
          e.severity || "error", e.message || "", new Date().toISOString(),
        ]);
        try {
          await gw(`/spreadsheets/${integration.spreadsheet_id}/values/Ошибки!A1:F1?valueInputOption=RAW`, {
            method: "PUT",
            body: JSON.stringify({ values: [["product_id", "ad_id", "field", "severity", "message", "imported_at"]] }),
          });
          await gw(`/spreadsheets/${integration.spreadsheet_id}/values/Ошибки!A2:append?valueInputOption=RAW`, {
            method: "POST",
            body: JSON.stringify({ values: sheetRows }),
          });
        } catch (e) { console.warn("Ошибки sheet push failed", e); }
      }
      return new Response(JSON.stringify({ ok: true, imported: list.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

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
