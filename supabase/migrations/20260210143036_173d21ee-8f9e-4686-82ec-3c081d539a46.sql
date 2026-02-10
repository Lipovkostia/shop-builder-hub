-- Add sort_order column to catalog_product_settings for manual product ordering within price lists
ALTER TABLE public.catalog_product_settings
ADD COLUMN sort_order integer DEFAULT null;