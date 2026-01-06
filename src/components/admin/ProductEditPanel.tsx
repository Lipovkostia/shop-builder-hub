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
  const [priceHalf, setPriceHalf] = useState(product.price_half?.toString() || "");
  const [priceQuarter, setPriceQuarter] = useState(product.price_quarter?.toString() || "");
  const [pricePortion, setPricePortion] = useState(product.price_portion?.toString() || "");
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
    setPriceHalf(product.price_half?.toString() || "");
    setPriceQuarter(product.price_quarter?.toString() || "");
    setPricePortion(product.price_portion?.toString() || "");
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
        price_half: parseFloat(priceHalf) || null,
        price_quarter: parseFloat(priceQuarter) || null,
        price_portion: parseFloat(pricePortion) || null,
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
    <div className="bg-muted/30 border-t animate-fade-in">
      {/* Таблица полей */}
      <div className="divide-y divide-border">
        {/* Название */}
        <div className="flex items-center">
          <div className="w-28 sm:w-36 flex-shrink-0 px-3 py-2.5 bg-muted/50 text-sm font-medium text-muted-foreground">
            Название
          </div>
          <div className="flex-1 px-3 py-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Название товара"
            />
          </div>
        </div>

        {/* Описание */}
        <div className="flex items-start">
          <div className="w-28 sm:w-36 flex-shrink-0 px-3 py-2.5 bg-muted/50 text-sm font-medium text-muted-foreground">
            Описание
          </div>
          <div className="flex-1 px-3 py-2">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Описание товара"
              className="min-h-[60px] resize-none"
            />
          </div>
        </div>

        {/* Цена закупки */}
        <div className="flex items-center">
          <div className="w-28 sm:w-36 flex-shrink-0 px-3 py-2.5 bg-muted/50 text-sm font-medium text-muted-foreground">
            Закупка
          </div>
          <div className="flex-1 px-3 py-2 flex items-center gap-2">
            <Input
              type="number"
              value={buyPrice}
              onChange={(e) => setBuyPrice(e.target.value)}
              placeholder="0"
              className="w-24"
            />
            <span className="text-sm text-muted-foreground">₽/{unit}</span>
          </div>
        </div>

        {/* Наценка */}
        <div className="flex items-center">
          <div className="w-28 sm:w-36 flex-shrink-0 px-3 py-2.5 bg-muted/50 text-sm font-medium text-muted-foreground">
            Наценка
          </div>
          <div className="flex-1 px-3 py-2 flex items-center gap-2 flex-wrap">
            <Input
              type="number"
              value={markupValue}
              onChange={(e) => setMarkupValue(e.target.value)}
              placeholder="0"
              className="w-20"
            />
            <Select value={markupType} onValueChange={(v) => setMarkupType(v as "percent" | "rubles")}>
              <SelectTrigger className="w-16">
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
        </div>

        {/* Цена 1/2 */}
        <div className="flex items-center">
          <div className="w-28 sm:w-36 flex-shrink-0 px-3 py-2.5 bg-muted/50 text-sm font-medium text-muted-foreground">
            Цена 1/2
          </div>
          <div className="flex-1 px-3 py-2 flex items-center gap-2">
            <Input
              type="number"
              value={priceHalf}
              onChange={(e) => setPriceHalf(e.target.value)}
              placeholder="0"
              className="w-24"
            />
            <span className="text-sm text-muted-foreground">₽</span>
          </div>
        </div>

        {/* Цена 1/4 */}
        <div className="flex items-center">
          <div className="w-28 sm:w-36 flex-shrink-0 px-3 py-2.5 bg-muted/50 text-sm font-medium text-muted-foreground">
            Цена 1/4
          </div>
          <div className="flex-1 px-3 py-2 flex items-center gap-2">
            <Input
              type="number"
              value={priceQuarter}
              onChange={(e) => setPriceQuarter(e.target.value)}
              placeholder="0"
              className="w-24"
            />
            <span className="text-sm text-muted-foreground">₽</span>
          </div>
        </div>

        {/* Цена порция */}
        <div className="flex items-center">
          <div className="w-28 sm:w-36 flex-shrink-0 px-3 py-2.5 bg-muted/50 text-sm font-medium text-muted-foreground">
            Порция
          </div>
          <div className="flex-1 px-3 py-2 flex items-center gap-2">
            <Input
              type="number"
              value={pricePortion}
              onChange={(e) => setPricePortion(e.target.value)}
              placeholder="0"
              className="w-24"
            />
            <span className="text-sm text-muted-foreground">₽</span>
          </div>
        </div>

        {/* Единица измерения */}
        <div className="flex items-center">
          <div className="w-28 sm:w-36 flex-shrink-0 px-3 py-2.5 bg-muted/50 text-sm font-medium text-muted-foreground">
            Ед. измерения
          </div>
          <div className="flex-1 px-3 py-2">
            <Select value={unit} onValueChange={setUnit}>
              <SelectTrigger className="w-44">
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
        </div>

        {/* Тип упаковки */}
        <div className="flex items-center">
          <div className="w-28 sm:w-36 flex-shrink-0 px-3 py-2.5 bg-muted/50 text-sm font-medium text-muted-foreground">
            Тип упаковки
          </div>
          <div className="flex-1 px-3 py-2">
            <Select value={packagingType} onValueChange={setPackagingType}>
              <SelectTrigger className="w-44">
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
          </div>
        </div>

        {/* Вес единицы */}
        {unit === "кг" && packagingType !== "piece" && (
          <div className="flex items-center">
            <div className="w-28 sm:w-36 flex-shrink-0 px-3 py-2.5 bg-muted/50 text-sm font-medium text-muted-foreground">
              Вес единицы
            </div>
            <div className="flex-1 px-3 py-2 flex items-center gap-2">
              <Input
                type="number"
                value={unitWeight}
                onChange={(e) => setUnitWeight(e.target.value)}
                placeholder="0"
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">кг</span>
            </div>
          </div>
        )}

        {/* Статус */}
        <div className="flex items-center">
          <div className="w-28 sm:w-36 flex-shrink-0 px-3 py-2.5 bg-muted/50 text-sm font-medium text-muted-foreground">
            Активен
          </div>
          <div className="flex-1 px-3 py-2 flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <span className="text-sm text-muted-foreground">
              {isActive ? "Виден покупателям" : "Скрыт"}
            </span>
          </div>
        </div>

        {/* Прайс-листы */}
        {catalogs.length > 0 && (
          <div className="flex items-start">
            <div className="w-28 sm:w-36 flex-shrink-0 px-3 py-2.5 bg-muted/50 text-sm font-medium text-muted-foreground">
              Прайс-листы
            </div>
            <div className="flex-1 px-3 py-2 flex flex-wrap gap-3">
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
          </div>
        )}
      </div>

      {/* Кнопки действий */}
      <div className="p-3 border-t flex gap-2 justify-end bg-background/50">
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
  );
}
