
-- Allow customers to delete their own forming orders
CREATE POLICY "Customers can delete own forming orders"
ON public.orders
FOR DELETE
USING (
  status = 'forming'::order_status
  AND EXISTS (
    SELECT 1 FROM store_customers sc
    JOIN profiles p ON p.id = sc.profile_id
    WHERE sc.id = orders.customer_id
    AND p.user_id = auth.uid()
  )
);

-- Clean up stale forming orders that already have a corresponding submitted order
DELETE FROM order_items WHERE order_id IN (
  SELECT o1.id FROM orders o1
  WHERE o1.status = 'forming'
  AND EXISTS (
    SELECT 1 FROM orders o2 
    WHERE o2.customer_id = o1.customer_id 
    AND o2.status != 'forming'
    AND o2.created_at > o1.created_at
  )
);

DELETE FROM orders WHERE status = 'forming'
AND EXISTS (
  SELECT 1 FROM orders o2 
  WHERE o2.customer_id = orders.customer_id 
  AND o2.status != 'forming'
  AND o2.created_at > orders.created_at
);
