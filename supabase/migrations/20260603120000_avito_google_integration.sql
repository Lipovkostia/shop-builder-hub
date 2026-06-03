CREATE TABLE IF NOT EXISTS public.store_google_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  spreadsheet_id text,
  spreadsheet_url text,
  drive_root_id text,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(store_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_google_integrations TO authenticated;
GRANT ALL ON public.store_google_integrations TO service_role;
ALTER TABLE public.store_google_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "store owner manages google integration" ON public.store_google_integrations
  FOR ALL TO authenticated
  USING (public.is_store_owner(store_id, auth.uid()))
  WITH CHECK (public.is_store_owner(store_id, auth.uid()));

CREATE TABLE IF NOT EXISTS public.avito_listing_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  external_ad_id text,
  field text,
  severity text DEFAULT 'error',
  message text NOT NULL,
  raw jsonb,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.avito_listing_errors TO authenticated;
GRANT ALL ON public.avito_listing_errors TO service_role;
ALTER TABLE public.avito_listing_errors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "store owner manages avito errors" ON public.avito_listing_errors
  FOR ALL TO authenticated
  USING (public.is_store_owner(store_id, auth.uid()))
  WITH CHECK (public.is_store_owner(store_id, auth.uid()));
CREATE INDEX IF NOT EXISTS idx_avito_listing_errors_store ON public.avito_listing_errors(store_id);
CREATE INDEX IF NOT EXISTS idx_avito_listing_errors_product ON public.avito_listing_errors(product_id);

CREATE TABLE IF NOT EXISTS public.avito_sheets_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  source text NOT NULL,
  product_id uuid,
  field text,
  old_value text,
  new_value text,
  actor text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.avito_sheets_change_log TO authenticated;
GRANT ALL ON public.avito_sheets_change_log TO service_role;
ALTER TABLE public.avito_sheets_change_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "store owner reads change log" ON public.avito_sheets_change_log
  FOR SELECT TO authenticated
  USING (public.is_store_owner(store_id, auth.uid()));
CREATE INDEX IF NOT EXISTS idx_avito_sheets_log_store ON public.avito_sheets_change_log(store_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.avito_image_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  source_url text,
  variant_url text NOT NULL,
  hash text,
  transforms jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.avito_image_variants TO authenticated;
GRANT ALL ON public.avito_image_variants TO service_role;
ALTER TABLE public.avito_image_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "store owner manages image variants" ON public.avito_image_variants
  FOR ALL TO authenticated
  USING (public.is_store_owner(store_id, auth.uid()))
  WITH CHECK (public.is_store_owner(store_id, auth.uid()));
CREATE INDEX IF NOT EXISTS idx_avito_image_variants_product ON public.avito_image_variants(product_id);
