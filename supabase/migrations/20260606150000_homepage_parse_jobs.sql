CREATE TABLE IF NOT EXISTS public.homepage_parse_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  host text,
  firecrawl_job_id text,
  status text NOT NULL DEFAULT 'starting',
  total integer NOT NULL DEFAULT 0,
  completed integer NOT NULL DEFAULT 0,
  ingested integer NOT NULL DEFAULT 0,
  duplicates integer NOT NULL DEFAULT 0,
  last_error text,
  stop_requested boolean NOT NULL DEFAULT false,
  created_by uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.homepage_parse_jobs TO authenticated;
GRANT ALL ON public.homepage_parse_jobs TO service_role;
ALTER TABLE public.homepage_parse_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "homepage_parse_jobs super admin all" ON public.homepage_parse_jobs;
CREATE POLICY "homepage_parse_jobs super admin all"
  ON public.homepage_parse_jobs FOR ALL TO authenticated
  USING (public.has_platform_role(auth.uid(), 'super_admin'::public.platform_role))
  WITH CHECK (public.has_platform_role(auth.uid(), 'super_admin'::public.platform_role));
CREATE INDEX IF NOT EXISTS homepage_parse_jobs_status_idx ON public.homepage_parse_jobs(status, started_at DESC);
DROP TRIGGER IF EXISTS homepage_parse_jobs_updated_at ON public.homepage_parse_jobs;
CREATE TRIGGER homepage_parse_jobs_updated_at
  BEFORE UPDATE ON public.homepage_parse_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
