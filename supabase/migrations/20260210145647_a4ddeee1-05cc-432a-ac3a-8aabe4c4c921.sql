
-- Drop existing functions to change return type
DROP FUNCTION IF EXISTS public.get_retail_products_public(text);
DROP FUNCTION IF EXISTS public.get_showcase_products_public(text);

-- Recreate get_retail_products_public with sort_order
CREATE OR REPLACE FUNCTION public.get_retail_products_public(_subdomain text)
RETURNS TABLE(
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
  catalog_status text,
  sort_order integer
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
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
           cps.categories,
           cps.fixed_price,
           cps.is_fixed_price,
           cps.sort_order
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
        WHEN st.is_fixed_price = true AND st.fixed_price IS NOT NULL 
          THEN st.fixed_price::double precision
        WHEN p.is_fixed_price = true AND p.price IS NOT NULL 
          THEN p.price::double precision
        WHEN p.buy_price IS NOT NULL AND p.buy_price > 0 AND st.markup_type = 'percent' 
          THEN (p.buy_price * (1 + COALESCE(st.markup_value, 0) / 100))::double precision
        WHEN p.buy_price IS NOT NULL AND p.buy_price > 0 AND (st.markup_type = 'fixed' OR st.markup_type = 'rubles') 
          THEN (p.buy_price + COALESCE(st.markup_value, 0))::double precision
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
    COALESCE(st.status, NULL) AS catalog_status,
    st.sort_order
  FROM vis
  JOIN public.products p ON p.id = vis.product_id
  LEFT JOIN settings st ON st.product_id = p.id
  LEFT JOIN public.categories c ON c.id = p.category_id
  WHERE p.deleted_at IS NULL
    AND p.is_active = true
    AND (st.status IS NULL OR (st.status <> 'hidden' AND st.status <> 'out_of_stock'))
    AND (
      (st.is_fixed_price = true AND st.fixed_price IS NOT NULL AND st.fixed_price > 0)
      OR (p.is_fixed_price = true AND p.price IS NOT NULL AND p.price > 0)
      OR (p.price IS NOT NULL AND p.price > 0)
      OR (p.buy_price IS NOT NULL AND p.buy_price > 0)
    )
  ORDER BY st.sort_order NULLS LAST, p.name;
$$;

-- Recreate get_showcase_products_public with sort_order
CREATE OR REPLACE FUNCTION public.get_showcase_products_public(_subdomain text)
RETURNS TABLE(
  id uuid,
  name text,
  description text,
  price numeric,
  compare_price numeric,
  images text[],
  unit text,
  sku text,
  quantity numeric,
  slug text,
  packaging_type text,
  category_id uuid,
  category_ids uuid[],
  category_name text,
  catalog_status text,
  sort_order integer
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _store_id uuid;
  _catalog_id uuid;
BEGIN
  SELECT s.id, s.showcase_catalog_id
  INTO _store_id, _catalog_id
  FROM stores s
  WHERE s.subdomain = _subdomain
    AND s.status = 'active'
    AND s.showcase_enabled = true;

  IF _store_id IS NULL THEN RETURN; END IF;
  IF _catalog_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.description,
    CASE
      WHEN cps.is_fixed_price = true AND cps.fixed_price IS NOT NULL THEN cps.fixed_price
      WHEN p.is_fixed_price = true THEN p.price
      WHEN cps.markup_type IS NOT NULL AND cps.markup_value IS NOT NULL THEN
        CASE cps.markup_type
          WHEN 'percent' THEN p.buy_price + (p.buy_price * cps.markup_value / 100)
          WHEN 'fixed' THEN p.buy_price + cps.markup_value
          ELSE p.price
        END
      WHEN p.markup_type IS NOT NULL AND p.markup_value IS NOT NULL AND p.buy_price IS NOT NULL THEN
        CASE p.markup_type
          WHEN 'percent' THEN p.buy_price + (p.buy_price * p.markup_value / 100)
          WHEN 'fixed' THEN p.buy_price + p.markup_value
          ELSE p.price
        END
      ELSE p.price
    END AS price,
    p.compare_price,
    p.images,
    p.unit,
    p.sku,
    p.quantity,
    p.slug,
    p.packaging_type,
    p.category_id,
    COALESCE(cps.categories::uuid[], ARRAY[]::uuid[]) AS category_ids,
    c.name AS category_name,
    cps.status AS catalog_status,
    cps.sort_order
  FROM products p
  INNER JOIN product_catalog_visibility pcv ON pcv.product_id = p.id AND pcv.catalog_id = _catalog_id
  LEFT JOIN catalog_product_settings cps ON cps.product_id = p.id AND cps.catalog_id = _catalog_id
  LEFT JOIN categories c ON c.id = p.category_id
  WHERE p.store_id = _store_id
    AND p.deleted_at IS NULL
    AND p.is_active = true
    AND (cps.status IS NULL OR cps.status != 'hidden')
  ORDER BY cps.sort_order NULLS LAST, p.name;
END;
$$;
