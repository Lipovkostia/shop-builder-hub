// Avito stats AI analyst — analyzes per-item stats and spend, returns insights.
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
Твоя задача — на основе статистики (просмотры, контакты, добавления в избранное, расходы) дать практические рекомендации по каждому объявлению.

Для каждого объявления оцени эффективность по правилам:
- 🟢 ЭФФЕКТИВНО: CR (контакты/просмотры) ≥ 3% И стоимость контакта (расход/контакты) разумная (<300₽).
- 🟡 СРЕДНЕ: CR 1–3%, либо есть просмотры но мало контактов — оптимизировать фото/текст/цену.
- 🔴 НЕЭФФЕКТИВНО: 0 контактов при расходе >500₽, или CR <1% и расход >1000₽ — снять с продвижения / скорректировать.
- 📉 СНИЗИТЬ СТАВКУ: просмотров много, но контактов мало — переплата за охват.
- 📈 ПОВЫСИТЬ СТАВКУ: CR высокий, контактов мало → добиваем охватом.

Отвечай на русском, кратко и по делу, в формате Markdown. Сначала общий summary (3-5 строк), затем секции 🔴 Снять, 📉 Снизить ставку, 📈 Поднять ставку, 🟢 Топ-эффективные. В каждой секции — список объявлений с ID и одной фразой пояснения.`;

    const systemPrompt = (system_prompt && String(system_prompt).trim()) || defaultSystem;

    // Compress items: aggregate per item totals to keep prompt size reasonable.
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

    const userPrompt = `Период: ${date_from} — ${date_to}
Объявлений: ${compact.length}

Данные (JSON, по каждому объявлению агрегаты за период):
${JSON.stringify(compact, null, 1)}

Вопрос/инструкция пользователя:
${user_prompt || "Проанализируй эффективность и дай рекомендации, какие объявления снять, где поднять/снизить ставку, а какие самые удачные."}`;

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
    const content = data?.choices?.[0]?.message?.content || "Нет ответа от AI";
    return new Response(JSON.stringify({ success: true, analysis: content, model }), {
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
