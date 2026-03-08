import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, bot_settings, agent_model } = await req.json();
    const VSEGPT_API_KEY = Deno.env.get("VSEGPT_API_KEY");
    if (!VSEGPT_API_KEY) throw new Error("VSEGPT_API_KEY не настроен. Добавьте ключ VseGPT.");

    const model = agent_model || "openai/gpt-4.1-mini";

    const settingsDescription = Object.entries(bot_settings || {}).map(([key, value]) => {
      let display = value;
      if (typeof value === "object" && value !== null) display = JSON.stringify(value, null, 2);
      if (value === null || value === undefined || value === "") display = "(пусто)";
      return `${key}: ${display}`;
    }).join("\n");

    const systemPrompt = `Ты — AI-агент, который управляет настройками бота на Авито. Ты видишь все текущие настройки бота и можешь их анализировать и менять по запросу пользователя.

ТЕКУЩИЕ НАСТРОЙКИ БОТА:
${settingsDescription}

ПРАВИЛА:
1. Когда пользователь просит что-то изменить, проанализируй текущие настройки и определи какие поля нужно изменить.
2. ВСЕГДА используй инструмент propose_settings_change для предложения изменений.
3. Объясни что именно изменишь и почему.
4. Если запрос неясен — уточни у пользователя.
5. Можно менять несколько полей одновременно.
6. Отвечай на русском языке, кратко и по делу.
7. Ты можешь анализировать текущие настройки и давать рекомендации по улучшению.
8. Если пользователь спрашивает о текущих настройках — расскажи что видишь.

ДОСТУПНЫЕ ПОЛЯ ДЛЯ ИЗМЕНЕНИЯ:
- name: имя бота
- system_prompt: системный промпт бота
- ai_model: модель ИИ для ответов клиентам
- response_delay_seconds: задержка ответа (секунды)
- max_responses: максимум ответов на чат (null = без лимита)
- max_response_chars: максимум символов в ответе (null = без лимита)
- schedule_mode: режим расписания (24/7, no_response, schedule)
- pro_seller_mode: режим pro-продавца (true/false)
- upgrade_after_messages: сообщений до смены модели (0 = выключено)
- upgrade_model: модель для апгрейда
- seller_stop_command: стоп-команда продавца
- personality_config: объект с полями bot_name, character_traits, communication_style, tone, emoji_usage, greeting_style
- instructions_config: объект с полями main_goal, responsibilities, forbidden_actions, response_format, knowledge_boundaries, clarifying_questions_enabled
- lead_conditions: массив условий лида
- escalation_rules: массив правил эскалации
- completion_rules: массив правил завершения
- reactivation_messages: массив сообщений реактивации
- rules_list: массив общих правил
- handoff_rules: массив правил переключения
- telegram_notification_format: формат уведомлений (summary/full)`;

    const response = await fetch("https://api.vsegpt.ru/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${VSEGPT_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "propose_settings_change",
              description: "Предложить изменения настроек бота. Вызывай этот инструмент когда пользователь просит что-то изменить.",
              parameters: {
                type: "object",
                properties: {
                  explanation: {
                    type: "string",
                    description: "Объяснение что и зачем меняется"
                  },
                  changes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        field: { type: "string", description: "Название поля (например system_prompt, max_response_chars)" },
                        old_value: { type: "string", description: "Текущее значение (строкой)" },
                        new_value: { type: "string", description: "Новое значение (строкой, для объектов/массивов — JSON)" },
                      },
                      required: ["field", "old_value", "new_value"],
                    },
                  },
                },
                required: ["explanation", "changes"],
              },
            },
          },
        ],
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const text = await response.text();
      console.error("VseGPT error:", status, text);
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Слишком много запросов к VseGPT, попробуйте позже" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402 || status === 401) {
        return new Response(JSON.stringify({ error: "Проблема с ключом VseGPT. Проверьте баланс или ключ." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`VseGPT error: ${status} — ${text.substring(0, 200)}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    
    if (choice?.message?.tool_calls?.length > 0) {
      const toolCall = choice.message.tool_calls[0];
      if (toolCall.function?.name === "propose_settings_change") {
        let args;
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch {
          args = { explanation: "Не удалось разобрать предложение", changes: [] };
        }
        return new Response(JSON.stringify({
          type: "proposal",
          explanation: args.explanation,
          changes: args.changes,
          raw_message: choice.message.content || args.explanation,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({
      type: "message",
      content: choice?.message?.content || "Не удалось получить ответ",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("ai-bot-settings error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
