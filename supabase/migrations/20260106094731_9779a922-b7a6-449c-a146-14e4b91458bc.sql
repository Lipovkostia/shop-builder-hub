-- Add access_code to catalogs
ALTER TABLE catalogs ADD COLUMN access_code TEXT UNIQUE;

-- Generate access codes for existing catalogs
UPDATE catalogs SET access_code = substr(md5(random()::text), 1, 8) WHERE access_code IS NULL;

-- Make access_code NOT NULL after populating
ALTER TABLE catalogs ALTER COLUMN access_code SET NOT NULL;
ALTER TABLE catalogs ALTER COLUMN access_code SET DEFAULT substr(md5(random()::text), 1, 8);

-- Create customer catalog access table
CREATE TABLE public.customer_catalog_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_customer_id UUID NOT NULL REFERENCES store_customers(id) ON DELETE CASCADE,
  catalog_id UUID NOT NULL REFERENCES catalogs(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(store_customer_id, catalog_id)
);

-- Enable RLS
ALTER TABLE public.customer_catalog_access ENABLE ROW LEVEL SECURITY;

-- RLS policies for customer_catalog_access
CREATE POLICY "Customers can view own catalog access"
ON public.customer_catalog_access
FOR SELECT
USING (
  store_customer_id IN (
    SELECT sc.id FROM store_customers sc
    JOIN profiles p ON p.id = sc.profile_id
    WHERE p.user_id = auth.uid()
  )
);

CREATE POLICY "Store owners can manage catalog access"
ON public.customer_catalog_access
FOR ALL
USING (
  catalog_id IN (
    SELECT c.id FROM catalogs c
    JOIN stores s ON s.id = c.store_id
    JOIN profiles p ON p.id = s.owner_id
    WHERE p.user_id = auth.uid()
  )
);

CREATE POLICY "Customers can insert own catalog access"
ON public.customer_catalog_access
FOR INSERT
WITH CHECK (
  store_customer_id IN (
    SELECT sc.id FROM store_customers sc
    JOIN profiles p ON p.id = sc.profile_id
    WHERE p.user_id = auth.uid()
  )
);

-- Index for faster lookups
CREATE INDEX idx_customer_catalog_access_customer ON customer_catalog_access(store_customer_id);
CREATE INDEX idx_customer_catalog_access_catalog ON customer_catalog_access(catalog_id);
CREATE INDEX idx_catalogs_access_code ON catalogs(access_code);