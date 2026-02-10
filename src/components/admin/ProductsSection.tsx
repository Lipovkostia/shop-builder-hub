import React, { useState, useMemo, useCallback } from "react";
import { VirtualProductTable, AllProductsFilters } from "./VirtualProductTable";
import { VisibleColumns } from "./MemoizedProductRow";
import { BulkEditPanel } from "./BulkEditPanel";
import { useOptimisticImagePreviews } from "@/hooks/useOptimisticImagePreviews";
import { uploadFilesToStorage } from "@/hooks/useProductImages";
import { Product, Catalog, ProductGroup, PackagingType } from "./types";
import { Button } from "@/components/ui/button";
import { Plus, Filter, Columns, Download, Sparkles } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { MegacatalogDialog } from "./MegacatalogDialog";
interface ProductsSectionProps {
  products: Product[];
  catalogs: Catalog[];
  productGroups: ProductGroup[];
  productCatalogVisibility: Record<string, Set<string>>;
  getProductGroupIds: (productId: string) => string[];
  onToggleCatalogVisibility: (productId: string, catalogId: string) => void;
  onSetProductGroupAssignments: (productId: string, groupIds: string[]) => void;
  onCreateProductGroup: (name: string) => Promise<ProductGroup | null>;
  onCreateCatalog: (name: string) => Promise<Catalog | null>;
  onUpdateProduct: (product: Product) => Promise<void>;
  onDeleteProducts: (productIds: string[]) => Promise<void>;
  onToggleAutoSync: (productId: string) => void;
  onAddProduct: () => void;
  onAddProductsFromMegacatalog: (products: any[]) => Promise<void>;
  onNavigateToCatalog?: (catalogId: string) => void;
  onOpenAIAssistant?: () => void;
  customUnits?: string[];
  customPackagingTypes?: string[];
  onAddCustomUnit?: (unit: string) => void;
  onAddCustomPackaging?: (type: string) => void;
}

const defaultVisibleColumns: VisibleColumns = {
  photo: true,
  name: true,
  sku: true,
  desc: true,
  source: true,
  unit: true,
  type: true,
  volume: true,
  cost: true,
  price: true,
  groups: true,
  catalogs: true,
  sync: true,
};

const defaultFilters: AllProductsFilters = {
  name: "",
  sku: "",
  desc: "",
  source: "all",
  unit: "all",
  type: "all",
  volume: "",
  cost: "",
  price: "",
  status: "all",
  sync: "all",
  groups: [],
};

export function ProductsSection({
  products,
  catalogs,
  productGroups,
  productCatalogVisibility,
  getProductGroupIds,
  onToggleCatalogVisibility,
  onSetProductGroupAssignments,
  onCreateProductGroup,
  onCreateCatalog,
  onUpdateProduct,
  onDeleteProducts,
  onToggleAutoSync,
  onAddProduct,
  onAddProductsFromMegacatalog,
  onNavigateToCatalog,
  onOpenAIAssistant,
  customUnits = [],
  customPackagingTypes = [],
  onAddCustomUnit,
  onAddCustomPackaging,
}: ProductsSectionProps) {
  const { toast } = useToast();
  
  // Local state isolated to this section
  const [selectedBulkProducts, setSelectedBulkProducts] = useState<Set<string>>(new Set());
  const [lastSelectedProductId, setLastSelectedProductId] = useState<string | null>(null);
  const [filters, setFilters] = useState<AllProductsFilters>(defaultFilters);
  const [visibleColumns, setVisibleColumns] = useState<VisibleColumns>(defaultVisibleColumns);
  const [expandedAssortmentImages, setExpandedAssortmentImages] = useState<string | null>(null);
  const [deletingImageProductId, setDeletingImageProductId] = useState<string | null>(null);
  const [uploadingImageProductId, setUploadingImageProductId] = useState<string | null>(null);
  const [megacatalogOpen, setMegacatalogOpen] = useState(false);

  // Set of existing product IDs for megacatalog
  const existingProductIds = useMemo(() => new Set(products.map(p => p.id)), [products]);

  // Optimistic image previews
  const { optimisticPreviews, addPreviews, clearPreviews } = useOptimisticImagePreviews();

  // Unit options
  const allUnitOptions = useMemo(() => {
    const baseOptions = [
      { value: "кг", label: "кг" },
      { value: "шт", label: "шт" },
      { value: "л", label: "л" },
      { value: "уп", label: "уп" },
      { value: "г", label: "г" },
      { value: "мл", label: "мл" },
    ];
    const customOpts = customUnits
      .filter((u) => !baseOptions.find((o) => o.value === u))
      .map((u) => ({ value: u, label: u }));
    return [...baseOptions, ...customOpts];
  }, [customUnits]);

  // Packaging options
  const allPackagingOptions = useMemo(() => {
    const baseOptions = [
      { value: "head", label: "Голова" },
      { value: "package", label: "Упаковка" },
      { value: "piece", label: "Штучный товар" },
      { value: "can", label: "Банка" },
      { value: "box", label: "Ящик" },
      { value: "carcass", label: "Туша" },
    ];
    const customOpts = customPackagingTypes
      .filter((t) => !baseOptions.find((o) => o.value === t))
      .map((t) => ({ value: t, label: t }));
    return [...baseOptions, ...customOpts];
  }, [customPackagingTypes]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      if (filters.name && !product.name.toLowerCase().includes(filters.name.toLowerCase())) {
        return false;
      }
      if (filters.sku && !(product.sku || "").toLowerCase().includes(filters.sku.toLowerCase())) {
        return false;
      }
      if (filters.desc && !(product.description || "").toLowerCase().includes(filters.desc.toLowerCase())) {
        return false;
      }
      if (filters.source !== "all") {
        const isMs = product.source === "moysklad";
        if (filters.source === "moysklad" && !isMs) return false;
        if (filters.source === "local" && isMs) return false;
      }
      if (filters.unit !== "all" && product.unit !== filters.unit) {
        return false;
      }
      if (filters.type !== "all" && product.productType !== filters.type) {
        return false;
      }
      if (filters.volume) {
        const volumeStr = product.unitWeight?.toString() || "";
        if (!volumeStr.includes(filters.volume)) return false;
      }
      if (filters.cost) {
        const costStr = product.buyPrice?.toString() || "";
        if (!costStr.includes(filters.cost)) return false;
      }
      if (filters.price) {
        const priceStr = product.pricePerUnit?.toString() || "";
        if (!priceStr.includes(filters.price)) return false;
      }
      if (filters.sync !== "all" && product.source === "moysklad") {
        if (filters.sync === "synced" && !product.autoSync) return false;
        if (filters.sync === "notSynced" && product.autoSync) return false;
      }
      // Filter by groups
      if (filters.groups.length > 0) {
        const productGroupIds = getProductGroupIds(product.id);
        const hasNoneFilter = filters.groups.includes("none");
        const otherGroupFilters = filters.groups.filter((g) => g !== "none");

        const matchesNone = hasNoneFilter && productGroupIds.length === 0;
        const matchesGroups = otherGroupFilters.length > 0 && otherGroupFilters.some((g) => productGroupIds.includes(g));

        if (!matchesNone && !matchesGroups) return false;
      }
      return true;
    });
  }, [products, filters, getProductGroupIds]);

  // Handlers
  const handleToggleBulkSelection = useCallback((productId: string, shiftKey: boolean = false) => {
    setSelectedBulkProducts((prev) => {
      const next = new Set(prev);
      
      // If Shift is pressed and we have a last selected product, select range
      if (shiftKey && lastSelectedProductId) {
        const lastIndex = filteredProducts.findIndex(p => p.id === lastSelectedProductId);
        const currentIndex = filteredProducts.findIndex(p => p.id === productId);
        
        if (lastIndex !== -1 && currentIndex !== -1) {
          const startIndex = Math.min(lastIndex, currentIndex);
          const endIndex = Math.max(lastIndex, currentIndex);
          
          // Add all products in range
          for (let i = startIndex; i <= endIndex; i++) {
            next.add(filteredProducts[i].id);
          }
          return next;
        }
      }
      
      // Normal toggle behavior
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
    
    // Always update last selected
    setLastSelectedProductId(productId);
  }, [lastSelectedProductId, filteredProducts]);

  const handleSelectAll = useCallback(() => {
    if (selectedBulkProducts.size === filteredProducts.length) {
      setSelectedBulkProducts(new Set());
    } else {
      setSelectedBulkProducts(new Set(filteredProducts.map((p) => p.id)));
    }
  }, [selectedBulkProducts.size, filteredProducts]);

  const handleUpdateProduct = useCallback(
    async (product: Product) => {
      await onUpdateProduct(product);
    },
    [onUpdateProduct]
  );

  const handleDeleteProductImage = useCallback(
    async (productId: string, index: number) => {
      setDeletingImageProductId(productId);
      try {
        const product = products.find((p) => p.id === productId);
        if (product && product.images) {
          const newImages = [...product.images];
          newImages.splice(index, 1);
          await onUpdateProduct({ ...product, images: newImages, image: newImages[0] || "" });
          toast({ title: "Фото удалено" });
        }
      } finally {
        setDeletingImageProductId(null);
      }
    },
    [products, onUpdateProduct, toast]
  );

  const handleAddProductImages = useCallback(
    async (productId: string, files: FileList, source: "file" | "camera") => {
      const product = products.find((p) => p.id === productId);
      if (!product) return;

      // Immediately show optimistic previews
      addPreviews(productId, files);
      setUploadingImageProductId(productId);

      try {
        // Upload files in background
        const fileArray = Array.from(files);
        const startIndex = (product.images || []).length;
        const uploadedUrls = await uploadFilesToStorage(fileArray, productId, startIndex);

        if (uploadedUrls.length > 0) {
          const newImages = [...(product.images || []), ...uploadedUrls];
          await onUpdateProduct({
            ...product,
            images: newImages,
            image: product.image || uploadedUrls[0],
          });
          toast({ title: `Добавлено ${uploadedUrls.length} фото` });
        }
      } finally {
        // Clear optimistic previews after real images are saved
        clearPreviews(productId);
        setUploadingImageProductId(null);
      }
    },
    [products, onUpdateProduct, addPreviews, clearPreviews, toast]
  );

  const handleSetMainImage = useCallback(
    async (productId: string, index: number) => {
      const product = products.find((p) => p.id === productId);
      if (product && product.images && product.images[index]) {
        const newImages = [...product.images];
        const [mainImage] = newImages.splice(index, 1);
        newImages.unshift(mainImage);
        await onUpdateProduct({ ...product, images: newImages, image: mainImage });
        toast({ title: "Главное фото изменено" });
      }
    },
    [products, onUpdateProduct, toast]
  );

  const handleBulkUpdate = useCallback(
    async (updates: Partial<Product>) => {
      const selectedIds = Array.from(selectedBulkProducts);
      for (const id of selectedIds) {
        const product = products.find((p) => p.id === id);
        if (product) {
          await onUpdateProduct({ ...product, ...updates });
        }
      }
      toast({ title: "Товары обновлены", description: `Изменено ${selectedIds.length} товар(ов)` });
      setSelectedBulkProducts(new Set());
    },
    [selectedBulkProducts, products, onUpdateProduct, toast]
  );

  const handleBulkDelete = useCallback(async () => {
    const selectedIds = Array.from(selectedBulkProducts);
    await onDeleteProducts(selectedIds);
    toast({ title: "Товары удалены", description: `Удалено ${selectedIds.length} товар(ов)` });
    setSelectedBulkProducts(new Set());
  }, [selectedBulkProducts, onDeleteProducts, toast]);

  // Add selected products to a catalog
  const handleAddToCatalog = useCallback(
    (catalogId: string) => {
      const selectedIds = Array.from(selectedBulkProducts);
      for (const productId of selectedIds) {
        // Check if already in catalog
        const isInCatalog = productCatalogVisibility[productId]?.has(catalogId);
        if (!isInCatalog) {
          onToggleCatalogVisibility(productId, catalogId);
        }
      }
      const catalog = catalogs.find((c) => c.id === catalogId);
      toast({
        title: "Товары добавлены в прайс-лист",
        description: `${selectedIds.length} товар(ов) добавлено в "${catalog?.name || "прайс-лист"}"`,
      });
      setSelectedBulkProducts(new Set());
    },
    [selectedBulkProducts, productCatalogVisibility, onToggleCatalogVisibility, catalogs, toast]
  );

  // Create new catalog and add selected products
  const handleCreateCatalogAndAdd = useCallback(
    async (catalogName: string) => {
      const newCatalog = await onCreateCatalog(catalogName);
      if (newCatalog) {
        const selectedIds = Array.from(selectedBulkProducts);
        for (const productId of selectedIds) {
          onToggleCatalogVisibility(productId, newCatalog.id);
        }
        toast({
          title: "Прайс-лист создан",
          description: `${selectedIds.length} товар(ов) добавлено в "${catalogName}"`,
        });
        setSelectedBulkProducts(new Set());
      }
    },
    [selectedBulkProducts, onCreateCatalog, onToggleCatalogVisibility, toast]
  );

  const toggleColumn = useCallback((columnKey: keyof VisibleColumns) => {
    setVisibleColumns((prev) => ({
      ...prev,
      [columnKey]: !prev[columnKey],
    }));
  }, []);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={onAddProduct} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Добавить товар
        </Button>

        <Button variant="outline" size="sm" onClick={() => setMegacatalogOpen(true)}>
          <Globe className="h-4 w-4 mr-2" />
          Мегакаталог
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Columns className="h-4 w-4 mr-2" />
              Столбцы
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuCheckboxItem checked={visibleColumns.photo} onCheckedChange={() => toggleColumn("photo")}>
              Фото
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={visibleColumns.name} onCheckedChange={() => toggleColumn("name")}>
              Название
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={visibleColumns.sku} onCheckedChange={() => toggleColumn("sku")}>
              SKU
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={visibleColumns.desc} onCheckedChange={() => toggleColumn("desc")}>
              Описание
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={visibleColumns.source} onCheckedChange={() => toggleColumn("source")}>
              Источник
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={visibleColumns.unit} onCheckedChange={() => toggleColumn("unit")}>
              Единица
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={visibleColumns.type} onCheckedChange={() => toggleColumn("type")}>
              Тип
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={visibleColumns.volume} onCheckedChange={() => toggleColumn("volume")}>
              Объём
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={visibleColumns.cost} onCheckedChange={() => toggleColumn("cost")}>
              Себестоимость
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={visibleColumns.price} onCheckedChange={() => toggleColumn("price")}>
              Цена
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={visibleColumns.groups} onCheckedChange={() => toggleColumn("groups")}>
              Группы
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={visibleColumns.catalogs} onCheckedChange={() => toggleColumn("catalogs")}>
              Каталоги
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={visibleColumns.sync} onCheckedChange={() => toggleColumn("sync")}>
              Синхр.
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {onOpenAIAssistant && (
          <Button variant="outline" size="sm" onClick={onOpenAIAssistant}>
            <Sparkles className="h-4 w-4 mr-2" />
            AI Помощник
          </Button>
        )}

        <div className="flex-1" />

        <span className="text-sm text-muted-foreground">
          {filteredProducts.length} товар(ов)
        </span>
      </div>

      {/* Megacatalog Dialog */}
      <MegacatalogDialog
        open={megacatalogOpen}
        onOpenChange={setMegacatalogOpen}
        existingProductIds={existingProductIds}
        onAddProducts={onAddProductsFromMegacatalog}
      />

      {/* Bulk Edit Panel */}
      {selectedBulkProducts.size > 0 && (
        <BulkEditPanel
          selectedCount={selectedBulkProducts.size}
          onClearSelection={() => setSelectedBulkProducts(new Set())}
          onBulkUpdate={handleBulkUpdate}
          onBulkDelete={handleBulkDelete}
          unitOptions={allUnitOptions}
          packagingOptions={allPackagingOptions}
          catalogs={catalogs}
          onAddToCatalog={handleAddToCatalog}
          onCreateCatalogAndAdd={handleCreateCatalogAndAdd}
        />
      )}

      {/* Virtualized Table */}
      <VirtualProductTable
        products={filteredProducts}
        selectedBulkProducts={selectedBulkProducts}
        onToggleBulkSelection={handleToggleBulkSelection}
        onSelectAll={handleSelectAll}
        onUpdateProduct={handleUpdateProduct}
        visibleColumns={visibleColumns}
        filters={filters}
        onFiltersChange={setFilters}
        catalogs={catalogs}
        productGroups={productGroups}
        productCatalogVisibility={productCatalogVisibility}
        getProductGroupIds={getProductGroupIds}
        onToggleCatalogVisibility={onToggleCatalogVisibility}
        onSetProductGroupAssignments={onSetProductGroupAssignments}
        onCreateProductGroup={onCreateProductGroup}
        onCreateCatalog={onCreateCatalog}
        onToggleAutoSync={onToggleAutoSync}
        expandedAssortmentImages={expandedAssortmentImages}
        onToggleImageExpansion={setExpandedAssortmentImages}
        onDeleteProductImage={handleDeleteProductImage}
        onAddProductImages={handleAddProductImages}
        onSetMainImage={handleSetMainImage}
        deletingImageProductId={deletingImageProductId}
        uploadingImageProductId={uploadingImageProductId}
        allUnitOptions={allUnitOptions}
        allPackagingOptions={allPackagingOptions}
        onAddCustomUnit={onAddCustomUnit || (() => {})}
        onAddCustomPackaging={onAddCustomPackaging || (() => {})}
        onNavigateToCatalog={onNavigateToCatalog}
        optimisticImagePreviews={optimisticPreviews}
      />
    </div>
  );
}
