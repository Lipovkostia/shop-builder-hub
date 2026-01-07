-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Store owners can view their customer profiles" ON public.profiles;

-- Create a security definer function to check if user is a store owner that has a customer
CREATE OR REPLACE FUNCTION public.is_store_owner_of_customer(customer_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM store_customers sc
    JOIN stores s ON s.id = sc.store_id
    JOIN profiles p ON p.id = s.owner_id
    WHERE sc.profile_id = customer_profile_id
      AND p.user_id = auth.uid()
  )
$$;

-- Now create the policy using the function (avoids recursion)
CREATE POLICY "Store owners can view their customer profiles"
ON public.profiles
FOR SELECT
USING (
  public.is_store_owner_of_customer(id)
);