import React, { useState, useMemo } from "react";
import { Plus, RefreshCw, ArrowRight, PackageSearch, EyeOff } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CatalogImportCheck, NewProductToCreate } from "@/lib/excelImport";

const STATUS_LABELS: Record<string, string> = {
  'in_stock': 'В наличии',
  'out_of_stock': 'Нет в наличии',
  'pre_order': 'Под заказ',
  'coming_soon': 'Ожидается',
  'hidden': 'Скрыт',
};

function formatPrice(price: number | null | undefined): string {
  if (price === undefined || price === null || isNaN(price) || price === 0) return '—';
  return new Intl.NumberFormat('ru-RU').format(price) + ' ₽';
}

interface CatalogImportPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  importCheck: CatalogImportCheck;
  onConfirm: (selectedNewProducts: NewProductToCreate[]) => void;
  onCancel: () => void;
}

export function CatalogImportPreviewDialog({
  open,
  onOpenChange,
  importCheck,
  onConfirm,
  onCancel,
}: CatalogImportPreviewDialogProps) {
  // Filter new products: only those with valid price
  const validNewProducts = useMemo(
    () => importCheck.newProducts.filter(p => p.buyPrice !== undefined && p.buyPrice > 0),
    [importCheck.newProducts]
  );

  const [selectedNewIds, setSelectedNewIds] = useState<Set<number>>(
    () => new Set(validNewProducts.map(p => p.rowIndex))
  );

  const toggleNewProduct = (rowIndex: number) => {
    setSelectedNewIds(prev => {
      const next = new Set(prev);
      if (next.has(rowIndex)) next.delete(rowIndex);
      else next.add(rowIndex);
      return next;
    });
  };

  const handleConfirm = () => {
    const selected: NewProductToCreate[] = validNewProducts
      .filter(p => selectedNewIds.has(p.rowIndex))
      .map(p => ({ rowIndex: p.rowIndex, name: p.name }));
    onConfirm(selected);
  };

  const handleCancel = () => {
    onCancel();
    onOpenChange(false);
  };

  // Count updates with actual changes
  const updatesWithPriceChange = importCheck.existingProducts.filter(
    p => p.newBuyPrice !== null && p.newBuyPrice !== p.currentBuyPrice
  ).length;

  const updatesWithStatusChange = importCheck.existingProducts.filter(
    p => p.newStatus !== null && p.newStatus !== p.currentStatus
  ).length;

  const skippedNewCount = importCheck.newProducts.length - validNewProducts.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageSearch className="h-5 w-5" />
            Предпросмотр импорта
          </DialogTitle>
          <DialogDescription>
            Проверьте изменения перед импортом. Новые товары можно выбрать чекбоксом.
          </DialogDescription>
        </DialogHeader>

        {/* Summary badges */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="gap-1.5 py-1">
            <RefreshCw className="h-3.5 w-3.5 text-blue-500" />
            Обновление: {importCheck.existingProducts.length}
          </Badge>
          {validNewProducts.length > 0 && (
            <Badge variant="outline" className="gap-1.5 py-1">
              <Plus className="h-3.5 w-3.5 text-green-500" />
              Новых: {validNewProducts.length}
            </Badge>
          )}
          {skippedNewCount > 0 && (
            <Badge variant="outline" className="gap-1.5 py-1 text-muted-foreground">
              <EyeOff className="h-3.5 w-3.5" />
              Пропущено (без цены): {skippedNewCount}
            </Badge>
          )}
          {updatesWithPriceChange > 0 && (
            <Badge variant="secondary" className="gap-1.5 py-1 text-xs">
              Цена изменится: {updatesWithPriceChange}
            </Badge>
          )}
        </div>

        {/* Table */}
        <div className="flex-1 min-h-0 border rounded-md overflow-hidden">
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Товар</TableHead>
                  <TableHead className="w-[100px]">Действие</TableHead>
                  <TableHead className="w-[180px]">Себестоимость</TableHead>
                  <TableHead className="w-[120px]">Статус</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Existing products (updates) */}
                {importCheck.existingProducts.map((item, idx) => {
                  const priceChanged = item.newBuyPrice !== null && item.newBuyPrice !== item.currentBuyPrice;
                  const statusChanged = item.newStatus !== null && item.newStatus !== item.currentStatus;
                  return (
                    <TableRow key={`existing-${idx}`} className="h-10">
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>
                        <span className="font-medium">{item.productName}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs gap-1">
                          <RefreshCw className="h-3 w-3" />
                          Обновить
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {priceChanged ? (
                          <span className="flex items-center gap-1 text-xs">
                            <span className="text-muted-foreground line-through">
                              {formatPrice(item.currentBuyPrice)}
                            </span>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            <span className="font-medium text-blue-600">
                              {formatPrice(item.newBuyPrice)}
                            </span>
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {formatPrice(item.currentBuyPrice)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {statusChanged ? (
                          <span className="text-xs">
                            <span className="text-muted-foreground">
                              {STATUS_LABELS[item.currentStatus || ''] || '—'}
                            </span>
                            {' → '}
                            <span className="font-medium text-blue-600">
                              {STATUS_LABELS[item.newStatus || ''] || '—'}
                            </span>
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}

                {/* New products */}
                {validNewProducts.map((item, idx) => (
                  <TableRow
                    key={`new-${idx}`}
                    className="h-10 bg-green-50/50 dark:bg-green-950/10 cursor-pointer"
                    onClick={() => toggleNewProduct(item.rowIndex)}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedNewIds.has(item.rowIndex)}
                        onCheckedChange={() => toggleNewProduct(item.rowIndex)}
                      />
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{item.name}</span>
                      {item.category && (
                        <span className="text-xs text-muted-foreground ml-2">
                          ({item.category})
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className="text-xs gap-1 bg-green-600 hover:bg-green-700">
                        <Plus className="h-3 w-3" />
                        Создать
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-medium">{formatPrice(item.buyPrice ?? null)}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">—</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>

        {/* Errors */}
        {importCheck.errors.length > 0 && (
          <div className="text-xs text-destructive">
            {importCheck.errors.slice(0, 3).join('; ')}
            {importCheck.errors.length > 3 && ` и ещё ${importCheck.errors.length - 3}`}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleCancel}>
            Отмена
          </Button>
          <Button onClick={handleConfirm}>
            Импортировать
            {selectedNewIds.size > 0 && ` (+${selectedNewIds.size} новых)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
