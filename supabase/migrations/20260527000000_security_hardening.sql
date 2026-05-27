-- Tighten storefront chat RLS: remove public read
DROP POLICY IF EXISTS "Anyone can read chat messages" ON public.storefront_chat_messages;
DROP POLICY IF EXISTS "Anyone can read own chat sessions by visitor_id" ON public.storefront_chat_sessions;

CREATE POLICY "Store owners can read chat messages"
  ON public.storefront_chat_messages FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.storefront_chat_sessions s
    JOIN public.stores st ON st.id = s.store_id
    JOIN public.profiles p ON p.id = st.owner_id
    WHERE s.id = storefront_chat_messages.session_id
      AND p.user_id = auth.uid()
  ));

-- storefront_chat_sessions already has "Store owners can read their chat sessions"; nothing else to add.
-- Edge function (storefront-chat) uses service role and bypasses RLS.

-- Lock down purchase_* tables: require authentication
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

-- landing_settings: contains catalog_access_code that gates a catalog. Restrict read to super admins.
DROP POLICY IF EXISTS "Public can read landing settings" ON public.landing_settings;
CREATE POLICY "Super admins can read landing settings"
  ON public.landing_settings FOR SELECT
  USING (has_platform_role(auth.uid(), 'super_admin'::platform_role));
-- Edge function landing-products uses service role and continues to read it.

-- Storage: require authentication for order-attachments and avito-images uploads
DROP POLICY IF EXISTS "Store owners can upload order attachments" ON storage.objects;
CREATE POLICY "Authenticated users can upload order attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'order-attachments');

DROP POLICY IF EXISTS "Auth upload avito-images" ON storage.objects;
CREATE POLICY "Authenticated users can upload avito-images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avito-images');
