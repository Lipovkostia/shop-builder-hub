ALTER TABLE products 
ADD COLUMN is_fixed_price boolean DEFAULT false;

COMMENT ON COLUMN products.is_fixed_price IS 
  'Если true, поле price используется напрямую, игнорируя buy_price и markup';