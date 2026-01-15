import React from "react";
import { Plus, RefreshCw, X, Package } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { PriceListProduct } from "@/lib/priceListImport";

interface NewProductsConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newProducts: PriceListProduct[];
  matchingCount: number;
  onAddAllAndImport: () => void;
  onUpdateExistingOnly: () => void;
  catalogName?: string;
}

export function NewProductsConfirmDialog({
  open,
  onOpenChange,
  newProducts,
  matchingCount,
  onAddAllAndImport,
  onUpdateExistingOnly,
  catalogName,
}: NewProductsConfirmDialogProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ru-RU').format(price) + ' ₽';
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md max-h-[85vh] flex flex-col">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-600" />
            Найдено {newProducts.length} новых товаров
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left">
            Этих товаров нет в вашем ассортименте. Добавить их в магазин{catalogName ? ` и в прайс-лист "${catalogName}"` : ''}?
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Matching products info */}
        <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
          <RefreshCw className="h-4 w-4 text-emerald-600 shrink-0" />
          <span className="text-sm">
            <strong className="text-emerald-700 dark:text-emerald-400">{matchingCount}</strong>{' '}
            <span className="text-muted-foreground">товаров будут обновлены</span>
          </span>
        </div>

        {/* New products list */}
        <div className="flex-1 min-h-0">
          <p className="text-sm font-medium mb-2 flex items-center gap-2">
            <Plus className="h-4 w-4 text-blue-600" />
            Новые товары:
          </p>
          <ScrollArea className="h-[200px] border rounded-lg">
            <div className="p-2 space-y-1">
              {newProducts.map((product, idx) => (
                <div 
                  key={idx} 
                  className="flex items-center justify-between px-3 py-2 rounded-md bg-muted/50 hover:bg-muted transition-colors"
                >
                  <span className="text-sm truncate flex-1 mr-2">{product.name}</span>
                  <Badge variant="outline" className="shrink-0 text-xs font-mono">
                    {formatPrice(product.buyPrice)}
                  </Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
          <Button 
            onClick={onAddAllAndImport}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Добавить все и импортировать
          </Button>
          <Button 
            variant="outline" 
            onClick={onUpdateExistingOnly}
            className="w-full"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Только обновить существующие ({matchingCount})
          </Button>
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)}
            className="w-full text-muted-foreground"
          >
            <X className="h-4 w-4 mr-2" />
            Отмена
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
