import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function callImageAI(prompt: string, imageUrls: string[], model = "google/gemini-2.5-flash-image") {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

  const content: any[] = [{ type: "text", text: prompt }];
  for (const url of imageUrls) {
    content.push({ type: "image_url", image_url: { url } });
  }

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content }],
      modalities: ["image", "text"],
    }),
  });

  if (!response.ok) {
    if (response.status === 429) throw { status: 429, message: "Превышен лимит запросов, попробуйте позже" };
    if (response.status === 402) throw { status: 402, message: "Недостаточно средств на балансе AI" };
    const t = await response.text();
    console.error("AI gateway error:", response.status, t);
    throw new Error(`AI error: ${response.status}`);
  }

  const data = await response.json();
  const imageData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!imageData) throw new Error("AI did not return an image");
  return imageData;
}

async function uploadImage(base64Data: string, bucket: string, fileName: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, "");
  const imageBytes = Uint8Array.from(atob(cleanBase64), (c) => c.charCodeAt(0));

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(fileName, imageBytes, { contentType: "image/png", upsert: true });

  if (uploadError) throw new Error(`Upload error: ${uploadError.message}`);

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName);
  return urlData.publicUrl;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, image_url, store_id, product_id, target_width, target_height, template_url } = await req.json();

    if (action === "ai_resize") {
      const width = target_width || 1280;
      const height = target_height || 960;
      const imageData = await callImageAI(
        `Resize this product photo to exactly ${width}x${height} pixels (4:3 aspect ratio) for Avito marketplace. The product must remain the focal point, centered. If the original aspect ratio differs, intelligently extend or fill the background to fit ${width}x${height} without distortion or cropping the product. Keep the image professional, clean, and high quality. Do not add any text, watermarks, or logos.`,
        [image_url]
      );
      const fileName = `${store_id}/${product_id}/avito_${Date.now()}.png`;
      const url = await uploadImage(imageData, "avito-images", fileName);
      return new Response(JSON.stringify({ success: true, url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "ai_template_overlay") {
      const imageData = await callImageAI(
        "Overlay the second image (template with transparent areas) on top of the first image (product photo). The template should be placed exactly on top, preserving all transparent areas of the template so the product photo shows through. Output a single combined image at 1280x960 resolution.",
        [image_url, template_url]
      );
      const fileName = `${store_id}/${product_id}/avito_tpl_${Date.now()}.png`;
      const url = await uploadImage(imageData, "avito-images", fileName);
      return new Response(JSON.stringify({ success: true, url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "ai_remove_background") {
      const imageData = await callImageAI(
        "Remove the background from this product photo completely. Keep ONLY the product itself with a clean, pure white background (#FFFFFF). The product edges should be clean and precise. Do not crop or resize the product. Output a high-quality image with the product centered on a white background.",
        [image_url],
        "google/gemini-3-pro-image-preview"
      );
      const fileName = `${store_id}/${product_id}/avito_nobg_${Date.now()}.png`;
      const url = await uploadImage(imageData, "avito-images", fileName);
      return new Response(JSON.stringify({ success: true, url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "ai_upscale") {
      const imageData = await callImageAI(
        "Upscale and enlarge this product photo to 1920x1440 resolution while preserving all details and improving sharpness. The image should look crisp, high-resolution, and professional. Do not add artifacts, blur, or noise. Keep colors accurate. Do not add text, watermarks, or logos.",
        [image_url],
        "google/gemini-3-pro-image-preview"
      );
      const fileName = `${store_id}/${product_id}/avito_upscale_${Date.now()}.png`;
      const url = await uploadImage(imageData, "avito-images", fileName);
      return new Response(JSON.stringify({ success: true, url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "ai_enhance") {
      const imageData = await callImageAI(
        "Enhance this product photo to make it look professional and appealing for a marketplace listing. Improve brightness, contrast, color balance, and sharpness. Make colors more vivid and the product more attractive. Remove any noise or grain. Keep the image natural-looking — do not over-process. Do not add text, watermarks, or logos. Do not change the composition or crop the image.",
        [image_url],
        "google/gemini-3-pro-image-preview"
      );
      const fileName = `${store_id}/${product_id}/avito_enhanced_${Date.now()}.png`;
      const url = await uploadImage(imageData, "avito-images", fileName);
      return new Response(JSON.stringify({ success: true, url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    const status = err.status || 500;
    const message = err.message || "Internal error";
    console.error("Avito image edit error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
