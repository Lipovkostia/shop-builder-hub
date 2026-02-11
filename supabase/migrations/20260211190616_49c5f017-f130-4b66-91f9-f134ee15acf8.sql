
-- Exchange requests table
CREATE TABLE public.exchange_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Exchange request items
CREATE TABLE public.exchange_request_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.exchange_requests(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  custom_name TEXT,
  unit TEXT NOT NULL DEFAULT 'шт',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Exchange responses
CREATE TABLE public.exchange_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.exchange_requests(id) ON DELETE CASCADE,
  responder_store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Exchange response items (prices)
CREATE TABLE public.exchange_response_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  response_id UUID NOT NULL REFERENCES public.exchange_responses(id) ON DELETE CASCADE,
  request_item_id UUID NOT NULL REFERENCES public.exchange_request_items(id) ON DELETE CASCADE,
  price NUMERIC NOT NULL DEFAULT 0
);

-- Indexes
CREATE INDEX idx_exchange_requests_store ON public.exchange_requests(store_id);
CREATE INDEX idx_exchange_requests_status ON public.exchange_requests(status);
CREATE INDEX idx_exchange_request_items_request ON public.exchange_request_items(request_id);
CREATE INDEX idx_exchange_responses_request ON public.exchange_responses(request_id);
CREATE INDEX idx_exchange_response_items_response ON public.exchange_response_items(response_id);

-- Triggers for updated_at
CREATE TRIGGER update_exchange_requests_updated_at
  BEFORE UPDATE ON public.exchange_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.exchange_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_response_items ENABLE ROW LEVEL SECURITY;

-- RLS: exchange_requests
-- All authenticated users can read active requests
CREATE POLICY "Authenticated users can read active exchange requests"
  ON public.exchange_requests FOR SELECT
  USING (auth.uid() IS NOT NULL AND (status = 'active' OR EXISTS (
    SELECT 1 FROM stores s JOIN profiles p ON p.id = s.owner_id WHERE s.id = exchange_requests.store_id AND p.user_id = auth.uid()
  )));

-- Store owners can insert their own requests
CREATE POLICY "Store owners can create exchange requests"
  ON public.exchange_requests FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM stores s JOIN profiles p ON p.id = s.owner_id WHERE s.id = store_id AND p.user_id = auth.uid()
  ));

-- Store owners can update their own requests
CREATE POLICY "Store owners can update own exchange requests"
  ON public.exchange_requests FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM stores s JOIN profiles p ON p.id = s.owner_id WHERE s.id = store_id AND p.user_id = auth.uid()
  ));

-- RLS: exchange_request_items
CREATE POLICY "Authenticated users can read exchange request items"
  ON public.exchange_request_items FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Store owners can insert exchange request items"
  ON public.exchange_request_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM exchange_requests er JOIN stores s ON s.id = er.store_id JOIN profiles p ON p.id = s.owner_id
    WHERE er.id = request_id AND p.user_id = auth.uid()
  ));

-- RLS: exchange_responses
-- Visible to request author and response author
CREATE POLICY "Response visible to request and response authors"
  ON public.exchange_responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM stores s JOIN profiles p ON p.id = s.owner_id WHERE s.id = responder_store_id AND p.user_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM exchange_requests er JOIN stores s ON s.id = er.store_id JOIN profiles p ON p.id = s.owner_id
      WHERE er.id = request_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Store owners can create exchange responses"
  ON public.exchange_responses FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM stores s JOIN profiles p ON p.id = s.owner_id WHERE s.id = responder_store_id AND p.user_id = auth.uid()
  ));

-- RLS: exchange_response_items
CREATE POLICY "Response items visible to request and response authors"
  ON public.exchange_response_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM exchange_responses er WHERE er.id = response_id AND (
      EXISTS (SELECT 1 FROM stores s JOIN profiles p ON p.id = s.owner_id WHERE s.id = er.responder_store_id AND p.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM exchange_requests req JOIN stores s ON s.id = req.store_id JOIN profiles p ON p.id = s.owner_id WHERE req.id = er.request_id AND p.user_id = auth.uid())
    )
  ));

CREATE POLICY "Store owners can create exchange response items"
  ON public.exchange_response_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM exchange_responses er JOIN stores s ON s.id = er.responder_store_id JOIN profiles p ON p.id = s.owner_id
    WHERE er.id = response_id AND p.user_id = auth.uid()
  ));
