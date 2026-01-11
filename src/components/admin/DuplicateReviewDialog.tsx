import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, Package } from 'lucide-react';
import { DuplicateProduct } from '@/lib/excelImport';

interface DuplicateReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicates: DuplicateProduct[];
  newProductsCount: number;
  onConfirm: (duplicatesToUpdate: DuplicateProduct[]) => void;
  onSkipDuplicates: () => void;
}

export function DuplicateReviewDialog({
  open,
  onOpenChange,
  duplicates,
  newProductsCount,
  onConfirm,
  onSkipDuplicates,
}: DuplicateReviewDialogProps) {
  const [selectedDuplicates, setSelectedDuplicates] = useState<Set<string>>(
    new Set(duplicates.map(d => d.existingProduct.id))
  );

  const toggleDuplicate = (id: string) => {
    const newSelected = new Set(selectedDuplicates);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedDuplicates(newSelected);
  };

  const selectAll = () => {
    setSelectedDuplicates(new Set(duplicates.map(d => d.existingProduct.id)));
  };

  const deselectAll = () => {
    setSelectedDuplicates(new Set());
  };

  const handleConfirm = () => {
    const toUpdate = duplicates.map(d => ({
      ...d,
      shouldUpdate: selectedDuplicates.has(d.existingProduct.id),
    }));
    onConfirm(toUpdate);
  };

  const formatPrice = (price: number | null) => {
    if (price === null) return '—';
    return `${price.toLocaleString('ru-RU')} ₽`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Найдены дубликаты
          </DialogTitle>
          <DialogDescription>
            В файле найдено {duplicates.length} товар(ов) с названиями, которые уже существуют в вашем магазине.
            {newProductsCount > 0 && (
              <span className="block mt-1">
                Новых товаров для создания: {newProductsCount}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between py-2 border-b">
          <span className="text-sm text-muted-foreground">
            Выбрано: {selectedDuplicates.size} из {duplicates.length}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={selectAll}>
              Выбрать все
            </Button>
            <Button variant="ghost" size="sm" onClick={deselectAll}>
              Снять все
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-0 max-h-[40vh]">
          <div className="space-y-2 pr-4">
            {duplicates.map((duplicate) => (
              <div
                key={duplicate.existingProduct.id}
                className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                <Checkbox
                  id={duplicate.existingProduct.id}
                  checked={selectedDuplicates.has(duplicate.existingProduct.id)}
                  onCheckedChange={() => toggleDuplicate(duplicate.existingProduct.id)}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <label
                    htmlFor={duplicate.existingProduct.id}
                    className="font-medium text-foreground cursor-pointer block"
                  >
                    {duplicate.excelName}
                  </label>
                  <div className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    <span className="flex items-center gap-1">
                      <Package className="h-3 w-3" />
                      Строка Excel: {duplicate.excelRowIndex}
                    </span>
                    <span>
                      В базе: кол-во {duplicate.existingProduct.quantity}, 
                      закупка {formatPrice(duplicate.existingProduct.buy_price)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
          Отмеченные товары будут обновлены данными из Excel. Неотмеченные будут пропущены.
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onSkipDuplicates} className="w-full sm:w-auto">
            Пропустить дубликаты
          </Button>
          <Button onClick={handleConfirm} className="w-full sm:w-auto">
            {selectedDuplicates.size > 0 
              ? `Обновить выбранные (${selectedDuplicates.size})`
              : 'Только новые товары'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
