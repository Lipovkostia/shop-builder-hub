-- Уникальный индекс: sku должен быть уникален только внутри одного магазина
-- Разные магазины могут использовать одинаковые SKU
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_sku_per_store 
ON public.products (store_id, sku) 
WHERE sku IS NOT NULL AND deleted_at IS NULL;