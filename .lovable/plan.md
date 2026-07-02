## Что делаем

Заменяем единственную привязку одного прайс-листа (`landing_settings.catalog_access_code`) на полноценный менеджер: несколько прайсов, тумблеры активности, порядок, выбор категорий и точечное отключение товаров внутри каждого прайса.

## UI (раздел «Главная: товары» в супер-админке)

Новый блок вверху `FeaturedProductsManager.tsx` — список подключённых прайсов:

- Каждая строка: название прайса + магазин, код доступа, счётчик товаров, тумблер ВКЛ/ВЫКЛ, стрелки ↑/↓ порядка, кнопки «Настроить» и «Удалить».
- Кнопка «＋ Добавить прайс» — модалка со вставкой ссылки/кода доступа (та же логика `extractAccessCode`, что и сейчас).
- Клик «Настроить» открывает боковую панель (Sheet) с двумя вкладками:
  - **Категории** — дерево категорий прайса с чекбоксами (по умолчанию все включены).
  - **Товары** — таблица с поиском и чекбоксом-исключением по каждому товару.

Ниже — существующая таблица «Витрина» (объединённый результат со всех включённых прайсов) с колонкой «Из прайса» и возможностью убрать товар (создаёт исключение в соответствующем прайсе).

Ручной поиск/добавление одиночных товаров через `featured_products` остаётся как fallback, когда прайсы не подключены.

## Данные (миграция)

Новые таблицы:

```text
homepage_catalogs
  id uuid pk
  catalog_id uuid → catalogs.id
  access_code text        -- кэш для быстрой выдачи
  is_active boolean default true
  sort_order int default 0
  created_at, updated_at

homepage_catalog_category_excludes
  homepage_catalog_id uuid → homepage_catalogs.id  (on delete cascade)
  category_id uuid → categories.id
  pk (homepage_catalog_id, category_id)

homepage_catalog_product_excludes
  homepage_catalog_id uuid → homepage_catalogs.id  (on delete cascade)
  product_id uuid → products.id
  pk (homepage_catalog_id, product_id)
```

RLS: SELECT для `anon`+`authenticated` (публично на главной), INSERT/UPDATE/DELETE только для super_admin через `has_platform_role`. GRANT'ы прописываем сразу.

Одноразовая миграция данных: если `landing_settings.catalog_access_code` не пуст — создаём одну строку в `homepage_catalogs` с этим кодом, `is_active=true`. Затем поле `catalog_access_code` можно оставить, но UI больше его не читает.

## Edge functions

`supabase/functions/landing-products/index.ts`:
- Читаем все `homepage_catalogs where is_active=true order by sort_order`.
- Для каждого — вызываем `get_catalog_products_public(access_code)`, собираем список категорий из `catalog_category_settings`.
- Фильтруем товары по exclude-таблицам (категории и товары).
- Мержим товары со всех прайсов, дедуп по `product_id` (первый по порядку выигрывает), возвращаем + агрегированное дерево категорий (по прайсам, каждая категория помечена `catalog_id`).
- Фолбэк на `featured_products` только когда `homepage_catalogs` пуст.

`supabase/functions/homepage-catalog/index.ts`: аналогичная переделка для главной новой витрины.

## Компоненты фронта

- `src/components/admin/FeaturedProductsManager.tsx` — переписываем: список прайсов, тумблеры, порядок, добавление/удаление; блок «Привязка одного прайс-листа» удаляем.
- Новый `src/components/admin/HomepageCatalogSettingsSheet.tsx` — Sheet с вкладками «Категории» / «Товары» и exclude-логикой.
- `src/pages/IndexNew.tsx` и `src/components/landing/LandingProductTable.tsx` — работают как есть, т.к. формат ответа `landing-products` сохраняется (добавляется опциональное поле `catalog_id` у товара для группировки/фильтрации).

## Технические детали

- Все операции идут через существующий Supabase-клиент (значит, автоматически через прокси `lovable.proxy.atiks.org`).
- Порядок прайсов реализуем через `sort_order` + swap двух строк (как в `moveFeatured`).
- При удалении прайса — cascade убирает его exclude-строки; товары просто перестают отображаться.
- Дизайн: используем существующие shadcn `Table`, `Switch`, `Sheet`, `Tabs`, `Checkbox`, без хардкода цветов.

## Что НЕ меняем

- Таблицу `featured_products` и ручное добавление одиночных товаров.
- Схему `catalogs` / `catalog_product_settings` / `product_catalog_visibility`.
- Публичный контракт эндпоинта `landing-products` (только расширяем).
