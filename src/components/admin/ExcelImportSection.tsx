import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Upload, Download, FileSpreadsheet, Check, AlertCircle, Loader2, FileText } from 'lucide-react';
import { 
  downloadExcelTemplate, 
  importProductsFromExcel, 
  checkForDuplicates,
  ImportProgress, 
  DuplicateProduct,
  PreImportCheck 
} from '@/lib/excelImport';
import { 
  previewPriceListExcel, 
  ExcelPreviewData,
  importProductsWithMapping
} from '@/lib/priceListImport';
import { cn } from '@/lib/utils';
import { DuplicateReviewDialog } from './DuplicateReviewDialog';
import { ExcelColumnMapping, ColumnMapping, ImportOptions } from './ExcelColumnMapping';
import { useToast } from '@/hooks/use-toast';

interface ExcelImportSectionProps {
  storeId: string;
  onBack: () => void;
  onComplete: () => void;
}

type ImportMode = 'select' | 'template' | 'custom';

export function ExcelImportSection({ storeId, onBack, onComplete }: ExcelImportSectionProps) {
  const { toast } = useToast();
  
  // Mode selection
  const [importMode, setImportMode] = useState<ImportMode>('select');
  
  // Template mode state
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [preImportCheck, setPreImportCheck] = useState<PreImportCheck | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const customFileInputRef = useRef<HTMLInputElement>(null);
  
  // Custom mode state
  const [excelPreview, setExcelPreview] = useState<ExcelPreviewData | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    identifierType: 'name',
    identifierColumn: null,
    fieldsToUpdate: {
      buyPrice: null,
      price: null,
      unit: null,
      name: null,
      description: null,
      group: null,
      volume: null,
      photos: null,
    }
  });
  const [importOptions, setImportOptions] = useState<ImportOptions>({
    createNewProducts: false,
    hideNotInFile: false,
  });

  // Template mode handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleTemplateFile(files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleTemplateFile(files[0]);
    }
  };

  const handleTemplateFile = async (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setProgress({
        total: 0,
        current: 0,
        currentProduct: '',
        status: 'error',
        errors: ['Пожалуйста, выберите файл Excel (.xlsx или .xls)'],
        successCount: 0
      });
      return;
    }

    if (!storeId) {
      setProgress({
        total: 0,
        current: 0,
        currentProduct: '',
        status: 'error',
        errors: ['Не удалось определить магазин'],
        successCount: 0
      });
      return;
    }

    // Check for duplicates first
    setIsCheckingDuplicates(true);
    setPendingFile(file);
    setProgress(null);

    try {
      const check = await checkForDuplicates(file, storeId);
      setPreImportCheck(check);

      if (check.duplicates.length > 0) {
        setDuplicateDialogOpen(true);
        setIsCheckingDuplicates(false);
      } else {
        setIsCheckingDuplicates(false);
        await startTemplateImport(file, []);
      }
    } catch (error) {
      console.error('Error checking duplicates:', error);
      setIsCheckingDuplicates(false);
      setProgress({
        total: 0,
        current: 0,
        currentProduct: '',
        status: 'error',
        errors: ['Ошибка проверки дубликатов'],
        successCount: 0
      });
    }
  };

  const startTemplateImport = async (file: File, duplicatesToUpdate: DuplicateProduct[]) => {
    setIsImporting(true);
    setProgress(null);
    setDuplicateDialogOpen(false);

    await importProductsFromExcel(file, storeId, (p) => {
      setProgress({ ...p });
      
      if (p.status === 'done') {
        setIsImporting(false);
        if (p.successCount > 0 || (p.updatedCount && p.updatedCount > 0)) {
          onComplete();
        }
      } else if (p.status === 'error') {
        setIsImporting(false);
      }
    }, duplicatesToUpdate);
  };

  const handleDuplicateConfirm = (duplicatesToUpdate: DuplicateProduct[]) => {
    if (pendingFile) {
      startTemplateImport(pendingFile, duplicatesToUpdate);
    }
  };

  const handleSkipDuplicates = () => {
    if (pendingFile && preImportCheck) {
      const skippedDuplicates = preImportCheck.duplicates.map(d => ({
        ...d,
        shouldUpdate: false
      }));
      startTemplateImport(pendingFile, skippedDuplicates);
    }
  };

  const handleDownloadTemplate = async () => {
    await downloadExcelTemplate(storeId);
  };

  const getProgressPercent = () => {
    if (!progress || progress.total === 0) return 0;
    return Math.round((progress.current / progress.total) * 100);
  };

  const getStatusText = () => {
    if (!progress) return '';
    switch (progress.status) {
      case 'parsing':
        return 'Чтение файла...';
      case 'importing':
        return `Импорт товара ${progress.current} из ${progress.total}`;
      case 'uploading_images':
        return `Загрузка фото для "${progress.currentProduct}"`;
      case 'done': {
        const parts = [];
        if (progress.successCount > 0) {
          parts.push(`создано: ${progress.successCount}`);
        }
        if (progress.updatedCount && progress.updatedCount > 0) {
          parts.push(`обновлено: ${progress.updatedCount}`);
        }
        return `Импорт завершён. ${parts.join(', ')}`;
      }
      case 'error':
        return 'Ошибка импорта';
      default:
        return '';
    }
  };

  const resetImport = () => {
    setProgress(null);
    setIsImporting(false);
    setPreImportCheck(null);
    setPendingFile(null);
    setExcelPreview(null);
    setSelectedFile(null);
    setImportMode('select');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (customFileInputRef.current) {
      customFileInputRef.current.value = '';
    }
  };

  // Custom mode handlers
  const handleCustomFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast({
        title: "Ошибка",
        description: "Пожалуйста, выберите файл Excel (.xlsx или .xls)",
        variant: "destructive",
      });
      return;
    }
    
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
          price: null,
          unit: null,
          name: preview.suggestedSkuColumn !== null ? preview.suggestedNameColumn : null,
          description: null,
          group: null,
          volume: null,
          photos: null,
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
    
    if (customFileInputRef.current) customFileInputRef.current.value = '';
  }, [toast]);

  const handleCustomImportConfirm = useCallback(async () => {
    if (!excelPreview || !selectedFile) return;
    
    setIsImporting(true);
    setProgress({
      total: excelPreview.rowCount,
      current: 0,
      currentProduct: '',
      status: 'parsing',
      errors: [],
      successCount: 0,
      updatedCount: 0,
    });
    
    try {
      const result = await importProductsWithMapping(
        selectedFile,
        storeId,
        columnMapping,
        importOptions,
        (p) => {
          setProgress({
            total: p.total,
            current: p.current,
            currentProduct: p.currentProduct,
            status: p.status === 'complete' ? 'done' : p.status === 'error' ? 'error' : 'importing',
            errors: p.errors,
            successCount: p.created,
            updatedCount: p.matched,
          });
        }
      );
      
      setExcelPreview(null);
      setSelectedFile(null);
      
      if (result.matched > 0 || result.created > 0) {
        onComplete();
      }
    } catch (err) {
      console.error('Import error:', err);
      setProgress(prev => prev ? {
        ...prev,
        status: 'error',
        errors: [...prev.errors, err instanceof Error ? err.message : 'Ошибка импорта'],
      } : null);
    } finally {
      setIsImporting(false);
    }
  }, [excelPreview, selectedFile, columnMapping, importOptions, storeId, onComplete]);

  const handleCustomImportCancel = useCallback(() => {
    setExcelPreview(null);
    setSelectedFile(null);
    setImportMode('select');
  }, []);

  const isLoading = isImporting || isCheckingDuplicates;

  // Show column mapping UI for custom mode
  if (importMode === 'custom' && excelPreview && selectedFile) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-4 p-4 border-b">
          <Button variant="ghost" size="sm" onClick={handleCustomImportCancel} disabled={isImporting}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Назад
          </Button>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Сопоставление колонок</h2>
            <p className="text-sm text-muted-foreground">Укажите какие данные импортировать</p>
          </div>
        </div>
        
        <div className="flex-1 overflow-hidden">
          <ExcelColumnMapping
            columns={excelPreview.columns}
            mapping={columnMapping}
            onMappingChange={setColumnMapping}
            onConfirm={handleCustomImportConfirm}
            onCancel={handleCustomImportCancel}
            fileName={selectedFile.name}
            rowCount={excelPreview.rowCount}
            mode="assortment"
            importOptions={importOptions}
            onImportOptionsChange={setImportOptions}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack} disabled={isLoading}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Назад
        </Button>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Импорт из Excel</h2>
          <p className="text-sm text-muted-foreground">Загрузите .xlsx файл с товарами</p>
        </div>
      </div>

      {/* Mode selection */}
      {importMode === 'select' && !isLoading && !progress && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Template mode */}
          <div 
            className="p-5 rounded-xl border-2 border-dashed hover:border-primary/50 cursor-pointer transition-all bg-card hover:bg-muted/30"
            onClick={() => setImportMode('template')}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold mb-1">Шаблон Lovable</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Скачайте готовый шаблон, заполните и загрузите. Все поля автоматически распознаются.
                </p>
                <Button variant="secondary" size="sm">
                  Выбрать
                </Button>
              </div>
            </div>
          </div>
          
          {/* Custom mode */}
          <div 
            className="p-5 rounded-xl border-2 border-dashed hover:border-emerald-500/50 cursor-pointer transition-all bg-card hover:bg-emerald-500/5"
            onClick={() => {
              setImportMode('custom');
              customFileInputRef.current?.click();
            }}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                <FileText className="h-6 w-6 text-emerald-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold mb-1">Свой файл</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Загрузите любой Excel файл и сопоставьте колонки вручную.
                </p>
                <Button variant="secondary" size="sm" className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700">
                  Выбрать
                </Button>
              </div>
            </div>
          </div>
          
          <input
            ref={customFileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleCustomFileSelect}
            className="hidden"
          />
        </div>
      )}

      {/* Template mode UI */}
      {importMode === 'template' && (
        <>
          {/* Download template */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-start gap-4">
              <FileSpreadsheet className="h-8 w-8 text-primary flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-medium mb-1">Шаблон для импорта</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Скачайте шаблон, заполните его данными товаров и загрузите обратно. 
                  В шаблоне есть инструкции по заполнению каждого поля.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                    <Download className="h-4 w-4 mr-2" />
                    Скачать шаблон
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setImportMode('select')}>
                    Назад
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Upload zone */}
          {!isLoading && progress?.status !== 'done' && (
            <div
              className={cn(
                "border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer",
                isDragging 
                  ? "border-primary bg-primary/5" 
                  : "border-border hover:border-primary/50"
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className={cn(
                "h-12 w-12 mx-auto mb-4 transition-colors",
                isDragging ? "text-primary" : "text-muted-foreground"
              )} />
              <p className="text-foreground font-medium mb-2">
                {isDragging ? "Отпустите файл" : "Перетащите файл сюда"}
              </p>
              <p className="text-sm text-muted-foreground mb-4">или нажмите для выбора</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button variant="secondary" size="sm" onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}>
                Выбрать файл
              </Button>
            </div>
          )}
        </>
      )}

      {/* Checking duplicates indicator */}
      {isCheckingDuplicates && (
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
            <span className="font-medium">Проверка на дубликаты...</span>
          </div>
        </div>
      )}

      {/* Progress section */}
      {(isImporting || progress) && !isCheckingDuplicates && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-4">
          <div className="flex items-center gap-3">
            {progress?.status === 'done' && (progress.successCount > 0 || (progress.updatedCount ?? 0) > 0) && (
              <Check className="h-5 w-5 text-green-500" />
            )}
            {progress?.status === 'error' && (
              <AlertCircle className="h-5 w-5 text-destructive" />
            )}
            {isImporting && (
              <Loader2 className="h-5 w-5 text-primary animate-spin" />
            )}
            <span className="font-medium">{getStatusText()}</span>
          </div>

          {isImporting && progress && progress.total > 0 && (
            <div className="space-y-2">
              <Progress value={getProgressPercent()} />
              <p className="text-sm text-muted-foreground">
                {progress.currentProduct}
              </p>
            </div>
          )}

          {/* Errors */}
          {progress?.errors && progress.errors.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 max-h-40 overflow-y-auto">
              <p className="text-sm font-medium text-destructive mb-2">
                Ошибки ({progress.errors.length}):
              </p>
              <ul className="text-sm text-destructive/80 space-y-1">
                {progress.errors.map((error, i) => (
                  <li key={i}>• {error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Success message */}
          {progress?.status === 'done' && (progress.successCount > 0 || (progress.updatedCount ?? 0) > 0) && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
              <p className="text-sm text-green-700 dark:text-green-400">
                {progress.successCount > 0 && `Создано товаров: ${progress.successCount}`}
                {progress.successCount > 0 && (progress.updatedCount ?? 0) > 0 && ', '}
                {(progress.updatedCount ?? 0) > 0 && `Обновлено товаров: ${progress.updatedCount}`}
              </p>
            </div>
          )}

          {/* Actions */}
          {progress?.status === 'done' && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={resetImport}>
                Загрузить ещё
              </Button>
              <Button size="sm" onClick={onBack}>
                Готово
              </Button>
            </div>
          )}

          {progress?.status === 'error' && (
            <Button variant="outline" size="sm" onClick={resetImport}>
              Попробовать снова
            </Button>
          )}
        </div>
      )}

      {/* Photo instructions - only show in template mode */}
      {importMode === 'template' && !isLoading && !progress && (
        <div className="bg-muted/30 rounded-lg p-4">
          <h4 className="font-medium mb-2">Как добавить фото товаров</h4>
          <p className="text-sm text-muted-foreground">
            В колонке "Фото (ссылки через ;)" укажите прямые ссылки на изображения. 
            Если нужно добавить несколько фото, разделите их точкой с запятой.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Пример: <code className="bg-muted px-1 py-0.5 rounded text-xs">https://site.com/photo1.jpg; https://site.com/photo2.png</code>
          </p>
        </div>
      )}

      {/* Duplicate Review Dialog */}
      {preImportCheck && (
        <DuplicateReviewDialog
          open={duplicateDialogOpen}
          onOpenChange={setDuplicateDialogOpen}
          duplicates={preImportCheck.duplicates}
          newProductsCount={preImportCheck.newProducts.length}
          onConfirm={handleDuplicateConfirm}
          onSkipDuplicates={handleSkipDuplicates}
        />
      )}
    </div>
  );
}
