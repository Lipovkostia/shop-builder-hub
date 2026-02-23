
-- Add multi-banner support columns
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS retail_sidebar_banners text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS retail_sidebar_banner_effect text DEFAULT 'fade',
  ADD COLUMN IF NOT EXISTS retail_sidebar_banner_interval integer DEFAULT 5;

-- Migrate existing single banner to array
UPDATE public.stores
SET retail_sidebar_banners = ARRAY[retail_sidebar_banner_url]
WHERE retail_sidebar_banner_url IS NOT NULL
  AND (retail_sidebar_banners IS NULL OR retail_sidebar_banners = '{}'::text[]);
