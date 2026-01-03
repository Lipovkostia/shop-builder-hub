-- ============================================
-- 1. ГИБКИЕ РОЛИ КЛИЕНТОВ
-- ============================================

-- Таблица ролей клиентов (Оптовик, Розница, VIP и т.д.)
CREATE TABLE public.customer_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Связь покупателей с ролями
CREATE TABLE public.customer_role_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_customer_id uuid NOT NULL REFERENCES public.store_customers(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.customer_roles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(store_customer_id, role_id)
);

-- ============================================
-- 2. РАСШИРЕНИЕ ТОВАРОВ (ГИБКОЕ ЦЕНООБРАЗОВАНИЕ)
-- ============================================

-- Добавляем поля для гибкого ценообразования в products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS unit text DEFAULT 'кг',
  ADD COLUMN IF NOT EXISTS packaging_type text DEFAULT 'piece',
  ADD COLUMN IF NOT EXISTS unit_weight numeric,
  ADD COLUMN IF NOT EXISTS buy_price numeric,
  ADD COLUMN IF NOT EXISTS price_full numeric,
  ADD COLUMN IF NOT EXISTS price_half numeric,
  ADD COLUMN IF NOT EXISTS price_quarter numeric,
  ADD COLUMN IF NOT EXISTS price_portion numeric,
  ADD COLUMN IF NOT EXISTS portion_weight numeric,
  ADD COLUMN IF NOT EXISTS markup_type text DEFAULT 'percent',
  ADD COLUMN IF NOT EXISTS markup_value numeric DEFAULT 0;

-- ============================================
-- 3. НАЦЕНКИ ДЛЯ РОЛЕЙ КЛИЕНТОВ
-- ============================================

-- Наценки/скидки для конкретных ролей на товары
CREATE TABLE public.role_product_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.customer_roles(id) ON DELETE CASCADE,
  markup_type text NOT NULL DEFAULT 'percent',
  markup_value numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, role_id)
);

-- ============================================
-- 4. ВИДИМОСТЬ ТОВАРОВ ДЛЯ РОЛЕЙ
-- ============================================

-- Какие роли видят какие товары (если пусто - видят все)
CREATE TABLE public.product_role_visibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.customer_roles(id) ON DELETE CASCADE,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, role_id)
);

-- ============================================
-- 5. RLS ПОЛИТИКИ
-- ============================================

-- customer_roles
ALTER TABLE public.customer_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store owners can manage customer roles"
ON public.customer_roles
FOR ALL
USING (store_id IN (
  SELECT stores.id FROM stores
  WHERE stores.owner_id IN (
    SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid()
  )
));

CREATE POLICY "Anyone can view customer roles"
ON public.customer_roles
FOR SELECT
USING (true);

-- customer_role_assignments
ALTER TABLE public.customer_role_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store owners can manage role assignments"
ON public.customer_role_assignments
FOR ALL
USING (store_customer_id IN (
  SELECT sc.id FROM store_customers sc
  JOIN stores s ON s.id = sc.store_id
  JOIN profiles p ON p.id = s.owner_id
  WHERE p.user_id = auth.uid()
));

CREATE POLICY "Customers can view own role assignments"
ON public.customer_role_assignments
FOR SELECT
USING (store_customer_id IN (
  SELECT sc.id FROM store_customers sc
  JOIN profiles p ON p.id = sc.profile_id
  WHERE p.user_id = auth.uid()
));

-- role_product_pricing
ALTER TABLE public.role_product_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store owners can manage role pricing"
ON public.role_product_pricing
FOR ALL
USING (product_id IN (
  SELECT products.id FROM products
  JOIN stores ON stores.id = products.store_id
  JOIN profiles ON profiles.id = stores.owner_id
  WHERE profiles.user_id = auth.uid()
));

CREATE POLICY "Anyone can view role pricing"
ON public.role_product_pricing
FOR SELECT
USING (true);

-- product_role_visibility
ALTER TABLE public.product_role_visibility ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store owners can manage product visibility"
ON public.product_role_visibility
FOR ALL
USING (product_id IN (
  SELECT products.id FROM products
  JOIN stores ON stores.id = products.store_id
  JOIN profiles ON profiles.id = stores.owner_id
  WHERE profiles.user_id = auth.uid()
));

CREATE POLICY "Anyone can view visibility settings"
ON public.product_role_visibility
FOR SELECT
USING (true);