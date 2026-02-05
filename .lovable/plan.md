
# План: Исправление отображения фиксированной цены на витрине

## Проблема
При импорте цены через Excel/AI-ассистент:
1. В столбике "Цена" устанавливается новая цена ✓
2. Ставится флаг `is_fixed_price = true` (замок) ✓
3. **НО** на витрине всё равно показывается цена рассчитанная по себестоимости ✗

## Причина
Функция `get_retail_products_public`, которая возвращает товары для витрины, не учитывает флаг `is_fixed_price`. Сейчас она проверяет `price > 0`, но продолжает рассчитывать по наценке.

## Решение
Обновить SQL-функцию `get_retail_products_public` чтобы:
- Если `is_fixed_price = true` → всегда использовать `p.price` напрямую
- Иначе → рассчитывать цену по себестоимости и наценке

## Изменения

### Миграция БД — обновить функцию get_retail_products_public

```sql
CREATE OR REPLACE FUNCTION public.get_retail_products_public(_subdomain text)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  price double precision,
  compare_price double precision,
  images text[],
  unit text,
  sku text,
  quantity double precision,
  slug text,
  packaging_type text,
  category_id text,
  category_ids text[],
  category_name text,
  catalog_status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH s AS (
    SELECT id, retail_catalog_id
    FROM public.stores
    WHERE subdomain = _subdomain
      AND status = 'active'::public.store_status
      AND retail_enabled = true
    LIMIT 1
  ),
  settings AS (
    SELECT cps.product_id,
           cps.markup_type,
           cps.markup_value,
           cps.status,
           cps.categories
    FROM public.catalog_product_settings cps
    JOIN s ON cps.catalog_id = s.retail_catalog_id
  ),
  vis AS (
    SELECT pcv.product_id
    FROM public.product_catalog_visibility pcv
    JOIN s ON pcv.catalog_id = s.retail_catalog_id
  )
  SELECT
    p.id,
    p.name,
    p.description,
    (
      CASE
        -- Фиксированная цена: используем price напрямую
        WHEN p.is_fixed_price = true AND p.price IS NOT NULL THEN p.price::double precision
        -- Иначе: рассчитываем по наценке
        WHEN p.buy_price IS NOT NULL AND p.buy_price > 0 AND st.markup_type = 'percent' THEN (p.buy_price * (1 + COALESCE(st.markup_value, 0) / 100))::double precision
        WHEN p.buy_price IS NOT NULL AND p.buy_price > 0 AND (st.markup_type = 'fixed' OR st.markup_type = 'rubles') THEN (p.buy_price + COALESCE(st.markup_value, 0))::double precision
        -- Fallback: если ничего не подошло, используем price
        ELSE COALESCE(p.price, 0)::double precision
      END
    ) AS price,
    ...остальные поля без изменений...
  FROM vis
  JOIN public.products p ON p.id = vis.product_id
  ...остальная часть запроса без изменений...
$$;
```

## Ключевое изменение
Добавлен приоритет для `is_fixed_price`:
```sql
WHEN p.is_fixed_price = true AND p.price IS NOT NULL THEN p.price::double precision
```

Этот CASE идёт **первым**, поэтому когда замок включён — цена берётся напрямую из `price`, игнорируя себестоимость и наценку.

## Файлы для изменения
- Новая миграция БД с `CREATE OR REPLACE FUNCTION`
