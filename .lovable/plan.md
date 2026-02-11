

## План: Витрина товаров на главной + управление в SuperAdmin

### Что делаем

1. **Главная страница (Index.tsx)** — меняем layout с центрированной формы на двухколоночный:
   - **Левая колонка (1/3)**: компактная таблица товаров в стиле мастер-каталога (строки 28px, text-xs, без цен поставщиков). Показывает «избранные» товары платформы — название, фото-индикатор, категорию, магазин. Данные загружаются публично (без авторизации) через новый Edge Function.
   - **Правая колонка (2/3)**: текущая форма регистрации/входа продавца и покупателя (без изменений логики).
   - На мобильных — таблица скрывается, остаётся только форма авторизации.

2. **Новая таблица `featured_products`** в базе данных:
   - `id` (uuid, PK)
   - `product_id` (uuid, FK -> products.id)
   - `sort_order` (int, default 0)
   - `created_at` (timestamptz)
   - RLS: SELECT доступен всем (anon), INSERT/DELETE — только super_admin.

3. **Новый публичный Edge Function `landing-products`**:
   - Читает `featured_products` JOIN `products` JOIN `stores`, возвращает публичные данные (название, SKU, категория, магазин, наличие фото).
   - Без цен поставщиков — только розничная цена (price).
   - Без авторизации (публичный доступ).

4. **SuperAdmin: новая вкладка «Витрина»** (или раздел внутри «Дашборда»):
   - Таблица текущих featured-товаров с возможностью удаления.
   - Поиск по всем товарам платформы + кнопка «Добавить на витрину».
   - Drag-and-drop сортировка (опционально, можно стрелками вверх/вниз).

---

### Технические детали

#### 1. Миграция БД

```sql
CREATE TABLE public.featured_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id)
);

ALTER TABLE public.featured_products ENABLE ROW LEVEL SECURITY;

-- Публичный доступ на чтение
CREATE POLICY "Anyone can view featured products"
  ON public.featured_products FOR SELECT
  USING (true);

-- Запись только для super_admin (через edge function с service role)
```

#### 2. Edge Function `landing-products`

- GET-запрос без авторизации
- Запрос: `featured_products` JOIN `products` JOIN `stores` (name, subdomain)
- Возвращает: name, sku, price, unit, images count, store_name, category
- Сортировка по `sort_order`

#### 3. Компонент `LandingProductTable`

- Компактная таблица (28px строки, text-xs) — стиль мастер-каталога
- Колонки: Название, Артикул, Цена, Ед., Фото, Магазин
- Загружается при маунте страницы Index
- Sticky-заголовок, скролл по вертикали

#### 4. Layout главной страницы

```text
┌──────────────────────┬────────────────────────────────┐
│                      │                                │
│  Компактная таблица  │    Tabs: Продавец / Покупатель │
│  товаров платформы   │                                │
│  (featured)          │    [Форма входа/регистрации]   │
│                      │                                │
│  28px строки         │                                │
│  text-xs             │                                │
│  без buy_price       │                                │
│                      │                                │
└──────────────────────┴────────────────────────────────┘
```

- Desktop: `grid grid-cols-3` — таблица занимает `col-span-1`, форма `col-span-2`
- Mobile: таблица `hidden lg:block`

#### 5. SuperAdmin — управление витриной

- Новая вкладка «Витрина» в TabsList SuperAdmin
- Поиск товаров по всей платформе (через существующий `super-admin-stats?action=products`)
- Кнопка «+» для добавления в featured
- Список текущих featured с кнопкой удаления
- Вставка/удаление через прямые запросы к `featured_products` (service role в edge function или RLS с проверкой super_admin)

#### Файлы для создания/изменения

| Файл | Действие |
|------|----------|
| `migration` (featured_products) | Создать |
| `supabase/functions/landing-products/index.ts` | Создать |
| `src/components/landing/LandingProductTable.tsx` | Создать |
| `src/pages/Index.tsx` | Изменить layout |
| `src/components/admin/FeaturedProductsManager.tsx` | Создать |
| `src/pages/SuperAdmin.tsx` | Добавить вкладку |

