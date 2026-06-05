// One-off admin helper: raise storage bucket file_size_limit to 100 MB.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BUCKETS = ["product-images", "landing-slides", "order-attachments", "landing-info", "avito-images", "ai-history"];

Deno.serve(async () => {
  const out: Record<string, unknown> = {};
  for (const id of BUCKETS) {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket/${id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${SRK}`, "Content-Type": "application/json", apikey: SRK },
      body: JSON.stringify({ file_size_limit: 104857600 }),
    });
    out[id] = { status: res.status, body: await res.text() };
  }
  return new Response(JSON.stringify(out, null, 2), { headers: { "Content-Type": "application/json" } });
});
