## Цель
Сделать отдельный пул товаров «для главной страницы», независимый от Ассортимента. Управление в админке такое же, как у Ассортимента (категории, CRUD, поиск, скрытие). Товары попадают туда напрямую — в том числе через парсинг внешних сайтов (первый — `streitsale.ru`). Главная страница (новая витрина) показывает именно эти товары.

## База данных
Две новые таблицы, полностью независимые от `products` / `categories`:

- `homepage_categories` — `id, name, slug, parent_id, sort_order, image_url, is_active, created_at`
- `homepage_products` — `id, name, description, image_url, images text[], category_id, source_url, source_site, sku, sort_order, is_active, created_at, updated_at`

Публичный доступ на чтение (anon `SELECT` для активных), запись — только `service_role` (используем edge-функции и админ-UI через service role). RLS + GRANT по правилам проекта.

## Edge-функции
1. `homepage-catalog` (public GET) — возвращает `{ categories, products, partners, homepage_version }`. Заменяет источник для `IndexNew`. Старая `landing-products` остаётся для совместимости.
2. `homepage-admin` (POST, требует SuperAdmin) — CRUD-операции над `homepage_products` и `homepage_categories` (create / update / delete / bulk-toggle / reorder).
3. `homepage-parse-site` (POST, SuperAdmin) — принимает `{ url }`, через Firecrawl (`map` + `scrape` со схемой JSON) вытаскивает товары: имя, картинка, категория, описание, ссылка. Создаёт недостающие категории (по названию из крошек/секции сайта), вставляет товары пачкой. Возвращает сводку: сколько добавлено, сколько пропущено как дубликаты (по `source_url`).

Firecrawl уже подключён (`FIRECRAWL_API_KEY` есть).

## Админка (SuperAdmin → новая вкладка «Главная страница»)
Текущая вкладка «Главная» становится подразделом «Настройки» (версия + партнёры). Новая вкладка `homepage-catalog` содержит:

- **Парсер сайта** — поле URL + кнопка «Спарсить», прогресс, лог результата. Первый запуск — `https://streitsale.ru/` (запустим сразу после деплоя).
- **Категории** — дерево с drag-sort, добавить / переименовать / удалить, скрыть.
- **Товары** — таблица как в Ассортименте: поиск, фильтр по категории, чек-боксы, массовые действия (скрыть / удалить / переместить в категорию). Карточка товара — редактирование имени, описания, картинки (загрузка в bucket `product-images` или внешняя ссылка), категории, статуса.
- Кнопка «Добавить товар вручную».

UI повторяет паттерны существующих компонентов (`ProductCard`, `WholesaleCategorySidebar`) для единообразия.

## Витрина (`IndexNew`)
Источник данных переключается с `landing-products` на `homepage-catalog`. Формат полей совпадает — изменений в рендере минимум. Кэш-ключ обновляется (`homepage_cache_v1`).

## Парсинг streitsale.ru
Сразу после применения миграции вызываем `homepage-parse-site` для `https://streitsale.ru/`. Firecrawl `map` собирает ссылки на товары, `scrape` с JSON-схемой `{ name, price?, image, category, description }` вынимает данные. Категории создаются автоматически из поля `category`. Цены не сохраняем (на главной без цен — как было решено). Картинки храним как внешние URL (не качаем в bucket, чтобы не плодить трафик; bucket — только для ручных загрузок).

## Что НЕ делаем
- Не трогаем таблицу `products`, `categories`, не ломаем Ассортимент.
- Не трогаем `/retail/*`, `/wholesale/*`.
- Не показываем цены на главной.
- Старый `IndexLegacy` остаётся доступным через переключатель версии.

## Технические детали
- Миграция: `supabase/migrations/20260606130000_homepage_catalog.sql`.
- Новые файлы:
  - `supabase/functions/homepage-catalog/index.ts`
  - `supabase/functions/homepage-admin/index.ts`
  - `supabase/functions/homepage-parse-site/index.ts`
  - `src/components/admin/HomepageCatalog/HomepageCatalogSection.tsx` (root)
  - `src/components/admin/HomepageCatalog/HomepageCategoriesPanel.tsx`
  - `src/components/admin/HomepageCatalog/HomepageProductsTable.tsx`
  - `src/components/admin/HomepageCatalog/HomepageProductEditDialog.tsx`
  - `src/components/admin/HomepageCatalog/HomepageSiteParserDialog.tsx`
  - `src/hooks/useHomepageCatalog.ts`
- Изменяем: `src/pages/SuperAdmin.tsx` (новая вкладка), `src/pages/IndexNew.tsx` (источник).
- TS-типы для новых таблиц — через `(supabase as any)` до автогенерации `types.ts`.
