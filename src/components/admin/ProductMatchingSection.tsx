import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  ChevronLeft,
  Store,
  X,
  Sparkles,
  Loader2,
  Check,
  CheckCheck,
  Info,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Wand2,
  Filter,
  Image as ImageIcon,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
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

interface CatalogProduct {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  buy_price: number | null;
  compare_price: number | null;
  quantity: number;
  is_active: boolean;
  canonical_product_id: string | null;
  store_id: string;
  store_name: string;
  store_subdomain: string;
  owner_email: string;
  owner_name: string;
  unit: string | null;
  unit_weight: number | null;
  packaging_type: string | null;
  portion_weight: number | null;
  images_count: number;
  description: string | null;
  source: string | null;
  moysklad_id: string | null;
  category_name: string | null;
  markup_type: string | null;
  markup_value: number | null;
  is_fixed_price: boolean | null;
  created_at: string;
  updated_at: string;
  is_new_today: boolean;
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

  const [activeTab, setActiveTab] = useState<"catalog" | "unlinked" | "ai">("catalog");
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

  // Catalog products state
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [catalogPage, setCatalogPage] = useState(1);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogLinkedFilter, setCatalogLinkedFilter] = useState<"all" | "linked" | "unlinked">("all");
  const [catalogSort, setCatalogSort] = useState<{ field: string; order: "asc" | "desc" }>({ field: "name", order: "asc" });
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [selectedCatalogProducts, setSelectedCatalogProducts] = useState<Set<string>>(new Set());
  const [isAIGrouping, setIsAIGrouping] = useState(false);
  const [catalogAIGroups, setCatalogAIGroups] = useState<AIMatchGroup[]>([]);
  const [showCatalogAIResults, setShowCatalogAIResults] = useState(false);
  const [isAddingToFeatured, setIsAddingToFeatured] = useState(false);
  const [availableStores, setAvailableStores] = useState<{ id: string; name: string }[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  // Filters
  const [filterStoreId, setFilterStoreId] = useState("");
  const [filterIsActive, setFilterIsActive] = useState("");
  const [filterHasImages, setFilterHasImages] = useState("");
  const [filterUnit, setFilterUnit] = useState("");
  const [filterPackaging, setFilterPackaging] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [filterHasPrice, setFilterHasPrice] = useState("");
  const [filterHasBuyPrice, setFilterHasBuyPrice] = useState("");
  const CATALOG_PAGE_SIZE = 100;

  // New alias form
  const [newAliasType, setNewAliasType] = useState<ProductAlias["alias_type"]>("name");
  const [newAliasValue, setNewAliasValue] = useState("");

  // New canonical product form
  const [showNewForm, setShowNewForm] = useState(false);
  const [newCanonicalName, setNewCanonicalName] = useState("");
  const [newCanonicalSku, setNewCanonicalSku] = useState("");

  // Fetch catalog products
  const fetchCatalogProducts = useCallback(async () => {
    if (!session?.access_token) return;
    setIsLoadingCatalog(true);
    try {
      const params = new URLSearchParams({
        action: "products",
        page: catalogPage.toString(),
        limit: CATALOG_PAGE_SIZE.toString(),
        sort: catalogSort.field,
        order: catalogSort.order,
      });
      if (catalogSearch) params.set("search", catalogSearch);
      if (catalogLinkedFilter === "linked") params.set("linked", "true");
      if (catalogLinkedFilter === "unlinked") params.set("linked", "false");
      if (filterStoreId) params.set("store_id", filterStoreId);
      if (filterIsActive) params.set("is_active", filterIsActive);
      if (filterHasImages) params.set("has_images", filterHasImages);
      if (filterUnit) params.set("unit", filterUnit);
      if (filterPackaging) params.set("packaging_type", filterPackaging);
      if (filterSource) params.set("source", filterSource);
      if (filterHasPrice) params.set("has_price", filterHasPrice);
      if (filterHasBuyPrice) params.set("has_buy_price", filterHasBuyPrice);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/super-admin-stats?${params}`,
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );
      if (!response.ok) throw new Error("Failed to fetch");
      const result = await response.json();
      setCatalogProducts(result.data || []);
      setCatalogTotal(result.total || 0);
      if (result.stores) setAvailableStores(result.stores);
    } catch (e) {
      console.error("Error fetching catalog products:", e);
    } finally {
      setIsLoadingCatalog(false);
    }
  }, [session?.access_token, catalogPage, catalogSearch, catalogLinkedFilter, catalogSort, filterStoreId, filterIsActive, filterHasImages, filterUnit, filterPackaging, filterSource, filterHasPrice, filterHasBuyPrice]);

  useEffect(() => {
    if (activeTab === "catalog") {
      fetchCatalogProducts();
    }
  }, [activeTab, fetchCatalogProducts]);

  // Debounced search
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const handleCatalogSearch = (value: string) => {
    setCatalogSearch(value);
    setCatalogPage(1);
    if (searchTimeout) clearTimeout(searchTimeout);
  };

  const handleSort = (field: string) => {
    setCatalogSort(prev => ({
      field,
      order: prev.field === field && prev.order === "asc" ? "desc" : "asc",
    }));
    setCatalogPage(1);
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (catalogSort.field !== field) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
    return catalogSort.order === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const toggleCatalogProductSelection = (id: string) => {
    setSelectedCatalogProducts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllCatalogProducts = () => {
    if (selectedCatalogProducts.size === catalogProducts.length) {
      setSelectedCatalogProducts(new Set());
    } else {
      setSelectedCatalogProducts(new Set(catalogProducts.map(p => p.id)));
    }
  };

  // AI grouping for catalog products
  const runCatalogAIGrouping = async () => {
    if (!session?.access_token) return;
    setIsAIGrouping(true);
    setCatalogAIGroups([]);
    setShowCatalogAIResults(false);

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

      if (response.status === 429) { toast.error("Превышен лимит запросов"); return; }
      if (response.status === 402) { toast.error("Необходимо пополнить баланс AI"); return; }
      if (!response.ok) { const err = await response.json(); throw new Error(err.error || "Ошибка AI"); }

      const data = await response.json();
      setCatalogAIGroups(data.groups || []);
      setShowCatalogAIResults(true);

      if (!data.groups?.length) toast.info("AI не нашёл похожих товаров");
    } catch (error: any) {
      toast.error(error.message || "Ошибка AI");
    } finally {
      setIsAIGrouping(false);
    }
  };

  const approveCatalogGroup = async (index: number) => {
    const group = catalogAIGroups[index];
    if (!group || group.approved) return;

    try {
      const canonical = await createCanonical({ canonical_name: group.canonical_name });
      for (const product of group.products) {
        await linkProduct({ productId: product.id, canonicalProductId: canonical.id });
      }
      setCatalogAIGroups(prev => prev.map((g, i) => i === index ? { ...g, approved: true } : g));
      toast.success(`"${group.canonical_name}" сопоставлено`);
      fetchCatalogProducts();
    } catch {
      toast.error("Ошибка при сопоставлении");
    }
  };

  const approveAllCatalogGroups = async () => {
    for (let i = 0; i < catalogAIGroups.length; i++) {
      if (!catalogAIGroups[i].approved) await approveCatalogGroup(i);
    }
  };

  const addSelectedToFeatured = async () => {
    if (selectedCatalogProducts.size === 0) return;
    setIsAddingToFeatured(true);
    try {
      // Get current max sort_order
      const { data: existing } = await supabase
        .from("featured_products")
        .select("sort_order")
        .order("sort_order", { ascending: false })
        .limit(1);
      let nextOrder = (existing?.[0]?.sort_order ?? -1) + 1;

      const ids = Array.from(selectedCatalogProducts);
      // Insert in batches, skip duplicates
      for (let i = 0; i < ids.length; i += 50) {
        const batch = ids.slice(i, i + 50).map((id, j) => ({
          product_id: id,
          sort_order: nextOrder + i + j,
        }));
        await supabase.from("featured_products").upsert(batch, { onConflict: "product_id", ignoreDuplicates: true });
      }
      toast.success(`${ids.length} товаров добавлено на витрину`);
      setSelectedCatalogProducts(new Set());
    } catch (e: any) {
      toast.error(e.message || "Ошибка добавления на витрину");
    } finally {
      setIsAddingToFeatured(false);
    }
  };

  const totalPages = Math.ceil(catalogTotal / CATALOG_PAGE_SIZE);

  // === Original logic (kept) ===

  const filteredCanonical = canonicalProducts.filter(
    (p) =>
      p.canonical_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.canonical_sku?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  );

  useEffect(() => {
    if (selectedCanonical) {
      setIsLoadingDetails(true);
      Promise.all([fetchAliases(selectedCanonical.id), fetchLinkedProducts(selectedCanonical.id)])
        .then(([a, p]) => { setAliases(a); setLinkedProducts(p); })
        .finally(() => setIsLoadingDetails(false));
    } else { setAliases([]); setLinkedProducts([]); }
  }, [selectedCanonical, fetchAliases, fetchLinkedProducts]);

  useEffect(() => {
    if (activeTab === "unlinked") {
      setIsLoadingUnlinked(true);
      fetchUnlinkedProducts().then(setUnlinkedProducts).finally(() => setIsLoadingUnlinked(false));
    }
  }, [activeTab, fetchUnlinkedProducts]);

  const handleCreateCanonical = async () => {
    if (!newCanonicalName.trim()) return;
    await createCanonical({ canonical_name: newCanonicalName.trim(), canonical_sku: newCanonicalSku.trim() || null });
    setNewCanonicalName(""); setNewCanonicalSku(""); setShowNewForm(false);
  };

  const handleAddAlias = async () => {
    if (!selectedCanonical || !newAliasValue.trim()) return;
    await addAlias({ canonical_product_id: selectedCanonical.id, alias_type: newAliasType, alias_value: newAliasValue.trim() });
    const updatedAliases = await fetchAliases(selectedCanonical.id);
    setAliases(updatedAliases); setNewAliasValue("");
  };

  const handleDeleteAlias = async (aliasId: string) => {
    await deleteAlias(aliasId);
    setAliases(prev => prev.filter(a => a.id !== aliasId));
  };

  const handleLinkProduct = async (product: LinkedProduct) => {
    if (!selectedCanonical) return;
    await linkProduct({ productId: product.id, canonicalProductId: selectedCanonical.id });
    const [updatedLinked, updatedAliases] = await Promise.all([fetchLinkedProducts(selectedCanonical.id), fetchAliases(selectedCanonical.id)]);
    setLinkedProducts(updatedLinked); setAliases(updatedAliases);
    setUnlinkedProducts(prev => prev.filter(p => p.id !== product.id));
  };

  const handleUnlinkProduct = async (productId: string) => {
    await unlinkProduct(productId);
    setLinkedProducts(prev => prev.filter(p => p.id !== productId));
  };

  const handleCreateFromProduct = async (product: LinkedProduct) => {
    const canonical = await createFromProduct(product.id);
    setSelectedCanonical(canonical); setActiveTab("catalog");
    setUnlinkedProducts(prev => prev.filter(p => p.id !== product.id));
  };

  const handleDeleteCanonical = async () => {
    if (!selectedCanonical) return;
    await deleteCanonical(selectedCanonical.id);
    setSelectedCanonical(null);
  };

  // AI matching (original tab)
  const runAIMatching = useCallback(async () => {
    if (!session?.access_token) return;
    setIsLoadingAI(true); setAiGroups([]); setSelectedGroups(new Set()); setExpandedGroups(new Set());
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-product-matching`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      });
      if (response.status === 429) { toast.error("Превышен лимит запросов"); return; }
      if (response.status === 402) { toast.error("Необходимо пополнить баланс AI"); return; }
      if (!response.ok) { const err = await response.json(); throw new Error(err.error || "Ошибка AI"); }
      const data = await response.json();
      setAiGroups(data.groups || []);
      setExpandedGroups(new Set((data.groups || []).map((_: any, i: number) => i)));
      if (!data.groups?.length) toast.info("AI не нашёл похожих товаров для сопоставления");
    } catch (error: any) { toast.error(error.message || "Ошибка AI-сопоставления"); } finally { setIsLoadingAI(false); }
  }, [session?.access_token]);

  const toggleGroupSelection = (index: number) => { setSelectedGroups(prev => { const n = new Set(prev); if (n.has(index)) n.delete(index); else n.add(index); return n; }); };
  const toggleGroupExpanded = (index: number) => { setExpandedGroups(prev => { const n = new Set(prev); if (n.has(index)) n.delete(index); else n.add(index); return n; }); };
  const selectAllGroups = () => { if (selectedGroups.size === aiGroups.filter(g => !g.approved).length) { setSelectedGroups(new Set()); } else { const all = new Set<number>(); aiGroups.forEach((g, i) => { if (!g.approved) all.add(i); }); setSelectedGroups(all); } };

  const approveGroup = async (index: number) => {
    const group = aiGroups[index]; if (!group || group.approved) return;
    setApprovingGroups(prev => new Set(prev).add(index));
    try {
      const canonical = await createCanonical({ canonical_name: group.canonical_name });
      for (const product of group.products) { await linkProduct({ productId: product.id, canonicalProductId: canonical.id }); }
      setAiGroups(prev => prev.map((g, i) => i === index ? { ...g, approved: true } : g));
      setSelectedGroups(prev => { const n = new Set(prev); n.delete(index); return n; });
      toast.success(`Группа "${group.canonical_name}" сопоставлена`);
    } catch { toast.error("Ошибка при сопоставлении группы"); } finally { setApprovingGroups(prev => { const n = new Set(prev); n.delete(index); return n; }); }
  };

  const approveSelected = async () => { for (const idx of Array.from(selectedGroups).sort()) { await approveGroup(idx); } };

  const aliasTypeLabels: Record<ProductAlias["alias_type"], string> = { name: "Название", sku: "Артикул", barcode: "Штрих-код", moysklad_id: "МойСклад ID" };
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
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex flex-col flex-1 min-h-0">
            <TabsList className="mx-4 mt-4 mb-2 shrink-0">
              <TabsTrigger value="catalog" className="flex-1">
                <Package className="h-3.5 w-3.5 mr-1" />
                Мастер-каталог
              </TabsTrigger>
              <TabsTrigger value="ai" className="flex-1">
                <Sparkles className="h-3.5 w-3.5 mr-1" />
                AI-сопоставление
              </TabsTrigger>
              <TabsTrigger value="unlinked" className="flex-1">
                Несопоставленные
              </TabsTrigger>
            </TabsList>

            <TabsContent value="catalog" className="flex-1 overflow-hidden m-0 flex flex-col min-h-0">
              {/* Toolbar */}
              <div className="px-3 py-2 flex flex-wrap gap-2 items-center border-b shrink-0">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Поиск по названию, артикулу, описанию..."
                    value={catalogSearch}
                    onChange={(e) => handleCatalogSearch(e.target.value)}
                    className="pl-8 h-8 text-xs"
                  />
                </div>
                <select
                  value={catalogLinkedFilter}
                  onChange={(e) => { setCatalogLinkedFilter(e.target.value as any); setCatalogPage(1); }}
                  className="h-8 rounded-md border bg-background px-2 text-xs"
                >
                  <option value="all">Все товары</option>
                  <option value="linked">Связанные</option>
                  <option value="unlinked">Свободные</option>
                </select>
                <select
                  value={filterStoreId}
                  onChange={(e) => { setFilterStoreId(e.target.value); setCatalogPage(1); }}
                  className="h-8 rounded-md border bg-background px-2 text-xs max-w-[160px]"
                >
                  <option value="">Все магазины</option>
                  {availableStores.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <Button
                  size="sm"
                  variant={showFilters ? "default" : "outline"}
                  className="h-8 text-xs"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter className="h-3.5 w-3.5 mr-1" />
                  Фильтры
                  {(filterIsActive || filterHasImages || filterUnit || filterPackaging || filterSource || filterHasPrice || filterHasBuyPrice) && (
                    <Badge variant="secondary" className="ml-1 h-4 w-4 p-0 text-[9px] rounded-full justify-center">
                      {[filterIsActive, filterHasImages, filterUnit, filterPackaging, filterSource, filterHasPrice, filterHasBuyPrice].filter(Boolean).length}
                    </Badge>
                  )}
                </Button>
                <div className="h-5 w-px bg-border" />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={runCatalogAIGrouping}
                  disabled={isAIGrouping}
                >
                  {isAIGrouping ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Wand2 className="h-3.5 w-3.5 mr-1" />}
                  AI-группировка
                </Button>
                <div className="ml-auto flex items-center gap-2">
                  {selectedCatalogProducts.size > 0 && (
                    <Button
                      size="sm"
                      variant="default"
                      className="h-8 text-xs"
                      onClick={addSelectedToFeatured}
                      disabled={isAddingToFeatured}
                    >
                      {isAddingToFeatured ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
                      На витрину ({selectedCatalogProducts.size})
                    </Button>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {catalogTotal} товаров
                  </span>
                </div>
              </div>

              {/* Extended Filters Row */}
              {showFilters && (
                <div className="px-3 py-2 flex flex-wrap gap-2 items-center border-b bg-muted/30 shrink-0">
                  <select value={filterIsActive} onChange={(e) => { setFilterIsActive(e.target.value); setCatalogPage(1); }} className="h-7 rounded-md border bg-background px-2 text-xs">
                    <option value="">Активность</option>
                    <option value="true">Активные</option>
                    <option value="false">Неактивные</option>
                  </select>
                  <select value={filterHasImages} onChange={(e) => { setFilterHasImages(e.target.value); setCatalogPage(1); }} className="h-7 rounded-md border bg-background px-2 text-xs">
                    <option value="">Фото</option>
                    <option value="true">С фото</option>
                    <option value="false">Без фото</option>
                  </select>
                  <select value={filterUnit} onChange={(e) => { setFilterUnit(e.target.value); setCatalogPage(1); }} className="h-7 rounded-md border bg-background px-2 text-xs">
                    <option value="">Ед. изм.</option>
                    <option value="кг">кг</option>
                    <option value="шт">шт</option>
                    <option value="л">л</option>
                    <option value="г">г</option>
                    <option value="мл">мл</option>
                    <option value="уп">уп</option>
                  </select>
                  <select value={filterPackaging} onChange={(e) => { setFilterPackaging(e.target.value); setCatalogPage(1); }} className="h-7 rounded-md border bg-background px-2 text-xs">
                    <option value="">Фасовка</option>
                    <option value="весовой">Весовой</option>
                    <option value="штучный">Штучный</option>
                    <option value="порционный">Порционный</option>
                  </select>
                  <select value={filterSource} onChange={(e) => { setFilterSource(e.target.value); setCatalogPage(1); }} className="h-7 rounded-md border bg-background px-2 text-xs">
                    <option value="">Источник</option>
                    <option value="manual">Вручную</option>
                    <option value="moysklad">МойСклад</option>
                    <option value="excel">Excel</option>
                    <option value="megacatalog">Мегакаталог</option>
                  </select>
                  <select value={filterHasPrice} onChange={(e) => { setFilterHasPrice(e.target.value); setCatalogPage(1); }} className="h-7 rounded-md border bg-background px-2 text-xs">
                    <option value="">Цена</option>
                    <option value="true">С ценой</option>
                    <option value="false">Без цены</option>
                  </select>
                  <select value={filterHasBuyPrice} onChange={(e) => { setFilterHasBuyPrice(e.target.value); setCatalogPage(1); }} className="h-7 rounded-md border bg-background px-2 text-xs">
                    <option value="">Себестоимость</option>
                    <option value="true">Есть</option>
                    <option value="false">Нет</option>
                  </select>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={() => {
                      setFilterIsActive(""); setFilterHasImages(""); setFilterUnit(""); setFilterPackaging(""); setFilterSource(""); setFilterHasPrice(""); setFilterHasBuyPrice(""); setFilterStoreId("");
                      setCatalogPage(1);
                    }}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Сбросить
                  </Button>
                </div>
              )}

              {/* AI Grouping Results */}
              {showCatalogAIResults && catalogAIGroups.length > 0 && (
                <div className="border-b bg-amber-50/50 dark:bg-amber-950/20">
                  <div className="px-3 py-2 flex items-center gap-2">
                    <Wand2 className="h-4 w-4 text-amber-600" />
                    <span className="text-xs font-medium">AI нашёл {catalogAIGroups.length} групп похожих товаров</span>
                    <Button size="sm" variant="outline" className="h-6 text-xs ml-auto" onClick={approveAllCatalogGroups}>
                      <CheckCheck className="h-3 w-3 mr-1" />
                      Одобрить все
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setShowCatalogAIResults(false)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto px-3 pb-2 space-y-1.5">
                    {catalogAIGroups.map((group, idx) => (
                      <div key={idx} className={cn("border rounded p-2 text-xs", group.approved ? "bg-green-50 dark:bg-green-950/20 border-green-200" : "bg-background")}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium flex-1">{group.canonical_name}</span>
                          <span className="text-muted-foreground">{group.products.length} тов.</span>
                          {group.approved ? (
                            <Badge variant="secondary" className="text-green-600 text-[10px] h-5">Готово</Badge>
                          ) : (
                            <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => approveCatalogGroup(idx)}>
                              <Check className="h-3 w-3 mr-1" />Одобрить
                            </Button>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {group.products.map(p => (
                            <span key={p.id} className="inline-flex items-center gap-1 bg-muted rounded px-1.5 py-0.5">
                              {p.name}
                              <span className="text-muted-foreground">({p.store_name})</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Dense table */}
              <div className="flex-1 overflow-auto">
                <table className="w-full text-xs border-collapse min-w-[1200px]">
                  <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                    <tr className="border-b">
                      <th className="w-8 px-1 py-1.5 text-center">
                        <Checkbox
                          checked={selectedCatalogProducts.size === catalogProducts.length && catalogProducts.length > 0}
                          onCheckedChange={selectAllCatalogProducts}
                          className="h-3.5 w-3.5"
                        />
                      </th>
                      <th className="px-2 py-1.5 text-left font-medium min-w-[180px] cursor-pointer hover:text-foreground" onClick={() => handleSort("name")}>
                        <span className="inline-flex items-center gap-1">Название <SortIcon field="name" /></span>
                      </th>
                      <th className="px-2 py-1.5 text-left font-medium w-[100px] cursor-pointer hover:text-foreground" onClick={() => handleSort("sku")}>
                        <span className="inline-flex items-center gap-1">Артикул <SortIcon field="sku" /></span>
                      </th>
                      <th className="px-2 py-1.5 text-left font-medium w-[120px]">Магазин</th>
                      <th className="px-2 py-1.5 text-left font-medium w-[120px]">Продавец</th>
                      <th className="px-2 py-1.5 text-left font-medium w-[90px]">Категория</th>
                      <th className="px-2 py-1.5 text-right font-medium w-[70px] cursor-pointer hover:text-foreground" onClick={() => handleSort("price")}>
                        <span className="inline-flex items-center gap-1 justify-end">Цена <SortIcon field="price" /></span>
                      </th>
                      <th className="px-2 py-1.5 text-right font-medium w-[70px] cursor-pointer hover:text-foreground" onClick={() => handleSort("buy_price")}>
                        <span className="inline-flex items-center gap-1 justify-end">Себест. <SortIcon field="buy_price" /></span>
                      </th>
                      <th className="px-2 py-1.5 text-center font-medium w-[40px] cursor-pointer hover:text-foreground" onClick={() => handleSort("quantity")}>
                        <span className="inline-flex items-center gap-1">Кол <SortIcon field="quantity" /></span>
                      </th>
                      <th className="px-2 py-1.5 text-center font-medium w-[40px]">Ед.</th>
                      <th className="px-2 py-1.5 text-center font-medium w-[35px]">
                        <ImageIcon className="h-3 w-3 mx-auto" />
                      </th>
                      <th className="px-2 py-1.5 text-center font-medium w-[55px]">Фасовка</th>
                      <th className="px-2 py-1.5 text-center font-medium w-[60px]">Источник</th>
                      <th className="px-2 py-1.5 text-center font-medium w-[50px]">Акт.</th>
                      <th className="px-2 py-1.5 text-center font-medium w-[75px]">Связь</th>
                      <th className="px-2 py-1.5 text-left font-medium w-[75px] cursor-pointer hover:text-foreground" onClick={() => handleSort("created_at")}>
                        <span className="inline-flex items-center gap-1">Дата <SortIcon field="created_at" /></span>
                      </th>
                    </tr>
                    {/* Inline column filters row */}
                    <tr className="border-b bg-muted/50">
                      <th className="w-8 px-1 py-1" />
                      <th className="px-1 py-1">
                        <Input placeholder="Название..." value={catalogSearch} onChange={(e) => handleCatalogSearch(e.target.value)} className="h-6 text-[10px] px-1.5" />
                      </th>
                      <th className="px-1 py-1" />
                      <th className="px-1 py-1">
                        <select value={filterStoreId} onChange={(e) => { setFilterStoreId(e.target.value); setCatalogPage(1); }} className="h-6 w-full rounded border bg-background px-1 text-[10px]">
                          <option value="">Все</option>
                          {availableStores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </th>
                      <th className="px-1 py-1" />
                      <th className="px-1 py-1" />
                      <th className="px-1 py-1">
                        <select value={filterHasPrice} onChange={(e) => { setFilterHasPrice(e.target.value); setCatalogPage(1); }} className="h-6 w-full rounded border bg-background px-1 text-[10px]">
                          <option value="">Все</option>
                          <option value="true">Есть</option>
                          <option value="false">Нет</option>
                        </select>
                      </th>
                      <th className="px-1 py-1">
                        <select value={filterHasBuyPrice} onChange={(e) => { setFilterHasBuyPrice(e.target.value); setCatalogPage(1); }} className="h-6 w-full rounded border bg-background px-1 text-[10px]">
                          <option value="">Все</option>
                          <option value="true">Есть</option>
                          <option value="false">Нет</option>
                        </select>
                      </th>
                      <th className="px-1 py-1" />
                      <th className="px-1 py-1">
                        <select value={filterUnit} onChange={(e) => { setFilterUnit(e.target.value); setCatalogPage(1); }} className="h-6 w-full rounded border bg-background px-1 text-[10px]">
                          <option value="">Все</option>
                          <option value="кг">кг</option>
                          <option value="шт">шт</option>
                          <option value="л">л</option>
                          <option value="г">г</option>
                          <option value="уп">уп</option>
                        </select>
                      </th>
                      <th className="px-1 py-1">
                        <select value={filterHasImages} onChange={(e) => { setFilterHasImages(e.target.value); setCatalogPage(1); }} className="h-6 w-full rounded border bg-background px-1 text-[10px]">
                          <option value="">Все</option>
                          <option value="true">Да</option>
                          <option value="false">Нет</option>
                        </select>
                      </th>
                      <th className="px-1 py-1">
                        <select value={filterPackaging} onChange={(e) => { setFilterPackaging(e.target.value); setCatalogPage(1); }} className="h-6 w-full rounded border bg-background px-1 text-[10px]">
                          <option value="">Все</option>
                          <option value="весовой">Вес</option>
                          <option value="штучный">Шт</option>
                          <option value="порционный">Порц</option>
                        </select>
                      </th>
                      <th className="px-1 py-1">
                        <select value={filterSource} onChange={(e) => { setFilterSource(e.target.value); setCatalogPage(1); }} className="h-6 w-full rounded border bg-background px-1 text-[10px]">
                          <option value="">Все</option>
                          <option value="manual">Руч</option>
                          <option value="moysklad">МС</option>
                          <option value="excel">XLS</option>
                          <option value="megacatalog">Мега</option>
                        </select>
                      </th>
                      <th className="px-1 py-1">
                        <select value={filterIsActive} onChange={(e) => { setFilterIsActive(e.target.value); setCatalogPage(1); }} className="h-6 w-full rounded border bg-background px-1 text-[10px]">
                          <option value="">Все</option>
                          <option value="true">Да</option>
                          <option value="false">Нет</option>
                        </select>
                      </th>
                      <th className="px-1 py-1">
                        <select value={catalogLinkedFilter} onChange={(e) => { setCatalogLinkedFilter(e.target.value as any); setCatalogPage(1); }} className="h-6 w-full rounded border bg-background px-1 text-[10px]">
                          <option value="all">Все</option>
                          <option value="linked">Да</option>
                          <option value="unlinked">Нет</option>
                        </select>
                      </th>
                      <th className="px-1 py-1" />
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingCatalog ? (
                      <tr><td colSpan={16} className="text-center py-8 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></td></tr>
                    ) : catalogProducts.length === 0 ? (
                      <tr><td colSpan={16} className="text-center py-8 text-muted-foreground">Нет товаров</td></tr>
                    ) : (
                      catalogProducts.map((product) => (
                        <tr
                          key={product.id}
                          className={cn(
                            "border-b border-border/50 hover:bg-muted/30 transition-colors",
                            selectedCatalogProducts.has(product.id) && "bg-primary/5",
                            product.canonical_product_id && "bg-green-50/50 dark:bg-green-950/10"
                          )}
                        >
                          <td className="px-1 py-0.5 text-center">
                            <Checkbox
                              checked={selectedCatalogProducts.has(product.id)}
                              onCheckedChange={() => toggleCatalogProductSelection(product.id)}
                              className="h-3.5 w-3.5"
                            />
                          </td>
                          <td className="px-2 py-0.5 max-w-0">
                            <div className="flex items-center gap-1 min-w-0">
                              {product.canonical_product_id && <Link2 className="h-3 w-3 text-green-500 shrink-0" />}
                              <span className="truncate" title={product.name}>{product.name}</span>
                              {product.is_new_today && <Badge variant="secondary" className="text-[9px] h-4 px-1 shrink-0">NEW</Badge>}
                            </div>
                          </td>
                          <td className="px-2 py-0.5 text-muted-foreground truncate">{product.sku || "—"}</td>
                          <td className="px-2 py-0.5">
                            <span className="truncate block text-muted-foreground" title={product.store_name}>{product.store_name}</span>
                          </td>
                          <td className="px-2 py-0.5">
                            <span className="truncate block text-muted-foreground" title={product.owner_name || product.owner_email}>
                              {product.owner_name || product.owner_email || "—"}
                            </span>
                          </td>
                          <td className="px-2 py-0.5">
                            <span className="truncate block text-muted-foreground" title={product.category_name || ""}>{product.category_name || "—"}</span>
                          </td>
                          <td className="px-2 py-0.5 text-right tabular-nums">{product.price > 0 ? `${product.price}₽` : "—"}</td>
                          <td className="px-2 py-0.5 text-right tabular-nums text-muted-foreground">{product.buy_price ? `${product.buy_price}₽` : "—"}</td>
                          <td className="px-2 py-0.5 text-center tabular-nums">{product.quantity}</td>
                          <td className="px-2 py-0.5 text-center text-muted-foreground">{product.unit || "—"}</td>
                          <td className="px-2 py-0.5 text-center tabular-nums">
                            {product.images_count > 0 ? (
                              <span className="text-green-600">{product.images_count}</span>
                            ) : (
                              <span className="text-muted-foreground/50">0</span>
                            )}
                          </td>
                          <td className="px-2 py-0.5 text-center text-muted-foreground text-[10px]">{product.packaging_type || "—"}</td>
                          <td className="px-2 py-0.5 text-center">
                            {product.source ? (
                              <Badge variant="outline" className="text-[9px] h-4 px-1">
                                {product.source === "moysklad" ? "МС" : product.source === "excel" ? "XLS" : product.source === "megacatalog" ? "Мега" : product.source}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground/50">—</span>
                            )}
                          </td>
                          <td className="px-2 py-0.5 text-center">
                            {product.is_active ? (
                              <span className="inline-block w-2 h-2 rounded-full bg-green-500" title="Активен" />
                            ) : (
                              <span className="inline-block w-2 h-2 rounded-full bg-muted-foreground/30" title="Неактивен" />
                            )}
                          </td>
                          <td className="px-2 py-0.5 text-center">
                            {product.canonical_product_id ? (
                              <Badge variant="secondary" className="text-[9px] h-4 px-1 text-green-600 bg-green-100 border-green-200">Связан</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[9px] h-4 px-1 text-muted-foreground">Свободен</Badge>
                            )}
                          </td>
                          <td className="px-2 py-0.5 text-muted-foreground text-[10px] whitespace-nowrap">
                            {new Date(product.created_at).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-3 py-2 border-t flex items-center justify-between shrink-0">
                  <span className="text-xs text-muted-foreground">
                    Стр. {catalogPage} из {totalPages} ({catalogTotal} тов.)
                  </span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setCatalogPage(p => Math.max(1, p - 1))} disabled={catalogPage <= 1}>
                      <ChevronLeft className="h-3 w-3" />
                    </Button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let page: number;
                      if (totalPages <= 5) { page = i + 1; }
                      else if (catalogPage <= 3) { page = i + 1; }
                      else if (catalogPage >= totalPages - 2) { page = totalPages - 4 + i; }
                      else { page = catalogPage - 2 + i; }
                      return (
                        <Button
                          key={page}
                          size="sm"
                          variant={page === catalogPage ? "default" : "outline"}
                          className="h-7 w-7 text-xs p-0"
                          onClick={() => setCatalogPage(page)}
                        >
                          {page}
                        </Button>
                      );
                    })}
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setCatalogPage(p => Math.min(totalPages, p + 1))} disabled={catalogPage >= totalPages}>
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ============ AI TAB ============ */}
            <TabsContent value="ai" className="flex-1 overflow-hidden m-0 flex flex-col min-h-0">
              <div className="px-4 py-3 flex flex-wrap gap-2 items-center border-b shrink-0">
                <Button onClick={runAIMatching} disabled={isLoadingAI}>
                  {isLoadingAI ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  {isLoadingAI ? "Анализ..." : "Найти похожие товары"}
                </Button>
                {aiGroups.length > 0 && (
                  <>
                    <div className="h-6 w-px bg-border" />
                    <Button variant="outline" size="sm" onClick={selectAllGroups}>
                      <CheckCheck className="h-4 w-4 mr-1" />
                      {selectedGroups.size === pendingCount ? "Снять всё" : "Выбрать всё"}
                    </Button>
                    <Button size="sm" onClick={approveSelected} disabled={selectedGroups.size === 0 || approvingGroups.size > 0}>
                      <Check className="h-4 w-4 mr-1" />Одобрить ({selectedGroups.size})
                    </Button>
                    <div className="h-6 w-px bg-border" />
                    <div className="flex gap-2 text-xs text-muted-foreground items-center">
                      <Badge variant="secondary">{aiGroups.length} групп</Badge>
                      <Badge variant="outline" className="text-green-600 border-green-300">{approvedCount} одобрено</Badge>
                      <Badge variant="outline">{pendingCount} ожидает</Badge>
                      {uniqueStores.size > 0 && (
                        <span className="flex items-center gap-1"><Store className="h-3 w-3" />{uniqueStores.size} магазинов</span>
                      )}
                    </div>
                  </>
                )}
              </div>

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
                    <p className="text-sm mt-1">AI проанализирует несопоставленные товары и предложит группы</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {aiGroups.map((group, groupIdx) => {
                      const isExpanded = expandedGroups.has(groupIdx);
                      return (
                        <div key={groupIdx} className={cn("border rounded-lg transition-all", group.approved ? "bg-green-500/5 border-green-500/20" : selectedGroups.has(groupIdx) ? "border-primary bg-primary/5" : "hover:border-muted-foreground/30")}>
                          <div className="p-3 flex items-center gap-3 cursor-pointer" onClick={() => toggleGroupExpanded(groupIdx)}>
                            {!group.approved && (
                              <div onClick={e => e.stopPropagation()}>
                                <Checkbox checked={selectedGroups.has(groupIdx)} onCheckedChange={() => toggleGroupSelection(groupIdx)} />
                              </div>
                            )}
                            {group.approved && <Check className="h-4 w-4 text-green-500 flex-shrink-0" />}
                            <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform shrink-0", isExpanded && "rotate-90")} />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">{group.canonical_name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-muted-foreground">{group.products.length} товаров</span>
                                <span className="text-xs text-muted-foreground">•</span>
                                <span className="text-xs text-muted-foreground flex items-center gap-1"><Store className="h-3 w-3" />{new Set(group.products.map(p => p.store_name)).size} магаз.</span>
                              </div>
                            </div>
                            {group.approved ? (
                              <Badge variant="secondary" className="text-green-600 bg-green-100 border-green-200 shrink-0">Сопоставлено</Badge>
                            ) : (
                              <div onClick={e => e.stopPropagation()}>
                                <Button size="sm" variant="outline" onClick={() => approveGroup(groupIdx)} disabled={approvingGroups.has(groupIdx)}>
                                  {approvingGroups.has(groupIdx) ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Check className="h-3 w-3 mr-1" />Одобрить</>}
                                </Button>
                              </div>
                            )}
                          </div>
                          {isExpanded && (
                            <div className="px-3 pb-3 space-y-1 border-t pt-2">
                              {group.products.map(product => (
                                <div key={product.id} className="flex items-center gap-2 p-2 rounded bg-muted/50 text-sm">
                                  <Package className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                  <span className="flex-1 min-w-0 truncate">{product.name}</span>
                                  {product.sku && <Badge variant="outline" className="text-xs shrink-0">{product.sku}</Badge>}
                                  <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0"><Store className="h-3 w-3" />{product.store_name}</span>
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

            {/* ============ UNLINKED TAB ============ */}
            {activeTab === "unlinked" && (
              <div className="px-4 pb-2 shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Поиск..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
                </div>
              </div>
            )}
            <TabsContent value="unlinked" className="flex-1 overflow-y-auto m-0">
              <div className="px-4 pb-4 space-y-1">
                {isLoadingUnlinked ? (
                  <div className="text-center py-8 text-muted-foreground">Загрузка...</div>
                ) : unlinkedProducts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">Все товары сопоставлены</div>
                ) : (
                  unlinkedProducts.filter(p => !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.sku?.toLowerCase().includes(searchQuery.toLowerCase())).map(product => (
                    <div key={product.id} className="p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                      <div className="flex items-start gap-2">
                        <Package className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{product.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {product.sku && <span>{product.sku}</span>}
                            <span className="flex items-center gap-1"><Store className="h-3 w-3" />{product.store_name}</span>
                          </div>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          {selectedCanonical && (
                            <Button size="sm" variant="outline" onClick={() => handleLinkProduct(product)} disabled={isLinking}>
                              <Link2 className="h-3 w-3 mr-1" />Привязать
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => handleCreateFromProduct(product)} disabled={isCreating}>
                            <Plus className="h-3 w-3 mr-1" />Создать
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
                    {selectedCanonical.canonical_sku && <p className="text-sm text-muted-foreground">Артикул: {selectedCanonical.canonical_sku}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setSelectedCanonical(null)}><X className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={handleDeleteCanonical}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2"><Tag className="h-4 w-4" />Синонимы ({aliases.length})</h4>
                  <div className="space-y-2 mb-3">
                    {aliases.map(alias => (
                      <div key={alias.id} className="flex items-center gap-2 p-2 rounded bg-muted/50">
                        <Badge variant="outline" className="text-xs">{aliasTypeLabels[alias.alias_type]}</Badge>
                        <span className="flex-1 text-sm truncate">{alias.alias_value}</span>
                        <Badge variant="secondary" className="text-xs">{alias.source}</Badge>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleDeleteAlias(alias.id)}><X className="h-3 w-3" /></Button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <select value={newAliasType} onChange={e => setNewAliasType(e.target.value as ProductAlias["alias_type"])} className="h-9 rounded-md border bg-background px-3 text-sm">
                      {Object.entries(aliasTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    <Input placeholder="Значение синонима" value={newAliasValue} onChange={e => setNewAliasValue(e.target.value)} className="flex-1" />
                    <Button size="sm" onClick={handleAddAlias} disabled={!newAliasValue.trim()}><Plus className="h-4 w-4" /></Button>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2"><Link2 className="h-4 w-4" />Привязанные товары ({linkedProducts.length})</h4>
                  {isLoadingDetails ? (
                    <div className="text-center py-4 text-muted-foreground">Загрузка...</div>
                  ) : linkedProducts.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground text-sm">Нет привязанных товаров.<br />Выберите товар во вкладке "Несопоставленные"</div>
                  ) : (
                    <div className="space-y-2">
                      {linkedProducts.map(product => (
                        <div key={product.id} className="flex items-center gap-2 p-2 rounded bg-muted/50">
                          <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{product.name}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {product.sku && <span>{product.sku}</span>}
                              <span className="flex items-center gap-1"><Store className="h-3 w-3" />{product.store_name}</span>
                              {product.buy_price && <span>{product.buy_price} ₽</span>}
                            </div>
                          </div>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleUnlinkProduct(product.id)}><Unlink className="h-3 w-3" /></Button>
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
