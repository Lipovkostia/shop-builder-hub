import React, { useState, useEffect, useRef, useCallback } from "react";
import { X, ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import type { StoreProduct } from "@/hooks/useStoreProducts";

interface Catalog {
  id: string;
  name: string;
  is_default: boolean;
}

interface CatalogSettings {
  markup_type?: string;
  markup_value?: number;
  portion_prices?: {
    halfPricePerKg?: number;
    quarterPricePerKg?: number;
    portionPrice?: number;
  } | null;
  status?: string;
  categories?: string[];
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
  catalogSettings?: CatalogSettings;
  onCatalogSettingsChange?: (catalogId: string, productId: string, settings: Partial<CatalogSettings>) => void;
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
  catalogSettings,
  onCatalogSettingsChange,
}: ProductEditPanelProps) {
  // Local state for form fields
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description || "");
  const [buyPrice, setBuyPrice] = useState(product.buy_price?.toString() || "");
  
  // Catalog-specific fields: use catalogSettings if available, otherwise fall back to product
  const [markupType, setMarkupType] = useState<"percent" | "rubles">(
    (catalogSettings?.markup_type as "percent" | "rubles") || 
    (product.markup_type as "percent" | "rubles") || "percent"
  );
  const [markupValue, setMarkupValue] = useState(
    catalogSettings?.markup_value?.toString() || product.markup_value?.toString() || ""
  );
  const [priceHalf, setPriceHalf] = useState(
    catalogSettings?.portion_prices?.halfPricePerKg?.toString() || product.price_half?.toString() || ""
  );
  const [priceQuarter, setPriceQuarter] = useState(
    catalogSettings?.portion_prices?.quarterPricePerKg?.toString() || product.price_quarter?.toString() || ""
  );
  const [pricePortion, setPricePortion] = useState(
    catalogSettings?.portion_prices?.portionPrice?.toString() || product.price_portion?.toString() || ""
  );
  
  // Product-level fields
  const [unit, setUnit] = useState(product.unit || "кг");
  const [packagingType, setPackagingType] = useState(product.packaging_type || "piece");
  const [unitWeight, setUnitWeight] = useState(product.unit_weight?.toString() || "");
  const [status, setStatus] = useState(currentStatus || "in_stock");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    catalogSettings?.categories || []
  );
  const [newCategory, setNewCategory] = useState("");
  const [selectedCatalogs, setSelectedCatalogs] = useState<string[]>(productCatalogIds);
  const [saving, setSaving] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMount = useRef(true);
  const catalogSettingsInitialized = useRef(false);
  const lastCatalogId = useRef<string | null | undefined>(catalogId);

  // Predefined categories that can be selected
  const predefinedCategories = [
    "Сыры",
    "Молочные продукты",
    "Мясо",
    "Птица",
    "Рыба",
    "Морепродукты",
    "Овощи",
    "Фрукты",
    "Напитки",
    "Деликатесы",
  ];

  // Update local state when product or catalogSettings changes
  useEffect(() => {
    setName(product.name);
    setDescription(product.description || "");
    setBuyPrice(product.buy_price?.toString() || "");
    setUnit(product.unit || "кг");
    setPackagingType(product.packaging_type || "piece");
    setUnitWeight(product.unit_weight?.toString() || "");
  }, [product]);

  // Update catalog-specific fields only when catalogId changes (not on every catalogSettings update)
  useEffect(() => {
    // Only reset when catalog actually changes, not on every render
    if (lastCatalogId.current !== catalogId) {
      lastCatalogId.current = catalogId;
      catalogSettingsInitialized.current = false;
    }
    
    // Only initialize once per catalog
    if (!catalogSettingsInitialized.current) {
      catalogSettingsInitialized.current = true;
      setMarkupType(
        (catalogSettings?.markup_type as "percent" | "rubles") || 
        (product.markup_type as "percent" | "rubles") || "percent"
      );
      setMarkupValue(
        catalogSettings?.markup_value?.toString() || product.markup_value?.toString() || ""
      );
      setPriceHalf(
        catalogSettings?.portion_prices?.halfPricePerKg?.toString() || product.price_half?.toString() || ""
      );
      setPriceQuarter(
        catalogSettings?.portion_prices?.quarterPricePerKg?.toString() || product.price_quarter?.toString() || ""
      );
      setPricePortion(
        catalogSettings?.portion_prices?.portionPrice?.toString() || product.price_portion?.toString() || ""
      );
      setSelectedCategories(catalogSettings?.categories || []);
    }
  }, [catalogSettings, catalogId, product]);

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
      // Product-level updates (shared across all catalogs)
      const updates: Partial<StoreProduct> = {
        name: name.trim(),
        description: description.trim() || null,
        buy_price: parseFloat(buyPrice) || null,
        price: calculateSalePrice(),
        unit,
        packaging_type: packagingType,
        unit_weight: parseFloat(unitWeight) || null,
        is_active: status !== "hidden",
      };

      await onSave(product.id, updates);
      
      // Update catalogs if changed
      const catalogsChanged = 
        selectedCatalogs.length !== productCatalogIds.length ||
        selectedCatalogs.some(id => !productCatalogIds.includes(id));
      
      if (catalogsChanged) {
        onCatalogsChange(product.id, selectedCatalogs);
      }

      // Update catalog-specific settings (markup, portion prices, categories)
      if (catalogId && onCatalogSettingsChange) {
        onCatalogSettingsChange(catalogId, product.id, {
          markup_type: markupType,
          markup_value: parseFloat(markupValue) || 0,
          portion_prices: {
            halfPricePerKg: parseFloat(priceHalf) || undefined,
            quarterPricePerKg: parseFloat(priceQuarter) || undefined,
            portionPrice: parseFloat(pricePortion) || undefined,
          },
          status,
          categories: selectedCategories,
        });
      } else if (catalogId && onStatusChange && status !== currentStatus) {
        // Fallback: just update status if no onCatalogSettingsChange
        onStatusChange(catalogId, product.id, status);
      }
    } catch (error) {
      toast.error("Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }, [name, description, buyPrice, markupType, markupValue, unit, packagingType, unitWeight, status, priceHalf, priceQuarter, pricePortion, selectedCategories, selectedCatalogs, product.id, productCatalogIds, onSave, onCatalogsChange, catalogId, currentStatus, onStatusChange, onCatalogSettingsChange, calculateSalePrice]);

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
  }, [name, buyPrice, markupType, markupValue, unit, packagingType, unitWeight, status, priceHalf, priceQuarter, pricePortion, selectedCategories, selectedCatalogs]);

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

        {/* Категории - выпадающий список */}
        <div className="col-span-2 sm:col-span-3">
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Категории</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full h-7 text-xs mt-0.5 justify-between font-normal"
              >
                <span className="truncate">
                  {selectedCategories.length > 0 
                    ? selectedCategories.join(", ")
                    : "Выберите категории..."
                  }
                </span>
                <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2 bg-background z-50" align="start">
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {/* Предустановленные категории */}
                {predefinedCategories.map((category) => (
                  <label
                    key={category}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedCategories.includes(category)}
                      onCheckedChange={() => {
                        setSelectedCategories(prev => 
                          prev.includes(category)
                            ? prev.filter(c => c !== category)
                            : [...prev, category]
                        );
                      }}
                      className="h-4 w-4"
                    />
                    <span className="text-xs">{category}</span>
                  </label>
                ))}
                {/* Кастомные категории */}
                {selectedCategories
                  .filter(c => !predefinedCategories.includes(c))
                  .map((category) => (
                    <label
                      key={category}
                      className="flex items-center gap-2 px-2 py-1.5 rounded bg-primary/10 cursor-pointer"
                    >
                      <Checkbox
                        checked={true}
                        onCheckedChange={() => {
                          setSelectedCategories(prev => prev.filter(c => c !== category));
                        }}
                        className="h-4 w-4"
                      />
                      <span className="text-xs text-primary">{category}</span>
                    </label>
                  ))}
              </div>
              {/* Добавить новую категорию */}
              <div className="flex gap-1 mt-2 pt-2 border-t">
                <Input
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newCategory.trim()) {
                      e.preventDefault();
                      if (!selectedCategories.includes(newCategory.trim())) {
                        setSelectedCategories(prev => [...prev, newCategory.trim()]);
                      }
                      setNewCategory("");
                    }
                  }}
                  placeholder="Новая..."
                  className="h-7 text-xs flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => {
                    if (newCategory.trim() && !selectedCategories.includes(newCategory.trim())) {
                      setSelectedCategories(prev => [...prev, newCategory.trim()]);
                      setNewCategory("");
                    }
                  }}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </PopoverContent>
          </Popover>
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
