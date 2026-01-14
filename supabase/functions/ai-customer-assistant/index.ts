import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CatalogProduct {
  id: string;
  name: string;
  price: number;
  buy_price: number | null;
  markup_type: string | null;
  markup_value: number | null;
  unit: string;
  unit_weight: number | null;
  price_full: number | null;
  price_half: number | null;
  price_quarter: number | null;
  price_portion: number | null;
  category_id: string | null;
  is_active: boolean;
  images: string[] | null;
  catalog_status?: string;
  catalog_markup_type?: string;
  catalog_markup_value?: number;
  catalog_portion_prices?: {
    full?: number;
    half?: number;
    quarter?: number;
    portion?: number;
  };
  effective_price?: number;
}

// Calculate effective price with catalog/product markup
function calculateEffectivePrice(
  price: number,
  buyPrice: number | null,
  markupType: string | null | undefined,
  markupValue: number | null | undefined
): number {
  const bp = buyPrice || 0;
  
  // If we have buy_price and markup, calculate price with markup
  if (bp > 0 && markupType && markupValue != null) {
    if (markupType === 'percent') {
      return bp * (1 + markupValue / 100);
    } else if (markupType === 'fixed') {
      return bp + markupValue;
    }
  }
  
  // If price is 0 but we have buy_price, use buy_price as fallback
  if (price === 0 && bp > 0) {
    return bp;
  }
  
  return price;
}

interface OrderItem {
  product_id: string | null;
  product_name: string;
  quantity: number;
  price: number;
}

interface FoundItem {
  productId: string;
  productName: string;
  variantIndex: number; // 0=full, 1=half, 2=quarter, 3=portion
  variantLabel: string;
  quantity: number;
  unitPrice: number;       // цена за 1 порцию
  pricePerUnit: number;    // цена за единицу измерения (кг/шт)
  portionVolume: number;   // объём одной порции
  totalPrice: number;
  totalWeight: number;     // общий вес
  unitLabel: string;       // "кг", "шт"
  imageUrl?: string;       // URL изображения
  available: boolean;
  matchReason: string;
  suggestion?: {
    productId: string;
    productName: string;
    reason: string;
  };
}

interface CustomerAIResponse {
  items: FoundItem[];
  summary: string;
  totalPrice: number;
  recognized_text?: string;
  unavailableCount: number;
  error?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const contentType = req.headers.get("content-type") || "";
    
    let catalogId: string;
    let query: string = "";
    let audioBlob: Blob | null = null;
    let repeatOrderId: string | null = null;
    
    // Handle both FormData (with audio) and JSON requests
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      catalogId = formData.get("catalogId") as string;
      query = formData.get("query") as string || "";
      repeatOrderId = formData.get("repeatOrderId") as string || null;
      const audioFile = formData.get("audio");
      if (audioFile && audioFile instanceof Blob) {
        audioBlob = audioFile;
      }
    } else {
      const body = await req.json();
      catalogId = body.catalogId;
      query = body.query || "";
      repeatOrderId = body.repeatOrderId || null;
    }

    if (!catalogId) {
      return new Response(
        JSON.stringify({ error: "catalogId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // If audio provided, transcribe it first with ElevenLabs
    let recognizedText = query;
    if (audioBlob) {
      const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
      if (!ELEVENLABS_API_KEY) {
        return new Response(
          JSON.stringify({ error: "ElevenLabs API key not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Determine file extension from MIME type
      const mimeType = audioBlob.type || 'audio/webm';
      const extMap: Record<string, string> = {
        'audio/webm': 'webm',
        'audio/mp4': 'm4a',
        'audio/aac': 'aac',
        'audio/ogg': 'ogg',
        'audio/wav': 'wav',
        'audio/mpeg': 'mp3',
      };
      const fileExt = extMap[mimeType] || 'webm';
      const fileName = `audio.${fileExt}`;
      
      console.log(`Processing audio: mimeType=${mimeType}, fileName=${fileName}, size=${audioBlob.size}`);

      const audioFormData = new FormData();
      audioFormData.append("file", audioBlob, fileName);
      audioFormData.append("model_id", "scribe_v1");
      audioFormData.append("language_code", "rus");

      const sttResponse = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
        },
        body: audioFormData,
      });

      if (!sttResponse.ok) {
        const errorText = await sttResponse.text();
        console.error("ElevenLabs STT error:", errorText);
        return new Response(
          JSON.stringify({ error: "Speech recognition failed", details: errorText }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const sttResult = await sttResponse.json();
      recognizedText = sttResult.text || "";
      console.log("Recognized text:", recognizedText);
    }

    // Fetch catalog with store info
    const { data: catalog, error: catalogError } = await supabase
      .from("catalogs")
      .select("id, store_id, name")
      .eq("id", catalogId)
      .single();

    if (catalogError || !catalog) {
      console.error("Catalog fetch error:", catalogError);
      return new Response(
        JSON.stringify({ error: "Catalog not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch products visible in this catalog with catalog settings
    const { data: visibleProducts, error: visibilityError } = await supabase
      .from("product_catalog_visibility")
      .select("product_id")
      .eq("catalog_id", catalogId);

    if (visibilityError) {
      console.error("Visibility fetch error:", visibilityError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch catalog products" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const productIds = (visibleProducts || []).map(v => v.product_id);
    
    if (productIds.length === 0) {
      return new Response(
        JSON.stringify({
          items: [],
          summary: "В каталоге нет товаров",
          totalPrice: 0,
          recognized_text: recognizedText,
          unavailableCount: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch products (include images)
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, name, price, buy_price, markup_type, markup_value, unit, unit_weight, price_full, price_half, price_quarter, price_portion, category_id, is_active, images")
      .in("id", productIds);

    if (productsError) {
      console.error("Products fetch error:", productsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch products" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch catalog product settings
    const { data: catalogSettings } = await supabase
      .from("catalog_product_settings")
      .select("product_id, status, markup_type, markup_value, portion_prices")
      .eq("catalog_id", catalogId);

    const settingsMap = new Map(
      (catalogSettings || []).map(s => [s.product_id, s])
    );

    // Fetch categories for context
    const { data: categories } = await supabase
      .from("categories")
      .select("id, name")
      .eq("store_id", catalog.store_id);

    const categoryMap = new Map(
      (categories || []).map(c => [c.id, c.name])
    );

    // Build enriched product list
    const catalogProducts: CatalogProduct[] = (products || []).map(p => {
      const settings = settingsMap.get(p.id);
      
      // Determine markup: catalog settings take priority over product settings
      const effectiveMarkupType = settings?.markup_type || p.markup_type;
      const effectiveMarkupValue = settings?.markup_value ?? p.markup_value;
      
      // Calculate effective price with markup
      const effectivePrice = calculateEffectivePrice(
        p.price,
        p.buy_price,
        effectiveMarkupType,
        effectiveMarkupValue
      );
      
      return {
        ...p,
        effective_price: effectivePrice,
        catalog_status: settings?.status || "in_stock",
        catalog_markup_type: effectiveMarkupType,
        catalog_markup_value: effectiveMarkupValue,
        catalog_portion_prices: settings?.portion_prices as any,
        category_name: p.category_id ? categoryMap.get(p.category_id) : null,
      };
    });

    // Handle repeat order
    let orderContext = "";
    if (repeatOrderId) {
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .select("id, order_number, created_at")
        .eq("id", repeatOrderId)
        .single();

      if (!orderError && order) {
        const { data: orderItems } = await supabase
          .from("order_items")
          .select("product_id, product_name, quantity, price")
          .eq("order_id", repeatOrderId);

        if (orderItems && orderItems.length > 0) {
          orderContext = `
ЗАПРОС НА ПОВТОРЕНИЕ ЗАКАЗА #${order.order_number} от ${new Date(order.created_at).toLocaleDateString('ru-RU')}:
Товары в заказе:
${orderItems.map((i: OrderItem) => `- ${i.product_name}: ${i.quantity} ед. по ${i.price}₽`).join('\n')}

Задача: найди эти товары в текущем каталоге, проверь доступность и актуальные цены.
`;
        }
      }
    }

    if (!recognizedText?.trim() && !repeatOrderId) {
      return new Response(
        JSON.stringify({ error: "No query provided and no speech recognized" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate prices for products - use effective_price with markup applied
    const productListForAI = catalogProducts.slice(0, 150).map(p => {
      const basePrice = p.effective_price || p.price;
      const unitWeight = p.unit_weight || 1;
      const catalogPrices = p.catalog_portion_prices;
      const markupType = p.catalog_markup_type;
      const markupValue = p.catalog_markup_value;
      
      // Helper to apply markup to portion prices
      const applyMarkup = (price: number | null | undefined): number | null => {
        if (price == null) return null;
        if (markupType === 'percent' && markupValue != null) {
          return price * (1 + markupValue / 100);
        } else if (markupType === 'fixed' && markupValue != null) {
          return price + markupValue;
        }
        return price;
      };
      
      const fullPricePerKg = applyMarkup(catalogPrices?.full) ?? applyMarkup(p.price_full) ?? basePrice;
      const halfPricePerKg = applyMarkup(catalogPrices?.half) ?? applyMarkup(p.price_half) ?? basePrice;
      const quarterPricePerKg = applyMarkup(catalogPrices?.quarter) ?? applyMarkup(p.price_quarter) ?? basePrice;
      const portionPrice = applyMarkup(catalogPrices?.portion) ?? applyMarkup(p.price_portion) ?? null;
      
      const fullPrice = fullPricePerKg * unitWeight;
      const halfPrice = halfPricePerKg * (unitWeight / 2);
      const quarterPrice = quarterPricePerKg * (unitWeight / 4);
      
      const hasHalf = catalogPrices?.half != null || p.price_half != null;
      const hasQuarter = catalogPrices?.quarter != null || p.price_quarter != null;
      const hasPortion = portionPrice != null;
      
      return {
        id: p.id,
        name: p.name,
        category: (p as any).category_name || "",
        unit: p.unit,
        unitWeight,
        basePrice,
        status: p.catalog_status,
        available: p.catalog_status === "in_stock" || p.catalog_status === "pre_order",
        variants: {
          full: { price: Math.round(fullPrice), weight: unitWeight },
          ...(hasHalf ? { half: { price: Math.round(halfPrice), weight: unitWeight / 2 } } : {}),
          ...(hasQuarter ? { quarter: { price: Math.round(quarterPrice), weight: unitWeight / 4 } } : {}),
          ...(hasPortion ? { portion: { price: Math.round(portionPrice!) } } : {}),
        },
      };
    });

    // Call Lovable AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Lovable AI API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `Ты AI-помощник покупателя B2B каталога. Помогаешь быстро сформировать заказ.

ПРАВИЛА ПОИСКА ТОВАРОВ:
1. Ищи по частичному совпадению названия (fuzzy match)
2. Понимай синонимы: "сёмга"="семга"="лосось атлантический", "форель"="радужная форель"
3. Понимай порции: "целый"/"целая" → variant 0 (full), "половина"/"полкило" → variant 1 (half), "четверть" → variant 2 (quarter), "порция" → variant 3 (portion)
4. Понимай количество: "два", "три", "пара"=2, "несколько"=2
5. Понимай вес: "2 кг", "полкило"=0.5кг, "500 грамм"=0.5кг
6. Понимай категории: "вся рыба", "все сыры", "морепродукты"

ПРАВИЛА ПОДБОРА ВАРИАНТОВ:
- Если указан вес (например "2 кг семги") — подбери вариант и количество чтобы получить нужный вес
- "полкило форели" → если unit_weight≈1кг, то variant=1 (half), quantity=1
- "3 порции икры" → variant=3 (portion), quantity=3
- Если не указан вариант — используй variant=0 (full/целый)

ПРАВИЛА ДОСТУПНОСТИ:
- Если товар status='hidden' или status='out_of_stock' → available: false
- Для недоступных товаров предложи похожую замену (suggestion)

ФОРМАТ ОТВЕТА:
Используй tool_call find_products для возврата найденных товаров.

Товары каталога (${productListForAI.length} шт):
${JSON.stringify(productListForAI, null, 2)}
${catalogProducts.length > 150 ? `\n... и ещё ${catalogProducts.length - 150} товаров` : ""}`;

    const userPrompt = repeatOrderId 
      ? orderContext
      : `Запрос покупателя: "${recognizedText}"

Найди товары и определи количество/вариант для каждого.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "find_products",
              description: "Find products matching the customer's request",
              parameters: {
                type: "object",
                properties: {
                  items: {
                    type: "array",
                    description: "List of found products",
                    items: {
                      type: "object",
                      properties: {
                        product_id: { type: "string", description: "Product ID from the catalog" },
                        variant_index: { type: "integer", description: "Variant: 0=full, 1=half, 2=quarter, 3=portion" },
                        qty: { type: "integer", description: "Number of items" },
                        match_reason: { type: "string", description: "Why this product was matched" },
                        alt_product_id: { type: "string", description: "Alternative product ID if original unavailable" },
                        alt_reason: { type: "string", description: "Why suggesting this alternative" },
                      },
                      required: ["product_id", "variant_index", "qty", "match_reason"],
                    },
                  },
                  summary: {
                    type: "string",
                    description: "Brief summary in Russian, e.g. 'Найдено 3 товара'",
                  },
                },
                required: ["items", "summary"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "find_products" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI processing failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResult = await aiResponse.json();
    console.log("AI result:", JSON.stringify(aiResult, null, 2));

    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(
        JSON.stringify({ 
          error: "AI did not return structured response",
          recognized_text: recognizedText,
          items: [],
          summary: "Не удалось обработать запрос",
          totalPrice: 0,
          unavailableCount: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let aiItems: any[];
    let aiSummary: string;
    try {
      const args = JSON.parse(toolCall.function.arguments);
      aiItems = args.items || [];
      aiSummary = args.summary || "Товары найдены";
    } catch (e) {
      console.error("Failed to parse AI response:", e);
      return new Response(
        JSON.stringify({ 
          error: "Failed to parse AI response",
          recognized_text: recognizedText,
          items: [],
          summary: "Ошибка обработки",
          totalPrice: 0,
          unavailableCount: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build enriched response
    const productMap = new Map(catalogProducts.map(p => [p.id, p]));
    const variantLabels = ["Целый", "Половина", "Четверть", "Порция"];
    
    let totalPrice = 0;
    let unavailableCount = 0;
    
    const items: FoundItem[] = aiItems.map(item => {
      // Handle both snake_case (from AI) and camelCase field names
      const productId = item.product_id || item.productId;
      const variantIndex = item.variant_index ?? item.variantIndex ?? 0;
      const quantity = item.qty || item.quantity || 1;
      const matchReason = item.match_reason || item.matchReason || "";
      const altProductId = item.alt_product_id || item.suggestionProductId;
      const altReason = item.alt_reason || item.suggestionReason;
      
      const product = productMap.get(productId);
      if (!product) {
        unavailableCount++;
        return {
          productId: productId,
          productName: "Товар не найден",
          variantIndex: variantIndex,
          variantLabel: variantLabels[variantIndex],
          quantity: quantity,
          unitPrice: 0,
          pricePerUnit: 0,
          portionVolume: 0,
          totalPrice: 0,
          totalWeight: 0,
          unitLabel: "кг",
          imageUrl: undefined,
          available: false,
          matchReason: matchReason,
        };
      }

      // Use effective_price which already has markup applied
      const basePrice = product.effective_price || product.price;
      const unitWeight = product.unit_weight || 1;
      const catalogPrices = product.catalog_portion_prices;
      const markupType = product.catalog_markup_type;
      const markupValue = product.catalog_markup_value;
      
      // Helper to apply markup to portion prices
      const applyMarkup = (price: number | null | undefined): number | null => {
        if (price == null) return null;
        if (markupType === 'percent' && markupValue != null) {
          return price * (1 + markupValue / 100);
        } else if (markupType === 'fixed' && markupValue != null) {
          return price + markupValue;
        }
        return price;
      };
      
      const fullPricePerKg = applyMarkup(catalogPrices?.full) ?? applyMarkup(product.price_full) ?? basePrice;
      const halfPricePerKg = applyMarkup(catalogPrices?.half) ?? applyMarkup(product.price_half) ?? basePrice;
      const quarterPricePerKg = applyMarkup(catalogPrices?.quarter) ?? applyMarkup(product.price_quarter) ?? basePrice;
      const portionPrice = applyMarkup(catalogPrices?.portion) ?? applyMarkup(product.price_portion) ?? null;
      
      const unitLabel = product.unit || "кг";
      const imageUrl = product.images?.[0] || undefined;
      
      let pricePerUnit = 0;  // цена за кг/шт
      let unitPrice = 0;     // цена за порцию
      let portionVolume = 0; // объём порции
      
      switch (variantIndex) {
        case 0: // full
          pricePerUnit = fullPricePerKg;
          portionVolume = unitWeight;
          unitPrice = Math.round(pricePerUnit * portionVolume);
          break;
        case 1: // half
          pricePerUnit = halfPricePerKg;
          portionVolume = unitWeight / 2;
          unitPrice = Math.round(pricePerUnit * portionVolume);
          break;
        case 2: // quarter
          pricePerUnit = quarterPricePerKg;
          portionVolume = unitWeight / 4;
          unitPrice = Math.round(pricePerUnit * portionVolume);
          break;
        case 3: // portion
          pricePerUnit = basePrice;
          portionVolume = 1; // 1 порция
          unitPrice = Math.round(portionPrice || 0);
          break;
      }
      
      const itemTotal = unitPrice * quantity;
      const totalWeight = portionVolume * quantity;
      const available = product.catalog_status === "in_stock" || product.catalog_status === "pre_order";
      
      if (available) {
        totalPrice += itemTotal;
      } else {
        unavailableCount++;
      }

      // Build suggestion if provided
      let suggestion: FoundItem["suggestion"] | undefined;
      if (altProductId) {
        const suggestionProduct = productMap.get(altProductId);
        if (suggestionProduct) {
          suggestion = {
            productId: suggestionProduct.id,
            productName: suggestionProduct.name,
            reason: altReason || "Похожий товар в наличии",
          };
        }
      }

      return {
        productId: product.id,
        productName: product.name,
        variantIndex,
        variantLabel: variantLabels[variantIndex],
        quantity,
        unitPrice,
        pricePerUnit: Math.round(pricePerUnit),
        portionVolume,
        totalPrice: itemTotal,
        totalWeight,
        unitLabel,
        imageUrl,
        available,
        matchReason: item.matchReason || "",
        suggestion,
      };
    });

    const response: CustomerAIResponse = {
      items,
      summary: aiSummary,
      totalPrice,
      recognized_text: recognizedText || undefined,
      unavailableCount,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Customer AI Assistant error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
