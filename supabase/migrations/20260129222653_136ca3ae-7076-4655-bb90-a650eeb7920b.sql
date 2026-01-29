-- Add wholesale_custom_domain field for B2B store custom domain binding
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS wholesale_custom_domain TEXT;