import { useState } from "react";
import { ChevronDown, ChevronUp, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { RetailCategory } from "@/hooks/useRetailStore";

interface RetailSidebarProps {
  categories: RetailCategory[];
  selectedCategories: string[];
  onCategoryToggle: (categoryId: string) => void;
  priceRange: [number, number];
  currentPriceRange: [number, number];
  onPriceRangeChange: (range: [number, number]) => void;
  inStockOnly: boolean;
  onInStockChange: (inStock: boolean) => void;
  onResetFilters: () => void;
  hasActiveFilters: boolean;
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

export function RetailSidebar({
  categories,
  selectedCategories,
  onCategoryToggle,
  priceRange,
  currentPriceRange,
  onPriceRangeChange,
  inStockOnly,
  onInStockChange,
  onResetFilters,
  hasActiveFilters,
}: RetailSidebarProps) {
  const [categoriesOpen, setCategoriesOpen] = useState(true);
  const [priceOpen, setPriceOpen] = useState(true);

  return (
    <aside className="w-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4" />
          <h2 className="font-semibold">Фильтры</h2>
        </div>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onResetFilters}
            className="text-xs h-7"
          >
            <X className="h-3 w-3 mr-1" />
            Сбросить
          </Button>
        )}
      </div>

      {/* Categories */}
      <Collapsible open={categoriesOpen} onOpenChange={setCategoriesOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between px-0 hover:bg-transparent"
          >
            <span className="font-medium">Категории</span>
            {categoriesOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 pt-2">
          {categories.map((category) => (
            <div key={category.id} className="flex items-center gap-2">
              <Checkbox
                id={`cat-${category.id}`}
                checked={selectedCategories.includes(category.id)}
                onCheckedChange={() => onCategoryToggle(category.id)}
              />
              <Label
                htmlFor={`cat-${category.id}`}
                className="flex-1 text-sm cursor-pointer flex items-center justify-between"
              >
                <span>{category.name}</span>
                {category.product_count !== undefined && category.product_count > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {category.product_count}
                  </Badge>
                )}
              </Label>
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>

      {/* Price range */}
      <Collapsible open={priceOpen} onOpenChange={setPriceOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between px-0 hover:bg-transparent"
          >
            <span className="font-medium">Цена</span>
            {priceOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-2">
          <div className="px-1">
            <Slider
              min={priceRange[0]}
              max={priceRange[1]}
              step={Math.max(1, Math.floor((priceRange[1] - priceRange[0]) / 100))}
              value={currentPriceRange}
              onValueChange={(value) => onPriceRangeChange(value as [number, number])}
              className="w-full"
            />
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{formatPrice(currentPriceRange[0])}</span>
            <span>{formatPrice(currentPriceRange[1])}</span>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* In stock only */}
      <div className="flex items-center gap-2 pt-2 border-t">
        <Checkbox
          id="in-stock"
          checked={inStockOnly}
          onCheckedChange={(checked) => onInStockChange(checked === true)}
        />
        <Label htmlFor="in-stock" className="text-sm cursor-pointer">
          Только в наличии
        </Label>
      </div>
    </aside>
  );
}
