-- Create SECURITY DEFINER helper functions to avoid RLS recursion

-- Function to check if user is store owner
CREATE OR REPLACE FUNCTION public.is_store_owner(_store_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM stores s
    JOIN profiles p ON p.id = s.owner_id
    WHERE s.id = _store_id AND p.user_id = _user_id
  )
$$;

-- Function to check if user has access to a catalog
CREATE OR REPLACE FUNCTION public.has_catalog_access(_catalog_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM customer_catalog_access cca
    JOIN store_customers sc ON sc.id = cca.store_customer_id
    JOIN profiles p ON p.id = sc.profile_id
    WHERE cca.catalog_id = _catalog_id AND p.user_id = _user_id
  )
$$;

-- Function to check if user is a store customer
CREATE OR REPLACE FUNCTION public.is_store_customer(_store_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM store_customers sc
    JOIN profiles p ON p.id = sc.profile_id
    WHERE sc.store_id = _store_id AND p.user_id = _user_id
  )
$$;

-- Function to get store_id from catalog_id (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_catalog_store_id(_catalog_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT store_id FROM catalogs WHERE id = _catalog_id
$$;

-- Update CATALOGS policy
DROP POLICY IF EXISTS "Authorized users can view catalogs" ON catalogs;
CREATE POLICY "Authorized users can view catalogs" ON catalogs
FOR SELECT USING (
  public.is_store_owner(store_id, auth.uid())
  OR public.has_catalog_access(id, auth.uid())
  OR public.has_platform_role(_role := 'super_admin'::public.platform_role, _user_id := auth.uid())
);

-- Update PRODUCTS policy
DROP POLICY IF EXISTS "Authorized users can view products" ON products;
CREATE POLICY "Authorized users can view products" ON products
FOR SELECT USING (
  public.is_store_owner(store_id, auth.uid())
  OR (is_active = true AND public.is_store_customer(store_id, auth.uid()))
  OR public.has_platform_role(_role := 'super_admin'::public.platform_role, _user_id := auth.uid())
);

-- Update PRODUCT_CATALOG_VISIBILITY policy
DROP POLICY IF EXISTS "Authorized users can view product catalog visibility" ON product_catalog_visibility;
CREATE POLICY "Authorized users can view product catalog visibility" ON product_catalog_visibility
FOR SELECT USING (
  public.is_store_owner(public.get_catalog_store_id(catalog_id), auth.uid())
  OR public.has_catalog_access(catalog_id, auth.uid())
  OR public.has_platform_role(_role := 'super_admin'::public.platform_role, _user_id := auth.uid())
);

-- Update CATALOG_PRODUCT_SETTINGS policy
DROP POLICY IF EXISTS "Authorized users can view catalog product settings" ON catalog_product_settings;
CREATE POLICY "Authorized users can view catalog product settings" ON catalog_product_settings
FOR SELECT USING (
  public.is_store_owner(public.get_catalog_store_id(catalog_id), auth.uid())
  OR public.has_catalog_access(catalog_id, auth.uid())
  OR public.has_platform_role(_role := 'super_admin'::public.platform_role, _user_id := auth.uid())
);