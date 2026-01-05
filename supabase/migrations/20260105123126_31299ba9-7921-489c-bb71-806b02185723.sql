-- Add column to track synced MoySklad images
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS synced_moysklad_images jsonb DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.products.synced_moysklad_images IS 'Array of MoySklad image URLs that have been synced to our storage';