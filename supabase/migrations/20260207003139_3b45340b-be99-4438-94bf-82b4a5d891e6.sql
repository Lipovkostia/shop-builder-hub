
-- Add showcase columns to stores table (analogous to retail_*)
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS showcase_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS showcase_name text,
  ADD COLUMN IF NOT EXISTS showcase_catalog_id uuid REFERENCES public.catalogs(id),
  ADD COLUMN IF NOT EXISTS showcase_logo_url text,
  ADD COLUMN IF NOT EXISTS showcase_theme jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS showcase_seo_title text,
  ADD COLUMN IF NOT EXISTS showcase_seo_description text,
  ADD COLUMN IF NOT EXISTS showcase_favicon_url text,
  ADD COLUMN IF NOT EXISTS showcase_custom_domain text,
  ADD COLUMN IF NOT EXISTS showcase_phone text,
  ADD COLUMN IF NOT EXISTS showcase_telegram_username text,
  ADD COLUMN IF NOT EXISTS showcase_whatsapp_phone text,
  ADD COLUMN IF NOT EXISTS showcase_delivery_time text,
  ADD COLUMN IF NOT EXISTS showcase_delivery_info text,
  ADD COLUMN IF NOT EXISTS showcase_delivery_free_from numeric,
  ADD COLUMN IF NOT EXISTS showcase_delivery_region text,
  ADD COLUMN IF NOT EXISTS showcase_footer_delivery_payment text,
  ADD COLUMN IF NOT EXISTS showcase_footer_returns text;

-- Create RPC function to get showcase products (same as retail but reads showcase_catalog_id)
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
  catalog_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _store_id uuid;
  _catalog_id uuid;
BEGIN
  -- Get store and showcase catalog
  SELECT s.id, s.showcase_catalog_id
  INTO _store_id, _catalog_id
  FROM stores s
  WHERE s.subdomain = _subdomain
    AND s.status = 'active'
    AND s.showcase_enabled = true;

  IF _store_id IS NULL THEN
    RETURN;
  END IF;

  IF _catalog_id IS NULL THEN
    RETURN;
  END IF;

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
    cps.status AS catalog_status
  FROM products p
  INNER JOIN product_catalog_visibility pcv ON pcv.product_id = p.id AND pcv.catalog_id = _catalog_id
  LEFT JOIN catalog_product_settings cps ON cps.product_id = p.id AND cps.catalog_id = _catalog_id
  LEFT JOIN categories c ON c.id = p.category_id
  WHERE p.store_id = _store_id
    AND p.deleted_at IS NULL
    AND p.is_active = true
    AND (cps.status IS NULL OR cps.status != 'hidden');
END;
$$;
