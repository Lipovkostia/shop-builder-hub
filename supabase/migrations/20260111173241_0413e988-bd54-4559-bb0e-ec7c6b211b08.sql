-- =============================================
-- SECURITY FIX: Restrict access to catalogs, products, and related tables
-- Only authenticated store customers can view data
-- =============================================

-- 1. CATALOGS - Remove public access, allow only authorized users
DROP POLICY IF EXISTS "Anyone can view catalogs" ON catalogs;

CREATE POLICY "Authorized users can view catalogs" ON catalogs
FOR SELECT USING (
  -- Store owner can view all their catalogs
  store_id IN (
    SELECT stores.id FROM stores
    JOIN profiles ON profiles.id = stores.owner_id
    WHERE profiles.user_id = auth.uid()
  )
  OR
  -- Customer can view only catalogs they have access to
  id IN (
    SELECT cca.catalog_id FROM customer_catalog_access cca
    JOIN store_customers sc ON sc.id = cca.store_customer_id
    JOIN profiles p ON p.id = sc.profile_id
    WHERE p.user_id = auth.uid()
  )
  OR
  -- Super admins can view everything (using named parameters)
  public.has_platform_role(_role := 'super_admin'::public.platform_role, _user_id := auth.uid())
);

-- 2. PRODUCTS - Remove public access, allow only store customers
DROP POLICY IF EXISTS "Anyone can view active products" ON products;

CREATE POLICY "Authorized users can view products" ON products
FOR SELECT USING (
  -- Store owner can view all their products
  store_id IN (
    SELECT stores.id FROM stores
    JOIN profiles ON profiles.id = stores.owner_id
    WHERE profiles.user_id = auth.uid()
  )
  OR
  -- Registered store customers can view active products
  (
    is_active = true
    AND store_id IN (
      SELECT sc.store_id FROM store_customers sc
      JOIN profiles p ON p.id = sc.profile_id
      WHERE p.user_id = auth.uid()
    )
  )
  OR
  -- Super admins can view everything
  public.has_platform_role(_role := 'super_admin'::public.platform_role, _user_id := auth.uid())
);

-- 3. PRODUCT_CATALOG_VISIBILITY - Remove public access
DROP POLICY IF EXISTS "Anyone can view product catalog visibility" ON product_catalog_visibility;

CREATE POLICY "Authorized users can view product catalog visibility" ON product_catalog_visibility
FOR SELECT USING (
  -- Store owner
  catalog_id IN (
    SELECT c.id FROM catalogs c
    JOIN stores s ON s.id = c.store_id
    JOIN profiles p ON p.id = s.owner_id
    WHERE p.user_id = auth.uid()
  )
  OR
  -- Customers with catalog access
  catalog_id IN (
    SELECT cca.catalog_id FROM customer_catalog_access cca
    JOIN store_customers sc ON sc.id = cca.store_customer_id
    JOIN profiles p ON p.id = sc.profile_id
    WHERE p.user_id = auth.uid()
  )
  OR
  public.has_platform_role(_role := 'super_admin'::public.platform_role, _user_id := auth.uid())
);

-- 4. CATALOG_PRODUCT_SETTINGS - Remove public access
DROP POLICY IF EXISTS "Anyone can view catalog product settings" ON catalog_product_settings;

CREATE POLICY "Authorized users can view catalog product settings" ON catalog_product_settings
FOR SELECT USING (
  -- Store owner
  catalog_id IN (
    SELECT c.id FROM catalogs c
    JOIN stores s ON s.id = c.store_id
    JOIN profiles p ON p.id = s.owner_id
    WHERE p.user_id = auth.uid()
  )
  OR
  -- Customers with catalog access
  catalog_id IN (
    SELECT cca.catalog_id FROM customer_catalog_access cca
    JOIN store_customers sc ON sc.id = cca.store_customer_id
    JOIN profiles p ON p.id = sc.profile_id
    WHERE p.user_id = auth.uid()
  )
  OR
  public.has_platform_role(_role := 'super_admin'::public.platform_role, _user_id := auth.uid())
);