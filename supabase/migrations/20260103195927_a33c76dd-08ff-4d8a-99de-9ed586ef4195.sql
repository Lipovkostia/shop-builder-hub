-- Создаем enum для платформенных ролей
CREATE TYPE public.platform_role AS ENUM ('super_admin');

-- Таблица платформенных ролей (глобальные роли для всей платформы)
CREATE TABLE public.platform_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role platform_role NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Включаем RLS
ALTER TABLE public.platform_roles ENABLE ROW LEVEL SECURITY;

-- Security definer функция для проверки платформенной роли (избегаем рекурсии)
CREATE OR REPLACE FUNCTION public.has_platform_role(_user_id uuid, _role platform_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Политики для platform_roles
CREATE POLICY "Super admins can view all platform roles"
ON public.platform_roles
FOR SELECT
TO authenticated
USING (public.has_platform_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can manage platform roles"
ON public.platform_roles
FOR ALL
TO authenticated
USING (public.has_platform_role(auth.uid(), 'super_admin'));

-- Политика: супер-админы могут видеть ВСЕ магазины (не только активные)
CREATE POLICY "Super admins can view all stores"
ON public.stores
FOR SELECT
TO authenticated
USING (public.has_platform_role(auth.uid(), 'super_admin'));

-- Политика: супер-админы могут управлять всеми магазинами
CREATE POLICY "Super admins can manage all stores"
ON public.stores
FOR ALL
TO authenticated
USING (public.has_platform_role(auth.uid(), 'super_admin'));

-- Политика: супер-админы могут видеть все товары
CREATE POLICY "Super admins can view all products"
ON public.products
FOR SELECT
TO authenticated
USING (public.has_platform_role(auth.uid(), 'super_admin'));

-- Политика: супер-админы могут управлять всеми товарами
CREATE POLICY "Super admins can manage all products"
ON public.products
FOR ALL
TO authenticated
USING (public.has_platform_role(auth.uid(), 'super_admin'));

-- Политика: супер-админы могут видеть всех клиентов магазинов
CREATE POLICY "Super admins can view all store customers"
ON public.store_customers
FOR SELECT
TO authenticated
USING (public.has_platform_role(auth.uid(), 'super_admin'));

-- Добавляем счетчики в stores для быстрого отображения
ALTER TABLE public.stores
ADD COLUMN IF NOT EXISTS products_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS customers_count integer DEFAULT 0;

-- Функция для обновления счетчика товаров
CREATE OR REPLACE FUNCTION public.update_store_products_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE stores SET products_count = products_count + 1 WHERE id = NEW.store_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE stores SET products_count = products_count - 1 WHERE id = OLD.store_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.store_id != OLD.store_id THEN
    UPDATE stores SET products_count = products_count - 1 WHERE id = OLD.store_id;
    UPDATE stores SET products_count = products_count + 1 WHERE id = NEW.store_id;
  END IF;
  RETURN NULL;
END;
$$;

-- Функция для обновления счетчика покупателей
CREATE OR REPLACE FUNCTION public.update_store_customers_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE stores SET customers_count = customers_count + 1 WHERE id = NEW.store_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE stores SET customers_count = customers_count - 1 WHERE id = OLD.store_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.store_id != OLD.store_id THEN
    UPDATE stores SET customers_count = customers_count - 1 WHERE id = OLD.store_id;
    UPDATE stores SET customers_count = customers_count + 1 WHERE id = NEW.store_id;
  END IF;
  RETURN NULL;
END;
$$;

-- Триггеры для автоматического обновления счетчиков
CREATE TRIGGER update_products_count_trigger
AFTER INSERT OR DELETE OR UPDATE OF store_id ON public.products
FOR EACH ROW EXECUTE FUNCTION public.update_store_products_count();

CREATE TRIGGER update_customers_count_trigger
AFTER INSERT OR DELETE OR UPDATE OF store_id ON public.store_customers
FOR EACH ROW EXECUTE FUNCTION public.update_store_customers_count();

-- Инициализируем счетчики для существующих данных
UPDATE public.stores s SET 
  products_count = (SELECT COUNT(*) FROM public.products WHERE store_id = s.id),
  customers_count = (SELECT COUNT(*) FROM public.store_customers WHERE store_id = s.id);