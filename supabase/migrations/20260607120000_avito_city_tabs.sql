-- Avito city tabs: independent listing sets per city
CREATE TABLE IF NOT EXISTS public.avito_city_tabs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  name text NOT NULL,
  city text,
  address text,
  markup_percent numeric NOT NULL DEFAULT 30,
  is_default boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  spreadsheet_id text,
  spreadsheet_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.avito_city_tabs TO authenticated;
GRANT ALL ON public.avito_city_tabs TO service_role;

ALTER TABLE public.avito_city_tabs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner manages city tabs"
ON public.avito_city_tabs FOR ALL TO authenticated
USING (public.is_store_owner(store_id, auth.uid()))
WITH CHECK (public.is_store_owner(store_id, auth.uid()));

CREATE INDEX IF NOT EXISTS idx_avito_city_tabs_store ON public.avito_city_tabs(store_id);

CREATE TABLE IF NOT EXISTS public.avito_city_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_id uuid NOT NULL REFERENCES public.avito_city_tabs(id) ON DELETE CASCADE,
  store_id uuid NOT NULL,
  product_id uuid NOT NULL,
  title_override text,
  description_override text,
  price_override numeric,
  photo_order int[],
  avito_params jsonb,
  group_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tab_id, product_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.avito_city_listings TO authenticated;
GRANT ALL ON public.avito_city_listings TO service_role;

ALTER TABLE public.avito_city_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner manages city listings"
ON public.avito_city_listings FOR ALL TO authenticated
USING (public.is_store_owner(store_id, auth.uid()))
WITH CHECK (public.is_store_owner(store_id, auth.uid()));

CREATE INDEX IF NOT EXISTS idx_avito_city_listings_tab ON public.avito_city_listings(tab_id);
CREATE INDEX IF NOT EXISTS idx_avito_city_listings_store ON public.avito_city_listings(store_id);

DO $$
DECLARE
  r record;
  new_tab_id uuid;
BEGIN
  FOR r IN SELECT DISTINCT store_id FROM public.avito_feed_products LOOP
    INSERT INTO public.avito_city_tabs (store_id, name, markup_percent, is_default, sort_order)
    VALUES (r.store_id, 'Основная', 0, true, 0)
    RETURNING id INTO new_tab_id;

    INSERT INTO public.avito_city_listings (tab_id, store_id, product_id, avito_params, group_id)
    SELECT new_tab_id, fp.store_id, fp.product_id, fp.avito_params, fp.group_id
    FROM public.avito_feed_products fp
    WHERE fp.store_id = r.store_id
    ON CONFLICT (tab_id, product_id) DO NOTHING;
  END LOOP;
END $$;
