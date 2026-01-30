import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";

export interface ChatMessage {
  id: string;
  store_id: string;
  sender_name: string;
  message: string;
  is_seller: boolean;
  created_at: string;
}

export function useLivestreamChat(storeId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [viewersCount, setViewersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  
  const chatChannelRef = useRef<RealtimeChannel | null>(null);
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);

  // Fetch initial messages
  const fetchMessages = useCallback(async () => {
    if (!storeId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("livestream_chat_messages")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: true })
        .limit(50);

      if (error) throw error;
      setMessages(data || []);
    } catch (err) {
      console.error("Error fetching chat messages:", err);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  // Send message
  const sendMessage = useCallback(async (senderName: string, message: string, isSeller: boolean = false) => {
    if (!storeId || !senderName.trim() || !message.trim()) return false;
    
    setSending(true);
    try {
      const { error } = await supabase
        .from("livestream_chat_messages")
        .insert({
          store_id: storeId,
          sender_name: senderName.trim(),
          message: message.trim(),
          is_seller: isSeller
        });

      if (error) throw error;
      return true;
    } catch (err) {
      console.error("Error sending message:", err);
      return false;
    } finally {
      setSending(false);
    }
  }, [storeId]);

  // Set up realtime subscription
  useEffect(() => {
    if (!storeId) return;

    fetchMessages();

    // Subscribe to new messages
    chatChannelRef.current = supabase
      .channel(`livestream-chat-${storeId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "livestream_chat_messages",
          filter: `store_id=eq.${storeId}`
        },
        (payload) => {
          const newMessage = payload.new as ChatMessage;
          setMessages((prev) => {
            // Prevent duplicates
            if (prev.some(m => m.id === newMessage.id)) return prev;
            // Keep only last 50 messages
            const updated = [...prev, newMessage];
            return updated.slice(-50);
          });
        }
      )
      .subscribe();

    // Set up presence channel for viewer count
    presenceChannelRef.current = supabase.channel(`viewers-${storeId}`);
    
    presenceChannelRef.current
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannelRef.current?.presenceState();
        if (state) {
          setViewersCount(Object.keys(state).length);
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presenceChannelRef.current?.track({
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      chatChannelRef.current?.unsubscribe();
      presenceChannelRef.current?.unsubscribe();
    };
  }, [storeId, fetchMessages]);

  return {
    messages,
    viewersCount,
    loading,
    sending,
    sendMessage,
    refetch: fetchMessages
  };
}
