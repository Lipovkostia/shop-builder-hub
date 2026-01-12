-- Create storage bucket for landing slides images
INSERT INTO storage.buckets (id, name, public)
VALUES ('landing-slides', 'landing-slides', true);

-- Allow super admins to upload, update, delete images
CREATE POLICY "Super admins can upload slide images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'landing-slides' 
  AND has_platform_role(auth.uid(), 'super_admin'::platform_role)
);

CREATE POLICY "Super admins can update slide images"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'landing-slides' 
  AND has_platform_role(auth.uid(), 'super_admin'::platform_role)
);

CREATE POLICY "Super admins can delete slide images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'landing-slides' 
  AND has_platform_role(auth.uid(), 'super_admin'::platform_role)
);

-- Everyone can view slide images (public bucket)
CREATE POLICY "Anyone can view slide images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'landing-slides');