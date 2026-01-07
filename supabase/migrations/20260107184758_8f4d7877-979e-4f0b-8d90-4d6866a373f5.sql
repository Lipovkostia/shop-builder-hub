-- Drop existing restrictive policy and recreate as permissive
DROP POLICY IF EXISTS "Anyone can view catalogs" ON public.catalogs;

CREATE POLICY "Anyone can view catalogs"
ON public.catalogs
FOR SELECT
TO public
USING (true);