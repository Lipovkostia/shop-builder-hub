

# Plan: AI Settings Adjustment Tab for Bot

## Overview
Add a new sidebar section "AI корректировка" to the bot editor that opens a chat-based dialog where the user talks to an AI assistant. The AI sees all current bot settings, understands what needs to change, proposes specific modifications, and upon user confirmation, applies them automatically.

## Architecture

```text
┌──────────────────────────────────────────────────────────┐
│  Bot Editor Sidebar                                       │
│  ...existing sections...                                  │
│  + 🤖 AI корректировка  (new item in "Продвинутое" group)│
└──────────────────────────────────────────────────────────┘

┌────────────────────────────────┬─────────────────────────┐
│  Chat Dialog (left ~60%)       │  Settings Panel (right)  │
│  ┌──────────────────────────┐  │  📋 Current bot config   │
│  │ User: "Отвечай кратко"   │  │  - Имя: Вероника         │
│  │ AI: "Нашла настройку...  │  │  - Промпт: ...           │
│  │      Заменить X на Y?"   │  │  - Модель: gemini-3...   │
│  │ [Подтвердить] [Отмена]   │  │  - Задержка: 60с         │
│  └──────────────────────────┘  │  - Лимит символов: нет    │
│  ┌──────────────────────────┐  │  ... all fields ...       │
│  │ Input: _________________ │  │                           │
│  └──────────────────────────┘  │  ✅ highlight changed     │
└────────────────────────────────┴─────────────────────────┘
```

## Changes

### 1. New Edge Function: `supabase/functions/ai-bot-settings/index.ts`
- Receives: bot settings snapshot (all fields from `botForm`), conversation history, user message
- System prompt instructs AI to analyze current settings, understand user request, and respond with a proposed change using a structured tool call
- Uses Lovable AI gateway with `google/gemini-3-flash-preview`
- Tool calling schema: `propose_settings_change` with fields `explanation` (what and why), `changes` (array of `{field, old_value, new_value}`)
- On confirmation request: returns the changes as JSON so frontend can apply them

### 2. Update `AvitoBotSection.tsx`
- Add `"ai_settings"` to `BotSection` type
- Add sidebar item in "Продвинутое" group: `{ id: "ai_settings", label: "AI корректировка", icon: Sparkles }`
- New `renderSection` case `"ai_settings"` renders a split layout:
  - **Left**: Chat interface (messages list + input) similar to existing debug chat
  - **Right**: Scrollable panel listing all current bot settings as read-only key-value pairs, with changed fields highlighted in green after confirmation
- Chat flow:
  1. User types a request
  2. Frontend sends message + full `botForm` snapshot to edge function
  3. AI responds with explanation + proposed changes (parsed from tool call)
  4. Frontend renders proposal with "Подтвердить" / "Отмена" buttons
  5. On confirm: `setBotForm` updated with new values, then `onSave()` called automatically
  6. Changed fields highlighted in the right panel

### 3. Config update
- Add `[functions.ai-bot-settings]` with `verify_jwt = false` to `supabase/config.toml` (auto-managed, just deploy)

## Settings exposed to AI
All fields from `botForm`: name, mode, system_prompt, ai_model, response_delay_seconds, max_responses, max_response_chars, lead_conditions, escalation_rules, completion_rules, schedule_mode, reactivation_messages, personality_config (all sub-fields), instructions_config (all sub-fields), rules_list, pro_seller_mode, upgrade_after_messages, upgrade_model, telegram_notification_format, seller_stop_command, handoff_rules.

## User Experience
- User opens "AI корректировка" tab
- Sees chat on left, all settings on right
- Types natural language instruction
- AI proposes concrete changes with before/after values
- User confirms → settings saved automatically
- Changed fields flash green in the right panel

