-- Link Avito duplicate products to their source so the UI can show the hierarchy
-- and users can edit duplicates as normal products.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS duplicate_of_product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_duplicate_of
  ON public.products(duplicate_of_product_id)
  WHERE duplicate_of_product_id IS NOT NULL;

-- Ensure grants on avito_listing_variants (was missing — blocked the duplicate edge function).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.avito_listing_variants TO authenticated;
GRANT ALL ON public.avito_listing_variants TO service_role;
