CREATE OR REPLACE FUNCTION public.get_catalog_products_public(_access_code text)
 RETURNS TABLE(product_id uuid, product_name text, product_description text, product_price numeric, product_compare_price numeric, product_images text[], product_unit text, product_sku text, product_quantity numeric, product_slug text, product_packaging_type text, product_portion_weight numeric, product_price_portion numeric, product_price_quarter numeric, product_price_half numeric, product_price_full numeric, product_unit_weight numeric, catalog_id uuid, catalog_name text, catalog_description text, store_id uuid, store_name text, store_logo text, store_description text, setting_markup_type text, setting_markup_value numeric, setting_status text, setting_categories text[], setting_portion_prices jsonb, category_id uuid, category_name text, category_slug text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as product_id,
    p.name as product_name,
    p.description as product_description,
    -- Calculate price: if price > 0 use it, otherwise calculate from buy_price + catalog markup
    CASE 
      WHEN p.price > 0 THEN p.price::numeric
      WHEN p.buy_price IS NOT NULL AND p.buy_price > 0 THEN
        CASE 
          WHEN COALESCE(cps.markup_type, 'percent') = 'percent' THEN 
            (p.buy_price * (1 + COALESCE(cps.markup_value, 0::numeric) / 100))::numeric
          WHEN cps.markup_type = 'fixed' OR cps.markup_type = 'rubles' THEN 
            (p.buy_price + COALESCE(cps.markup_value, 0::numeric))::numeric
          ELSE p.buy_price::numeric
        END
      ELSE 0::numeric
    END as product_price,
    p.compare_price::numeric as product_compare_price,
    p.images as product_images,
    p.unit as product_unit,
    p.sku as product_sku,
    p.quantity::numeric as product_quantity,
    p.slug as product_slug,
    p.packaging_type as product_packaging_type,
    p.portion_weight::numeric as product_portion_weight,
    p.price_portion::numeric as product_price_portion,
    p.price_quarter::numeric as product_price_quarter,
    p.price_half::numeric as product_price_half,
    p.price_full::numeric as product_price_full,
    p.unit_weight::numeric as product_unit_weight,
    cat.id as catalog_id,
    cat.name as catalog_name,
    cat.description as catalog_description,
    s.id as store_id,
    s.name as store_name,
    s.logo_url as store_logo,
    s.description as store_description,
    cps.markup_type as setting_markup_type,
    cps.markup_value::numeric as setting_markup_value,
    cps.status as setting_status,
    cps.categories as setting_categories,
    cps.portion_prices as setting_portion_prices,
    c.id as category_id,
    c.name as category_name,
    c.slug as category_slug
  FROM products p
  INNER JOIN product_catalog_visibility pcv ON pcv.product_id = p.id
  INNER JOIN catalogs cat ON cat.id = pcv.catalog_id
  INNER JOIN stores s ON s.id = cat.store_id
  LEFT JOIN catalog_product_settings cps ON cps.product_id = p.id AND cps.catalog_id = cat.id
  LEFT JOIN categories c ON c.id = p.category_id
  WHERE cat.access_code = _access_code
    AND p.is_active = true
    AND COALESCE(cps.status, 'visible') != 'hidden'
  ORDER BY p.name;
END;
$function$;