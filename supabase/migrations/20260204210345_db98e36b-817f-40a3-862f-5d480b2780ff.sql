-- Update the wholesale products function to use primary_category_id from catalog_product_settings
CREATE OR REPLACE FUNCTION public.get_wholesale_products_public(_subdomain text)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  price double precision,
  compare_price double precision,
  buy_price double precision,
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
  seo_title text,
  seo_description text,
  seo_keywords text[],
  seo_schema jsonb
)
LANGUAGE sql STABLE
AS $$
  WITH s AS (
    SELECT stores.id, wholesale_catalog_id
    FROM public.stores
    WHERE subdomain = _subdomain
      AND status = 'active'::public.store_status
      AND wholesale_enabled = true
    LIMIT 1
  ),
  settings AS (
    SELECT cps.product_id,
           cps.markup_type,
           cps.markup_value,
           cps.status,
           cps.categories,
           cps.primary_category_id
    FROM public.catalog_product_settings cps
    JOIN s ON cps.catalog_id = s.wholesale_catalog_id
  ),
  vis AS (
    SELECT pcv.product_id
    FROM public.product_catalog_visibility pcv
    JOIN s ON pcv.catalog_id = s.wholesale_catalog_id
  )
  SELECT
    p.id,
    p.name,
    p.description,
    COALESCE(p.price, 0)::double precision AS price,
    COALESCE(p.compare_price, 0)::double precision AS compare_price,
    COALESCE(p.buy_price, 0)::double precision AS buy_price,
    COALESCE(p.images, '{}'::text[]) AS images,
    COALESCE(p.unit, 'шт') AS unit,
    p.sku,
    COALESCE(p.quantity, 0)::double precision AS quantity,
    p.slug,
    COALESCE(p.packaging_type, 'piece') AS packaging_type,
    -- Use primary_category_id from settings first, then fallback to categories array, then product category_id
    COALESCE(
      st.primary_category_id::text,
      CASE
        WHEN st.categories IS NOT NULL AND array_length(st.categories, 1) > 0 THEN st.categories[1]
        ELSE p.category_id::text
      END
    ) AS category_id,
    -- Build category_ids array: primary_category_id + categories array, or fallback to product category_id
    COALESCE(
      CASE 
        WHEN st.primary_category_id IS NOT NULL THEN 
          ARRAY[st.primary_category_id::text] || COALESCE(st.categories, '{}'::text[])
        ELSE st.categories
      END,
      CASE WHEN p.category_id IS NOT NULL THEN ARRAY[p.category_id::text] ELSE '{}'::text[] END
    ) AS category_ids,
    -- Get category name from primary_category_id first
    COALESCE(c_primary.name, c_product.name) AS category_name,
    COALESCE(st.status, NULL) AS catalog_status,
    p.seo_title,
    p.seo_description,
    p.seo_keywords,
    p.seo_schema
  FROM vis
  JOIN public.products p ON p.id = vis.product_id
  LEFT JOIN settings st ON st.product_id = p.id
  LEFT JOIN public.categories c_primary ON c_primary.id = st.primary_category_id
  LEFT JOIN public.categories c_product ON c_product.id = p.category_id
  WHERE p.deleted_at IS NULL
    AND p.is_active = true
    AND (st.status IS NULL OR (st.status <> 'hidden' AND st.status <> 'out_of_stock'));
$$;