-- Add deleted_at column for soft delete
ALTER TABLE public.products 
ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create index for fast lookup of deleted products
CREATE INDEX idx_products_deleted_at ON public.products(deleted_at);

-- Update RLS policy for customers to only see non-deleted products
DROP POLICY IF EXISTS "Customers can view products from stores they are linked to" ON public.products;
CREATE POLICY "Customers can view products from stores they are linked to" 
ON public.products 
FOR SELECT 
USING (
  deleted_at IS NULL AND (
    is_store_owner(store_id, auth.uid()) OR 
    is_store_customer(store_id, auth.uid())
  )
);

-- Store owners can see all products including deleted ones
DROP POLICY IF EXISTS "Store owners can manage their products" ON public.products;
CREATE POLICY "Store owners can manage their products" 
ON public.products 
FOR ALL 
USING (is_store_owner(store_id, auth.uid()))
WITH CHECK (is_store_owner(store_id, auth.uid()));