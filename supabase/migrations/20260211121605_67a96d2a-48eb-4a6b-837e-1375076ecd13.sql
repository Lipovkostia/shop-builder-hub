
CREATE TABLE public.featured_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id)
);

ALTER TABLE public.featured_products ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Anyone can view featured products"
  ON public.featured_products FOR SELECT
  USING (true);

-- Super admins can manage featured products
CREATE POLICY "Super admins can manage featured products"
  ON public.featured_products FOR ALL
  USING (has_platform_role(auth.uid(), 'super_admin'::platform_role));
