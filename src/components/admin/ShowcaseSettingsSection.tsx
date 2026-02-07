import React, { useState, useRef, useMemo } from "react";
import { 
  Store, Palette, Search, Globe, ExternalLink, Copy, Check, Upload, Trash2, Loader2,
  Info, Package, Phone, Truck, FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useShowcaseSettings, ShowcaseTheme } from "@/hooks/useShowcaseSettings";
import { useStoreCatalogs } from "@/hooks/useStoreCatalogs";
import { cn } from "@/lib/utils";
import { TelegramIcon } from "@/components/icons/TelegramIcon";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";

interface ShowcaseSettingsSectionProps {
  storeId: string | null;
}

export function ShowcaseSettingsSection({ storeId }: ShowcaseSettingsSectionProps) {
  const { 
    settings, loading, saving,
    updateShowcaseEnabled, updateShowcaseTheme, updateShowcaseName,
    updateSeoSettings, updateCustomDomain, updateShowcaseCatalog,
    updateContactSettings, updateDeliverySettings, updateFooterSettings,
    uploadShowcaseLogo, uploadFavicon, deleteShowcaseLogo, deleteFavicon,
  } = useShowcaseSettings(storeId);

  const { catalogs, productVisibility, loading: catalogsLoading } = useStoreCatalogs(storeId);

  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("general");
  
  const [theme, setTheme] = useState<ShowcaseTheme>({});
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [showcasePhone, setShowcasePhone] = useState("");
  const [telegramUsername, setTelegramUsername] = useState("");
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [showcaseName, setShowcaseName] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [deliveryInfo, setDeliveryInfo] = useState("");
  const [deliveryFreeFrom, setDeliveryFreeFrom] = useState("");
  const [deliveryRegion, setDeliveryRegion] = useState("");
  const [footerDeliveryPayment, setFooterDeliveryPayment] = useState("");
  const [footerReturns, setFooterReturns] = useState("");
  
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (settings) {
      setTheme(settings.showcase_theme || {});
      setSeoTitle(settings.showcase_seo_title || "");
      setSeoDescription(settings.showcase_seo_description || "");
      setCustomDomain(settings.showcase_custom_domain || "");
      setShowcasePhone(settings.showcase_phone || "");
      setTelegramUsername(settings.showcase_telegram_username || "");
      setWhatsappPhone(settings.showcase_whatsapp_phone || "");
      setShowcaseName(settings.showcase_name || "");
      setDeliveryTime(settings.showcase_delivery_time || "");
      setDeliveryInfo(settings.showcase_delivery_info || "");
      setDeliveryFreeFrom(settings.showcase_delivery_free_from?.toString() || "");
      setDeliveryRegion(settings.showcase_delivery_region || "");
      setFooterDeliveryPayment(settings.showcase_footer_delivery_payment || "");
      setFooterReturns(settings.showcase_footer_returns || "");
    }
  }, [settings]);

  const getProductCountForCatalog = (catalogId: string): number => {
    let count = 0;
    Object.values(productVisibility).forEach((catalogSet) => { if (catalogSet.has(catalogId)) count++; });
    return count;
  };

  const selectedCatalogProductCount = useMemo(() => {
    if (!settings?.showcase_catalog_id) return null;
    return getProductCountForCatalog(settings.showcase_catalog_id);
  }, [settings?.showcase_catalog_id, productVisibility]);

  const selectedCatalog = useMemo(() => {
    if (!settings?.showcase_catalog_id) return null;
    return catalogs.find(c => c.id === settings.showcase_catalog_id);
  }, [settings?.showcase_catalog_id, catalogs]);

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!settings) return <div className="text-center py-12 text-muted-foreground">Не удалось загрузить настройки</div>;

  const storeUrl = `/showcase/${settings.subdomain}`;
  const fullUrl = `${window.location.origin}${storeUrl}`;

  const handleCopyLink = () => { navigator.clipboard.writeText(fullUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const handleOpenStore = () => { window.open(storeUrl, "_blank"); };
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) uploadShowcaseLogo(file); };
  const handleFaviconUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) uploadFavicon(file); };

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-foreground">Интернет-витрина</h2>
        <p className="text-sm text-muted-foreground">Настройте витрину для покупателей</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full grid grid-cols-4 mb-6">
          <TabsTrigger value="general" className="gap-1.5"><Store className="h-4 w-4" /><span className="hidden sm:inline">Общее</span></TabsTrigger>
          <TabsTrigger value="design" className="gap-1.5"><Palette className="h-4 w-4" /><span className="hidden sm:inline">Дизайн</span></TabsTrigger>
          <TabsTrigger value="seo" className="gap-1.5"><Search className="h-4 w-4" /><span className="hidden sm:inline">SEO</span></TabsTrigger>
          <TabsTrigger value="domain" className="gap-1.5"><Globe className="h-4 w-4" /><span className="hidden sm:inline">Домен</span></TabsTrigger>
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-6">
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-semibold text-foreground">Статус витрины</h3>
                <p className="text-sm text-muted-foreground">Включите, чтобы витрина стала доступна по ссылке</p>
              </div>
              <Switch checked={settings.showcase_enabled} onCheckedChange={updateShowcaseEnabled} disabled={saving} />
            </div>
            <div className="space-y-4">
              <div>
                <Label className="text-sm text-muted-foreground mb-2 block">Ссылка на витрину</Label>
                <div className="flex items-center gap-2">
                  <Input value={fullUrl} readOnly className="flex-1 font-mono text-sm bg-muted" />
                  <Button variant="outline" size="icon" onClick={handleCopyLink}>{copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}</Button>
                  <Button variant="outline" size="icon" onClick={handleOpenStore} disabled={!settings.showcase_enabled}><ExternalLink className="h-4 w-4" /></Button>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className={cn("w-2 h-2 rounded-full", settings.showcase_enabled ? "bg-green-500" : "bg-muted-foreground")} />
                <span className={cn(settings.showcase_enabled ? "text-green-600" : "text-muted-foreground")}>{settings.showcase_enabled ? "Активна" : "Выключена"}</span>
              </div>
            </div>
          </div>

          {/* Showcase Name */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="font-semibold text-foreground mb-4">Название витрины</h3>
            <div className="space-y-4">
              <Input value={showcaseName} onChange={(e) => setShowcaseName(e.target.value)} placeholder="Название для покупателей" />
              <Button onClick={() => updateShowcaseName(showcaseName || null)} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Сохранить</Button>
            </div>
          </div>

          {/* Product Source */}
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-start gap-3 mb-4">
              <Package className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <h3 className="font-semibold text-foreground">Источник товаров</h3>
                <p className="text-sm text-muted-foreground">Выберите прайс-лист для витрины</p>
              </div>
            </div>
            <div className="space-y-4">
              <Select value={settings.showcase_catalog_id || "none"} onValueChange={(value) => updateShowcaseCatalog(value === "none" ? null : value)} disabled={saving || catalogsLoading}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Выберите прайс-лист" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Не выбран</SelectItem>
                  {catalogs.map((catalog) => <SelectItem key={catalog.id} value={catalog.id}>{catalog.name} ({getProductCountForCatalog(catalog.id)} товаров)</SelectItem>)}
                </SelectContent>
              </Select>
              {selectedCatalog && selectedCatalogProductCount !== null && (
                <div className="flex items-center gap-2 text-sm bg-muted/50 rounded-lg p-3">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">В прайс-листе <span className="font-medium text-foreground">{selectedCatalog.name}</span>: {selectedCatalogProductCount} товаров</span>
                </div>
              )}
              <div className="flex items-start gap-2 text-xs text-muted-foreground bg-blue-500/10 rounded-lg p-3">
                <Info className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Для отображения товаров на витрине необходимо выбрать прайс-лист. Будут показаны только товары из него с учётом настроенных наценок.</span>
              </div>
            </div>
          </div>

          {/* Contacts */}
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-start gap-3 mb-4">
              <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div><h3 className="font-semibold text-foreground">Контакты</h3><p className="text-sm text-muted-foreground">Телефон и мессенджеры в шапке витрины</p></div>
            </div>
            <div className="space-y-4">
              <div><Label className="text-sm text-muted-foreground mb-2 block">Телефон</Label><Input value={showcasePhone} onChange={(e) => setShowcasePhone(e.target.value)} placeholder="+7 952 2288711" /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><Label className="text-sm text-muted-foreground mb-2 flex items-center gap-2"><TelegramIcon className="h-4 w-4 text-[#229ED9]" />Telegram</Label><Input value={telegramUsername} onChange={(e) => setTelegramUsername(e.target.value.replace('@', ''))} placeholder="username" /></div>
                <div><Label className="text-sm text-muted-foreground mb-2 flex items-center gap-2"><WhatsAppIcon className="h-4 w-4 text-[#25D366]" />WhatsApp</Label><Input value={whatsappPhone} onChange={(e) => setWhatsappPhone(e.target.value)} placeholder="+79999993222" /></div>
              </div>
              <Button onClick={() => updateContactSettings({ showcase_phone: showcasePhone || null, showcase_telegram_username: telegramUsername || null, showcase_whatsapp_phone: whatsappPhone || null })} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Сохранить контакты</Button>
            </div>
          </div>

          {/* Delivery */}
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-start gap-3 mb-4">
              <Truck className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div><h3 className="font-semibold text-foreground">Доставка</h3><p className="text-sm text-muted-foreground">Настройки доставки для витрины</p></div>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><Label className="text-sm text-muted-foreground mb-2 block">Время доставки</Label><Input value={deliveryTime} onChange={(e) => setDeliveryTime(e.target.value)} placeholder="14:00" /></div>
                <div><Label className="text-sm text-muted-foreground mb-2 block">Бесплатно от (₽)</Label><Input type="number" value={deliveryFreeFrom} onChange={(e) => setDeliveryFreeFrom(e.target.value)} placeholder="3000" /></div>
              </div>
              <div><Label className="text-sm text-muted-foreground mb-2 block">Регион доставки</Label><Input value={deliveryRegion} onChange={(e) => setDeliveryRegion(e.target.value)} placeholder="Москва и МО" /></div>
              <div><Label className="text-sm text-muted-foreground mb-2 block">Информация о доставке</Label><Textarea value={deliveryInfo} onChange={(e) => setDeliveryInfo(e.target.value)} placeholder="Подробности о доставке..." /></div>
              <Button onClick={() => updateDeliverySettings({ showcase_delivery_time: deliveryTime || null, showcase_delivery_info: deliveryInfo || null, showcase_delivery_free_from: deliveryFreeFrom ? parseFloat(deliveryFreeFrom) : null, showcase_delivery_region: deliveryRegion || null })} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Сохранить</Button>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-start gap-3 mb-4">
              <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div><h3 className="font-semibold text-foreground">Футер</h3><p className="text-sm text-muted-foreground">Текстовые блоки в подвале витрины</p></div>
            </div>
            <div className="space-y-4">
              <div><Label className="text-sm text-muted-foreground mb-2 block">Доставка и оплата</Label><Textarea value={footerDeliveryPayment} onChange={(e) => setFooterDeliveryPayment(e.target.value)} placeholder="Информация о доставке и оплате..." /></div>
              <div><Label className="text-sm text-muted-foreground mb-2 block">Возвраты</Label><Textarea value={footerReturns} onChange={(e) => setFooterReturns(e.target.value)} placeholder="Условия возврата..." /></div>
              <Button onClick={() => updateFooterSettings({ showcase_footer_delivery_payment: footerDeliveryPayment || null, showcase_footer_returns: footerReturns || null })} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Сохранить</Button>
            </div>
          </div>
        </TabsContent>

        {/* Design Tab */}
        <TabsContent value="design" className="space-y-6">
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="font-semibold text-foreground mb-4">Логотип витрины</h3>
            <div className="space-y-4">
              {settings.showcase_logo_url ? (
                <div className="flex items-center gap-4">
                  <img src={settings.showcase_logo_url} alt="Логотип" className="h-16 w-auto object-contain rounded-lg border" />
                  <Button variant="destructive" size="sm" onClick={deleteShowcaseLogo} disabled={saving}><Trash2 className="h-4 w-4 mr-1" />Удалить</Button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-2">Загрузите логотип витрины</p>
                  <Button variant="outline" onClick={() => logoInputRef.current?.click()} disabled={saving}>Выбрать файл</Button>
                </div>
              )}
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="font-semibold text-foreground mb-4">Цвета</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-muted-foreground mb-2 block">Основной цвет</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={theme.primaryColor || "#000000"} onChange={(e) => setTheme(prev => ({ ...prev, primaryColor: e.target.value }))} className="w-10 h-10 rounded border cursor-pointer" />
                  <Input value={theme.primaryColor || "#000000"} onChange={(e) => setTheme(prev => ({ ...prev, primaryColor: e.target.value }))} className="flex-1" />
                </div>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground mb-2 block">Акцентный цвет</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={theme.accentColor || "#6366f1"} onChange={(e) => setTheme(prev => ({ ...prev, accentColor: e.target.value }))} className="w-10 h-10 rounded border cursor-pointer" />
                  <Input value={theme.accentColor || "#6366f1"} onChange={(e) => setTheme(prev => ({ ...prev, accentColor: e.target.value }))} className="flex-1" />
                </div>
              </div>
            </div>
            <Button onClick={() => updateShowcaseTheme(theme)} disabled={saving} className="mt-4">{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Сохранить дизайн</Button>
          </div>
        </TabsContent>

        {/* SEO Tab */}
        <TabsContent value="seo" className="space-y-6">
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="font-semibold text-foreground mb-4">Мета-теги</h3>
            <div className="space-y-4">
              <div><Label className="text-sm text-muted-foreground mb-2 block">Заголовок (title)</Label><Input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} placeholder="Название — Интернет-витрина" maxLength={60} /><p className="text-xs text-muted-foreground mt-1">{seoTitle.length}/60</p></div>
              <div><Label className="text-sm text-muted-foreground mb-2 block">Описание (description)</Label><Textarea value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} placeholder="Описание витрины для поисковых систем" maxLength={160} /><p className="text-xs text-muted-foreground mt-1">{seoDescription.length}/160</p></div>
              <Button onClick={() => updateSeoSettings({ showcase_seo_title: seoTitle || null, showcase_seo_description: seoDescription || null })} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Сохранить SEO</Button>
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="font-semibold text-foreground mb-4">Favicon</h3>
            <div className="space-y-4">
              {settings.showcase_favicon_url ? (
                <div className="flex items-center gap-4">
                  <img src={settings.showcase_favicon_url} alt="Favicon" className="h-8 w-8 object-contain" />
                  <Button variant="destructive" size="sm" onClick={deleteFavicon} disabled={saving}><Trash2 className="h-4 w-4 mr-1" />Удалить</Button>
                </div>
              ) : (
                <Button variant="outline" onClick={() => faviconInputRef.current?.click()} disabled={saving}><Upload className="h-4 w-4 mr-2" />Загрузить favicon</Button>
              )}
              <input ref={faviconInputRef} type="file" accept="image/*" className="hidden" onChange={handleFaviconUpload} />
            </div>
          </div>
        </TabsContent>

        {/* Domain Tab */}
        <TabsContent value="domain" className="space-y-6">
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="font-semibold text-foreground mb-4">Кастомный домен</h3>
            <div className="space-y-4">
              <div><Label className="text-sm text-muted-foreground mb-2 block">Домен</Label><Input value={customDomain} onChange={(e) => setCustomDomain(e.target.value)} placeholder="shop.example.com" /></div>
              <Button onClick={() => updateCustomDomain(customDomain || null)} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Сохранить домен</Button>
              <div className="flex items-start gap-2 text-xs text-muted-foreground bg-blue-500/10 rounded-lg p-3">
                <Info className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Для подключения домена настройте A-запись на 185.158.133.1 и TXT-запись _lovable.</span>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
