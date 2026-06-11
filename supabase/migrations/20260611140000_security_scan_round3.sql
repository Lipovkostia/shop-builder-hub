-- Security scan fixes (round 3)

DROP POLICY IF EXISTS "Public can read landing settings" ON public.landing_settings;

DROP POLICY IF EXISTS "Anyone can view role pricing" ON public.role_product_pricing;

DROP POLICY IF EXISTS "Anyone can read chat messages"  ON public.storefront_chat_messages;
DROP POLICY IF EXISTS "Anyone can insert chat messages" ON public.storefront_chat_messages;
DROP POLICY IF EXISTS "Anyone can read own chat sessions by visitor_id" ON public.storefront_chat_sessions;
DROP POLICY IF EXISTS "Anyone can create chat sessions"                 ON public.storefront_chat_sessions;

DROP POLICY IF EXISTS "Anyone can read purchase_sessions"   ON public.purchase_sessions;
DROP POLICY IF EXISTS "Anyone can insert purchase_sessions" ON public.purchase_sessions;
DROP POLICY IF EXISTS "Anyone can delete purchase_sessions" ON public.purchase_sessions;
DROP POLICY IF EXISTS "Anyone can read purchase_items"   ON public.purchase_items;
DROP POLICY IF EXISTS "Anyone can insert purchase_items" ON public.purchase_items;
DROP POLICY IF EXISTS "Anyone can delete purchase_items" ON public.purchase_items;
DROP POLICY IF EXISTS "Anyone can read purchase_questions"   ON public.purchase_questions;
DROP POLICY IF EXISTS "Anyone can insert purchase_questions" ON public.purchase_questions;
DROP POLICY IF EXISTS "Anyone can delete purchase_questions" ON public.purchase_questions;

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

DROP POLICY IF EXISTS "Auth upload avito-images" ON storage.objects;
CREATE POLICY "Authenticated upload avito-images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avito-images');
CREATE POLICY "Authenticated update avito-images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avito-images')
  WITH CHECK (bucket_id = 'avito-images');
CREATE POLICY "Authenticated delete avito-images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avito-images');

DROP POLICY IF EXISTS "Store owners can upload order attachments" ON storage.objects;
CREATE POLICY "Authenticated upload order-attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'order-attachments');
