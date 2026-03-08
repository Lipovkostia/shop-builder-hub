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

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "0", 10);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "10", 10), 50);

    // Fetch all featured products with images
    const { data, error } = await supabase
      .from("featured_products")
      .select("sort_order, product_id, products(id, name, price, buy_price, images, description, slug)")
      .order("sort_order", { ascending: true });

    if (error) throw error;

    // Filter to only products with images
    const allProducts = (data || [])
      .map((fp: any) => fp.products)
      .filter(Boolean)
      .filter((p: any) => p.images && p.images.length > 0)
      .map((p: any) => ({
        id: p.id,
        name: p.name,
        price: Number(p.price) || 0,
        images: p.images || [],
        description: p.description,
        slug: p.slug,
      }));

    // Shuffle using seeded random per-hour (so it changes periodically but is consistent within the hour)
    const hourSeed = Math.floor(Date.now() / (1000 * 60 * 60));
    const shuffled = shuffleWithSeed(allProducts, hourSeed);

    // Paginate
    const start = page * limit;
    const pageData = shuffled.slice(start, start + limit);

    return new Response(
      JSON.stringify({ data: pageData }),
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

function shuffleWithSeed<T>(array: T[], seed: number): T[] {
  const arr = [...array];
  let s = seed;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
