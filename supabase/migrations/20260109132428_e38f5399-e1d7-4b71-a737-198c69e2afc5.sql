-- Create table for product category assignments (many-to-many relationship)
CREATE TABLE public.product_category_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, category_id)
);

-- Enable RLS
ALTER TABLE public.product_category_assignments ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view product category assignments"
ON public.product_category_assignments
FOR SELECT
USING (true);

CREATE POLICY "Store owners can manage product category assignments"
ON public.product_category_assignments
FOR ALL
USING (
  product_id IN (
    SELECT products.id
    FROM products
    JOIN stores ON stores.id = products.store_id
    JOIN profiles ON profiles.id = stores.owner_id
    WHERE profiles.user_id = auth.uid()
  )
);