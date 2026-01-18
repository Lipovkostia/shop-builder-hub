-- Create store_activity_logs table for tracking user actions
CREATE TABLE public.store_activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  entity_name TEXT,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX idx_store_activity_logs_store_id ON public.store_activity_logs(store_id);
CREATE INDEX idx_store_activity_logs_created_at ON public.store_activity_logs(created_at DESC);
CREATE INDEX idx_store_activity_logs_action_type ON public.store_activity_logs(action_type);
CREATE INDEX idx_store_activity_logs_entity_type ON public.store_activity_logs(entity_type);

-- Enable Row Level Security
ALTER TABLE public.store_activity_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Store owners can view their store's activity logs
CREATE POLICY "Store owners can view their store activity logs"
ON public.store_activity_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.stores
    WHERE stores.id = store_activity_logs.store_id
    AND stores.owner_id = (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
  )
);

-- Policy: Store owners can insert activity logs for their store
CREATE POLICY "Store owners can insert activity logs"
ON public.store_activity_logs
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.stores
    WHERE stores.id = store_activity_logs.store_id
    AND stores.owner_id = (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
  )
);

-- Policy: Super admins can view all activity logs (correct argument order)
CREATE POLICY "Super admins can view all activity logs"
ON public.store_activity_logs
FOR SELECT
USING (
  public.has_platform_role(auth.uid(), 'super_admin'::platform_role)
);