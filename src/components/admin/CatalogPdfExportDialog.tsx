import React, { useState, useEffect } from "react";
import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface PdfExportColumn {
  id: string;
  label: string;
  enabled: boolean;
}

const PDF_EXPORT_COLUMNS: PdfExportColumn[] = [
  { id: 'sku', label: 'Код товара', enabled: false },
  { id: 'name', label: 'Название', enabled: true },
  { id: 'description', label: 'Описание', enabled: false },
  { id: 'categories', label: 'Категории', enabled: false },
  { id: 'unit', label: 'Ед. изм.', enabled: false },
  { id: 'volume', label: 'Объем', enabled: false },
  { id: 'type', label: 'Вид (тип фасовки)', enabled: false },
  { id: 'buyPrice', label: 'Себестоимость', enabled: false },
  { id: 'markup', label: 'Наценка', enabled: false },
  { id: 'price', label: 'Цена', enabled: true },
  { id: 'priceFull', label: 'Целая', enabled: false },
  { id: 'priceHalf', label: '½', enabled: false },
  { id: 'priceQuarter', label: '¼', enabled: false },
  { id: 'pricePortion', label: 'Порция', enabled: false },
  { id: 'status', label: 'Статус', enabled: false },
];

const STORAGE_KEY = 'catalog_pdf_export_columns';
const STORAGE_KEY_PHOTOS = 'catalog_pdf_export_photos';

interface CatalogPdfExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalogName: string;
  onExport: (enabledColumns: string[], includePhotos: boolean) => void;
  isExporting: boolean;
  productCount: number;
  exportProgress?: { current: number; total: number } | null;
}

export function CatalogPdfExportDialog({
  open,
  onOpenChange,
  catalogName,
  onExport,
  isExporting,
  productCount,
  exportProgress,
}: CatalogPdfExportDialogProps) {
  const [columns, setColumns] = useState<PdfExportColumn[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const savedColumns = JSON.parse(saved) as Record<string, boolean>;
        return PDF_EXPORT_COLUMNS.map(col => ({
          ...col,
          enabled: savedColumns[col.id] ?? col.enabled,
        }));
      }
    } catch {
      // ignore
    }
    return PDF_EXPORT_COLUMNS;
  });

  const [includePhotos, setIncludePhotos] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PHOTOS);
      return saved ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    const state: Record<string, boolean> = {};
    columns.forEach(col => { state[col.id] = col.enabled; });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [columns]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PHOTOS, JSON.stringify(includePhotos));
  }, [includePhotos]);

  const toggleColumn = (id: string) => {
    setColumns(prev => prev.map(col =>
      col.id === id ? { ...col, enabled: !col.enabled } : col
    ));
  };

  const enabledCount = columns.filter(c => c.enabled).length;

  const handleExport = () => {
    const enabledColumns = columns.filter(c => c.enabled).map(c => c.id);
    onExport(enabledColumns, includePhotos);
  };

  const selectAll = () => setColumns(prev => prev.map(col => ({ ...col, enabled: true })));
  const deselectAll = () => setColumns(prev => prev.map(col => ({ ...col, enabled: false })));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Экспорт в PDF "{catalogName}"</DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Photos toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
            <Label htmlFor="include-photos" className="text-sm font-medium cursor-pointer">
              С фотографиями товаров
            </Label>
            <Switch
              id="include-photos"
              checked={includePhotos}
              onCheckedChange={setIncludePhotos}
            />
          </div>

          {/* Column selection */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Столбцы ({enabledCount} из {columns.length}):
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={selectAll}>
                Все
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={deselectAll}>
                Сбросить
              </Button>
            </div>
          </div>

          <ScrollArea className="h-[260px] pr-4">
            <div className="space-y-1">
              {columns.map(column => (
                <div
                  key={column.id}
                  className="flex items-center space-x-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                  onClick={() => toggleColumn(column.id)}
                >
                  <Checkbox
                    id={`pdf-${column.id}`}
                    checked={column.enabled}
                    onCheckedChange={() => toggleColumn(column.id)}
                  />
                  <label
                    htmlFor={`pdf-${column.id}`}
                    className="text-sm font-medium leading-none cursor-pointer flex-1"
                  >
                    {column.label}
                  </label>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting || enabledCount === 0}
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {exportProgress
                  ? `Загрузка фото ${exportProgress.current}/${exportProgress.total}...`
                  : 'Генерация PDF...'}
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Скачать PDF ({productCount} товаров)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
