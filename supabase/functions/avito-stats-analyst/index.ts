// Avito stats AI analyst — analyzes per-item stats and spend, returns insights + structured recommendations.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_MODEL = "openai/gpt-4o-mini";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const VSEGPT_API_KEY = Deno.env.get("VSEGPT_API_KEY");
    if (!VSEGPT_API_KEY) throw new Error("VSEGPT_API_KEY is not configured");

    const body = await req.json();
    const {
      system_prompt,
      user_prompt,
      items = [],
      date_from,
      date_to,
      model = DEFAULT_MODEL,
    } = body || {};

    const defaultSystem = `Ты — опытный маркетолог-аналитик объявлений на Авито.
Оценивай объявления по статистике (просмотры, контакты, избранное, расходы).
Правила:
- 🟢 keep (эффективно): CR ≥ 3% и CPA < 300₽.
- 🔴 remove (снять): 0 контактов при расходе > 500₽, либо CR < 1% при расходе > 1000₽.
- 📉 lower_bid (снизить ставку): много просмотров, мало контактов — переплата за охват.
- 📈 raise_bid (поднять ставку): высокий CR, но мало контактов — добиваем охватом.
- 🟡 optimize (оптимизировать): CR 1–3%, нужно править фото/текст/цену.`;

    const systemPrompt = (system_prompt && String(system_prompt).trim()) || defaultSystem;

    const compact = (items as any[]).slice(0, 300).map((it) => ({
      id: it.id,
      title: it.title?.slice(0, 80) || "",
      price: it.price,
      views: it.views || 0,
      contacts: it.contacts || 0,
      favorites: it.favorites || 0,
      spend: Math.round((it.spend || 0) * 100) / 100,
      cr: it.views > 0 ? Math.round((it.contacts / it.views) * 1000) / 10 : 0,
      cpa: it.contacts > 0 ? Math.round(((it.spend || 0) / it.contacts) * 100) / 100 : null,
    }));

    const formatInstruction = `

ОТВЕТЬ СТРОГО В ДВУХ БЛОКАХ (без других текстов между ними):

<RECOMMENDATIONS>
[
  {"itemId": <number>, "action": "remove"|"lower_bid"|"raise_bid"|"optimize"|"keep", "reason": "<краткая причина>"}
]
</RECOMMENDATIONS>

<ANALYSIS>
(здесь Markdown: краткое summary 3-5 строк, затем секции 🔴 Снять, 📉 Снизить ставку, 📈 Поднять ставку, 🟡 Оптимизировать, 🟢 Топ-эффективные, с ID и пояснениями)
</ANALYSIS>

В RECOMMENDATIONS должна быть валидная JSON-строка для каждого объявления из входных данных, без комментариев.`;

    const userPrompt = `Период: ${date_from} — ${date_to}
Объявлений: ${compact.length}

Данные (агрегаты за период):
${JSON.stringify(compact, null, 1)}

Инструкция пользователя:
${user_prompt || "Проанализируй эффективность и дай рекомендации."}
${formatInstruction}`;

    const resp = await fetch("https://api.vsegpt.ru/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${VSEGPT_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("VSEGPT error:", resp.status, t);
      const code = resp.status === 429 ? 429 : resp.status === 402 ? 402 : 500;
      const msg = resp.status === 429
        ? "Превышен лимит запросов, попробуйте позже"
        : resp.status === 402
          ? "Недостаточно средств для AI-анализа"
          : "Ошибка AI";
      return new Response(JSON.stringify({ error: msg }), {
        status: code,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const content: string = data?.choices?.[0]?.message?.content || "";

    // Parse two blocks
    let recommendations: any[] = [];
    let analysis = content;
    try {
      const recMatch = content.match(/<RECOMMENDATIONS>([\s\S]*?)<\/RECOMMENDATIONS>/i);
      const anaMatch = content.match(/<ANALYSIS>([\s\S]*?)<\/ANALYSIS>/i);
      if (recMatch) {
        const raw = recMatch[1].trim().replace(/^```json\s*|\s*```$/g, "");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) recommendations = parsed;
      }
      if (anaMatch) analysis = anaMatch[1].trim();
    } catch (e) {
      console.error("Failed to parse AI structured output:", e);
    }

    return new Response(JSON.stringify({ success: true, analysis, recommendations, model, raw: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("avito-stats-analyst error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
