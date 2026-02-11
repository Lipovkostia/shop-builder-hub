
CREATE TABLE public.landing_info_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sort_order INT NOT NULL DEFAULT 0,
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  icon TEXT DEFAULT 'info',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.landing_info_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read active landing info blocks"
ON public.landing_info_blocks FOR SELECT
USING (is_active = true);

CREATE POLICY "Super admins can manage landing info blocks"
ON public.landing_info_blocks FOR ALL
USING (public.has_platform_role(auth.uid(), 'super_admin'::platform_role));

INSERT INTO public.landing_info_blocks (sort_order, title, description, icon) VALUES
(0, 'Быстрый старт', 'Создайте магазин за 2 минуты', 'rocket'),
(1, 'Оптовые каталоги', 'Управляйте прайс-листами', 'list'),
(2, 'Розничная витрина', 'Красивый интернет-магазин', 'store'),
(3, 'Интеграции', 'МойСклад, Telegram, WhatsApp', 'link');
