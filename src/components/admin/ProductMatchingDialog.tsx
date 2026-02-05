import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search,
  Plus,
  Link2,
  Unlink,
  Package,
  Tag,
  Trash2,
  ChevronRight,
  Store,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useCanonicalProducts,
  type CanonicalProduct,
  type ProductAlias,
  type LinkedProduct,
} from "@/hooks/useCanonicalProducts";

interface ProductMatchingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductMatchingDialog({
  open,
  onOpenChange,
}: ProductMatchingDialogProps) {
  const {
    canonicalProducts,
    isLoadingCanonical,
    fetchAliases,
    fetchLinkedProducts,
    fetchUnlinkedProducts,
    searchCanonical,
    createCanonical,
    deleteCanonical,
    addAlias,
    deleteAlias,
    linkProduct,
    unlinkProduct,
    createFromProduct,
    isCreating,
    isLinking,
  } = useCanonicalProducts();

  const [activeTab, setActiveTab] = useState<"catalog" | "unlinked">("catalog");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCanonical, setSelectedCanonical] = useState<CanonicalProduct | null>(null);
  const [aliases, setAliases] = useState<ProductAlias[]>([]);
  const [linkedProducts, setLinkedProducts] = useState<LinkedProduct[]>([]);
  const [unlinkedProducts, setUnlinkedProducts] = useState<LinkedProduct[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isLoadingUnlinked, setIsLoadingUnlinked] = useState(false);

  // New alias form
  const [newAliasType, setNewAliasType] = useState<ProductAlias["alias_type"]>("name");
  const [newAliasValue, setNewAliasValue] = useState("");

  // New canonical product form
  const [showNewForm, setShowNewForm] = useState(false);
  const [newCanonicalName, setNewCanonicalName] = useState("");
  const [newCanonicalSku, setNewCanonicalSku] = useState("");

  // Filter canonical products by search
  const filteredCanonical = canonicalProducts.filter(
    (p) =>
      p.canonical_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.canonical_sku?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  );

  // Load details when selecting a canonical product
  useEffect(() => {
    if (selectedCanonical) {
      setIsLoadingDetails(true);
      Promise.all([
        fetchAliases(selectedCanonical.id),
        fetchLinkedProducts(selectedCanonical.id),
      ])
        .then(([aliasesData, productsData]) => {
          setAliases(aliasesData);
          setLinkedProducts(productsData);
        })
        .finally(() => setIsLoadingDetails(false));
    } else {
      setAliases([]);
      setLinkedProducts([]);
    }
  }, [selectedCanonical, fetchAliases, fetchLinkedProducts]);

  // Load unlinked products
  useEffect(() => {
    if (activeTab === "unlinked") {
      setIsLoadingUnlinked(true);
      fetchUnlinkedProducts()
        .then(setUnlinkedProducts)
        .finally(() => setIsLoadingUnlinked(false));
    }
  }, [activeTab, fetchUnlinkedProducts]);

  const handleCreateCanonical = async () => {
    if (!newCanonicalName.trim()) return;

    await createCanonical({
      canonical_name: newCanonicalName.trim(),
      canonical_sku: newCanonicalSku.trim() || null,
    });

    setNewCanonicalName("");
    setNewCanonicalSku("");
    setShowNewForm(false);
  };

  const handleAddAlias = async () => {
    if (!selectedCanonical || !newAliasValue.trim()) return;

    await addAlias({
      canonical_product_id: selectedCanonical.id,
      alias_type: newAliasType,
      alias_value: newAliasValue.trim(),
    });

    // Refresh aliases
    const updatedAliases = await fetchAliases(selectedCanonical.id);
    setAliases(updatedAliases);
    setNewAliasValue("");
  };

  const handleDeleteAlias = async (aliasId: string) => {
    await deleteAlias(aliasId);
    setAliases((prev) => prev.filter((a) => a.id !== aliasId));
  };

  const handleLinkProduct = async (product: LinkedProduct) => {
    if (!selectedCanonical) return;

    await linkProduct({
      productId: product.id,
      canonicalProductId: selectedCanonical.id,
    });

    // Refresh
    const [updatedLinked, updatedAliases] = await Promise.all([
      fetchLinkedProducts(selectedCanonical.id),
      fetchAliases(selectedCanonical.id),
    ]);
    setLinkedProducts(updatedLinked);
    setAliases(updatedAliases);
    setUnlinkedProducts((prev) => prev.filter((p) => p.id !== product.id));
  };

  const handleUnlinkProduct = async (productId: string) => {
    await unlinkProduct(productId);
    setLinkedProducts((prev) => prev.filter((p) => p.id !== productId));
  };

  const handleCreateFromProduct = async (product: LinkedProduct) => {
    const canonical = await createFromProduct(product.id);
    setSelectedCanonical(canonical);
    setActiveTab("catalog");
    setUnlinkedProducts((prev) => prev.filter((p) => p.id !== product.id));
  };

  const handleDeleteCanonical = async () => {
    if (!selectedCanonical) return;
    await deleteCanonical(selectedCanonical.id);
    setSelectedCanonical(null);
  };

  const aliasTypeLabels: Record<ProductAlias["alias_type"], string> = {
    name: "Название",
    sku: "Артикул",
    barcode: "Штрих-код",
    moysklad_id: "МойСклад ID",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Сопоставление товаров
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Left panel - Catalog / Unlinked tabs */}
          <div className="w-1/2 border-r flex flex-col">
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as "catalog" | "unlinked")}
              className="flex flex-col flex-1"
            >
              <TabsList className="mx-4 mt-4 mb-2">
                <TabsTrigger value="catalog" className="flex-1">
                  Мастер-каталог
                </TabsTrigger>
                <TabsTrigger value="unlinked" className="flex-1">
                  Несопоставленные
                </TabsTrigger>
              </TabsList>

              <div className="px-4 pb-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Поиск..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <TabsContent value="catalog" className="flex-1 overflow-hidden m-0">
                <ScrollArea className="h-full">
                  <div className="px-4 pb-4 space-y-1">
                    {/* New canonical form */}
                    {showNewForm ? (
                      <div className="p-3 border rounded-lg bg-muted/50 space-y-2">
                        <Input
                          placeholder="Название мастер-товара"
                          value={newCanonicalName}
                          onChange={(e) => setNewCanonicalName(e.target.value)}
                          autoFocus
                        />
                        <Input
                          placeholder="Артикул (опционально)"
                          value={newCanonicalSku}
                          onChange={(e) => setNewCanonicalSku(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={handleCreateCanonical}
                            disabled={!newCanonicalName.trim() || isCreating}
                          >
                            Создать
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setShowNewForm(false)}
                          >
                            Отмена
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => setShowNewForm(true)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Создать мастер-товар
                      </Button>
                    )}

                    {isLoadingCanonical ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Загрузка...
                      </div>
                    ) : filteredCanonical.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        {searchQuery ? "Ничего не найдено" : "Нет мастер-товаров"}
                      </div>
                    ) : (
                      filteredCanonical.map((product) => (
                        <button
                          key={product.id}
                          onClick={() => setSelectedCanonical(product)}
                          className={cn(
                            "w-full text-left p-3 rounded-lg border transition-colors",
                            selectedCanonical?.id === product.id
                              ? "border-primary bg-primary/5"
                              : "hover:bg-muted/50"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">
                                {product.canonical_name}
                              </p>
                              {product.canonical_sku && (
                                <p className="text-xs text-muted-foreground">
                                  {product.canonical_sku}
                                </p>
                              )}
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="unlinked" className="flex-1 overflow-hidden m-0">
                <ScrollArea className="h-full">
                  <div className="px-4 pb-4 space-y-1">
                    {isLoadingUnlinked ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Загрузка...
                      </div>
                    ) : unlinkedProducts.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Все товары сопоставлены
                      </div>
                    ) : (
                      unlinkedProducts
                        .filter(
                          (p) =>
                            !searchQuery ||
                            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            p.sku?.toLowerCase().includes(searchQuery.toLowerCase())
                        )
                        .map((product) => (
                          <div
                            key={product.id}
                            className="p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-start gap-2">
                              <Package className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{product.name}</p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  {product.sku && <span>{product.sku}</span>}
                                  <span className="flex items-center gap-1">
                                    <Store className="h-3 w-3" />
                                    {product.store_name}
                                  </span>
                                </div>
                              </div>
                              <div className="flex gap-1 flex-shrink-0">
                                {selectedCanonical && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleLinkProduct(product)}
                                    disabled={isLinking}
                                  >
                                    <Link2 className="h-3 w-3 mr-1" />
                                    Привязать
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleCreateFromProduct(product)}
                                  disabled={isCreating}
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  Создать
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right panel - Selected canonical details */}
          <div className="w-1/2 flex flex-col">
            {selectedCanonical ? (
              <>
                <div className="p-4 border-b">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-lg">
                        {selectedCanonical.canonical_name}
                      </h3>
                      {selectedCanonical.canonical_sku && (
                        <p className="text-sm text-muted-foreground">
                          Артикул: {selectedCanonical.canonical_sku}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedCanonical(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={handleDeleteCanonical}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <ScrollArea className="flex-1">
                  <div className="p-4 space-y-6">
                    {/* Aliases section */}
                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Tag className="h-4 w-4" />
                        Синонимы ({aliases.length})
                      </h4>

                      <div className="space-y-2 mb-3">
                        {aliases.map((alias) => (
                          <div
                            key={alias.id}
                            className="flex items-center gap-2 p-2 rounded bg-muted/50"
                          >
                            <Badge variant="outline" className="text-xs">
                              {aliasTypeLabels[alias.alias_type]}
                            </Badge>
                            <span className="flex-1 text-sm truncate">
                              {alias.alias_value}
                            </span>
                            <Badge variant="secondary" className="text-xs">
                              {alias.source}
                            </Badge>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={() => handleDeleteAlias(alias.id)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-2">
                        <select
                          value={newAliasType}
                          onChange={(e) =>
                            setNewAliasType(e.target.value as ProductAlias["alias_type"])
                          }
                          className="h-9 rounded-md border bg-background px-3 text-sm"
                        >
                          {Object.entries(aliasTypeLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                        <Input
                          placeholder="Значение синонима"
                          value={newAliasValue}
                          onChange={(e) => setNewAliasValue(e.target.value)}
                          className="flex-1"
                        />
                        <Button
                          size="sm"
                          onClick={handleAddAlias}
                          disabled={!newAliasValue.trim()}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Linked products section */}
                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Link2 className="h-4 w-4" />
                        Привязанные товары ({linkedProducts.length})
                      </h4>

                      {isLoadingDetails ? (
                        <div className="text-center py-4 text-muted-foreground">
                          Загрузка...
                        </div>
                      ) : linkedProducts.length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground text-sm">
                          Нет привязанных товаров.
                          <br />
                          Выберите товар во вкладке "Несопоставленные"
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {linkedProducts.map((product) => (
                            <div
                              key={product.id}
                              className="flex items-center gap-2 p-2 rounded bg-muted/50"
                            >
                              <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {product.name}
                                </p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  {product.sku && <span>{product.sku}</span>}
                                  <span className="flex items-center gap-1">
                                    <Store className="h-3 w-3" />
                                    {product.store_name}
                                  </span>
                                  {product.buy_price && (
                                    <span>{product.buy_price} ₽</span>
                                  )}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={() => handleUnlinkProduct(product.id)}
                              >
                                <Unlink className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </ScrollArea>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Выберите мастер-товар</p>
                  <p className="text-sm">или создайте новый</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
