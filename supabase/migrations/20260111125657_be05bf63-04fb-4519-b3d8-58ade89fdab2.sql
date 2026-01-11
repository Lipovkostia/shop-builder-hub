-- Create table for store notification settings
CREATE TABLE public.store_notification_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  notification_email TEXT,
  email_enabled BOOLEAN DEFAULT false,
  notification_telegram TEXT,
  telegram_enabled BOOLEAN DEFAULT false,
  notification_whatsapp TEXT,
  whatsapp_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(store_id)
);

-- Enable RLS
ALTER TABLE public.store_notification_settings ENABLE ROW LEVEL SECURITY;

-- RLS policy for store owners to view their notification settings
CREATE POLICY "Store owners can view notification settings"
  ON public.store_notification_settings FOR SELECT
  USING (store_id IN (
    SELECT stores.id FROM stores
    JOIN profiles ON profiles.id = stores.owner_id
    WHERE profiles.user_id = auth.uid()
  ));

-- RLS policy for store owners to insert notification settings
CREATE POLICY "Store owners can insert notification settings"
  ON public.store_notification_settings FOR INSERT
  WITH CHECK (store_id IN (
    SELECT stores.id FROM stores
    JOIN profiles ON profiles.id = stores.owner_id
    WHERE profiles.user_id = auth.uid()
  ));

-- RLS policy for store owners to update notification settings
CREATE POLICY "Store owners can update notification settings"
  ON public.store_notification_settings FOR UPDATE
  USING (store_id IN (
    SELECT stores.id FROM stores
    JOIN profiles ON profiles.id = stores.owner_id
    WHERE profiles.user_id = auth.uid()
  ));

-- RLS policy for store owners to delete notification settings
CREATE POLICY "Store owners can delete notification settings"
  ON public.store_notification_settings FOR DELETE
  USING (store_id IN (
    SELECT stores.id FROM stores
    JOIN profiles ON profiles.id = stores.owner_id
    WHERE profiles.user_id = auth.uid()
  ));

-- Create trigger for updating updated_at
CREATE TRIGGER update_store_notification_settings_updated_at
  BEFORE UPDATE ON public.store_notification_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();