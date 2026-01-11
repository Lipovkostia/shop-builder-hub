import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Upload, Download, FileSpreadsheet, Check, AlertCircle, Loader2 } from 'lucide-react';
import { 
  downloadExcelTemplate, 
  importProductsFromExcel, 
  checkForDuplicates,
  ImportProgress, 
  DuplicateProduct,
  PreImportCheck 
} from '@/lib/excelImport';
import { cn } from '@/lib/utils';
import { DuplicateReviewDialog } from './DuplicateReviewDialog';

interface ExcelImportSectionProps {
  storeId: string;
  onBack: () => void;
  onComplete: () => void;
}

export function ExcelImportSection({ storeId, onBack, onComplete }: ExcelImportSectionProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [preImportCheck, setPreImportCheck] = useState<PreImportCheck | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      handleFile(files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFile = async (file: File) => {
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
        // Show duplicate review dialog
        setDuplicateDialogOpen(true);
        setIsCheckingDuplicates(false);
      } else {
        // No duplicates, proceed with import
        setIsCheckingDuplicates(false);
        await startImport(file, []);
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

  const startImport = async (file: File, duplicatesToUpdate: DuplicateProduct[]) => {
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
      startImport(pendingFile, duplicatesToUpdate);
    }
  };

  const handleSkipDuplicates = () => {
    if (pendingFile && preImportCheck) {
      // Import only new products by passing duplicates with shouldUpdate = false
      const skippedDuplicates = preImportCheck.duplicates.map(d => ({
        ...d,
        shouldUpdate: false
      }));
      startImport(pendingFile, skippedDuplicates);
    }
  };

  const handleDownloadTemplate = () => {
    downloadExcelTemplate();
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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const isLoading = isImporting || isCheckingDuplicates;

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
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Скачать шаблон Excel
            </Button>
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
            {progress?.status === 'done' && (progress.successCount > 0 || (progress.updatedCount && progress.updatedCount > 0)) && (
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
          {progress?.status === 'done' && (progress.successCount > 0 || (progress.updatedCount && progress.updatedCount > 0)) && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
              <p className="text-sm text-green-700 dark:text-green-400">
                {progress.successCount > 0 && `Создано товаров: ${progress.successCount}`}
                {progress.successCount > 0 && progress.updatedCount && progress.updatedCount > 0 && ', '}
                {progress.updatedCount && progress.updatedCount > 0 && `Обновлено товаров: ${progress.updatedCount}`}
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

      {/* Photo instructions */}
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
