import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MOYSKLAD_API_URL = 'https://api.moysklad.ru/api/remap/1.2';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const moyskladToken = Deno.env.get('MOYSKLAD_TOKEN');
    
    if (!moyskladToken) {
      console.error('MOYSKLAD_TOKEN not configured');
      return new Response(
        JSON.stringify({ error: 'MOYSKLAD_TOKEN not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, productId, limit = 100, offset = 0 } = await req.json();
    console.log(`MoySklad API action: ${action}, productId: ${productId}, limit: ${limit}, offset: ${offset}`);

    const authHeader = `Bearer ${moyskladToken}`;

    if (action === 'get_assortment') {
      // Fetch products/assortment list
      console.log('Fetching assortment from MoySklad...');
      
      const response = await fetch(
        `${MOYSKLAD_API_URL}/entity/assortment?limit=${limit}&offset=${offset}`,
        {
          method: 'GET',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
            'Accept-Encoding': 'gzip',
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('MoySklad API error:', response.status, errorText);
        return new Response(
          JSON.stringify({ error: `MoySklad API error: ${response.status}`, details: errorText }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      console.log(`Fetched ${data.rows?.length || 0} items from assortment`);

      // Transform the data to include only relevant fields
      const products = data.rows?.map((item: any) => ({
        id: item.id,
        name: item.name,
        description: item.description || '',
        code: item.code || '',
        article: item.article || '',
        price: item.salePrices?.[0]?.value ? item.salePrices[0].value / 100 : 0, // Convert from kopeks
        buyPrice: item.buyPrice?.value ? item.buyPrice.value / 100 : 0,
        quantity: item.quantity || 0,
        stock: item.stock || 0,
        productType: item.meta?.type || 'product',
        images: item.images?.meta?.href || null,
        imagesCount: item.images?.meta?.size || 0,
        meta: item.meta,
        uom: item.uom?.name || '',
        weight: item.weight || 0,
        volume: item.volume || 0,
        archived: item.archived || false,
      })) || [];

      return new Response(
        JSON.stringify({ 
          products, 
          meta: {
            size: data.meta?.size || 0,
            limit: data.meta?.limit || limit,
            offset: data.meta?.offset || offset,
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'get_product_images') {
      // Fetch images for a specific product
      if (!productId) {
        return new Response(
          JSON.stringify({ error: 'productId is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Fetching images for product: ${productId}`);
      
      const response = await fetch(
        `${MOYSKLAD_API_URL}/entity/product/${productId}/images`,
        {
          method: 'GET',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        // If no images found, return empty array
        if (response.status === 404) {
          return new Response(
            JSON.stringify({ images: [] }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const errorText = await response.text();
        console.error('MoySklad images API error:', response.status, errorText);
        return new Response(
          JSON.stringify({ error: `Failed to fetch images: ${response.status}` }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      console.log(`Found ${data.rows?.length || 0} images for product`);

      const images = data.rows?.map((img: any) => ({
        id: img.id,
        title: img.title || img.filename,
        filename: img.filename,
        size: img.size,
        miniature: img.miniature?.href || null,
        tiny: img.tiny?.href || null,
        downloadHref: img.meta?.downloadHref || null,
      })) || [];

      return new Response(
        JSON.stringify({ images }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'get_image_content') {
      // Fetch actual image content and return as base64 or URL
      const { imageUrl } = await req.json();
      
      if (!imageUrl) {
        return new Response(
          JSON.stringify({ error: 'imageUrl is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Fetching image content from: ${imageUrl}`);

      const response = await fetch(imageUrl, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
        },
      });

      if (!response.ok) {
        console.error('Failed to fetch image:', response.status);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch image' }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      const contentType = response.headers.get('content-type') || 'image/jpeg';

      return new Response(
        JSON.stringify({ 
          imageData: `data:${contentType};base64,${base64}` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Unknown action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in moysklad function:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
