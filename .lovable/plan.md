# План

## Часть 1. Починить «фото не прикрепляется к Авито»

**Причина.** В `PhotoGenerationSection.addSelectedToProducts` после генерации мы добавляем URL только в `products.images`. Но в Авито-фиде поле картинок берётся из `avito_params.avitoImages` (см. `AvitoSection.tsx` стр. 237–239 и `avito-feed/index.ts` стр. 189–190). Если у товара уже было сохранено `avitoImages` (через AvitoImageEditor) — новое фото туда не попадает, и в карточке Авито его не видно. Раньше у товаров не было `avitoImages` → срабатывал фолбэк на `products.images` и всё «работало».

**Что сделать.**
- В `addSelectedToProducts` после `update(products)` для каждого товара:
  - подтянуть `avito_feed_products` (по `store_id` + `product_id`); если строки нет — создать;
  - в `avito_params.avitoImages` дописать новые URL'ы (дедуп по строке);
  - сделать один батч-апдейт через хелпер `bulkUpdateProductParams` из `useAvitoFeedProducts`.
- Пробросить колбэк `onAttachToAvito(productId, urls[])` из `AdminPanel` (где живёт `useAvitoFeedProducts`) в `PhotoGenerationSection`, чтобы не дёргать supabase напрямую и оставить локальный state в синхроне.
- Тост: «Добавлено в N товаров (в т.ч. в объявления Авито)».

## Часть 2. Новая вкладка «Массовая AI-генерация»

Добавить пятую вкладку в `PhotoGenerationSection` (между «Рабочая область» и «История»). Назову `BulkAiTab` (новый файл `src/components/admin/photo-generation/BulkAiTab.tsx`). 4-колоночный лэйаут.

```text
┌─ Источник + товары ─┬─ Фото товара ──┬─ Выбрано для AI ─┬─ Промпт ──┬─ Результат ──┐
│ [Прайс-лист][Авито] │  миниатюры     │ выбранные фото   │ textarea  │ превью+✓Доб. │
│ поиск               │  с бейджем «#» │  (по строке на   │  +шаблон  │  по строке   │
│ чекбоксы товаров    │  клик = выбор  │   фото)          │           │              │
└─────────────────────┴────────────────┴──────────────────┴───────────┴──────────────┘
```

**Колонка 1 — источник товаров.**
- Tabs: «Из прайс-листа» (читает `useStoreProducts`) / «Из Авито» (читает `feedProducts` + `storeProducts` по `product_id`).
- Поиск + список с чекбоксами; счётчик «Выбрано: N».

**Колонка 2 — фото выбранных товаров.**
- Под каждым выбранным товаром — сетка миниатюр его фото. Источник: для «Авито» — `avito_params.avitoImages || products.images`; для «прайс-листа» — `products.images`.
- Каждая миниатюра кликабельна; при выборе уходит в колонку 3 как «задача» (`taskId = productId + imageIndex + url`).
- На миниатюре маленький бейдж: «всего фото N».

**Колонка 3 — список задач (выбранные фото).**
- По строке на фото: миниатюра + название товара + кнопка убрать.
- Сверху: «Применить промпт-шаблон ко всем», «Очистить», «Запустить генерацию (X ₽)».

**Колонка 4 — промпт.**
- На каждую строку: textarea + кнопка «Применить ко всем».
- Поле «AI-улучшение текущего фото» — то же, что в обычной вкладке (используем `generate-product-image` edge function с `image_urls=[selected]`).

**Колонка 5 — результат.**
- Превью сгенерированного фото + кнопки: «✓ Одобрить» (заменяет исходное фото в товаре), «↻ Перегенерить», «✕ Отклонить», «📥 В фото-студию» (необязательно).
- Замена: если фото пришло из Авито (`avitoImages`) — обновляется именно в `avito_params.avitoImages` (по индексу); если из прайс-листа — `products.images` (по индексу). Старый URL остаётся в Lovable storage / истории, в БД заменяется.

**Бэкенд.**
- Используем существующую edge-функцию `generate-product-image` (она уже делает AI-эдит по `image_urls`, выгружает результат в storage, возвращает публичный URL) — новых функций не нужно.
- Существующий хук `useImageGeneration` подходит для параллельного запуска (до 6 потоков).

**Стейт.**
- Локальное хранение задач в LocalStorage по ключу `bulk_ai_v1:{storeId}` (как уже сделано в основной вкладке).
- Результаты копим в `AiHistory` через `useAiHistory.add()` для общей истории генераций.

## Технические детали

- Файлы (новые):
  - `src/components/admin/photo-generation/BulkAiTab.tsx`
- Файлы (правки):
  - `src/components/admin/photo-generation/PhotoGenerationSection.tsx` — добавить `<TabsTrigger value="bulk-ai">` и `<TabsContent>` + проп `onAttachToAvito`, исправить `addSelectedToProducts`.
  - `src/pages/AdminPanel.tsx` — пробросить `onAttachToAvito` (используя `useAvitoFeedProducts.bulkUpdateProductParams`).
  - При необходимости — мелкая правка `useAvitoFeedProducts` для метода «получить/создать строку фида и дописать `avitoImages`».
- БД: миграции не нужны, схема уже подходит (`avito_feed_products.avito_params` jsonb, `products.images` text[]).
- Дизайн: следуем существующим Card/ScrollArea/Button-паттернам секции, без новых цветовых токенов.
