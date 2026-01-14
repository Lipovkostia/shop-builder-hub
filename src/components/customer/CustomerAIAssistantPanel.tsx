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
      <SheetContent 
        side="bottom" 
        className="h-[85vh] rounded-t-2xl p-0 flex flex-col w-full max-w-[100dvw] overflow-x-hidden"
        style={{ maxWidth: '100dvw', width: '100%' }}
      >
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

        <ScrollArea className="flex-1 w-full max-w-full overflow-x-hidden">
          <div className="p-4 space-y-4 w-full max-w-full overflow-x-hidden">
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
              <div className="space-y-3 w-full max-w-full overflow-x-hidden">
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

                {/* Items list - CSS Grid mobile-first with image */}
                <div className="space-y-2 w-full max-w-full overflow-hidden">
                  {response.items.map((item, idx) => (
                    <div
                      key={`${item.productId}-${idx}`}
                      className={`w-full max-w-full p-3 rounded-lg border transition-colors overflow-hidden box-border ${
                        item.available 
                          ? selectedItems.has(item.productId)
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-muted-foreground/30'
                          : 'border-border/50 bg-muted/20 opacity-50'
                      }`}
                      onClick={() => item.available && toggleItem(item.productId)}
                    >
                      {/* Main grid: Image + Content */}
                      <div className="grid grid-cols-[44px_minmax(0,1fr)] gap-3 items-start w-full">
                        {/* Product image */}
                        <div className="w-11 h-11 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                          {item.imageUrl ? (
                            <img 
                              src={item.imageUrl} 
                              alt={item.productName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="w-5 h-5 text-muted-foreground/40" />
                            </div>
                          )}
                        </div>
                        
                        {/* Content column */}
                        <div className="min-w-0 flex flex-col gap-1.5">
                          {/* Row 1: Checkbox + Name */}
                          <div className="flex items-start gap-2">
                            <div className="flex items-center justify-center pt-0.5 flex-shrink-0">
                              {item.available ? (
                                <Checkbox
                                  checked={selectedItems.has(item.productId)}
                                  onCheckedChange={() => toggleItem(item.productId)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              ) : (
                                <AlertCircle className="w-4 h-4 text-destructive/70" />
                              )}
                            </div>
                            <span className="font-medium text-sm truncate min-w-0 leading-tight">
                              {item.productName}
                            </span>
                          </div>
                          
                          {/* Row 2: Badge + Price per unit + Volume */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 whitespace-nowrap">
                              {item.variantLabel}
                            </Badge>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {item.portionVolume > 0 && item.unitLabel !== 'шт' && (
                                <>{item.portionVolume} {item.unitLabel} · </>
                              )}
                              {formatPrice(item.pricePerUnit)}/{item.unitLabel}
                            </span>
                          </div>
                          
                          {/* Row 3: Quantity controls + Total price/weight */}
                          {item.available ? (
                            <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 items-center mt-0.5">
                              {/* Quantity controls */}
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateItemQuantity(item.productId, item.quantity - 1);
                                  }}
                                  disabled={item.quantity <= 1}
                                  className="w-7 h-7 flex items-center justify-center rounded-md bg-muted/80 hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <span className="w-7 text-center text-sm font-medium tabular-nums">
                                  {item.quantity}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateItemQuantity(item.productId, item.quantity + 1);
                                  }}
                                  className="w-7 h-7 flex items-center justify-center rounded-md bg-muted/80 hover:bg-muted transition-colors"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              
                              {/* Total price + weight + Remove */}
                              <div className="flex items-center justify-end gap-1 min-w-0">
                                <div className="text-right">
                                  <div className="font-bold text-primary text-sm tabular-nums whitespace-nowrap">
                                    {formatPrice(item.totalPrice)}
                                  </div>
                                  {item.totalWeight > 0 && item.unitLabel !== 'шт' && (
                                    <div className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">
                                      {item.totalWeight} {item.unitLabel}
                                    </div>
                                  )}
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeItem(item.productId);
                                  }}
                                  className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between mt-0.5">
                              <span className="text-xs text-muted-foreground">
                                {item.quantity} × {formatPrice(item.unitPrice)}
                              </span>
                              <div className="flex items-center gap-1">
                                <span className="font-medium text-sm text-muted-foreground line-through tabular-nums whitespace-nowrap">
                                  {formatPrice(item.totalPrice)}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeItem(item.productId);
                                  }}
                                  className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Suggestion for unavailable items */}
                      {!item.available && item.suggestion && (
                        <div className="mt-2 ml-[56px] px-2 py-1 bg-amber-500/10 rounded text-[11px] text-amber-600 dark:text-amber-400 truncate">
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

        {/* Footer with actions - CSS Grid mobile-first */}
        {(state === "confirming" || hasExistingItems) && response && response.items.length > 0 && (
          <div className="px-4 py-3 border-t border-border bg-background flex-shrink-0 space-y-2 w-full max-w-full overflow-hidden box-border">
            {/* Stats row - CSS Grid */}
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 items-center text-sm w-full">
              <span className="text-muted-foreground truncate min-w-0">
                Выбрано: <span className="font-medium text-foreground">{selectedItems.size}</span>
              </span>
              <span className="whitespace-nowrap flex-shrink-0">
                <span className="text-muted-foreground">Итого: </span>
                <span className="font-bold text-primary tabular-nums">{formatPrice(getSelectedTotal())}</span>
              </span>
            </div>
            
            {/* Buttons row - CSS Grid */}
            <div className="grid grid-cols-[auto_1fr_1fr] gap-2 w-full">
              <Button variant="ghost" size="sm" className="h-9 px-2" onClick={handleClearList}>
                <Trash2 className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" className="h-9 min-w-0" onClick={() => onOpenChange(false)}>
                <span className="truncate">Свернуть</span>
              </Button>
              <Button 
                size="sm"
                className="h-9 min-w-0" 
                onClick={handleAddToCart}
                disabled={selectedItems.size === 0}
              >
                <ShoppingCart className="w-4 h-4 mr-1 flex-shrink-0" />
                <span className="truncate">В корзину</span>
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
