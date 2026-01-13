-- 1. Добавляем поля для гостевых заказов в таблицу orders
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS guest_name text,
ADD COLUMN IF NOT EXISTS guest_phone text,
ADD COLUMN IF NOT EXISTS is_guest_order boolean DEFAULT false;

-- 2. Создаём функцию для публичного доступа к товарам каталога по access_code
CREATE OR REPLACE FUNCTION public.get_catalog_products_public(_access_code text)
RETURNS TABLE (
  product_id uuid,
  product_name text,
  product_description text,
  product_price numeric,
  product_compare_price numeric,
  product_images text[],
  product_unit text,
  product_sku text,
  product_quantity integer,
  product_slug text,
  product_packaging_type text,
  product_portion_weight numeric,
  product_price_portion numeric,
  product_price_quarter numeric,
  product_price_half numeric,
  product_price_full numeric,
  catalog_id uuid,
  catalog_name text,
  catalog_description text,
  store_id uuid,
  store_name text,
  store_logo text,
  store_description text,
  setting_markup_type text,
  setting_markup_value numeric,
  setting_status text,
  setting_categories text[],
  setting_portion_prices jsonb,
  category_id uuid,
  category_name text,
  category_slug text
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as product_id,
    p.name as product_name,
    p.description as product_description,
    p.price as product_price,
    p.compare_price as product_compare_price,
    p.images as product_images,
    p.unit as product_unit,
    p.sku as product_sku,
    p.quantity as product_quantity,
    p.slug as product_slug,
    p.packaging_type as product_packaging_type,
    p.portion_weight as product_portion_weight,
    p.price_portion as product_price_portion,
    p.price_quarter as product_price_quarter,
    p.price_half as product_price_half,
    p.price_full as product_price_full,
    c.id as catalog_id,
    c.name as catalog_name,
    c.description as catalog_description,
    s.id as store_id,
    s.name as store_name,
    s.logo_url as store_logo,
    s.description as store_description,
    cps.markup_type as setting_markup_type,
    cps.markup_value as setting_markup_value,
    cps.status as setting_status,
    cps.categories as setting_categories,
    cps.portion_prices as setting_portion_prices,
    cat.id as category_id,
    cat.name as category_name,
    cat.slug as category_slug
  FROM catalogs c
  INNER JOIN stores s ON s.id = c.store_id
  INNER JOIN product_catalog_visibility pcv ON pcv.catalog_id = c.id
  INNER JOIN products p ON p.id = pcv.product_id AND p.is_active = true
  LEFT JOIN catalog_product_settings cps ON cps.catalog_id = c.id AND cps.product_id = p.id
  LEFT JOIN categories cat ON cat.id = p.category_id
  WHERE c.access_code = _access_code
    AND (cps.status IS NULL OR cps.status != 'hidden');
END;
$$;

-- 3. RLS политика для создания гостевых заказов
CREATE POLICY "Anyone can create guest orders"
ON public.orders
FOR INSERT
WITH CHECK (is_guest_order = true AND customer_id IS NULL);

-- 4. RLS политика для создания позиций гостевых заказов
CREATE POLICY "Anyone can create guest order items"
ON public.order_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.id = order_items.order_id 
    AND orders.is_guest_order = true
  )
);

-- 5. Политика для просмотра гостевых заказов владельцем магазина (уже есть общая, но убедимся)
-- Владельцы уже могут видеть все заказы своего магазина через существующую политику