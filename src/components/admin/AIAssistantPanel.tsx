import React, { useState, useRef, useCallback, useEffect } from "react";
import { getSupportedAudioMimeType } from "@/lib/audioUtils";
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
  FileSpreadsheet,
  Upload,
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
import { 
  previewPriceListExcel, 
  parseProductsWithMapping, 
  importProductsToCatalog, 
  PriceListImportProgress,
  ExcelPreviewData,
} from "@/lib/priceListImport";
import { ExcelColumnMapping, ColumnMapping } from "./ExcelColumnMapping";

interface AIAssistantPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string | null;
  catalogId?: string | null;
  catalogName?: string;
}

const quickCommands = [
  { 
    icon: EyeOff, 
    label: "Скрыть товары", 
    prompt: "скрыть ", 
    description: "Найти товары и скрыть из каталогов покупателей",
    inDevelopment: false 
  },
  { 
    icon: Eye, 
    label: "Открыть скрытые", 
    prompt: "открыть скрытые ", 
    description: "Найти скрытые товары и вернуть в продажу",
    inDevelopment: false 
  },
  { 
    icon: DollarSign, 
    label: "Изменить цены", 
    prompt: "установить наценку ", 
    description: "Установить наценку на группу товаров",
    inDevelopment: true 
  },
  { 
    icon: Search, 
    label: "Найти товары", 
    prompt: "найти ", 
    description: "Поиск товаров по названию или категории",
    inDevelopment: false 
  },
];

export function AIAssistantPanel({ open, onOpenChange, storeId, catalogId, catalogName }: AIAssistantPanelProps) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mimeTypeRef = useRef<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Excel import state
  const [isImporting, setIsImporting] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [importProgress, setImportProgress] = useState<PriceListImportProgress | null>(null);
  const [importStatus, setImportStatus] = useState<string>('');
  
  // Column mapping state
  const [excelPreview, setExcelPreview] = useState<ExcelPreviewData | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({ nameColumn: null, priceColumn: null });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
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

  const { catalogs, refetch: refetchCatalogs } = useStoreCatalogs(storeId);
  const { updateProductSettings } = useCatalogProductSettings(storeId);
  const { updateProduct, refetch: refetchProducts } = useStoreProducts(storeId);

  // Reset on close
  useEffect(() => {
    if (!open) {
      reset();
      setQuery("");
      setIsRecording(false);
      setRecordingTime(0);
      setIsImporting(false);
      setIsParsing(false);
      setImportProgress(null);
      setImportStatus('');
      setExcelPreview(null);
      setColumnMapping({ nameColumn: null, priceColumn: null });
      setSelectedFile(null);
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
      const mimeType = getSupportedAudioMimeType();
      mimeTypeRef.current = mimeType;
      const options = mimeType ? { mimeType } : {};
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        const blobType = mimeTypeRef.current || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: blobType });
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

  const [selectedCommand, setSelectedCommand] = useState<typeof quickCommands[0] | null>(null);

  const handleQuickCommand = useCallback((cmd: typeof quickCommands[0]) => {
    setQuery(cmd.prompt);
    setSelectedCommand(cmd);
  }, []);

  const { products: storeProducts } = useStoreProducts(storeId);

  const handleApply = useCallback(async () => {
    if (!response || selectedProducts.size === 0) return;

    setState("applying" as AssistantState);

    try {
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
          } else if (response.action === "update_prices") {
            let markupType = product.new_markup_type;
            let markupValue = product.new_markup_value;

            // If target_price is set, calculate markup from it
            if (product.target_price !== undefined && product.target_price !== null) {
              const currentProduct = storeProducts?.find(p => p.id === product.id);
              const buyPrice = currentProduct?.buy_price || product.buy_price || 0;
              
              if (buyPrice > 0) {
                markupType = "rubles";
                markupValue = product.target_price - buyPrice;
              }
            }

            if (markupType && markupValue !== undefined) {
              await updateProduct(product.id, {
                markup_type: markupType,
                markup_value: markupValue,
              });
              successCount++;
            }
          }
        } catch (err) {
          console.error(`Failed to update product ${product.id}:`, err);
        }
      }

      toast({
        title: "Готово!",
        description: `${response.action === "hide" ? "Скрыто" : response.action === "show" ? "Открыто" : "Обновлено"} ${successCount} товаров`,
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
  }, [response, selectedProducts, catalogs, storeProducts, updateProductSettings, updateProduct, toast, setState, onOpenChange]);

  // Excel file selection handler - shows column mapping
  const handleExcelFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setSelectedFile(file);
    
    try {
      const preview = await previewPriceListExcel(file);
      setExcelPreview(preview);
      setColumnMapping({
        nameColumn: preview.suggestedNameColumn,
        priceColumn: preview.suggestedPriceColumn,
      });
    } catch (err) {
      toast({
        title: "Ошибка чтения файла",
        description: err instanceof Error ? err.message : "Не удалось прочитать файл",
        variant: "destructive",
      });
      setSelectedFile(null);
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [toast]);

  // Cancel column mapping
  const handleCancelMapping = useCallback(() => {
    setExcelPreview(null);
    setColumnMapping({ nameColumn: null, priceColumn: null });
    setSelectedFile(null);
  }, []);

  // Confirm column mapping and start import
  const handleConfirmMapping = useCallback(async () => {
    if (!excelPreview || !selectedFile || !storeId || !catalogId) return;
    if (columnMapping.nameColumn === null || columnMapping.priceColumn === null) return;
    
    // Show parsing status
    setIsParsing(true);
    setImportStatus('Анализ данных из файла...');
    
    // Small delay to ensure UI updates
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Parse products with the selected mapping
    const products = parseProductsWithMapping(
      excelPreview,
      columnMapping.nameColumn,
      columnMapping.priceColumn
    );
    
    if (products.length === 0) {
      setIsParsing(false);
      setImportStatus('');
      toast({
        title: "Нет товаров для импорта",
        description: "Проверьте правильность сопоставления колонок",
        variant: "destructive",
      });
      return;
    }
    
    // Clear preview and start import
    setExcelPreview(null);
    setIsParsing(false);
    setIsImporting(true);
    setImportStatus(`Импорт ${products.length} товаров...`);
    setImportProgress({
      total: products.length,
      current: 0,
      currentProduct: 'Подготовка...',
      status: 'processing',
      matched: 0,
      created: 0,
      hidden: 0,
      errors: []
    });
    
    try {
      const result = await importProductsToCatalog(products, storeId, catalogId, (progress) => {
        setImportProgress({ ...progress });
        if (progress.status === 'processing') {
          setImportStatus(`Обработка: ${progress.current} из ${progress.total}`);
        } else if (progress.status === 'complete') {
          setImportStatus('Импорт завершён!');
        }
      });
      
      if (result.success) {
        setImportStatus('Готово!');
        toast({
          title: "Импорт завершён!",
          description: `Обновлено: ${result.matched}, Создано: ${result.created}, Скрыто: ${result.hidden}`,
        });
        refetchProducts();
        refetchCatalogs();
        setTimeout(() => {
          onOpenChange(false);
        }, 2000);
      } else {
        setImportStatus('Ошибка');
        toast({
          title: "Ошибка импорта",
          description: result.errors[0] || "Не удалось импортировать файл",
          variant: "destructive",
        });
      }
    } catch (err) {
      setImportStatus('Ошибка');
      toast({
        title: "Ошибка",
        description: err instanceof Error ? err.message : "Неизвестная ошибка",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
      setSelectedFile(null);
    }
  }, [excelPreview, selectedFile, storeId, catalogId, columnMapping, toast, onOpenChange, refetchProducts, refetchCatalogs]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case "hide": return "Скрыть";
      case "show": return "Открыть скрытые";
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
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col max-w-[100dvw] overflow-x-hidden">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Помощник
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 flex flex-col overflow-hidden">
        {/* Column Mapping Step */}
          {excelPreview && selectedFile && (
            <ExcelColumnMapping
              columns={excelPreview.columns}
              mapping={columnMapping}
              onMappingChange={setColumnMapping}
              onConfirm={handleConfirmMapping}
              onCancel={handleCancelMapping}
              fileName={selectedFile.name}
              rowCount={excelPreview.rowCount}
            />
          )}

          {/* Excel Import Section - prominent button at the top */}
          {state === "idle" && !isImporting && !excelPreview && (
            <div className="px-6 py-5 border-b">
              <div className="rounded-xl border-2 border-dashed border-emerald-300 dark:border-emerald-700 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 p-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm mb-1">Загрузить прайс-лист из Excel</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Загрузите файл с названиями товаров и ценами. Система автоматически:
                    </p>
                    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                        <span><strong className="text-foreground">Обновит</strong> себестоимость совпавших товаров</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>
                        <span><strong className="text-foreground">Создаст</strong> новые товары с наценкой 0%</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0"></span>
                        <span><strong className="text-foreground">Скроет</strong> товары, которых нет в файле</span>
                      </li>
                    </ul>
                  </div>
                </div>
                
                <Button
                  className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Выбрать Excel файл
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleExcelFileSelect}
                  className="hidden"
                />
                
                {catalogId && catalogName && (
                  <p className="text-[10px] text-center text-muted-foreground mt-2">
                    Импорт в каталог: <span className="font-medium">{catalogName}</span>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Parsing Status */}
          {isParsing && (
            <div className="px-6 py-8 flex-1 flex flex-col items-center justify-center">
              <div className="relative">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <FileSpreadsheet className="h-5 w-5 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <p className="font-medium mt-4">{importStatus || 'Анализ файла...'}</p>
              <p className="text-sm text-muted-foreground mt-1">Пожалуйста, подождите</p>
            </div>
          )}

          {/* Import Progress */}
          {isImporting && (
            <div className="px-6 py-8 flex-1 flex flex-col items-center justify-center">
              <div className="relative mb-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <FileSpreadsheet className="h-5 w-5 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              
              {/* Status message */}
              <p className="font-semibold text-lg">{importStatus || 'Импорт...'}</p>
              
              {importProgress && (
                <>
                  <p className="text-sm text-muted-foreground mt-1 max-w-[200px] truncate text-center">
                    {importProgress.currentProduct || 'Обработка товаров...'}
                  </p>
                  
                  {/* Progress bar */}
                  <div className="w-full max-w-xs mt-4">
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all duration-300 ease-out rounded-full"
                        style={{ width: `${importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground text-center mt-1">
                      {importProgress.current} из {importProgress.total}
                    </p>
                  </div>
                  
                  {/* Stats */}
                  <div className="mt-6 grid grid-cols-3 gap-6 text-center">
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-1">
                        <Check className="h-5 w-5 text-emerald-600" />
                      </div>
                      <p className="font-bold text-lg text-emerald-600">{importProgress.matched}</p>
                      <p className="text-xs text-muted-foreground">Обновлено</p>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-1">
                        <Sparkles className="h-5 w-5 text-blue-600" />
                      </div>
                      <p className="font-bold text-lg text-blue-600">{importProgress.created}</p>
                      <p className="text-xs text-muted-foreground">Создано</p>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mb-1">
                        <EyeOff className="h-5 w-5 text-orange-600" />
                      </div>
                      <p className="font-bold text-lg text-orange-600">{importProgress.hidden}</p>
                      <p className="text-xs text-muted-foreground">Скрыто</p>
                    </div>
                  </div>
                </>
              )}
              
              {!importProgress && (
                <p className="text-sm text-muted-foreground mt-2">Подготовка к импорту...</p>
              )}
            </div>
          )}

          {/* Quick commands */}
          {state === "idle" && !isImporting && !isParsing && !excelPreview && (
            <div className="px-6 py-4 border-b">
              <p className="text-sm text-muted-foreground mb-3">Быстрые команды:</p>
              <div className="flex flex-wrap gap-2">
                {quickCommands.map((cmd) => (
                  <Button
                    key={cmd.label}
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickCommand(cmd)}
                    className={cn("text-xs relative", cmd.inDevelopment && "opacity-70")}
                  >
                    <cmd.icon className="h-3 w-3 mr-1" />
                    {cmd.label}
                    {cmd.inDevelopment && (
                      <Badge variant="secondary" className="ml-1 text-[9px] px-1 py-0 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        В разработке
                      </Badge>
                    )}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Input area */}
          {(state === "idle" || state === "error") && !excelPreview && !isParsing && !isImporting && (
            <div className="px-6 py-4 border-b space-y-3">
              {/* Micro-description for selected command */}
              {selectedCommand && (
                <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 rounded-lg border border-primary/20">
                  <selectedCommand.icon className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm text-muted-foreground">{selectedCommand.description}</span>
                </div>
              )}
              
              <Textarea
                placeholder="Опишите что нужно сделать...&#10;Например: 'Скрыть всю рыбу' или 'Установить наценку 25% на сыры'"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (!e.target.value.trim()) {
                    setSelectedCommand(null);
                  }
                }}
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
                  onClick={handleSubmit} 
                  disabled={!query.trim()}
                  className="flex-1"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Выполнить
                </Button>

                {/* Push-to-talk microphone button */}
                <div className="relative group">
                  <Button
                    variant="outline"
                    size="icon"
                    className={cn(
                      "relative transition-all duration-200 touch-none select-none",
                      isRecording 
                        ? "bg-destructive hover:bg-destructive/90 border-destructive text-destructive-foreground scale-110 shadow-lg shadow-destructive/30" 
                        : "border-destructive/30 hover:border-destructive hover:bg-destructive/10"
                    )}
                    style={{ 
                      WebkitTouchCallout: 'none',
                      WebkitUserSelect: 'none',
                      userSelect: 'none'
                    }}
                    title="Зажмите для записи голоса"
                    onContextMenu={(e) => e.preventDefault()}
                    onMouseDown={handleStartRecording}
                    onMouseUp={handleStopRecording}
                    onMouseLeave={isRecording ? handleStopRecording : undefined}
                    onTouchStart={(e) => {
                      e.preventDefault();
                      handleStartRecording();
                    }}
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      handleStopRecording();
                    }}
                  >
                    {isRecording ? (
                      <MicOff className="h-4 w-4 animate-pulse" />
                    ) : (
                      <Mic className="h-4 w-4 text-destructive" />
                    )}
                    
                    {/* Recording indicator */}
                    {isRecording && (
                      <>
                        <span className="absolute -top-2 -right-2 flex h-5 w-5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-5 w-5 bg-destructive items-center justify-center text-[9px] text-destructive-foreground font-medium">
                            {formatTime(recordingTime)}
                          </span>
                        </span>
                        <span className="absolute inset-0 rounded-md animate-pulse bg-destructive/20 pointer-events-none"></span>
                      </>
                    )}
                  </Button>
                  
                  {/* Tooltip hint */}
                  {!isRecording && (
                    <div className="absolute bottom-full right-0 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                      <div className="bg-popover text-popover-foreground text-xs rounded-lg px-3 py-2 shadow-lg border whitespace-nowrap">
                        <p className="font-medium">Голосовой ввод</p>
                        <p className="text-muted-foreground">Зажмите и говорите</p>
                      </div>
                      <div className="absolute bottom-0 right-4 transform translate-y-1/2 rotate-45 w-2 h-2 bg-popover border-r border-b"></div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Recording status with animated waveform */}
              {isRecording && (
                <div className="flex items-center justify-center gap-3 py-3 px-4 bg-destructive/10 rounded-lg border border-destructive/30">
                  {/* Animated waveform bars */}
                  <div className="flex items-center gap-1 h-6">
                    {[...Array(12)].map((_, i) => (
                      <div
                        key={i}
                        className="w-1 bg-destructive rounded-full"
                        style={{
                          animation: 'soundWave 0.8s ease-in-out infinite',
                          animationDelay: `${i * 0.05}s`,
                          height: '100%',
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-destructive font-medium">
                    Говорите... Отпустите для отправки
                  </span>
                </div>
              )}
              
              {/* CSS for waveform animation */}
              <style>{`
                @keyframes soundWave {
                  0%, 100% { transform: scaleY(0.3); }
                  50% { transform: scaleY(1); }
                }
              `}</style>
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
              <ScrollArea className="flex-1 w-full max-w-full overflow-x-hidden">
                <div className="px-6 py-3 space-y-2 w-full max-w-full overflow-hidden">
                  {response.products.map((product) => (
                    <div
                      key={product.id}
                      className={cn(
                        "w-full max-w-full p-3 rounded-lg border transition-colors overflow-hidden box-border",
                        selectedProducts.has(product.id) 
                          ? "bg-primary/5 border-primary/20" 
                          : "bg-muted/30 border-transparent opacity-60"
                      )}
                    >
                      <div className="grid grid-cols-[20px_minmax(0,1fr)] gap-3 items-start w-full">
                        {/* Checkbox/Icon column */}
                        <div className="flex-shrink-0 pt-0.5">
                          {state === "confirming" && (
                            <Checkbox
                              checked={selectedProducts.has(product.id)}
                              onCheckedChange={() => toggleProduct(product.id)}
                            />
                          )}
                          {state === "done" && selectedProducts.has(product.id) && (
                            <Check className="h-4 w-4 text-green-500" />
                          )}
                          {state === "done" && !selectedProducts.has(product.id) && (
                            <div className="h-4 w-4" />
                          )}
                          {state === "applying" && selectedProducts.has(product.id) && (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          )}
                          {state === "applying" && !selectedProducts.has(product.id) && (
                            <div className="h-4 w-4" />
                          )}
                        </div>
                        
                        {/* Content column */}
                        <div className="min-w-0 flex flex-col gap-0.5">
                          <p className="font-medium text-sm truncate">{product.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{product.reason}</p>
                          {product.current_status && (
                            <p className="text-xs text-muted-foreground">
                              Текущий статус: {product.current_status === "hidden" ? "Скрыт" : "Активен"}
                            </p>
                          )}
                          {response.action === "update_prices" && product.target_price !== undefined && (
                            (() => {
                              const currentProduct = storeProducts?.find(p => p.id === product.id);
                              const buyPrice = currentProduct?.buy_price || product.buy_price || 0;
                              const calculatedMarkup = buyPrice > 0 ? product.target_price - buyPrice : null;
                              return (
                                <p className="text-xs text-primary truncate">
                                  Целевая цена: {product.target_price.toLocaleString()}₽
                                  {calculatedMarkup !== null && (
                                    <span className="text-muted-foreground">
                                      {" "}(наценка: {calculatedMarkup >= 0 ? "+" : ""}{calculatedMarkup.toLocaleString()}₽)
                                    </span>
                                  )}
                                </p>
                              );
                            })()
                          )}
                          {response.action === "update_prices" && product.new_markup_type && product.new_markup_value !== undefined && !product.target_price && (
                            <p className="text-xs text-primary truncate">
                              Наценка: {product.new_markup_type === "percent" ? `${product.new_markup_value}%` : `${product.new_markup_value.toLocaleString()}₽`}
                            </p>
                          )}
                        </div>
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
