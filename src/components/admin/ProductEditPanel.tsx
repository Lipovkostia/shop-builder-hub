import React, { useState, useEffect } from "react";
import { Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import type { StoreProduct } from "@/hooks/useStoreProducts";

interface Catalog {
  id: string;
  name: string;
  is_default: boolean;
}

interface ProductEditPanelProps {
  product: StoreProduct;
  catalogs: Catalog[];
  productCatalogIds: string[];
  onSave: (productId: string, updates: Partial<StoreProduct>) => Promise<void>;
  onCatalogsChange: (productId: string, catalogIds: string[]) => void;
  onClose: () => void;
}

const unitOptions = [
  { value: "кг", label: "Килограммы (кг)" },
  { value: "шт", label: "Штуки (шт)" },
  { value: "л", label: "Литры (л)" },
  { value: "м", label: "Метры (м)" },
  { value: "уп", label: "Упаковка (уп)" },
];

const packagingOptions = [
  { value: "piece", label: "Штучный товар" },
  { value: "head", label: "Голова" },
  { value: "carcass", label: "Туша" },
  { value: "half_carcass", label: "Полутуша" },
  { value: "quarter_carcass", label: "Четверть туши" },
];

export function ProductEditPanel({
  product,
  catalogs,
  productCatalogIds,
  onSave,
  onCatalogsChange,
  onClose,
}: ProductEditPanelProps) {
  // Local state for form fields
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description || "");
  const [buyPrice, setBuyPrice] = useState(product.buy_price?.toString() || "");
  const [markupType, setMarkupType] = useState<"percent" | "rubles">(
    (product.markup_type as "percent" | "rubles") || "percent"
  );
  const [markupValue, setMarkupValue] = useState(product.markup_value?.toString() || "");
  const [unit, setUnit] = useState(product.unit || "кг");
  const [packagingType, setPackagingType] = useState(product.packaging_type || "piece");
  const [unitWeight, setUnitWeight] = useState(product.unit_weight?.toString() || "");
  const [isActive, setIsActive] = useState(product.is_active !== false);
  const [selectedCatalogs, setSelectedCatalogs] = useState<string[]>(productCatalogIds);
  const [saving, setSaving] = useState(false);

  // Update local state when product changes
  useEffect(() => {
    setName(product.name);
    setDescription(product.description || "");
    setBuyPrice(product.buy_price?.toString() || "");
    setMarkupType((product.markup_type as "percent" | "rubles") || "percent");
    setMarkupValue(product.markup_value?.toString() || "");
    setUnit(product.unit || "кг");
    setPackagingType(product.packaging_type || "piece");
    setUnitWeight(product.unit_weight?.toString() || "");
    setIsActive(product.is_active !== false);
  }, [product]);

  useEffect(() => {
    setSelectedCatalogs(productCatalogIds);
  }, [productCatalogIds]);

  // Calculate sale price
  const calculateSalePrice = (): number => {
    const buy = parseFloat(buyPrice) || 0;
    const markup = parseFloat(markupValue) || 0;
    if (markupType === "percent") {
      return buy * (1 + markup / 100);
    }
    return buy + markup;
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Введите название товара");
      return;
    }

    setSaving(true);
    try {
      const updates: Partial<StoreProduct> = {
        name: name.trim(),
        description: description.trim() || null,
        buy_price: parseFloat(buyPrice) || null,
        markup_type: markupType,
        markup_value: parseFloat(markupValue) || null,
        price: calculateSalePrice(),
        unit,
        packaging_type: packagingType,
        unit_weight: parseFloat(unitWeight) || null,
        is_active: isActive,
      };

      await onSave(product.id, updates);
      
      // Update catalogs if changed
      const catalogsChanged = 
        selectedCatalogs.length !== productCatalogIds.length ||
        selectedCatalogs.some(id => !productCatalogIds.includes(id));
      
      if (catalogsChanged) {
        onCatalogsChange(product.id, selectedCatalogs);
      }

      toast.success("Изменения сохранены");
    } catch (error) {
      toast.error("Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const toggleCatalog = (catalogId: string) => {
    setSelectedCatalogs(prev => 
      prev.includes(catalogId)
        ? prev.filter(id => id !== catalogId)
        : [...prev, catalogId]
    );
  };

  return (
    <div className="bg-muted/30 border-t p-4 animate-fade-in">
      <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-3 items-start">
        {/* Название */}
        <Label className="text-sm text-muted-foreground sm:pt-2">Название</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Название товара"
        />

        {/* Описание */}
        <Label className="text-sm text-muted-foreground sm:pt-2">Описание</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Описание товара"
          className="min-h-[60px] resize-none"
        />

        {/* Цена закупки */}
        <Label className="text-sm text-muted-foreground sm:pt-2">Закупка</Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={buyPrice}
            onChange={(e) => setBuyPrice(e.target.value)}
            placeholder="0"
            className="w-28"
          />
          <span className="text-sm text-muted-foreground">₽/{unit}</span>
        </div>

        {/* Наценка */}
        <Label className="text-sm text-muted-foreground sm:pt-2">Наценка</Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={markupValue}
            onChange={(e) => setMarkupValue(e.target.value)}
            placeholder="0"
            className="w-24"
          />
          <Select value={markupType} onValueChange={(v) => setMarkupType(v as "percent" | "rubles")}>
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="percent">%</SelectItem>
              <SelectItem value="rubles">₽</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">
            = {calculateSalePrice().toFixed(0)} ₽
          </span>
        </div>

        {/* Единица измерения */}
        <Label className="text-sm text-muted-foreground sm:pt-2">Ед. измерения</Label>
        <Select value={unit} onValueChange={setUnit}>
          <SelectTrigger className="w-48">
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

        {/* Тип упаковки */}
        <Label className="text-sm text-muted-foreground sm:pt-2">Тип упаковки</Label>
        <Select value={packagingType} onValueChange={setPackagingType}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {packagingOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Вес единицы */}
        {unit === "кг" && packagingType !== "piece" && (
          <>
            <Label className="text-sm text-muted-foreground sm:pt-2">Вес единицы</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={unitWeight}
                onChange={(e) => setUnitWeight(e.target.value)}
                placeholder="0"
                className="w-28"
              />
              <span className="text-sm text-muted-foreground">кг</span>
            </div>
          </>
        )}

        {/* Статус */}
        <Label className="text-sm text-muted-foreground sm:pt-2">Активен</Label>
        <div className="flex items-center gap-2">
          <Switch checked={isActive} onCheckedChange={setIsActive} />
          <span className="text-sm text-muted-foreground">
            {isActive ? "Виден покупателям" : "Скрыт"}
          </span>
        </div>

        {/* Прайс-листы */}
        {catalogs.length > 0 && (
          <>
            <Label className="text-sm text-muted-foreground sm:pt-2">Прайс-листы</Label>
            <div className="flex flex-wrap gap-3">
              {catalogs.map((catalog) => (
                <label
                  key={catalog.id}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Checkbox
                    checked={selectedCatalogs.includes(catalog.id)}
                    onCheckedChange={() => toggleCatalog(catalog.id)}
                  />
                  <span className="text-sm">{catalog.name}</span>
                </label>
              ))}
            </div>
          </>
        )}

        {/* Кнопки действий */}
        <div className="col-span-full flex gap-2 justify-end mt-3 pt-3 border-t">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            <X className="h-4 w-4 mr-1" />
            Закрыть
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-1" />
            {saving ? "Сохранение..." : "Сохранить"}
          </Button>
        </div>
      </div>
    </div>
  );
}
