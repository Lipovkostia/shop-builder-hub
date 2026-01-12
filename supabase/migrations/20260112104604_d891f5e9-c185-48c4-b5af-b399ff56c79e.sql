-- Drop existing restrictive policies for landing-slides bucket
DROP POLICY IF EXISTS "Super admins can upload landing slides images" ON storage.objects;
DROP POLICY IF EXISTS "Super admins can update landing slides images" ON storage.objects;
DROP POLICY IF EXISTS "Super admins can delete landing slides images" ON storage.objects;

-- Create simpler policies that allow authenticated users to manage landing-slides bucket
CREATE POLICY "Authenticated users can upload landing slides images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'landing-slides'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can update landing slides images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'landing-slides'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can delete landing slides images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'landing-slides'
  AND auth.role() = 'authenticated'
);