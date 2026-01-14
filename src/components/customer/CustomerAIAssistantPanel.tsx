import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sparkles,
  Mic,
  MicOff,
  Send,
  Loader2,
  ShoppingCart,
  RotateCcw,
  AlertCircle,
  Check,
  X,
  Package,
  ChevronDown,
  Plus,
  Minus,
} from "lucide-react";
import { useCustomerAIAssistant, FoundItem } from "@/hooks/useCustomerAIAssistant";
import { Order } from "@/hooks/useOrders";

interface CustomerAIAssistantPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalogId: string | null;
  orders?: Order[];
  onAddToCart: (items: FoundItem[]) => void;
}

function formatPrice(price: number): string {
  return Math.round(price).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ₽";
}

export function CustomerAIAssistantPanel({
  open,
  onOpenChange,
  catalogId,
  orders = [],
  onAddToCart,
}: CustomerAIAssistantPanelProps) {
  const {
    state,
    setState,
    response,
    selectedItems,
    error,
    reset,
    searchProducts,
    searchWithAudio,
    repeatOrder,
    toggleItem,
    selectAll,
    deselectAll,
    updateItemQuantity,
    getSelectedItems,
    getSelectedTotal,
  } = useCustomerAIAssistant(catalogId);

  const [query, setQuery] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [showOrders, setShowOrders] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Reset state when panel closes
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        reset();
        setQuery("");
        setIsRecording(false);
        setShowOrders(false);
      }, 300);
    }
  }, [open, reset]);

  const handleSubmit = useCallback(() => {
    if (query.trim()) {
      searchProducts(query.trim());
    }
  }, [query, searchProducts]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        if (audioBlob.size > 0) {
          await searchWithAudio(audioBlob);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setState("recording");
    } catch (err) {
      console.error("Failed to start recording:", err);
    }
  }, [searchWithAudio, setState]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const handleRepeatOrder = useCallback((orderId: string) => {
    repeatOrder(orderId);
    setShowOrders(false);
  }, [repeatOrder]);

  const handleAddToCart = useCallback(() => {
    const items = getSelectedItems();
    if (items.length > 0) {
      onAddToCart(items);
      onOpenChange(false);
    }
  }, [getSelectedItems, onAddToCart, onOpenChange]);

  // Recent orders (last 5)
  const recentOrders = orders.slice(0, 5);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="px-4 py-3 border-b border-border flex-shrink-0">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="w-5 h-5 text-primary" />
            Умный заказ
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {/* Quick actions */}
            {state === "idle" && recentOrders.length > 0 && (
              <div className="space-y-2">
                <button
                  onClick={() => setShowOrders(!showOrders)}
                  className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium bg-muted/50 hover:bg-muted rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-primary" />
                    <span>Повторить заказ</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showOrders ? 'rotate-180' : ''}`} />
                </button>
                
                {showOrders && (
                  <div className="space-y-1 pl-2 animate-in slide-in-from-top-2 duration-150">
                    {recentOrders.map((order) => (
                      <button
                        key={order.id}
                        onClick={() => handleRepeatOrder(order.id)}
                        className="flex items-center justify-between w-full px-3 py-2 text-sm bg-background hover:bg-muted/50 rounded-lg border border-border transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Package className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="font-medium">{order.order_number}</span>
                          <span className="text-muted-foreground text-xs">
                            {new Date(order.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
                          </span>
                        </div>
                        <span className="text-xs font-medium text-primary">
                          {formatPrice(order.total)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Input area */}
            {(state === "idle" || state === "recording") && (
              <div className="space-y-2">
                <div className="relative">
                  <Textarea
                    placeholder="Сёмга 2кг, форель полкило, икра 3 порции..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="min-h-[80px] pr-24 resize-none"
                    disabled={isRecording}
                  />
                  <div className="absolute bottom-2 right-2 flex gap-1">
                    <Button
                      size="icon"
                      variant={isRecording ? "destructive" : "ghost"}
                      className="h-8 w-8"
                      onMouseDown={startRecording}
                      onMouseUp={stopRecording}
                      onMouseLeave={stopRecording}
                      onTouchStart={startRecording}
                      onTouchEnd={stopRecording}
                    >
                      {isRecording ? (
                        <MicOff className="h-4 w-4" />
                      ) : (
                        <Mic className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      className="h-8 w-8"
                      onClick={handleSubmit}
                      disabled={!query.trim()}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {isRecording && (
                  <div className="flex items-center gap-2 text-sm text-destructive animate-pulse">
                    <div className="w-2 h-2 rounded-full bg-destructive" />
                    Говорите... (отпустите для отправки)
                  </div>
                )}
                
                {/* Example commands */}
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">
                    Напишите или скажите голосом что хотите заказать
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      "Сёмга 2 кг",
                      "Форель полкило",
                      "Три порции икры",
                      "Как в прошлый раз",
                    ].map((example) => (
                      <button
                        key={example}
                        onClick={() => {
                          setQuery(example);
                          searchProducts(example);
                        }}
                        className="px-2.5 py-1 text-xs bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground rounded-full transition-colors"
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Processing state */}
            {state === "processing" && (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Ищу товары...</p>
              </div>
            )}

            {/* Error state */}
            {state === "error" && (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <AlertCircle className="h-8 w-8 text-destructive" />
                <p className="text-sm text-destructive">{error}</p>
                <Button variant="outline" size="sm" onClick={reset}>
                  Попробовать снова
                </Button>
              </div>
            )}

            {/* Results */}
            {state === "confirming" && response && (
              <div className="space-y-3">
                {/* Recognized text */}
                {response.recognized_text && (
                  <div className="p-2 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">Распознано:</p>
                    <p className="text-sm font-medium">"{response.recognized_text}"</p>
                  </div>
                )}

                {/* Summary */}
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{response.summary}</p>
                  {response.unavailableCount > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      {response.unavailableCount} недоступно
                    </Badge>
                  )}
                </div>

                {/* Select all / none */}
                {response.items.length > 0 && (
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" className="text-xs h-7" onClick={selectAll}>
                      Выбрать все
                    </Button>
                    <Button variant="ghost" size="sm" className="text-xs h-7" onClick={deselectAll}>
                      Снять выбор
                    </Button>
                  </div>
                )}

                {/* Items list */}
                <div className="space-y-2">
                  {response.items.map((item, idx) => (
                    <div
                      key={`${item.productId}-${idx}`}
                      className={`p-3 rounded-lg border transition-colors ${
                        item.available 
                          ? selectedItems.has(item.productId)
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-muted-foreground/50'
                          : 'border-border bg-muted/30 opacity-60'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {item.available && (
                          <Checkbox
                            checked={selectedItems.has(item.productId)}
                            onCheckedChange={() => toggleItem(item.productId)}
                            className="mt-0.5"
                          />
                        )}
                        {!item.available && (
                          <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                        )}
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">{item.productName}</span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                              {item.variantLabel}
                            </Badge>
                          </div>
                          
                          {/* Quantity controls */}
                          {item.available && (
                            <div className="flex items-center gap-1 mt-2">
                              <button
                                onClick={() => updateItemQuantity(item.productId, item.quantity - 1)}
                                disabled={item.quantity <= 1}
                                className="w-6 h-6 flex items-center justify-center rounded bg-muted hover:bg-muted/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="w-8 text-center text-sm font-medium tabular-nums">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => updateItemQuantity(item.productId, item.quantity + 1)}
                                className="w-6 h-6 flex items-center justify-center rounded bg-muted hover:bg-muted/80 transition-colors"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                              <span className="text-xs text-muted-foreground ml-2">
                                × {formatPrice(item.unitPrice)}
                                {item.weight && ` · ${Number((item.weight).toFixed(2))} кг`}
                              </span>
                            </div>
                          )}
                          
                          {!item.available && (
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <span>{item.quantity} × {formatPrice(item.unitPrice)}</span>
                              {item.weight && <span>· {item.weight} кг</span>}
                            </div>
                          )}
                          
                          {!item.available && item.suggestion && (
                            <div className="mt-2 p-2 bg-amber-500/10 rounded text-xs">
                              <span className="text-amber-600 dark:text-amber-400">
                                → {item.suggestion.reason}: {item.suggestion.productName}
                              </span>
                            </div>
                          )}
                        </div>
                        
                        <span className={`font-semibold text-sm ${item.available ? 'text-primary' : 'text-muted-foreground line-through'}`}>
                          {formatPrice(item.totalPrice)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Empty state */}
                {response.items.length === 0 && (
                  <div className="text-center py-8">
                    <Package className="w-12 h-12 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">Товары не найдены</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer with actions */}
        {state === "confirming" && response && response.items.length > 0 && (
          <div className="p-4 border-t border-border bg-background flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-sm text-muted-foreground">Выбрано товаров: </span>
                <span className="font-medium">{selectedItems.size}</span>
              </div>
              <div className="text-right">
                <span className="text-sm text-muted-foreground">Итого: </span>
                <span className="text-lg font-bold text-primary">{formatPrice(getSelectedTotal())}</span>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={reset}>
                <X className="w-4 h-4 mr-2" />
                Отмена
              </Button>
              <Button 
                className="flex-1" 
                onClick={handleAddToCart}
                disabled={selectedItems.size === 0}
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                В корзину
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
