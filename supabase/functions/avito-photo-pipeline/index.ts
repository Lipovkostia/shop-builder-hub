// Avito photo pipeline: bulk import from Google Drive folder + AI uniquification
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GW = "https://connector-gateway.lovable.dev";

function authHeaders() {
  return {
    Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
    "X-Connection-Api-Key": Deno.env.get("GOOGLE_DRIVE_API_KEY") ?? "",
  };
}

async function listDriveFolder(folderId: string) {
  const q = encodeURIComponent(`'${folderId}' in parents and mimeType contains 'image/' and trashed=false`);
  const url = `${GW}/google_drive/drive/v3/files?q=${q}&fields=files(id,name,mimeType)&pageSize=200`;
  const r = await fetch(url, { headers: authHeaders() });
  if (!r.ok) throw new Error(`Drive list ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return (j.files ?? []) as { id: string; name: string; mimeType: string }[];
}

async function downloadDriveFile(fileId: string): Promise<Uint8Array> {
  const r = await fetch(`${GW}/google_drive/drive/v3/files/${fileId}?alt=media`, {
    headers: authHeaders(),
  });
  if (!r.ok) throw new Error(`Drive download ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}

async function uniquifyViaAI(srcUrl: string, seed: number): Promise<string> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY missing");
  const prompts = [
    "Slightly shift hue, add subtle warm tone, keep subject identical, no watermarks",
    "Adjust lighting to be slightly cooler, micro-rotate ~2deg, keep subject identical",
    "Add very subtle film grain and slight contrast bump, keep subject identical",
    "Crop very slightly tighter, soften background a touch, keep subject identical",
  ];
  const prompt = `Create a UNIQUE-looking variant of this product photo so it passes platform duplicate detection. ${prompts[seed % prompts.length]}. Do NOT change product identity, label, or composition meaningfully. Output a clean ${1024}x${1024} photo.`;
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      messages: [{ role: "user", content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: srcUrl } },
      ] }],
      modalities: ["image", "text"],
    }),
  });
  if (!r.ok) throw new Error(`AI ${r.status}: ${await r.text()}`);
  const j = await r.json();
  const data = j.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!data) throw new Error("AI returned no image");
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { action, storeId, productId, folderId, sourceUrls, variantsPerImage = 1 } = await req.json();

    if (!storeId) throw new Error("storeId required");

    if (action === "list_drive") {
      if (!folderId) throw new Error("folderId required");
      const files = await listDriveFolder(folderId);
      return new Response(JSON.stringify({ files }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "import_drive") {
      if (!folderId) throw new Error("folderId required");
      const files = await listDriveFolder(folderId);
      const uploaded: string[] = [];
      for (const f of files) {
        const bytes = await downloadDriveFile(f.id);
        const path = `${storeId}/${productId ?? "shared"}/${crypto.randomUUID()}-${f.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const up = await supabase.storage.from("avito-images").upload(path, bytes, {
          contentType: f.mimeType, upsert: false,
        });
        if (up.error) { console.error(up.error); continue; }
        const { data } = supabase.storage.from("avito-images").getPublicUrl(path);
        uploaded.push(data.publicUrl);
      }
      return new Response(JSON.stringify({ uploaded, count: uploaded.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "uniquify") {
      const sources: string[] = sourceUrls ?? [];
      if (!sources.length) throw new Error("sourceUrls required");
      const results: { source: string; variant: string }[] = [];
      for (const src of sources) {
        for (let i = 0; i < variantsPerImage; i++) {
          try {
            const dataUrl = await uniquifyViaAI(src, i + Math.floor(Math.random() * 100));
            const b64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");
            const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
            const path = `${storeId}/${productId ?? "uniq"}/${crypto.randomUUID()}.png`;
            const up = await supabase.storage.from("avito-images").upload(path, bytes, {
              contentType: "image/png", upsert: false,
            });
            if (up.error) { console.error(up.error); continue; }
            const url = supabase.storage.from("avito-images").getPublicUrl(path).data.publicUrl;
            await supabase.from("avito_image_variants").insert({
              store_id: storeId, product_id: productId ?? null,
              source_url: src, variant_url: url,
              transforms: { method: "ai_uniquify", seed: i },
            });
            results.push({ source: src, variant: url });
          } catch (e) {
            console.error("Uniquify failed:", (e as Error).message);
          }
        }
      }
      return new Response(JSON.stringify({ results, count: results.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list_variants") {
      const { data } = await supabase
        .from("avito_image_variants")
        .select("*")
        .eq("store_id", storeId)
        .eq("product_id", productId)
        .order("created_at", { ascending: false });
      return new Response(JSON.stringify({ variants: data ?? [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
