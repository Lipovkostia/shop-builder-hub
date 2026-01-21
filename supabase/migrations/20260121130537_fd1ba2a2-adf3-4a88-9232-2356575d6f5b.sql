-- Add retail store fields to stores table
ALTER TABLE public.stores 
  ADD COLUMN IF NOT EXISTS retail_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS retail_theme jsonb DEFAULT '{"primaryColor": "#000000", "accentColor": "#6366f1", "headerStyle": "minimal", "productCardStyle": "modern"}'::jsonb,
  ADD COLUMN IF NOT EXISTS custom_domain text,
  ADD COLUMN IF NOT EXISTS retail_logo_url text,
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS seo_description text,
  ADD COLUMN IF NOT EXISTS favicon_url text;

-- Create unique index for custom domains (only non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_stores_custom_domain 
  ON public.stores (custom_domain) 
  WHERE custom_domain IS NOT NULL;