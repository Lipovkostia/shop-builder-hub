import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { action, image_url, store_id, product_id, target_width, target_height, template_url } = await req.json();

    if (action === "ai_resize") {
      // Use AI to intelligently resize/crop image to target dimensions
      const width = target_width || 1280;
      const height = target_height || 960;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Resize this product photo to exactly ${width}x${height} pixels (4:3 aspect ratio) for Avito marketplace. The product must remain the focal point, centered. If the original aspect ratio differs, intelligently extend or fill the background to fit ${width}x${height} without distortion or cropping the product. Keep the image professional, clean, and high quality. Do not add any text, watermarks, or logos.`,
                },
                {
                  type: "image_url",
                  image_url: { url: image_url },
                },
              ],
            },
          ],
          modalities: ["image", "text"],
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Превышен лимит запросов, попробуйте позже" }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Недостаточно средств на балансе AI" }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const t = await response.text();
        console.error("AI gateway error:", response.status, t);
        throw new Error(`AI error: ${response.status}`);
      }

      const data = await response.json();
      const imageData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

      if (!imageData) {
        throw new Error("AI did not return an image");
      }

      // Upload the generated image to storage
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Decode base64 image
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
      const imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

      const fileName = `${store_id}/${product_id}/avito_${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage
        .from("avito-images")
        .upload(fileName, imageBytes, { contentType: "image/png", upsert: true });

      if (uploadError) throw new Error(`Upload error: ${uploadError.message}`);

      const { data: urlData } = supabase.storage.from("avito-images").getPublicUrl(fileName);

      return new Response(
        JSON.stringify({ success: true, url: urlData.publicUrl }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "ai_template_overlay") {
      // Use AI to overlay template on product image
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Overlay the second image (template with transparent areas) on top of the first image (product photo). The template should be placed exactly on top, preserving all transparent areas of the template so the product photo shows through. Output a single combined image at 1280x960 resolution.",
                },
                {
                  type: "image_url",
                  image_url: { url: image_url },
                },
                {
                  type: "image_url",
                  image_url: { url: template_url },
                },
              ],
            },
          ],
          modalities: ["image", "text"],
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Превышен лимит запросов" }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const t = await response.text();
        throw new Error(`AI error: ${response.status} - ${t}`);
      }

      const data = await response.json();
      const imageData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (!imageData) throw new Error("AI did not return an image");

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
      const imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

      const fileName = `${store_id}/${product_id}/avito_tpl_${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage
        .from("avito-images")
        .upload(fileName, imageBytes, { contentType: "image/png", upsert: true });

      if (uploadError) throw new Error(`Upload error: ${uploadError.message}`);

      const { data: urlData } = supabase.storage.from("avito-images").getPublicUrl(fileName);

      return new Response(
        JSON.stringify({ success: true, url: urlData.publicUrl }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Avito image edit error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
