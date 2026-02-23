
ALTER TABLE public.stores
ADD COLUMN IF NOT EXISTS retail_marquee_text text,
ADD COLUMN IF NOT EXISTS retail_marquee_speed integer DEFAULT 30,
ADD COLUMN IF NOT EXISTS retail_marquee_text_color text DEFAULT '#ffffff',
ADD COLUMN IF NOT EXISTS retail_marquee_bg_color text DEFAULT '#16a34a';
