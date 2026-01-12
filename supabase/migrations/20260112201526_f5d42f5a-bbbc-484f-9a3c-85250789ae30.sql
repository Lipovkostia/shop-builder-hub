-- Полная очистка базы данных
-- 1. Удаляем зависимые таблицы первыми (порядок важен из-за foreign keys)

-- Удаляем данные заказов
DELETE FROM order_items;
DELETE FROM orders;

-- Удаляем связи товаров
DELETE FROM product_category_assignments;
DELETE FROM product_group_assignments;
DELETE FROM product_catalog_visibility;
DELETE FROM product_role_visibility;
DELETE FROM role_product_pricing;
DELETE FROM catalog_product_settings;

-- Удаляем группы товаров
DELETE FROM product_groups;

-- Удаляем доступы клиентов к каталогам
DELETE FROM customer_catalog_access;

-- Удаляем роли клиентов
DELETE FROM customer_role_assignments;
DELETE FROM customer_roles;

-- Удаляем клиентов магазинов
DELETE FROM store_customers;

-- Удаляем адреса клиентов
DELETE FROM customer_addresses;

-- Удаляем каталоги
DELETE FROM catalogs;

-- Удаляем товары
DELETE FROM products;

-- Удаляем категории
DELETE FROM categories;

-- Удаляем настройки магазинов
DELETE FROM store_notification_settings;
DELETE FROM store_sync_settings;

-- Удаляем аккаунты МойСклад
DELETE FROM moysklad_accounts;

-- Удаляем слайды лендинга
DELETE FROM landing_slides;

-- Удаляем платформенные роли
DELETE FROM platform_roles;

-- Удаляем магазины
DELETE FROM stores;

-- Удаляем профили пользователей
DELETE FROM profiles;

-- 2. Очистка storage buckets
DELETE FROM storage.objects WHERE bucket_id = 'product-images';
DELETE FROM storage.objects WHERE bucket_id = 'landing-slides';