import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase
      .from("featured_products")
      .select("sort_order, product_id, products(id, name, price, buy_price, images, description, slug)")
      .order("sort_order", { ascending: true });

    if (error) throw error;

    const products = (data || [])
      .map((fp: any) => fp.products)
      .filter(Boolean)
      .map((p: any) => ({
        id: p.id,
        name: p.name,
        price: Number(p.price) || 0,
        images: p.images || [],
        description: p.description,
        slug: p.slug,
      }));

    return new Response(
      JSON.stringify({ data: products }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
