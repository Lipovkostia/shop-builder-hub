-- Create table for catalog-specific category settings (custom names and sort order)
CREATE TABLE public.catalog_category_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  catalog_id uuid NOT NULL REFERENCES public.catalogs(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  custom_name text,
  sort_order integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(catalog_id, category_id)
);

-- Enable RLS
ALTER TABLE public.catalog_category_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Store owners can manage catalog category settings
CREATE POLICY "Store owners can manage catalog category settings"
ON public.catalog_category_settings
FOR ALL
USING (
  catalog_id IN (
    SELECT c.id FROM catalogs c
    JOIN stores s ON s.id = c.store_id
    JOIN profiles p ON p.id = s.owner_id
    WHERE p.user_id = auth.uid()
  )
);

-- Policy: Anyone can view catalog category settings (for public storefronts)
CREATE POLICY "Anyone can view catalog category settings"
ON public.catalog_category_settings
FOR SELECT
USING (true);

-- Create updated_at trigger
CREATE TRIGGER update_catalog_category_settings_updated_at
BEFORE UPDATE ON public.catalog_category_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster lookups
CREATE INDEX idx_catalog_category_settings_catalog_id ON public.catalog_category_settings(catalog_id);
CREATE INDEX idx_catalog_category_settings_category_id ON public.catalog_category_settings(category_id);