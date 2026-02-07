
# Новая вкладка "Витрина" — полноценный интернет-магазин

## Что будет сделано

Добавляется новая вкладка "Витрина" в админ-панели (между "Розница" и "Опт"). Это будет полноценный интернет-магазин с корзиной, оформлением заказа и доставкой — полностью идентичный по дизайну существующей розничной витрине, но подключённый к своему собственному прайс-листу.

## Объём работ

### 1. База данных — новые поля в таблице `stores`

Добавляются колонки для настроек витрины (аналогично retail):

| Колонка | Тип | Описание |
|---------|-----|----------|
| `showcase_enabled` | boolean | Включена ли витрина |
| `showcase_name` | text | Название витрины |
| `showcase_catalog_id` | uuid | Привязанный прайс-лист |
| `showcase_logo_url` | text | Логотип витрины |
| `showcase_theme` | jsonb | Тема оформления |
| `showcase_seo_title` | text | SEO заголовок |
| `showcase_seo_description` | text | SEO описание |
| `showcase_favicon_url` | text | Фавикон |
| `showcase_custom_domain` | text | Кастомный домен |
| `showcase_phone` | text | Телефон |
| `showcase_telegram_username` | text | Telegram |
| `showcase_whatsapp_phone` | text | WhatsApp |
| `showcase_delivery_time` | text | Время доставки |
| `showcase_delivery_info` | text | Информация о доставке |
| `showcase_delivery_free_from` | numeric | Бесплатная доставка от суммы |
| `showcase_delivery_region` | text | Регион доставки |
| `showcase_footer_delivery_payment` | text | Текст футера (доставка/оплата) |
| `showcase_footer_returns` | text | Текст футера (возвраты) |

### 2. Серверная функция — `get_showcase_products_public`

Создаётся RPC-функция аналогичная `get_retail_products_public`, но читающая `showcase_catalog_id` вместо `retail_catalog_id`.

### 3. Навигация админ-панели

| Файл | Изменение |
|------|-----------|
| `src/components/admin/MobileTabNav.tsx` | Добавить `"showcase"` в тип `ActiveSection`, новый элемент навигации с иконкой `Globe` и подписью "Витрина" между "Розница" и "Опт" |
| `src/pages/AdminPanel.tsx` | Добавить `"showcase"` в тип `ActiveSection`, отрисовать `ShowcaseSettingsSection` при `activeSection === "showcase"` |

### 4. Настройки витрины в админке

| Файл | Описание |
|------|----------|
| `src/hooks/useShowcaseSettings.ts` | Новый хук (копия `useRetailSettings.ts`), читающий/записывающий `showcase_*` поля |
| `src/components/admin/ShowcaseSettingsSection.tsx` | Новый компонент (копия `RetailSettingsSection.tsx`) с подтабами: Общее, Дизайн, SEO, Домен. Заголовок "Интернет-витрина" |

### 5. Публичная витрина (фронтенд)

| Файл | Описание |
|------|----------|
| `src/hooks/useShowcaseStore.ts` | Новый хук (копия `useRetailStore.ts`), вызывающий `get_showcase_products_public` и читающий `showcase_*` поля магазина |
| `src/hooks/useShowcaseCart.ts` | Новый хук (копия `useRetailCart.ts`) с ключом localStorage `showcase-cart-{subdomain}` |
| `src/pages/ShowcaseStore.tsx` | Новая страница (на базе `RetailStore.tsx`), использующая `useShowcaseStore` и `useShowcaseCart` |
| `src/pages/ShowcaseCheckout.tsx` | Новая страница оформления заказа (на базе `RetailCheckout.tsx`), заказы будут с `source: "showcase"` |

### 6. Маршрутизация

| Файл | Изменение |
|------|-----------|
| `src/App.tsx` | Добавить маршруты: `/showcase/:subdomain`, `/showcase/:subdomain/checkout` |

### 7. Обработка заказов

Заказы с витрины будут использовать существующий edge function `create-retail-order`, но с `source: "showcase"` для разделения в админке.

## Порядок реализации

1. Миграция БД (новые колонки + RPC функция)
2. Хуки настроек (`useShowcaseSettings`) и данных (`useShowcaseStore`, `useShowcaseCart`)
3. Компонент настроек (`ShowcaseSettingsSection`)
4. Навигация в админке (MobileTabNav + AdminPanel)
5. Страницы витрины и чекаута (ShowcaseStore, ShowcaseCheckout)
6. Маршруты в App.tsx
