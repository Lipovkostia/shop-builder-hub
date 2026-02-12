
-- Table to store megacatalog access password (platform-level setting)
CREATE TABLE public.megacatalog_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  password_hash text NOT NULL DEFAULT 'Lipovkostia1989!)',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.megacatalog_settings ENABLE ROW LEVEL SECURITY;

-- Only super admins can read/update
CREATE POLICY "Super admins can read megacatalog settings"
ON public.megacatalog_settings FOR SELECT
TO authenticated
USING (public.has_platform_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can update megacatalog settings"
ON public.megacatalog_settings FOR UPDATE
TO authenticated
USING (public.has_platform_role(auth.uid(), 'super_admin'));

-- Insert default row
INSERT INTO public.megacatalog_settings (password_hash) VALUES ('Lipovkostia1989!)');

-- Function to verify megacatalog password (accessible to all authenticated users)
CREATE OR REPLACE FUNCTION public.verify_megacatalog_password(_password text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.megacatalog_settings
    WHERE password_hash = _password
    LIMIT 1
  );
$$;

GRANT EXECUTE ON FUNCTION public.verify_megacatalog_password(text) TO authenticated;
