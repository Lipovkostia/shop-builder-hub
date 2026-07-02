-- Homepage hero / contact / side-block settings.
CREATE TABLE IF NOT EXISTS public.homepage_hero_settings (
  id text PRIMARY KEY DEFAULT 'default',
  site_name text,
  hero_badge text,
  hero_title text,
  hero_subtitle text,
  hero_image_url text,
  hero_overlay_opacity numeric DEFAULT 0.55,
  cta_primary_label text,
  cta_primary_url text,
  cta_secondary_label text,
  cta_secondary_url text,
  contact_phone text,
  contact_phone_label text,
  contact_telegram_url text,
  contact_telegram_label text,
  contact_whatsapp_url text,
  contact_email text,
  contact_address text,
  side_blocks jsonb DEFAULT '[]'::jsonb,
  featured_product_id uuid,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

GRANT SELECT ON public.homepage_hero_settings TO anon, authenticated;
GRANT ALL ON public.homepage_hero_settings TO service_role;

ALTER TABLE public.homepage_hero_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read hero settings" ON public.homepage_hero_settings;
CREATE POLICY "Public read hero settings"
  ON public.homepage_hero_settings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "SuperAdmin manage hero settings" ON public.homepage_hero_settings;
CREATE POLICY "SuperAdmin manage hero settings"
  ON public.homepage_hero_settings FOR ALL
  TO authenticated
  USING (public.has_platform_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_platform_role(auth.uid(), 'super_admin'));

INSERT INTO public.homepage_hero_settings (
  id, site_name, hero_badge, hero_title, hero_subtitle,
  cta_primary_label, cta_primary_url,
  cta_secondary_label, cta_secondary_url,
  contact_phone, contact_phone_label,
  contact_telegram_url, contact_telegram_label,
  contact_email, side_blocks
) VALUES (
  'default',
  '9999999999',
  'Опт, розница и предложения поставщиков',
  'Торговая витрина 9999999999',
  'Собирайте ассортимент, находите поставщиков и переходите к покупке через проверенные розничные точки.',
  'Смотреть товары', '#catalog',
  'Связаться', 'https://t.me/zakaz9999999999_bot',
  '+79999999999', '+7 999 999-99-99',
  'https://t.me/zakaz9999999999_bot', 'Telegram-бот',
  'info@9999999999.ru',
  '[]'::jsonb
) ON CONFLICT (id) DO NOTHING;
