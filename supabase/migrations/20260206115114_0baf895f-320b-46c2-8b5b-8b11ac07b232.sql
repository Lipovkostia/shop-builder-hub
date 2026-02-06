-- Add parent_category_id to catalog_category_settings for catalog-specific hierarchy
ALTER TABLE catalog_category_settings 
ADD COLUMN IF NOT EXISTS parent_category_id UUID REFERENCES categories(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_catalog_category_settings_parent 
ON catalog_category_settings(parent_category_id);

-- Drop and recreate RPC function with new return type
DROP FUNCTION IF EXISTS public.get_catalog_categories_ordered(uuid, uuid);

CREATE OR REPLACE FUNCTION public.get_catalog_categories_ordered(_catalog_id uuid, _store_id uuid)
 RETURNS TABLE(id uuid, name text, slug text, image_url text, parent_id uuid, catalog_parent_id uuid, sort_order integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT 
    c.id,
    COALESCE(ccs.custom_name, c.name) as name,
    c.slug,
    c.image_url,
    c.parent_id,
    ccs.parent_category_id as catalog_parent_id,
    COALESCE(ccs.sort_order, c.sort_order, 999999) as sort_order
  FROM categories c
  LEFT JOIN catalog_category_settings ccs 
    ON ccs.category_id = c.id 
    AND ccs.catalog_id = _catalog_id
  WHERE c.store_id = _store_id
  ORDER BY COALESCE(ccs.sort_order, c.sort_order, 999999), c.name;
$function$;