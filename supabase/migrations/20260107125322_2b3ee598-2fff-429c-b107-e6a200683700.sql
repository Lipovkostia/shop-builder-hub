-- Allow store owners to view ALL their products (including inactive ones)
-- Currently the policy "Anyone can view active products" only allows viewing is_active=true products
-- Store owners need to see all their products for management

-- Drop and recreate the SELECT policy to include store owner access
DROP POLICY IF EXISTS "Store owners can view all their products" ON public.products;

CREATE POLICY "Store owners can view all their products"
ON public.products
FOR SELECT
USING (
  store_id IN (
    SELECT stores.id
    FROM stores
    WHERE stores.owner_id IN (
      SELECT profiles.id
      FROM profiles
      WHERE profiles.user_id = auth.uid()
    )
  )
);