
-- Table for curated megacatalog product list managed by super admin
CREATE TABLE public.megacatalog_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  added_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id)
);

ALTER TABLE public.megacatalog_products ENABLE ROW LEVEL SECURITY;

-- Super admins can manage
CREATE POLICY "Super admins can manage megacatalog products"
ON public.megacatalog_products FOR ALL
TO authenticated
USING (public.has_platform_role(auth.uid(), 'super_admin'));

-- Authenticated users can view (sellers need to see the curated list)
CREATE POLICY "Authenticated users can view megacatalog products"
ON public.megacatalog_products FOR SELECT
TO authenticated
USING (true);
