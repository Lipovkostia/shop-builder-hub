-- Create product_groups table
CREATE TABLE public.product_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for store_id
CREATE INDEX idx_product_groups_store_id ON public.product_groups(store_id);

-- Enable RLS
ALTER TABLE public.product_groups ENABLE ROW LEVEL SECURITY;

-- Anyone can view product groups
CREATE POLICY "Anyone can view product groups"
ON public.product_groups
FOR SELECT
USING (true);

-- Store owners can manage product groups
CREATE POLICY "Store owners can manage product groups"
ON public.product_groups
FOR ALL
USING (store_id IN (
  SELECT stores.id FROM stores
  WHERE stores.owner_id IN (
    SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid()
  )
));

-- Create product_group_assignments junction table
CREATE TABLE public.product_group_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.product_groups(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, group_id)
);

-- Create indexes for performance
CREATE INDEX idx_product_group_assignments_product_id ON public.product_group_assignments(product_id);
CREATE INDEX idx_product_group_assignments_group_id ON public.product_group_assignments(group_id);

-- Enable RLS
ALTER TABLE public.product_group_assignments ENABLE ROW LEVEL SECURITY;

-- Anyone can view product group assignments
CREATE POLICY "Anyone can view product group assignments"
ON public.product_group_assignments
FOR SELECT
USING (true);

-- Store owners can manage product group assignments
CREATE POLICY "Store owners can manage product group assignments"
ON public.product_group_assignments
FOR ALL
USING (product_id IN (
  SELECT products.id
  FROM products
  JOIN stores ON stores.id = products.store_id
  JOIN profiles ON profiles.id = stores.owner_id
  WHERE profiles.user_id = auth.uid()
));