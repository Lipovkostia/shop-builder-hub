-- Add primary_category_id column to catalog_product_settings
ALTER TABLE catalog_product_settings 
ADD COLUMN primary_category_id uuid REFERENCES categories(id) ON DELETE SET NULL;

COMMENT ON COLUMN catalog_product_settings.primary_category_id 
IS 'Main parent category for display grouping. Subcategories go in categories array.';

-- Migrate existing data: first element of categories array becomes primary_category_id
UPDATE catalog_product_settings 
SET primary_category_id = categories[1]::uuid
WHERE categories IS NOT NULL 
  AND array_length(categories, 1) > 0;