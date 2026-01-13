import React, { useState } from "react";
import { AlertCircle, Plus, PackageSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface NewProductInfo {
  rowIndex: number;
  name: string;
  category?: string;
  description?: string;
}

interface CatalogNewProductsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newProducts: NewProductInfo[];
  existingProductsCount: number;
  onConfirm: (selectedProducts: NewProductInfo[]) => void;
  onCancel: () => void;
}

export function CatalogNewProductsDialog({
  open,
  onOpenChange,
  newProducts,
  existingProductsCount,
  onConfirm,
  onCancel,
}: CatalogNewProductsDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(
    new Set(newProducts.map(p => p.rowIndex))
  );

  const toggleProduct = (rowIndex: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(rowIndex)) {
        next.delete(rowIndex);
      } else {
        next.add(rowIndex);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(newProducts.map(p => p.rowIndex)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleConfirm = () => {
    const selected = newProducts.filter(p => selectedIds.has(p.rowIndex));
    onConfirm(selected);
  };

  const handleCancel = () => {
    onCancel();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageSearch className="h-5 w-5" />
            Найдены новые товары ({newProducts.length})
          </DialogTitle>
          <DialogDescription>
            Эти товары отсутствуют в ассортименте. Выберите, какие добавить в ассортимент и прайс-лист.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          {/* Selection controls */}
          <div className="flex gap-2 mb-3">
            <Button
              variant="outline"
              size="sm"
              onClick={selectAll}
              disabled={selectedIds.size === newProducts.length}
            >
              Выбрать все
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={deselectAll}
              disabled={selectedIds.size === 0}
            >
              Снять все
            </Button>
            <Badge variant="secondary" className="ml-auto">
              Выбрано: {selectedIds.size} из {newProducts.length}
            </Badge>
          </div>

          {/* Products list */}
          <ScrollArea className="h-[280px] border rounded-md">
            <div className="p-2 space-y-1">
              {newProducts.map((product) => (
                <div
                  key={product.rowIndex}
                  className={`flex items-start gap-3 p-2 rounded-md transition-colors cursor-pointer hover:bg-muted/50 ${
                    selectedIds.has(product.rowIndex) ? 'bg-primary/5' : ''
                  }`}
                  onClick={() => toggleProduct(product.rowIndex)}
                >
                  <Checkbox
                    checked={selectedIds.has(product.rowIndex)}
                    onCheckedChange={() => toggleProduct(product.rowIndex)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{product.name}</p>
                    {product.category && (
                      <p className="text-xs text-muted-foreground truncate">
                        Категория: {product.category}
                      </p>
                    )}
                    {product.description && (
                      <p className="text-xs text-muted-foreground truncate">
                        {product.description}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    <Plus className="h-3 w-3 mr-1" />
                    Новый
                  </Badge>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Info about existing products */}
          {existingProductsCount > 0 && (
            <div className="mt-3 p-2 bg-muted/50 rounded-md flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Существующие товары ({existingProductsCount}) будут обновлены в прайс-листе
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleCancel}>
            Отмена
          </Button>
          <Button onClick={handleConfirm}>
            {selectedIds.size > 0 ? (
              <>Продолжить импорт ({selectedIds.size} новых)</>
            ) : (
              <>Продолжить (только обновление)</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
