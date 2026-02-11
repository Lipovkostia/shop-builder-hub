-- Simple settings table for landing page configuration
CREATE TABLE public.landing_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  catalog_access_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default row
INSERT INTO public.landing_settings (id) VALUES ('default');

-- Enable RLS
ALTER TABLE public.landing_settings ENABLE ROW LEVEL SECURITY;

-- Public can read settings
CREATE POLICY "Public can read landing settings"
  ON public.landing_settings FOR SELECT USING (true);

-- Only super admins can update
CREATE POLICY "Super admins can manage landing settings"
  ON public.landing_settings FOR ALL
  USING (public.has_platform_role(auth.uid(), 'super_admin'::platform_role));