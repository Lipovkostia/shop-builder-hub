import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import {
  Product,
  PackagingType,
  MarkupSettings,
  CustomVariantPrices,
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
    editedProduct.packagingType,
    editedProduct.customVariantPrices
  );

  const updateCustomPrice = (field: keyof CustomVariantPrices, value: string) => {
    setEditedProduct((prev) => {
      if (!prev) return prev;
      const numValue = parseFloat(value);
      const currentPrices = prev.customVariantPrices || {};
      
      // Если значение пустое или 0, удаляем кастомную цену
      if (!value || numValue === 0) {
        const { [field]: _, ...rest } = currentPrices;
        return {
          ...prev,
          customVariantPrices: Object.keys(rest).length > 0 ? rest : undefined,
        };
      }
      
      return {
        ...prev,
        customVariantPrices: {
          ...currentPrices,
          [field]: numValue,
        },
      };
    });
  };

  const clearCustomPrice = (field: keyof CustomVariantPrices) => {
    setEditedProduct((prev) => {
      if (!prev) return prev;
      const currentPrices = prev.customVariantPrices || {};
      const { [field]: _, ...rest } = currentPrices;
      return {
        ...prev,
        customVariantPrices: Object.keys(rest).length > 0 ? rest : undefined,
      };
    });
  };

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
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  className="flex-1"
                  value={editedProduct.markup?.value || ""}
                  onChange={(e) => updateMarkup("value", e.target.value)}
                  placeholder="Значение наценки"
                />
                <div className="flex items-center gap-2 min-w-[100px]">
                  <span className={`text-sm font-medium ${(editedProduct.markup?.type || "percent") === "rubles" ? "text-muted-foreground" : "text-foreground"}`}>
                    %
                  </span>
                  <Switch
                    checked={(editedProduct.markup?.type || "percent") === "rubles"}
                    onCheckedChange={(checked) => updateMarkup("type", checked ? "rubles" : "percent")}
                  />
                  <span className={`text-sm font-medium ${(editedProduct.markup?.type || "percent") === "rubles" ? "text-foreground" : "text-muted-foreground"}`}>
                    ₽
                  </span>
                </div>
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
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
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
                  {packagingPrices.isHalfCustom && (
                    <div className="text-xs text-primary">своя цена</div>
                  )}
                </div>
                <div className="bg-background rounded p-2">
                  <div className="text-xs text-muted-foreground">Четверть</div>
                  <div className="font-semibold text-sm">
                    {formatPrice(packagingPrices.quarter)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {(editedProduct.unitWeight || 0) / 4} кг
                  </div>
                  {packagingPrices.isQuarterCustom && (
                    <div className="text-xs text-primary">своя цена</div>
                  )}
                </div>
              </div>

              {/* Кастомные цены */}
              <div className="border-t pt-3 mt-3 space-y-3">
                <Label className="text-xs text-muted-foreground">
                  Своя цена за половину / четверть (оставьте пустым для авторасчёта)
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Половина</Label>
                    <div className="flex gap-1">
                      <Input
                        type="number"
                        placeholder="Авто"
                        value={editedProduct.customVariantPrices?.halfPrice || ""}
                        onChange={(e) => updateCustomPrice("halfPrice", e.target.value)}
                        className="h-8 text-sm"
                      />
                      {editedProduct.customVariantPrices?.halfPrice && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => clearCustomPrice("halfPrice")}
                        >
                          ✕
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Четверть</Label>
                    <div className="flex gap-1">
                      <Input
                        type="number"
                        placeholder="Авто"
                        value={editedProduct.customVariantPrices?.quarterPrice || ""}
                        onChange={(e) => updateCustomPrice("quarterPrice", e.target.value)}
                        className="h-8 text-sm"
                      />
                      {editedProduct.customVariantPrices?.quarterPrice && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => clearCustomPrice("quarterPrice")}
                        >
                          ✕
                        </Button>
                      )}
                    </div>
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
