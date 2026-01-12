-- Полная очистка всех таблиц в правильном порядке (учитывая foreign keys)

-- Сначала таблицы с зависимостями от других
TRUNCATE TABLE public.customer_catalog_access CASCADE;
TRUNCATE TABLE public.catalog_product_settings CASCADE;
TRUNCATE TABLE public.product_catalog_visibility CASCADE;
TRUNCATE TABLE public.product_category_assignments CASCADE;
TRUNCATE TABLE public.product_group_assignments CASCADE;
TRUNCATE TABLE public.product_role_visibility CASCADE;
TRUNCATE TABLE public.role_product_pricing CASCADE;
TRUNCATE TABLE public.customer_role_assignments CASCADE;
TRUNCATE TABLE public.customer_roles CASCADE;
TRUNCATE TABLE public.store_customers CASCADE;
TRUNCATE TABLE public.order_items CASCADE;
TRUNCATE TABLE public.orders CASCADE;
TRUNCATE TABLE public.products CASCADE;
TRUNCATE TABLE public.product_groups CASCADE;
TRUNCATE TABLE public.categories CASCADE;
TRUNCATE TABLE public.catalogs CASCADE;
TRUNCATE TABLE public.customer_addresses CASCADE;
TRUNCATE TABLE public.landing_slides CASCADE;
TRUNCATE TABLE public.moysklad_accounts CASCADE;
TRUNCATE TABLE public.store_notification_settings CASCADE;
TRUNCATE TABLE public.store_sync_settings CASCADE;
TRUNCATE TABLE public.stores CASCADE;
TRUNCATE TABLE public.platform_roles CASCADE;
TRUNCATE TABLE public.profiles CASCADE;