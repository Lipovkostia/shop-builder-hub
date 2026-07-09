-- Adds JSON column to store editable header configuration for the homepage.
-- Includes top nav links, promo chips row, and various header labels.

ALTER TABLE public.homepage_hero_settings
  ADD COLUMN IF NOT EXISTS header_config jsonb NOT NULL DEFAULT '{}'::jsonb;
