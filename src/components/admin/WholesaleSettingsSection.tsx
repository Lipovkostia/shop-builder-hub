import React, { useState, useRef, useMemo, useEffect } from "react";
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
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useRetailSettings, RetailTheme } from "@/hooks/useRetailSettings";
import { useStoreCatalogs } from "@/hooks/useStoreCatalogs";
import { useProductSeo } from "@/hooks/useProductSeo";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
    subdomain: string;
  } | null>(null);

  const { catalogs, productVisibility, loading: catalogsLoading } = useStoreCatalogs(storeId);
  const { generating, progress, generateBulkSeo } = useProductSeo(storeId, storeName);

  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("general");
  
  // Form states
  const [wholesaleName, setWholesaleName] = useState("");
  const [minOrderAmount, setMinOrderAmount] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Fetch settings
  useEffect(() => {
    if (!storeId) return;

    const fetchSettings = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("stores")
          .select("wholesale_enabled, wholesale_name, wholesale_catalog_id, wholesale_min_order_amount, wholesale_logo_url, wholesale_seo_title, wholesale_seo_description, subdomain")
          .eq("id", storeId)
          .single();

        if (error) throw error;
        setSettings(data as any);
        
        // Sync form states
        setWholesaleName(data?.wholesale_name || "");
        setMinOrderAmount(data?.wholesale_min_order_amount?.toString() || "");
        setSeoTitle(data?.wholesale_seo_title || "");
        setSeoDescription(data?.wholesale_seo_description || "");
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
        <TabsList className="w-full grid grid-cols-4 mb-6">
          <TabsTrigger value="general" className="gap-1.5">
            <Store className="h-4 w-4" />
            <span className="hidden sm:inline">Общее</span>
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
            <h3 className="font-semibold text-foreground mb-4">Свой домен</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Функция привязки собственного домена находится в разработке. 
              Пока что используйте ссылку: <code className="bg-muted px-1 rounded">{fullUrl}</code>
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
