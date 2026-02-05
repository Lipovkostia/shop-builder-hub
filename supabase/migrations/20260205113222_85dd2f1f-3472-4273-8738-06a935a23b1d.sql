-- Add footer content columns to stores table
ALTER TABLE public.stores
ADD COLUMN IF NOT EXISTS retail_footer_delivery_payment TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS retail_footer_returns TEXT DEFAULT NULL;