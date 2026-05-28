CREATE TABLE IF NOT EXISTS public.image_generation_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid,
  name text NOT NULL,
  prompt_template text NOT NULL,
  default_aspect_ratio text DEFAULT '1:1',
  is_system boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.image_generation_templates TO authenticated;
GRANT ALL ON public.image_generation_templates TO service_role;

ALTER TABLE public.image_generation_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone reads system templates" ON public.image_generation_templates;
CREATE POLICY "Anyone reads system templates"
  ON public.image_generation_templates FOR SELECT TO authenticated
  USING (is_system = true);

DROP POLICY IF EXISTS "Store owners read own templates" ON public.image_generation_templates;
CREATE POLICY "Store owners read own templates"
  ON public.image_generation_templates FOR SELECT TO authenticated
  USING (store_id IS NOT NULL AND public.is_store_owner(store_id, auth.uid()));

DROP POLICY IF EXISTS "Store owners insert own templates" ON public.image_generation_templates;
CREATE POLICY "Store owners insert own templates"
  ON public.image_generation_templates FOR INSERT TO authenticated
  WITH CHECK (store_id IS NOT NULL AND public.is_store_owner(store_id, auth.uid()));

DROP POLICY IF EXISTS "Store owners update own templates" ON public.image_generation_templates;
CREATE POLICY "Store owners update own templates"
  ON public.image_generation_templates FOR UPDATE TO authenticated
  USING (store_id IS NOT NULL AND public.is_store_owner(store_id, auth.uid()))
  WITH CHECK (store_id IS NOT NULL AND public.is_store_owner(store_id, auth.uid()));

DROP POLICY IF EXISTS "Store owners delete own templates" ON public.image_generation_templates;
CREATE POLICY "Store owners delete own templates"
  ON public.image_generation_templates FOR DELETE TO authenticated
  USING (store_id IS NOT NULL AND public.is_store_owner(store_id, auth.uid()));

CREATE TABLE IF NOT EXISTS public.image_generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  product_id uuid NOT NULL,
  source_image_url text,
  prompt text NOT NULL,
  aspect_ratio text,
  width integer,
  height integer,
  result_image_url text,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  cost numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.image_generation_jobs TO authenticated;
GRANT ALL ON public.image_generation_jobs TO service_role;

ALTER TABLE public.image_generation_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Store owners manage own jobs" ON public.image_generation_jobs;
CREATE POLICY "Store owners manage own jobs"
  ON public.image_generation_jobs FOR ALL TO authenticated
  USING (public.is_store_owner(store_id, auth.uid()))
  WITH CHECK (public.is_store_owner(store_id, auth.uid()));

CREATE INDEX IF NOT EXISTS idx_image_gen_jobs_product ON public.image_generation_jobs(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_image_gen_jobs_store ON public.image_generation_jobs(store_id, created_at DESC);

INSERT INTO public.image_generation_templates (store_id, name, prompt_template, default_aspect_ratio, is_system, sort_order)
SELECT * FROM (VALUES
  (NULL::uuid, 'Белый студийный фон', 'Профессиональное фото товара "{product_name}" на чистом белом фоне, студийный свет, мягкие тени, высокая детализация, коммерческая фотография, 4k', '1:1', true, 1),
  (NULL::uuid, 'Лайфстайл в интерьере', 'Товар "{product_name}" в современном уютном интерьере, естественное освещение, лайфстайл фотография, реалистичный, атмосферный', '4:3', true, 2),
  (NULL::uuid, 'На деревянной поверхности', 'Товар "{product_name}" на деревянной поверхности с натуральной текстурой, тёплый свет, деревенский стиль, крупный план', '1:1', true, 3),
  (NULL::uuid, 'Минимализм с тенью', 'Товар "{product_name}" на пастельном фоне с длинной мягкой тенью, минималистичная композиция, центральное расположение', '1:1', true, 4),
  (NULL::uuid, 'Для Avito (контраст)', 'Фото товара "{product_name}" с ярким контрастным фоном, чёткие детали, привлекательное, оптимизировано для маркетплейса', '4:3', true, 5),
  (NULL::uuid, 'Сезонная подача', 'Товар "{product_name}" в сезонной композиции, праздничная атмосфера, декоративные элементы вокруг', '1:1', true, 6),
  (NULL::uuid, 'Макро / детали', 'Макросъёмка товара "{product_name}", крупный план фактуры и деталей, профессиональное освещение, резкость', '3:2', true, 7)
) AS t(store_id, name, prompt_template, default_aspect_ratio, is_system, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.image_generation_templates WHERE is_system = true);
