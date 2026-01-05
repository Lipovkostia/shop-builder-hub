-- Create catalogs table (price lists)
CREATE TABLE public.catalogs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_default BOOLEAN NOT NULL DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create product_catalog_visibility table (many-to-many relationship)
CREATE TABLE public.product_catalog_visibility (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    catalog_id UUID NOT NULL REFERENCES public.catalogs(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(product_id, catalog_id)
);

-- Enable RLS
ALTER TABLE public.catalogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_catalog_visibility ENABLE ROW LEVEL SECURITY;

-- RLS policies for catalogs
CREATE POLICY "Anyone can view catalogs"
ON public.catalogs
FOR SELECT
USING (true);

CREATE POLICY "Store owners can manage catalogs"
ON public.catalogs
FOR ALL
USING (
    store_id IN (
        SELECT stores.id FROM stores
        WHERE stores.owner_id IN (
            SELECT profiles.id FROM profiles
            WHERE profiles.user_id = auth.uid()
        )
    )
);

-- RLS policies for product_catalog_visibility
CREATE POLICY "Anyone can view product catalog visibility"
ON public.product_catalog_visibility
FOR SELECT
USING (true);

CREATE POLICY "Store owners can manage product catalog visibility"
ON public.product_catalog_visibility
FOR ALL
USING (
    product_id IN (
        SELECT products.id FROM products
        JOIN stores ON stores.id = products.store_id
        JOIN profiles ON profiles.id = stores.owner_id
        WHERE profiles.user_id = auth.uid()
    )
);

-- Add trigger for updated_at on catalogs
CREATE TRIGGER update_catalogs_updated_at
BEFORE UPDATE ON public.catalogs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();