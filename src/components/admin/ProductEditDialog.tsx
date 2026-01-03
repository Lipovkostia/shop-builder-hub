import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Product,
  PackagingType,
  MarkupSettings,
  packagingTypeLabels,
  unitOptions,
  formatPrice,
  calculateSalePrice,
  calculatePackagingPrices,
} from "./ProductTypes";

interface ProductEditDialogProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (product: Product) => void;
}

export function ProductEditDialog({
  product,
  open,
  onOpenChange,
  onSave,
}: ProductEditDialogProps) {
  const [editedProduct, setEditedProduct] = useState<Product | null>(product);

  // Sync state when product changes
  if (product && editedProduct?.id !== product.id) {
    setEditedProduct(product);
  }

  if (!editedProduct) return null;

  const handleSave = () => {
    if (editedProduct) {
      onSave(editedProduct);
      onOpenChange(false);
    }
  };

  const updateMarkup = (field: keyof MarkupSettings, value: string | number) => {
    setEditedProduct((prev) => {
      if (!prev) return prev;
      const currentMarkup = prev.markup || { type: "percent", value: 0 };
      return {
        ...prev,
        markup: {
          ...currentMarkup,
          [field]: field === "value" ? Number(value) : value,
        } as MarkupSettings,
      };
    });
  };

  const salePriceWithMarkup = editedProduct.buyPrice
    ? calculateSalePrice(editedProduct.buyPrice, editedProduct.markup)
    : editedProduct.pricePerUnit;

  const packagingPrices = calculatePackagingPrices(
    salePriceWithMarkup,
    editedProduct.unitWeight,
    editedProduct.packagingType
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Редактирование товара</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Название */}
          <div className="space-y-2">
            <Label>Название</Label>
            <Input
              value={editedProduct.name}
              onChange={(e) =>
                setEditedProduct((prev) =>
                  prev ? { ...prev, name: e.target.value } : prev
                )
              }
            />
          </div>

          {/* Единица измерения */}
          <div className="space-y-2">
            <Label>Единица измерения</Label>
            <Select
              value={editedProduct.unit}
              onValueChange={(value) =>
                setEditedProduct((prev) =>
                  prev ? { ...prev, unit: value } : prev
                )
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {unitOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Тип упаковки */}
          <div className="space-y-2">
            <Label>Вид товара / упаковка</Label>
            <Select
              value={editedProduct.packagingType || "piece"}
              onValueChange={(value) =>
                setEditedProduct((prev) =>
                  prev ? { ...prev, packagingType: value as PackagingType } : prev
                )
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(packagingTypeLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Вес единицы (для головки) */}
          {editedProduct.packagingType === "head" && (
            <div className="space-y-2">
              <Label>Вес головки (кг)</Label>
              <Input
                type="number"
                step="0.1"
                value={editedProduct.unitWeight || ""}
                onChange={(e) =>
                  setEditedProduct((prev) =>
                    prev
                      ? { ...prev, unitWeight: parseFloat(e.target.value) || 0 }
                      : prev
                  )
                }
                placeholder="Например: 5.5"
              />
            </div>
          )}

          {/* Себестоимость */}
          <div className="space-y-2">
            <Label>Себестоимость (за {editedProduct.unit})</Label>
            <Input
              type="number"
              value={editedProduct.buyPrice || ""}
              onChange={(e) =>
                setEditedProduct((prev) =>
                  prev
                    ? { ...prev, buyPrice: parseFloat(e.target.value) || 0 }
                    : prev
                )
              }
              placeholder="Закупочная цена"
            />
          </div>

          {/* Наценка */}
          {editedProduct.buyPrice !== undefined && editedProduct.buyPrice > 0 && (
            <div className="space-y-2">
              <Label>Наценка</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  className="flex-1"
                  value={editedProduct.markup?.value || ""}
                  onChange={(e) => updateMarkup("value", e.target.value)}
                  placeholder="Значение наценки"
                />
                <Select
                  value={editedProduct.markup?.type || "percent"}
                  onValueChange={(value) => updateMarkup("type", value)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">%</SelectItem>
                    <SelectItem value="rubles">₽</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                Цена продажи: {formatPrice(salePriceWithMarkup)}/{editedProduct.unit}
              </p>
            </div>
          )}

          {/* Цена (если нет себестоимости) */}
          {(!editedProduct.buyPrice || editedProduct.buyPrice === 0) && (
            <div className="space-y-2">
              <Label>Цена за {editedProduct.unit}</Label>
              <Input
                type="number"
                value={editedProduct.pricePerUnit || ""}
                onChange={(e) =>
                  setEditedProduct((prev) =>
                    prev
                      ? { ...prev, pricePerUnit: parseFloat(e.target.value) || 0 }
                      : prev
                  )
                }
              />
            </div>
          )}

          {/* Расчёт цен для головки сыра */}
          {packagingPrices && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <Label className="text-sm font-medium">Цены за единицы</Label>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-background rounded p-2">
                  <div className="text-xs text-muted-foreground">Целая</div>
                  <div className="font-semibold text-sm">
                    {formatPrice(packagingPrices.full)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {editedProduct.unitWeight} кг
                  </div>
                </div>
                <div className="bg-background rounded p-2">
                  <div className="text-xs text-muted-foreground">Половина</div>
                  <div className="font-semibold text-sm">
                    {formatPrice(packagingPrices.half)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {(editedProduct.unitWeight || 0) / 2} кг
                  </div>
                </div>
                <div className="bg-background rounded p-2">
                  <div className="text-xs text-muted-foreground">Четверть</div>
                  <div className="font-semibold text-sm">
                    {formatPrice(packagingPrices.quarter)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {(editedProduct.unitWeight || 0) / 4} кг
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button onClick={handleSave}>Сохранить</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
