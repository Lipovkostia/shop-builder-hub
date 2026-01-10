-- Change quantity column from integer to numeric to support fractional values
ALTER TABLE public.order_items 
  ALTER COLUMN quantity TYPE numeric USING quantity::numeric;