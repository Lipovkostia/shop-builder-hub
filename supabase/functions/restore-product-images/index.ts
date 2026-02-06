import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { offset = 0, limit = 100 } = await req.json().catch(() => ({}));
    const storeId = '25a0ac3f-c687-4e9a-bbcb-ce1f0df0b39b';

    // Only fetch products with exactly 1 image — these are the candidates
    const { data: products, error } = await supabase
      .from('products')
      .select('id, images')
      .eq('store_id', storeId)
      .not('images', 'is', null)
      .order('id')
      .range(offset, offset + limit - 1);

    if (error) throw error;

    console.log(`Batch: offset=${offset}, fetched ${products?.length || 0} products`);

    let restored = 0;
    let skipped = 0;

    for (const product of (products || [])) {
      const currentImages: string[] = product.images || [];
      
      const { data: files, error: listError } = await supabase.storage
        .from('product-images')
        .list(product.id);

      if (listError || !files || files.length === 0) {
        skipped++;
        continue;
      }

      const realFiles = files.filter(f => f.name !== '.emptyFolderPlaceholder');
      
      if (realFiles.length <= currentImages.length) {
        skipped++;
        continue;
      }

      const newUrls: string[] = [];
      const oldUrls: string[] = [];

      for (const file of realFiles) {
        const { data: urlData } = supabase.storage
          .from('product-images')
          .getPublicUrl(`${product.id}/${file.name}`);

        const url = urlData.publicUrl;
        
        // Recent imports have timestamps starting with 1770
        if (file.name.match(/^1770\d+/)) {
          newUrls.push(url);
        } else {
          oldUrls.push(url);
        }
      }

      const mergedImages = [...newUrls, ...oldUrls];

      if (mergedImages.length > currentImages.length) {
        const { error: updateError } = await supabase
          .from('products')
          .update({ images: mergedImages })
          .eq('id', product.id);

        if (!updateError) {
          restored++;
          console.log(`Restored ${product.id}: ${currentImages.length} -> ${mergedImages.length}`);
        }
      } else {
        skipped++;
      }
    }

    const hasMore = (products?.length || 0) === limit;

    return new Response(
      JSON.stringify({ success: true, restored, skipped, hasMore, nextOffset: hasMore ? offset + limit : null }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
