
-- Add sidebar banner field to stores
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS retail_sidebar_banner_url text;

-- Create product reviews table
CREATE TABLE public.product_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  reviewer_name text NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  is_approved boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can read approved reviews
CREATE POLICY "Anyone can read approved reviews"
  ON public.product_reviews FOR SELECT
  USING (is_approved = true);

-- Store owners can read all reviews for their store
CREATE POLICY "Store owners can read all reviews"
  ON public.product_reviews FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.stores WHERE id = store_id AND owner_id IN (
        SELECT id FROM public.profiles WHERE user_id = auth.uid()
      )
    )
  );

-- Anyone can insert reviews (guest reviews allowed)
CREATE POLICY "Anyone can insert reviews"
  ON public.product_reviews FOR INSERT
  WITH CHECK (true);

-- Store owners can update reviews (approve/delete)
CREATE POLICY "Store owners can update reviews"
  ON public.product_reviews FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.stores WHERE id = store_id AND owner_id IN (
        SELECT id FROM public.profiles WHERE user_id = auth.uid()
      )
    )
  );

-- Store owners can delete reviews
CREATE POLICY "Store owners can delete reviews"
  ON public.product_reviews FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.stores WHERE id = store_id AND owner_id IN (
        SELECT id FROM public.profiles WHERE user_id = auth.uid()
      )
    )
  );

-- Index for fast lookups
CREATE INDEX idx_product_reviews_product_id ON public.product_reviews(product_id);
CREATE INDEX idx_product_reviews_store_id ON public.product_reviews(store_id);
