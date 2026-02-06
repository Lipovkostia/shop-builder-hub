
DROP FUNCTION IF EXISTS get_catalog_categories_ordered(uuid, uuid);

CREATE FUNCTION get_catalog_categories_ordered(
  _catalog_id uuid,
  _store_id uuid
)
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  image_url text,
  parent_id uuid,
  sort_order integer,
  catalog_parent_id uuid
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
    COALESCE(ccs.sort_order, c.sort_order, 999999) as sort_order,
    ccs.parent_category_id as catalog_parent_id
  FROM categories c
  LEFT JOIN catalog_category_settings ccs 
    ON ccs.category_id = c.id 
    AND ccs.catalog_id = _catalog_id
  WHERE c.store_id = _store_id
  ORDER BY COALESCE(ccs.sort_order, c.sort_order, 999999), c.name;
$$;
