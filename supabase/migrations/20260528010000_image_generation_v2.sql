ALTER TABLE public.image_generation_templates
  ADD COLUMN IF NOT EXISTS reference_image_url text;

ALTER TABLE public.image_generation_jobs
  ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_image_gen_jobs_product_status
  ON public.image_generation_jobs(product_id, status, hidden, created_at DESC);
