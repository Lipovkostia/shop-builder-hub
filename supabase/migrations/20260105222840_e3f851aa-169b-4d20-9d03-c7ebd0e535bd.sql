-- Create table for MoySklad accounts per store
CREATE TABLE public.moysklad_accounts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    login TEXT NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    last_sync TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.moysklad_accounts ENABLE ROW LEVEL SECURITY;

-- Create policies for store owners
CREATE POLICY "Store owners can manage their MoySklad accounts"
ON public.moysklad_accounts
FOR ALL
USING (
    store_id IN (
        SELECT stores.id
        FROM stores
        JOIN profiles ON profiles.id = stores.owner_id
        WHERE profiles.user_id = auth.uid()
    )
);

-- Create trigger for updated_at
CREATE TRIGGER update_moysklad_accounts_updated_at
BEFORE UPDATE ON public.moysklad_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create table for sync settings per store
CREATE TABLE public.store_sync_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID NOT NULL UNIQUE REFERENCES public.stores(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT false,
    interval_minutes INTEGER NOT NULL DEFAULT 30,
    last_sync_time TIMESTAMP WITH TIME ZONE,
    next_sync_time TIMESTAMP WITH TIME ZONE,
    field_mapping JSONB NOT NULL DEFAULT '{"buyPrice": true, "price": false, "quantity": true, "name": false, "description": false, "unit": false}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.store_sync_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for store owners
CREATE POLICY "Store owners can manage their sync settings"
ON public.store_sync_settings
FOR ALL
USING (
    store_id IN (
        SELECT stores.id
        FROM stores
        JOIN profiles ON profiles.id = stores.owner_id
        WHERE profiles.user_id = auth.uid()
    )
);