-- Add contact fields for retail mobile header
ALTER TABLE public.stores 
  ADD COLUMN IF NOT EXISTS retail_phone text,
  ADD COLUMN IF NOT EXISTS telegram_username text,
  ADD COLUMN IF NOT EXISTS whatsapp_phone text;