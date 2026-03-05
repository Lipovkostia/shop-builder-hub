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

    const { action, store_id, client_id, client_secret } = await req.json();

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
