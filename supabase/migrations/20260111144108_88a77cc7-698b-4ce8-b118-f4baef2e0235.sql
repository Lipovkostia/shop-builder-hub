-- Add MoySklad order sync fields to store_sync_settings
ALTER TABLE public.store_sync_settings 
ADD COLUMN IF NOT EXISTS moysklad_organization_id TEXT,
ADD COLUMN IF NOT EXISTS moysklad_counterparty_id TEXT,
ADD COLUMN IF NOT EXISTS sync_orders_enabled BOOLEAN DEFAULT false;

-- Add MoySklad order ID to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS moysklad_order_id TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_orders_moysklad_order_id ON public.orders(moysklad_order_id) WHERE moysklad_order_id IS NOT NULL;