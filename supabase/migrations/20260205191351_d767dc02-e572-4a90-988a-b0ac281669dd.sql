-- Таблица мастер-товаров (эталонный каталог)
CREATE TABLE public.canonical_products (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  canonical_name text NOT NULL,
  canonical_sku text,
  description text,
  images text[],
  unit text DEFAULT 'кг',
  packaging_type text,
  unit_weight numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Таблица синонимов/алиасов
CREATE TABLE public.product_aliases (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  canonical_product_id uuid NOT NULL REFERENCES public.canonical_products(id) ON DELETE CASCADE,
  alias_type text NOT NULL CHECK (alias_type IN ('name', 'sku', 'barcode', 'moysklad_id')),
  alias_value text NOT NULL,
  source text DEFAULT 'manual' CHECK (source IN ('moysklad', 'excel', 'manual', 'auto')),
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Уникальный индекс: один алиас не может указывать на разные мастер-товары в рамках одного магазина
CREATE UNIQUE INDEX idx_product_aliases_unique ON public.product_aliases(alias_type, alias_value, COALESCE(store_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Индекс для быстрого поиска по алиасам
CREATE INDEX idx_product_aliases_value ON public.product_aliases(alias_value);
CREATE INDEX idx_product_aliases_canonical ON public.product_aliases(canonical_product_id);

-- Добавить поле canonical_product_id в products
ALTER TABLE public.products ADD COLUMN canonical_product_id uuid REFERENCES public.canonical_products(id) ON DELETE SET NULL;

-- Индекс для связи
CREATE INDEX idx_products_canonical ON public.products(canonical_product_id);

-- RLS для canonical_products
ALTER TABLE public.canonical_products ENABLE ROW LEVEL SECURITY;

-- Все могут видеть мастер-каталог
CREATE POLICY "Anyone can view canonical products"
ON public.canonical_products FOR SELECT
USING (true);

-- Только супер-админы могут создавать/редактировать мастер-товары
CREATE POLICY "Super admins can manage canonical products"
ON public.canonical_products FOR ALL
USING (public.has_platform_role(auth.uid(), 'super_admin'));

-- RLS для product_aliases
ALTER TABLE public.product_aliases ENABLE ROW LEVEL SECURITY;

-- Все могут видеть алиасы
CREATE POLICY "Anyone can view product aliases"
ON public.product_aliases FOR SELECT
USING (true);

-- Супер-админы и владельцы магазинов могут управлять алиасами
CREATE POLICY "Super admins can manage all aliases"
ON public.product_aliases FOR ALL
USING (public.has_platform_role(auth.uid(), 'super_admin'));

CREATE POLICY "Store owners can manage their aliases"
ON public.product_aliases FOR ALL
USING (
  store_id IS NOT NULL AND 
  public.is_store_owner(store_id, auth.uid())
);

-- Триггер для updated_at
CREATE TRIGGER update_canonical_products_updated_at
BEFORE UPDATE ON public.canonical_products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();