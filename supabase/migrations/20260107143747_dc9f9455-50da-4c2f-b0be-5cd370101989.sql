-- Allow super admins to view store_customers when fetching with stores relation
-- Current policy only allows SELECT, need to ensure it works with joins

-- First, let's check if store owners can view profiles of their customers
-- Add policy for store owners to see their customer profiles
CREATE POLICY "Store owners can view their customer profiles"
ON public.profiles
FOR SELECT
USING (
  id IN (
    SELECT sc.profile_id 
    FROM store_customers sc
    JOIN stores s ON s.id = sc.store_id
    WHERE s.owner_id IN (
      SELECT p.id FROM profiles p WHERE p.user_id = auth.uid()
    )
  )
);