-- Multi-price-list manager for the platform homepage.
-- APPLY THIS in Supabase SQL editor (owner role). The Lovable sandbox lacks DDL rights on the public schema.

CREATE TABLE IF NOT EXISTS public.homepage_catalogs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id uuid REFERENCES public.catalogs(id) ON DELETE CASCADE,
  access_code text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.homepage_catalogs TO anon, authenticated;
GRANT ALL ON public.homepage_catalogs TO service_role;
ALTER TABLE public.homepage_catalogs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read homepage_catalogs" ON public.homepage_catalogs;
CREATE POLICY "public read homepage_catalogs" ON public.homepage_catalogs FOR SELECT USING (true);
DROP POLICY IF EXISTS "super_admin write homepage_catalogs" ON public.homepage_catalogs;
CREATE POLICY "super_admin write homepage_catalogs" ON public.homepage_catalogs FOR ALL TO authenticated
  USING (public.has_platform_role(auth.uid(), 'super_admin'::platform_role))
  WITH CHECK (public.has_platform_role(auth.uid(), 'super_admin'::platform_role));

CREATE TABLE IF NOT EXISTS public.homepage_catalog_category_excludes (
  homepage_catalog_id uuid NOT NULL REFERENCES public.homepage_catalogs(id) ON DELETE CASCADE,
  category_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (homepage_catalog_id, category_id)
);
GRANT SELECT ON public.homepage_catalog_category_excludes TO anon, authenticated;
GRANT ALL ON public.homepage_catalog_category_excludes TO service_role;
ALTER TABLE public.homepage_catalog_category_excludes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read hcce" ON public.homepage_catalog_category_excludes;
CREATE POLICY "public read hcce" ON public.homepage_catalog_category_excludes FOR SELECT USING (true);
DROP POLICY IF EXISTS "super_admin write hcce" ON public.homepage_catalog_category_excludes;
CREATE POLICY "super_admin write hcce" ON public.homepage_catalog_category_excludes FOR ALL TO authenticated
  USING (public.has_platform_role(auth.uid(), 'super_admin'::platform_role))
  WITH CHECK (public.has_platform_role(auth.uid(), 'super_admin'::platform_role));

CREATE TABLE IF NOT EXISTS public.homepage_catalog_product_excludes (
  homepage_catalog_id uuid NOT NULL REFERENCES public.homepage_catalogs(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (homepage_catalog_id, product_id)
);
GRANT SELECT ON public.homepage_catalog_product_excludes TO anon, authenticated;
GRANT ALL ON public.homepage_catalog_product_excludes TO service_role;
ALTER TABLE public.homepage_catalog_product_excludes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read hcpe" ON public.homepage_catalog_product_excludes;
CREATE POLICY "public read hcpe" ON public.homepage_catalog_product_excludes FOR SELECT USING (true);
DROP POLICY IF EXISTS "super_admin write hcpe" ON public.homepage_catalog_product_excludes;
CREATE POLICY "super_admin write hcpe" ON public.homepage_catalog_product_excludes FOR ALL TO authenticated
  USING (public.has_platform_role(auth.uid(), 'super_admin'::platform_role))
  WITH CHECK (public.has_platform_role(auth.uid(), 'super_admin'::platform_role));

-- One-time migration of existing single access code
INSERT INTO public.homepage_catalogs (catalog_id, access_code, is_active, sort_order)
SELECT c.id, ls.catalog_access_code, true, 0
FROM public.landing_settings ls
LEFT JOIN public.catalogs c ON c.access_code = ls.catalog_access_code
WHERE ls.id = 'default'
  AND ls.catalog_access_code IS NOT NULL
  AND ls.catalog_access_code <> ''
ON CONFLICT (access_code) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_homepage_catalogs_active_order
  ON public.homepage_catalogs (is_active, sort_order);
