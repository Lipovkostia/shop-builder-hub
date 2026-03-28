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
    const { action, productId, limit = 100, offset = 0, login, password, search } = body;
    
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
      
      const requestedLimit = Number(limit);
      const safeLimit = Math.min(
        Number.isFinite(requestedLimit) && requestedLimit > 0 ? Math.floor(requestedLimit) : 100,
        search ? 50 : 20
      );
      const safeOffset = Number.isFinite(Number(offset)) ? Math.max(0, Number(offset)) : 0;
      const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
      const response = await fetch(
        `${MOYSKLAD_API_URL}/entity/assortment?limit=${safeLimit}&offset=${safeOffset}${searchParam}`,
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
      const products = data.rows?.map((item: any) => {
        // Extract all sale prices with their type names
        const salePrices = (item.salePrices || []).map((sp: any) => ({
          name: sp.priceType?.name || 'Цена',
          value: sp.value ? sp.value / 100 : 0,
        }));

        return {
          id: item.id,
          name: item.name,
          description: item.description || '',
          code: item.code || '',
          article: item.article || '',
          price: item.salePrices?.[0]?.value ? item.salePrices[0].value / 100 : 0,
          buyPrice: item.buyPrice?.value ? item.buyPrice.value / 100 : 0,
          salePrices,
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
          // Product folder (group) info
          productFolderId: item.productFolder?.meta?.href
            ? item.productFolder.meta.href.split('/').pop()
            : null,
          productFolderName: item.pathName || null,
        };
      }) || [];

      return new Response(
        JSON.stringify({ 
          products, 
          meta: {
            size: data.meta?.size || 0,
            limit: data.meta?.limit || safeLimit,
            offset: data.meta?.offset || safeOffset,
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'get_product_folders') {
      // Fetch all product folders (groups/categories) with hierarchy
      console.log('Fetching product folders from MoySklad...');
      
      const allFolders: any[] = [];
      let folderOffset = 0;
      let hasMore = true;
      
      while (hasMore) {
        const response = await fetch(
          `${MOYSKLAD_API_URL}/entity/productfolder?limit=1000&offset=${folderOffset}`,
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
          console.error('MoySklad folders API error:', response.status, errorText);
          return new Response(
            JSON.stringify({ error: `MoySklad API error: ${response.status}` }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const data = await response.json();
        const rows = data.rows || [];
        
        const folders = rows.map((f: any) => ({
          id: f.id,
          name: f.name,
          pathName: f.pathName || '',
          parentId: f.productFolder?.meta?.href
            ? f.productFolder.meta.href.split('/').pop()
            : null,
          archived: f.archived || false,
        }));
        
        allFolders.push(...folders);
        folderOffset += rows.length;
        hasMore = folderOffset < (data.meta?.size || 0) && rows.length >= 1000;
      }
      
      console.log(`Fetched ${allFolders.length} product folders`);
      
      return new Response(
        JSON.stringify({ folders: allFolders }),
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
      // Fetch organizations list (paged)
      const { organizationLimit = 50, organizationOffset = 0 } = body;
      const requestedLimit = Number(organizationLimit);
      const safeLimit = Math.min(
        Number.isFinite(requestedLimit) && requestedLimit > 0 ? Math.floor(requestedLimit) : 50,
        50
      );
      const safeOffset = Number.isFinite(Number(organizationOffset)) ? Math.max(0, Number(organizationOffset)) : 0;

      console.log(`Fetching organizations from MoySklad... limit=${safeLimit}, offset=${safeOffset}`);
      
      const response = await fetch(
        `${MOYSKLAD_API_URL}/entity/organization?limit=${safeLimit}&offset=${safeOffset}`,
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
        JSON.stringify({
          organizations,
          meta: {
            size: data.meta?.size || 0,
            limit: data.meta?.limit || safeLimit,
            offset: data.meta?.offset || safeOffset,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'get_counterparties') {
      // Fetch counterparties list with all available fields
      const { search, counterpartyLimit = 100, counterpartyOffset = 0 } = body;
      const requestedLimit = Number(counterpartyLimit);
      const safeLimit = Math.min(
        Number.isFinite(requestedLimit) && requestedLimit > 0 ? Math.floor(requestedLimit) : 100,
        1000
      );
      const safeOffset = Number.isFinite(Number(counterpartyOffset)) ? Math.max(0, Number(counterpartyOffset)) : 0;
      console.log(`Fetching counterparties from MoySklad... limit=${safeLimit}, offset=${safeOffset}`);
      
      let url = `${MOYSKLAD_API_URL}/entity/counterparty?limit=${safeLimit}&offset=${safeOffset}`;
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
            limit: data.meta?.limit || safeLimit,
            offset: data.meta?.offset || safeOffset,
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'get_counterparty_by_id') {
      const { counterpartyId } = body;

      if (!counterpartyId) {
        return new Response(
          JSON.stringify({ error: 'counterpartyId is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const response = await fetch(
        `${MOYSKLAD_API_URL}/entity/counterparty/${encodeURIComponent(counterpartyId)}`,
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
        console.error('MoySklad counterparty by id API error:', response.status, errorText);
        return new Response(
          JSON.stringify({ error: `Failed to fetch counterparty: ${response.status}` }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const cp = await response.json();

      const counterparty = {
        id: cp.id,
        name: cp.name,
        phone: cp.phone || null,
        email: cp.email || null,
      };

      return new Response(
        JSON.stringify({ counterparty }),
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

    if (action === 'sync_order_statuses') {
      // Sync order statuses from MoySklad
      // Accepts: order_ids (moysklad IDs), store_id, local_order_map (moysklad_id -> local order id)
      const { order_ids, store_id, local_order_map } = body;
      
      if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
        return new Response(
          JSON.stringify({ error: 'order_ids array is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // If no login/password provided but store_id is given, look up credentials server-side
      let syncAuthHeader = authHeader;
      if (!login && !password && store_id) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        
        const accResp = await fetch(
          `${supabaseUrl}/rest/v1/moysklad_accounts?store_id=eq.${store_id}&limit=1`,
          {
            headers: {
              'apikey': serviceKey,
              'Authorization': `Bearer ${serviceKey}`,
              'Content-Type': 'application/json',
            },
          }
        );
        
        if (accResp.ok) {
          const accounts = await accResp.json();
          if (accounts && accounts.length > 0) {
            const credentials = btoa(`${accounts[0].login}:${accounts[0].password}`);
            syncAuthHeader = `Basic ${credentials}`;
            console.log('Using credentials from store_id lookup');
          } else {
            return new Response(
              JSON.stringify({ error: 'No MoySklad account found for this store' }),
              { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } else {
          return new Response(
            JSON.stringify({ error: 'Failed to look up MoySklad credentials' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      console.log(`Syncing ${order_ids.length} orders from MoySklad...`);

      // Process orders with minimal API roundtrips to avoid timeouts
      const syncOneOrder = async (msOrderId: string) => {
        try {
          const orderResp = await fetch(
            `${MOYSKLAD_API_URL}/entity/customerorder/${encodeURIComponent(msOrderId)}?expand=state,positions,positions.assortment`,
            {
              method: 'GET',
              headers: {
                'Authorization': syncAuthHeader,
                'Content-Type': 'application/json',
              },
            }
          );

          if (!orderResp.ok) {
            const details = await orderResp.text().catch(() => '');
            console.error(`Failed to fetch order ${msOrderId}: ${orderResp.status}`, details);
            return [msOrderId, { error: `HTTP ${orderResp.status}` }] as const;
          }

          const orderData = await orderResp.json();

          const statusName = orderData.state?.name || null;

          let positions = (orderData.positions?.rows || []).map((p: any) => ({
            name: p.assortment?.name || p.assortment?.meta?.href?.split('/').pop() || 'Без названия',
            quantity: Number(p.quantity || 0),
            price: p.price ? Number(p.price) / 100 : 0,
            sum: p.quantity && p.price ? (Number(p.quantity) * Number(p.price)) / 100 : 0,
          }));

          // Fallback for accounts where positions are not expanded in the response
          if (positions.length === 0 && orderData.positions?.meta?.href) {
            try {
              const posResp = await fetch(`${orderData.positions.meta.href}?limit=100`, {
                method: 'GET',
                headers: {
                  'Authorization': syncAuthHeader,
                  'Content-Type': 'application/json',
                },
              });

              if (posResp.ok) {
                const posData = await posResp.json();
                positions = (posData.rows || []).map((p: any) => ({
                  name: p.assortment?.name || p.assortment?.meta?.href?.split('/').pop() || 'Без названия',
                  quantity: Number(p.quantity || 0),
                  price: p.price ? Number(p.price) / 100 : 0,
                  sum: p.quantity && p.price ? (Number(p.quantity) * Number(p.price)) / 100 : 0,
                }));
              }
            } catch (e) {
              console.error('Error fetching fallback positions:', e);
            }
          }

          return [
            msOrderId,
            {
              status: statusName,
              sum: orderData.sum ? Number(orderData.sum) / 100 : 0,
              positions,
              name: orderData.name || null,
              updated: orderData.updated || null,
            },
          ] as const;
        } catch (e) {
          console.error(`Error syncing order ${msOrderId}:`, e);
          return [msOrderId, { error: 'sync failed' }] as const;
        }
      };

      // Run order syncs in parallel (batches of 10 to balance throughput and rate-limits)
      const results: Record<string, any> = {};
      const batchSize = 10;
      for (let i = 0; i < order_ids.length; i += batchSize) {
        const batch = order_ids.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(syncOneOrder));
        for (const [id, data] of batchResults) {
          results[id] = data;
        }
      }

      // Persist synced data to DB using service role (bypasses RLS)
      if (local_order_map && typeof local_order_map === 'object') {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

        const persistEntries = Object.entries(local_order_map).filter(([msId]) => {
          const msData = results[msId];
          return msData && !msData.error;
        });

        const persistBatchSize = 20;
        for (let i = 0; i < persistEntries.length; i += persistBatchSize) {
          const persistBatch = persistEntries.slice(i, i + persistBatchSize);

          await Promise.all(
            persistBatch.map(async ([msId, localId]) => {
              const msData = results[msId];
              try {
                const persistResp = await fetch(`${supabaseUrl}/rest/v1/orders?id=eq.${localId}`, {
                  method: 'PATCH',
                  headers: {
                    'apikey': serviceKey,
                    'Authorization': `Bearer ${serviceKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal',
                  },
                  body: JSON.stringify({
                    moysklad_status: msData.status || null,
                    moysklad_data: {
                      positions: msData.positions,
                      sum: msData.sum,
                      updated: msData.updated,
                    },
                  }),
                });

                if (!persistResp.ok) {
                  const details = await persistResp.text().catch(() => '');
                  console.error(`Failed to persist sync data for order ${localId}: ${persistResp.status}`, details);
                }
              } catch (e) {
                console.error(`Failed to persist sync data for order ${localId}:`, e);
              }
            })
          );
        }
      }

      console.log(`Sync complete: ${Object.keys(results).length} orders processed`);

      return new Response(
        JSON.stringify({ results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Unknown action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in moysklad function:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
