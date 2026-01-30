import React, { useState, useRef, useMemo } from "react";
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
  MessageCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRetailSettings, RetailTheme } from "@/hooks/useRetailSettings";
import { useStoreCatalogs } from "@/hooks/useStoreCatalogs";
import { cn } from "@/lib/utils";
import { TelegramIcon } from "@/components/icons/TelegramIcon";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";

interface RetailSettingsSectionProps {
  storeId: string | null;
}

export function RetailSettingsSection({ storeId }: RetailSettingsSectionProps) {
  const { 
    settings, 
    loading, 
    saving,
    updateRetailEnabled,
    updateRetailTheme,
    updateRetailName,
    updateSeoSettings,
    updateCustomDomain,
    updateRetailCatalog,
    updateContactSettings,
    uploadRetailLogo,
    uploadFavicon,
    deleteRetailLogo,
    deleteFavicon,
  } = useRetailSettings(storeId);

  const { catalogs, productVisibility, loading: catalogsLoading } = useStoreCatalogs(storeId);

  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("general");
  
  // Form states
  const [theme, setTheme] = useState<RetailTheme>({});
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [retailPhone, setRetailPhone] = useState("");
  const [telegramUsername, setTelegramUsername] = useState("");
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [retailName, setRetailName] = useState("");
  
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  // Sync form states with settings
  React.useEffect(() => {
    if (settings) {
      setTheme(settings.retail_theme || {});
      setSeoTitle(settings.seo_title || "");
      setSeoDescription(settings.seo_description || "");
      setCustomDomain(settings.custom_domain || "");
      setRetailPhone(settings.retail_phone || "");
      setTelegramUsername(settings.telegram_username || "");
      setWhatsappPhone(settings.whatsapp_phone || "");
      setRetailName(settings.retail_name || "");
    }
  }, [settings]);

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
    if (!settings?.retail_catalog_id) return null;
    return getProductCountForCatalog(settings.retail_catalog_id);
  }, [settings?.retail_catalog_id, productVisibility]);

  const selectedCatalog = useMemo(() => {
    if (!settings?.retail_catalog_id) return null;
    return catalogs.find(c => c.id === settings.retail_catalog_id);
  }, [settings?.retail_catalog_id, catalogs]);

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

  const storeUrl = `/retail/${settings.subdomain}`;
  const fullUrl = `${window.location.origin}${storeUrl}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenStore = () => {
    window.open(storeUrl, "_blank");
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadRetailLogo(file);
    }
  };

  const handleFaviconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadFavicon(file);
    }
  };

  const handleSaveTheme = () => {
    updateRetailTheme(theme);
  };

  const handleSaveSeo = () => {
    updateSeoSettings({
      seo_title: seoTitle || null,
      seo_description: seoDescription || null,
    });
  };

  const handleSaveDomain = () => {
    updateCustomDomain(customDomain || null);
  };

  const handleSaveContacts = () => {
    updateContactSettings({
      retail_phone: retailPhone || null,
      telegram_username: telegramUsername || null,
      whatsapp_phone: whatsappPhone || null,
    });
  };

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-foreground">Розничный магазин</h2>
        <p className="text-sm text-muted-foreground">
          Настройте витрину для розничных покупателей
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
                  Включите, чтобы розничный магазин стал доступен по ссылке
                </p>
              </div>
              <Switch
                checked={settings.retail_enabled}
                onCheckedChange={updateRetailEnabled}
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
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleOpenStore}
                    title="Открыть магазин"
                    disabled={!settings.retail_enabled}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  settings.retail_enabled ? "bg-green-500" : "bg-muted-foreground"
                )} />
                <span className={cn(
                  settings.retail_enabled ? "text-green-600" : "text-muted-foreground"
                )}>
                  {settings.retail_enabled ? "Активен" : "Выключен"}
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
                  Выберите прайс-лист, товары из которого будут отображаться в розничном магазине
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-sm text-muted-foreground mb-2 block">
                  Прайс-лист
                </Label>
                <Select
                  value={settings.retail_catalog_id || "all"}
                  onValueChange={(value) => updateRetailCatalog(value === "all" ? null : value)}
                  disabled={saving || catalogsLoading}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Выберите прайс-лист" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      Все активные товары
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

              <div className="flex items-start gap-2 text-xs text-muted-foreground bg-blue-500/10 rounded-lg p-3">
                <Info className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  Если прайс-лист не выбран, все активные товары магазина будут отображаться в розничном магазине. При выборе прайс-листа будут показаны только товары из него с учётом настроенных наценок.
                </span>
              </div>
            </div>
          </div>

          {/* Mobile Contact Bar Settings */}
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-start gap-3 mb-4">
              <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <h3 className="font-semibold text-foreground">Контакты для мобильной версии</h3>
                <p className="text-sm text-muted-foreground">
                  Телефон и мессенджеры, которые отображаются в шапке на мобильных устройствах
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-sm text-muted-foreground mb-2 block">
                  Телефон в шапке
                </Label>
                <Input
                  value={retailPhone}
                  onChange={(e) => setRetailPhone(e.target.value)}
                  placeholder="+7 952 2288711"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                    <TelegramIcon className="h-4 w-4 text-[#229ED9]" />
                    Telegram (username без @)
                  </Label>
                  <Input
                    value={telegramUsername}
                    onChange={(e) => setTelegramUsername(e.target.value.replace('@', ''))}
                    placeholder="Lipovk"
                  />
                </div>

                <div>
                  <Label className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                    <WhatsAppIcon className="h-4 w-4 text-[#25D366]" />
                    WhatsApp (номер телефона)
                  </Label>
                  <Input
                    value={whatsappPhone}
                    onChange={(e) => setWhatsappPhone(e.target.value)}
                    placeholder="+79999993222"
                  />
                </div>
              </div>

              <div className="pt-2">
                <Button onClick={handleSaveContacts} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Сохранить контакты
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="design" className="space-y-6">
          {/* Logo and Store Name Section */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="font-semibold text-foreground mb-4">Логотип и название магазина</h3>
            
            <div className="flex items-start gap-4 mb-6">
              <div className="w-24 h-24 border border-dashed border-border rounded-lg flex items-center justify-center bg-muted/50 overflow-hidden">
                {settings.retail_logo_url ? (
                  <img 
                    src={settings.retail_logo_url} 
                    alt="Logo" 
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <Store className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <div className="flex flex-col gap-2 flex-1">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={saving}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Загрузить
                </Button>
                {settings.retail_logo_url && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={deleteRetailLogo}
                    disabled={saving}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Удалить
                  </Button>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Рекомендуемый размер: до 2 МБ. Поддерживаются PNG, JPG, WebP. Большие файлы будут сжаты автоматически.
                </p>
              </div>
            </div>

            {/* Store Name Field */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">
                Название магазина (для витрины)
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  value={retailName}
                  onChange={(e) => setRetailName(e.target.value)}
                  placeholder="Введите название магазина"
                  className="flex-1"
                />
                <Button 
                  onClick={() => updateRetailName(retailName || null)} 
                  disabled={saving}
                  size="sm"
                >
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Сохранить
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Отображается рядом с логотипом в меню категорий. Если не указано, будет использоваться название из настроек магазина.
              </p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-6 space-y-4">
            <h3 className="font-semibold text-foreground">Цветовая схема</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-muted-foreground mb-2 block">
                  Основной цвет
                </Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={theme.primaryColor || "#000000"}
                    onChange={(e) => setTheme({ ...theme, primaryColor: e.target.value })}
                    className="w-10 h-10 rounded cursor-pointer border border-border"
                  />
                  <Input
                    value={theme.primaryColor || "#000000"}
                    onChange={(e) => setTheme({ ...theme, primaryColor: e.target.value })}
                    className="flex-1 font-mono text-sm"
                    placeholder="#000000"
                  />
                </div>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground mb-2 block">
                  Акцентный цвет
                </Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={theme.accentColor || "#6366f1"}
                    onChange={(e) => setTheme({ ...theme, accentColor: e.target.value })}
                    className="w-10 h-10 rounded cursor-pointer border border-border"
                  />
                  <Input
                    value={theme.accentColor || "#6366f1"}
                    onChange={(e) => setTheme({ ...theme, accentColor: e.target.value })}
                    className="flex-1 font-mono text-sm"
                    placeholder="#6366f1"
                  />
                </div>
              </div>
            </div>

            <div>
              <Label className="text-sm text-muted-foreground mb-2 block">
                Стиль шапки
              </Label>
              <div className="flex gap-2">
                {(["minimal", "full", "centered"] as const).map((style) => (
                  <Button
                    key={style}
                    variant={theme.headerStyle === style ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTheme({ ...theme, headerStyle: style })}
                  >
                    {style === "minimal" ? "Минимум" : style === "full" ? "Полная" : "По центру"}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-sm text-muted-foreground mb-2 block">
                Стиль карточек товаров
              </Label>
              <div className="flex gap-2">
                {(["modern", "classic", "compact"] as const).map((style) => (
                  <Button
                    key={style}
                    variant={theme.productCardStyle === style ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTheme({ ...theme, productCardStyle: style })}
                  >
                    {style === "modern" ? "Современный" : style === "classic" ? "Классика" : "Компакт"}
                  </Button>
                ))}
              </div>
            </div>

            <div className="pt-4">
              <Button onClick={handleSaveTheme} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Сохранить дизайн
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* SEO Tab */}
        <TabsContent value="seo" className="space-y-6">
          <div className="bg-card border border-border rounded-lg p-6 space-y-4">
            <h3 className="font-semibold text-foreground">Мета-теги</h3>
            
            <div>
              <Label className="text-sm text-muted-foreground mb-2 block">
                Заголовок страницы (title)
              </Label>
              <Input
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                placeholder="Мой магазин — доставка продуктов"
                maxLength={60}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {seoTitle.length}/60 символов
              </p>
            </div>

            <div>
              <Label className="text-sm text-muted-foreground mb-2 block">
                Описание (description)
              </Label>
              <Textarea
                value={seoDescription}
                onChange={(e) => setSeoDescription(e.target.value)}
                placeholder="Широкий ассортимент продуктов с доставкой по городу..."
                maxLength={160}
                rows={3}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {seoDescription.length}/160 символов
              </p>
            </div>

            <div className="pt-2">
              <Button onClick={handleSaveSeo} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Сохранить SEO
              </Button>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="font-semibold text-foreground mb-4">Favicon</h3>
            
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 border border-dashed border-border rounded-lg flex items-center justify-center bg-muted/50 overflow-hidden">
                {settings.favicon_url ? (
                  <img 
                    src={settings.favicon_url} 
                    alt="Favicon" 
                    className="w-8 h-8 object-contain"
                  />
                ) : (
                  <Globe className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <input
                  ref={faviconInputRef}
                  type="file"
                  accept="image/png,image/x-icon,image/svg+xml"
                  className="hidden"
                  onChange={handleFaviconUpload}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => faviconInputRef.current?.click()}
                  disabled={saving}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Загрузить
                </Button>
                {settings.favicon_url && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={deleteFavicon}
                    disabled={saving}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Удалить
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">
                  PNG, ICO или SVG, 32×32 px
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Domain Tab */}
        <TabsContent value="domain" className="space-y-6">
          <div className="bg-card border border-border rounded-lg p-6 space-y-4">
            <h3 className="font-semibold text-foreground">Свой домен</h3>
            <p className="text-sm text-muted-foreground">
              Подключите собственный домен для розничного магазина
            </p>
            
            <div>
              <Label className="text-sm text-muted-foreground mb-2 block">
                Ваш домен
              </Label>
              <Input
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value.toLowerCase().trim())}
                placeholder="shop.example.com"
              />
            </div>

            <div className="pt-2">
              <Button onClick={handleSaveDomain} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Сохранить домен
              </Button>
            </div>
          </div>

          {/* DNS Instructions - always show when domain is entered */}
          <div className="bg-muted/50 border border-border rounded-lg p-6">
            <div className="flex items-start gap-3 mb-4">
              <Info className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h3 className="font-semibold text-foreground">🔧 Настройка DNS</h3>
                <p className="text-sm text-muted-foreground">
                  Добавьте следующие записи у вашего регистратора домена
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {/* A Record for root domain */}
              <div className="bg-card border border-border rounded-lg p-4 font-mono text-sm space-y-1">
                <div className="text-xs text-muted-foreground mb-2 font-sans">Запись 1 — корневой домен</div>
                <div className="flex items-center gap-4">
                  <span className="text-muted-foreground w-20">Тип:</span>
                  <span className="font-semibold">A</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-muted-foreground w-20">Имя:</span>
                  <span className="font-semibold">@</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-muted-foreground w-20">Значение:</span>
                  <span className="font-semibold text-primary">185.158.133.1</span>
                </div>
              </div>

              {/* A Record for www subdomain */}
              <div className="bg-card border border-border rounded-lg p-4 font-mono text-sm space-y-1">
                <div className="text-xs text-muted-foreground mb-2 font-sans">Запись 2 — www субдомен</div>
                <div className="flex items-center gap-4">
                  <span className="text-muted-foreground w-20">Тип:</span>
                  <span className="font-semibold">A</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-muted-foreground w-20">Имя:</span>
                  <span className="font-semibold">www</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-muted-foreground w-20">Значение:</span>
                  <span className="font-semibold text-primary">185.158.133.1</span>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <span>⏱</span> Изменения DNS могут занять до 48 часов
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-start gap-1.5">
                <span>ℹ️</span> 
                <span>TXT-запись <code className="bg-muted px-1 rounded">_lovable</code> <strong>НЕ требуется</strong> для кастомных доменов магазинов — она нужна только для подключения домена к проекту Lovable через Settings → Domains</span>
              </p>
            </div>
          </div>

          {settings.custom_domain && (
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
              <span className="text-muted-foreground">
                Домен настроен: <span className="font-medium text-foreground">{settings.custom_domain}</span>
              </span>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
