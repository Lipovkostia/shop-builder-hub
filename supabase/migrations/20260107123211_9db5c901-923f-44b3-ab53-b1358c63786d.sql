-- Allow super admins to view all profiles (including customers)
-- This policy already exists but let's make sure it works correctly

-- First, let's check if there's an issue with the existing policy and recreate it
DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.profiles;

CREATE POLICY "Super admins can view all profiles"
ON public.profiles
FOR SELECT
USING (
  has_platform_role(auth.uid(), 'super_admin'::platform_role)
);

-- Also add policy for super admins to view all store_customers
DROP POLICY IF EXISTS "Super admins can view all store customers" ON public.store_customers;

CREATE POLICY "Super admins can view all store customers"
ON public.store_customers
FOR SELECT
USING (
  has_platform_role(auth.uid(), 'super_admin'::platform_role)
);