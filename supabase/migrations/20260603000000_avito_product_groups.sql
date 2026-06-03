-- Avito product groups
CREATE TABLE IF NOT EXISTS public.avito_product_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT 'slate',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_avito_product_groups_store ON public.avito_product_groups(store_id, sort_order);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.avito_product_groups TO authenticated;
GRANT ALL ON public.avito_product_groups TO service_role;
ALTER TABLE public.avito_product_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Store owners manage their avito groups" ON public.avito_product_groups;
CREATE POLICY "Store owners manage their avito groups"
  ON public.avito_product_groups FOR ALL TO authenticated
  USING (public.is_store_owner(store_id, auth.uid()))
  WITH CHECK (public.is_store_owner(store_id, auth.uid()));
ALTER TABLE public.avito_feed_products ADD COLUMN IF NOT EXISTS group_id uuid;
CREATE INDEX IF NOT EXISTS idx_avito_feed_products_group ON public.avito_feed_products(store_id, group_id);
