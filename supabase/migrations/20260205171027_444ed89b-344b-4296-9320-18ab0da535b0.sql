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
    SELECT stores.id, retail_catalog_id
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
    COALESCE(p.compare_price, 0)::double precision AS compare_price,
    COALESCE(p.images, '{}'::text[]) AS images,
    COALESCE(p.unit, 'шт') AS unit,
    p.sku,
    COALESCE(p.quantity, 0)::double precision AS quantity,
    p.slug,
    COALESCE(p.packaging_type, 'piece') AS packaging_type,
    COALESCE(
      CASE
        WHEN st.categories IS NOT NULL AND array_length(st.categories, 1) > 0 THEN st.categories[1]
        ELSE p.category_id::text
      END,
      p.category_id::text
    ) AS category_id,
    COALESCE(
      st.categories,
      CASE WHEN p.category_id IS NOT NULL THEN ARRAY[p.category_id::text] ELSE '{}'::text[] END
    ) AS category_ids,
    c.name AS category_name,
    COALESCE(st.status, NULL) AS catalog_status
  FROM vis
  JOIN public.products p ON p.id = vis.product_id
  LEFT JOIN settings st ON st.product_id = p.id
  LEFT JOIN public.categories c ON c.id = p.category_id
  WHERE p.deleted_at IS NULL
    AND p.is_active = true
    AND (st.status IS NULL OR (st.status <> 'hidden' AND st.status <> 'out_of_stock'))
    AND (
      -- ensure price is valid
      (
        (p.is_fixed_price = true AND p.price IS NOT NULL AND p.price > 0)
        OR (p.price IS NOT NULL AND p.price > 0)
        OR (p.buy_price IS NOT NULL AND p.buy_price > 0)
      )
    );
$$;