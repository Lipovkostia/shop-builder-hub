import React, { useState, useRef, useCallback, useEffect } from "react";
import { 
  Sparkles, 
  Mic, 
  MicOff, 
  Send, 
  EyeOff, 
  Eye, 
  DollarSign, 
  Search, 
  Loader2, 
  Check, 
  X,
  CheckSquare,
  Square,
  AlertCircle,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAIAssistant, FoundProduct, AssistantState } from "@/hooks/useAIAssistant";
import { useCatalogProductSettings } from "@/hooks/useCatalogProductSettings";
import { useStoreCatalogs } from "@/hooks/useStoreCatalogs";
import { useStoreProducts } from "@/hooks/useStoreProducts";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface AIAssistantPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string | null;
}

const quickCommands = [
  { icon: EyeOff, label: "Скрыть товары", prompt: "скрыть " },
  { icon: Eye, label: "Показать товары", prompt: "показать " },
  { icon: DollarSign, label: "Изменить цены", prompt: "установить наценку " },
  { icon: Search, label: "Найти товары", prompt: "найти " },
];

export function AIAssistantPanel({ open, onOpenChange, storeId }: AIAssistantPanelProps) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const {
    state,
    setState,
    response,
    selectedProducts,
    error,
    reset,
    searchProducts,
    searchWithAudio,
    toggleProduct,
    selectAll,
    deselectAll,
  } = useAIAssistant(storeId);

  const { catalogs } = useStoreCatalogs(storeId);
  const { updateProductSettings } = useCatalogProductSettings(storeId);
  const { updateProduct } = useStoreProducts(storeId);

  // Reset on close
  useEffect(() => {
    if (!open) {
      reset();
      setQuery("");
      setIsRecording(false);
      setRecordingTime(0);
    }
  }, [open, reset]);

  // Recording timer
  useEffect(() => {
    if (isRecording) {
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(t => t + 1);
      }, 1000);
    } else {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      setRecordingTime(0);
    }
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, [isRecording]);

  const handleStartRecording = useCallback(async () => {
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
    } catch (err) {
      console.error("Microphone access error:", err);
      toast({
        title: "Нет доступа к микрофону",
        description: "Разрешите доступ к микрофону в настройках браузера",
        variant: "destructive",
      });
    }
  }, [searchWithAudio, toast]);

  const handleStopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const handleSubmit = useCallback(() => {
    if (query.trim()) {
      searchProducts(query.trim());
    }
  }, [query, searchProducts]);

  const handleQuickCommand = useCallback((prompt: string) => {
    setQuery(prompt);
  }, []);

  const handleApply = useCallback(async () => {
    if (!response || selectedProducts.size === 0) return;

    setState("applying" as AssistantState);

    try {
      const defaultCatalog = catalogs.find(c => c.is_default) || catalogs[0];
      const productsToUpdate = response.products.filter(p => selectedProducts.has(p.id));
      let successCount = 0;

      for (const product of productsToUpdate) {
        try {
          if (response.action === "hide" || response.action === "show") {
            const newStatus = response.action === "hide" ? "hidden" : "in_stock";
            
            // Update in all catalogs
            for (const catalog of catalogs) {
              await updateProductSettings(catalog.id, product.id, { status: newStatus });
            }
            successCount++;
          } else if (response.action === "update_prices" && product.new_markup_type && product.new_markup_value) {
            await updateProduct(product.id, {
              markup_type: product.new_markup_type,
              markup_value: product.new_markup_value,
            });
            successCount++;
          }
        } catch (err) {
          console.error(`Failed to update product ${product.id}:`, err);
        }
      }

      toast({
        title: "Готово!",
        description: `${response.action === "hide" ? "Скрыто" : response.action === "show" ? "Показано" : "Обновлено"} ${successCount} товаров`,
      });

      setState("done" as AssistantState);
      setTimeout(() => {
        onOpenChange(false);
      }, 1500);

    } catch (err) {
      console.error("Apply error:", err);
      toast({
        title: "Ошибка",
        description: "Не удалось применить изменения",
        variant: "destructive",
      });
      setState("error" as AssistantState);
    }
  }, [response, selectedProducts, catalogs, updateProductSettings, updateProduct, toast, setState, onOpenChange]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case "hide": return "Скрыть";
      case "show": return "Показать";
      case "update_prices": return "Изменить цены";
      case "find": return "Найдено";
      default: return action;
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case "hide": return EyeOff;
      case "show": return Eye;
      case "update_prices": return DollarSign;
      default: return Search;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Помощник
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Quick commands */}
          {state === "idle" && (
            <div className="px-6 py-4 border-b">
              <p className="text-sm text-muted-foreground mb-3">Быстрые команды:</p>
              <div className="flex flex-wrap gap-2">
                {quickCommands.map((cmd) => (
                  <Button
                    key={cmd.label}
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickCommand(cmd.prompt)}
                    className="text-xs"
                  >
                    <cmd.icon className="h-3 w-3 mr-1" />
                    {cmd.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Input area */}
          {(state === "idle" || state === "error") && (
            <div className="px-6 py-4 border-b space-y-3">
              <Textarea
                placeholder="Опишите что нужно сделать...&#10;Например: 'Скрыть всю рыбу' или 'Установить наценку 25% на сыры'"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                className="min-h-[100px] resize-none"
              />
              
              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant={isRecording ? "destructive" : "outline"}
                  size="icon"
                  onClick={isRecording ? handleStopRecording : handleStartRecording}
                  className={cn(
                    "relative",
                    isRecording && "animate-pulse"
                  )}
                >
                  {isRecording ? (
                    <>
                      <MicOff className="h-4 w-4" />
                      <span className="absolute -top-1 -right-1 text-[10px] bg-destructive text-destructive-foreground rounded px-1">
                        {formatTime(recordingTime)}
                      </span>
                    </>
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                </Button>
                
                <Button 
                  onClick={handleSubmit} 
                  disabled={!query.trim()}
                  className="flex-1"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Выполнить
                </Button>
              </div>
            </div>
          )}

          {/* Processing state */}
          {state === "processing" && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-4">
                <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
                <div>
                  <p className="font-medium">Обрабатываю запрос...</p>
                  <p className="text-sm text-muted-foreground">AI анализирует товары</p>
                </div>
              </div>
            </div>
          )}

          {/* Results / Confirmation */}
          {(state === "confirming" || state === "applying" || state === "done") && response && (
            <>
              {/* Recognized text if from voice */}
              {response.recognized_text && (
                <div className="px-6 py-3 border-b bg-muted/30">
                  <p className="text-sm text-muted-foreground">Распознано:</p>
                  <p className="text-sm font-medium">"{response.recognized_text}"</p>
                </div>
              )}

              {/* Summary */}
              <div className="px-6 py-3 border-b">
                <div className="flex items-center gap-2 mb-2">
                  {React.createElement(getActionIcon(response.action), { className: "h-4 w-4 text-primary" })}
                  <Badge variant="secondary">{getActionLabel(response.action)}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {response.products.length} товаров
                  </span>
                </div>
                <p className="text-sm">{response.summary}</p>
              </div>

              {/* Selection controls */}
              {state === "confirming" && response.products.length > 0 && (
                <div className="px-6 py-2 border-b flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Выбрано: {selectedProducts.size} из {response.products.length}
                  </span>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={selectAll}>
                      <CheckSquare className="h-3 w-3 mr-1" />
                      Все
                    </Button>
                    <Button variant="ghost" size="sm" onClick={deselectAll}>
                      <Square className="h-3 w-3 mr-1" />
                      Снять
                    </Button>
                  </div>
                </div>
              )}

              {/* Products list */}
              <ScrollArea className="flex-1">
                <div className="px-6 py-3 space-y-2">
                  {response.products.map((product) => (
                    <div
                      key={product.id}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-lg border transition-colors",
                        selectedProducts.has(product.id) 
                          ? "bg-primary/5 border-primary/20" 
                          : "bg-muted/30 border-transparent opacity-60"
                      )}
                    >
                      {state === "confirming" && (
                        <Checkbox
                          checked={selectedProducts.has(product.id)}
                          onCheckedChange={() => toggleProduct(product.id)}
                          className="mt-0.5"
                        />
                      )}
                      {state === "done" && (
                        <Check className="h-4 w-4 text-green-500 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{product.name}</p>
                        <p className="text-xs text-muted-foreground">{product.reason}</p>
                        {product.current_status && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Текущий статус: {product.current_status === "hidden" ? "Скрыт" : "Активен"}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}

                  {response.products.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Товары не найдены</p>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Action buttons */}
              {state === "confirming" && response.products.length > 0 && (
                <div className="px-6 py-4 border-t flex gap-2">
                  <Button variant="outline" onClick={reset} className="flex-1">
                    <X className="h-4 w-4 mr-2" />
                    Отмена
                  </Button>
                  <Button 
                    onClick={handleApply} 
                    disabled={selectedProducts.size === 0}
                    className="flex-1"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    {response.action === "hide" ? "Скрыть" : response.action === "show" ? "Показать" : "Применить"} ({selectedProducts.size})
                  </Button>
                </div>
              )}

              {state === "applying" && (
                <div className="px-6 py-4 border-t">
                  <Button disabled className="w-full">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Применяю изменения...
                  </Button>
                </div>
              )}

              {state === "done" && (
                <div className="px-6 py-4 border-t">
                  <div className="flex items-center justify-center gap-2 text-green-600">
                    <Check className="h-5 w-5" />
                    <span className="font-medium">Готово!</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
