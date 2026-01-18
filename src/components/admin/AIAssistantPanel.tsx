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
  ChevronDown,
  BookOpen,
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
  parseProductsWithExtendedMapping, 
  importProductsToCatalogExtended, 
  analyzeProductsForImport,
  PriceListImportProgress,
  PriceListProduct,
  ProductAnalysis,
  ExcelPreviewData,
} from "@/lib/priceListImport";
import { ExcelColumnMapping, ColumnMapping } from "./ExcelColumnMapping";
import { NewProductsConfirmDialog } from "./NewProductsConfirmDialog";

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
  
  // Internal catalog selection state
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(catalogId || null);
  const [selectedCatalogName, setSelectedCatalogName] = useState<string>(catalogName || '');
  const [showCatalogSelector, setShowCatalogSelector] = useState(false);
  
  // Excel import state
  const [isImporting, setIsImporting] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [importProgress, setImportProgress] = useState<PriceListImportProgress | null>(null);
  const [importStatus, setImportStatus] = useState<string>('');
  
  // Column mapping state - using extended mapping interface
  const [excelPreview, setExcelPreview] = useState<ExcelPreviewData | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    identifierType: 'name',
    identifierColumn: null,
    fieldsToUpdate: {
      buyPrice: null,
      unit: null,
      name: null,
    }
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // New products confirmation state
  const [showNewProductsDialog, setShowNewProductsDialog] = useState(false);
  const [productAnalysis, setProductAnalysis] = useState<ProductAnalysis | null>(null);
  const [parsedProducts, setParsedProducts] = useState<PriceListProduct[]>([]);
  
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
  
  // Effective catalog values (internal state or from props)
  const effectiveCatalogId = selectedCatalogId;
  const effectiveCatalogName = selectedCatalogName;
  
  // Update internal state when props change
  useEffect(() => {
    if (catalogId) {
      setSelectedCatalogId(catalogId);
      setSelectedCatalogName(catalogName || '');
    }
  }, [catalogId, catalogName]);
  
  // Handle catalog selection
  const handleSelectCatalog = useCallback((catalog: { id: string; name: string }) => {
    setSelectedCatalogId(catalog.id);
    setSelectedCatalogName(catalog.name);
    setShowCatalogSelector(false);
  }, []);
  
  // Helper to get default column mapping
  const getDefaultColumnMapping = useCallback((): ColumnMapping => ({
    identifierType: 'name',
    identifierColumn: null,
    fieldsToUpdate: {
      buyPrice: null,
      unit: null,
      name: null,
    }
  }), []);

  // Handle catalog change (reset import state)
  const handleChangeCatalog = useCallback(() => {
    setShowCatalogSelector(true);
    // Reset any in-progress import
    setExcelPreview(null);
    setColumnMapping(getDefaultColumnMapping());
    setSelectedFile(null);
    setShowNewProductsDialog(false);
    setProductAnalysis(null);
    setParsedProducts([]);
  }, [getDefaultColumnMapping]);

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
      setColumnMapping(getDefaultColumnMapping());
      setSelectedFile(null);
      setShowNewProductsDialog(false);
      setProductAnalysis(null);
      setParsedProducts([]);
      // Reset catalog selection only if no catalogId prop was passed
      if (!catalogId) {
        setSelectedCatalogId(null);
        setSelectedCatalogName('');
      }
      setShowCatalogSelector(false);
    }
  }, [open, reset, catalogId, getDefaultColumnMapping]);

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
      // Set initial mapping based on suggestions
      setColumnMapping({
        identifierType: preview.suggestedSkuColumn !== null ? 'sku' : 'name',
        identifierColumn: preview.suggestedSkuColumn ?? preview.suggestedNameColumn,
        fieldsToUpdate: {
          buyPrice: preview.suggestedPriceColumn,
          unit: null,
          name: preview.suggestedSkuColumn !== null ? preview.suggestedNameColumn : null,
        }
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
    setColumnMapping(getDefaultColumnMapping());
    setSelectedFile(null);
  }, [getDefaultColumnMapping]);

  // Confirm column mapping and analyze products
  const handleConfirmMapping = useCallback(async () => {
    // Check if catalog is selected
    if (!effectiveCatalogId) {
      toast({
        title: "Не выбран прайс-лист",
        description: "Сначала выберите прайс-лист для импорта",
        variant: "destructive",
      });
      return;
    }
    
    if (!storeId) {
      toast({
        title: "Ошибка",
        description: "Не определён магазин",
        variant: "destructive",
      });
      return;
    }
    
    if (!excelPreview || !selectedFile) return;
    if (columnMapping.identifierColumn === null) return;
    
    // Check that at least one update field is selected
    const { fieldsToUpdate } = columnMapping;
    const hasFieldToUpdate = fieldsToUpdate.buyPrice !== null || fieldsToUpdate.unit !== null || fieldsToUpdate.name !== null;
    if (!hasFieldToUpdate) return;
    
    // Show parsing status
    setIsParsing(true);
    setImportStatus('Чтение данных из файла...');
    
    // Small delay to ensure UI updates
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Parse products with the extended mapping
    const products = parseProductsWithExtendedMapping(excelPreview, columnMapping);
    
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
    
    setImportStatus('Анализ товаров...');
    
    try {
      // Analyze products - find matching and new
      const analysis = await analyzeProductsForImport(products, storeId, columnMapping.identifierType);
      
      setParsedProducts(products);
      setProductAnalysis(analysis);
      setExcelPreview(null);
      setIsParsing(false);
      
      // If there are new products, show confirmation dialog
      if (analysis.newProducts.length > 0) {
        setImportStatus(`Найдено ${analysis.matchingProducts.length} совпадений, ${analysis.newProducts.length} новых`);
        setShowNewProductsDialog(true);
      } else {
        // No new products - proceed with import directly
        setImportStatus(`Обновление ${analysis.matchingProducts.length} товаров...`);
        await startImport(products, true);
      }
    } catch (err) {
      setIsParsing(false);
      setImportStatus('');
      toast({
        title: "Ошибка анализа",
        description: err instanceof Error ? err.message : "Не удалось проанализировать файл",
        variant: "destructive",
      });
    }
  }, [excelPreview, selectedFile, storeId, effectiveCatalogId, columnMapping, toast]);

  // Start the actual import process
  const startImport = useCallback(async (products: PriceListProduct[], includeNew: boolean) => {
    if (!storeId || !effectiveCatalogId) return;
    
    // Filter products if not including new
    let productsToImport = products;
    if (!includeNew && productAnalysis) {
      const matchingNames = new Set(
        productAnalysis.matchingProducts.map(m => m.excel.name.toLowerCase().trim())
      );
      productsToImport = products.filter(p => 
        matchingNames.has(p.name.toLowerCase().trim())
      );
    }
    
    if (productsToImport.length === 0) {
      toast({
        title: "Нет товаров для импорта",
        description: "Все товары из файла отсутствуют в ассортименте",
      });
      setSelectedFile(null);
      setParsedProducts([]);
      setProductAnalysis(null);
      return;
    }
    
    setShowNewProductsDialog(false);
    setIsImporting(true);
    setImportStatus(`Импорт ${productsToImport.length} товаров...`);
    setImportProgress({
      total: productsToImport.length,
      current: 0,
      currentProduct: 'Подготовка...',
      status: 'processing',
      matched: 0,
      created: 0,
      hidden: 0,
      errors: []
    });
    
    // Determine which fields to update based on mapping
    const fieldsToUpdateArray: ('buyPrice' | 'unit' | 'name')[] = [];
    if (columnMapping.fieldsToUpdate.buyPrice !== null) fieldsToUpdateArray.push('buyPrice');
    if (columnMapping.fieldsToUpdate.unit !== null) fieldsToUpdateArray.push('unit');
    if (columnMapping.fieldsToUpdate.name !== null) fieldsToUpdateArray.push('name');
    
    try {
      const result = await importProductsToCatalogExtended(
        productsToImport, 
        storeId, 
        effectiveCatalogId, 
        columnMapping.identifierType,
        fieldsToUpdateArray,
        (progress) => {
          setImportProgress({ ...progress });
          if (progress.status === 'processing') {
            setImportStatus(`Обработка: ${progress.current} из ${progress.total}`);
          } else if (progress.status === 'complete') {
            setImportStatus('Импорт завершён!');
          }
        }
      );
      
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
      setParsedProducts([]);
      setProductAnalysis(null);
    }
  }, [storeId, effectiveCatalogId, productAnalysis, toast, onOpenChange, refetchProducts, refetchCatalogs]);

  // Handle dialog actions
  const handleAddAllAndImport = useCallback(() => {
    startImport(parsedProducts, true);
  }, [parsedProducts, startImport]);

  const handleUpdateExistingOnly = useCallback(() => {
    startImport(parsedProducts, false);
  }, [parsedProducts, startImport]);

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
    <>
    {/* New Products Confirmation Dialog */}
    <NewProductsConfirmDialog
      open={showNewProductsDialog}
      onOpenChange={setShowNewProductsDialog}
      newProducts={productAnalysis?.newProducts || []}
      matchingCount={productAnalysis?.matchingProducts.length || 0}
      onAddAllAndImport={handleAddAllAndImport}
      onUpdateExistingOnly={handleUpdateExistingOnly}
      catalogName={effectiveCatalogName}
    />
    
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col max-w-[100dvw] overflow-x-hidden">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Помощник
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Catalog Selection Step - shown when no catalog selected or user wants to change */}
          {(!effectiveCatalogId || showCatalogSelector) && !isImporting && !isParsing && (
            <div className="px-6 py-6 flex-1 flex flex-col">
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <BookOpen className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Выберите прайс-лист</h3>
                <p className="text-sm text-muted-foreground">
                  Для работы AI помощника выберите прайс-лист, в котором будут производиться изменения
                </p>
              </div>
              
              <div className="space-y-2">
                {catalogs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Прайс-листы не найдены</p>
                    <p className="text-xs mt-1">Сначала создайте прайс-лист</p>
                  </div>
                ) : (
                  catalogs.map((catalog) => (
                    <Button
                      key={catalog.id}
                      variant={selectedCatalogId === catalog.id ? "default" : "outline"}
                      className="w-full justify-start h-auto py-3"
                      onClick={() => handleSelectCatalog({ id: catalog.id, name: catalog.name })}
                    >
                      <BookOpen className="h-4 w-4 mr-3 shrink-0" />
                      <div className="text-left">
                        <p className="font-medium">{catalog.name}</p>
                        {catalog.description && (
                          <p className="text-xs text-muted-foreground font-normal">{catalog.description}</p>
                        )}
                      </div>
                      {catalog.is_default && (
                        <Badge variant="secondary" className="ml-auto text-xs">По умолчанию</Badge>
                      )}
                    </Button>
                  ))
                )}
              </div>
              
              {showCatalogSelector && effectiveCatalogId && (
                <Button
                  variant="ghost"
                  className="mt-4"
                  onClick={() => setShowCatalogSelector(false)}
                >
                  Отмена
                </Button>
              )}
            </div>
          )}
          
          {/* Selected catalog indicator - shown when catalog is selected and not in selector mode */}
          {effectiveCatalogId && !showCatalogSelector && !isImporting && !isParsing && !excelPreview && (
            <div className="px-6 py-2 border-b bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <BookOpen className="h-4 w-4 text-primary" />
                  <span className="text-muted-foreground">Работа в:</span>
                  <span className="font-medium">{effectiveCatalogName}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleChangeCatalog}
                >
                  <ChevronDown className="h-3 w-3 mr-1" />
                  Сменить
                </Button>
              </div>
            </div>
          )}
          
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

          {/* Excel Import Section - compact design */}
          {effectiveCatalogId && !showCatalogSelector && state === "idle" && !isImporting && !excelPreview && (
            <div className="px-4 py-3 border-b">
              <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 p-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">Загрузить прайс-лист</p>
                    <p className="text-xs text-muted-foreground">
                      Обновить цены из Excel файла
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                    Выбрать
                  </Button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleExcelFileSelect}
                  className="hidden"
                />
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
          {effectiveCatalogId && !showCatalogSelector && state === "idle" && !isImporting && !isParsing && !excelPreview && (
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
          {effectiveCatalogId && !showCatalogSelector && (state === "idle" || state === "error") && !excelPreview && !isParsing && !isImporting && (
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
    </>
  );
}
