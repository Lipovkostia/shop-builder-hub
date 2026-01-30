-- Add livestream fields to stores table
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS wholesale_livestream_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS wholesale_livestream_url TEXT,
ADD COLUMN IF NOT EXISTS wholesale_livestream_title TEXT;

-- Create livestream chat messages table
CREATE TABLE IF NOT EXISTS public.livestream_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
  sender_name TEXT NOT NULL,
  message TEXT NOT NULL,
  is_seller BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for fast message retrieval
CREATE INDEX IF NOT EXISTS idx_livestream_chat_store_time 
  ON public.livestream_chat_messages(store_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.livestream_chat_messages ENABLE ROW LEVEL SECURITY;

-- Public read policy for chat messages
CREATE POLICY "Anyone can read chat messages" 
  ON public.livestream_chat_messages 
  FOR SELECT 
  USING (true);

-- Public insert policy for chat messages
CREATE POLICY "Anyone can send chat messages" 
  ON public.livestream_chat_messages 
  FOR INSERT 
  WITH CHECK (true);

-- Store owners can delete messages in their store
CREATE POLICY "Store owners can delete chat messages" 
  ON public.livestream_chat_messages 
  FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM public.stores s
      JOIN public.profiles p ON p.id = s.owner_id
      WHERE s.id = store_id AND p.user_id = auth.uid()
    )
  );

-- Enable realtime for chat messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.livestream_chat_messages;