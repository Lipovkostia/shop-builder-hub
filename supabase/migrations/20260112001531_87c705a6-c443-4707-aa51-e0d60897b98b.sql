-- Create a public function to get catalog info by access code
-- This function uses SECURITY DEFINER to bypass RLS and allow 
-- unauthenticated users to look up catalog info for registration flow

CREATE OR REPLACE FUNCTION public.get_catalog_by_access_code(_access_code text)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  store_id uuid,
  store_name text,
  store_logo text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    c.id,
    c.name,
    c.description,
    c.store_id,
    s.name as store_name,
    s.logo_url as store_logo
  FROM catalogs c
  JOIN stores s ON s.id = c.store_id
  WHERE c.access_code = _access_code
  LIMIT 1;
$$;