-- Security scan round 4 - APPLY THIS MIGRATION
-- Move/rename to supabase/migrations/<timestamp>_security_scan_round4.sql when applying via Supabase CLI.

DROP POLICY IF EXISTS "Anyone can view catalog category settings" ON public.catalog_category_settings;
CREATE POLICY "Owners and super admins can view catalog category settings"
ON public.catalog_category_settings FOR SELECT TO authenticated
USING (
  catalog_id IN (
    SELECT c.id FROM catalogs c
    JOIN stores s ON s.id = c.store_id
    JOIN profiles p ON p.id = s.owner_id
    WHERE p.user_id = auth.uid()
  )
  OR public.has_platform_role(auth.uid(), 'super_admin')
);

DROP POLICY IF EXISTS "Anyone can view customer roles" ON public.customer_roles;
CREATE POLICY "Store owners and customers can view customer roles"
ON public.customer_roles FOR SELECT TO authenticated
USING (
  public.is_store_owner(store_id, auth.uid())
  OR public.is_store_customer(store_id, auth.uid())
  OR public.has_platform_role(auth.uid(), 'super_admin')
);

DROP POLICY IF EXISTS "Anyone can view product category assignments" ON public.product_category_assignments;
CREATE POLICY "Owners and customers can view product category assignments"
ON public.product_category_assignments FOR SELECT TO authenticated
USING (
  product_id IN (
    SELECT p.id FROM products p
    WHERE public.is_store_owner(p.store_id, auth.uid())
       OR public.is_store_customer(p.store_id, auth.uid())
  )
  OR public.has_platform_role(auth.uid(), 'super_admin')
);

DROP POLICY IF EXISTS "Anyone can view product group assignments" ON public.product_group_assignments;
CREATE POLICY "Store owners can view product group assignments"
ON public.product_group_assignments FOR SELECT TO authenticated
USING (
  product_id IN (
    SELECT p.id FROM products p WHERE public.is_store_owner(p.store_id, auth.uid())
  )
  OR public.has_platform_role(auth.uid(), 'super_admin')
);

DROP POLICY IF EXISTS "Anyone can view product groups" ON public.product_groups;
CREATE POLICY "Store owners can view product groups"
ON public.product_groups FOR SELECT TO authenticated
USING (
  public.is_store_owner(store_id, auth.uid())
  OR public.has_platform_role(auth.uid(), 'super_admin')
);

DROP POLICY IF EXISTS "Anyone can view visibility settings" ON public.product_role_visibility;
CREATE POLICY "Owners and customers can view product role visibility"
ON public.product_role_visibility FOR SELECT TO authenticated
USING (
  product_id IN (
    SELECT p.id FROM products p
    WHERE public.is_store_owner(p.store_id, auth.uid())
       OR public.is_store_customer(p.store_id, auth.uid())
  )
  OR public.has_platform_role(auth.uid(), 'super_admin')
);

DROP POLICY IF EXISTS "Customers can view products from stores they are linked to" ON public.products;
DROP POLICY IF EXISTS "Authorized users can view products" ON public.products;
CREATE POLICY "Store owners and super admins can view products"
ON public.products FOR SELECT TO authenticated
USING (
  public.is_store_owner(store_id, auth.uid())
  OR public.has_platform_role(auth.uid(), 'super_admin')
);

REVOKE SELECT ON public.catalog_category_settings FROM anon;
REVOKE SELECT ON public.customer_roles FROM anon;
REVOKE SELECT ON public.product_category_assignments FROM anon;
REVOKE SELECT ON public.product_group_assignments FROM anon;
REVOKE SELECT ON public.product_groups FROM anon;
REVOKE SELECT ON public.product_role_visibility FROM anon;
