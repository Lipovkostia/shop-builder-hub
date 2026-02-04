import React, { useRef, useCallback, memo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { InlineEditableCell } from "./InlineEditableCell";
import { InlineSelectCell } from "./InlineSelectCell";
import { InlineMultiSelectCell } from "./InlineMultiSelectCell";
import { InlinePrimaryCategoryCell } from "./InlinePrimaryCategoryCell";
import { InlinePriceCell } from "./InlinePriceCell";
import { InlineMarkupCell } from "./InlineMarkupCell";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Product,
  ProductStatus,
  CatalogProductPricing,
  formatPrice,
  calculatePackagingPrices,
  PackagingType,
  MarkupSettings,
} from "./types";

interface CatalogVisibleColumns {
  bulkCheckbox?: boolean;
  photo?: boolean;
  name?: boolean;
  description?: boolean;
  primaryCategory?: boolean;
  subcategories?: boolean;
  unit?: boolean;
  volume?: boolean;
  type?: boolean;
  buyPrice?: boolean;
  markup?: boolean;
  price?: boolean;
  priceFull?: boolean;
  priceHalf?: boolean;
  priceQuarter?: boolean;
  pricePortion?: boolean;
  status?: boolean;
  [key: string]: boolean | undefined;
}

interface CategoryOption {
  id: string;
  name: string;
  sort_order?: number | null;
  parent_id?: string | null;
}

interface VirtualCatalogTableProps {
  products: Product[];
  catalogId: string;
  visibleColumns: CatalogVisibleColumns;
  selectedBulkProducts: Set<string>;
  lastSelectedProductId: string | null;
  categories: CategoryOption[];
  storeCategories: CategoryOption[];
  unitOptions: { value: string; label: string }[];
  packagingOptions: { value: string; label: string }[];
  getCatalogProductPricing: (catalogId: string, productId: string) => CatalogProductPricing | undefined;
  getCatalogSalePrice: (product: Product, pricing: CatalogProductPricing | undefined) => number;
  getCatalogProductStatus: (product: Product, pricing: CatalogProductPricing | undefined) => ProductStatus;
  updateProduct: (product: Product) => void;
  updateCatalogProductPricing: (catalogId: string, productId: string, updates: Partial<CatalogProductPricing>) => void;
  onSelectProduct: (productId: string, shiftKey: boolean) => void;
  onAddCategory: (name: string) => Promise<string | null>;
  onAddSubcategory: (name: string, parentId: string | null) => Promise<string | null>;
  onOpenCategoryOrder: () => void;
}

// Memoized row component with optimized comparison
const CatalogRow = memo(({
  product,
  catalogId,
  catalogPricing,
  salePrice,
  packagingPrices,
  effectivePrimaryCategory,
  effectiveCategories,
  effectiveStatus,
  effectiveMarkup,
  effectivePortionPrices,
  isSelected,
  visibleColumns,
  categories,
  storeCategories,
  unitOptions,
  packagingOptions,
  style,
  updateProduct,
  updateCatalogProductPricing,
  onSelectProduct,
  onAddCategory,
  onAddSubcategory,
  onOpenCategoryOrder,
}: {
  product: Product;
  catalogId: string;
  catalogPricing: CatalogProductPricing | undefined;
  salePrice: number;
  packagingPrices: ReturnType<typeof calculatePackagingPrices>;
  effectivePrimaryCategory: string | null;
  effectiveCategories: string[];
  effectiveStatus: ProductStatus;
  effectiveMarkup: MarkupSettings | undefined;
  effectivePortionPrices: { halfPricePerKg?: number; quarterPricePerKg?: number; portionPrice?: number } | null;
  isSelected: boolean;
  visibleColumns: CatalogVisibleColumns;
  categories: CategoryOption[];
  storeCategories: CategoryOption[];
  unitOptions: { value: string; label: string }[];
  packagingOptions: { value: string; label: string }[];
  style: React.CSSProperties;
  updateProduct: (product: Product) => void;
  updateCatalogProductPricing: (catalogId: string, productId: string, updates: Partial<CatalogProductPricing>) => void;
  onSelectProduct: (productId: string, shiftKey: boolean) => void;
  onAddCategory: (name: string) => Promise<string | null>;
  onAddSubcategory: (name: string, parentId: string | null) => Promise<string | null>;
  onOpenCategoryOrder: () => void;
}) => {
  const baseName = product.name;
  const baseDescription = product.description;
  const baseUnit = product.unit;
  const baseUnitWeight = product.unitWeight;
  const basePackagingType = product.packagingType;

  // Filter subcategories based on primary category
  const subcategoryOptions = categories
    .filter(c => {
      const cat = storeCategories.find(sc => sc.id === c.id);
      if (effectivePrimaryCategory) {
        return cat?.parent_id === effectivePrimaryCategory;
      }
      return cat?.parent_id !== null;
    })
    .map(c => ({ value: c.id, label: c.name, sort_order: c.sort_order }));

  return (
    <div
      style={style}
      className={`flex items-center border-b border-border ${isSelected ? "bg-primary/10" : "hover:bg-muted/50"}`}
    >
      {visibleColumns.bulkCheckbox && (
        <div className="flex-shrink-0 w-[40px] px-2">
          <div
            onClick={(e) => onSelectProduct(product.id, e.shiftKey)}
            className="cursor-pointer"
          >
            <Checkbox checked={isSelected} className="pointer-events-none" />
          </div>
        </div>
      )}
      
      {visibleColumns.photo && (
        <div className="flex-shrink-0 w-[60px] px-2">
          <img
            src={product.image}
            alt={baseName}
            className="w-10 h-10 rounded object-cover"
            loading="lazy"
            decoding="async"
          />
        </div>
      )}

      {visibleColumns.name && (
        <div className="flex-shrink-0 w-[180px] px-2 font-medium">
          <InlineEditableCell
            value={baseName}
            onSave={(newName) => {
              if (newName && newName !== baseName) {
                updateProduct({ ...product, name: newName });
              }
            }}
            placeholder="Название"
          />
        </div>
      )}

      {visibleColumns.description && (
        <div className="flex-shrink-0 w-[200px] px-2">
          <InlineEditableCell
            value={baseDescription || ""}
            onSave={(newDesc) => {
              if (newDesc !== baseDescription) {
                updateProduct({ ...product, description: newDesc });
              }
            }}
            placeholder="Описание..."
            className="text-muted-foreground text-xs"
          />
        </div>
      )}

      {visibleColumns.primaryCategory && (
        <div className="flex-shrink-0 w-[120px] px-2">
          <InlinePrimaryCategoryCell
            value={effectivePrimaryCategory}
            options={categories.map(c => ({
              value: c.id,
              label: c.name,
              sort_order: c.sort_order,
              parent_id: storeCategories.find(sc => sc.id === c.id)?.parent_id || null
            }))}
            onSave={(categoryId) => {
              updateCatalogProductPricing(catalogId, product.id, { primary_category_id: categoryId });
            }}
            onAddOption={onAddCategory}
            onManageCategories={onOpenCategoryOrder}
            placeholder="Категория..."
            addNewPlaceholder="Новая категория..."
            addNewButtonLabel="Создать категорию"
            allowAddNew={true}
          />
        </div>
      )}

      {visibleColumns.subcategories && (
        <div className="flex-shrink-0 w-[140px] px-2">
          <InlineMultiSelectCell
            values={effectiveCategories || []}
            options={subcategoryOptions}
            onSave={(selectedIds) => {
              updateCatalogProductPricing(catalogId, product.id, { categories: selectedIds });
            }}
            onAddOption={async (name) => {
              return await onAddSubcategory(name, effectivePrimaryCategory);
            }}
            onReorder={onOpenCategoryOrder}
            placeholder="Подкатегории..."
            addNewPlaceholder="Новая подкатегория..."
            addNewButtonLabel="Создать подкатегорию"
            emptyStateMessage={effectivePrimaryCategory ? "Нет подкатегорий" : "Выберите категорию"}
            allowAddNew={!!effectivePrimaryCategory}
            showReorderButton={true}
          />
        </div>
      )}

      {visibleColumns.unit && (
        <div className="flex-shrink-0 w-[80px] px-2">
          <InlineSelectCell
            value={baseUnit}
            options={unitOptions}
            onSave={(newUnit) => {
              if (newUnit !== baseUnit) {
                updateProduct({ ...product, unit: newUnit });
              }
            }}
            addNewPlaceholder="Ед..."
            allowAddNew={true}
          />
        </div>
      )}

      {visibleColumns.volume && (
        <div className="flex-shrink-0 w-[80px] px-2">
          <InlinePriceCell
            value={baseUnitWeight}
            onSave={(newVolume) => {
              if (newVolume !== baseUnitWeight) {
                updateProduct({ ...product, unitWeight: newVolume });
              }
            }}
            placeholder="0"
            suffix={baseUnit}
          />
        </div>
      )}

      {visibleColumns.type && (
        <div className="flex-shrink-0 w-[100px] px-2">
          <InlineSelectCell
            value={basePackagingType || "piece"}
            options={packagingOptions}
            onSave={(newType) => {
              if (newType !== basePackagingType) {
                updateProduct({ ...product, packagingType: newType as PackagingType });
              }
            }}
            addNewPlaceholder="Вид..."
            allowAddNew={true}
          />
        </div>
      )}

      {visibleColumns.buyPrice && (
        <div className="flex-shrink-0 w-[90px] px-2">
          <InlinePriceCell
            value={product.buyPrice}
            onSave={(newBuyPrice) => {
              if (newBuyPrice !== product.buyPrice) {
                updateProduct({ ...product, buyPrice: newBuyPrice });
              }
            }}
            placeholder="—"
            suffix="₽"
          />
        </div>
      )}

      {visibleColumns.markup && (
        <div className="flex-shrink-0 w-[120px] px-2">
          <InlineMarkupCell
            value={effectiveMarkup}
            onSave={(markup) => {
              updateCatalogProductPricing(catalogId, product.id, { markup });
            }}
          />
        </div>
      )}

      {visibleColumns.price && (
        <div className="flex-shrink-0 w-[100px] px-2 font-medium">
          <span className="text-xs">{formatPrice(salePrice)}/{baseUnit}</span>
        </div>
      )}

      {visibleColumns.priceFull && (
        <div className="flex-shrink-0 w-[90px] px-2">
          {packagingPrices ? (
            <span className="text-xs font-medium">{formatPrice(packagingPrices.full)}</span>
          ) : "-"}
        </div>
      )}

      {visibleColumns.priceHalf && (
        <div className="flex-shrink-0 w-[90px] px-2">
          <InlinePriceCell
            value={effectivePortionPrices?.halfPricePerKg}
            onSave={(value) => {
              updateCatalogProductPricing(catalogId, product.id, {
                portionPrices: { ...effectivePortionPrices, halfPricePerKg: value }
              });
            }}
            placeholder="—"
            suffix=""
          />
        </div>
      )}

      {visibleColumns.priceQuarter && (
        <div className="flex-shrink-0 w-[90px] px-2">
          <InlinePriceCell
            value={effectivePortionPrices?.quarterPricePerKg}
            onSave={(value) => {
              updateCatalogProductPricing(catalogId, product.id, {
                portionPrices: { ...effectivePortionPrices, quarterPricePerKg: value }
              });
            }}
            placeholder="—"
            suffix=""
          />
        </div>
      )}

      {visibleColumns.pricePortion && (
        <div className="flex-shrink-0 w-[90px] px-2">
          <InlinePriceCell
            value={effectivePortionPrices?.portionPrice}
            onSave={(value) => {
              updateCatalogProductPricing(catalogId, product.id, {
                portionPrices: { ...effectivePortionPrices, portionPrice: value }
              });
            }}
            placeholder="—"
            suffix=""
          />
        </div>
      )}

      {visibleColumns.status && (
        <div className="flex-shrink-0 w-[100px] px-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              const nextStatus: ProductStatus =
                effectiveStatus === "in_stock" ? "pre_order" :
                effectiveStatus === "pre_order" ? "out_of_stock" :
                effectiveStatus === "out_of_stock" ? "hidden" : "in_stock";
              updateCatalogProductPricing(catalogId, product.id, { status: nextStatus });
            }}
            className="focus:outline-none touch-manipulation p-1"
          >
            <Badge
              variant={effectiveStatus === "hidden" ? "outline" : effectiveStatus === "in_stock" ? "default" : "secondary"}
              className={`text-xs cursor-pointer transition-colors select-none ${
                effectiveStatus === "hidden"
                  ? "bg-muted/50 text-muted-foreground border-dashed"
                  : effectiveStatus === "in_stock"
                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                    : effectiveStatus === "pre_order"
                      ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100"
                      : "bg-muted text-muted-foreground"
              }`}
            >
              {effectiveStatus === "hidden" ? "Скрыт" :
               effectiveStatus === "in_stock" ? "В наличии" :
               effectiveStatus === "pre_order" ? "Под заказ" : "Нет"}
            </Badge>
          </button>
        </div>
      )}
    </div>
  );
}, (prev, next) => {
  // Custom comparison - only re-render when relevant data changes
  // IMPORTANT: Include visibleColumns to re-render when column visibility changes
  return prev.product.id === next.product.id &&
         prev.product.name === next.product.name &&
         prev.product.description === next.product.description &&
         prev.product.unit === next.product.unit &&
         prev.product.unitWeight === next.product.unitWeight &&
         prev.product.packagingType === next.product.packagingType &&
         prev.product.buyPrice === next.product.buyPrice &&
         prev.product.image === next.product.image &&
         prev.effectivePrimaryCategory === next.effectivePrimaryCategory &&
         prev.effectiveStatus === next.effectiveStatus &&
         prev.salePrice === next.salePrice &&
         prev.isSelected === next.isSelected &&
         // Check if categories/storeCategories changed (for subcategory dropdown options)
         prev.categories.length === next.categories.length &&
         prev.storeCategories.length === next.storeCategories.length &&
         JSON.stringify(prev.effectiveCategories) === JSON.stringify(next.effectiveCategories) &&
         JSON.stringify(prev.effectiveMarkup) === JSON.stringify(next.effectiveMarkup) &&
         JSON.stringify(prev.effectivePortionPrices) === JSON.stringify(next.effectivePortionPrices) &&
         // Check column visibility changes
         JSON.stringify(prev.visibleColumns) === JSON.stringify(next.visibleColumns);
});

CatalogRow.displayName = 'CatalogRow';

// Loading skeleton row
const SkeletonRow = memo(({ style, visibleColumns }: { style: React.CSSProperties; visibleColumns: CatalogVisibleColumns }) => (
  <div style={style} className="flex items-center border-b border-border">
    {visibleColumns.bulkCheckbox && <div className="flex-shrink-0 w-[40px] px-2"><Skeleton className="h-4 w-4" /></div>}
    {visibleColumns.photo && <div className="flex-shrink-0 w-[60px] px-2"><Skeleton className="h-10 w-10 rounded" /></div>}
    {visibleColumns.name && <div className="flex-shrink-0 w-[180px] px-2"><Skeleton className="h-4 w-32" /></div>}
    {visibleColumns.description && <div className="flex-shrink-0 w-[200px] px-2"><Skeleton className="h-4 w-40" /></div>}
    {visibleColumns.primaryCategory && <div className="flex-shrink-0 w-[120px] px-2"><Skeleton className="h-6 w-20" /></div>}
    {visibleColumns.subcategories && <div className="flex-shrink-0 w-[140px] px-2"><Skeleton className="h-6 w-24" /></div>}
    {visibleColumns.unit && <div className="flex-shrink-0 w-[80px] px-2"><Skeleton className="h-4 w-12" /></div>}
    {visibleColumns.volume && <div className="flex-shrink-0 w-[80px] px-2"><Skeleton className="h-4 w-12" /></div>}
    {visibleColumns.type && <div className="flex-shrink-0 w-[100px] px-2"><Skeleton className="h-4 w-16" /></div>}
    {visibleColumns.buyPrice && <div className="flex-shrink-0 w-[90px] px-2"><Skeleton className="h-4 w-14" /></div>}
    {visibleColumns.markup && <div className="flex-shrink-0 w-[120px] px-2"><Skeleton className="h-4 w-20" /></div>}
    {visibleColumns.price && <div className="flex-shrink-0 w-[100px] px-2"><Skeleton className="h-4 w-16" /></div>}
    {visibleColumns.status && <div className="flex-shrink-0 w-[100px] px-2"><Skeleton className="h-6 w-16" /></div>}
  </div>
));

SkeletonRow.displayName = 'SkeletonRow';

export function VirtualCatalogTable({
  products,
  catalogId,
  visibleColumns,
  selectedBulkProducts,
  lastSelectedProductId,
  categories,
  storeCategories,
  unitOptions,
  packagingOptions,
  getCatalogProductPricing,
  getCatalogSalePrice,
  getCatalogProductStatus,
  updateProduct,
  updateCatalogProductPricing,
  onSelectProduct,
  onAddCategory,
  onAddSubcategory,
  onOpenCategoryOrder,
}: VirtualCatalogTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const ROW_HEIGHT = 48;
  
  const virtualizer = useVirtualizer({
    count: products.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 15, // Render 15 extra rows outside viewport for smoother scrolling
  });

  const handleSelectProduct = useCallback((productId: string, shiftKey: boolean) => {
    onSelectProduct(productId, shiftKey);
  }, [onSelectProduct]);

  // Calculate total width based on visible columns
  const totalWidth = 
    (visibleColumns.bulkCheckbox ? 40 : 0) +
    (visibleColumns.photo ? 60 : 0) +
    (visibleColumns.name ? 180 : 0) +
    (visibleColumns.description ? 200 : 0) +
    (visibleColumns.primaryCategory ? 120 : 0) +
    (visibleColumns.subcategories ? 140 : 0) +
    (visibleColumns.unit ? 80 : 0) +
    (visibleColumns.volume ? 80 : 0) +
    (visibleColumns.type ? 100 : 0) +
    (visibleColumns.buyPrice ? 90 : 0) +
    (visibleColumns.markup ? 120 : 0) +
    (visibleColumns.price ? 100 : 0) +
    (visibleColumns.priceFull ? 90 : 0) +
    (visibleColumns.priceHalf ? 90 : 0) +
    (visibleColumns.priceQuarter ? 90 : 0) +
    (visibleColumns.pricePortion ? 90 : 0) +
    (visibleColumns.status ? 100 : 0);

  return (
    <div
      ref={parentRef}
      className="overflow-auto bg-card rounded-lg border border-border"
      style={{ height: 'calc(100vh - 260px)', minHeight: '500px' }}
    >
      {/* Header */}
      <div 
        className="sticky top-0 z-10 bg-muted/50 border-b border-border flex items-center font-medium text-xs text-muted-foreground"
        style={{ minWidth: totalWidth }}
      >
        {visibleColumns.bulkCheckbox && <div className="flex-shrink-0 w-[40px] px-2 py-2">✓</div>}
        {visibleColumns.photo && <div className="flex-shrink-0 w-[60px] px-2 py-2">Фото</div>}
        {visibleColumns.name && <div className="flex-shrink-0 w-[180px] px-2 py-2">Название</div>}
        {visibleColumns.description && <div className="flex-shrink-0 w-[200px] px-2 py-2">Описание</div>}
        {visibleColumns.primaryCategory && <div className="flex-shrink-0 w-[120px] px-2 py-2">Категория</div>}
        {visibleColumns.subcategories && <div className="flex-shrink-0 w-[140px] px-2 py-2">Подкатегория</div>}
        {visibleColumns.unit && <div className="flex-shrink-0 w-[80px] px-2 py-2">Ед. изм.</div>}
        {visibleColumns.volume && <div className="flex-shrink-0 w-[80px] px-2 py-2">Объем</div>}
        {visibleColumns.type && <div className="flex-shrink-0 w-[100px] px-2 py-2">Вид</div>}
        {visibleColumns.buyPrice && <div className="flex-shrink-0 w-[90px] px-2 py-2">Себест-ть</div>}
        {visibleColumns.markup && <div className="flex-shrink-0 w-[120px] px-2 py-2">Наценка</div>}
        {visibleColumns.price && <div className="flex-shrink-0 w-[100px] px-2 py-2">Цена</div>}
        {visibleColumns.priceFull && <div className="flex-shrink-0 w-[90px] px-2 py-2">Целая</div>}
        {visibleColumns.priceHalf && <div className="flex-shrink-0 w-[90px] px-2 py-2">½</div>}
        {visibleColumns.priceQuarter && <div className="flex-shrink-0 w-[90px] px-2 py-2">¼</div>}
        {visibleColumns.pricePortion && <div className="flex-shrink-0 w-[90px] px-2 py-2">Порция</div>}
        {visibleColumns.status && <div className="flex-shrink-0 w-[100px] px-2 py-2">Статус</div>}
      </div>

      {/* Virtual rows container */}
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: '100%',
          position: 'relative',
          minWidth: totalWidth,
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const product = products[virtualRow.index];
          const catalogPricing = getCatalogProductPricing(catalogId, product.id);
          const effectivePrimaryCategory = catalogPricing?.primary_category_id ?? null;
          const effectiveCategories = catalogPricing?.categories ?? product.categories;
          const effectiveMarkup = catalogPricing?.markup ?? product.markup;
          const effectivePortionPrices = catalogPricing?.portionPrices ?? product.portionPrices;
          const effectiveStatus = getCatalogProductStatus(product, catalogPricing);
          const salePrice = getCatalogSalePrice(product, catalogPricing);
          const packagingPrices = calculatePackagingPrices(
            salePrice,
            product.unitWeight,
            product.packagingType,
            product.customVariantPrices,
            effectivePortionPrices
          );

          return (
            <CatalogRow
              key={product.id}
              product={product}
              catalogId={catalogId}
              catalogPricing={catalogPricing}
              salePrice={salePrice}
              packagingPrices={packagingPrices}
              effectivePrimaryCategory={effectivePrimaryCategory}
              effectiveCategories={effectiveCategories || []}
              effectiveStatus={effectiveStatus}
              effectiveMarkup={effectiveMarkup}
              effectivePortionPrices={effectivePortionPrices}
              isSelected={selectedBulkProducts.has(product.id)}
              visibleColumns={visibleColumns}
              categories={categories}
              storeCategories={storeCategories}
              unitOptions={unitOptions}
              packagingOptions={packagingOptions}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: ROW_HEIGHT,
                transform: `translateY(${virtualRow.start}px)`,
              }}
              updateProduct={updateProduct}
              updateCatalogProductPricing={updateCatalogProductPricing}
              onSelectProduct={handleSelectProduct}
              onAddCategory={onAddCategory}
              onAddSubcategory={onAddSubcategory}
              onOpenCategoryOrder={onOpenCategoryOrder}
            />
          );
        })}
      </div>
    </div>
  );
}
