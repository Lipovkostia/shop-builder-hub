-- Create table for landing page slides
CREATE TABLE public.landing_slides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  image_url TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.landing_slides ENABLE ROW LEVEL SECURITY;

-- Super admins can do everything
CREATE POLICY "Super admins can manage slides"
ON public.landing_slides
FOR ALL
USING (has_platform_role(auth.uid(), 'super_admin'::platform_role));

-- Everyone can view active slides (for the landing page)
CREATE POLICY "Everyone can view active slides"
ON public.landing_slides
FOR SELECT
USING (is_active = true);

-- Create trigger for updating updated_at
CREATE TRIGGER update_landing_slides_updated_at
BEFORE UPDATE ON public.landing_slides
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert initial slides
INSERT INTO public.landing_slides (title, image_url, sort_order, is_active) VALUES
('Создавайте уникальные каталоги для разных покупателей', NULL, 1, true),
('Покупатель всегда видит индивидуальную актуальную цену и наличие', NULL, 2, true),
('Заказ упаковкой или штучно в 1 клик', NULL, 3, true),
('Повторить заказ в 1 клик', NULL, 4, true);