import React, { useRef, useCallback, useMemo } from "react";
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
import { ResizableColumnHeader } from "./ResizableColumnHeader";
import { useResizableColumns, ColumnConfig } from "@/hooks/useResizableColumns";

// =============== COLUMN CONFIGURATION ===============
const COLUMN_CONFIGS: ColumnConfig[] = [
  { id: 'drag', minWidth: 32, defaultWidth: 32 },
  { id: 'checkbox', minWidth: 32, defaultWidth: 32 },
  { id: 'photo', minWidth: 48, defaultWidth: 48 },
  { id: 'name', minWidth: 120, defaultWidth: 220 },
  { id: 'sku', minWidth: 60, defaultWidth: 80 },
  { id: 'desc', minWidth: 80, defaultWidth: 100 },
  { id: 'source', minWidth: 50, defaultWidth: 64 },
  { id: 'unit', minWidth: 50, defaultWidth: 64 },
  { id: 'type', minWidth: 60, defaultWidth: 80 },
  { id: 'volume', minWidth: 50, defaultWidth: 64 },
  { id: 'cost', minWidth: 50, defaultWidth: 64 },
  { id: 'groups', minWidth: 80, defaultWidth: 96 },
  { id: 'catalogs', minWidth: 100, defaultWidth: 112 },
  { id: 'sync', minWidth: 40, defaultWidth: 48 },
];

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
}

const ROW_HEIGHT = 48;
const EXPANDED_ROW_HEIGHT = 180;
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

  // Resizable columns
  const { columnWidths, setColumnWidth, getColumnWidth, getTotalWidth } = useResizableColumns(
    COLUMN_CONFIGS,
    'products-assortment'
  );

  // Calculate total width based on visible columns
  const totalWidth = useMemo(() => {
    let width = getColumnWidth('drag') + getColumnWidth('checkbox'); // Always visible
    if (visibleColumns.photo) width += getColumnWidth('photo');
    if (visibleColumns.name) width += getColumnWidth('name');
    if (visibleColumns.sku) width += getColumnWidth('sku');
    if (visibleColumns.desc) width += getColumnWidth('desc');
    if (visibleColumns.source) width += getColumnWidth('source');
    if (visibleColumns.unit) width += getColumnWidth('unit');
    if (visibleColumns.type) width += getColumnWidth('type');
    if (visibleColumns.volume) width += getColumnWidth('volume');
    if (visibleColumns.cost) width += getColumnWidth('cost');
    if (visibleColumns.groups) width += getColumnWidth('groups');
    if (visibleColumns.catalogs) width += getColumnWidth('catalogs');
    if (visibleColumns.sync) width += getColumnWidth('sync');
    return width;
  }, [visibleColumns, getColumnWidth, columnWidths]);

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
      {/* Single scroll container for header + body */}
      <div 
        ref={parentRef}
        className="overflow-auto"
        style={{ height: 'calc(100vh - 300px)', minHeight: '400px' }}
      >
        {/* Sticky Header */}
        <div 
          className="sticky top-0 z-10 bg-muted/30 border-b flex items-center gap-2 px-2 py-2 min-h-[40px]"
          style={{ minWidth: totalWidth }}
        >
          {/* Drag handle column - not resizable */}
          <div 
            className="flex-shrink-0 flex items-center justify-center"
            style={{ width: getColumnWidth('drag') }}
          >
            <GripVertical className="h-3 w-3 text-muted-foreground/50" />
          </div>
          
          {/* Checkbox column - not resizable */}
          <div 
            className="flex-shrink-0 flex items-center justify-center"
            style={{ width: getColumnWidth('checkbox') }}
          >
            <Checkbox
              checked={allSelected}
              onCheckedChange={onSelectAll}
            />
          </div>
          
          {visibleColumns.photo && (
            <ResizableColumnHeader
              columnId="photo"
              width={getColumnWidth('photo')}
              minWidth={48}
              onWidthChange={setColumnWidth}
              className="text-xs font-medium text-muted-foreground"
            >
              Фото
            </ResizableColumnHeader>
          )}
          {visibleColumns.name && (
            <ResizableColumnHeader
              columnId="name"
              width={getColumnWidth('name')}
              minWidth={120}
              onWidthChange={setColumnWidth}
              className="flex flex-col gap-1"
            >
              <span className="text-xs font-medium text-muted-foreground">Название</span>
              <ColumnFilter 
                value={filters.name} 
                onChange={(v) => onFiltersChange({...filters, name: v})}
                placeholder="Поиск..."
              />
            </ResizableColumnHeader>
          )}
          {visibleColumns.sku && (
            <ResizableColumnHeader
              columnId="sku"
              width={getColumnWidth('sku')}
              minWidth={60}
              onWidthChange={setColumnWidth}
            >
              <ColumnFilter 
                value={filters.sku || ""} 
                onChange={(v) => onFiltersChange({...filters, sku: v})}
                placeholder="SKU..."
              />
            </ResizableColumnHeader>
          )}
          {visibleColumns.desc && (
            <ResizableColumnHeader
              columnId="desc"
              width={getColumnWidth('desc')}
              minWidth={80}
              onWidthChange={setColumnWidth}
            >
              <ColumnFilter 
                value={filters.desc} 
                onChange={(v) => onFiltersChange({...filters, desc: v})}
                placeholder="Описание..."
              />
            </ResizableColumnHeader>
          )}
          {visibleColumns.source && (
            <ResizableColumnHeader
              columnId="source"
              width={getColumnWidth('source')}
              minWidth={50}
              onWidthChange={setColumnWidth}
            >
              <SelectFilter
                value={filters.source}
                onChange={(v) => onFiltersChange({...filters, source: v})}
                options={[
                  { value: "moysklad", label: "МС" },
                  { value: "local", label: "Лок" },
                ]}
                placeholder="Все"
              />
            </ResizableColumnHeader>
          )}
          {visibleColumns.unit && (
            <ResizableColumnHeader
              columnId="unit"
              width={getColumnWidth('unit')}
              minWidth={50}
              onWidthChange={setColumnWidth}
            >
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
            </ResizableColumnHeader>
          )}
          {visibleColumns.type && (
            <ResizableColumnHeader
              columnId="type"
              width={getColumnWidth('type')}
              minWidth={60}
              onWidthChange={setColumnWidth}
            >
              <SelectFilter
                value={filters.type}
                onChange={(v) => onFiltersChange({...filters, type: v})}
                options={[
                  { value: "weight", label: "Вес" },
                  { value: "piece", label: "Шт" },
                ]}
                placeholder="Все"
              />
            </ResizableColumnHeader>
          )}
          {visibleColumns.volume && (
            <ResizableColumnHeader
              columnId="volume"
              width={getColumnWidth('volume')}
              minWidth={50}
              onWidthChange={setColumnWidth}
            >
              <ColumnFilter 
                value={filters.volume} 
                onChange={(v) => onFiltersChange({...filters, volume: v})}
                placeholder="Объём..."
              />
            </ResizableColumnHeader>
          )}
          {visibleColumns.cost && (
            <ResizableColumnHeader
              columnId="cost"
              width={getColumnWidth('cost')}
              minWidth={50}
              onWidthChange={setColumnWidth}
            >
              <ColumnFilter 
                value={filters.cost} 
                onChange={(v) => onFiltersChange({...filters, cost: v})}
                placeholder="Цена..."
              />
            </ResizableColumnHeader>
          )}
          {visibleColumns.groups && (
            <ResizableColumnHeader
              columnId="groups"
              width={getColumnWidth('groups')}
              minWidth={80}
              onWidthChange={setColumnWidth}
            >
              <MultiSelectFilter
                values={filters.groups}
                onChange={(v) => onFiltersChange({...filters, groups: v})}
                options={[
                  { value: "none", label: "Без группы" },
                  ...productGroups.map(g => ({ value: g.id, label: g.name }))
                ]}
                placeholder="Все"
              />
            </ResizableColumnHeader>
          )}
          {visibleColumns.catalogs && (
            <ResizableColumnHeader
              columnId="catalogs"
              width={getColumnWidth('catalogs')}
              minWidth={100}
              onWidthChange={setColumnWidth}
              className="text-xs font-medium text-muted-foreground"
            >
              Каталоги
            </ResizableColumnHeader>
          )}
          {visibleColumns.sync && (
            <ResizableColumnHeader
              columnId="sync"
              width={getColumnWidth('sync')}
              minWidth={40}
              onWidthChange={setColumnWidth}
            >
              <SelectFilter
                value={filters.sync}
                onChange={(v) => onFiltersChange({...filters, sync: v})}
                options={[
                  { value: "synced", label: "Да" },
                  { value: "notSynced", label: "Нет" },
                ]}
                placeholder="Все"
              />
            </ResizableColumnHeader>
          )}
        </div>

        {/* Virtualized Body */}
        <div
          style={{
            height: `${totalSize}px`,
            minWidth: totalWidth,
            position: 'relative',
          }}
        >
          {virtualItems.map((virtualRow) => {
            const product = products[virtualRow.index];
            if (!product) return null;

            const isExpanded = expandedAssortmentImages === product.id;
            
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
                  minWidth: totalWidth,
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
                  columnWidths={columnWidths}
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
