-- Security scan fixes
DROP POLICY IF EXISTS "Anyone can view landing settings" ON public.landing_settings;
DROP POLICY IF EXISTS "Public can view landing settings" ON public.landing_settings;
DROP POLICY IF EXISTS "Authenticated can view landing settings" ON public.landing_settings;
CREATE POLICY "Super admin manages landing settings" ON public.landing_settings FOR ALL TO authenticated USING (public.has_platform_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_platform_role(auth.uid(), 'super_admin'));
REVOKE SELECT ON public.landing_settings FROM anon;

DROP POLICY IF EXISTS "Anyone can view role product pricing" ON public.role_product_pricing;
DROP POLICY IF EXISTS "Public can view role product pricing" ON public.role_product_pricing;
CREATE POLICY "Store owners manage role pricing" ON public.role_product_pricing FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.customer_roles cr WHERE cr.id = role_product_pricing.role_id AND public.is_store_owner(cr.store_id, auth.uid()))) WITH CHECK (EXISTS (SELECT 1 FROM public.customer_roles cr WHERE cr.id = role_product_pricing.role_id AND public.is_store_owner(cr.store_id, auth.uid())));
REVOKE SELECT ON public.role_product_pricing FROM anon;

DROP POLICY IF EXISTS "Anyone can view purchase sessions" ON public.purchase_sessions;
DROP POLICY IF EXISTS "Anyone can create purchase sessions" ON public.purchase_sessions;
DROP POLICY IF EXISTS "Anyone can update purchase sessions" ON public.purchase_sessions;
DROP POLICY IF EXISTS "Anyone can delete purchase sessions" ON public.purchase_sessions;
CREATE POLICY "Super admin manages purchase sessions" ON public.purchase_sessions FOR ALL TO authenticated USING (public.has_platform_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_platform_role(auth.uid(), 'super_admin'));
REVOKE ALL ON public.purchase_sessions FROM anon;

DROP POLICY IF EXISTS "Anyone can view purchase items" ON public.purchase_items;
DROP POLICY IF EXISTS "Anyone can create purchase items" ON public.purchase_items;
DROP POLICY IF EXISTS "Anyone can update purchase items" ON public.purchase_items;
DROP POLICY IF EXISTS "Anyone can delete purchase items" ON public.purchase_items;
CREATE POLICY "Super admin manages purchase items" ON public.purchase_items FOR ALL TO authenticated USING (public.has_platform_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_platform_role(auth.uid(), 'super_admin'));
REVOKE ALL ON public.purchase_items FROM anon;

DROP POLICY IF EXISTS "Anyone can view purchase questions" ON public.purchase_questions;
DROP POLICY IF EXISTS "Anyone can create purchase questions" ON public.purchase_questions;
DROP POLICY IF EXISTS "Anyone can update purchase questions" ON public.purchase_questions;
DROP POLICY IF EXISTS "Anyone can delete purchase questions" ON public.purchase_questions;
CREATE POLICY "Super admin manages purchase questions" ON public.purchase_questions FOR ALL TO authenticated USING (public.has_platform_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_platform_role(auth.uid(), 'super_admin'));
REVOKE ALL ON public.purchase_questions FROM anon;

DROP POLICY IF EXISTS "Anyone can view chat sessions" ON public.storefront_chat_sessions;
DROP POLICY IF EXISTS "Public can view chat sessions" ON public.storefront_chat_sessions;
DROP POLICY IF EXISTS "Anyone can view chat messages" ON public.storefront_chat_messages;
DROP POLICY IF EXISTS "Public can view chat messages" ON public.storefront_chat_messages;
REVOKE SELECT ON public.storefront_chat_sessions FROM anon;
REVOKE SELECT ON public.storefront_chat_messages FROM anon;

DROP POLICY IF EXISTS "Anyone can upload avito images" ON storage.objects;
CREATE POLICY "Authenticated upload avito images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avito-images');

DROP POLICY IF EXISTS "Anyone can upload order attachments" ON storage.objects;
CREATE POLICY "Authenticated upload order attachments" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'order-attachments');
