-- Удалим дублирующиеся и конфликтующие storage policies
DROP POLICY IF EXISTS "Super admins can upload slide images" ON storage.objects;
DROP POLICY IF EXISTS "Super admins can update slide images" ON storage.objects;
DROP POLICY IF EXISTS "Super admins can delete slide images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view slide images" ON storage.objects;
DROP POLICY IF EXISTS "Everyone can view landing slides images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload landing slides images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update landing slides images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete landing slides images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view landing slide images" ON storage.objects;
DROP POLICY IF EXISTS "Super admins can upload landing slide images" ON storage.objects;
DROP POLICY IF EXISTS "Super admins can update landing slide images" ON storage.objects;
DROP POLICY IF EXISTS "Super admins can delete landing slide images" ON storage.objects;

-- Создаём чистые политики для landing-slides bucket
CREATE POLICY "landing_slides_public_read"
ON storage.objects
FOR SELECT
USING (bucket_id = 'landing-slides');

CREATE POLICY "landing_slides_super_admin_insert"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'landing-slides'
  AND has_platform_role(auth.uid(), 'super_admin'::platform_role)
);

CREATE POLICY "landing_slides_super_admin_update"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'landing-slides'
  AND has_platform_role(auth.uid(), 'super_admin'::platform_role)
);

CREATE POLICY "landing_slides_super_admin_delete"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'landing-slides'
  AND has_platform_role(auth.uid(), 'super_admin'::platform_role)
);