
-- Add banner settings to categories table
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS banner_images text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS banner_interval integer DEFAULT 5,
  ADD COLUMN IF NOT EXISTS banner_effect text DEFAULT 'fade',
  ADD COLUMN IF NOT EXISTS banner_enabled boolean DEFAULT false;

COMMENT ON COLUMN public.categories.banner_images IS 'Array of banner image URLs for category header';
COMMENT ON COLUMN public.categories.banner_interval IS 'Interval in seconds between banner slides';
COMMENT ON COLUMN public.categories.banner_effect IS 'Transition effect: fade, slide, zoom';
COMMENT ON COLUMN public.categories.banner_enabled IS 'Whether to show banners instead of text';
