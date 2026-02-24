-- Allow super admins to manage store_customers (insert/delete)
CREATE POLICY "Super admins can manage all store customers"
ON public.store_customers
FOR ALL
USING (has_platform_role(auth.uid(), 'super_admin'::platform_role))
WITH CHECK (has_platform_role(auth.uid(), 'super_admin'::platform_role));