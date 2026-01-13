import React, { useState, useRef, useCallback } from "react";
import { Upload, Download, Loader2, X, Check, AlertCircle, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  downloadCatalogImportTemplate, 
  importProductsToCatalog, 
  CatalogImportProgress 
} from "@/lib/excelImport";

interface CatalogImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  catalogId: string;
  catalogName: string;
  onComplete: () => void;
}

export function CatalogImportDialog({
  open,
  onOpenChange,
  storeId,
  catalogId,
  catalogName,
  onComplete,
}: CatalogImportDialogProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [progress, setProgress] = useState<CatalogImportProgress | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  }, []);

  const handleFile = async (file: File) => {
    // Validate file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      '.xlsx',
      '.xls'
    ];
    
    const isValidType = validTypes.some(type => 
      file.type === type || file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
    );
    
    if (!isValidType) {
      setProgress({
        total: 0,
        current: 0,
        currentProduct: '',
        status: 'error',
        errors: ['Пожалуйста, загрузите файл Excel (.xlsx или .xls)'],
        successCount: 0,
        addedToCatalogCount: 0,
        updatedCount: 0,
      });
      return;
    }

    setIsImporting(true);
    setProgress({
      total: 0,
      current: 0,
      currentProduct: '',
      status: 'parsing',
      errors: [],
      successCount: 0,
      addedToCatalogCount: 0,
      updatedCount: 0,
    });

    try {
      await importProductsToCatalog(file, storeId, catalogId, (p) => {
        setProgress(p);
      });
    } catch (error) {
      console.error('Import error:', error);
      setProgress(prev => ({
        ...prev!,
        status: 'error',
        errors: [...(prev?.errors || []), error instanceof Error ? error.message : 'Ошибка импорта'],
      }));
    } finally {
      setIsImporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    setIsDownloadingTemplate(true);
    try {
      await downloadCatalogImportTemplate(storeId, catalogId);
    } catch (error) {
      console.error('Template download error:', error);
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const resetImport = () => {
    setProgress(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    if (progress?.status === 'done') {
      onComplete();
    }
    resetImport();
    onOpenChange(false);
  };

  const getProgressPercent = () => {
    if (!progress || progress.total === 0) return 0;
    return Math.round((progress.current / progress.total) * 100);
  };

  const getStatusText = () => {
    if (!progress) return '';
    switch (progress.status) {
      case 'parsing': return 'Чтение файла...';
      case 'importing': return `Импорт: ${progress.currentProduct}`;
      case 'uploading_images': return `Загрузка фото: ${progress.currentProduct}`;
      case 'done': return 'Готово!';
      case 'error': return 'Ошибка импорта';
      default: return '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Импорт товаров в "{catalogName}"</DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Template download section */}
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-start gap-3">
              <FileSpreadsheet className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Шаблон импорта</p>
                <p className="text-xs text-muted-foreground mb-2">
                  Скачайте шаблон, заполните его и загрузите обратно
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadTemplate}
                  disabled={isDownloadingTemplate}
                >
                  {isDownloadingTemplate ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Скачать шаблон
                </Button>
              </div>
            </div>
          </div>

          {/* Upload zone */}
          {!progress && (
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">
                Перетащите файл Excel сюда
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                или нажмите для выбора файла
              </p>
            </div>
          )}

          {/* Progress section */}
          {progress && (
            <div className="space-y-3">
              {/* Progress bar */}
              {(progress.status === 'importing' || progress.status === 'uploading_images') && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground truncate max-w-[200px]">
                      {getStatusText()}
                    </span>
                    <span className="font-medium">
                      {progress.current}/{progress.total}
                    </span>
                  </div>
                  <Progress value={getProgressPercent()} className="h-2" />
                </div>
              )}

              {/* Parsing state */}
              {progress.status === 'parsing' && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Чтение файла...</span>
                </div>
              )}

              {/* Done state */}
              {progress.status === 'done' && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-green-600 mb-2">
                    <Check className="h-5 w-5" />
                    <span className="font-medium">Импорт завершён</span>
                  </div>
                  <div className="text-sm space-y-1">
                    {progress.successCount > 0 && (
                      <p>Создано товаров: {progress.successCount}</p>
                    )}
                    {(progress.updatedCount ?? 0) > 0 && (
                      <p>Обновлено товаров: {progress.updatedCount}</p>
                    )}
                    {progress.addedToCatalogCount > 0 && (
                      <p>Добавлено в прайс-лист: {progress.addedToCatalogCount}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Error state */}
              {progress.status === 'error' && progress.errors.length > 0 && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-destructive mb-2">
                    <AlertCircle className="h-5 w-5" />
                    <span className="font-medium">Ошибка импорта</span>
                  </div>
                  <ScrollArea className="max-h-[100px]">
                    <ul className="text-sm space-y-1">
                      {progress.errors.map((error, i) => (
                        <li key={i} className="text-destructive/80">{error}</li>
                      ))}
                    </ul>
                  </ScrollArea>
                </div>
              )}

              {/* Errors during import (warnings) */}
              {progress.status === 'done' && progress.errors.length > 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-yellow-600 mb-2">
                    <AlertCircle className="h-5 w-5" />
                    <span className="font-medium">Предупреждения ({progress.errors.length})</span>
                  </div>
                  <ScrollArea className="max-h-[100px]">
                    <ul className="text-sm space-y-1">
                      {progress.errors.map((error, i) => (
                        <li key={i} className="text-yellow-600/80">{error}</li>
                      ))}
                    </ul>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {progress?.status === 'done' ? (
            <>
              <Button variant="outline" onClick={resetImport}>
                Загрузить ещё
              </Button>
              <Button onClick={handleClose}>
                Готово
              </Button>
            </>
          ) : progress?.status === 'error' ? (
            <>
              <Button variant="outline" onClick={handleClose}>
                Закрыть
              </Button>
              <Button onClick={resetImport}>
                Попробовать снова
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={handleClose} disabled={isImporting}>
              {isImporting ? 'Импорт...' : 'Отмена'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
