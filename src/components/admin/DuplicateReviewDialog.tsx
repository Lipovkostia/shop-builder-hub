import React, { useState, useEffect } from 'react';
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
import { AlertTriangle } from 'lucide-react';
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
  const [selectedDuplicates, setSelectedDuplicates] = useState<Set<string>>(new Set());

  // Reset selection when dialog opens with new duplicates
  useEffect(() => {
    if (open) {
      setSelectedDuplicates(new Set(duplicates.map(d => d.existingProduct.id)));
    }
  }, [open, duplicates]);

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
      <DialogContent className="max-w-md sm:max-w-lg p-4 sm:p-6 gap-3">
        <DialogHeader className="space-y-1.5">
          <DialogTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
            Найдены дубликаты ({duplicates.length})
          </DialogTitle>
          <DialogDescription className="text-xs">
            {newProductsCount > 0 && `Новых: ${newProductsCount} • `}
            Выберите товары для обновления
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between py-1.5 border-b text-xs">
          <span className="text-muted-foreground">
            Выбрано: {selectedDuplicates.size}/{duplicates.length}
          </span>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={selectAll}>
              Все
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={deselectAll}>
              Сбросить
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[200px] sm:h-[280px] -mx-1 px-1">
          <div className="space-y-1.5">
            {duplicates.map((duplicate) => (
              <label
                key={duplicate.existingProduct.id}
                htmlFor={duplicate.existingProduct.id}
                className="flex items-center gap-2.5 p-2 rounded-md border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
              >
                <Checkbox
                  id={duplicate.existingProduct.id}
                  checked={selectedDuplicates.has(duplicate.existingProduct.id)}
                  onCheckedChange={() => toggleDuplicate(duplicate.existingProduct.id)}
                  className="shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">
                    {duplicate.excelName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Стр. {duplicate.excelRowIndex} • {duplicate.existingProduct.quantity} шт • {formatPrice(duplicate.existingProduct.buy_price)}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </ScrollArea>

        <p className="text-xs text-muted-foreground py-1">
          Отмеченные будут обновлены из Excel
        </p>

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onSkipDuplicates} className="w-full sm:w-auto">
            Пропустить
          </Button>
          <Button size="sm" onClick={handleConfirm} className="w-full sm:w-auto">
            {selectedDuplicates.size > 0 
              ? `Обновить (${selectedDuplicates.size})`
              : 'Только новые'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
