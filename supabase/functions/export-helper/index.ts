// Temporary export helper - returns auth.users dump and storage file listings.
// Uses service role internally; only callable with a shared token to avoid leaks.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EXPORT_TOKEN = "export-lipov-2026-27-secret";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

function sqlEsc(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v instanceof Date) return `'${v.toISOString()}'`;
  if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

async function dumpAuthUsers(): Promise<string> {
  // Use the admin API to list all users (paginated)
  let page = 1;
  const perPage = 1000;
  let all: any[] = [];
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    all = all.concat(data.users);
    if (data.users.length < perPage) break;
    page++;
  }

  // We also need encrypted_password which admin API does NOT return.
  // Query auth.users directly via SQL through PostgREST RPC is not possible without a function.
  // So create a temporary function via SQL... we can't from edge. Instead use the REST
  // SQL endpoint isn't available. Fall back to selecting via a raw query using pg connection.
  // Easiest: use the `pg` REST endpoint - not exposed.
  // We'll use a stored procedure: create one via supabase.rpc - need to exist.
  // Workaround: include only non-password fields, document that passwords need separate dump.

  const lines: string[] = [];
  lines.push("-- Auth users export (metadata only — passwords require direct DB access)");
  lines.push("-- Restore on a fresh Supabase project by inserting into auth.users.");
  lines.push("-- For passwords, use Supabase Admin API to send password reset emails.\n");

  for (const u of all) {
    const cols = [
      "id", "email", "phone", "email_confirmed_at", "phone_confirmed_at",
      "created_at", "updated_at", "last_sign_in_at", "raw_user_meta_data",
      "raw_app_meta_data", "role", "aud",
    ];
    const vals = cols.map((c) => sqlEsc((u as any)[c]));
    lines.push(
      `INSERT INTO auth.users (${cols.join(", ")}) VALUES (${vals.join(", ")}) ON CONFLICT (id) DO NOTHING;`
    );
  }
  return lines.join("\n");
}

async function dumpAuthUsersWithPasswords(): Promise<string> {
  // Use raw SQL via postgres connection from edge function
  const { Client } = await import("https://deno.land/x/postgres@v0.19.3/mod.ts");
  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) throw new Error("SUPABASE_DB_URL not set");
  const client = new Client(dbUrl);
  await client.connect();
  try {
    const r = await client.queryObject<any>(
      `SELECT id, email, phone, encrypted_password, email_confirmed_at, phone_confirmed_at,
              created_at, updated_at, last_sign_in_at, raw_user_meta_data, raw_app_meta_data,
              confirmation_token, recovery_token, email_change_token_new, email_change,
              role, aud, instance_id
       FROM auth.users ORDER BY created_at`,
    );
    const lines: string[] = [];
    lines.push("-- Auth users full export including bcrypt password hashes.");
    lines.push("-- Restore on a Supabase/GoTrue instance; passwords stay valid.\n");
    for (const u of r.rows) {
      const cols = Object.keys(u);
      const vals = cols.map((c) => sqlEsc(u[c]));
      lines.push(
        `INSERT INTO auth.users (${cols.join(", ")}) VALUES (${vals.join(", ")}) ON CONFLICT (id) DO NOTHING;`
      );
    }
    return lines.join("\n");
  } finally {
    await client.end();
  }
}

async function listAllStorageFiles(): Promise<Record<string, any[]>> {
  const buckets = ["product-images", "landing-slides", "order-attachments", "landing-info", "avito-images"];
  const result: Record<string, any[]> = {};
  for (const bucket of buckets) {
    const all: any[] = [];
    async function walk(prefix: string) {
      let offset = 0;
      while (true) {
        const { data, error } = await supabase.storage.from(bucket).list(prefix, {
          limit: 1000, offset, sortBy: { column: "name", order: "asc" },
        });
        if (error) throw error;
        if (!data || data.length === 0) break;
        for (const item of data) {
          const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
          if (item.id === null) {
            // folder
            await walk(fullPath);
          } else {
            const { data: pub } = supabase.storage.from(bucket).getPublicUrl(fullPath);
            all.push({
              path: fullPath,
              size: item.metadata?.size ?? null,
              mimetype: item.metadata?.mimetype ?? null,
              public_url: pub.publicUrl,
            });
          }
        }
        if (data.length < 1000) break;
        offset += 1000;
      }
    }
    await walk("");
    result[bucket] = all;
  }
  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (token !== EXPORT_TOKEN) {
    return new Response("forbidden", { status: 403, headers: cors });
  }
  const action = url.searchParams.get("action");
  try {
    if (action === "auth-users") {
      const sql = await dumpAuthUsersWithPasswords();
      return new Response(sql, { headers: { ...cors, "content-type": "text/plain" } });
    }
    if (action === "auth-users-nopass") {
      const sql = await dumpAuthUsers();
      return new Response(sql, { headers: { ...cors, "content-type": "text/plain" } });
    }
    if (action === "list-storage") {
      const list = await listAllStorageFiles();
      return new Response(JSON.stringify(list, null, 2), {
        headers: { ...cors, "content-type": "application/json" },
      });
    }
    return new Response("unknown action", { status: 400, headers: cors });
  } catch (e: any) {
    return new Response(`ERROR: ${e.message}\n${e.stack || ""}`, { status: 500, headers: cors });
  }
});
