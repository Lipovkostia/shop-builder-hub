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

DROP POLICY IF EXISTS "owner manages city tabs" ON public.avito_city_tabs;
CREATE POLICY "owner manages city tabs"
ON public.avito_city_tabs FOR ALL TO authenticated
USING (public.is_store_owner(store_id, auth.uid()))
WITH CHECK (public.is_store_owner(store_id, auth.uid()));

CREATE INDEX IF NOT EXISTS idx_avito_city_tabs_store ON public.avito_city_tabs(store_id);

ALTER TABLE public.avito_feed_products
  ADD COLUMN IF NOT EXISTS tab_id uuid REFERENCES public.avito_city_tabs(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS photo_order int[];

CREATE INDEX IF NOT EXISTS idx_avito_feed_products_tab ON public.avito_feed_products(tab_id);

DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint
           WHERE conrelid = 'public.avito_feed_products'::regclass AND contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE public.avito_feed_products DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

DO $$
DECLARE r record; new_tab_id uuid;
BEGIN
  FOR r IN SELECT DISTINCT store_id FROM public.avito_feed_products WHERE tab_id IS NULL LOOP
    SELECT id INTO new_tab_id FROM public.avito_city_tabs
      WHERE store_id = r.store_id AND is_default = true LIMIT 1;
    IF new_tab_id IS NULL THEN
      INSERT INTO public.avito_city_tabs (store_id, name, markup_percent, is_default, sort_order)
      VALUES (r.store_id, 'Основная', 0, true, 0)
      RETURNING id INTO new_tab_id;
    END IF;
    UPDATE public.avito_feed_products SET tab_id = new_tab_id
      WHERE store_id = r.store_id AND tab_id IS NULL;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_avito_feed_products_tab_product
  ON public.avito_feed_products(tab_id, product_id) WHERE tab_id IS NOT NULL;
