import React, { useState, useEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  catalogId?: string | null;
  currentStatus?: string;
  onStatusChange?: (catalogId: string, productId: string, status: string) => void;
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
  catalogId,
  currentStatus,
  onStatusChange,
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
  const [status, setStatus] = useState(currentStatus || "in_stock");
  const [priceHalf, setPriceHalf] = useState(product.price_half?.toString() || "");
  const [priceQuarter, setPriceQuarter] = useState(product.price_quarter?.toString() || "");
  const [pricePortion, setPricePortion] = useState(product.price_portion?.toString() || "");
  const [selectedCatalogs, setSelectedCatalogs] = useState<string[]>(productCatalogIds);
  const [saving, setSaving] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMount = useRef(true);

  // Update local state when product changes (but NOT status - it's controlled separately)
  useEffect(() => {
    setName(product.name);
    setDescription(product.description || "");
    setBuyPrice(product.buy_price?.toString() || "");
    setMarkupType((product.markup_type as "percent" | "rubles") || "percent");
    setMarkupValue(product.markup_value?.toString() || "");
    setUnit(product.unit || "кг");
    setPackagingType(product.packaging_type || "piece");
    setUnitWeight(product.unit_weight?.toString() || "");
    setPriceHalf(product.price_half?.toString() || "");
    setPriceQuarter(product.price_quarter?.toString() || "");
    setPricePortion(product.price_portion?.toString() || "");
  }, [product]);

  // Sync status with currentStatus prop only on initial mount or when catalogId changes
  useEffect(() => {
    setStatus(currentStatus || "in_stock");
  }, [catalogId]);

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

  // Auto-save function
  const performSave = useCallback(async () => {
    if (!name.trim()) return;

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
        is_active: status !== "hidden",
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

      // Update catalog-specific status if changed
      if (catalogId && onStatusChange && status !== currentStatus) {
        onStatusChange(catalogId, product.id, status);
      }
    } catch (error) {
      toast.error("Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }, [name, description, buyPrice, markupType, markupValue, unit, packagingType, unitWeight, status, priceHalf, priceQuarter, pricePortion, selectedCatalogs, product.id, productCatalogIds, onSave, onCatalogsChange, catalogId, currentStatus, onStatusChange, calculateSalePrice]);

  // Debounced auto-save effect
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      performSave();
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [name, buyPrice, markupType, markupValue, unit, packagingType, unitWeight, status, priceHalf, priceQuarter, pricePortion, selectedCatalogs]);

  const toggleCatalog = (catalogId: string) => {
    setSelectedCatalogs(prev => 
      prev.includes(catalogId)
        ? prev.filter(id => id !== catalogId)
        : [...prev, catalogId]
    );
  };

  return (
    <div className="bg-gradient-to-b from-muted/40 to-muted/20 border-t border-primary/20 animate-fade-in shadow-inner">
      {/* Компактная сетка полей */}
      <div className="p-2 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        {/* Название - на всю ширину */}
        <div className="col-span-2 sm:col-span-3">
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Название</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Название товара"
            className="h-7 text-xs mt-0.5"
          />
        </div>

        {/* Закупка */}
        <div>
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Закупка</label>
          <div className="flex items-center gap-1 mt-0.5">
            <Input
              type="number"
              value={buyPrice}
              onChange={(e) => setBuyPrice(e.target.value)}
              placeholder="0"
              className="h-7 text-xs w-full"
            />
            <span className="text-[10px] text-muted-foreground shrink-0">₽</span>
          </div>
        </div>

        {/* Наценка */}
        <div>
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Наценка</label>
          <div className="flex items-center gap-1 mt-0.5">
            <Input
              type="number"
              value={markupValue}
              onChange={(e) => setMarkupValue(e.target.value)}
              placeholder="0"
              className="h-7 text-xs flex-1"
            />
            <Select value={markupType} onValueChange={(v) => setMarkupType(v as "percent" | "rubles")}>
              <SelectTrigger className="h-7 w-12 text-xs px-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percent">%</SelectItem>
                <SelectItem value="rubles">₽</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Цена */}
        <div>
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Цена</label>
          <div className="h-7 mt-0.5 flex items-center px-2 rounded-md bg-primary/10 border border-primary/20">
            <span className="text-xs font-semibold text-primary">{calculateSalePrice().toFixed(0)} ₽</span>
          </div>
        </div>

        {/* Цены фасовки в одной строке */}
        <div>
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">1/2</label>
          <Input
            type="number"
            value={priceHalf}
            onChange={(e) => setPriceHalf(e.target.value)}
            placeholder="0"
            className="h-7 text-xs mt-0.5"
          />
        </div>

        <div>
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">1/4</label>
          <Input
            type="number"
            value={priceQuarter}
            onChange={(e) => setPriceQuarter(e.target.value)}
            placeholder="0"
            className="h-7 text-xs mt-0.5"
          />
        </div>

        <div>
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Порция</label>
          <Input
            type="number"
            value={pricePortion}
            onChange={(e) => setPricePortion(e.target.value)}
            placeholder="0"
            className="h-7 text-xs mt-0.5"
          />
        </div>

        {/* Единица и упаковка */}
        <div>
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Ед. изм.</label>
          <Select value={unit} onValueChange={setUnit}>
            <SelectTrigger className="h-7 text-xs mt-0.5">
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

        <div>
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Упаковка</label>
          <Select value={packagingType} onValueChange={setPackagingType}>
            <SelectTrigger className="h-7 text-xs mt-0.5">
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

        {/* Объем */}
        <div>
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Объем</label>
          <Input
            type="number"
            value={unitWeight}
            onChange={(e) => setUnitWeight(e.target.value)}
            placeholder="0"
            className="h-7 text-xs mt-0.5"
            step="0.1"
            min="0"
          />
        </div>

        {/* Статус - кнопки вместо Select */}
        <div className="col-span-2 sm:col-span-3">
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Статус</label>
          <div className="flex gap-1 mt-0.5">
            <button
              type="button"
              onClick={() => setStatus("in_stock")}
              className={`flex-1 h-7 text-xs rounded-md border transition-colors ${
                status === "in_stock"
                  ? "bg-green-500/20 border-green-500/50 text-green-700 dark:text-green-400 font-medium"
                  : "bg-muted/50 border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              В наличии
            </button>
            <button
              type="button"
              onClick={() => setStatus("out_of_stock")}
              className={`flex-1 h-7 text-xs rounded-md border transition-colors ${
                status === "out_of_stock"
                  ? "bg-orange-500/20 border-orange-500/50 text-orange-700 dark:text-orange-400 font-medium"
                  : "bg-muted/50 border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              Нет в наличии
            </button>
            <button
              type="button"
              onClick={() => setStatus("hidden")}
              className={`flex-1 h-7 text-xs rounded-md border transition-colors ${
                status === "hidden"
                  ? "bg-gray-500/20 border-gray-500/50 text-gray-700 dark:text-gray-400 font-medium"
                  : "bg-muted/50 border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              Скрыт
            </button>
          </div>
        </div>

        {/* Прайс-листы - на всю ширину */}
        {catalogs.length > 0 && (
          <div className="col-span-2 sm:col-span-3 pt-1 border-t border-border/50">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Прайс-листы</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {catalogs.map((catalog) => (
                <label
                  key={catalog.id}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] cursor-pointer transition-colors ${
                    selectedCatalogs.includes(catalog.id) 
                      ? 'bg-primary/20 text-primary border border-primary/30' 
                      : 'bg-muted/50 text-muted-foreground border border-transparent hover:bg-muted'
                  }`}
                >
                  <Checkbox
                    checked={selectedCatalogs.includes(catalog.id)}
                    onCheckedChange={() => toggleCatalog(catalog.id)}
                    className="h-3 w-3"
                  />
                  {catalog.name}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Кнопка закрыть */}
      <div className="px-2 py-1.5 border-t border-border/50 flex gap-1.5 justify-between items-center bg-background/30">
        <span className="text-[10px] text-muted-foreground">
          {saving ? "Сохранение..." : "Автосохранение"}
        </span>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-7 text-xs px-2">
          <X className="h-3 w-3 mr-1" />
          Закрыть
        </Button>
      </div>
    </div>
  );
}
