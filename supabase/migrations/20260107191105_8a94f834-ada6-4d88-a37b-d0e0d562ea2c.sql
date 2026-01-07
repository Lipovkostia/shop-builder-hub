-- Create customer_addresses table
CREATE TABLE public.customer_addresses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  label TEXT, -- e.g. "Дом", "Работа"
  is_default BOOLEAN DEFAULT false,
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_customer_addresses_profile_id ON public.customer_addresses(profile_id);

-- Enable RLS
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

-- Users can view their own addresses
CREATE POLICY "Users can view own addresses"
ON public.customer_addresses
FOR SELECT
USING (profile_id IN (
  SELECT id FROM profiles WHERE user_id = auth.uid()
));

-- Users can create their own addresses
CREATE POLICY "Users can create own addresses"
ON public.customer_addresses
FOR INSERT
WITH CHECK (profile_id IN (
  SELECT id FROM profiles WHERE user_id = auth.uid()
));

-- Users can update their own addresses
CREATE POLICY "Users can update own addresses"
ON public.customer_addresses
FOR UPDATE
USING (profile_id IN (
  SELECT id FROM profiles WHERE user_id = auth.uid()
));

-- Users can delete their own addresses
CREATE POLICY "Users can delete own addresses"
ON public.customer_addresses
FOR DELETE
USING (profile_id IN (
  SELECT id FROM profiles WHERE user_id = auth.uid()
));