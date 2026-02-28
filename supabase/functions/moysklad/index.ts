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
    const body = await req.json();
    const { action, productId, limit = 100, offset = 0, login, password } = body;
    
    console.log(`MoySklad API action: ${action}, productId: ${productId}, limit: ${limit}, offset: ${offset}`);

    // Support both: 1) login/password from request, 2) stored token from env
    let authHeader: string;
    
    if (login && password) {
      // Use Basic Auth with login:password
      const credentials = btoa(`${login}:${password}`);
      authHeader = `Basic ${credentials}`;
      console.log('Using Basic Auth with login/password');
    } else {
      // Fallback to stored token
      const moyskladToken = Deno.env.get('MOYSKLAD_TOKEN');
      if (!moyskladToken) {
        console.error('No credentials provided and MOYSKLAD_TOKEN not configured');
        return new Response(
          JSON.stringify({ error: 'Требуется указать логин и пароль МойСклад' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      authHeader = `Bearer ${moyskladToken}`;
      console.log('Using Bearer token from env');
    }

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
        // Full size image URL - remove miniature parameter for full resolution
        fullSize: img.meta?.downloadHref || null,
      })) || [];

      return new Response(
        JSON.stringify({ images }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'get_image_content') {
      // Fetch actual image content and return as base64 or URL
      const { imageUrl } = body;
      
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
      const uint8Array = new Uint8Array(arrayBuffer);
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      
      // Convert to base64 in chunks to avoid stack overflow for large images
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, Array.from(chunk));
      }
      const base64 = btoa(binary);

      return new Response(
        JSON.stringify({ 
          imageData: `data:${contentType};base64,${base64}` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'get_organizations') {
      // Fetch organizations list
      console.log('Fetching organizations from MoySklad...');
      
      const response = await fetch(
        `${MOYSKLAD_API_URL}/entity/organization?limit=100`,
        {
          method: 'GET',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('MoySklad organizations API error:', response.status, errorText);
        return new Response(
          JSON.stringify({ error: `Failed to fetch organizations: ${response.status}` }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      console.log(`Found ${data.rows?.length || 0} organizations`);

      const organizations = data.rows?.map((org: any) => ({
        id: org.id,
        name: org.name,
      })) || [];

      return new Response(
        JSON.stringify({ organizations }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'get_counterparties') {
      // Fetch counterparties list with all available fields
      const { search, counterpartyLimit = 100, counterpartyOffset = 0 } = body;
      console.log(`Fetching counterparties from MoySklad... limit=${counterpartyLimit}, offset=${counterpartyOffset}`);
      
      let url = `${MOYSKLAD_API_URL}/entity/counterparty?limit=${counterpartyLimit}&offset=${counterpartyOffset}`;
      if (search) {
        url += `&search=${encodeURIComponent(search)}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
          'Accept-Encoding': 'gzip',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('MoySklad counterparties API error:', response.status, errorText);
        return new Response(
          JSON.stringify({ error: `Failed to fetch counterparties: ${response.status}` }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      console.log(`Found ${data.rows?.length || 0} counterparties`);

      const counterparties = data.rows?.map((cp: any) => ({
        id: cp.id,
        name: cp.name,
        phone: cp.phone || null,
        email: cp.email || null,
        description: cp.description || null,
        companyType: cp.companyType || null,
        legalTitle: cp.legalTitle || null,
        legalAddress: cp.legalAddress || null,
        legalAddressFull: cp.legalAddressFull || null,
        actualAddress: cp.actualAddress || null,
        actualAddressFull: cp.actualAddressFull || null,
        inn: cp.inn || null,
        kpp: cp.kpp || null,
        ogrn: cp.ogrn || null,
        ogrnip: cp.ogrnip || null,
        okpo: cp.okpo || null,
        certificateNumber: cp.certificateNumber || null,
        certificateDate: cp.certificateDate || null,
        tags: cp.tags || [],
        code: cp.code || null,
        externalCode: cp.externalCode || null,
        archived: cp.archived || false,
        created: cp.created || null,
        updated: cp.updated || null,
        salesAmount: cp.salesAmount || 0,
        bonusProgram: cp.bonusProgram || null,
        discountCardNumber: cp.discountCardNumber || null,
        fax: cp.fax || null,
      })) || [];

      return new Response(
        JSON.stringify({ 
          counterparties,
          meta: {
            size: data.meta?.size || 0,
            limit: data.meta?.limit || counterpartyLimit,
            offset: data.meta?.offset || counterpartyOffset,
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'create_customerorder') {
      // Create a customer order
      const { order } = body;
      
      if (!order) {
        return new Response(
          JSON.stringify({ error: 'order data is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Creating customer order in MoySklad:', order.name);

      // Build positions array
      // IMPORTANT: `pos.price` is expected to be in kopecks already.
      const positions = order.positions?.map((pos: any) => ({
        quantity: pos.quantity,
        price: pos.price,
        assortment: {
          meta: {
            href: `${MOYSKLAD_API_URL}/entity/product/${pos.moysklad_id}`,
            type: 'product',
            mediaType: 'application/json',
          },
        },
      })) || [];

      // Build order payload
      const orderPayload: any = {
        name: order.name,
        organization: {
          meta: {
            href: `${MOYSKLAD_API_URL}/entity/organization/${order.organization_id}`,
            type: 'organization',
            mediaType: 'application/json',
          },
        },
        agent: {
          meta: {
            href: `${MOYSKLAD_API_URL}/entity/counterparty/${order.counterparty_id}`,
            type: 'counterparty',
            mediaType: 'application/json',
          },
        },
        positions,
      };

      if (order.description) {
        orderPayload.description = order.description;
      }

      const response = await fetch(
        `${MOYSKLAD_API_URL}/entity/customerorder`,
        {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(orderPayload),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('MoySklad create order API error:', response.status, errorText);
        return new Response(
          JSON.stringify({ error: `Failed to create order: ${response.status}`, details: errorText }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      console.log('Order created successfully:', data.id);

      return new Response(
        JSON.stringify({ 
          order: {
            id: data.id,
            name: data.name,
          },
          success: true,
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
