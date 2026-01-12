-- Create storage policies for landing-slides bucket
-- Allow anyone to view landing slide images (public bucket)
CREATE POLICY "Anyone can view landing slide images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'landing-slides');

-- Allow super admins to upload landing slide images
CREATE POLICY "Super admins can upload landing slide images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'landing-slides' 
  AND has_platform_role(auth.uid(), 'super_admin'::platform_role)
);

-- Allow super admins to update landing slide images
CREATE POLICY "Super admins can update landing slide images"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'landing-slides' 
  AND has_platform_role(auth.uid(), 'super_admin'::platform_role)
);

-- Allow super admins to delete landing slide images
CREATE POLICY "Super admins can delete landing slide images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'landing-slides' 
  AND has_platform_role(auth.uid(), 'super_admin'::platform_role)
);