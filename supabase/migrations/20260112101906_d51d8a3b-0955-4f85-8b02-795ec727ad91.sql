-- Add storage policies for landing-slides bucket
-- Allow super admins to upload images
CREATE POLICY "Super admins can upload landing slides images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'landing-slides' 
  AND has_platform_role(auth.uid(), 'super_admin'::platform_role)
);

-- Allow super admins to update images
CREATE POLICY "Super admins can update landing slides images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'landing-slides' 
  AND has_platform_role(auth.uid(), 'super_admin'::platform_role)
);

-- Allow super admins to delete images
CREATE POLICY "Super admins can delete landing slides images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'landing-slides' 
  AND has_platform_role(auth.uid(), 'super_admin'::platform_role)
);

-- Allow everyone to view images (public bucket)
CREATE POLICY "Everyone can view landing slides images"
ON storage.objects FOR SELECT
USING (bucket_id = 'landing-slides');