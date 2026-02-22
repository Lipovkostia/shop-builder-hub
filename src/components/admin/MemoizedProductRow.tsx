import React, { memo, useCallback } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GripVertical, Plus, Lock, Unlock } from "lucide-react";
import { InlineEditableCell } from "./InlineEditableCell";
import { InlineSelectCell } from "./InlineSelectCell";
import { InlineMultiSelectCell } from "./InlineMultiSelectCell";
import { InlinePriceCell } from "./InlinePriceCell";
import { InlineMarkupCell } from "./InlineMarkupCell";
import { ImageGalleryViewer } from "./ImageGalleryViewer";
import {
  Product,
  Catalog,
  ProductGroup,
  PackagingType,
  calculateSalePrice,
  calculatePackagingPrices,
} from "./types";
import { TableRow, TableCell } from "@/components/ui/table";

export interface VisibleColumns {
  photo: boolean;
  name: boolean;
  sku: boolean;
  desc: boolean;
  source: boolean;
  unit: boolean;
  type: boolean;
  volume: boolean;
  cost: boolean;
  price: boolean;
  groups: boolean;
  catalogs: boolean;
  sync: boolean;
}

export interface ProductRowData {
  product: Product;
  isSelected: boolean;
  isExpanded: boolean;
  catalogVisibility: Set<string>;
  productGroupIds: string[];
  isDeleting: boolean;
  isUploading: boolean;
}

interface MemoizedProductRowProps {
  product: Product;
  isSelected: boolean;
  onToggleSelection: (productId: string, shiftKey?: boolean) => void;
  onUpdateProduct: (product: Product) => void;
  visibleColumns: VisibleColumns;
  catalogs: Catalog[];
  productGroups: ProductGroup[];
  catalogVisibility: Set<string>;
  productGroupIds: string[];
  onToggleCatalogVisibility: (productId: string, catalogId: string) => void;
  onSetProductGroupAssignments: (productId: string, groupIds: string[]) => void;
  onCreateProductGroup: (name: string) => Promise<ProductGroup | null>;
  onCreateCatalog: (name: string) => Promise<Catalog | null>;
  onToggleAutoSync: (productId: string) => void;
  isExpanded: boolean;
  onToggleExpansion: (productId: string) => void;
  onDeleteProductImage: (productId: string, index: number) => void;
  onAddProductImages: (productId: string, files: FileList, source: 'file' | 'camera') => void;
  onSetMainImage: (productId: string, index: number) => void;
  isDeleting: boolean;
  isUploading: boolean;
  allUnitOptions: { value: string; label: string }[];
  allPackagingOptions: { value: string; label: string }[];
  onAddCustomUnit: (unit: string) => void;
  onAddCustomPackaging: (type: string) => void;
  onNavigateToCatalog?: (catalogId: string) => void;
  optimisticImages?: string[];
  onAIGenerateDescription?: (productId: string, productName: string) => void;
  isAIGeneratingDescription?: boolean;
  aiGeneratingProductId?: string | null;
  columnWidths?: Record<string, number>;
}

function ProductRowComponent({
  product,
  isSelected,
  onToggleSelection,
  onUpdateProduct,
  visibleColumns,
  catalogs,
  productGroups,
  catalogVisibility,
  productGroupIds,
  onToggleCatalogVisibility,
  onSetProductGroupAssignments,
  onCreateProductGroup,
  onCreateCatalog,
  onToggleAutoSync,
  isExpanded,
  onToggleExpansion,
  onDeleteProductImage,
  onAddProductImages,
  onSetMainImage,
  isDeleting,
  isUploading,
  allUnitOptions,
  allPackagingOptions,
  onAddCustomUnit,
  onAddCustomPackaging,
  onNavigateToCatalog,
  optimisticImages,
  onAIGenerateDescription,
  isAIGeneratingDescription,
  aiGeneratingProductId,
  columnWidths,
}: MemoizedProductRowProps) {
  // If fixed price is enabled, use pricePerUnit directly
  // Otherwise calculate from buyPrice + markup, or fall back to pricePerUnit
  const salePrice = product.isFixedPrice
    ? product.pricePerUnit
    : (product.buyPrice && product.markup
        ? calculateSalePrice(product.buyPrice, product.markup)
        : product.pricePerUnit);

  const packagingPrices = calculatePackagingPrices(
    salePrice,
    product.unitWeight,
    product.packagingType,
    product.customVariantPrices
  );

  // Use optimistic images if provided, otherwise fall back to product.images
  const displayImages = optimisticImages || product.images || [];

  const handleToggleSelection = useCallback((e?: React.MouseEvent | boolean) => {
    // Handle both checkbox change (boolean) and click events
    const shiftKey = typeof e === 'object' && e !== null ? e.shiftKey : false;
    onToggleSelection(product.id, shiftKey);
  }, [onToggleSelection, product.id]);

  const handleToggleExpansion = useCallback(() => {
    onToggleExpansion(product.id);
  }, [onToggleExpansion, product.id]);

  const handleToggleAutoSync = useCallback(() => {
    onToggleAutoSync(product.id);
  }, [onToggleAutoSync, product.id]);

  const handleDeleteImage = useCallback((index: number) => {
    onDeleteProductImage(product.id, index);
  }, [onDeleteProductImage, product.id]);

  const handleAddImages = useCallback((files: FileList, source: 'file' | 'camera') => {
    onAddProductImages(product.id, files, source);
  }, [onAddProductImages, product.id]);

  const handleSetMainImage = useCallback((index: number) => {
    onSetMainImage(product.id, index);
  }, [onSetMainImage, product.id]);

  const handleUpdateName = useCallback((newName: string) => {
    onUpdateProduct({ ...product, name: newName });
  }, [onUpdateProduct, product]);

  const handleUpdateSku = useCallback((newSku: string) => {
    onUpdateProduct({ ...product, sku: newSku });
  }, [onUpdateProduct, product]);

  const handleUpdateDesc = useCallback((newDesc: string) => {
    onUpdateProduct({ ...product, description: newDesc });
  }, [onUpdateProduct, product]);

  const handleUpdateUnit = useCallback((newUnit: string) => {
    onUpdateProduct({ ...product, unit: newUnit });
  }, [onUpdateProduct, product]);

  const handleUpdatePackagingType = useCallback((newType: string) => {
    onUpdateProduct({ ...product, packagingType: newType as PackagingType });
  }, [onUpdateProduct, product]);

  const handleUpdateVolume = useCallback((newVolume: number | undefined) => {
    onUpdateProduct({ ...product, unitWeight: newVolume });
  }, [onUpdateProduct, product]);

  const handleUpdateCost = useCallback((newCost: number | undefined) => {
    onUpdateProduct({ ...product, buyPrice: newCost });
  }, [onUpdateProduct, product]);

  const handleUpdatePrice = useCallback((newPrice: number | undefined) => {
    // When editing price manually, automatically enable fixed price
    onUpdateProduct({ ...product, pricePerUnit: newPrice ?? 0, isFixedPrice: true });
  }, [onUpdateProduct, product]);

  const handleToggleFixedPrice = useCallback(() => {
    onUpdateProduct({ ...product, isFixedPrice: !product.isFixedPrice });
  }, [onUpdateProduct, product]);

  const handleUpdateGroups = useCallback((selectedIds: string[]) => {
    onSetProductGroupAssignments(product.id, selectedIds);
  }, [onSetProductGroupAssignments, product.id]);

  const handleUpdateCatalogs = useCallback((selectedIds: string[]) => {
    const currentSet = catalogVisibility;
    const newSet = new Set(selectedIds);
    
    // Find added and removed
    selectedIds.forEach(id => {
      if (!currentSet.has(id)) {
        onToggleCatalogVisibility(product.id, id);
      }
    });
    currentSet.forEach(id => {
      if (!newSet.has(id)) {
        onToggleCatalogVisibility(product.id, id);
      }
    });
  }, [catalogVisibility, onToggleCatalogVisibility, product.id]);

  return (
    <div className="border-b border-border">
      {/* Main row */}
      <div className="flex items-center gap-1 px-1.5 py-0.5 hover:bg-muted/30 transition-colors min-h-[28px] text-xs">
        {/* Drag handle */}
        <div className="w-8 flex-shrink-0 flex items-center justify-center cursor-grab">
          <GripVertical className="h-3 w-3 text-muted-foreground/50" />
        </div>

        {/* Checkbox */}
        <div 
          className="w-8 flex-shrink-0 flex items-center justify-center cursor-pointer"
          onClick={handleToggleSelection}
        >
          <Checkbox
            checked={isSelected}
            className="pointer-events-none"
          />
        </div>

        {/* Photo */}
        {visibleColumns.photo && (
          <div className="flex-shrink-0 flex items-center justify-center" style={{ width: columnWidths?.photo || 32 }}>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 relative"
              onClick={handleToggleExpansion}
            >
              {product.image ? (
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-5 h-5 rounded object-cover"
                />
              ) : (
                <div className="w-5 h-5 rounded bg-muted flex items-center justify-center hover:bg-primary/10 transition-colors">
                  <Plus className="h-3 w-3 text-muted-foreground" />
                </div>
              )}
              {displayImages.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[8px] rounded-full w-3.5 h-3.5 flex items-center justify-center leading-none">
                  {displayImages.length}
                </span>
              )}
            </Button>
          </div>
        )}

        {/* Name */}
        {visibleColumns.name && (
          <div className="flex-shrink-0 min-w-0" style={{ width: columnWidths?.name || 200 }}>
            <InlineEditableCell
              value={product.name}
              onSave={handleUpdateName}
              placeholder="Название"
            />
          </div>
        )}

        {/* SKU */}
        {visibleColumns.sku && (
          <div className="flex-shrink-0" style={{ width: columnWidths?.sku || 80 }}>
            <InlineEditableCell
              value={product.sku || ""}
              onSave={handleUpdateSku}
              placeholder="—"
              className="font-mono text-xs text-muted-foreground"
            />
          </div>
        )}

        {/* Description */}
        {visibleColumns.desc && (
          <div className="flex-shrink-0" style={{ width: columnWidths?.desc || 96 }}>
            <InlineEditableCell
              value={product.description || ""}
              onSave={handleUpdateDesc}
              placeholder="Описание..."
              className="text-muted-foreground"
              onAIGenerate={onAIGenerateDescription ? () => onAIGenerateDescription(product.id, product.name) : undefined}
              isAIGenerating={isAIGeneratingDescription && aiGeneratingProductId === product.id}
            />
          </div>
        )}

        {/* Source */}
        {visibleColumns.source && (
          <div className="flex-shrink-0" style={{ width: columnWidths?.source || 64 }}>
            {product.source === "moysklad" ? (
              <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800 whitespace-nowrap">
                МС
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] whitespace-nowrap">
                Лок
              </Badge>
            )}
          </div>
        )}

        {/* Unit */}
        {visibleColumns.unit && (
          <div className="flex-shrink-0" style={{ width: columnWidths?.unit || 64 }}>
            <InlineSelectCell
              value={product.unit}
              options={allUnitOptions}
              onSave={handleUpdateUnit}
              onAddOption={onAddCustomUnit}
              addNewPlaceholder="Ед..."
            />
          </div>
        )}

        {/* Type */}
        {visibleColumns.type && (
          <div className="flex-shrink-0" style={{ width: columnWidths?.type || 80 }}>
            <InlineSelectCell
              value={product.packagingType || (product.productType === "weight" ? "head" : "piece")}
              options={allPackagingOptions}
              onSave={handleUpdatePackagingType}
              onAddOption={onAddCustomPackaging}
              addNewPlaceholder="Вид..."
            />
          </div>
        )}

        {/* Volume */}
        {visibleColumns.volume && (
          <div className="flex-shrink-0" style={{ width: columnWidths?.volume || 64 }}>
            <InlinePriceCell
              value={product.unitWeight}
              onSave={handleUpdateVolume}
              placeholder="0"
              suffix={product.unit}
            />
          </div>
        )}

        {/* Cost (Себестоимость) */}
        {visibleColumns.cost && (
          <div className="flex-shrink-0" style={{ width: columnWidths?.cost || 64 }}>
            <InlinePriceCell
              value={product.buyPrice}
              onSave={handleUpdateCost}
              placeholder="—"
            />
          </div>
        )}

        {/* Price (Отпускная цена) */}
        {visibleColumns.price && (
          <div className="flex-shrink-0 flex items-center gap-1" style={{ width: columnWidths?.price || 80 }}>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 flex-shrink-0"
              onClick={handleToggleFixedPrice}
              title={product.isFixedPrice 
                ? "Фиксированная цена (кликните для расчёта по наценке)" 
                : "Цена по наценке (кликните для фиксации)"}
            >
              {product.isFixedPrice 
                ? <Lock className="h-3 w-3 text-amber-500" /> 
                : <Unlock className="h-3 w-3 text-muted-foreground/40" />}
            </Button>
            <InlinePriceCell
              value={product.pricePerUnit}
              onSave={handleUpdatePrice}
              placeholder="0"
            />
          </div>
        )}

        {/* Groups */}
        {visibleColumns.groups && (
          <div className="flex-shrink-0" style={{ width: columnWidths?.groups || 96 }}>
            <InlineMultiSelectCell
              values={productGroupIds}
              options={productGroups.map(g => ({ value: g.id, label: g.name }))}
              onSave={handleUpdateGroups}
              onAddOption={async (name) => {
                const group = await onCreateProductGroup(name);
                return group?.id || null;
              }}
              placeholder="Группа..."
              addNewPlaceholder="Новая группа..."
              allowAddNew={true}
            />
          </div>
        )}

        {/* Catalogs */}
        {visibleColumns.catalogs && (
          <div className="flex-shrink-0" style={{ width: columnWidths?.catalogs || 112 }}>
            <InlineMultiSelectCell
              values={Array.from(catalogVisibility)}
              options={catalogs.map(c => ({ value: c.id, label: c.name }))}
              onSave={handleUpdateCatalogs}
              onAddOption={async (name) => {
                const catalog = await onCreateCatalog(name);
                return catalog?.id || null;
              }}
              onNavigate={onNavigateToCatalog}
              placeholder="Каталог..."
              addNewPlaceholder="Новый каталог..."
              allowAddNew={true}
            />
          </div>
        )}

        {/* Sync */}
        {visibleColumns.sync && (
          <div className="flex-shrink-0" style={{ width: columnWidths?.sync || 48 }}>
            {product.source === "moysklad" && (
              <Button
                variant="ghost"
                size="icon"
                className={`h-6 w-6 ${product.autoSync ? "text-primary" : "text-muted-foreground"}`}
                onClick={handleToggleAutoSync}
                title={product.autoSync ? "Синхр. вкл" : "Синхр. выкл"}
              >
                {product.autoSync ? (
                  <Lock className="h-3 w-3" />
                ) : (
                  <Unlock className="h-3 w-3" />
                )}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Expanded images row */}
      {isExpanded && (
        <div className="bg-muted/30 px-4 py-3 border-t border-border">
          <ImageGalleryViewer
            images={displayImages}
            productName={product.name}
            productId={product.id}
            onDeleteImage={handleDeleteImage}
            onAddImages={handleAddImages}
            onSetMainImage={handleSetMainImage}
            isDeleting={isDeleting}
            isUploading={isUploading}
          />
        </div>
      )}
    </div>
  );
}

// Custom comparison function for React.memo
function areEqual(prevProps: MemoizedProductRowProps, nextProps: MemoizedProductRowProps): boolean {
  // Quick checks for primitives
  if (prevProps.isSelected !== nextProps.isSelected) return false;
  if (prevProps.isExpanded !== nextProps.isExpanded) return false;
  if (prevProps.isDeleting !== nextProps.isDeleting) return false;
  if (prevProps.isUploading !== nextProps.isUploading) return false;
  
  // Check product changes (compare key fields)
  const prevProduct = prevProps.product;
  const nextProduct = nextProps.product;
  if (prevProduct.id !== nextProduct.id) return false;
  if (prevProduct.name !== nextProduct.name) return false;
  if (prevProduct.sku !== nextProduct.sku) return false;
  if (prevProduct.description !== nextProduct.description) return false;
  if (prevProduct.unit !== nextProduct.unit) return false;
  if (prevProduct.packagingType !== nextProduct.packagingType) return false;
  if (prevProduct.unitWeight !== nextProduct.unitWeight) return false;
  if (prevProduct.buyPrice !== nextProduct.buyPrice) return false;
  if (prevProduct.pricePerUnit !== nextProduct.pricePerUnit) return false;
  if (prevProduct.autoSync !== nextProduct.autoSync) return false;
  if (prevProduct.source !== nextProduct.source) return false;
  if (prevProduct.image !== nextProduct.image) return false;
  if (prevProduct.isFixedPrice !== nextProduct.isFixedPrice) return false;
  
  // Check images array
  const prevImages = prevProduct.images || [];
  const nextImages = nextProduct.images || [];
  if (prevImages.length !== nextImages.length) return false;
  
  // Check optimistic images
  const prevOptimistic = prevProps.optimisticImages || [];
  const nextOptimistic = nextProps.optimisticImages || [];
  if (prevOptimistic.length !== nextOptimistic.length) return false;
  
  // Check product group IDs
  if (prevProps.productGroupIds.length !== nextProps.productGroupIds.length) return false;
  for (let i = 0; i < prevProps.productGroupIds.length; i++) {
    if (prevProps.productGroupIds[i] !== nextProps.productGroupIds[i]) return false;
  }
  
  // Check catalog visibility set
  if (prevProps.catalogVisibility.size !== nextProps.catalogVisibility.size) return false;
  for (const id of prevProps.catalogVisibility) {
    if (!nextProps.catalogVisibility.has(id)) return false;
  }
  
  // Check visible columns
  const prevCols = prevProps.visibleColumns;
  const nextCols = nextProps.visibleColumns;
  if (prevCols.photo !== nextCols.photo) return false;
  if (prevCols.name !== nextCols.name) return false;
  if (prevCols.sku !== nextCols.sku) return false;
  if (prevCols.desc !== nextCols.desc) return false;
  if (prevCols.source !== nextCols.source) return false;
  if (prevCols.unit !== nextCols.unit) return false;
  if (prevCols.type !== nextCols.type) return false;
  if (prevCols.volume !== nextCols.volume) return false;
  if (prevCols.cost !== nextCols.cost) return false;
  if (prevCols.price !== nextCols.price) return false;
  if (prevCols.groups !== nextCols.groups) return false;
  if (prevCols.catalogs !== nextCols.catalogs) return false;
  if (prevCols.sync !== nextCols.sync) return false;
  
  // Check column widths
  if (prevProps.columnWidths !== nextProps.columnWidths) return false;
  
  // All checks passed
  return true;
}

export const MemoizedProductRow = memo(ProductRowComponent, areEqual);
