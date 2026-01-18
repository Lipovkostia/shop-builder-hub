import React, { useState, useEffect } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface CatalogExportColumn {
  id: string;
  label: string;
  enabled: boolean;
}

export const CATALOG_EXPORT_COLUMNS: CatalogExportColumn[] = [
  { id: 'sku', label: 'Код товара', enabled: true },
  { id: 'photo', label: 'Фото', enabled: true },
  { id: 'name', label: 'Название', enabled: true },
  { id: 'description', label: 'Описание', enabled: true },
  { id: 'categories', label: 'Категории', enabled: true },
  { id: 'unit', label: 'Ед. изм.', enabled: true },
  { id: 'volume', label: 'Объем', enabled: true },
  { id: 'type', label: 'Вид (тип фасовки)', enabled: true },
  { id: 'buyPrice', label: 'Себестоимость', enabled: true },
  { id: 'markup', label: 'Наценка', enabled: true },
  { id: 'price', label: 'Цена', enabled: true },
  { id: 'priceFull', label: 'Целая', enabled: true },
  { id: 'priceHalf', label: '½', enabled: true },
  { id: 'priceQuarter', label: '¼', enabled: true },
  { id: 'pricePortion', label: 'Порция', enabled: true },
  { id: 'status', label: 'Статус', enabled: true },
];

const STORAGE_KEY = 'catalog_export_columns';

interface CatalogExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalogName: string;
  onExport: (enabledColumns: string[]) => void;
  isExporting: boolean;
  productCount: number;
}

export function CatalogExportDialog({
  open,
  onOpenChange,
  catalogName,
  onExport,
  isExporting,
  productCount,
}: CatalogExportDialogProps) {
  const [columns, setColumns] = useState<CatalogExportColumn[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const savedColumns = JSON.parse(saved) as Record<string, boolean>;
        return CATALOG_EXPORT_COLUMNS.map(col => ({
          ...col,
          enabled: savedColumns[col.id] ?? col.enabled,
        }));
      }
    } catch (e) {
      console.error('Error loading saved columns:', e);
    }
    return CATALOG_EXPORT_COLUMNS;
  });

  // Save to localStorage when columns change
  useEffect(() => {
    const columnsState: Record<string, boolean> = {};
    columns.forEach(col => {
      columnsState[col.id] = col.enabled;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(columnsState));
  }, [columns]);

  const toggleColumn = (id: string) => {
    setColumns(prev => prev.map(col => 
      col.id === id ? { ...col, enabled: !col.enabled } : col
    ));
  };

  const enabledCount = columns.filter(c => c.enabled).length;

  const handleExport = () => {
    const enabledColumns = columns.filter(c => c.enabled).map(c => c.id);
    onExport(enabledColumns);
  };

  const selectAll = () => {
    setColumns(prev => prev.map(col => ({ ...col, enabled: true })));
  };

  const deselectAll = () => {
    setColumns(prev => prev.map(col => ({ ...col, enabled: false })));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Экспорт прайс-листа "{catalogName}"</DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-muted-foreground">
              Выберите поля для выгрузки ({enabledCount} из {columns.length}):
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
          
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-2">
              {columns.map(column => (
                <div 
                  key={column.id} 
                  className="flex items-center space-x-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                  onClick={() => toggleColumn(column.id)}
                >
                  <Checkbox 
                    id={column.id}
                    checked={column.enabled}
                    onCheckedChange={() => toggleColumn(column.id)}
                  />
                  <label 
                    htmlFor={column.id} 
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
                Экспорт...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Скачать ({productCount} товаров)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
