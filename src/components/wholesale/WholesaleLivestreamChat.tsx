import React, { useState, useEffect, useRef } from "react";
import { useLivestreamChat } from "@/hooks/useLivestreamChat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Send, Users, MessageCircle, Loader2 } from "lucide-react";

interface WholesaleLivestreamChatProps {
  storeId: string;
  className?: string;
}

const GUEST_NAME_KEY = "livestream_guest_name";

export function WholesaleLivestreamChat({ storeId, className }: WholesaleLivestreamChatProps) {
  const { messages, viewersCount, loading, sending, sendMessage } = useLivestreamChat(storeId);
  const [guestName, setGuestName] = useState("");
  const [message, setMessage] = useState("");
  const [isExpanded, setIsExpanded] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load guest name from localStorage
  useEffect(() => {
    const savedName = localStorage.getItem(GUEST_NAME_KEY);
    if (savedName) {
      setGuestName(savedName);
    }
  }, []);

  // Save guest name to localStorage
  useEffect(() => {
    if (guestName.trim()) {
      localStorage.setItem(GUEST_NAME_KEY, guestName.trim());
    }
  }, [guestName]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim() || !message.trim()) return;

    const success = await sendMessage(guestName, message);
    if (success) {
      setMessage("");
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div className={cn(
      "bg-card border rounded-lg overflow-hidden flex flex-col",
      className
    )}>
      {/* Header */}
      <div 
        className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Чат</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="h-3 w-3" />
          <span>{viewersCount}</span>
        </div>
      </div>

      {isExpanded && (
        <>
          {/* Messages */}
          <ScrollArea className="flex-1 max-h-48" ref={scrollRef}>
            <div className="p-3 space-y-2">
              {loading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Напишите первое сообщение!
                </p>
              ) : (
                messages.map((msg) => (
                  <div 
                    key={msg.id}
                    className={cn(
                      "text-sm",
                      msg.is_seller && "bg-primary/10 rounded p-1.5 -mx-1.5"
                    )}
                  >
                    <div className="flex items-baseline gap-1.5">
                      {msg.is_seller && (
                        <span className="text-xs bg-primary text-primary-foreground px-1 rounded">
                          🛒
                        </span>
                      )}
                      <span className={cn(
                        "font-medium text-xs",
                        msg.is_seller ? "text-primary" : "text-muted-foreground"
                      )}>
                        {msg.sender_name}
                      </span>
                      <span className="text-[10px] text-muted-foreground/70">
                        {formatTime(msg.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-foreground mt-0.5 break-words">
                      {msg.message}
                    </p>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Input form */}
          <form onSubmit={handleSubmit} className="p-2 border-t bg-muted/30 space-y-2">
            {!guestName && (
              <Input
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Ваше имя"
                className="h-8 text-sm"
              />
            )}
            <div className="flex gap-1.5">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Сообщение..."
                className="h-8 text-sm flex-1"
                disabled={!guestName.trim() || sending}
              />
              <Button 
                type="submit" 
                size="sm" 
                className="h-8 w-8 p-0"
                disabled={!guestName.trim() || !message.trim() || sending}
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            {guestName && (
              <button
                type="button"
                className="text-[10px] text-muted-foreground hover:underline"
                onClick={() => setGuestName("")}
              >
                Сменить имя ({guestName})
              </button>
            )}
          </form>
        </>
      )}
    </div>
  );
}
