## Что делаем

Три связанные фичи в админке.

### 1. История AI-генераций

**База:**
- Новая таблица `ai_generated_images`: `id, store_id, user_id, url, prompt, model, source` (`photo_generation` / `avito_editor`), `product_id` (nullable, для контекста), `created_at`. RLS — только владелец магазина.
- Новый Storage bucket `ai-history` (public, для отображения миниатюр).

**Сохранение:**
- В `PhotoGenerationSection` и `AvitoImageEditor` после успешной генерации: скачиваем итоговое изображение, заливаем в bucket `ai-history/{store_id}/{uuid}.png`, вставляем строку в `ai_generated_images`.

**UI новой вкладки «История генераций» в AI Photo:**
- Сетка карточек (thumbnail, prompt, дата, модель, источник).
- Фильтры: по дате, по источнику, поиск по prompt.
- Действия на карточке: «В работу» (открыть в текущей вкладке генерации как референс/исходник), «Скачать», «Удалить».

### 2. «Взять из истории» в местах добавления фото

Новый переиспользуемый компонент `<HistoryImagePicker />` — модалка с сеткой истории, мультивыбор, кнопка «Добавить выбранные».

Подключаем в:
- `PhotoGenerationSection` — кнопка «Взять из истории» рядом с загрузкой исходного фото.
- `AvitoImageEditor` — кнопка в каждом блоке генерации (рядом с уже существующей загрузкой).
- Галерея товара в ассортименте (`MemoizedProductRow` expanded gallery) — рядом с «Загрузить фото».
- Галерея товара в прайс-листе (catalog expanded gallery в `AdminPanel.tsx`) — там же.

Выбранные из истории фото добавляются в `product.images` стандартным `onAddProductImages` (передаём URL вместо File — расширяем сигнатуру либо качаем blob клиентом и грузим в `product-images`).

### 3. Per-catalog настройка фото (главная + видимые)

**База — миграция:**
- В `catalog_product_settings` добавляем:
  - `visible_image_indexes int[]` (NULL = все видимы)
  - `main_image_index int` (NULL = индекс 0 / основная товара)
- В `avito_feed_products` добавляем те же два поля для Авито-фида.

**Где применяем:**
- `get_retail_products_public`, `get_wholesale_products_public`, `get_showcase_products_public`, `get_catalog_products_public` — переписать выдачу `images`: фильтруем массив по `visible_image_indexes`, ставим `main_image_index` первым элементом.
- Edge функции выдачи Авито-фида — то же на основе `avito_feed_products`.

**UI в раскрывающейся галерее прайс-листа:**
- Под каждым фото в expanded gallery каталога: чекбокс «Показывать в этом прайс-листе» + радио «Главная в этом прайс-листе».
- Отдельная секция «Авито» в той же галерее (если товар в Avito-фиде) с такими же переключателями.
- Сохранение — upsert в `catalog_product_settings` / `avito_feed_products`.
- В обычной галерее ассортимента ничего не меняем — там по-прежнему глобальная главная фото товара.

## Файлы

**Миграции:**
- `ai_generated_images` table + RLS + grants
- `catalog_product_settings`: + `visible_image_indexes`, `main_image_index`
- `avito_feed_products`: + `visible_image_indexes`, `main_image_index`
- Storage bucket `ai-history` (через tool)
- Обновить 4 RPC: `get_retail_products_public`, `get_wholesale_products_public`, `get_showcase_products_public`, `get_catalog_products_public`

**Frontend:**
- `src/hooks/useAiHistory.ts` (new) — list/insert/delete
- `src/components/admin/photo-generation/HistoryImagePicker.tsx` (new)
- `src/components/admin/photo-generation/HistoryTab.tsx` (new) — содержимое новой вкладки
- `src/components/admin/photo-generation/PhotoGenerationSection.tsx` — Tabs «Генерация» / «История»; кнопка «Из истории»; запись в историю после генерации
- `src/components/admin/AvitoImageEditor.tsx` — кнопка «Из истории» в каждом блоке; запись после генерации
- `src/pages/AdminPanel.tsx` — в раскрывающейся галерее каталога: чекбоксы видимости + радио главной (и блок «Авито»); кнопка «Из истории» в ассортименте и каталоге
- `src/components/admin/MemoizedProductRow.tsx` — кнопка «Из истории» в галерее ассортимента
- Avito feed edge function (`avito-feed`) — учитывать новые поля

## Технические детали

- Хранение URL: история ссылается на bucket `ai-history`. При «Добавить в товар» URL подмешивается в `product.images` как есть (или копируется в `product-images`, чтобы не зависеть от удаления истории — решим во время реализации, по умолчанию **копируем** для надёжности).
- Удаление из истории не трогает фото товара.
- `visible_image_indexes = NULL` означает «показывать все» (бэк-совместимость).
- `main_image_index` ссылается на индекс в исходном `product.images` (до фильтрации), при фильтрации он маппится в первый элемент выдачи.
