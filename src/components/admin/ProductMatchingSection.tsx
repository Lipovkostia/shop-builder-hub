import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
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
  Sparkles,
  Loader2,
  Check,
  CheckCheck,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useCanonicalProducts,
  type CanonicalProduct,
  type ProductAlias,
  type LinkedProduct,
} from "@/hooks/useCanonicalProducts";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface AIMatchGroup {
  canonical_name: string;
  products: {
    id: string;
    name: string;
    sku: string | null;
    store_id: string;
    store_name: string;
  }[];
  approved?: boolean;
}

export default function ProductMatchingSection() {
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

  const { session } = useAuth();

  const [activeTab, setActiveTab] = useState<"catalog" | "unlinked" | "ai">("ai");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCanonical, setSelectedCanonical] = useState<CanonicalProduct | null>(null);
  const [aliases, setAliases] = useState<ProductAlias[]>([]);
  const [linkedProducts, setLinkedProducts] = useState<LinkedProduct[]>([]);
  const [unlinkedProducts, setUnlinkedProducts] = useState<LinkedProduct[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isLoadingUnlinked, setIsLoadingUnlinked] = useState(false);

  // AI matching state
  const [aiGroups, setAiGroups] = useState<AIMatchGroup[]>([]);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<Set<number>>(new Set());
  const [approvingGroups, setApprovingGroups] = useState<Set<number>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());

  // New alias form
  const [newAliasType, setNewAliasType] = useState<ProductAlias["alias_type"]>("name");
  const [newAliasValue, setNewAliasValue] = useState("");

  // New canonical product form
  const [showNewForm, setShowNewForm] = useState(false);
  const [newCanonicalName, setNewCanonicalName] = useState("");
  const [newCanonicalSku, setNewCanonicalSku] = useState("");

  const filteredCanonical = canonicalProducts.filter(
    (p) =>
      p.canonical_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.canonical_sku?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  );

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

  // AI matching functions
  const runAIMatching = useCallback(async () => {
    if (!session?.access_token) return;
    setIsLoadingAI(true);
    setAiGroups([]);
    setSelectedGroups(new Set());
    setExpandedGroups(new Set());

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-product-matching`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (response.status === 429) {
        toast.error("Превышен лимит запросов, попробуйте позже");
        return;
      }
      if (response.status === 402) {
        toast.error("Необходимо пополнить баланс AI");
        return;
      }
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Ошибка AI");
      }

      const data = await response.json();
      const groups = data.groups || [];
      setAiGroups(groups);
      // Expand all groups by default
      setExpandedGroups(new Set(groups.map((_: any, i: number) => i)));

      if (groups.length === 0) {
        toast.info("AI не нашёл похожих товаров для сопоставления");
      }
    } catch (error: any) {
      console.error("AI matching error:", error);
      toast.error(error.message || "Ошибка AI-сопоставления");
    } finally {
      setIsLoadingAI(false);
    }
  }, [session?.access_token]);

  const toggleGroupSelection = (index: number) => {
    setSelectedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleGroupExpanded = (index: number) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const selectAllGroups = () => {
    if (selectedGroups.size === aiGroups.filter((g) => !g.approved).length) {
      setSelectedGroups(new Set());
    } else {
      const all = new Set<number>();
      aiGroups.forEach((g, i) => { if (!g.approved) all.add(i); });
      setSelectedGroups(all);
    }
  };

  const approveGroup = async (index: number) => {
    const group = aiGroups[index];
    if (!group || group.approved) return;

    setApprovingGroups((prev) => new Set(prev).add(index));

    try {
      const canonical = await createCanonical({
        canonical_name: group.canonical_name,
      });

      for (const product of group.products) {
        await linkProduct({
          productId: product.id,
          canonicalProductId: canonical.id,
        });
      }

      setAiGroups((prev) =>
        prev.map((g, i) => (i === index ? { ...g, approved: true } : g))
      );
      setSelectedGroups((prev) => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
      toast.success(`Группа "${group.canonical_name}" сопоставлена`);
    } catch (error) {
      console.error("Approve error:", error);
      toast.error("Ошибка при сопоставлении группы");
    } finally {
      setApprovingGroups((prev) => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    }
  };

  const approveSelected = async () => {
    const indices = Array.from(selectedGroups).sort();
    for (const idx of indices) {
      await approveGroup(idx);
    }
  };

  const aliasTypeLabels: Record<ProductAlias["alias_type"], string> = {
    name: "Название",
    sku: "Артикул",
    barcode: "Штрих-код",
    moysklad_id: "МойСклад ID",
  };

  const approvedCount = aiGroups.filter(g => g.approved).length;
  const pendingCount = aiGroups.length - approvedCount;
  const uniqueStores = new Set(aiGroups.flatMap(g => g.products.map(p => p.store_name)));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Сопоставление товаров</h2>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 min-h-[calc(100vh-16rem)]">
        {/* Left panel */}
        <div className="flex-1 min-w-0 border rounded-lg bg-card flex flex-col">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as any)}
            className="flex flex-col flex-1 min-h-0"
          >
            <TabsList className="mx-4 mt-4 mb-2 shrink-0">
              <TabsTrigger value="ai" className="flex-1">
                <Sparkles className="h-3.5 w-3.5 mr-1" />
                AI-сопоставление
              </TabsTrigger>
              <TabsTrigger value="catalog" className="flex-1">
                Мастер-каталог
              </TabsTrigger>
              <TabsTrigger value="unlinked" className="flex-1">
                Несопоставленные
              </TabsTrigger>
            </TabsList>

            {activeTab !== "ai" && (
              <div className="px-4 pb-2 shrink-0">
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
            )}

            {/* AI Tab */}
            <TabsContent value="ai" className="flex-1 overflow-hidden m-0 flex flex-col min-h-0">
              {/* AI toolbar */}
              <div className="px-4 py-3 flex flex-wrap gap-2 items-center border-b shrink-0">
                <Button
                  onClick={runAIMatching}
                  disabled={isLoadingAI}
                >
                  {isLoadingAI ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  {isLoadingAI ? "Анализ..." : "Найти похожие товары"}
                </Button>
                {aiGroups.length > 0 && (
                  <>
                    <div className="h-6 w-px bg-border" />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={selectAllGroups}
                    >
                      <CheckCheck className="h-4 w-4 mr-1" />
                      {selectedGroups.size === pendingCount ? "Снять всё" : "Выбрать всё"}
                    </Button>
                    <Button
                      size="sm"
                      onClick={approveSelected}
                      disabled={selectedGroups.size === 0 || approvingGroups.size > 0}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Одобрить ({selectedGroups.size})
                    </Button>
                    <div className="h-6 w-px bg-border" />
                    <div className="flex gap-2 text-xs text-muted-foreground items-center">
                      <Badge variant="secondary">{aiGroups.length} групп</Badge>
                      <Badge variant="outline" className="text-green-600 border-green-300">
                        {approvedCount} одобрено
                      </Badge>
                      <Badge variant="outline">{pendingCount} ожидает</Badge>
                      {uniqueStores.size > 0 && (
                        <span className="flex items-center gap-1">
                          <Store className="h-3 w-3" />
                          {uniqueStores.size} магазинов
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* AI content */}
              <div className="flex-1 overflow-y-auto p-4">
                {isLoadingAI ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <Loader2 className="h-10 w-10 mx-auto mb-4 animate-spin text-primary" />
                    <p className="font-medium text-lg">AI анализирует товары...</p>
                    <p className="text-sm mt-1">Это может занять до 30 секунд</p>
                  </div>
                ) : aiGroups.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p className="font-medium text-lg">Нажмите «Найти похожие товары»</p>
                    <p className="text-sm mt-1">AI проанализирует несопоставленные товары и предложит группы для сопоставления</p>
                    <div className="mt-6 max-w-md mx-auto text-left bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                      <div className="flex items-start gap-2">
                        <Info className="h-4 w-4 mt-0.5 shrink-0" />
                        <p>AI сравнивает названия и артикулы товаров от разных продавцов и находит одинаковые позиции</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCheck className="h-4 w-4 mt-0.5 shrink-0" />
                        <p>Вы можете одобрить все группы сразу или проверить каждую отдельно</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {aiGroups.map((group, groupIdx) => {
                      const isExpanded = expandedGroups.has(groupIdx);
                      return (
                        <div
                          key={groupIdx}
                          className={cn(
                            "border rounded-lg transition-all",
                            group.approved
                              ? "bg-green-500/5 border-green-500/20"
                              : selectedGroups.has(groupIdx)
                              ? "border-primary bg-primary/5"
                              : "hover:border-muted-foreground/30"
                          )}
                        >
                          <div
                            className="p-3 flex items-center gap-3 cursor-pointer"
                            onClick={() => toggleGroupExpanded(groupIdx)}
                          >
                            {!group.approved && (
                              <div onClick={(e) => e.stopPropagation()}>
                                <Checkbox
                                  checked={selectedGroups.has(groupIdx)}
                                  onCheckedChange={() => toggleGroupSelection(groupIdx)}
                                />
                              </div>
                            )}
                            {group.approved && (
                              <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                            )}
                            <ChevronRight className={cn(
                              "h-4 w-4 text-muted-foreground transition-transform shrink-0",
                              isExpanded && "rotate-90"
                            )} />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">
                                {group.canonical_name}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-muted-foreground">
                                  {group.products.length} товаров
                                </span>
                                <span className="text-xs text-muted-foreground">•</span>
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Store className="h-3 w-3" />
                                  {new Set(group.products.map(p => p.store_name)).size} магаз.
                                </span>
                              </div>
                            </div>
                            {group.approved ? (
                              <Badge variant="secondary" className="text-green-600 bg-green-100 border-green-200 shrink-0">
                                Сопоставлено
                              </Badge>
                            ) : (
                              <div onClick={(e) => e.stopPropagation()}>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => approveGroup(groupIdx)}
                                  disabled={approvingGroups.has(groupIdx)}
                                >
                                  {approvingGroups.has(groupIdx) ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <>
                                      <Check className="h-3 w-3 mr-1" />
                                      Одобрить
                                    </>
                                  )}
                                </Button>
                              </div>
                            )}
                          </div>
                          {isExpanded && (
                            <div className="px-3 pb-3 space-y-1 border-t pt-2">
                              {group.products.map((product) => (
                                <div
                                  key={product.id}
                                  className="flex items-center gap-2 p-2 rounded bg-muted/50 text-sm"
                                >
                                  <Package className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                  <span className="flex-1 min-w-0 truncate">{product.name}</span>
                                  {product.sku && (
                                    <Badge variant="outline" className="text-xs shrink-0">{product.sku}</Badge>
                                  )}
                                  <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                                    <Store className="h-3 w-3" />
                                    {product.store_name}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Catalog Tab */}
            <TabsContent value="catalog" className="flex-1 overflow-y-auto m-0">
              <div className="px-4 pb-4 space-y-1">
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
                      <Button size="sm" onClick={handleCreateCanonical} disabled={!newCanonicalName.trim() || isCreating}>
                        Создать
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowNewForm(false)}>
                        Отмена
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="outline" className="w-full justify-start" onClick={() => setShowNewForm(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Создать мастер-товар
                  </Button>
                )}

                {isLoadingCanonical ? (
                  <div className="text-center py-8 text-muted-foreground">Загрузка...</div>
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
                          <p className="font-medium truncate">{product.canonical_name}</p>
                          {product.canonical_sku && (
                            <p className="text-xs text-muted-foreground">{product.canonical_sku}</p>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      </div>
                    </button>
                  ))
                )}
              </div>
            </TabsContent>

            {/* Unlinked Tab */}
            <TabsContent value="unlinked" className="flex-1 overflow-y-auto m-0">
              <div className="px-4 pb-4 space-y-1">
                {isLoadingUnlinked ? (
                  <div className="text-center py-8 text-muted-foreground">Загрузка...</div>
                ) : unlinkedProducts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">Все товары сопоставлены</div>
                ) : (
                  unlinkedProducts
                    .filter((p) =>
                      !searchQuery ||
                      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      p.sku?.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((product) => (
                      <div key={product.id} className="p-3 rounded-lg border hover:bg-muted/50 transition-colors">
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
                              <Button size="sm" variant="outline" onClick={() => handleLinkProduct(product)} disabled={isLinking}>
                                <Link2 className="h-3 w-3 mr-1" />
                                Привязать
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => handleCreateFromProduct(product)} disabled={isCreating}>
                              <Plus className="h-3 w-3 mr-1" />
                              Создать
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right panel - Selected canonical details */}
        <div className="w-full lg:w-[400px] xl:w-[480px] shrink-0 border rounded-lg bg-card flex flex-col">
          {selectedCanonical ? (
            <>
              <div className="p-4 border-b shrink-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-lg">{selectedCanonical.canonical_name}</h3>
                    {selectedCanonical.canonical_sku && (
                      <p className="text-sm text-muted-foreground">Артикул: {selectedCanonical.canonical_sku}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setSelectedCanonical(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={handleDeleteCanonical}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* Aliases section */}
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    Синонимы ({aliases.length})
                  </h4>
                  <div className="space-y-2 mb-3">
                    {aliases.map((alias) => (
                      <div key={alias.id} className="flex items-center gap-2 p-2 rounded bg-muted/50">
                        <Badge variant="outline" className="text-xs">{aliasTypeLabels[alias.alias_type]}</Badge>
                        <span className="flex-1 text-sm truncate">{alias.alias_value}</span>
                        <Badge variant="secondary" className="text-xs">{alias.source}</Badge>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleDeleteAlias(alias.id)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={newAliasType}
                      onChange={(e) => setNewAliasType(e.target.value as ProductAlias["alias_type"])}
                      className="h-9 rounded-md border bg-background px-3 text-sm"
                    >
                      {Object.entries(aliasTypeLabels).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                    <Input
                      placeholder="Значение синонима"
                      value={newAliasValue}
                      onChange={(e) => setNewAliasValue(e.target.value)}
                      className="flex-1"
                    />
                    <Button size="sm" onClick={handleAddAlias} disabled={!newAliasValue.trim()}>
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
                    <div className="text-center py-4 text-muted-foreground">Загрузка...</div>
                  ) : linkedProducts.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      Нет привязанных товаров.<br />
                      Выберите товар во вкладке "Несопоставленные"
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {linkedProducts.map((product) => (
                        <div key={product.id} className="flex items-center gap-2 p-2 rounded bg-muted/50">
                          <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{product.name}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {product.sku && <span>{product.sku}</span>}
                              <span className="flex items-center gap-1">
                                <Store className="h-3 w-3" />
                                {product.store_name}
                              </span>
                              {product.buy_price && <span>{product.buy_price} ₽</span>}
                            </div>
                          </div>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleUnlinkProduct(product.id)}>
                            <Unlink className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
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
    </div>
  );
}
