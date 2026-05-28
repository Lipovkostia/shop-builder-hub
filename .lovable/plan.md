## Что не так сейчас

Миграции `image_generation_*` не применились — таблиц в БД нет, поэтому любое сохранение шаблона падает с ошибкой schema cache. Плюс структура «шаблон = промпт + картинка одним блоком» неудобна — нужно разделить.

## План

### 1. База данных (одна миграция)

Создать заново (idempotent, через `IF NOT EXISTS`):

- `image_generation_prompts` — только текстовые шаблоны
  - `id, store_id, name, prompt_template, default_aspect_ratio, is_system, sort_order, created_at`
- `image_generation_references` — только картинки-референсы
  - `id, store_id, name, image_url, is_system, sort_order, created_at`
- `image_generation_jobs` — без изменений (если уже есть — оставить); добавить колонку `mode` (`product` | `playground`), `approved`, `hidden`, `model`
- `image_playground_messages` — история чата ИИ-плейграунда
  - `id, store_id, user_id, role` (`user`/`assistant`), `content`, `image_urls jsonb`, `model`, `created_at`

Для каждой таблицы: GRANT'ы, RLS, политики по `store_id` владельца.

Старая таблица `image_generation_templates` (если существует в проде) — оставить нетронутой, новый код её не использует.

### 2. UI «Генерация фотографий» — три вкладки

```
[Рабочая область] [Шаблоны промптов] [Референсы] [AI-чат]
```

**Шаблоны промптов** — список + редактор только текста (название + промпт + соотношение). Без картинки.

**Референсы** — список + загрузчик: название + одно изображение. Без промпта.

**Рабочая область** — в строке товара и в глобальной панели добавить два независимых селектора:
- «Промпт-шаблон» (dropdown из `image_generation_prompts`)
- «Референс» (dropdown из `image_generation_references`, превью миниатюры)

При генерации в edge-function отправляем `prompt` из выбранного промпта + `reference_image_url` из выбранного референса (если есть — используется вместо фото товара для edit-моделей).

### 3. Новая вкладка «AI-чат»

Чат-интерфейс как у ChatGPT/Midjourney:

- Лента сообщений (user / assistant с превью картинок)
- Внизу: textarea + кнопка загрузки 1-N изображений (drag&drop) + селектор модели (тот же `KIE_MODELS`) + соотношение сторон + кнопка «Отправить»
- Поведение:
  - Нет картинок → text-to-image (`nano-banana`, `seedream-4`, `flux-*`)
  - 1+ картинка → image edit / композиция (`nano-banana-edit`, `seedream-4`, `flux-kontext-*` — все поддерживают `image_urls: [...]`)
- История сохраняется в `image_playground_messages` (по `store_id` + `user_id`), подгружается при открытии
- Кнопка «Скачать» и «Добавить к товару…» на каждой сгенерированной картинке (поиск товара по названию в простом селекторе)

### 4. Edge function

Текущая `generate-product-image` остаётся для рабочей области.

Новая `generate-playground-image`:
- Принимает: `prompt`, `model`, `aspect_ratio`, `image_urls: string[]` (уже загруженные в storage), `store_id`
- Загружает пользовательские картинки в bucket `product-images/playground/{store_id}/...` перед вызовом kie.ai (если приходит base64 — иначе использует переданные URL)
- Вызывает kie.ai (та же `kieCreateTask` + `kiePoll`)
- Сохраняет результат в storage и в `image_playground_messages` как assistant-сообщение
- Возвращает URL

### 5. Файлы

Новые:
- `supabase/migrations/20260528030000_image_generation_split.sql`
- `src/hooks/useImagePrompts.ts`
- `src/hooks/useImageReferences.ts`
- `src/hooks/useImagePlayground.ts`
- `src/components/admin/photo-generation/PromptsManager.tsx`
- `src/components/admin/photo-generation/ReferencesManager.tsx`
- `src/components/admin/photo-generation/PlaygroundChat.tsx`
- `supabase/functions/generate-playground-image/index.ts`

Изменить:
- `src/components/admin/photo-generation/PhotoGenerationSection.tsx` — 4 вкладки, два селектора в рабочей области
- `src/hooks/useImageGeneration.ts` — пробрасывать `reference_image_url` отдельно от `source_image_url`
- `supabase/functions/generate-product-image/index.ts` — принимать `reference_image_url`, при наличии использовать его как `image_urls[0]` вместо фото товара
- удалить старый `src/hooks/useImageTemplates.ts` после миграции UI

### Технические детали

- Сохранение шаблона валидируется только по `name` (для промптов — ещё `prompt_template`; для референсов — `image_url`).
- В чате модель по умолчанию — `google/nano-banana-edit` если есть вложения, иначе `google/nano-banana`. Стоимость показываем под полем ввода в ₽ по тому же `KIE_MODELS` + курс из localStorage.
- Realtime для чата не нужен — после ответа просто инвалидируем список.
