import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  PortionPrices,
  CustomerRole,
  RoleProductPricing,
  packagingTypeLabels,
  unitOptions,
  formatPrice,
  calculateSalePrice,
  calculatePackagingPrices,
} from "./types";
import { Badge } from "@/components/ui/badge";

interface ProductPricingDialogProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (product: Product) => void;
  customerRoles?: CustomerRole[];
  rolePricing?: RoleProductPricing[];
  onSaveRolePricing?: (pricing: RoleProductPricing[]) => void;
}

export function ProductPricingDialog({
  product,
  open,
  onOpenChange,
  onSave,
  customerRoles = [],
  rolePricing = [],
  onSaveRolePricing,
}: ProductPricingDialogProps) {
  const [editedProduct, setEditedProduct] = useState<Product | null>(null);
  const [localRolePricing, setLocalRolePricing] = useState<RoleProductPricing[]>([]);
  const [activeTab, setActiveTab] = useState("basic");

  useEffect(() => {
    if (product) {
      setEditedProduct({ ...product });
      setLocalRolePricing(rolePricing.filter(rp => rp.product_id === product.id));
    }
  }, [product, rolePricing]);

  if (!editedProduct) return null;

  const handleSave = () => {
    if (editedProduct) {
      onSave(editedProduct);
      if (onSaveRolePricing) {
        onSaveRolePricing(localRolePricing);
      }
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

  const updatePortionPrice = (field: keyof PortionPrices, value: string) => {
    setEditedProduct((prev) => {
      if (!prev) return prev;
      const numValue = parseFloat(value);
      const currentPrices = prev.portionPrices || {};
      
      if (!value || numValue === 0) {
        const { [field]: _, ...rest } = currentPrices;
        return {
          ...prev,
          portionPrices: Object.keys(rest).length > 0 ? rest : undefined,
        };
      }
      
      return {
        ...prev,
        portionPrices: {
          ...currentPrices,
          [field]: numValue,
        },
      };
    });
  };

  const updateRolePricing = (roleId: string, field: "markup_type" | "markup_value", value: string | number) => {
    setLocalRolePricing(prev => {
      const existing = prev.find(rp => rp.role_id === roleId);
      if (existing) {
        return prev.map(rp => 
          rp.role_id === roleId 
            ? { ...rp, [field]: field === "markup_value" ? Number(value) : value }
            : rp
        );
      } else {
        return [...prev, {
          id: `temp_${Date.now()}_${roleId}`,
          product_id: editedProduct.id,
          role_id: roleId,
          markup_type: field === "markup_type" ? value as "percent" | "rubles" : "percent",
          markup_value: field === "markup_value" ? Number(value) : 0,
        }];
      }
    });
  };

  const getRolePricing = (roleId: string): RoleProductPricing | undefined => {
    return localRolePricing.find(rp => rp.role_id === roleId);
  };

  const salePriceWithMarkup = editedProduct.buyPrice
    ? calculateSalePrice(editedProduct.buyPrice, editedProduct.markup)
    : editedProduct.pricePerUnit;

  const packagingPrices = calculatePackagingPrices(
    salePriceWithMarkup,
    editedProduct.unitWeight,
    editedProduct.packagingType,
    editedProduct.customVariantPrices,
    editedProduct.portionPrices
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Редактирование товара</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">Основное</TabsTrigger>
            <TabsTrigger value="portions">Цены порций</TabsTrigger>
            <TabsTrigger value="roles">Роли/Наценки</TabsTrigger>
          </TabsList>

          {/* Основные настройки */}
          <TabsContent value="basic" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
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
              <div className="space-y-2">
                <Label>Номенклатура (SKU)</Label>
                <Input
                  value={editedProduct.sku || ""}
                  onChange={(e) =>
                    setEditedProduct((prev) =>
                      prev ? { ...prev, sku: e.target.value } : prev
                    )
                  }
                  placeholder="Уникальный идентификатор"
                  className="font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
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
            </div>

            {editedProduct.packagingType === "head" && (
              <div className="space-y-2">
                <Label>Вес единицы (кг)</Label>
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

            <div className="grid grid-cols-2 gap-4">
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

              {editedProduct.buyPrice !== undefined && editedProduct.buyPrice > 0 && (
                <div className="space-y-2">
                  <Label>Наценка</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      className="flex-1"
                      value={editedProduct.markup?.value || ""}
                      onChange={(e) => updateMarkup("value", e.target.value)}
                      placeholder="Значение"
                    />
                    <div className="flex items-center gap-2 min-w-[80px]">
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
                </div>
              )}
            </div>

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

            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm">
                <span className="text-muted-foreground">Базовая цена продажи: </span>
                <span className="font-semibold">{formatPrice(salePriceWithMarkup)}/{editedProduct.unit}</span>
              </p>
            </div>
          </TabsContent>

          {/* Цены порций */}
          <TabsContent value="portions" className="space-y-4 mt-4">
            {editedProduct.packagingType === "head" && editedProduct.unitWeight ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Установите специальные цены за кг для разных порций. Если оставить пустым — будет использоваться базовая цена {formatPrice(salePriceWithMarkup)}/кг.
                </p>

                <div className="space-y-4">
                  {/* Цена за целую */}
                  <div className="bg-card border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base">Целая ({editedProduct.unitWeight} кг)</Label>
                        <p className="text-xs text-muted-foreground">Цена за кг при покупке целиком</p>
                      </div>
                      <Badge variant="outline">
                        {packagingPrices ? formatPrice(packagingPrices.full) : "—"}
                      </Badge>
                    </div>
                    <Input
                      type="number"
                      placeholder={`${salePriceWithMarkup} ₽/кг (базовая)`}
                      value={editedProduct.portionPrices?.fullPricePerKg || ""}
                      onChange={(e) => updatePortionPrice("fullPricePerKg", e.target.value)}
                    />
                  </div>

                  {/* Цена за половину */}
                  <div className="bg-card border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base">Половина ({(editedProduct.unitWeight / 2).toFixed(1)} кг)</Label>
                        <p className="text-xs text-muted-foreground">Цена за кг при покупке половины</p>
                      </div>
                      <Badge variant="outline">
                        {packagingPrices ? formatPrice(packagingPrices.half) : "—"}
                      </Badge>
                    </div>
                    <Input
                      type="number"
                      placeholder={`${salePriceWithMarkup} ₽/кг (базовая)`}
                      value={editedProduct.portionPrices?.halfPricePerKg || ""}
                      onChange={(e) => updatePortionPrice("halfPricePerKg", e.target.value)}
                    />
                  </div>

                  {/* Цена за четверть */}
                  <div className="bg-card border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base">Четверть ({(editedProduct.unitWeight / 4).toFixed(1)} кг)</Label>
                        <p className="text-xs text-muted-foreground">Цена за кг при покупке четверти</p>
                      </div>
                      <Badge variant="outline">
                        {packagingPrices ? formatPrice(packagingPrices.quarter) : "—"}
                      </Badge>
                    </div>
                    <Input
                      type="number"
                      placeholder={`${salePriceWithMarkup} ₽/кг (базовая)`}
                      value={editedProduct.portionPrices?.quarterPricePerKg || ""}
                      onChange={(e) => updatePortionPrice("quarterPricePerKg", e.target.value)}
                    />
                  </div>

                  {/* Цена за порцию (фикс.) */}
                  <div className="bg-card border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base">Порция (фикс. цена)</Label>
                        <p className="text-xs text-muted-foreground">Фиксированная цена за одну порцию</p>
                      </div>
                      <Badge variant="outline">
                        {editedProduct.portionPrices?.portionPrice 
                          ? formatPrice(editedProduct.portionPrices.portionPrice) 
                          : "—"}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Вес порции (кг)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="0.5"
                          value={editedProduct.portionWeight || ""}
                          onChange={(e) =>
                            setEditedProduct((prev) =>
                              prev
                                ? { ...prev, portionWeight: parseFloat(e.target.value) || 0 }
                                : prev
                            )
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Цена порции (₽)</Label>
                        <Input
                          type="number"
                          placeholder="Авто"
                          value={editedProduct.portionPrices?.portionPrice || ""}
                          onChange={(e) => updatePortionPrice("portionPrice", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Превью цен */}
                {packagingPrices && (
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                    <Label className="text-sm font-medium mb-3 block">Итоговые цены для покупателя</Label>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div className="bg-background rounded p-2">
                        <div className="text-xs text-muted-foreground">Целая</div>
                        <div className="font-semibold">{formatPrice(packagingPrices.full)}</div>
                        <div className="text-xs text-muted-foreground">{editedProduct.unitWeight} кг</div>
                        {packagingPrices.isFullCustom && (
                          <Badge variant="secondary" className="text-[10px] mt-1">своя цена</Badge>
                        )}
                      </div>
                      <div className="bg-background rounded p-2">
                        <div className="text-xs text-muted-foreground">½</div>
                        <div className="font-semibold">{formatPrice(packagingPrices.half)}</div>
                        <div className="text-xs text-muted-foreground">{(editedProduct.unitWeight / 2).toFixed(1)} кг</div>
                        {packagingPrices.isHalfCustom && (
                          <Badge variant="secondary" className="text-[10px] mt-1">своя цена</Badge>
                        )}
                      </div>
                      <div className="bg-background rounded p-2">
                        <div className="text-xs text-muted-foreground">¼</div>
                        <div className="font-semibold">{formatPrice(packagingPrices.quarter)}</div>
                        <div className="text-xs text-muted-foreground">{(editedProduct.unitWeight / 4).toFixed(1)} кг</div>
                        {packagingPrices.isQuarterCustom && (
                          <Badge variant="secondary" className="text-[10px] mt-1">своя цена</Badge>
                        )}
                      </div>
                      <div className="bg-background rounded p-2">
                        <div className="text-xs text-muted-foreground">Порция</div>
                        <div className="font-semibold">
                          {packagingPrices.portion ? formatPrice(packagingPrices.portion) : "—"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {editedProduct.portionWeight ? `${editedProduct.portionWeight} кг` : "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>Для настройки цен порций выберите вид товара "Голова" и укажите вес.</p>
              </div>
            )}
          </TabsContent>

          {/* Роли и наценки */}
          <TabsContent value="roles" className="space-y-4 mt-4">
            {customerRoles.length > 0 ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Настройте индивидуальные наценки/скидки для разных групп клиентов.
                </p>

                <div className="space-y-3">
                  {customerRoles.map((role) => {
                    const pricing = getRolePricing(role.id);
                    return (
                      <div key={role.id} className="bg-card border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <Label className="text-base">{role.name}</Label>
                            {role.description && (
                              <p className="text-xs text-muted-foreground">{role.description}</p>
                            )}
                          </div>
                          <Badge variant="outline">
                            {pricing?.markup_value 
                              ? `${pricing.markup_value > 0 ? "+" : ""}${pricing.markup_value}${pricing.markup_type === "percent" ? "%" : "₽"}`
                              : "Базовая цена"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3">
                          <Input
                            type="number"
                            className="flex-1"
                            placeholder="0 = базовая цена"
                            value={pricing?.markup_value || ""}
                            onChange={(e) => updateRolePricing(role.id, "markup_value", e.target.value)}
                          />
                          <div className="flex items-center gap-2 min-w-[80px]">
                            <span className={`text-sm ${(pricing?.markup_type || "percent") === "rubles" ? "text-muted-foreground" : "text-foreground"}`}>
                              %
                            </span>
                            <Switch
                              checked={(pricing?.markup_type || "percent") === "rubles"}
                              onCheckedChange={(checked) => 
                                updateRolePricing(role.id, "markup_type", checked ? "rubles" : "percent")
                              }
                            />
                            <span className={`text-sm ${(pricing?.markup_type || "percent") === "rubles" ? "text-foreground" : "text-muted-foreground"}`}>
                              ₽
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>Нет созданных ролей клиентов.</p>
                <p className="text-sm mt-2">Создайте роли в разделе "Роли клиентов".</p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleSave}>Сохранить</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
