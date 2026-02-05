-- Add fixed_price and is_fixed_price columns to catalog_product_settings
ALTER TABLE catalog_product_settings 
ADD COLUMN IF NOT EXISTS fixed_price numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_fixed_price boolean DEFAULT false;

-- Update get_retail_products_public function to prioritize catalog-specific fixed prices
CREATE OR REPLACE FUNCTION public.get_retail_products_public(_subdomain text)
 RETURNS TABLE(id uuid, name text, description text, price double precision, compare_price double precision, images text[], unit text, sku text, quantity double precision, slug text, packaging_type text, category_id text, category_ids text[], category_name text, catalog_status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
           cps.is_fixed_price
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
        -- Приоритет 1: фикс.цена из настроек каталога
        WHEN st.is_fixed_price = true AND st.fixed_price IS NOT NULL 
          THEN st.fixed_price::double precision
        -- Приоритет 2: фикс.цена из products (для обратной совместимости)
        WHEN p.is_fixed_price = true AND p.price IS NOT NULL 
          THEN p.price::double precision
        -- Приоритет 3: расчёт по наценке каталога
        WHEN p.buy_price IS NOT NULL AND p.buy_price > 0 AND st.markup_type = 'percent' 
          THEN (p.buy_price * (1 + COALESCE(st.markup_value, 0) / 100))::double precision
        WHEN p.buy_price IS NOT NULL AND p.buy_price > 0 AND (st.markup_type = 'fixed' OR st.markup_type = 'rubles') 
          THEN (p.buy_price + COALESCE(st.markup_value, 0))::double precision
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
      (st.is_fixed_price = true AND st.fixed_price IS NOT NULL AND st.fixed_price > 0)
      OR (p.is_fixed_price = true AND p.price IS NOT NULL AND p.price > 0)
      OR (p.price IS NOT NULL AND p.price > 0)
      OR (p.buy_price IS NOT NULL AND p.buy_price > 0)
    );
$function$;

-- Update get_catalog_products_public function to support catalog-specific fixed prices
CREATE OR REPLACE FUNCTION public.get_catalog_products_public(_access_code text)
 RETURNS TABLE(product_id uuid, product_name text, product_description text, product_price numeric, product_compare_price numeric, product_images text[], product_unit text, product_sku text, product_quantity numeric, product_slug text, product_packaging_type text, product_portion_weight numeric, product_price_portion numeric, product_price_quarter numeric, product_price_half numeric, product_price_full numeric, product_unit_weight numeric, catalog_id uuid, catalog_name text, catalog_description text, store_id uuid, store_name text, store_logo text, store_description text, setting_markup_type text, setting_markup_value numeric, setting_status text, setting_categories text[], setting_portion_prices jsonb, category_id uuid, category_name text, category_slug text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as product_id,
    p.name as product_name,
    p.description as product_description,
    -- Calculate price with catalog-specific fixed price priority
    CASE 
      -- Приоритет 1: фикс.цена из настроек каталога
      WHEN cps.is_fixed_price = true AND cps.fixed_price IS NOT NULL 
        THEN cps.fixed_price::numeric
      -- Приоритет 2: фикс.цена из products (для обратной совместимости)
      WHEN p.is_fixed_price = true AND p.price IS NOT NULL AND p.price > 0 
        THEN p.price::numeric
      -- Приоритет 3: если price > 0, используем его
      WHEN p.price > 0 THEN p.price::numeric
      -- Приоритет 4: расчёт от buy_price + наценка каталога
      WHEN p.buy_price IS NOT NULL AND p.buy_price > 0 THEN
        CASE 
          WHEN COALESCE(cps.markup_type, 'percent') = 'percent' THEN 
            (p.buy_price * (1 + COALESCE(cps.markup_value, 0::numeric) / 100))::numeric
          WHEN cps.markup_type = 'fixed' OR cps.markup_type = 'rubles' THEN 
            (p.buy_price + COALESCE(cps.markup_value, 0::numeric))::numeric
          ELSE p.buy_price::numeric
        END
      ELSE 0::numeric
    END as product_price,
    p.compare_price::numeric as product_compare_price,
    p.images as product_images,
    p.unit as product_unit,
    p.sku as product_sku,
    p.quantity::numeric as product_quantity,
    p.slug as product_slug,
    p.packaging_type as product_packaging_type,
    p.portion_weight::numeric as product_portion_weight,
    p.price_portion::numeric as product_price_portion,
    p.price_quarter::numeric as product_price_quarter,
    p.price_half::numeric as product_price_half,
    p.price_full::numeric as product_price_full,
    p.unit_weight::numeric as product_unit_weight,
    cat.id as catalog_id,
    cat.name as catalog_name,
    cat.description as catalog_description,
    s.id as store_id,
    s.name as store_name,
    s.logo_url as store_logo,
    s.description as store_description,
    cps.markup_type as setting_markup_type,
    cps.markup_value::numeric as setting_markup_value,
    cps.status as setting_status,
    cps.categories as setting_categories,
    cps.portion_prices as setting_portion_prices,
    c.id as category_id,
    c.name as category_name,
    c.slug as category_slug
  FROM products p
  INNER JOIN product_catalog_visibility pcv ON pcv.product_id = p.id
  INNER JOIN catalogs cat ON cat.id = pcv.catalog_id
  INNER JOIN stores s ON s.id = cat.store_id
  LEFT JOIN catalog_product_settings cps ON cps.product_id = p.id AND cps.catalog_id = cat.id
  LEFT JOIN categories c ON c.id = p.category_id
  WHERE cat.access_code = _access_code
    AND p.is_active = true
    AND COALESCE(cps.status, 'visible') != 'hidden'
  ORDER BY p.name;
END;
$function$;