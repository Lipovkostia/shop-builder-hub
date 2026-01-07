-- Add policy for super admins to view all profiles
CREATE POLICY "Super admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (has_platform_role(auth.uid(), 'super_admin'));

-- Add policy for super admins to update all profiles
CREATE POLICY "Super admins can update all profiles" 
ON public.profiles 
FOR UPDATE 
USING (has_platform_role(auth.uid(), 'super_admin'));