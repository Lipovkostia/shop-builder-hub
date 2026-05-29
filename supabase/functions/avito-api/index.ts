import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AVITO_TOKEN_URL = "https://api.avito.ru/token";
const AVITO_API_BASE = "https://api.avito.ru";

async function getAvitoToken(clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch(AVITO_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Avito auth failed [${res.status}]: ${text}`);
  }

  const data = await res.json();
  return data.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, store_id, client_id, client_secret, item_id, price: newPrice } = await req.json();

    if (action === "save_credentials") {
      // Save or update Avito credentials
      const { data, error } = await supabase
        .from("avito_accounts")
        .upsert(
          { store_id, client_id, client_secret, updated_at: new Date().toISOString() },
          { onConflict: "store_id" }
        )
        .select()
        .single();

      if (error) throw new Error(`DB error: ${error.message}`);
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "test_connection") {
      // Test connection and get user info
      const token = await getAvitoToken(client_id, client_secret);

      const userRes = await fetch(`${AVITO_API_BASE}/core/v1/accounts/self`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!userRes.ok) {
        const text = await userRes.text();
        throw new Error(`Avito user info failed [${userRes.status}]: ${text}`);
      }

      const userData = await userRes.json();

      // Save user_id and profile_name
      await supabase
        .from("avito_accounts")
        .upsert(
          {
            store_id,
            client_id,
            client_secret,
            avito_user_id: userData.id,
            profile_name: userData.name || userData.email || `ID: ${userData.id}`,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "store_id" }
        );

      return new Response(
        JSON.stringify({ success: true, user: userData }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "fetch_items") {
      // Get credentials from DB
      const { data: account, error: accErr } = await supabase
        .from("avito_accounts")
        .select("*")
        .eq("store_id", store_id)
        .single();

      if (accErr || !account) throw new Error("Avito аккаунт не найден. Сначала подключите Авито.");

      const token = await getAvitoToken(account.client_id, account.client_secret);

      // Fetch active items with pagination
      const allItems: any[] = [];
      let page = 1;
      const perPage = 100;
      let hasMore = true;

      while (hasMore) {
        const url = `${AVITO_API_BASE}/core/v1/items?per_page=${perPage}&page=${page}&status=active`;
        const itemsRes = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!itemsRes.ok) {
          const text = await itemsRes.text();
          throw new Error(`Avito items failed [${itemsRes.status}]: ${text}`);
        }

        const itemsData = await itemsRes.json();
        const resources = itemsData.resources || [];
        allItems.push(...resources);

        if (resources.length < perPage) {
          hasMore = false;
        } else {
          page++;
        }

        // Safety limit
        if (page > 50) break;
      }

      // Update last_sync
      await supabase
        .from("avito_accounts")
        .update({ last_sync: new Date().toISOString() })
        .eq("store_id", store_id);

      return new Response(
        JSON.stringify({ success: true, items: allItems, total: allItems.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "get_item_info") {
      // Get single item details (includes description/body)
      const { data: account, error: accErr } = await supabase
        .from("avito_accounts")
        .select("*")
        .eq("store_id", store_id)
        .single();

      if (accErr || !account) throw new Error("Avito аккаунт не найден.");

      const token = await getAvitoToken(account.client_id, account.client_secret);

      const url = `${AVITO_API_BASE}/core/v1/accounts/${account.avito_user_id}/items/${item_id}`;
      const itemRes = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!itemRes.ok) {
        const text = await itemRes.text();
        throw new Error(`Avito item info failed [${itemRes.status}]: ${text}`);
      }

      const itemData = await itemRes.json();
      return new Response(
        JSON.stringify({ success: true, item: itemData }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "update_item") {
      // Update item price via Avito API
      const { data: account, error: accErr } = await supabase
        .from("avito_accounts")
        .select("*")
        .eq("store_id", store_id)
        .single();

      if (accErr || !account) throw new Error("Avito аккаунт не найден.");

      const token = await getAvitoToken(account.client_id, account.client_secret);

      // Avito supports updating price via PUT /core/v1/accounts/{user_id}/items/{item_id}
      // but the actual update is limited. We'll try the available endpoint.
      const url = `${AVITO_API_BASE}/core/v1/accounts/${account.avito_user_id}/items/${item_id}`;
      // Note: Avito may not support all field updates via API
      
      return new Response(
        JSON.stringify({ success: false, error: "Обновление объявлений через API Авито пока ограничено. Используйте автозагрузку или личный кабинет Авито." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "fetch_autoload_errors") {
      // Pull moderation/autoload errors for the last reports from Avito.
      // Avito autoload endpoints:
      //   GET /autoload/v1/reports             — paginated list of reports
      //   GET /autoload/v2/reports/{id}/items  — items inside a given report
      const { data: account, error: accErr } = await supabase
        .from("avito_accounts")
        .select("*")
        .eq("store_id", store_id)
        .single();
      if (accErr || !account) throw new Error("Avito аккаунт не найден. Сначала подключите Авито.");
      const token = await getAvitoToken(account.client_id, account.client_secret);

      // 1) Get latest reports — try v2 then v1 endpoints (Avito changed paths)
      const reportListUrls = [
        `${AVITO_API_BASE}/autoload/v2/reports?per_page=3&page=1`,
        `${AVITO_API_BASE}/autoload/v1/reports?per_page=3&page=1`,
        `${AVITO_API_BASE}/autoload/v2/reports/last_completed_report`,
      ];
      let reportsData: any = null;
      let lastErr = "";
      for (const u of reportListUrls) {
        const r = await fetch(u, { headers: { Authorization: `Bearer ${token}` } });
        if (r.ok) { reportsData = await r.json(); break; }
        lastErr = `[${r.status}] ${await r.text()}`;
        console.error(`reports endpoint ${u} failed: ${lastErr}`);
      }
      if (!reportsData) {
        return new Response(JSON.stringify({
          success: false,
          fallback: true,
          error: "AVITO_REPORTS_UNAVAILABLE",
          message: `Авито не вернул список отчётов автозагрузки. Возможно, автозагрузка ещё ни разу не запускалась или у приложения нет прав autoload. Последний ответ: ${lastErr}`,
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      let reports: any[] = reportsData.reports || reportsData.resources || [];
      // last_completed_report returns a single object
      if (!reports.length && (reportsData.report_id || reportsData.id)) {
        reports = [reportsData];
      }
      if (reports.length === 0) {
        return new Response(JSON.stringify({ success: true, updated: 0, total: 0, message: "Отчёты автозагрузки не найдены" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Collect messages per ad_id (the XML <Id> we emit)
      const errorsByAdId = new Map<string, { status: string; messages: { type: string; text: string }[]; avito_id?: number | string; report_id: any; checked_at: string; section?: string; url?: string }>();
      const checkedAt = new Date().toISOString();
      let inspected = 0;

      for (const r of reports) {
        const reportId = r.report_id ?? r.id;
        if (!reportId) continue;
        // Paginate items
        let page = 1;
        while (true) {
          const itemsUrl = `${AVITO_API_BASE}/autoload/v2/reports/${reportId}/items?per_page=100&page=${page}`;
          const ir = await fetch(itemsUrl, { headers: { Authorization: `Bearer ${token}` } });
          if (!ir.ok) {
            const text = await ir.text();
            console.error(`autoload items failed [${ir.status}]: ${text}`);
            break;
          }
          const ij = await ir.json();
          const items: any[] = ij.items || ij.resources || [];
          if (items.length === 0) break;
          inspected += items.length;
          for (const it of items) {
            const adId = String(it.ad_id || it.adId || it.ad_external_id || it.external_id || "");
            if (!adId) continue;
            // Normalize messages
            const rawMsgs: any[] = it.messages || it.errors || it.problems || [];
            const messages = rawMsgs
              .map((m) => ({
                type: String(m.type || m.code || m.level || "error"),
                text: String(m.text || m.description || m.message || m.title || "").trim(),
              }))
              .filter((m) => m.text);
            if (it.error && typeof it.error === "object") {
              const t = String(it.error.message || it.error.text || "").trim();
              if (t) messages.push({ type: "error", text: t });
            }
            const status = String(it.status || it.section || "");
            // Only record meaningful problems (blocked / errors / processed_with_errors)
            const hasIssue =
              messages.length > 0 ||
              /block|reject|error|fail|problem|moderation/i.test(status);
            if (!hasIssue) continue;
            // Keep the most recent — reports are returned newest-first; do not overwrite later
            if (!errorsByAdId.has(adId)) {
              errorsByAdId.set(adId, {
                status,
                messages,
                avito_id: it.avito_id || it.avitoId || it.id,
                report_id: reportId,
                checked_at: checkedAt,
                section: it.section,
                url: it.url || it.avito_url,
              });
            }
          }
          if (items.length < 100) break;
          page++;
          if (page > 30) break;
        }
      }

      // 2) Apply to avito_feed_products by matching XML <Id> = product.id.substring(0,8)
      const { data: feedRows, error: fErr } = await supabase
        .from("avito_feed_products")
        .select("id, product_id, avito_params")
        .eq("store_id", store_id);
      if (fErr) throw fErr;

      let updated = 0;
      for (const row of feedRows || []) {
        const adId = String(row.product_id).substring(0, 8);
        const params = (row.avito_params && typeof row.avito_params === "object") ? row.avito_params as any : {};
        const moderation = errorsByAdId.get(adId) || null;
        const prev = params.moderation || null;
        // Detect change to avoid unnecessary writes
        const same = prev && moderation
          && prev.status === moderation.status
          && JSON.stringify(prev.messages || []) === JSON.stringify(moderation.messages);
        if (moderation) {
          if (same) continue;
          const newParams = { ...params, moderation };
          await supabase.from("avito_feed_products").update({ avito_params: newParams }).eq("id", row.id);
          updated++;
        } else if (prev) {
          // Clear stale moderation block
          const newParams = { ...params };
          delete newParams.moderation;
          await supabase.from("avito_feed_products").update({ avito_params: newParams }).eq("id", row.id);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          updated,
          with_errors: errorsByAdId.size,
          inspected,
          reports: reports.length,
          checked_at: checkedAt,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "get_credentials") {
      const { data: account } = await supabase
        .from("avito_accounts")
        .select("*")
        .eq("store_id", store_id)
        .single();

      return new Response(
        JSON.stringify({ success: true, account }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }



    if (action === "disconnect") {
      await supabase.from("avito_accounts").delete().eq("store_id", store_id);
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Avito API error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
