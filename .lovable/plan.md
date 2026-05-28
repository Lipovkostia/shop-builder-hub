
## Раздел «Генерация фотографий»

Новый AI-инструмент для пакетной генерации товарных фотографий по промптам/шаблонам с массовым редактированием и встраиванием результатов в карточку товара и Avito-фид.

## Размещение в UI

1. **Отдельный пункт в админ-сайдбаре** — `AdminPanel`, section `photo-generation` (иконка `Sparkles` / `ImagePlus`). Полноценный workflow: выбор товаров → настройка промптов → генерация → сохранение.
2. **Кнопка «AI-фото» в карточке товара** (в существующем редакторе товара рядом с галереей) — открывает тот же интерфейс, но с предвыбранным одним товаром.

## Структура страницы (3 колонки)

```text
┌───────────────────┬─────────────────────────────┬──────────────────────┐
│ Список товаров    │ Исходные фото + настройки   │ Сгенерированные      │
│ (поиск, чекбоксы) │ (по одному ряду на фото)    │ превью + действия    │
└───────────────────┴─────────────────────────────┴──────────────────────┘
```

**Левая колонка** — выбор товаров (виртуализированный список с поиском, чекбоксами, фильтром по категории/каталогу). Поддержка multi-select для массовой работы.

**Центральная колонка** — для каждого выбранного товара ряд на каждое исходное фото:
- миниатюра исходного фото
- селект «Шаблон» (из набора + пользовательские) — подставляет промпт в textarea
- textarea «Промпт» (редактируемый)
- кнопка «Применить ко всем» (массово копирует шаблон/промпт в остальные ряды)
- кнопка «Генерировать» на ряд + общая «Сгенерировать всё»

**Панель глобальных параметров** (sticky сверху центральной/правой колонок):
- Соотношение сторон: пресеты `1:1, 16:9, 9:16, 4:3, 3:4, 2:3, 3:2, 21:9` + «Своё» (поля ширина/высота, 512–1920, кратно 32)
- Количество вариантов на фото (1–4)
- Качество (low/medium/high)
- Модель (выбор провайдера — из подключённого API)

**Правая колонка** — для каждой генерации:
- сгенерированное изображение (большое превью, клик — fullscreen)
- кнопки «Перегенерировать», «Удалить»
- чекбокс «Выбрать»
- внизу: **«Добавить выбранные в карточку товара»** (массово добавляет в `products.images` ниже существующих)

## Шаблоны промптов

CRUD-интерфейс (вкладка «Шаблоны» в разделе) + предзагруженный набор:
- Белый студийный фон
- Лайфстайл / в интерьере
- На деревянной поверхности
- Инфографика с характеристиками
- Avito-оптимизированное (4:3, контраст)
- Сезонная подача (зима/лето)
- Макро / детали

Шаблоны: `{ name, prompt_template, category, default_aspect_ratio }`. Пользователь может создавать/редактировать/удалять свои.

## Интеграция с Avito

В существующем разделе Avito (`avito-feed`) при выборе фотографий для выгрузки:
- Все фото товара (оригиналы + AI) показываются в едином гриде с бейджем источника (`оригинал` / `AI`)
- Чекбоксы для выбора, какие фото уходят в Avito-фид (с сохранением порядка)
- Кнопка «Использовать только AI-фото» / «Использовать только оригиналы» — массово на странице
- Сохранение выбора в `avito_feed_products.avito_params.selected_images[]` (массив URL)
- `avito-feed/index.ts` при генерации XML использует `selected_images` если задан, иначе все `images`

## API провайдера генерации

Пользователь укажет API позже. Архитектура:
- Edge-функция `generate-product-image` принимает `{ product_id, source_image_url, prompt, aspect_ratio, size, n, quality }`, вызывает внешний API, возвращает base64 или URL
- Секрет: добавим через `add_secret` (имя зависит от выбранного провайдера, например `IMAGE_GEN_API_KEY`)
- Заглушка с понятной ошибкой «Укажите API ключ» пока секрет не добавлен
- Сохранение результата: загрузка в bucket `product-images` под путём `{product_id}/ai/{timestamp}_{idx}.png`, публичный URL добавляется в `products.images`

Параллельные генерации — пул на 3 одновременных запроса с прогресс-индикатором (как описано в `mem://design/ai-operation-progress-feedback`).

## База данных (миграции)

```sql
-- Шаблоны промптов (на магазин)
CREATE TABLE public.image_generation_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  name text NOT NULL,
  prompt_template text NOT NULL,
  default_aspect_ratio text DEFAULT '1:1',
  is_system boolean DEFAULT false, -- предзагруженные
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.image_generation_templates TO authenticated;
GRANT ALL ON public.image_generation_templates TO service_role;
ALTER TABLE public.image_generation_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners manage templates" ON public.image_generation_templates
  FOR ALL TO authenticated USING (is_store_owner(store_id, auth.uid()))
  WITH CHECK (is_store_owner(store_id, auth.uid()));
CREATE POLICY "Anyone reads system templates" ON public.image_generation_templates
  FOR SELECT TO authenticated USING (is_system = true);

-- Лог генераций (для истории/повтора)
CREATE TABLE public.image_generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  product_id uuid NOT NULL,
  source_image_url text,
  prompt text NOT NULL,
  aspect_ratio text,
  result_image_url text,
  status text NOT NULL DEFAULT 'pending', -- pending|success|error
  error_message text,
  cost numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.image_generation_jobs TO authenticated;
GRANT ALL ON public.image_generation_jobs TO service_role;
ALTER TABLE public.image_generation_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners manage jobs" ON public.image_generation_jobs
  FOR ALL TO authenticated USING (is_store_owner(store_id, auth.uid()))
  WITH CHECK (is_store_owner(store_id, auth.uid()));

-- В avito_feed_products: selected_images уже умещается в avito_params (jsonb), миграция не нужна
```

Сидинг 7 системных шаблонов через `INSERT` (с `store_id = NULL` либо отдельный механизм — уточним: проще делать `is_system = true` без store_id, поэтому колонку `store_id` сделаем nullable).

## Файлы

**Создать:**
- `src/components/admin/photo-generation/PhotoGenerationSection.tsx` — корневой компонент раздела
- `src/components/admin/photo-generation/ProductSelector.tsx` — левая колонка
- `src/components/admin/photo-generation/PhotoPromptRow.tsx` — ряд с фото + промпт + шаблон
- `src/components/admin/photo-generation/GeneratedPreviewColumn.tsx` — правая колонка
- `src/components/admin/photo-generation/GenerationParamsBar.tsx` — глобальные параметры
- `src/components/admin/photo-generation/TemplatesManager.tsx` — CRUD шаблонов
- `src/hooks/useImageGeneration.ts` — пул генерации, прогресс, вызов edge function
- `src/hooks/useImageTemplates.ts` — загрузка/CRUD шаблонов
- `supabase/functions/generate-product-image/index.ts` — прокси к API провайдера
- `supabase/migrations/<ts>_image_generation.sql`

**Изменить:**
- `src/pages/AdminPanel.tsx` — новый section `photo-generation` + роутинг
- `src/components/admin/AdminSidebar.tsx` (или эквивалент) — пункт меню
- `src/components/admin/products/...` — кнопка «AI-фото» в редакторе товара
- `src/components/admin/avito/...` (компонент выбора фото для фида) — единый грид с бейджами и массовыми действиями
- `supabase/functions/avito-feed/index.ts` — учитывать `selected_images`

## Дальнейшие шаги после плана

1. Уточните провайдер API (Replicate / fal.ai / DALL·E / Midjourney-proxy / своё API) — это влияет на формат запроса в edge-функции. Можно реализовать «универсальный» с возможностью указать base URL.
2. После согласования — запрошу секрет с ключом через защищённую форму.
