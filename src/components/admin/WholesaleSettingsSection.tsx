import React, { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { 
  Store, 
  Palette, 
  Search, 
  Globe, 
  ExternalLink, 
  Copy, 
  Check, 
  Upload, 
  Trash2, 
  Loader2,
  Info,
  Package,
  Phone,
  Sparkles,
  Video,
  Radio,
  Database,
  ShoppingCart
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useRetailSettings, RetailTheme } from "@/hooks/useRetailSettings";
import { useStoreCatalogs } from "@/hooks/useStoreCatalogs";
import { useProductSeo } from "@/hooks/useProductSeo";
import { useMoyskladAccounts } from "@/hooks/useMoyskladAccounts";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bot, MessageCircle } from "lucide-react";
import { Label } from "@/components/ui/label";

interface MoyskladProduct {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  buy_price: number | null;
  quantity: number;
  unit: string | null;
  images: string[] | null;
  moysklad_id: string | null;
  moysklad_account_id: string | null;
}

interface WholesaleSettingsSectionProps {
  storeId: string | null;
  storeName?: string;
}

export function WholesaleSettingsSection({ storeId, storeName }: WholesaleSettingsSectionProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<{
    wholesale_enabled: boolean;
    wholesale_name: string | null;
    wholesale_catalog_id: string | null;
    wholesale_min_order_amount: number | null;
    wholesale_logo_url: string | null;
    wholesale_seo_title: string | null;
    wholesale_seo_description: string | null;
    wholesale_custom_domain: string | null;
    subdomain: string;
    wholesale_livestream_enabled: boolean;
    wholesale_livestream_url: string | null;
    wholesale_livestream_title: string | null;
  } | null>(null);

  const { catalogs, productVisibility, loading: catalogsLoading } = useStoreCatalogs(storeId);
  const { generating, progress, generateBulkSeo } = useProductSeo(storeId, storeName);
  const { accounts: msAccounts, loading: msAccountsLoading } = useMoyskladAccounts(storeId);

  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("general");
  const [selectedMsAccountFilter, setSelectedMsAccountFilter] = useState<string>("all");
  const [msProducts, setMsProducts] = useState<MoyskladProduct[]>([]);
  const [msProductsLoading, setMsProductsLoading] = useState(false);
  const [msProductSearch, setMsProductSearch] = useState("");
  
  // Form states
  const [wholesaleName, setWholesaleName] = useState("");
  const [minOrderAmount, setMinOrderAmount] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [savingDomain, setSavingDomain] = useState(false);
  
  // Livestream form states
  const [livestreamUrl, setLivestreamUrl] = useState("");
  const [livestreamTitle, setLivestreamTitle] = useState("");
  
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Fetch all store products for the "Товары" tab (with optional MS account filter)
  const fetchMsProducts = useCallback(async () => {
    if (!storeId) return;
    setMsProductsLoading(true);
    try {
      // Paginate to handle >1000 products
      const allProducts: MoyskladProduct[] = [];
      const batchSize = 1000;
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        let query = supabase
          .from("products")
          .select("id, name, sku, price, buy_price, quantity, unit, images, moysklad_id, moysklad_account_id")
          .eq("store_id", storeId)
          .is("deleted_at", null)
          .order("name")
          .range(offset, offset + batchSize - 1);

        if (selectedMsAccountFilter === "no_ms") {
          query = query.is("moysklad_account_id", null);
        } else if (selectedMsAccountFilter && selectedMsAccountFilter !== "all") {
          query = query.eq("moysklad_account_id", selectedMsAccountFilter);
        }

        const { data, error } = await query;
        if (error) throw error;
        const page = (data || []) as MoyskladProduct[];
        allProducts.push(...page);
        offset += page.length;
        hasMore = page.length >= batchSize;
      }

      setMsProducts(allProducts);
    } catch (err) {
      console.error("Error fetching products:", err);
    } finally {
      setMsProductsLoading(false);
    }
  }, [storeId, selectedMsAccountFilter]);

  useEffect(() => {
    if (activeTab === "products") {
      fetchMsProducts();
    }
  }, [activeTab, fetchMsProducts]);

  const filteredMsProducts = useMemo(() => {
    if (!msProductSearch) return msProducts;
    const q = msProductSearch.toLowerCase();
    return msProducts.filter(p => 
      p.name.toLowerCase().includes(q) || 
      (p.sku && p.sku.toLowerCase().includes(q))
    );
  }, [msProducts, msProductSearch]);

  // Fetch settings
  useEffect(() => {
    if (!storeId) return;

    const fetchSettings = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("stores")
          .select("wholesale_enabled, wholesale_name, wholesale_catalog_id, wholesale_min_order_amount, wholesale_logo_url, wholesale_seo_title, wholesale_seo_description, wholesale_custom_domain, subdomain, wholesale_livestream_enabled, wholesale_livestream_url, wholesale_livestream_title")
          .eq("id", storeId)
          .single();

        if (error) throw error;
        setSettings(data as any);
        
        // Sync form states
        setWholesaleName(data?.wholesale_name || "");
        setMinOrderAmount(data?.wholesale_min_order_amount?.toString() || "");
        setSeoTitle(data?.wholesale_seo_title || "");
        setCustomDomain(data?.wholesale_custom_domain || "");
        setSeoDescription(data?.wholesale_seo_description || "");
        setLivestreamUrl(data?.wholesale_livestream_url || "");
        setLivestreamTitle(data?.wholesale_livestream_title || "");
      } catch (err) {
        console.error("Error fetching wholesale settings:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [storeId]);

  // Calculate product count for selected catalog
  const getProductCountForCatalog = (catalogId: string): number => {
    let count = 0;
    Object.values(productVisibility).forEach((catalogSet) => {
      if (catalogSet.has(catalogId)) {
        count++;
      }
    });
    return count;
  };

  const selectedCatalogProductCount = useMemo(() => {
    if (!settings?.wholesale_catalog_id) return null;
    return getProductCountForCatalog(settings.wholesale_catalog_id);
  }, [settings?.wholesale_catalog_id, productVisibility]);

  const selectedCatalog = useMemo(() => {
    if (!settings?.wholesale_catalog_id) return null;
    return catalogs.find(c => c.id === settings.wholesale_catalog_id);
  }, [settings?.wholesale_catalog_id, catalogs]);

  // Get product IDs for bulk SEO generation
  const catalogProductIds = useMemo(() => {
    if (!settings?.wholesale_catalog_id) return [];
    const ids: string[] = [];
    Object.entries(productVisibility).forEach(([productId, catalogSet]) => {
      if (catalogSet.has(settings.wholesale_catalog_id!)) {
        ids.push(productId);
      }
    });
    return ids;
  }, [settings?.wholesale_catalog_id, productVisibility]);

  const updateSetting = async (updates: Partial<typeof settings>) => {
    if (!storeId) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from("stores")
        .update(updates as any)
        .eq("id", storeId);

      if (error) throw error;

      setSettings(prev => prev ? { ...prev, ...updates } : null);
      toast.success("Настройки сохранены");
    } catch (err) {
      console.error("Error updating wholesale settings:", err);
      toast.error("Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const handleBulkSeoGeneration = async () => {
    if (catalogProductIds.length === 0) {
      toast.error("Нет товаров для генерации SEO");
      return;
    }

    await generateBulkSeo(catalogProductIds);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Не удалось загрузить настройки
      </div>
    );
  }

  const storeUrl = `/wholesale/${settings.subdomain}`;
  const fullUrl = `${window.location.origin}${storeUrl}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenStore = () => {
    window.open(storeUrl, "_blank");
  };

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-foreground">Оптовый магазин (B2B)</h2>
        <p className="text-sm text-muted-foreground">
          Настройте витрину для оптовых покупателей с SEO-оптимизацией
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full grid grid-cols-6 mb-6">
          <TabsTrigger value="general" className="gap-1.5">
            <Store className="h-4 w-4" />
            <span className="hidden sm:inline">Общее</span>
          </TabsTrigger>
          <TabsTrigger value="livestream" className="gap-1.5">
            <Video className="h-4 w-4" />
            <span className="hidden sm:inline">Эфир</span>
          </TabsTrigger>
          <TabsTrigger value="design" className="gap-1.5">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Дизайн</span>
          </TabsTrigger>
          <TabsTrigger value="seo" className="gap-1.5">
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">SEO</span>
          </TabsTrigger>
          <TabsTrigger value="domain" className="gap-1.5">
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">Домен</span>
          </TabsTrigger>
          <TabsTrigger value="products" className="gap-1.5">
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Товары</span>
          </TabsTrigger>
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-6">
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-semibold text-foreground">Статус магазина</h3>
                <p className="text-sm text-muted-foreground">
                  Включите, чтобы оптовый магазин стал доступен по ссылке
                </p>
              </div>
              <Switch
                checked={settings.wholesale_enabled}
                onCheckedChange={(checked) => updateSetting({ wholesale_enabled: checked })}
                disabled={saving}
              />
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-sm text-muted-foreground mb-2 block">
                  Ссылка на магазин
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={fullUrl}
                    readOnly
                    className="flex-1 font-mono text-sm bg-muted"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyLink}
                    title="Скопировать ссылку"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleOpenStore}
                    title="Открыть магазин"
                    disabled={!settings.wholesale_enabled}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  settings.wholesale_enabled ? "bg-emerald-500" : "bg-muted-foreground"
                )} />
                <span className={cn(
                  settings.wholesale_enabled ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                )}>
                  {settings.wholesale_enabled ? "Активен" : "Выключен"}
                </span>
              </div>
            </div>
          </div>

          {/* Product Source Selection */}
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-start gap-3 mb-4">
              <Package className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <h3 className="font-semibold text-foreground">Источник товаров</h3>
                <p className="text-sm text-muted-foreground">
                  Выберите прайс-лист, товары из которого будут отображаться в оптовом магазине
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-sm text-muted-foreground mb-2 block">
                  Прайс-лист
                </Label>
                <Select
                  value={settings.wholesale_catalog_id || "none"}
                  onValueChange={(value) => updateSetting({ wholesale_catalog_id: value === "none" ? null : value })}
                  disabled={saving || catalogsLoading}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Выберите прайс-лист" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      Не выбран
                    </SelectItem>
                    {catalogs.map((catalog) => {
                      const productCount = getProductCountForCatalog(catalog.id);
                      return (
                        <SelectItem key={catalog.id} value={catalog.id}>
                          {catalog.name} ({productCount} товаров)
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {selectedCatalog && selectedCatalogProductCount !== null && (
                <div className="flex items-center gap-2 text-sm bg-muted/50 rounded-lg p-3">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    В прайс-листе <span className="font-medium text-foreground">{selectedCatalog.name}</span>: {selectedCatalogProductCount} товаров
                  </span>
                </div>
              )}

              {/* MoySklad Account Filter */}
              {msAccounts.length > 0 && (
                <div className="pt-2 border-t border-border">
                  <Label className="text-sm text-muted-foreground mb-2 block">
                    <Database className="h-4 w-4 inline mr-1.5" />
                    Фильтр по аккаунту МойСклад
                  </Label>
                  <Select
                    value={selectedMsAccountFilter}
                    onValueChange={setSelectedMsAccountFilter}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Все аккаунты" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Все аккаунты</SelectItem>
                      {msAccounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Отфильтруйте товары по конкретному аккаунту МойСклад
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Minimum Order Amount */}
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-start gap-3 mb-4">
              <Store className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <h3 className="font-semibold text-foreground">Минимальный заказ</h3>
                <p className="text-sm text-muted-foreground">
                  Минимальная сумма заказа для оптовых покупателей
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={minOrderAmount}
                  onChange={(e) => setMinOrderAmount(e.target.value)}
                  placeholder="0"
                  className="w-32"
                />
                <span className="text-sm text-muted-foreground">₽</span>
                <Button
                  size="sm"
                  onClick={() => updateSetting({ wholesale_min_order_amount: parseFloat(minOrderAmount) || 0 })}
                  disabled={saving}
                >
                  Сохранить
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Livestream Tab */}
        <TabsContent value="livestream" className="space-y-6">
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-start gap-3">
                <Radio className="h-5 w-5 text-destructive mt-0.5" />
                <div>
                  <h3 className="font-semibold text-foreground">Прямые трансляции</h3>
                  <p className="text-sm text-muted-foreground">
                    Включите блок с видеотрансляцией и чатом на витрине
                  </p>
                </div>
              </div>
              <Switch
                checked={settings?.wholesale_livestream_enabled || false}
                onCheckedChange={(checked) => updateSetting({ wholesale_livestream_enabled: checked })}
                disabled={saving}
              />
            </div>

            <div className="flex items-center gap-2 text-sm mb-4">
              <div className={cn(
                "w-2 h-2 rounded-full",
                settings?.wholesale_livestream_enabled ? "bg-destructive animate-pulse" : "bg-muted-foreground"
              )} />
              <span className={cn(
                settings?.wholesale_livestream_enabled ? "text-destructive" : "text-muted-foreground"
              )}>
                {settings?.wholesale_livestream_enabled ? "Блок отображается" : "Блок скрыт"}
              </span>
            </div>
          </div>

          {/* Stream URL */}
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-start gap-3 mb-4">
              <Video className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <h3 className="font-semibold text-foreground">URL видеопотока</h3>
                <p className="text-sm text-muted-foreground">
                  Укажите ссылку на HLS-поток (.m3u8) для воспроизведения
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-sm text-muted-foreground mb-2 block">
                  HLS URL
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={livestreamUrl}
                    onChange={(e) => setLivestreamUrl(e.target.value)}
                    placeholder="https://stream.example.com/live/stream.m3u8"
                    className="flex-1 font-mono text-sm"
                  />
                  <Button
                    onClick={() => updateSetting({ wholesale_livestream_url: livestreamUrl || null })}
                    disabled={saving}
                    size="sm"
                  >
                    Сохранить
                  </Button>
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-3">
                <h4 className="text-sm font-medium mb-2">Как начать трансляцию:</h4>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Установите OBS Studio или другое ПО для стриминга</li>
                  <li>Настройте RTMP-сервер (Nginx, Oven Media, etc.) или используйте облачный сервис</li>
                  <li>Получите HLS URL вашего потока и вставьте его выше</li>
                  <li>Включите трансляцию — видео появится на витрине</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Stream Title */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="font-semibold text-foreground mb-4">Заголовок эфира</h3>
            
            <div className="space-y-4">
              <div>
                <Label className="text-sm text-muted-foreground mb-2 block">
                  Название текущей трансляции
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={livestreamTitle}
                    onChange={(e) => setLivestreamTitle(e.target.value)}
                    placeholder="Обзор нового ассортимента"
                    className="flex-1"
                  />
                  <Button
                    onClick={() => updateSetting({ wholesale_livestream_title: livestreamTitle || null })}
                    disabled={saving}
                    size="sm"
                  >
                    Сохранить
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Отображается под видео на витрине магазина
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Design Tab */}
        <TabsContent value="design" className="space-y-6">
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="font-semibold text-foreground mb-4">Название магазина</h3>
            
            <div className="space-y-4">
              <div>
                <Label className="text-sm text-muted-foreground mb-2 block">
                  Название для оптовой витрины
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={wholesaleName}
                    onChange={(e) => setWholesaleName(e.target.value)}
                    placeholder="Название магазина"
                    className="flex-1"
                  />
                  <Button
                    onClick={() => updateSetting({ wholesale_name: wholesaleName || null })}
                    disabled={saving}
                    size="sm"
                  >
                    Сохранить
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Если не указано, будет использовано основное название магазина
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* SEO Tab */}
        <TabsContent value="seo" className="space-y-6">
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="font-semibold text-foreground mb-4">SEO-настройки магазина</h3>
            
            <div className="space-y-4">
              <div>
                <Label className="text-sm text-muted-foreground mb-2 block">
                  Заголовок сайта (title)
                </Label>
                <Input
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  placeholder="Название магазина — Оптовые поставки"
                />
              </div>

              <div>
                <Label className="text-sm text-muted-foreground mb-2 block">
                  Описание сайта (meta description)
                </Label>
                <Textarea
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                  placeholder="Описание магазина для поисковых систем"
                  rows={3}
                />
              </div>

              <Button
                onClick={() => updateSetting({ 
                  wholesale_seo_title: seoTitle || null, 
                  wholesale_seo_description: seoDescription || null 
                })}
                disabled={saving}
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Сохранить SEO-настройки
              </Button>
            </div>
          </div>

          {/* Bulk SEO Generation */}
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-start gap-3 mb-4">
              <Sparkles className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h3 className="font-semibold text-foreground">Генерация SEO для товаров</h3>
                <p className="text-sm text-muted-foreground">
                  Автоматически заполнить SEO-метаданные для всех товаров с помощью ИИ
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {!settings.wholesale_catalog_id ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                  <Info className="h-4 w-4" />
                  Сначала выберите прайс-лист в разделе "Общее"
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Товаров для генерации: <span className="font-medium text-foreground">{catalogProductIds.length}</span>
                  </p>

                  {progress && (
                    <div className="space-y-2">
                      <Progress value={(progress.current / progress.total) * 100} className="h-2" />
                      <p className="text-xs text-muted-foreground text-center">
                        {progress.current} из {progress.total}
                      </p>
                    </div>
                  )}

                  <Button
                    onClick={handleBulkSeoGeneration}
                    disabled={generating || catalogProductIds.length === 0}
                    className="w-full"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Генерация...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Сгенерировать SEO для всех товаров
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-muted-foreground">
                    ИИ создаст оптимизированные заголовки, описания и ключевые слова для каждого товара
                  </p>
                </>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Domain Tab */}
        <TabsContent value="domain" className="space-y-6">
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-start gap-3 mb-4">
              <Globe className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <h3 className="font-semibold text-foreground">Свой домен</h3>
                <p className="text-sm text-muted-foreground">
                  Подключите собственный домен для оптового магазина
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-sm text-muted-foreground mb-2 block">
                  Ваш домен
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={customDomain}
                    onChange={(e) => setCustomDomain(e.target.value.toLowerCase().trim())}
                    placeholder="b2b.example.com"
                    className="flex-1"
                  />
                  <Button
                    onClick={async () => {
                      if (!storeId) return;
                      setSavingDomain(true);
                      try {
                        const normalizedDomain = customDomain
                          .toLowerCase()
                          .trim()
                          .replace(/^https?:\/\//, "")
                          .replace(/\/+$/, "");
                        
                        const { error } = await supabase
                          .from("stores")
                          .update({ wholesale_custom_domain: normalizedDomain || null })
                          .eq("id", storeId);
                        
                        if (error) throw error;
                        
                        setSettings(prev => prev ? { ...prev, wholesale_custom_domain: normalizedDomain || null } : null);
                        setCustomDomain(normalizedDomain);
                        toast.success("Домен сохранён");
                      } catch (err) {
                        console.error("Error saving domain:", err);
                        toast.error("Ошибка сохранения домена");
                      } finally {
                        setSavingDomain(false);
                      }
                    }}
                    disabled={savingDomain}
                    size="sm"
                  >
                    {savingDomain ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Сохранить"
                    )}
                  </Button>
                </div>
              </div>

              {settings.wholesale_custom_domain && (
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-emerald-600 dark:text-emerald-400">
                    Домен настроен: {settings.wholesale_custom_domain}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* DNS Instructions */}
          <div className="bg-muted/50 border border-border rounded-lg p-6">
            <div className="flex items-start gap-3 mb-4">
              <Info className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h3 className="font-semibold text-foreground">Настройка DNS</h3>
                <p className="text-sm text-muted-foreground">
                  Добавьте следующие записи в настройках DNS вашего домена
                </p>
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-4 font-mono text-sm space-y-2">
              <div className="flex items-center gap-4">
                <span className="text-muted-foreground w-16">Тип:</span>
                <span className="font-semibold">A</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-muted-foreground w-16">Имя:</span>
                <span className="font-semibold">@ или {customDomain || "b2b.example.com"}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-muted-foreground w-16">Значение:</span>
                <span className="font-semibold text-primary">185.158.133.1</span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground mt-4">
              Изменения DNS могут занять до 48 часов для применения. После настройки DNS ваш оптовый магазин станет доступен по указанному домену.
            </p>
          </div>

          {/* Current subdomain link */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h4 className="font-medium text-foreground mb-2">Текущая ссылка</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Пока домен не настроен, используйте стандартную ссылку:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono">
                {fullUrl}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopyLink}
                title="Скопировать"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Products Tab */}
        <TabsContent value="products" className="space-y-6">
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-start gap-3 mb-4">
              <ShoppingCart className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <h3 className="font-semibold text-foreground">Товары магазина</h3>
                <p className="text-sm text-muted-foreground">
                  Все товары из ассортимента для управления оптовым каталогом
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <Input
                placeholder="Поиск по названию или артикулу..."
                value={msProductSearch}
                onChange={(e) => setMsProductSearch(e.target.value)}
                className="flex-1"
              />
              <Select
                value={selectedMsAccountFilter}
                onValueChange={setSelectedMsAccountFilter}
              >
                <SelectTrigger className="w-full sm:w-[220px]">
                  <SelectValue placeholder="Все аккаунты" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все товары</SelectItem>
                  <SelectItem value="no_ms">Без МС аккаунта</SelectItem>
                  {msAccounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="text-sm text-muted-foreground mb-3">
              Найдено: {filteredMsProducts.length} товаров
            </div>

            {msProductsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredMsProducts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Database className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>Нет товаров</p>
                <p className="text-xs mt-1">Добавьте товары в ассортимент или синхронизируйте из МойСклад</p>
              </div>
            ) : (
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Название</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Артикул</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Цена</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Себестоимость</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Остаток</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Ед.</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">МС аккаунт</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredMsProducts.slice(0, 200).map((product) => {
                        const accountName = msAccounts.find(a => a.id === product.moysklad_account_id)?.name;
                        return (
                          <tr key={product.id} className="hover:bg-muted/30">
                            <td className="px-3 py-2 max-w-[300px] truncate">{product.name}</td>
                            <td className="px-3 py-2 text-muted-foreground font-mono text-xs">{product.sku || "—"}</td>
                            <td className="px-3 py-2 text-right">{product.price?.toLocaleString("ru-RU")} ₽</td>
                            <td className="px-3 py-2 text-right text-muted-foreground">
                              {product.buy_price ? `${product.buy_price.toLocaleString("ru-RU")} ₽` : "—"}
                            </td>
                            <td className="px-3 py-2 text-right">{product.quantity}</td>
                            <td className="px-3 py-2 text-muted-foreground">{product.unit || "шт"}</td>
                            <td className="px-3 py-2">
                              {accountName ? (
                                <Badge variant="secondary" className="text-xs font-normal">{accountName}</Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {filteredMsProducts.length > 200 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground bg-muted/30 text-center">
                    Показано 200 из {filteredMsProducts.length} товаров
                  </div>
                )}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
