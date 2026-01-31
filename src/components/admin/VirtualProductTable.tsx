import React, { useRef, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { MemoizedProductRow, VisibleColumns } from "./MemoizedProductRow";
import { Checkbox } from "@/components/ui/checkbox";
import { GripVertical, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Product, Catalog, ProductGroup } from "./types";

// =============== FILTER COMPONENTS ===============
function ColumnFilter({ 
  value, 
  onChange, 
  placeholder 
}: { 
  value: string; 
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <Input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-5 text-[10px] px-1"
    />
  );
}

function SelectFilter({
  value,
  onChange,
  options,
  placeholder
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-5 text-[10px] px-1">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{placeholder}</SelectItem>
        {options.map(opt => (
          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function MultiSelectFilter({
  values,
  onChange,
  options,
  placeholder
}: {
  values: string[];
  onChange: (values: string[]) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  const [isOpen, setIsOpen] = React.useState(false);

  const handleToggle = (optionValue: string) => {
    if (values.includes(optionValue)) {
      onChange(values.filter(v => v !== optionValue));
    } else {
      onChange([...values, optionValue]);
    }
  };

  const selectedLabels = values
    .map(v => options.find(o => o.value === v)?.label)
    .filter(Boolean);

  const displayText = values.length === 0 
    ? placeholder 
    : selectedLabels.length <= 1 
      ? selectedLabels.join(", ") 
      : `${selectedLabels.length} групп`;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button className={`flex items-center justify-between w-full h-5 text-[10px] px-1 border rounded-md bg-background hover:bg-muted/50 ${values.length > 0 ? 'border-primary/50' : 'border-input'}`}>
          <span className="truncate">{displayText}</span>
          <ChevronDown className="h-3 w-3 ml-1 flex-shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="start">
        <div className="flex flex-col gap-0.5 max-h-[200px] overflow-y-auto">
          {options.map((option) => {
            const isSelected = values.includes(option.value);
            return (
              <div
                key={option.value}
                onClick={() => handleToggle(option.value)}
                className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted cursor-pointer text-xs"
              >
                <Checkbox checked={isSelected} className="h-3 w-3 pointer-events-none" />
                <span className="truncate">{option.label}</span>
              </div>
            );
          })}
          {options.length === 0 && (
            <p className="text-xs text-muted-foreground px-2 py-1">Нет групп</p>
          )}
        </div>
        {values.length > 0 && (
          <div className="border-t mt-1 pt-1">
            <button
              onClick={() => onChange([])}
              className="w-full text-xs text-muted-foreground hover:text-foreground px-2 py-1 text-left"
            >
              Сбросить фильтр
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// =============== TYPES ===============
export interface AllProductsFilters {
  name: string;
  sku: string;
  desc: string;
  source: string;
  unit: string;
  type: string;
  volume: string;
  cost: string;
  status: string;
  sync: string;
  groups: string[];
}

interface VirtualProductTableProps {
  products: Product[];
  selectedBulkProducts: Set<string>;
  onToggleBulkSelection: (productId: string) => void;
  onSelectAll: () => void;
  onUpdateProduct: (product: Product) => void;
  visibleColumns: VisibleColumns;
  filters: AllProductsFilters;
  onFiltersChange: (filters: AllProductsFilters) => void;
  catalogs: Catalog[];
  productGroups: ProductGroup[];
  productCatalogVisibility: Record<string, Set<string>>;
  getProductGroupIds: (productId: string) => string[];
  onToggleCatalogVisibility: (productId: string, catalogId: string) => void;
  onSetProductGroupAssignments: (productId: string, groupIds: string[]) => void;
  onCreateProductGroup: (name: string) => Promise<ProductGroup | null>;
  onCreateCatalog: (name: string) => Promise<Catalog | null>;
  onToggleAutoSync: (productId: string) => void;
  expandedAssortmentImages: string | null;
  onToggleImageExpansion: (productId: string | null) => void;
  onDeleteProductImage: (productId: string, index: number) => void;
  onAddProductImages: (productId: string, files: FileList, source: 'file' | 'camera') => void;
  onSetMainImage: (productId: string, index: number) => void;
  deletingImageProductId: string | null;
  uploadingImageProductId: string | null;
  allUnitOptions: { value: string; label: string }[];
  allPackagingOptions: { value: string; label: string }[];
  onAddCustomUnit: (unit: string) => void;
  onAddCustomPackaging: (type: string) => void;
  onNavigateToCatalog?: (catalogId: string) => void;
  // Optimistic image previews
  optimisticImagePreviews?: Record<string, string[]>;
}

const ROW_HEIGHT = 48;
const EXPANDED_ROW_HEIGHT = 200;
const OVERSCAN = 5;

export function VirtualProductTable({
  products,
  selectedBulkProducts,
  onToggleBulkSelection,
  onSelectAll,
  onUpdateProduct,
  visibleColumns,
  filters,
  onFiltersChange,
  catalogs,
  productGroups,
  productCatalogVisibility,
  getProductGroupIds,
  onToggleCatalogVisibility,
  onSetProductGroupAssignments,
  onCreateProductGroup,
  onCreateCatalog,
  onToggleAutoSync,
  expandedAssortmentImages,
  onToggleImageExpansion,
  onDeleteProductImage,
  onAddProductImages,
  onSetMainImage,
  deletingImageProductId,
  uploadingImageProductId,
  allUnitOptions,
  allPackagingOptions,
  onAddCustomUnit,
  onAddCustomPackaging,
  onNavigateToCatalog,
  optimisticImagePreviews = {},
}: VirtualProductTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Calculate row heights considering expanded images
  const getItemSize = useCallback((index: number) => {
    const product = products[index];
    if (product && expandedAssortmentImages === product.id) {
      return EXPANDED_ROW_HEIGHT;
    }
    return ROW_HEIGHT;
  }, [products, expandedAssortmentImages]);

  // Create virtualizer
  const virtualizer = useVirtualizer({
    count: products.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
    getItemKey: (index) => products[index]?.id || index,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  // Memoized callbacks for rows
  const handleUpdateProduct = useCallback((product: Product) => {
    onUpdateProduct(product);
  }, [onUpdateProduct]);

  const handleToggleImageExpansion = useCallback((productId: string) => {
    onToggleImageExpansion(expandedAssortmentImages === productId ? null : productId);
  }, [expandedAssortmentImages, onToggleImageExpansion]);

  // All products are selected?
  const allSelected = products.length > 0 && selectedBulkProducts.size === products.length;

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Sticky Header */}
      <div className="overflow-x-auto bg-muted/30 border-b">
        <div className="flex items-center gap-2 px-2 py-2 min-h-[40px]">
          {/* Drag handle column */}
          <div className="w-8 flex-shrink-0 flex items-center justify-center">
            <GripVertical className="h-3 w-3 text-muted-foreground/50" />
          </div>
          
          {/* Checkbox column */}
          <div className="w-8 flex-shrink-0 flex items-center justify-center">
            <Checkbox
              checked={allSelected}
              onCheckedChange={onSelectAll}
            />
          </div>
          
          {visibleColumns.photo && (
            <div className="w-12 flex-shrink-0 text-xs font-medium text-muted-foreground">
              Фото
            </div>
          )}
          {visibleColumns.name && (
            <div className="flex-1 min-w-[150px]">
              <div className="text-xs font-medium text-muted-foreground mb-1">Название</div>
              <ColumnFilter 
                value={filters.name} 
                onChange={(v) => onFiltersChange({...filters, name: v})}
                placeholder="Поиск..."
              />
            </div>
          )}
          {visibleColumns.sku && (
            <div className="w-20 flex-shrink-0">
              <ColumnFilter 
                value={filters.sku || ""} 
                onChange={(v) => onFiltersChange({...filters, sku: v})}
                placeholder="SKU..."
              />
            </div>
          )}
          {visibleColumns.desc && (
            <div className="w-24 flex-shrink-0">
              <ColumnFilter 
                value={filters.desc} 
                onChange={(v) => onFiltersChange({...filters, desc: v})}
                placeholder="Описание..."
              />
            </div>
          )}
          {visibleColumns.source && (
            <div className="w-16 flex-shrink-0">
              <SelectFilter
                value={filters.source}
                onChange={(v) => onFiltersChange({...filters, source: v})}
                options={[
                  { value: "moysklad", label: "МС" },
                  { value: "local", label: "Лок" },
                ]}
                placeholder="Все"
              />
            </div>
          )}
          {visibleColumns.unit && (
            <div className="w-16 flex-shrink-0">
              <SelectFilter
                value={filters.unit}
                onChange={(v) => onFiltersChange({...filters, unit: v})}
                options={[
                  { value: "кг", label: "кг" },
                  { value: "шт", label: "шт" },
                  { value: "л", label: "л" },
                  { value: "уп", label: "уп" },
                ]}
                placeholder="Все"
              />
            </div>
          )}
          {visibleColumns.type && (
            <div className="w-20 flex-shrink-0">
              <SelectFilter
                value={filters.type}
                onChange={(v) => onFiltersChange({...filters, type: v})}
                options={[
                  { value: "weight", label: "Вес" },
                  { value: "piece", label: "Шт" },
                ]}
                placeholder="Все"
              />
            </div>
          )}
          {visibleColumns.volume && (
            <div className="w-16 flex-shrink-0">
              <ColumnFilter 
                value={filters.volume} 
                onChange={(v) => onFiltersChange({...filters, volume: v})}
                placeholder="Объём..."
              />
            </div>
          )}
          {visibleColumns.cost && (
            <div className="w-16 flex-shrink-0">
              <ColumnFilter 
                value={filters.cost} 
                onChange={(v) => onFiltersChange({...filters, cost: v})}
                placeholder="Цена..."
              />
            </div>
          )}
          {visibleColumns.groups && (
            <div className="w-24 flex-shrink-0">
              <MultiSelectFilter
                values={filters.groups}
                onChange={(v) => onFiltersChange({...filters, groups: v})}
                options={[
                  { value: "none", label: "Без группы" },
                  ...productGroups.map(g => ({ value: g.id, label: g.name }))
                ]}
                placeholder="Все"
              />
            </div>
          )}
          {visibleColumns.catalogs && (
            <div className="w-28 flex-shrink-0 text-xs font-medium text-muted-foreground">Каталоги</div>
          )}
          {visibleColumns.sync && (
            <div className="w-12 flex-shrink-0">
              <SelectFilter
                value={filters.sync}
                onChange={(v) => onFiltersChange({...filters, sync: v})}
                options={[
                  { value: "synced", label: "Да" },
                  { value: "notSynced", label: "Нет" },
                ]}
                placeholder="Все"
              />
            </div>
          )}
        </div>
      </div>

      {/* Virtualized Body */}
      <div 
        ref={parentRef}
        className="overflow-auto"
        style={{ height: 'calc(100vh - 300px)', minHeight: '400px' }}
      >
        <div
          style={{
            height: `${totalSize}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualItems.map((virtualRow) => {
            const product = products[virtualRow.index];
            if (!product) return null;

            const isExpanded = expandedAssortmentImages === product.id;
            const rowHeight = isExpanded ? EXPANDED_ROW_HEIGHT : ROW_HEIGHT;
            
            // Combine real images with optimistic previews
            const optimisticPreviews = optimisticImagePreviews[product.id] || [];
            const allImages = [...(product.images || []), ...optimisticPreviews];

            return (
              <div
                key={virtualRow.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <MemoizedProductRow
                  product={product}
                  isSelected={selectedBulkProducts.has(product.id)}
                  onToggleSelection={onToggleBulkSelection}
                  onUpdateProduct={handleUpdateProduct}
                  visibleColumns={visibleColumns}
                  catalogs={catalogs}
                  productGroups={productGroups}
                  catalogVisibility={productCatalogVisibility[product.id] || new Set()}
                  productGroupIds={getProductGroupIds(product.id)}
                  onToggleCatalogVisibility={onToggleCatalogVisibility}
                  onSetProductGroupAssignments={onSetProductGroupAssignments}
                  onCreateProductGroup={onCreateProductGroup}
                  onCreateCatalog={onCreateCatalog}
                  onToggleAutoSync={onToggleAutoSync}
                  isExpanded={isExpanded}
                  onToggleExpansion={handleToggleImageExpansion}
                  onDeleteProductImage={onDeleteProductImage}
                  onAddProductImages={onAddProductImages}
                  onSetMainImage={onSetMainImage}
                  isDeleting={deletingImageProductId === product.id}
                  isUploading={uploadingImageProductId === product.id}
                  allUnitOptions={allUnitOptions}
                  allPackagingOptions={allPackagingOptions}
                  onAddCustomUnit={onAddCustomUnit}
                  onAddCustomPackaging={onAddCustomPackaging}
                  onNavigateToCatalog={onNavigateToCatalog}
                  optimisticImages={allImages}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer with count */}
      <div className="bg-muted/30 px-4 py-2 text-sm text-muted-foreground border-t">
        Показано {products.length} товар(ов) | Выбрано {selectedBulkProducts.size}
      </div>
    </div>
  );
}
