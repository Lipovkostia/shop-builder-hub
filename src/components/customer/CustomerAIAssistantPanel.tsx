import React, { useState, useRef, useCallback } from "react";
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
  X,
  Package,
  ChevronDown,
  Plus,
  Minus,
  Trash2,
} from "lucide-react";
import { useCustomerAIAssistant, FoundItem } from "@/hooks/useCustomerAIAssistant";
import { Order } from "@/hooks/useOrders";

interface CustomerAIAssistantPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assistant: ReturnType<typeof useCustomerAIAssistant>;
  orders?: Order[];
  onAddToCart: (items: FoundItem[]) => void;
}

function formatPrice(price: number): string {
  return Math.round(price).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ₽";
}

export function CustomerAIAssistantPanel({
  open,
  onOpenChange,
  assistant,
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
    removeItem,
    getSelectedItems,
    getSelectedTotal,
  } = assistant;

  const [query, setQuery] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [showOrders, setShowOrders] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Check if we have existing items (for append mode)
  const hasExistingItems = (response?.items?.length ?? 0) > 0;

  const handleSubmit = useCallback(() => {
    if (query.trim()) {
      // Use append mode if we already have items
      searchProducts(query.trim(), hasExistingItems);
      setQuery("");
    }
  }, [query, searchProducts, hasExistingItems]);

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
          await searchWithAudio(audioBlob, hasExistingItems);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setState("recording");
    } catch (err) {
      console.error("Failed to start recording:", err);
    }
  }, [searchWithAudio, setState, hasExistingItems]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const handleRepeatOrder = useCallback((orderId: string) => {
    repeatOrder(orderId, hasExistingItems);
    setShowOrders(false);
  }, [repeatOrder, hasExistingItems]);

  const handleAddToCart = useCallback(() => {
    const items = getSelectedItems();
    if (items.length > 0) {
      onAddToCart(items);
      reset(); // Reset only after successful add to cart
      onOpenChange(false);
    }
  }, [getSelectedItems, onAddToCart, onOpenChange, reset]);

  const handleClearList = useCallback(() => {
    reset();
    setQuery("");
  }, [reset]);

  // Recent orders (last 5)
  const recentOrders = orders.slice(0, 5);

  // Show input in idle, recording, or confirming states
  const showInput = state === "idle" || state === "recording" || state === "confirming";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="px-4 py-3 border-b border-border flex-shrink-0">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="w-5 h-5 text-primary" />
            Умный заказ
            {hasExistingItems && (
              <Badge variant="secondary" className="ml-2">
                {response?.items?.length} товар{(response?.items?.length ?? 0) === 1 ? '' : (response?.items?.length ?? 0) < 5 ? 'а' : 'ов'}
              </Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 overflow-hidden">
          <div className="p-4 space-y-4 overflow-hidden">
            {/* Quick actions - repeat order */}
            {(state === "idle" || state === "confirming") && recentOrders.length > 0 && (
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

            {/* Input area - show in idle, recording, and confirming states */}
            {showInput && (
              <div className="space-y-2">
                <div className="relative">
                  <Textarea
                    placeholder={hasExistingItems ? "Добавить ещё..." : "Сёмга 2кг, форель полкило, икра 3 порции..."}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="min-h-[60px] pr-24 resize-none"
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
                
                {/* Example commands - only show when no items yet */}
                {!hasExistingItems && (
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
                            searchProducts(example, false);
                          }}
                          className="px-2.5 py-1 text-xs bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground rounded-full transition-colors"
                        >
                          {example}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Processing state */}
            {state === "processing" && (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
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
                  <div className="px-3 py-2 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      Запрос: <span className="text-foreground">"{response.recognized_text}"</span>
                    </p>
                  </div>
                )}

                {/* Summary with unavailable badge */}
                <div className="flex items-start gap-2">
                  <p className="text-sm font-medium flex-1 line-clamp-2">{response.summary}</p>
                  {response.unavailableCount > 0 && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 flex-shrink-0 whitespace-nowrap">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      {response.unavailableCount} недост.
                    </Badge>
                  )}
                </div>

                {/* Select all / none */}
                {response.items.length > 0 && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={selectAll}>
                      Выбрать все
                    </Button>
                    <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={deselectAll}>
                      Снять выбор
                    </Button>
                  </div>
                )}

                {/* Items list - compact cards */}
                <div className="space-y-1.5 overflow-hidden">
                  {response.items.map((item, idx) => (
                    <div
                      key={`${item.productId}-${idx}`}
                      className={`p-2.5 rounded-lg border transition-colors overflow-hidden ${
                        item.available 
                          ? selectedItems.has(item.productId)
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-muted-foreground/30'
                          : 'border-border/50 bg-muted/20 opacity-50'
                      }`}
                      onClick={() => item.available && toggleItem(item.productId)}
                    >
                      {/* Row 1: Checkbox + Name + Variant badge */}
                      <div className="flex items-center gap-2 min-w-0">
                        {item.available ? (
                          <Checkbox
                            checked={selectedItems.has(item.productId)}
                            onCheckedChange={() => toggleItem(item.productId)}
                            onClick={(e) => e.stopPropagation()}
                            className="flex-shrink-0"
                          />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-destructive/70 flex-shrink-0" />
                        )}
                        
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <div className="flex items-center gap-1.5 max-w-full">
                            <span className="font-medium text-sm truncate block">{item.productName}</span>
                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 flex-shrink-0 whitespace-nowrap">
                              {item.variantLabel}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      
                      {/* Row 2: Quantity controls + Price + Remove */}
                      {item.available ? (
                        <div className="flex items-center justify-between mt-1.5 ml-6 gap-2">
                          <div className="flex items-center gap-1.5 min-w-0 flex-shrink">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateItemQuantity(item.productId, item.quantity - 1);
                              }}
                              disabled={item.quantity <= 1}
                              className="w-5 h-5 flex items-center justify-center rounded bg-muted/80 hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                            >
                              <Minus className="w-2.5 h-2.5" />
                            </button>
                            <span className="w-6 text-center text-xs font-medium tabular-nums flex-shrink-0">
                              {item.quantity}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateItemQuantity(item.productId, item.quantity + 1);
                              }}
                              className="w-5 h-5 flex items-center justify-center rounded bg-muted/80 hover:bg-muted transition-colors flex-shrink-0"
                            >
                              <Plus className="w-2.5 h-2.5" />
                            </button>
                            <span className="text-[11px] text-muted-foreground truncate">
                              × {formatPrice(item.unitPrice)}
                              {item.weight != null && item.weight > 0 && (
                                <span> · {Number(item.weight.toFixed(2))} кг</span>
                              )}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="font-semibold text-sm text-primary tabular-nums">
                              {formatPrice(item.totalPrice)}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeItem(item.productId);
                              }}
                              className="w-5 h-5 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between mt-1.5 ml-6 gap-2">
                          <span className="text-[11px] text-muted-foreground truncate">
                            {item.quantity} × {formatPrice(item.unitPrice)}
                          </span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="font-semibold text-sm text-muted-foreground line-through tabular-nums">
                              {formatPrice(item.totalPrice)}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeItem(item.productId);
                              }}
                              className="w-5 h-5 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )}
                      
                      {/* Suggestion for unavailable items */}
                      {!item.available && item.suggestion && (
                        <div className="mt-1.5 ml-6 px-2 py-1 bg-amber-500/10 rounded text-[11px] text-amber-600 dark:text-amber-400 line-clamp-1">
                          → {item.suggestion.productName}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Empty state */}
                {response.items.length === 0 && (
                  <div className="text-center py-6">
                    <Package className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="text-sm text-muted-foreground">Товары не найдены</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer with actions - compact */}
        {(state === "confirming" || hasExistingItems) && response && response.items.length > 0 && (
          <div className="px-4 py-3 border-t border-border bg-background flex-shrink-0 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Выбрано: <span className="font-medium text-foreground">{selectedItems.size}</span>
              </span>
              <span>
                <span className="text-muted-foreground">Итого: </span>
                <span className="font-bold text-primary">{formatPrice(getSelectedTotal())}</span>
              </span>
            </div>
            
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="h-9 px-3" onClick={handleClearList}>
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Очистить
              </Button>
              <Button variant="outline" size="sm" className="flex-1 h-9" onClick={() => onOpenChange(false)}>
                Свернуть
              </Button>
              <Button 
                size="sm"
                className="flex-1 h-9" 
                onClick={handleAddToCart}
                disabled={selectedItems.size === 0}
              >
                <ShoppingCart className="w-3.5 h-3.5 mr-1.5" />
                В корзину
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
