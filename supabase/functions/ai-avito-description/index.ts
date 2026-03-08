import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { products, instruction, maxChars = 500, mode = "description" } = await req.json();

    if (!products || !Array.isArray(products) || products.length === 0) {
      return new Response(JSON.stringify({ error: "products array is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const VSEGPT_API_KEY = Deno.env.get("VSEGPT_API_KEY");
    if (!VSEGPT_API_KEY) throw new Error("VSEGPT_API_KEY is not configured");

    const results: Record<string, string> = {};
    const batchSize = 10;

    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);

      const productList = batch.map((item: { id: string; name: string; description?: string; price?: number }, idx: number) =>
        `${idx + 1}. ID: ${item.id} — "${item.name}"${item.description ? ` (описание: "${item.description}")` : ""}${item.price ? ` (цена: ${item.price} ₽)` : ""}`
      ).join("\n");

      const userInstruction = instruction
        ? `\n\nИнструкция от продавца: ${instruction}`
        : "";

      let systemPrompt: string;
      let userPrompt: string;

      if (mode === "title") {
        systemPrompt = `Ты — специалист по оптимизации названий товаров для Авито. Твоя задача — сократить длинные названия товаров до ${maxChars} символов или менее, сохранив ключевую информацию о товаре.

ПРАВИЛА:
- Название должно быть НЕ БОЛЕЕ ${maxChars} символов
- Сохрани самую важную информацию: тип товара, бренд, вес/объём
- Убери дублирование информации и лишние слова
- Не используй сокращения, которые могут быть непонятны покупателю
- Если название уже укладывается в лимит — верни его без изменений
- Пиши на русском языке
- Если в названии есть латиница (бренд) — оставь как есть
${userInstruction}

ВАЖНО: Ответь ТОЛЬКО валидным JSON объектом без markdown-форматирования, без тройных обратных кавычек. Формат: {"ID1": "название1", "ID2": "название2"}.`;
        userPrompt = `Сократи следующие названия товаров до ${maxChars} символов без потери смысла. Верни JSON объект, где ключ — ID товара, значение — сокращённое название.\n\n${productList}`;
      } else {
        systemPrompt = `Ты — копирайтер, который пишет описания товаров для размещения на Авито. Описания должны быть информативными, привлекательными и подходящими для площадки Авито. Каждое описание должно быть не более ${maxChars} символов. Пиши на русском языке. Не используй восклицательные знаки и маркетинговый спам. Пиши естественно, как реальный продавец.

ФОРМАТИРОВАНИЕ: Авито поддерживает простое текстовое форматирование. Используй:
- Переносы строк (\\n) для разделения абзацев и смысловых блоков
- Эмодзи для визуального выделения ключевых пунктов (📦, ✅, 🚚, 📞, 💰 и т.д.)
- Пустые строки (\\n\\n) между абзацами для читаемости
- Структурируй текст: сначала краткое описание товара, затем характеристики/преимущества списком, затем информация о доставке/контактах

Пример структуры:
Название товара — краткое описание.\\n\\n📦 Характеристики:\\n- пункт 1\\n- пункт 2\\n\\n✅ Преимущества:\\n- пункт 1\\n\\n🚚 Доставка и оплата:\\n- информация

${userInstruction}

ВАЖНО: Ответь ТОЛЬКО валидным JSON объектом без markdown-форматирования, без тройных обратных кавычек. Формат: {"ID1": "описание1", "ID2": "описание2"}. Используй \\n для переносов строк внутри JSON-строк.`;
        userPrompt = `Сгенерируй описания для следующих товаров для Авито. Верни JSON объект, где ключ — ID товара, значение — описание.\n\n${productList}`;
      }

      const response = await fetch("https://api.vsegpt.ru/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${VSEGPT_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-4.1-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Превышен лимит запросов, попробуйте позже" }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Недостаточно средств для AI-генерации" }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const t = await response.text();
        console.error("AI gateway error:", response.status, t);
        throw new Error("AI gateway error");
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (content) {
        try {
          const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
          const parsed = JSON.parse(cleaned);
          Object.assign(results, parsed);
        } catch (parseErr) {
          console.error("Failed to parse AI response:", content, parseErr);
        }
      }
    }

    return new Response(JSON.stringify({ descriptions: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-avito-description error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
