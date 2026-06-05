// Одноразовая функция: создаёт/обновляет бакет product-videos
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const body = {
    id: "product-videos",
    name: "product-videos",
    public: true,
    file_size_limit: 524288000,
    allowed_mime_types: ["video/mp4", "video/webm", "video/quicktime"],
  };
  // Try create
  let res = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE_ROLE}`, apikey: SERVICE_ROLE, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let txt = await res.text();
  if (res.status === 409) {
    res = await fetch(`${SUPABASE_URL}/storage/v1/bucket/product-videos`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${SERVICE_ROLE}`, apikey: SERVICE_ROLE, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    txt = await res.text();
  }
  return new Response(JSON.stringify({ status: res.status, body: txt }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
