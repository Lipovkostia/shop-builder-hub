import { useState, useEffect, useRef, useCallback } from "react";
import { MessageCircle, X, Send, Loader2, Bot, ShoppingCart, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface ChatProduct {
  id: string;
  name: string;
  price: number;
  unit: string;
  images: string[];
  sku?: string;
  quantity?: number;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  products?: ChatProduct[];
}

interface StorefrontChatWidgetProps {
  storeId: string;
  channel: "retail" | "wholesale";
  onProductClick?: (productId: string) => void;
  onAddToCart?: (product: ChatProduct) => void;
}

export function StorefrontChatWidget({ storeId, channel, onProductClick, onAddToCart }: StorefrontChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [botName, setBotName] = useState("Помощник");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const getVisitorId = useCallback(() => {
    const key = `chat_visitor_${storeId}_${channel}`;
    let id = localStorage.getItem(key);
    if (!id) {
      id = `visitor_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(key, id);
    }
    return id;
  }, [storeId, channel]);

  useEffect(() => {
    const saved = localStorage.getItem(`chat_session_${storeId}_${channel}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSessionId(parsed.sessionId);
        setMessages(parsed.messages || []);
      } catch {}
    }
  }, [storeId, channel]);

  useEffect(() => {
    if (sessionId && messages.length > 0) {
      localStorage.setItem(`chat_session_${storeId}_${channel}`, JSON.stringify({ sessionId, messages }));
    }
  }, [sessionId, messages, storeId, channel]);

  useEffect(() => {
    async function checkConfig() {
      try {
        const { data, error } = await supabase.functions.invoke("storefront-chat", {
          body: { action: "get_config", store_id: storeId, channel },
        });
        if (error) throw error;
        setEnabled(data?.enabled || false);
        if (data?.bot_name) setBotName(data.bot_name);
      } catch (err) {
        console.error("Chat config error:", err);
        setEnabled(false);
      } finally {
        setConfigLoading(false);
      }
    }
    if (storeId) checkConfig();
  }, [storeId, channel]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("storefront-chat", {
        body: {
          action: "send_message",
          store_id: storeId,
          session_id: sessionId,
          message: userMsg,
          visitor_id: getVisitorId(),
          channel,
        },
      });
      if (error) throw error;
      if (data?.session_id && !sessionId) setSessionId(data.session_id);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: data?.response || "...",
        products: data?.products?.length > 0 ? data.products : undefined,
      }]);
    } catch (err: any) {
      console.error("Chat error:", err);
      setMessages(prev => [...prev, { role: "assistant", content: "Извините, произошла ошибка. Попробуйте позже." }]);
    } finally {
      setLoading(false);
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setSessionId(null);
    localStorage.removeItem(`chat_session_${storeId}_${channel}`);
  };

  if (configLoading || !enabled) return null;

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all hover:scale-105 flex items-center justify-center"
        >
          <MessageCircle className="h-6 w-6" />
          {messages.length === 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive rounded-full animate-pulse" />
          )}
        </button>
      )}

      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[400px] max-w-[calc(100vw-2rem)] h-[550px] max-h-[calc(100vh-6rem)] bg-background border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground rounded-t-2xl">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">{botName}</p>
                <p className="text-xs opacity-80">Онлайн</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10 h-8 text-xs"
                  onClick={startNewChat}
                >
                  Новый чат
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="text-primary-foreground hover:bg-primary-foreground/10 h-8 w-8"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            {messages.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Bot className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm font-medium">Привет! 👋</p>
                <p className="text-xs mt-1">Напишите ваш вопрос, и я помогу!</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className="mb-3">
                <div className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted text-foreground rounded-bl-md"
                    )}
                  >
                    {msg.content}
                  </div>
                </div>
                {/* Product cards */}
                {msg.products && msg.products.length > 0 && (
                  <div className="mt-2 ml-0 mr-4 space-y-2">
                    {msg.products.map((p) => (
                      <ProductCardRow
                        key={p.id}
                        product={p}
                        onProductClick={onProductClick}
                        onAddToCart={onAddToCart}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex justify-start mb-3">
                <div className="bg-muted px-4 py-2 rounded-2xl rounded-bl-md">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            <div ref={endRef} />
          </ScrollArea>

          {/* Input */}
          <div className="p-3 border-t bg-background">
            <form
              onSubmit={e => { e.preventDefault(); sendMessage(); }}
              className="flex items-center gap-2"
            >
              <Input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Напишите сообщение..."
                className="flex-1 rounded-full text-sm"
                disabled={loading}
              />
              <Button
                type="submit"
                size="icon"
                className="rounded-full h-9 w-9 shrink-0"
                disabled={!input.trim() || loading}
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function ProductCard({
  product,
  onProductClick,
  onAddToCart,
}: {
  product: ChatProduct;
  onProductClick?: (id: string) => void;
  onAddToCart?: (p: ChatProduct) => void;
}) {
  const imgSrc = product.images?.[0];
  const hasStock = (product.quantity ?? 0) > 0;

  return (
    <div
      className="flex-shrink-0 w-[140px] rounded-xl border bg-card overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => onProductClick?.(product.id)}
    >
      {/* Image */}
      <div className="w-full h-[100px] bg-muted flex items-center justify-center overflow-hidden">
        {imgSrc ? (
          <img src={imgSrc} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <Package className="h-8 w-8 text-muted-foreground/40" />
        )}
      </div>
      {/* Info */}
      <div className="p-2">
        <p className="text-xs font-medium line-clamp-2 leading-tight text-foreground">{product.name}</p>
        <div className="flex items-center justify-between mt-1.5 gap-1">
          <span className="text-sm font-bold text-foreground">
            {product.price > 0 ? `${product.price}₽` : "—"}
          </span>
          <span className="text-[10px] text-muted-foreground">/{product.unit}</span>
        </div>
        {!hasStock && <p className="text-[10px] text-destructive mt-0.5">Нет в наличии</p>}
        {onAddToCart && hasStock && product.price > 0 && (
          <Button
            size="sm"
            className="w-full h-7 text-xs mt-1.5 rounded-lg"
            onClick={(e) => {
              e.stopPropagation();
              onAddToCart(product);
            }}
          >
            <ShoppingCart className="h-3 w-3 mr-1" />
            В корзину
          </Button>
        )}
      </div>
    </div>
  );
}
