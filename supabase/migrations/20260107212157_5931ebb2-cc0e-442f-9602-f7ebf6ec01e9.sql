-- Enable realtime for catalog_product_settings table
-- This ensures updates to catalog-specific settings propagate instantly across sections

ALTER PUBLICATION supabase_realtime ADD TABLE public.catalog_product_settings;