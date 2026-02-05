-- Function to get categories with catalog-specific ordering
-- Falls back to global sort_order when catalog settings don't exist
CREATE OR REPLACE FUNCTION get_catalog_categories_ordered(
  _catalog_id uuid,
  _store_id uuid
)
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  image_url text,
  parent_id uuid,
  sort_order integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    c.id,
    COALESCE(ccs.custom_name, c.name) as name,
    c.slug,
    c.image_url,
    c.parent_id,
    COALESCE(ccs.sort_order, c.sort_order, 999999) as sort_order
  FROM categories c
  LEFT JOIN catalog_category_settings ccs 
    ON ccs.category_id = c.id 
    AND ccs.catalog_id = _catalog_id
  WHERE c.store_id = _store_id
  ORDER BY COALESCE(ccs.sort_order, c.sort_order, 999999), c.name;
$$;

-- Add unique constraint for catalog_category_settings to enable upsert
ALTER TABLE catalog_category_settings 
DROP CONSTRAINT IF EXISTS catalog_category_settings_catalog_category_unique;

ALTER TABLE catalog_category_settings 
ADD CONSTRAINT catalog_category_settings_catalog_category_unique 
UNIQUE (catalog_id, category_id);