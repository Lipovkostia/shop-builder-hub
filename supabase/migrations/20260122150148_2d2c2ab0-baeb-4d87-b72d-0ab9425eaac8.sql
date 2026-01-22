-- Orders: allow customers to create/update their own forming draft orders; allow store owners to view/manage
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can insert own forming orders" ON public.orders;
CREATE POLICY "Customers can insert own forming orders"
ON public.orders
FOR INSERT
WITH CHECK (
  status = 'forming'::public.order_status
  AND EXISTS (
    SELECT 1
    FROM public.store_customers sc
    JOIN public.profiles p ON p.id = sc.profile_id
    WHERE sc.id = customer_id
      AND sc.store_id = orders.store_id
      AND p.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Customers can view own orders" ON public.orders;
CREATE POLICY "Customers can view own orders"
ON public.orders
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.store_customers sc
    JOIN public.profiles p ON p.id = sc.profile_id
    WHERE sc.id = customer_id
      AND p.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Customers can update own forming orders" ON public.orders;
CREATE POLICY "Customers can update own forming orders"
ON public.orders
FOR UPDATE
USING (
  status = 'forming'::public.order_status
  AND EXISTS (
    SELECT 1
    FROM public.store_customers sc
    JOIN public.profiles p ON p.id = sc.profile_id
    WHERE sc.id = customer_id
      AND sc.store_id = orders.store_id
      AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.store_customers sc
    JOIN public.profiles p ON p.id = sc.profile_id
    WHERE sc.id = customer_id
      AND sc.store_id = orders.store_id
      AND p.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Store owners can view store orders" ON public.orders;
CREATE POLICY "Store owners can view store orders"
ON public.orders
FOR SELECT
USING (
  public.is_store_owner(store_id, auth.uid())
);

DROP POLICY IF EXISTS "Store owners can update store orders" ON public.orders;
CREATE POLICY "Store owners can update store orders"
ON public.orders
FOR UPDATE
USING (
  public.is_store_owner(store_id, auth.uid())
)
WITH CHECK (
  public.is_store_owner(store_id, auth.uid())
);

-- Order items: allow customers/owners to manage items for their own orders
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can view own order items" ON public.order_items;
CREATE POLICY "Customers can view own order items"
ON public.order_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.orders o
    JOIN public.store_customers sc ON sc.id = o.customer_id
    JOIN public.profiles p ON p.id = sc.profile_id
    WHERE o.id = order_id
      AND p.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Customers can insert own order items" ON public.order_items;
CREATE POLICY "Customers can insert own order items"
ON public.order_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.orders o
    JOIN public.store_customers sc ON sc.id = o.customer_id
    JOIN public.profiles p ON p.id = sc.profile_id
    WHERE o.id = order_id
      AND o.status = 'forming'::public.order_status
      AND p.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Customers can update own order items" ON public.order_items;
CREATE POLICY "Customers can update own order items"
ON public.order_items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.orders o
    JOIN public.store_customers sc ON sc.id = o.customer_id
    JOIN public.profiles p ON p.id = sc.profile_id
    WHERE o.id = order_id
      AND o.status = 'forming'::public.order_status
      AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.orders o
    JOIN public.store_customers sc ON sc.id = o.customer_id
    JOIN public.profiles p ON p.id = sc.profile_id
    WHERE o.id = order_id
      AND o.status = 'forming'::public.order_status
      AND p.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Customers can delete own order items" ON public.order_items;
CREATE POLICY "Customers can delete own order items"
ON public.order_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.orders o
    JOIN public.store_customers sc ON sc.id = o.customer_id
    JOIN public.profiles p ON p.id = sc.profile_id
    WHERE o.id = order_id
      AND o.status = 'forming'::public.order_status
      AND p.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Store owners can view store order items" ON public.order_items;
CREATE POLICY "Store owners can view store order items"
ON public.order_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = order_id
      AND public.is_store_owner(o.store_id, auth.uid())
  )
);

DROP POLICY IF EXISTS "Store owners can manage store order items" ON public.order_items;
CREATE POLICY "Store owners can manage store order items"
ON public.order_items
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = order_id
      AND public.is_store_owner(o.store_id, auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = order_id
      AND public.is_store_owner(o.store_id, auth.uid())
  )
);