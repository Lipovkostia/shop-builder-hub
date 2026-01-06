-- Create table for catalog-specific product settings (pricing, categories, status)
CREATE TABLE public.catalog_product_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  catalog_id UUID NOT NULL REFERENCES public.catalogs(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  categories TEXT[] DEFAULT '{}',
  markup_type TEXT DEFAULT 'percent',
  markup_value NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'in_stock',
  portion_prices JSONB DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(catalog_id, product_id)
);

-- Enable RLS
ALTER TABLE public.catalog_product_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can view catalog product settings
CREATE POLICY "Anyone can view catalog product settings"
ON public.catalog_product_settings
FOR SELECT
USING (true);

-- Store owners can manage catalog product settings
CREATE POLICY "Store owners can manage catalog product settings"
ON public.catalog_product_settings
FOR ALL
USING (
  catalog_id IN (
    SELECT c.id FROM catalogs c
    JOIN stores s ON s.id = c.store_id
    JOIN profiles p ON p.id = s.owner_id
    WHERE p.user_id = auth.uid()
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_catalog_product_settings_updated_at
BEFORE UPDATE ON public.catalog_product_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();