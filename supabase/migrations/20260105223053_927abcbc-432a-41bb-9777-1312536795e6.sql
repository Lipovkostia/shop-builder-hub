-- Add missing fields for MoySklad integration to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS moysklad_id TEXT,
ADD COLUMN IF NOT EXISTS moysklad_account_id UUID REFERENCES public.moysklad_accounts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS auto_sync BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

-- Add index for faster lookup by moysklad_id
CREATE INDEX IF NOT EXISTS idx_products_moysklad_id ON public.products(moysklad_id) WHERE moysklad_id IS NOT NULL;

-- Add index for source filtering
CREATE INDEX IF NOT EXISTS idx_products_source ON public.products(source);