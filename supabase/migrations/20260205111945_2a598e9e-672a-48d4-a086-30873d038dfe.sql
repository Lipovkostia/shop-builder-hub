-- Add delivery info fields to stores table for retail storefront
ALTER TABLE public.stores
ADD COLUMN IF NOT EXISTS retail_delivery_time TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS retail_delivery_info TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS retail_delivery_free_from NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS retail_delivery_region TEXT DEFAULT NULL;