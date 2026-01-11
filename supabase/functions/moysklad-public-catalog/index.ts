import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PublicCatalogProduct {
  id: string;
  name: string;
  code?: string;
  price: number;
  unit: string;
  category?: string;
  thumbnailUrl?: string;
}

interface CatalogResponse {
  products: PublicCatalogProduct[];
  totalCount: number;
  catalogName?: string;
}

// Extract catalog ID from URL like https://b2b.moysklad.ru/public/ws6WnM9cfbCt/catalog
function extractCatalogId(url: string): string | null {
  const match = url.match(/\/public\/([^\/]+)/);
  return match ? match[1] : null;
}

async function fetchCatalogPage(catalogId: string, offset: number, limit: number): Promise<any> {
  const apiUrl = `https://b2b.moysklad.ru/api/public/${catalogId}/products?offset=${offset}&limit=${limit}`;
  
  const response = await fetch(apiUrl, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch catalog: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function fetchAllProducts(catalogId: string): Promise<CatalogResponse> {
  const limit = 100;
  let offset = 0;
  let allProducts: PublicCatalogProduct[] = [];
  let totalCount = 0;
  let catalogName: string | undefined;

  // First request to get total count
  const firstPage = await fetchCatalogPage(catalogId, 0, limit);
  totalCount = firstPage.meta?.size || firstPage.rows?.length || 0;
  
  // Process rows
  const processRows = (rows: any[]) => {
    return rows.map((item: any) => {
      // Extract price - structure may vary
      let price = 0;
      if (item.salePrices && item.salePrices.length > 0) {
        price = (item.salePrices[0].value || 0) / 100; // MoySklad stores prices in kopecks
      } else if (item.price) {
        price = typeof item.price === 'number' ? item.price / 100 : 0;
      }

      // Extract unit
      let unit = 'шт';
      if (item.uom?.name) {
        unit = item.uom.name;
      }

      // Extract category/group
      let category: string | undefined;
      if (item.productFolder?.name) {
        category = item.productFolder.name;
      } else if (item.pathName) {
        category = item.pathName;
      }

      // Extract thumbnail
      let thumbnailUrl: string | undefined;
      if (item.images && item.images.length > 0) {
        thumbnailUrl = item.images[0].miniature?.href || item.images[0].tiny?.href || item.images[0].meta?.href;
      } else if (item.image) {
        thumbnailUrl = item.image.miniature?.href || item.image.tiny?.href;
      }

      return {
        id: item.id || crypto.randomUUID(),
        name: item.name || 'Без названия',
        code: item.article || item.code,
        price,
        unit,
        category,
        thumbnailUrl,
      };
    });
  };

  if (firstPage.rows) {
    allProducts = processRows(firstPage.rows);
  }

  // Fetch remaining pages
  offset = limit;
  while (offset < totalCount) {
    const page = await fetchCatalogPage(catalogId, offset, limit);
    if (page.rows && page.rows.length > 0) {
      allProducts = [...allProducts, ...processRows(page.rows)];
    } else {
      break;
    }
    offset += limit;
  }

  return {
    products: allProducts,
    totalCount: allProducts.length,
    catalogName,
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { catalogUrl } = await req.json();

    if (!catalogUrl) {
      return new Response(
        JSON.stringify({ error: 'catalogUrl is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const catalogId = extractCatalogId(catalogUrl);
    if (!catalogId) {
      return new Response(
        JSON.stringify({ error: 'Invalid catalog URL. Expected format: https://b2b.moysklad.ru/public/XXXXX/catalog' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching catalog: ${catalogId}`);
    const result = await fetchAllProducts(catalogId);
    console.log(`Fetched ${result.products.length} products`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error fetching catalog:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch catalog';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
