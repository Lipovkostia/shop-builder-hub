import React, { useRef, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { MemoizedProductRow, VisibleColumns } from "./MemoizedProductRow";
import { Checkbox } from "@/components/ui/checkbox";
import { GripVertical, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useColumnWidths } from "@/hooks/useColumnWidths";
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
  price: string;
  status: string;
  sync: string;
  groups: string[];
}

interface VirtualProductTableProps {
  products: Product[];
  selectedBulkProducts: Set<string>;
  onToggleBulkSelection: (productId: string, shiftKey?: boolean) => void;
  
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
  // AI description generation
  onAIGenerateDescription?: (productId: string, productName: string) => void;
  isAIGeneratingDescription?: boolean;
  aiGeneratingProductId?: string | null;
}

const ROW_HEIGHT = 28;
const EXPANDED_ROW_HEIGHT = 180; // Увеличенная высота для галереи изображений
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
  onAIGenerateDescription,
  isAIGeneratingDescription,
  aiGeneratingProductId,
}: VirtualProductTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const { widths, onResizeStart } = useColumnWidths("assortment");

  // Resize handle component
  const ResizeHandle = ({ col }: { col: string }) => (
    <div
      className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-primary/40 transition-colors touch-none z-10"
      onMouseDown={(e) => onResizeStart(col, e)}
      onTouchStart={(e) => onResizeStart(col, e)}
    />
  );

  // Calculate row heights considering expanded images
  const getItemSize = useCallback((index: number) => {
    const product = products[index];
    if (product && expandedAssortmentImages === product.id) {
      return EXPANDED_ROW_HEIGHT;
    }
    return ROW_HEIGHT;
  }, [products, expandedAssortmentImages]);

  // Create virtualizer with dynamic row heights
  const virtualizer = useVirtualizer({
    count: products.length,
    getScrollElement: () => parentRef.current,
    estimateSize: getItemSize,
    overscan: OVERSCAN,
    getItemKey: (index) => products[index]?.id || index,
  });

  // Re-measure all items when expanded state changes
  React.useEffect(() => {
    virtualizer.measure();
  }, [expandedAssortmentImages, virtualizer]);

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
        <div className="flex items-center gap-1 px-1.5 py-1 min-h-[28px]">
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
            <div className="flex-shrink-0 text-[10px] font-medium text-muted-foreground relative" style={{ width: widths.photo }}>
              Фото
              <ResizeHandle col="photo" />
            </div>
          )}
          {visibleColumns.name && (
            <div className="relative" style={{ width: widths.name, minWidth: 100, flexShrink: 0 }}>
              <div className="text-xs font-medium text-muted-foreground mb-1">Название</div>
              <ColumnFilter 
                value={filters.name} 
                onChange={(v) => onFiltersChange({...filters, name: v})}
                placeholder="Поиск..."
              />
              <ResizeHandle col="name" />
            </div>
          )}
          {visibleColumns.sku && (
            <div className="flex-shrink-0 relative" style={{ width: widths.sku }}>
              <ColumnFilter 
                value={filters.sku || ""} 
                onChange={(v) => onFiltersChange({...filters, sku: v})}
                placeholder="SKU..."
              />
              <ResizeHandle col="sku" />
            </div>
          )}
          {visibleColumns.desc && (
            <div className="flex-shrink-0 relative" style={{ width: widths.desc }}>
              <ColumnFilter 
                value={filters.desc} 
                onChange={(v) => onFiltersChange({...filters, desc: v})}
                placeholder="Описание..."
              />
              <ResizeHandle col="desc" />
            </div>
          )}
          {visibleColumns.source && (
            <div className="flex-shrink-0 relative" style={{ width: widths.source }}>
              <SelectFilter
                value={filters.source}
                onChange={(v) => onFiltersChange({...filters, source: v})}
                options={[
                  { value: "moysklad", label: "МС" },
                  { value: "local", label: "Лок" },
                ]}
                placeholder="Все"
              />
              <ResizeHandle col="source" />
            </div>
          )}
          {visibleColumns.unit && (
            <div className="flex-shrink-0 relative" style={{ width: widths.unit }}>
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
              <ResizeHandle col="unit" />
            </div>
          )}
          {visibleColumns.type && (
            <div className="flex-shrink-0 relative" style={{ width: widths.type }}>
              <SelectFilter
                value={filters.type}
                onChange={(v) => onFiltersChange({...filters, type: v})}
                options={[
                  { value: "weight", label: "Вес" },
                  { value: "piece", label: "Шт" },
                ]}
                placeholder="Все"
              />
              <ResizeHandle col="type" />
            </div>
          )}
          {visibleColumns.volume && (
            <div className="flex-shrink-0 relative" style={{ width: widths.volume }}>
              <ColumnFilter 
                value={filters.volume} 
                onChange={(v) => onFiltersChange({...filters, volume: v})}
                placeholder="Объём..."
              />
              <ResizeHandle col="volume" />
            </div>
          )}
          {visibleColumns.cost && (
            <div className="flex-shrink-0 relative" style={{ width: widths.cost }}>
              <ColumnFilter 
                value={filters.cost} 
                onChange={(v) => onFiltersChange({...filters, cost: v})}
                placeholder="Себест..."
              />
              <ResizeHandle col="cost" />
            </div>
          )}
          {visibleColumns.price && (
            <div className="flex-shrink-0 relative" style={{ width: widths.price }}>
              <ColumnFilter 
                value={filters.price} 
                onChange={(v) => onFiltersChange({...filters, price: v})}
                placeholder="Цена..."
              />
              <ResizeHandle col="price" />
            </div>
          )}
          {visibleColumns.groups && (
            <div className="flex-shrink-0 relative" style={{ width: widths.groups }}>
              <MultiSelectFilter
                values={filters.groups}
                onChange={(v) => onFiltersChange({...filters, groups: v})}
                options={[
                  { value: "none", label: "Без группы" },
                  ...productGroups.map(g => ({ value: g.id, label: g.name }))
                ]}
                placeholder="Все"
              />
              <ResizeHandle col="groups" />
            </div>
          )}
          {visibleColumns.catalogs && (
            <div className="flex-shrink-0 text-xs font-medium text-muted-foreground relative" style={{ width: widths.catalogs }}>
              Каталоги
              <ResizeHandle col="catalogs" />
            </div>
          )}
          {visibleColumns.sync && (
            <div className="flex-shrink-0 relative" style={{ width: widths.sync }}>
              <SelectFilter
                value={filters.sync}
                onChange={(v) => onFiltersChange({...filters, sync: v})}
                options={[
                  { value: "synced", label: "Да" },
                  { value: "notSynced", label: "Нет" },
                ]}
                placeholder="Все"
              />
              <ResizeHandle col="sync" />
            </div>
          )}
        </div>
      </div>

      {/* Virtualized Body */}
      <div 
        ref={parentRef}
        className="overflow-y-auto overflow-x-auto"
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
                  minHeight: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                  zIndex: isExpanded ? 10 : 1,
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
                  onAIGenerateDescription={onAIGenerateDescription}
                  isAIGeneratingDescription={isAIGeneratingDescription}
                  aiGeneratingProductId={aiGeneratingProductId}
                  columnWidths={widths}
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
