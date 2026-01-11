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

interface FirecrawlProduct {
  name?: string;
  article?: string;
  code?: string;
  price?: number | string;
  unit?: string;
  category?: string;
  imageUrl?: string;
  image?: string;
}

interface FirecrawlExtractedData {
  products?: FirecrawlProduct[];
  catalogName?: string;
}

async function scrapeWithFirecrawl(catalogUrl: string, apiKey: string): Promise<CatalogResponse> {
  console.log(`Scraping catalog with Firecrawl: ${catalogUrl}`);
  
  const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: catalogUrl,
      formats: ['extract'],
      extract: {
        schema: {
          type: 'object',
          properties: {
            catalogName: { type: 'string' },
            products: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Product name' },
                  article: { type: 'string', description: 'Product article/SKU code' },
                  price: { type: 'number', description: 'Product price in rubles' },
                  unit: { type: 'string', description: 'Unit of measurement (шт, кг, л, etc.)' },
                  category: { type: 'string', description: 'Product category or group name' },
                  imageUrl: { type: 'string', description: 'Product image URL' }
                },
                required: ['name']
              }
            }
          },
          required: ['products']
        },
        prompt: 'Extract all products from this B2B catalog page. For each product extract: name, article/SKU code, price (as number in rubles), unit of measurement, category/group, and image URL. The page is a product catalog from MoySklad B2B system.'
      },
      waitFor: 5000, // Wait for SPA to render
      timeout: 30000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Firecrawl error response:', errorText);
    throw new Error(`Firecrawl API error: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  console.log('Firecrawl response:', JSON.stringify(result, null, 2));

  if (!result.success) {
    throw new Error(result.error || 'Firecrawl scraping failed');
  }

  // Extract data from Firecrawl response
  const extractedData: FirecrawlExtractedData = result.data?.extract || {};
  const rawProducts = extractedData.products || [];

  console.log(`Extracted ${rawProducts.length} products from Firecrawl`);

  // Transform to our format
  const products: PublicCatalogProduct[] = rawProducts.map((item: FirecrawlProduct, index: number) => {
    // Parse price - handle string or number
    let price = 0;
    if (item.price !== undefined && item.price !== null) {
      if (typeof item.price === 'number') {
        price = item.price;
      } else if (typeof item.price === 'string') {
        // Remove currency symbols and spaces, replace comma with dot
        const cleanPrice = item.price.replace(/[^\d.,]/g, '').replace(',', '.');
        price = parseFloat(cleanPrice) || 0;
      }
    }

    return {
      id: crypto.randomUUID(),
      name: item.name || 'Без названия',
      code: item.article || item.code,
      price,
      unit: item.unit || 'шт',
      category: item.category,
      thumbnailUrl: item.imageUrl || item.image,
    };
  });

  return {
    products,
    totalCount: products.length,
    catalogName: extractedData.catalogName,
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'FIRECRAWL_API_KEY is not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { catalogUrl } = await req.json();

    if (!catalogUrl) {
      return new Response(
        JSON.stringify({ error: 'catalogUrl is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate URL format
    if (!catalogUrl.includes('b2b.moysklad.ru/public/')) {
      return new Response(
        JSON.stringify({ error: 'Invalid catalog URL. Expected format: https://b2b.moysklad.ru/public/XXXXX/catalog' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing catalog URL: ${catalogUrl}`);
    const result = await scrapeWithFirecrawl(catalogUrl, apiKey);
    console.log(`Successfully extracted ${result.products.length} products`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error scraping catalog:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to scrape catalog';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
