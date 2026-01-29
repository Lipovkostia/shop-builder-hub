
# План: Оптовый магазин (B2B) с SEO-оптимизацией на основе ИИ

## Обзор

Создание публичного оптового магазина по аналогии с розничным (`/retail/:subdomain`), но адаптированного под B2B-продажи. Ключевая особенность — глубокая SEO-оптимизация каждого товара с автоматическим заполнением мета-данных искусственным интеллектом.

## Архитектура решения

```text
┌─────────────────────────────────────────────────────────────────┐
│                     Панель администратора                        │
├─────────────────────────────────────────────────────────────────┤
│  Товары          Оптовый магазин (новое)       Розница          │
│  ┌─────┐        ┌──────────────────────┐     ┌─────────┐        │
│  │     │        │ • Общее              │     │         │        │
│  │     │        │ • Дизайн             │     │         │        │
│  │     │        │ • SEO                │     │         │        │
│  │     │        │ • Домен              │     │         │        │
│  └─────┘        └──────────────────────┘     └─────────┘        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    Карточка товара (расширенная)                 │
├─────────────────────────────────────────────────────────────────┤
│  Основные поля        │  SEO-настройки (новый блок)             │
│  ┌─────────────────┐  │  ┌────────────────────────────────────┐ │
│  │ Название        │  │  │ SEO-заголовок (seo_title)          │ │
│  │ Описание        │  │  │ Meta Description (seo_description) │ │
│  │ Цена            │  │  │ SEO URL (slug)                     │ │
│  │ ...             │  │  │ Ключевые слова (seo_keywords)      │ │
│  └─────────────────┘  │  │ Open Graph Image                   │ │
│                       │  │ Schema.org (JSON-LD)               │ │
│                       │  │ [ 🤖 Заполнить с ИИ ]              │ │
│                       │  └────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Часть 1: Оптовый магазин (B2B Storefront)

### Новые маршруты

| Путь | Описание |
|------|----------|
| `/wholesale/:subdomain` | Главная страница оптового магазина |
| `/wholesale/:subdomain/product/:slug` | Страница отдельного товара (для SEO) |
| `/wholesale/:subdomain/category/:slug` | Страница категории |
| `/wholesale/:subdomain/checkout` | Оформление заказа |

### Отличия от розницы

| Элемент | Розница | Опт (B2B) |
|---------|---------|-----------|
| Минимальный заказ | Нет | Настраиваемый порог |
| Цены | Розничные с наценкой | Оптовые/закупочные |
| Регистрация | Гостевые заказы | Требуется аккаунт покупателя |
| Каталог | Публичный | Опционально по прайс-листу |
| SEO | Базовое (магазин) | Глубокое (каждый товар) |
| Варианты порций | Да (1/2, 1/4) | Только целые единицы/коробки |
| Карточки товаров | Сетка с фото | Компактный список (высокая плотность) |

### Новые поля в таблице `stores`

```sql
-- Настройки оптового магазина
wholesale_enabled BOOLEAN DEFAULT FALSE,
wholesale_name TEXT,
wholesale_catalog_id UUID REFERENCES catalogs(id),
wholesale_theme JSONB DEFAULT '{}',
wholesale_min_order_amount NUMERIC DEFAULT 0,
wholesale_logo_url TEXT,
wholesale_seo_title TEXT,
wholesale_seo_description TEXT
```

---

## Часть 2: SEO-поля для товаров

### Новые поля в таблице `products`

```sql
-- SEO-метаданные товара
seo_title TEXT,              -- <title> для страницы товара
seo_description TEXT,        -- <meta name="description">
seo_keywords TEXT[],         -- ключевые слова
seo_og_image TEXT,           -- Open Graph изображение
seo_schema JSONB,            -- JSON-LD разметка (Product schema)
seo_canonical_url TEXT,      -- канонический URL
seo_noindex BOOLEAN DEFAULT FALSE,  -- исключить из индексации
seo_generated_at TIMESTAMPTZ -- когда ИИ заполнил SEO
```

### Как это будет выглядеть на странице товара

```html
<!-- Генерируется автоматически -->
<head>
  <title>Сыр Пармезан 24 месяца выдержки | Оптом от Cheese Factory</title>
  <meta name="description" content="Купите итальянский сыр Пармезан оптом. Выдержка 24 месяца. Минимальный заказ от 10 кг. Доставка по России." />
  <meta name="keywords" content="пармезан оптом, сыр пармезан, итальянский сыр, оптовые поставки сыра" />
  
  <!-- Open Graph -->
  <meta property="og:title" content="Сыр Пармезан 24 месяца выдержки" />
  <meta property="og:description" content="Итальянский сыр Пармезан оптом..." />
  <meta property="og:image" content="https://..." />
  <meta property="og:type" content="product" />
  
  <!-- JSON-LD Schema -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "Сыр Пармезан 24 месяца выдержки",
    "description": "...",
    "sku": "PARM-24",
    "offers": {
      "@type": "Offer",
      "price": "2500",
      "priceCurrency": "RUB",
      "availability": "https://schema.org/InStock"
    }
  }
  </script>
</head>
```

---

## Часть 3: ИИ-генерация SEO

### Алгоритм работы

```text
┌─────────────────────────────────────────────────────────────────┐
│                    Генерация SEO с ИИ                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Продавец нажимает "Заполнить с ИИ"                          │
│     │                                                           │
│  2. Отправляем в Edge Function:                                 │
│     • Название товара                                           │
│     • Описание (если есть)                                      │
│     • Категория                                                 │
│     • Цена и единица измерения                                  │
│     • Название магазина                                         │
│     │                                                           │
│  3. ИИ (Gemini Flash) генерирует:                               │
│     • seo_title (60-70 символов)                                │
│     • seo_description (150-160 символов)                        │
│     • seo_keywords (5-10 ключевых слов)                         │
│     • seo_schema (JSON-LD Product)                              │
│     │                                                           │
│  4. Результат сохраняется в products                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Массовая генерация SEO

Продавец сможет:
1. Выбрать несколько товаров (чекбоксы)
2. Нажать "Заполнить SEO для выбранных"
3. ИИ обработает товары последовательно (во избежание rate limits)
4. Прогресс показывается в интерфейсе

### Edge Function: `ai-seo-generator`

```text
Входные данные:
{
  "productIds": ["uuid1", "uuid2", ...],
  "storeId": "uuid",
  "mode": "single" | "bulk"
}

Выходные данные:
{
  "results": [
    {
      "productId": "uuid1",
      "seo_title": "...",
      "seo_description": "...",
      "seo_keywords": [...],
      "seo_schema": {...}
    }
  ]
}
```

---

## Часть 4: Интерфейс управления

### Панель редактирования товара (расширенная)

Добавляем новую вкладку "SEO" в `ProductEditPanel`:

```text
┌─────────────────────────────────────────────────────────────────┐
│  [ Основное ]  [ Цены ]  [ SEO ]  [ Дополнительно ]             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SEO-заголовок                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Сыр Пармезан 24 месяца оптом | Cheese Factory        58/70 ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  Meta Description                                               │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Купите итальянский сыр Пармезан оптом. Выдержка      140/160││
│  │ 24 месяца. Минимальный заказ от 10 кг.                      ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  Ключевые слова                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ [пармезан оптом] [сыр пармезан] [итальянский сыр] [+]       ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  URL-адрес (slug)                                               │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ /wholesale/cheesefactory/product/syr-parmezan-24-mes        ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  [ 🤖 Заполнить с ИИ ]    [ Сбросить ]    [ Предпросмотр ]      │
│                                                                 │
│  ┌─ Предпросмотр в Google ──────────────────────────────────┐  │
│  │ 🔗 cheesefactory.com › product › syr-parmezan-24-mes     │  │
│  │ Сыр Пармезан 24 месяца оптом | Cheese Factory            │  │
│  │ Купите итальянский сыр Пармезан оптом. Выдержка...       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Раздел "Оптовый магазин" в админке

Создаём новый раздел `WholesaleSettingsSection` аналогично `RetailSettingsSection`:

```text
Вкладки:
├── Общее
│   ├── Включить/выключить оптовый магазин
│   ├── Ссылка на магазин
│   ├── Выбор прайс-листа (источник товаров)
│   ├── Минимальная сумма заказа
│   └── Контакты для шапки
├── Дизайн
│   ├── Логотип оптового магазина
│   ├── Название магазина
│   └── Цветовая схема
├── SEO
│   ├── Заголовок сайта
│   ├── Meta Description сайта
│   ├── Favicon
│   └── [ Сгенерировать SEO для всех товаров ]
└── Домен
    └── Привязка кастомного домена
```

---

## Технические детали

### Новые файлы

| Файл | Описание |
|------|----------|
| `src/pages/WholesaleStore.tsx` | Главная страница оптового магазина |
| `src/pages/WholesaleProduct.tsx` | Страница отдельного товара (SEO) |
| `src/pages/WholesaleCheckout.tsx` | Оформление оптового заказа |
| `src/hooks/useWholesaleStore.ts` | Хук для данных оптового магазина |
| `src/hooks/useProductSeo.ts` | Хук для управления SEO товара |
| `src/components/wholesale/` | Компоненты оптового магазина |
| `src/components/admin/WholesaleSettingsSection.tsx` | Настройки оптового магазина |
| `src/components/admin/ProductSeoPanel.tsx` | Панель SEO в редакторе товара |
| `supabase/functions/ai-seo-generator/index.ts` | Edge Function для генерации SEO |

### Миграции БД

```sql
-- 1. Добавляем SEO-поля в products
ALTER TABLE products ADD COLUMN seo_title TEXT;
ALTER TABLE products ADD COLUMN seo_description TEXT;
ALTER TABLE products ADD COLUMN seo_keywords TEXT[];
ALTER TABLE products ADD COLUMN seo_og_image TEXT;
ALTER TABLE products ADD COLUMN seo_schema JSONB;
ALTER TABLE products ADD COLUMN seo_canonical_url TEXT;
ALTER TABLE products ADD COLUMN seo_noindex BOOLEAN DEFAULT FALSE;
ALTER TABLE products ADD COLUMN seo_generated_at TIMESTAMPTZ;

-- 2. Добавляем настройки оптового магазина в stores
ALTER TABLE stores ADD COLUMN wholesale_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE stores ADD COLUMN wholesale_name TEXT;
ALTER TABLE stores ADD COLUMN wholesale_catalog_id UUID REFERENCES catalogs(id);
ALTER TABLE stores ADD COLUMN wholesale_theme JSONB DEFAULT '{}';
ALTER TABLE stores ADD COLUMN wholesale_min_order_amount NUMERIC DEFAULT 0;
ALTER TABLE stores ADD COLUMN wholesale_logo_url TEXT;
ALTER TABLE stores ADD COLUMN wholesale_seo_title TEXT;
ALTER TABLE stores ADD COLUMN wholesale_seo_description TEXT;

-- 3. Функция для публичного доступа к оптовым товарам
CREATE OR REPLACE FUNCTION public.get_wholesale_products_public(_subdomain text)
RETURNS TABLE(...) AS $$
...
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Этапы реализации

### Этап 1: База данных (1 день)
- Миграция: добавление SEO-полей в `products`
- Миграция: добавление wholesale-полей в `stores`
- RPC-функция для публичных товаров

### Этап 2: SEO-генератор (1 день)
- Edge Function `ai-seo-generator`
- Хук `useProductSeo`
- Компонент `ProductSeoPanel`

### Этап 3: Интерфейс администратора (2 дня)
- `WholesaleSettingsSection` (по аналогии с розницей)
- Интеграция SEO-панели в редактор товара
- Массовая генерация SEO

### Этап 4: Публичный магазин (2-3 дня)
- `WholesaleStore.tsx` — главная страница
- `WholesaleProduct.tsx` — страница товара с SEO
- Компоненты: header, sidebar, product list, cart
- Checkout flow

### Этап 5: Тестирование и оптимизация (1 день)
- Проверка SSR/hydration для SEO
- Валидация structured data (Google Rich Results Test)
- Мобильная адаптация

---

## Результат

После реализации:
- Продавцы смогут запустить публичный B2B-магазин одной кнопкой
- Каждый товар будет иметь отдельную страницу, оптимизированную для поисковиков
- ИИ автоматически заполнит SEO-метаданные для всех товаров
- Магазин будет индексироваться Google/Яндекс с rich snippets
- Оптовые покупатели смогут находить товары через поиск
