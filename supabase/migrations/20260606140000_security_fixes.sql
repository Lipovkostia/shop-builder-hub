-- Security fixes from scanner

-- 1. landing_settings: hide catalog_access_code from public.
DROP POLICY IF EXISTS "Public can read landing settings" ON public.landing_settings;

CREATE OR REPLACE FUNCTION public.get_landing_homepage_version()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT homepage_version FROM public.landing_settings WHERE id = 'default' LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_landing_homepage_version() TO anon, authenticated;

-- 2. purchase_* tables: restrict to authenticated only
DROP POLICY IF EXISTS "Anyone can read purchase_sessions" ON public.purchase_sessions;
DROP POLICY IF EXISTS "Anyone can insert purchase_sessions" ON public.purchase_sessions;
DROP POLICY IF EXISTS "Anyone can delete purchase_sessions" ON public.purchase_sessions;
CREATE POLICY "Authenticated can read purchase_sessions" ON public.purchase_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert purchase_sessions" ON public.purchase_sessions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can delete purchase_sessions" ON public.purchase_sessions FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can read purchase_items" ON public.purchase_items;
DROP POLICY IF EXISTS "Anyone can insert purchase_items" ON public.purchase_items;
DROP POLICY IF EXISTS "Anyone can delete purchase_items" ON public.purchase_items;
CREATE POLICY "Authenticated can read purchase_items" ON public.purchase_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert purchase_items" ON public.purchase_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can delete purchase_items" ON public.purchase_items FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can read purchase_questions" ON public.purchase_questions;
DROP POLICY IF EXISTS "Anyone can insert purchase_questions" ON public.purchase_questions;
DROP POLICY IF EXISTS "Anyone can delete purchase_questions" ON public.purchase_questions;
CREATE POLICY "Authenticated can read purchase_questions" ON public.purchase_questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert purchase_questions" ON public.purchase_questions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can delete purchase_questions" ON public.purchase_questions FOR DELETE TO authenticated USING (true);

REVOKE SELECT, INSERT, UPDATE, DELETE ON public.purchase_sessions FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.purchase_items FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.purchase_questions FROM anon;

-- 3. role_product_pricing: remove public read.
DROP POLICY IF EXISTS "Anyone can view role pricing" ON public.role_product_pricing;
CREATE POLICY "Customers can view their assigned role pricing"
  ON public.role_product_pricing
  FOR SELECT
  TO authenticated
  USING (
    role_id IN (
      SELECT cra.role_id
      FROM public.customer_role_assignments cra
      JOIN public.store_customers sc ON sc.id = cra.store_customer_id
      JOIN public.profiles p ON p.id = sc.profile_id
      WHERE p.user_id = auth.uid()
    )
  );

-- 4. storefront_chat_*: remove public read/insert. Edge function uses service_role.
DROP POLICY IF EXISTS "Anyone can read own chat sessions by visitor_id" ON public.storefront_chat_sessions;
DROP POLICY IF EXISTS "Anyone can create chat sessions" ON public.storefront_chat_sessions;
DROP POLICY IF EXISTS "Anyone can read chat messages" ON public.storefront_chat_messages;
DROP POLICY IF EXISTS "Anyone can insert chat messages" ON public.storefront_chat_messages;

CREATE POLICY "Store owners can read chat messages"
  ON public.storefront_chat_messages
  FOR SELECT
  TO authenticated
  USING (
    session_id IN (
      SELECT s.id
      FROM public.storefront_chat_sessions s
      JOIN public.stores st ON st.id = s.store_id
      JOIN public.profiles p ON p.id = st.owner_id
      WHERE p.user_id = auth.uid()
    )
  );

REVOKE SELECT, INSERT, UPDATE, DELETE ON public.storefront_chat_sessions FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.storefront_chat_messages FROM anon;

-- 5. Storage buckets: require authentication for uploads.
DROP POLICY IF EXISTS "Auth upload avito-images" ON storage.objects;
CREATE POLICY "Authenticated upload avito-images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avito-images' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Store owners can upload order attachments" ON storage.objects;
CREATE POLICY "Authenticated upload order-attachments"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'order-attachments' AND auth.uid() IS NOT NULL);
