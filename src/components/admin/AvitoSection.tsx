import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ExternalLink, Loader2, Link2, Unlink, RefreshCw, Check, Package, Search,
  MapPin, Calendar, Eye, Image as ImageIcon, X, Download, Settings, Save, Sparkles, Wand2,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Product } from "./types";
import { AvitoFeedProduct, AvitoDefaults } from "@/hooks/useAvitoFeedProducts";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";

interface AvitoItem {
  id: number;
  title: string;
  price: number;
  url: string;
  status: string;
  category?: { id: number; name: string };
  images?: any[];
  description?: string;
  body?: string;
  address?: { city?: string; street?: string; address?: string; lat?: number; lng?: number };
  created?: string;
  avito_id?: number;
  views?: number;
  favorites?: number;
  params?: any[];
}

interface AvitoAccount {
  id: string;
  store_id: string;
  client_id: string;
  client_secret: string;
  avito_user_id: number | null;
  profile_name: string | null;
  last_sync: string | null;
}

interface AvitoSectionProps {
  storeId: string | null;
  products?: Product[];
  avitoFeed?: {
    feedProducts: AvitoFeedProduct[];
    feedProductIds: Set<string>;
    loading: boolean;
    defaults: AvitoDefaults;
    saveDefaults: (defaults: AvitoDefaults) => void;
    addProductsToFeed: (productIds: string[]) => Promise<boolean>;
    removeProductFromFeed: (productId: string) => Promise<void>;
    removeProductsFromFeed: (productIds: string[]) => Promise<void>;
    updateProductParams: (productId: string, params: any) => Promise<void>;
    refetch: () => Promise<void>;
  };
}

// Inline editable cell component
function InlineCell({ value, onChange, placeholder, maxLength, className = "", type = "text" }: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  maxLength?: number;
  className?: string;
  type?: "text" | "number" | "textarea";
}) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => { setLocalValue(value); }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  const save = () => {
    setEditing(false);
    if (localValue !== value) onChange(localValue);
  };

  if (!editing) {
    return (
      <div
        className={`cursor-text px-1.5 py-1 rounded hover:bg-muted/60 min-h-[28px] text-xs leading-tight ${className}`}
        onClick={() => setEditing(true)}
        title="Нажмите для редактирования"
      >
        {value || <span className="text-muted-foreground/50">{placeholder || "—"}</span>}
      </div>
    );
  }

  if (type === "textarea") {
    return (
      <textarea
        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === "Escape") { setLocalValue(value); setEditing(false); } }}
        placeholder={placeholder}
        maxLength={maxLength}
        className="w-full text-xs border border-primary/30 rounded px-1.5 py-1 bg-background resize-none min-h-[60px] focus:outline-none focus:ring-1 focus:ring-primary/50"
      />
    );
  }

  return (
    <input
      ref={inputRef as React.RefObject<HTMLInputElement>}
      type={type}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") save();
        if (e.key === "Escape") { setLocalValue(value); setEditing(false); }
      }}
      placeholder={placeholder}
      maxLength={maxLength}
      className="w-full text-xs border border-primary/30 rounded px-1.5 py-1 h-7 bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
    />
  );
}

export function AvitoSection({ storeId, products: storeProducts = [], avitoFeed }: AvitoSectionProps) {
  const { toast } = useToast();
  const [account, setAccount] = useState<AvitoAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");

  const [items, setItems] = useState<AvitoItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [detailDialogItem, setDetailDialogItem] = useState<AvitoItem | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activeTab, setActiveTab] = useState("feed");
  const [selectedFeedProducts, setSelectedFeedProducts] = useState<Set<string>>(new Set());
  const [settingsOpen, setSettingsOpen] = useState(false);

  // AI generation state
  const [aiPromptOpen, setAiPromptOpen] = useState(false);
  const [aiInstruction, setAiInstruction] = useState("");
  const [aiMaxChars, setAiMaxChars] = useState(500);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiGeneratingIds, setAiGeneratingIds] = useState<Set<string>>(new Set());

  // Local defaults form state
  const [localDefaults, setLocalDefaults] = useState<AvitoDefaults>(avitoFeed?.defaults || {
    managerName: "", contactPhone: "", email: "", companyName: "", address: "",
    category: "Продукты питания", goodsType: "Товар от производителя",
    goodsSubType: "Мясо, птица, субпродукты", contactMethod: "По телефону и в сообщениях",
    listingFee: "Package", targetAudience: "Частные лица и бизнес",
  });

  useEffect(() => {
    if (avitoFeed?.defaults) setLocalDefaults(avitoFeed.defaults);
  }, [avitoFeed?.defaults]);

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

  const callAvitoApi = useCallback(async (body: any) => {
    const res = await fetch(
      `https://${projectId}.supabase.co/functions/v1/avito-api`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    );
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || "Ошибка API Авито");
    return data;
  }, [projectId]);

  useEffect(() => {
    if (!storeId) return;
    setLoading(true);
    callAvitoApi({ action: "get_credentials", store_id: storeId })
      .then((data) => {
        setAccount(data.account || null);
        if (data.account) { setClientId(data.account.client_id); setClientSecret(data.account.client_secret); }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [storeId, callAvitoApi]);

  const handleConnect = async () => {
    if (!storeId || !clientId.trim() || !clientSecret.trim()) {
      toast({ title: "Заполните Client ID и Client Secret", variant: "destructive" }); return;
    }
    setConnecting(true);
    try {
      const data = await callAvitoApi({ action: "test_connection", store_id: storeId, client_id: clientId.trim(), client_secret: clientSecret.trim() });
      toast({ title: "Авито подключён!", description: `Профиль: ${data.user?.name || data.user?.email || data.user?.id}` });
      const acc = await callAvitoApi({ action: "get_credentials", store_id: storeId });
      setAccount(acc.account);
    } catch (err: any) {
      toast({ title: "Ошибка подключения", description: err.message, variant: "destructive" });
    } finally { setConnecting(false); }
  };

  const handleDisconnect = async () => {
    if (!storeId) return;
    setDisconnecting(true);
    try {
      await callAvitoApi({ action: "disconnect", store_id: storeId });
      setAccount(null); setClientId(""); setClientSecret(""); setItems([]);
      toast({ title: "Авито отключён" });
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    } finally { setDisconnecting(false); }
  };

  const handleFetchItems = async () => {
    if (!storeId) return;
    setFetching(true);
    try {
      const data = await callAvitoApi({ action: "fetch_items", store_id: storeId });
      setItems(data.items || []);
      toast({ title: `Загружено ${data.total} объявлений` });
    } catch (err: any) {
      toast({ title: "Ошибка загрузки", description: err.message, variant: "destructive" });
    } finally { setFetching(false); }
  };

  const handleViewDetail = async (item: AvitoItem) => {
    setDetailDialogItem(item);
    setLoadingDetail(true);
    try {
      const data = await callAvitoApi({ action: "get_item_info", store_id: storeId, item_id: item.id });
      if (data.item) setDetailDialogItem({ ...item, ...data.item });
    } catch {} finally { setLoadingDetail(false); }
  };

  // === INLINE PARAM UPDATE ===
  const handleInlineParamUpdate = useCallback(async (productId: string, key: string, value: string) => {
    if (!avitoFeed) return;
    const fp = avitoFeed.feedProducts.find(f => f.product_id === productId);
    const currentParams = fp?.avito_params || {};
    const newParams = { ...currentParams, [key]: value || undefined };
    // Clean empty values
    Object.keys(newParams).forEach(k => { if (!newParams[k]) delete newParams[k]; });
    await avitoFeed.updateProductParams(productId, newParams);
  }, [avitoFeed]);

  // === AI DESCRIPTION GENERATION ===
  const handleAiGenerate = async () => {
    if (!avitoFeed || selectedFeedProducts.size === 0) return;
    setAiGenerating(true);
    setAiGeneratingIds(new Set(selectedFeedProducts));

    try {
      const productsToGenerate = Array.from(selectedFeedProducts).map(pid => {
        const product = storeProducts.find(p => p.id === pid);
        return product ? { id: pid, name: product.name, description: product.description, price: product.pricePerUnit } : null;
      }).filter(Boolean);

      const { data, error } = await supabase.functions.invoke("ai-avito-description", {
        body: { products: productsToGenerate, instruction: aiInstruction, maxChars: aiMaxChars },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const descriptions = data?.descriptions || {};
      let updated = 0;

      for (const [pid, desc] of Object.entries(descriptions)) {
        if (desc && typeof desc === "string") {
          const fp = avitoFeed.feedProducts.find(f => f.product_id === pid);
          const currentParams = fp?.avito_params || {};
          await avitoFeed.updateProductParams(pid, { ...currentParams, description: desc });
          updated++;
        }
      }

      toast({ title: `Сгенерировано ${updated} описаний` });
      setAiPromptOpen(false);
    } catch (err: any) {
      console.error("AI generation error:", err);
      toast({ title: "Ошибка генерации", description: err.message, variant: "destructive" });
    } finally {
      setAiGenerating(false);
      setAiGeneratingIds(new Set());
    }
  };

  // === EXCEL EXPORT ===
  const handleExportExcel = () => {
    if (!avitoFeed || avitoFeed.feedProducts.length === 0) {
      toast({ title: "Нет товаров для экспорта", variant: "destructive" }); return;
    }

    const d = localDefaults;
    const categoryLine = `Для дома и дачи - ${d.category} - ${d.goodsSubType}`;

    const row1 = [categoryLine, "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""];
    const row2 = [
      "Уникальный идентификатор объявления", "Способ размещения", "Номер объявления на Авито",
      "Контактное лицо", "Номер телефона", "Название объявления", "Описание объявления",
      "Ссылки на фото", "Названия фото", "Способ связи", "Цена", "Категория",
      "Вид объявления", "Вид товара", "Целевая аудитория", "Включая НДС", "Адрес",
      "AvitoStatus", "Почта", "Название компании", "AvitoDateEnd",
    ];
    const row3 = [
      "Обязательный", "Необязательный", "Необязательный", "Необязательный", "Необязательный",
      "Обязательный", "Обязательный", "Обязательный", "Обязательный", "Необязательный",
      "Необязательный", "Обязательный", "Обязательный", "Обязательный", "Необязательный",
      "Необязательный", "Обязательный", "", "", "", "",
    ];
    const row4 = [
      "Текст", "Одно значение из выпадающего списка в ячейке", "Текст",
      "Текст", "Текст", "Текст до 50 символов", "Текст",
      "Ссылки через |", "Имена через |", "Одно значение из выпадающего списка в ячейке",
      "Целое число", "Одно значение из выпадающего списка в ячейке",
      "Одно значение из выпадающего списка в ячейке", "Одно значение из выпадающего списка в ячейке",
      "Одно значение из выпадающего списка в ячейке", "Одно значение из выпадающего списка в ячейке",
      "Текст", "", "", "", "",
    ];

    const productRows: any[][] = [];
    for (const fp of avitoFeed.feedProducts) {
      const product = storeProducts.find(p => p.id === fp.product_id);
      if (!product) continue;

      const params = fp.avito_params || {};
      const images = product.images || [];
      const imageUrls = images.join(" | ");
      const title = (params.title || product.name || "").substring(0, 50);
      const description = params.description || product.description || product.name || "";
      const price = params.price || product.pricePerUnit || 0;

      productRows.push([
        params.avitoId || product.id.substring(0, 10),
        params.listingFee || d.listingFee,
        params.avitoNumber || "",
        params.managerName || d.managerName,
        params.contactPhone || d.contactPhone,
        title, description, imageUrls, "",
        params.contactMethod || d.contactMethod,
        Math.round(price),
        params.category || d.category,
        params.goodsType || d.goodsType,
        params.goodsSubType || d.goodsSubType,
        params.targetAudience || d.targetAudience,
        params.includeVAT || "",
        params.address || d.address,
        params.avitoStatus || "Активно",
        params.email || d.email,
        params.companyName || d.companyName,
        params.dateEnd || "",
      ]);
    }

    const wsData = [row1, row2, row3, row4, ...productRows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [
      { wch: 30 }, { wch: 18 }, { wch: 22 }, { wch: 18 }, { wch: 16 },
      { wch: 50 }, { wch: 60 }, { wch: 60 }, { wch: 20 }, { wch: 28 },
      { wch: 10 }, { wch: 20 }, { wch: 25 }, { wch: 28 }, { wch: 25 },
      { wch: 14 }, { wch: 40 }, { wch: 14 }, { wch: 25 }, { wch: 22 }, { wch: 25 },
    ];
    // Enable text wrapping for description cells (column G, index 6) in product rows
    for (let r = 4; r < wsData.length; r++) {
      const cellRef = XLSX.utils.encode_cell({ r, c: 6 });
      if (ws[cellRef]) {
        if (!ws[cellRef].s) ws[cellRef].s = {};
        ws[cellRef].s.alignment = { wrapText: true, vertical: "top" };
      }
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, (d.goodsSubType || "Товары").substring(0, 31));
    const instrWs = XLSX.utils.aoa_to_sheet([
      ["Инструкция"], ["Этот файл создан для автозагрузки на Авито."],
      ["Загрузите его в разделе Автозагрузка → Загрузка файлом на avito.ru"],
      [""], ["Строки 1-4 — служебные, не изменяйте их."], ["Данные о товарах начинаются с 5 строки."],
    ]);
    XLSX.utils.book_append_sheet(wb, instrWs, "Инструкция");
    XLSX.writeFile(wb, `avito_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast({ title: `Экспортировано ${productRows.length} товар(ов)` });
  };

  const filteredItems = items.filter((item) =>
    !searchQuery || item.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "—";
    try { return new Date(dateStr).toLocaleDateString("ru", { day: "2-digit", month: "2-digit", year: "numeric" }); }
    catch { return "—"; }
  };
  const formatPrice = (price?: number) => price ? `${price.toLocaleString("ru")} ₽` : "—";
  const getAddress = (item: AvitoItem) => {
    if (!item.address) return "—";
    return [item.address.city, item.address.street, item.address.address].filter(Boolean).join(", ") || "—";
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const isConnected = account && account.avito_user_id;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Авито</h2>
          <p className="text-sm text-muted-foreground">Интеграция с Авито для управления объявлениями</p>
        </div>
        {isConnected && (
          <Badge variant="outline" className="gap-1 text-primary border-primary/30">
            <Check className="h-3 w-3" /> Подключено: {account.profile_name}
          </Badge>
        )}
      </div>

      {/* Connection form */}
      <Card className="p-4 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Link2 className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">Подключение к Авито API</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Получите Client ID и Client Secret на{" "}
          <a href="https://www.avito.ru/professionals/api" target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-0.5">
            avito.ru/professionals/api <ExternalLink className="h-3 w-3" />
          </a>
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="avito-client-id" className="text-xs">Client ID</Label>
            <Input id="avito-client-id" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="Введите Client ID" className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="avito-client-secret" className="text-xs">Client Secret</Label>
            <Input id="avito-client-secret" type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} placeholder="Введите Client Secret" className="h-9 text-sm" />
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleConnect} disabled={connecting || !clientId.trim() || !clientSecret.trim()}>
            {connecting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isConnected ? "Переподключить" : "Подключить"}
          </Button>
          {isConnected && (
            <Button size="sm" variant="outline" onClick={handleDisconnect} disabled={disconnecting} className="text-destructive hover:text-destructive">
              {disconnecting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <Unlink className="h-3.5 w-3.5" /> Отключить
            </Button>
          )}
        </div>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="feed">Товары для Авито ({avitoFeed?.feedProducts.length || 0})</TabsTrigger>
          {isConnected && <TabsTrigger value="active">Активные объявления</TabsTrigger>}
        </TabsList>

        {/* Feed Products Tab */}
        <TabsContent value="feed" className="space-y-3">

          {/* === DEFAULTS SETTINGS === */}
          <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
            <Card className="p-4">
              <CollapsibleTrigger className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">Настройки по умолчанию для Авито</span>
                </div>
                <Badge variant="secondary" className="text-[10px]">
                  {settingsOpen ? "Свернуть" : "Развернуть"}
                </Badge>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4 space-y-4">
                <p className="text-xs text-muted-foreground">Эти значения будут применены ко всем товарам при экспорте, если не указано иное для конкретного товара.</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Контактное лицо</Label>
                    <Input value={localDefaults.managerName} onChange={(e) => setLocalDefaults(p => ({ ...p, managerName: e.target.value }))} placeholder="Имя менеджера" className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Телефон</Label>
                    <Input value={localDefaults.contactPhone} onChange={(e) => setLocalDefaults(p => ({ ...p, contactPhone: e.target.value }))} placeholder="79001234567" className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Email</Label>
                    <Input value={localDefaults.email} onChange={(e) => setLocalDefaults(p => ({ ...p, email: e.target.value }))} placeholder="email@example.com" className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Название компании</Label>
                    <Input value={localDefaults.companyName} onChange={(e) => setLocalDefaults(p => ({ ...p, companyName: e.target.value }))} placeholder="ООО Компания" className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Адрес</Label>
                    <Input value={localDefaults.address} onChange={(e) => setLocalDefaults(p => ({ ...p, address: e.target.value }))} placeholder="Москва, ул. Примерная, 1" className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Способ связи</Label>
                    <Select value={localDefaults.contactMethod} onValueChange={(v) => setLocalDefaults(p => ({ ...p, contactMethod: v }))}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="По телефону и в сообщениях">По телефону и в сообщениях</SelectItem>
                        <SelectItem value="По телефону">По телефону</SelectItem>
                        <SelectItem value="В сообщениях">В сообщениях</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Категория Авито</Label>
                    <Input value={localDefaults.category} onChange={(e) => setLocalDefaults(p => ({ ...p, category: e.target.value }))} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Вид объявления</Label>
                    <Select value={localDefaults.goodsType} onValueChange={(v) => setLocalDefaults(p => ({ ...p, goodsType: v }))}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Товар от производителя">Товар от производителя</SelectItem>
                        <SelectItem value="Товар приобретен на продажу">Товар приобретен на продажу</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Вид товара</Label>
                    <Input value={localDefaults.goodsSubType} onChange={(e) => setLocalDefaults(p => ({ ...p, goodsSubType: e.target.value }))} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Способ размещения</Label>
                    <Select value={localDefaults.listingFee} onValueChange={(v) => setLocalDefaults(p => ({ ...p, listingFee: v }))}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Package">Package (Пакет)</SelectItem>
                        <SelectItem value="PackageSingle">PackageSingle</SelectItem>
                        <SelectItem value="Single">Single</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Целевая аудитория</Label>
                    <Select value={localDefaults.targetAudience} onValueChange={(v) => setLocalDefaults(p => ({ ...p, targetAudience: v }))}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Частные лица и бизнес">Частные лица и бизнес</SelectItem>
                        <SelectItem value="Частные лица">Частные лица</SelectItem>
                        <SelectItem value="Бизнес">Бизнес</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button size="sm" onClick={() => { avitoFeed?.saveDefaults(localDefaults); toast({ title: "Настройки сохранены" }); }}>
                  <Save className="h-3.5 w-3.5 mr-1" /> Сохранить настройки
                </Button>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Export & Feed URL */}
          {avitoFeed && avitoFeed.feedProducts.length > 0 && storeId && (
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Download className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">Экспорт для Авито</span>
                </div>
                <Button size="sm" onClick={handleExportExcel}>
                  <Download className="h-3.5 w-3.5 mr-1" />
                  Скачать Excel
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Скачайте файл и загрузите его на{" "}
                <a href="https://www.avito.ru/autoload/settings" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  Авито → Автозагрузка
                </a>{" "}(способ «Вручную»). Также доступна ссылка на XML-фид:
              </p>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={`https://${projectId}.supabase.co/functions/v1/avito-feed?store_id=${storeId}`}
                  className="h-8 text-xs font-mono"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <Button size="sm" variant="outline" onClick={() => {
                  navigator.clipboard.writeText(`https://${projectId}.supabase.co/functions/v1/avito-feed?store_id=${storeId}`);
                  toast({ title: "Ссылка скопирована" });
                }}>
                  Копировать
                </Button>
              </div>
            </Card>
          )}

          {/* Bulk actions bar */}
          {avitoFeed && avitoFeed.feedProducts.length > 0 && (
            <div className="flex items-center justify-between gap-2 flex-wrap">
              {selectedFeedProducts.size > 0 ? (
                <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-1.5 w-full">
                  <span className="text-sm font-medium">Выбрано: {selectedFeedProducts.size}</span>
                  <div className="flex gap-2 ml-auto">
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setAiPromptOpen(true)}>
                      <Sparkles className="h-3.5 w-3.5" /> AI описание
                    </Button>
                    <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={async () => {
                      await avitoFeed.removeProductsFromFeed(Array.from(selectedFeedProducts));
                      setSelectedFeedProducts(new Set());
                    }}>
                      <X className="h-3.5 w-3.5 mr-1" /> Убрать из фида
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedFeedProducts(new Set())}>Сбросить</Button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Нажмите на текст в ячейке, чтобы редактировать. Выберите товары для AI-генерации описаний.</p>
              )}
            </div>
          )}

          {/* Feed Products Inline Table */}
          {avitoFeed && avitoFeed.feedProducts.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <ScrollArea className="w-full">
                <div className="min-w-[1100px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-xs">
                        <TableHead className="w-10 px-2">
                          <Checkbox
                            checked={selectedFeedProducts.size === avitoFeed.feedProducts.length && avitoFeed.feedProducts.length > 0}
                            onCheckedChange={(checked) => {
                              if (checked) setSelectedFeedProducts(new Set(avitoFeed.feedProducts.map(fp => fp.product_id)));
                              else setSelectedFeedProducts(new Set());
                            }}
                          />
                        </TableHead>
                        <TableHead className="w-12 px-2">Фото</TableHead>
                        <TableHead className="min-w-[160px] px-2">Название для Авито</TableHead>
                        <TableHead className="min-w-[250px] px-2">Описание</TableHead>
                        <TableHead className="w-20 px-2">Цена</TableHead>
                        <TableHead className="w-28 px-2">Адрес</TableHead>
                        <TableHead className="w-14 px-2">Фото</TableHead>
                        <TableHead className="w-8 px-2"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {avitoFeed.feedProducts.map((fp) => {
                        const product = storeProducts.find(p => p.id === fp.product_id);
                        if (!product) return null;
                        const imageUrl = product.images?.[0] || product.image;
                        const params = fp.avito_params || {};
                        const isGenerating = aiGeneratingIds.has(fp.product_id);

                        return (
                          <TableRow key={fp.id} className="text-xs align-top">
                            <TableCell className="px-2 pt-3">
                              <Checkbox
                                checked={selectedFeedProducts.has(fp.product_id)}
                                onCheckedChange={() => {
                                  setSelectedFeedProducts(prev => {
                                    const next = new Set(prev);
                                    if (next.has(fp.product_id)) next.delete(fp.product_id);
                                    else next.add(fp.product_id);
                                    return next;
                                  });
                                }}
                              />
                            </TableCell>
                            <TableCell className="px-2 pt-2">
                              {imageUrl ? (
                                <img src={imageUrl} alt="" className="w-10 h-10 rounded object-cover" />
                              ) : (
                                <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                                  <Package className="h-4 w-4 text-muted-foreground" />
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="px-2">
                              <InlineCell
                                value={params.title || product.name}
                                onChange={(val) => handleInlineParamUpdate(fp.product_id, "title", val)}
                                placeholder={product.name}
                                maxLength={50}
                              />
                              <span className="text-[10px] text-muted-foreground/50 px-1.5">
                                {(params.title || product.name || "").length}/50
                              </span>
                            </TableCell>
                            <TableCell className="px-2">
                              {isGenerating ? (
                                <div className="flex items-center gap-1.5 py-2 text-xs text-muted-foreground">
                                  <Loader2 className="h-3 w-3 animate-spin" /> Генерация...
                                </div>
                              ) : (
                                <InlineCell
                                  value={params.description || product.description || ""}
                                  onChange={(val) => handleInlineParamUpdate(fp.product_id, "description", val)}
                                  placeholder="Описание для Авито"
                                  type="textarea"
                                />
                              )}
                            </TableCell>
                            <TableCell className="px-2">
                              <InlineCell
                                value={String(params.price || product.pricePerUnit || 0)}
                                onChange={(val) => handleInlineParamUpdate(fp.product_id, "price", val)}
                                placeholder="0"
                                type="number"
                              />
                            </TableCell>
                            <TableCell className="px-2">
                              <InlineCell
                                value={params.address || ""}
                                onChange={(val) => handleInlineParamUpdate(fp.product_id, "address", val)}
                                placeholder={localDefaults.address || "Адрес"}
                              />
                            </TableCell>
                            <TableCell className="px-2 pt-3 text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <ImageIcon className="h-3 w-3" />
                                {(product.images || []).length}
                              </div>
                            </TableCell>
                            <TableCell className="px-2 pt-2">
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => avitoFeed.removeProductFromFeed(fp.product_id)}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </ScrollArea>
            </div>
          ) : (
            <Card className="p-8 text-center">
              <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-1">Нет товаров для размещения на Авито</p>
              <p className="text-xs text-muted-foreground">Перейдите в раздел «Ассортимент», выберите товары и нажмите «В Авито»</p>
            </Card>
          )}
        </TabsContent>

        {/* Active Items Tab */}
        {isConnected && (
          <TabsContent value="active" className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">
                  Активные объявления {items.length > 0 && <span className="text-muted-foreground ml-1">({filteredItems.length})</span>}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {items.length > 0 && (
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="Поиск..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-8 text-xs pl-8 w-48" />
                  </div>
                )}
                <Button size="sm" variant="outline" onClick={handleFetchItems} disabled={fetching}>
                  {fetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Загрузить объявления
                </Button>
              </div>
            </div>
            {items.length > 0 ? (
              <div className="border rounded-lg overflow-hidden">
                <ScrollArea className="w-full">
                  <div className="min-w-[1100px]">
                    <Table>
                      <TableHeader>
                        <TableRow className="text-xs">
                          <TableHead className="w-10 px-2">№</TableHead>
                          <TableHead className="w-14 px-2">Фото</TableHead>
                          <TableHead className="min-w-[200px] px-2">Название</TableHead>
                          <TableHead className="w-24 px-2 text-right">Цена</TableHead>
                          <TableHead className="w-32 px-2">Категория</TableHead>
                          <TableHead className="w-40 px-2">Адрес</TableHead>
                          <TableHead className="w-20 px-2 text-center">Фото</TableHead>
                          <TableHead className="w-24 px-2">Статус</TableHead>
                          <TableHead className="w-24 px-2">Создано</TableHead>
                          <TableHead className="w-16 px-2 text-center">ID</TableHead>
                          <TableHead className="w-10 px-2"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredItems.map((item, index) => {
                          const imageUrl = item.images?.[0]?.["640x480"] || item.images?.[0]?.url || item.images?.[0]?.main?.url || null;
                          return (
                            <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleViewDetail(item)}>
                              <TableCell className="px-2 text-xs text-muted-foreground">{index + 1}</TableCell>
                              <TableCell className="px-2">
                                {imageUrl ? <img src={imageUrl} alt="" className="w-10 h-10 rounded object-cover" /> : (
                                  <div className="w-10 h-10 rounded bg-muted flex items-center justify-center"><Package className="h-4 w-4 text-muted-foreground" /></div>
                                )}
                              </TableCell>
                              <TableCell className="px-2"><div className="font-medium text-xs leading-tight line-clamp-2">{item.title}</div></TableCell>
                              <TableCell className="px-2 text-right font-medium text-xs">{formatPrice(item.price)}</TableCell>
                              <TableCell className="px-2"><span className="text-xs text-muted-foreground line-clamp-1">{item.category?.name || "—"}</span></TableCell>
                              <TableCell className="px-2"><span className="text-xs text-muted-foreground line-clamp-1">{getAddress(item)}</span></TableCell>
                              <TableCell className="px-2 text-center"><div className="flex items-center justify-center gap-1 text-xs text-muted-foreground"><ImageIcon className="h-3 w-3" />{item.images?.length || 0}</div></TableCell>
                              <TableCell className="px-2">
                                <Badge variant="secondary" className="text-[10px]">
                                  {item.status === "active" ? "Активно" : item.status === "old" ? "Завершено" : item.status === "blocked" ? "Заблокировано" : item.status === "removed" ? "Удалено" : item.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="px-2 text-xs text-muted-foreground">{formatDate(item.created)}</TableCell>
                              <TableCell className="px-2 text-xs text-muted-foreground text-center">{item.id}</TableCell>
                              <TableCell className="px-2">
                                {item.url && (
                                  <a href={item.url.startsWith("http") ? item.url : `https://www.avito.ru${item.url}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                                  </a>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </ScrollArea>
              </div>
            ) : (
              <Card className="p-8 text-center">
                <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Нажмите «Загрузить объявления», чтобы импортировать активные объявления с Авито</p>
              </Card>
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* AI Description Generation Dialog */}
      <Dialog open={aiPromptOpen} onOpenChange={setAiPromptOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              AI-генерация описаний для Авито
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Будет сгенерировано описание для {selectedFeedProducts.size} выбранных товаров. Опишите инструкцию — как именно AI должен писать описания.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">Инструкция для AI (промпт)</Label>
              <Textarea
                value={aiInstruction}
                onChange={(e) => setAiInstruction(e.target.value)}
                placeholder="Например: Пиши от лица оптового поставщика мясной продукции. Упоминай, что доставка по Москве и МО. В конце добавь: «Свежая продукция каждый день»."
                className="text-sm min-h-[120px]"
              />
              <p className="text-[10px] text-muted-foreground">Оставьте пустым для стандартного описания</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Максимум символов</Label>
              <Input type="number" value={aiMaxChars} onChange={(e) => setAiMaxChars(Number(e.target.value) || 500)} className="h-8 text-sm w-32" min={100} max={2000} />
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setAiPromptOpen(false)}>Отмена</Button>
              <Button size="sm" onClick={handleAiGenerate} disabled={aiGenerating}>
                {aiGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Wand2 className="h-3.5 w-3.5 mr-1" />}
                Сгенерировать
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Item Detail Dialog */}
      <Dialog open={!!detailDialogItem} onOpenChange={(open) => !open && setDetailDialogItem(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-base leading-tight pr-6">{detailDialogItem?.title}</DialogTitle></DialogHeader>
          {loadingDetail && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Загрузка деталей...</div>}
          {detailDialogItem && (
            <div className="space-y-4">
              {detailDialogItem.images && detailDialogItem.images.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Фотографии ({detailDialogItem.images.length})</Label>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {detailDialogItem.images.map((img: any, idx: number) => {
                      const imgUrl = img?.["640x480"] || img?.url || img?.main?.url;
                      return imgUrl ? <img key={idx} src={imgUrl} alt={`Фото ${idx + 1}`} className="w-24 h-24 rounded-lg object-cover flex-shrink-0 border" /> : null;
                    })}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div><Label className="text-xs font-medium text-muted-foreground">Цена</Label><p className="text-lg font-semibold">{formatPrice(detailDialogItem.price)}</p></div>
                <div><Label className="text-xs font-medium text-muted-foreground">Статус</Label><div className="mt-1"><Badge variant="secondary">{detailDialogItem.status === "active" ? "Активно" : detailDialogItem.status}</Badge></div></div>
              </div>
              <div><Label className="text-xs font-medium text-muted-foreground">Категория</Label><p className="text-sm">{detailDialogItem.category?.name || "—"}</p></div>
              <div><Label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> Адрес</Label><p className="text-sm">{getAddress(detailDialogItem)}</p></div>
              <div><Label className="text-xs font-medium text-muted-foreground">Описание</Label><div className="mt-1 p-3 bg-muted/50 rounded-lg text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">{detailDialogItem.body || detailDialogItem.description || "Нет описания"}</div></div>
              {detailDialogItem.params && detailDialogItem.params.length > 0 && (
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Параметры</Label>
                  <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1">
                    {detailDialogItem.params.map((param: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-xs py-1 border-b border-border/50">
                        <span className="text-muted-foreground">{param.title || param.name}:</span>
                        <span className="font-medium">{param.value || param.values?.join(", ") || "—"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-3 gap-4 pt-2 border-t">
                <div><Label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Создано</Label><p className="text-xs">{formatDate(detailDialogItem.created)}</p></div>
                <div><Label className="text-xs font-medium text-muted-foreground">Avito ID</Label><p className="text-xs">{detailDialogItem.id}</p></div>
                <div><Label className="text-xs font-medium text-muted-foreground">Ссылка</Label>
                  {detailDialogItem.url && <a href={detailDialogItem.url.startsWith("http") ? detailDialogItem.url : `https://www.avito.ru${detailDialogItem.url}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline flex items-center gap-0.5">Открыть на Авито <ExternalLink className="h-3 w-3" /></a>}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
