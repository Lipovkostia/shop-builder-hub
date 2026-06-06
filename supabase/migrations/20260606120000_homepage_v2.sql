-- Homepage v2: toggle + retail partners

ALTER TABLE public.landing_settings
  ADD COLUMN IF NOT EXISTS homepage_version text NOT NULL DEFAULT 'new';

CREATE TABLE IF NOT EXISTS public.landing_retail_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL,
  image_url text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.landing_retail_partners TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.landing_retail_partners TO authenticated;
GRANT ALL ON public.landing_retail_partners TO service_role;

ALTER TABLE public.landing_retail_partners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read active partners" ON public.landing_retail_partners;
CREATE POLICY "Public can read active partners"
  ON public.landing_retail_partners
  FOR SELECT
  USING (is_active = true OR public.has_platform_role(auth.uid(), 'super_admin'::platform_role));

DROP POLICY IF EXISTS "Super admins manage partners" ON public.landing_retail_partners;
CREATE POLICY "Super admins manage partners"
  ON public.landing_retail_partners
  FOR ALL
  USING (public.has_platform_role(auth.uid(), 'super_admin'::platform_role))
  WITH CHECK (public.has_platform_role(auth.uid(), 'super_admin'::platform_role));

DROP TRIGGER IF EXISTS landing_retail_partners_updated_at ON public.landing_retail_partners;
CREATE TRIGGER landing_retail_partners_updated_at
  BEFORE UPDATE ON public.landing_retail_partners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_partners_sort ON public.landing_retail_partners(sort_order);
