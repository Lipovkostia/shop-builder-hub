-- Add retail_name column to stores table for custom store name display
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS retail_name text;