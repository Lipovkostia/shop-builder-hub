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

/** Resolve the account to operate on: prefer account_id, else default-for-store. */
async function resolveAccount(supabase: any, account_id: string | null, store_id: string | null) {
  if (account_id) {
    const { data, error } = await supabase
      .from("avito_accounts").select("*").eq("id", account_id).maybeSingle();
    if (error) throw new Error(`DB error: ${error.message}`);
    return data || null;
  }
  if (store_id) {
    const { data } = await supabase
      .from("avito_accounts")
      .select("*")
      .eq("store_id", store_id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1);
    return (data && data[0]) || null;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const {
      action,
      store_id,
      account_id = null,
      client_id,
      client_secret,
      item_id,
      price: newPrice,
      date_from,
      date_to,
      item_ids,
      tab_id,
      label,
      create_new,
    } = body || {};

    if (action === "list_accounts") {
      const { data, error } = await supabase
        .from("avito_accounts")
        .select("*")
        .eq("store_id", store_id)
        .order("is_default", { ascending: false })
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return new Response(JSON.stringify({ success: true, accounts: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create_account") {
      // Create empty account placeholder (credentials added later)
      const { count } = await supabase
        .from("avito_accounts").select("id", { count: "exact", head: true }).eq("store_id", store_id);
      const { data, error } = await supabase
        .from("avito_accounts")
        .insert({
          store_id,
          client_id: "",
          client_secret: "",
          label: (label && String(label).trim()) || "Новый аккаунт",
          is_default: (count || 0) === 0,
          sort_order: count || 0,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return new Response(JSON.stringify({ success: true, account: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_account_label") {
      const { error } = await supabase
        .from("avito_accounts").update({ label: (label || "").toString().trim() || "Аккаунт" })
        .eq("id", account_id);
      if (error) throw new Error(error.message);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "set_default_account") {
      await supabase.from("avito_accounts").update({ is_default: false }).eq("store_id", store_id);
      const { error } = await supabase.from("avito_accounts").update({ is_default: true }).eq("id", account_id);
      if (error) throw new Error(error.message);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "save_credentials") {
      // Update existing account or create new (if create_new) — never overwrite a different account
      if (account_id) {
        const { data, error } = await supabase
          .from("avito_accounts")
          .update({ client_id, client_secret, updated_at: new Date().toISOString() })
          .eq("id", account_id)
          .select()
          .single();
        if (error) throw new Error(`DB error: ${error.message}`);
        return new Response(JSON.stringify({ success: true, data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (create_new) {
        const { count } = await supabase
          .from("avito_accounts").select("id", { count: "exact", head: true }).eq("store_id", store_id);
        const { data, error } = await supabase
          .from("avito_accounts")
          .insert({
            store_id, client_id, client_secret,
            label: (label && String(label).trim()) || "Аккаунт",
            is_default: (count || 0) === 0,
            sort_order: count || 0,
          })
          .select().single();
        if (error) throw new Error(`DB error: ${error.message}`);
        return new Response(JSON.stringify({ success: true, data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Fallback: update default-for-store or insert as default
      const existing = await resolveAccount(supabase, null, store_id);
      if (existing) {
        const { data, error } = await supabase
          .from("avito_accounts").update({ client_id, client_secret, updated_at: new Date().toISOString() })
          .eq("id", existing.id).select().single();
        if (error) throw new Error(`DB error: ${error.message}`);
        return new Response(JSON.stringify({ success: true, data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data, error } = await supabase
        .from("avito_accounts")
        .insert({ store_id, client_id, client_secret, is_default: true, sort_order: 0, label: "Основной" })
        .select().single();
      if (error) throw new Error(`DB error: ${error.message}`);
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "test_connection") {
      // Authenticate, fetch profile, save into the target account
      const token = await getAvitoToken(client_id, client_secret);
      const userRes = await fetch(`${AVITO_API_BASE}/core/v1/accounts/self`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!userRes.ok) {
        const text = await userRes.text();
        throw new Error(`Avito user info failed [${userRes.status}]: ${text}`);
      }
      const userData = await userRes.json();
      const profileName = userData.name || userData.email || `ID: ${userData.id}`;

      let targetId = account_id;
      if (!targetId && create_new) {
        const { count } = await supabase
          .from("avito_accounts").select("id", { count: "exact", head: true }).eq("store_id", store_id);
        const { data: ins, error: insErr } = await supabase
          .from("avito_accounts").insert({
            store_id, client_id, client_secret,
            label: (label && String(label).trim()) || profileName,
            is_default: (count || 0) === 0,
            sort_order: count || 0,
          }).select().single();
        if (insErr) throw new Error(`DB error: ${insErr.message}`);
        targetId = ins.id;
      }
      if (!targetId) {
        // Fallback to default-for-store or insert
        const existing = await resolveAccount(supabase, null, store_id);
        if (existing) targetId = existing.id;
        else {
          const { data: ins, error: insErr } = await supabase
            .from("avito_accounts").insert({
              store_id, client_id, client_secret,
              label: profileName, is_default: true, sort_order: 0,
            }).select().single();
          if (insErr) throw new Error(`DB error: ${insErr.message}`);
          targetId = ins.id;
        }
      }
      await supabase
        .from("avito_accounts")
        .update({
          client_id, client_secret,
          avito_user_id: userData.id,
          profile_name: profileName,
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetId);

      return new Response(JSON.stringify({ success: true, user: userData, account_id: targetId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "fetch_items") {
      const account = await resolveAccount(supabase, account_id, store_id);
      if (!account) throw new Error("Avito аккаунт не найден. Сначала подключите Авито.");
      const token = await getAvitoToken(account.client_id, account.client_secret);
      const allItems: any[] = [];
      let page = 1;
      const perPage = 100;
      while (true) {
        const url = `${AVITO_API_BASE}/core/v1/items?per_page=${perPage}&page=${page}&status=active`;
        const itemsRes = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!itemsRes.ok) {
          const text = await itemsRes.text();
          throw new Error(`Avito items failed [${itemsRes.status}]: ${text}`);
        }
        const itemsData = await itemsRes.json();
        const resources = itemsData.resources || [];
        allItems.push(...resources);
        if (resources.length < perPage) break;
        page++;
        if (page > 50) break;
      }
      await supabase.from("avito_accounts").update({ last_sync: new Date().toISOString() }).eq("id", account.id);
      return new Response(JSON.stringify({ success: true, items: allItems, total: allItems.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_item_info") {
      const account = await resolveAccount(supabase, account_id, store_id);
      if (!account) throw new Error("Avito аккаунт не найден.");
      const token = await getAvitoToken(account.client_id, account.client_secret);
      const url = `${AVITO_API_BASE}/core/v1/accounts/${account.avito_user_id}/items/${item_id}`;
      const itemRes = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!itemRes.ok) {
        const text = await itemRes.text();
        throw new Error(`Avito item info failed [${itemRes.status}]: ${text}`);
      }
      const itemData = await itemRes.json();
      return new Response(JSON.stringify({ success: true, item: itemData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_item") {
      return new Response(
        JSON.stringify({ success: false, error: "Обновление объявлений через API Авито пока ограничено. Используйте автозагрузку или личный кабинет Авито." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "fetch_autoload_errors") {
      const account = await resolveAccount(supabase, account_id, store_id);
      if (!account) throw new Error("Avito аккаунт не найден. Сначала подключите Авито.");
      const token = await getAvitoToken(account.client_id, account.client_secret);

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
          success: false, fallback: true, error: "AVITO_REPORTS_UNAVAILABLE",
          message: `Авито не вернул список отчётов автозагрузки. Возможно, автозагрузка ещё ни разу не запускалась или у приложения нет прав autoload. Последний ответ: ${lastErr}`,
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      let reports: any[] = reportsData.reports || reportsData.resources || [];
      if (!reports.length && (reportsData.report_id || reportsData.id)) reports = [reportsData];
      if (reports.length === 0) {
        return new Response(JSON.stringify({ success: true, updated: 0, total: 0, message: "Отчёты автозагрузки не найдены" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const errorsByAdId = new Map<string, any>();
      const checkedAt = new Date().toISOString();
      let inspected = 0;

      for (const r of reports) {
        const reportId = r.report_id ?? r.id;
        if (!reportId) continue;
        let page = 1;
        while (true) {
          const itemsUrl = `${AVITO_API_BASE}/autoload/v2/reports/${reportId}/items?per_page=100&page=${page}`;
          const ir = await fetch(itemsUrl, { headers: { Authorization: `Bearer ${token}` } });
          if (!ir.ok) { console.error(`autoload items failed [${ir.status}]: ${await ir.text()}`); break; }
          const ij = await ir.json();
          const items: any[] = ij.items || ij.resources || [];
          if (items.length === 0) break;
          inspected += items.length;
          for (const it of items) {
            const adId = String(it.ad_id || it.adId || it.ad_external_id || it.external_id || "");
            if (!adId) continue;
            const rawMsgs: any[] = it.messages || it.errors || it.problems || [];
            const messages = rawMsgs
              .map((m) => ({ type: String(m.type || m.code || m.level || "error"), text: String(m.text || m.description || m.message || m.title || "").trim() }))
              .filter((m) => m.text);
            if (it.error && typeof it.error === "object") {
              const t = String(it.error.message || it.error.text || "").trim();
              if (t) messages.push({ type: "error", text: t });
            }
            const status = String(it.status || it.section || "");
            const hasIssue = messages.length > 0 || /block|reject|error|fail|problem|moderation/i.test(status);
            if (!hasIssue) continue;
            if (!errorsByAdId.has(adId)) {
              errorsByAdId.set(adId, { status, messages, avito_id: it.avito_id || it.avitoId || it.id, report_id: reportId, checked_at: checkedAt, section: it.section, url: it.url || it.avito_url });
            }
          }
          if (items.length < 100) break;
          page++;
          if (page > 30) break;
        }
      }

      // Apply only to this account's feed
      const { data: feedRows, error: fErr } = await supabase
        .from("avito_feed_products")
        .select("id, product_id, avito_params")
        .eq("store_id", account.store_id)
        .eq("account_id", account.id);
      if (fErr) throw fErr;

      let updated = 0;
      for (const row of feedRows || []) {
        const adId = String(row.product_id).substring(0, 8);
        const params = (row.avito_params && typeof row.avito_params === "object") ? row.avito_params as any : {};
        const moderation = errorsByAdId.get(adId) || null;
        const prev = params.moderation || null;
        const same = prev && moderation && prev.status === moderation.status
          && JSON.stringify(prev.messages || []) === JSON.stringify(moderation.messages);
        if (moderation) {
          if (same) continue;
          await supabase.from("avito_feed_products").update({ avito_params: { ...params, moderation } }).eq("id", row.id);
          updated++;
        } else if (prev) {
          const newParams = { ...params }; delete newParams.moderation;
          await supabase.from("avito_feed_products").update({ avito_params: newParams }).eq("id", row.id);
        }
      }
      return new Response(JSON.stringify({ success: true, updated, with_errors: errorsByAdId.size, inspected, reports: reports.length, checked_at: checkedAt }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_credentials") {
      const account = await resolveAccount(supabase, account_id, store_id);
      return new Response(JSON.stringify({ success: true, account }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "fetch_stats") {
      const account = await resolveAccount(supabase, account_id, store_id);
      if (!account) throw new Error("Avito аккаунт не найден. Сначала подключите Авито.");
      if (!account.avito_user_id) throw new Error("avito_user_id отсутствует — переподключите Авито (Test connection).");

      const today = new Date();
      const defaultTo = today.toISOString().slice(0, 10);
      const defaultFromDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const dateTo = (date_to && String(date_to)) || defaultTo;
      const dateFrom = (date_from && String(date_from)) || defaultFromDate.toISOString().slice(0, 10);

      const token = await getAvitoToken(account.client_id, account.client_secret);

      let ids: number[] = [];
      if (Array.isArray(item_ids) && item_ids.length > 0) {
        ids = item_ids.map((x: any) => Number(x)).filter((n) => Number.isFinite(n));
      } else {
        let page = 1; const perPage = 100;
        while (true) {
          const u = `${AVITO_API_BASE}/core/v1/items?per_page=${perPage}&page=${page}&status=active`;
          const r = await fetch(u, { headers: { Authorization: `Bearer ${token}` } });
          if (!r.ok) throw new Error(`Avito items failed [${r.status}]: ${await r.text()}`);
          const j = await r.json();
          const res = (j.resources || []) as any[];
          for (const it of res) { const id = Number(it.id); if (Number.isFinite(id)) ids.push(id); }
          if (res.length < perPage) break;
          page++; if (page > 50) break;
        }
      }
      if (ids.length === 0) {
        return new Response(JSON.stringify({ success: true, stats: [], dateFrom, dateTo, total: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const fields = ["uniqViews", "uniqContacts", "uniqFavorites"];
      const allStats: any[] = [];
      for (let i = 0; i < ids.length; i += 200) {
        const batch = ids.slice(i, i + 200);
        const url = `${AVITO_API_BASE}/stats/v1/accounts/${account.avito_user_id}/items`;
        const r = await fetch(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ dateFrom, dateTo, fields, itemIds: batch, periodGrouping: "day" }),
        });
        if (!r.ok) throw new Error(`Avito stats failed [${r.status}]: ${await r.text()}`);
        const j = await r.json();
        const items = j?.result?.items || j?.items || [];
        allStats.push(...items);
      }

      const spendByItem: Record<string, number> = {};
      let spendTotal = 0;
      let spendError: string | null = null;
      try {
        const dateTimeFrom = `${dateFrom}T00:00:00Z`;
        const dateTimeTo = `${dateTo}T23:59:59Z`;
        const opsResp = await fetch(`${AVITO_API_BASE}/core/v1/accounts/operations_history`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ dateTimeFrom, dateTimeTo }),
        });
        if (opsResp.ok) {
          const opsJson = await opsResp.json();
          const ops: any[] = opsJson?.operations || opsJson?.result?.operations || [];
          for (const op of ops) {
            const itemId = op.itemId ?? op.item_id;
            const amt = Number(op.amountRub ?? op.amount_rub ?? op.amountTotal ?? op.amount_total ?? 0);
            if (!Number.isFinite(amt) || amt === 0) continue;
            spendTotal += amt;
            if (itemId != null) {
              const key = String(itemId);
              spendByItem[key] = (spendByItem[key] || 0) + amt;
            }
          }
        } else {
          spendError = `[${opsResp.status}] ${await opsResp.text()}`;
          console.error("operations_history failed:", spendError);
        }
      } catch (e: any) {
        spendError = e?.message || String(e);
        console.error("operations_history exception:", spendError);
      }

      return new Response(JSON.stringify({
        success: true, stats: allStats, dateFrom, dateTo, total: ids.length,
        spendByItem, spendTotal, spendError,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "stop_items") {
      const account = await resolveAccount(supabase, account_id, store_id);
      if (!account) throw new Error("Avito аккаунт не найден.");
      if (!account.avito_user_id) throw new Error("avito_user_id отсутствует — переподключите Авито.");
      const token = await getAvitoToken(account.client_id, account.client_secret);
      const ids = Array.isArray(item_ids) ? item_ids.map((x: any) => Number(x)).filter(Number.isFinite) : [];
      const results: { itemId: number; ok: boolean; error?: string }[] = [];
      for (const id of ids) {
        try {
          const url = `${AVITO_API_BASE}/core/v1/accounts/${account.avito_user_id}/items/${id}/stop`;
          const r = await fetch(url, { method: "PUT", headers: { Authorization: `Bearer ${token}` } });
          if (!r.ok) results.push({ itemId: id, ok: false, error: `[${r.status}] ${(await r.text()).slice(0,200)}` });
          else results.push({ itemId: id, ok: true });
        } catch (e: any) { results.push({ itemId: id, ok: false, error: e.message || String(e) }); }
      }
      const success = results.filter((x) => x.ok).length;
      const failed = results.filter((x) => !x.ok).length;
      return new Response(JSON.stringify({ success: true, stopped: success, failed, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "restore_feed_from_active") {
      const account = await resolveAccount(supabase, account_id, store_id);
      if (!account) throw new Error("Avito аккаунт не найден. Сначала подключите Авито.");
      const token = await getAvitoToken(account.client_id, account.client_secret);

      const allItems: any[] = [];
      {
        let page = 1; const perPage = 100;
        while (true) {
          const u = `${AVITO_API_BASE}/core/v1/items?per_page=${perPage}&page=${page}&status=active`;
          const r = await fetch(u, { headers: { Authorization: `Bearer ${token}` } });
          if (!r.ok) throw new Error(`Avito items failed [${r.status}]: ${await r.text()}`);
          const j = await r.json();
          const res = (j.resources || []) as any[];
          allItems.push(...res);
          if (res.length < perPage) break;
          page++; if (page > 100) break;
        }
      }

      const { data: storeProducts, error: spErr } = await supabase
        .from("products").select("id, name, sku")
        .eq("store_id", account.store_id).is("deleted_at", null);
      if (spErr) throw spErr;

      const normalize = (s: string) => String(s || "").toLowerCase()
        .replace(/[\s\u00A0]+/g, " ").replace(/[«»"'`]/g, "")
        .replace(/[^\p{L}\p{N}\s]/gu, "").trim();
      const byName = new Map<string, string>();
      for (const p of storeProducts || []) {
        const key = normalize(p.name || "");
        if (key && !byName.has(key)) byName.set(key, p.id);
      }

      const { data: existing } = await supabase
        .from("avito_feed_products")
        .select("id, product_id, tab_id, avito_params")
        .eq("store_id", account.store_id)
        .eq("account_id", account.id);
      const byAvitoNumber = new Map<string, string>();
      const existingPairs = new Set<string>();
      for (const row of existing || []) {
        const an = String((row.avito_params as any)?.avitoNumber || (row.avito_params as any)?.AvitoId || "");
        if (an) byAvitoNumber.set(an, row.product_id);
        existingPairs.add(`${row.tab_id || ""}::${row.product_id}`);
      }

      const targetTabId = tab_id || null;
      const toInsert: any[] = [];
      const unmatched: { itemId: any; title: string }[] = [];
      const seenProducts = new Set<string>();

      for (const it of allItems) {
        const avitoNumber = String(it.id || it.item_id || "");
        const itemTitle = String(it.title || it.name || "").trim();
        const itemPrice = Number(it.price ?? it.priceRub ?? 0) || 0;
        const itemAddress = String(it.address || "").trim();
        let productId: string | undefined = byAvitoNumber.get(avitoNumber);
        if (!productId) productId = byName.get(normalize(itemTitle));
        if (!productId) { unmatched.push({ itemId: avitoNumber, title: itemTitle }); continue; }
        if (seenProducts.has(productId)) continue;
        seenProducts.add(productId);
        const pairKey = `${targetTabId || ""}::${productId}`;
        if (existingPairs.has(pairKey)) continue;
        toInsert.push({
          store_id: account.store_id,
          account_id: account.id,
          tab_id: targetTabId,
          product_id: productId,
          avito_address: itemAddress || null,
          avito_params: {
            title: itemTitle || undefined,
            Price: itemPrice || undefined,
            address: itemAddress || undefined,
            avitoNumber: avitoNumber || undefined,
            avitoStatus: "active",
          },
        });
      }

      let inserted = 0;
      if (toInsert.length > 0) {
        for (let i = 0; i < toInsert.length; i += 500) {
          const chunk = toInsert.slice(i, i + 500);
          const { error: insErr } = await supabase.from("avito_feed_products").insert(chunk);
          if (insErr) throw new Error(`DB insert failed: ${insErr.message}`);
          inserted += chunk.length;
        }
      }

      return new Response(JSON.stringify({
        success: true,
        total_active_on_avito: allItems.length,
        matched: toInsert.length + (allItems.length - toInsert.length - unmatched.length),
        inserted,
        skipped_existing: allItems.length - toInsert.length - unmatched.length,
        unmatched_count: unmatched.length,
        unmatched: unmatched.slice(0, 50),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "sync_items_status") {
      const account = await resolveAccount(supabase, account_id, store_id);
      if (!account) throw new Error("Avito аккаунт не найден. Сначала подключите Авито.");
      if (!account.avito_user_id) throw new Error("avito_user_id отсутствует — переподключите Авито.");
      const token = await getAvitoToken(account.client_id, account.client_secret);

      // Fetch items across all statuses
      const STATUSES = ["active", "removed", "old", "blocked"];
      const byItemId = new Map<string, { status: string; title: string; url: string }>();
      for (const st of STATUSES) {
        let page = 1; const perPage = 100;
        while (true) {
          const u = `${AVITO_API_BASE}/core/v1/items?per_page=${perPage}&page=${page}&status=${st}`;
          const r = await fetch(u, { headers: { Authorization: `Bearer ${token}` } });
          if (!r.ok) { console.error(`items[${st}] failed [${r.status}]: ${(await r.text()).slice(0,200)}`); break; }
          const j = await r.json();
          const res = (j.resources || []) as any[];
          for (const it of res) {
            const id = String(it.id || it.item_id || "");
            if (!id) continue;
            byItemId.set(id, {
              status: String(it.status || st),
              title: String(it.title || it.name || ""),
              url: String(it.url || ""),
            });
          }
          if (res.length < perPage) break;
          page++; if (page > 100) break;
        }
      }

      const { data: feedRows, error: fErr } = await supabase
        .from("avito_feed_products")
        .select("id, product_id, avito_params")
        .eq("store_id", account.store_id)
        .eq("account_id", account.id);
      if (fErr) throw fErr;

      const checkedAt = new Date().toISOString();
      let matched = 0, blocked = 0, removed = 0, active = 0;
      const STATUS_LABEL: Record<string, string> = {
        active: "Активно",
        removed: "Снято с публикации",
        old: "Завершено",
        blocked: "Заблокировано",
      };
      for (const row of feedRows || []) {
        const params: any = (row.avito_params && typeof row.avito_params === "object") ? row.avito_params : {};
        const an = String(params.avitoNumber || params.AvitoId || "").trim();
        if (!an) continue;
        const info = byItemId.get(an);
        if (!info) {
          // Item not found among any status — clear known status fields
          if (params.avitoStatus || params.moderation?.published != null) {
            const newParams = { ...params };
            delete newParams.avitoStatus;
            delete newParams.avitoStatusCheckedAt;
            newParams.avitoStatusUnknown = true;
            await supabase.from("avito_feed_products").update({ avito_params: newParams }).eq("id", row.id);
          }
          continue;
        }
        matched++;
        const rawStatus = info.status;
        const label = STATUS_LABEL[rawStatus] || rawStatus;
        const isActive = rawStatus === "active";
        if (rawStatus === "blocked") blocked++;
        else if (rawStatus === "removed" || rawStatus === "old") removed++;
        else if (isActive) active++;

        const prevMod = (params.moderation && typeof params.moderation === "object") ? params.moderation : {};
        const newMod = {
          ...prevMod,
          status: label,
          published: isActive,
          checked_at: checkedAt,
          url: info.url || prevMod.url,
          avito_id: an,
        };
        const newParams = {
          ...params,
          avitoStatus: label,
          avitoStatusRaw: rawStatus,
          avitoStatusCheckedAt: checkedAt,
          avitoStatusUnknown: false,
          moderation: newMod,
        };
        await supabase.from("avito_feed_products").update({ avito_params: newParams }).eq("id", row.id);
      }

      return new Response(JSON.stringify({
        success: true,
        total_items: byItemId.size,
        matched,
        active,
        blocked,
        removed,
        checked_at: checkedAt,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "disconnect") {
      // Delete a specific account (or default-for-store if account_id absent)
      const account = await resolveAccount(supabase, account_id, store_id);
      if (account) {
        await supabase.from("avito_accounts").delete().eq("id", account.id);
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Avito API error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
