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
  ExternalLink, Loader2, Link2, Unlink, RefreshCw, Check, Package, Search, Filter,
  MapPin, Calendar, Eye, Image as ImageIcon, X, Download, Settings, Save, Sparkles, Wand2,
  Plus, Trash2, BookOpen, Clock,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Product } from "./types";
import { AvitoFeedProduct, AvitoDefaults } from "@/hooks/useAvitoFeedProducts";
import { StoreCategory } from "@/hooks/useStoreCategories";
import * as XLSX from "xlsx";
import JSZip from "jszip";
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
  storeCategories?: StoreCategory[];
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
        className={`cursor-text px-1.5 py-1 rounded hover:bg-muted/60 min-h-[28px] text-xs leading-tight truncate overflow-hidden ${className}`}
        onClick={() => setEditing(true)}
        title={value || placeholder || "—"}
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
// Avito Feed Table with resizable columns
const AVITO_COL_STORAGE_KEY = "avito_feed_col_widths";
const DEFAULT_COL_WIDTHS: Record<string, number> = { check: 36, photo: 48, title: 180, desc: 260, price: 80, storeCategory: 120, category: 130, goodsType: 130, adType: 130, promo: 100, promoManual: 140, cpcBid: 80, address: 120, avitoNumber: 100, managerName: 120, contactPhone: 110, email: 120, companyName: 120, imgs: 50, actions: 60 };

function AvitoFeedTable({
  feedProducts, storeProducts, storeCategories, selectedFeedProducts, setSelectedFeedProducts,
  aiGeneratingIds, aiDoneIds, aiQueuedIds, localDefaults, handleInlineParamUpdate, openAiForProducts, removeProductFromFeed,
  feedSearchQuery, feedPriceFilter,
}: {
  feedProducts: AvitoFeedProduct[];
  storeProducts: Product[];
  storeCategories: StoreCategory[];
  selectedFeedProducts: Set<string>;
  setSelectedFeedProducts: React.Dispatch<React.SetStateAction<Set<string>>>;
  aiGeneratingIds: Set<string>;
  aiDoneIds: Set<string>;
  aiQueuedIds: Set<string>;
  localDefaults: AvitoDefaults;
  handleInlineParamUpdate: (productId: string, key: string, value: string) => void;
  openAiForProducts: (ids: string[], mode?: string) => void;
  removeProductFromFeed: (id: string) => Promise<void>;
  feedSearchQuery: string;
  feedPriceFilter: string;
}) {
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem(AVITO_COL_STORAGE_KEY);
      return saved ? { ...DEFAULT_COL_WIDTHS, ...JSON.parse(saved) } : { ...DEFAULT_COL_WIDTHS };
    } catch { return { ...DEFAULT_COL_WIDTHS }; }
  });
  const resizingRef = useRef<{ col: string; startX: number; startW: number } | null>(null);

  const onMouseDown = (col: string, e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = { col, startX: e.clientX, startW: colWidths[col] };
    const onMouseMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = ev.clientX - resizingRef.current.startX;
      const newW = Math.max(30, resizingRef.current.startW + delta);
      setColWidths((prev) => {
        const next = { ...prev, [resizingRef.current!.col]: newW };
        localStorage.setItem(AVITO_COL_STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    };
    const onMouseUp = () => {
      resizingRef.current = null;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const ResizeHandle = ({ col }: { col: string }) => (
    <div
      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/30 z-10"
      onMouseDown={(e) => onMouseDown(col, e)}
    />
  );

  // Filter feed products
  const filteredFeedProducts = feedProducts.filter((fp) => {
    const product = storeProducts.find(p => p.id === fp.product_id);
    if (!product) return false;
    const params = fp.avito_params || {};
    const price = Number(params.price || params.Price || product.pricePerUnit || 0);
    
    // Price filter
    if (feedPriceFilter === "zero" && price !== 0) return false;
    if (feedPriceFilter === "nonzero" && price === 0) return false;
    
    // Search filter
    if (feedSearchQuery) {
      const q = feedSearchQuery.toLowerCase();
      const title = (params.title || product.name || "").toLowerCase();
      const desc = (params.description || product.description || "").toLowerCase();
      const sku = (product.sku || "").toLowerCase();
      if (!title.includes(q) && !desc.includes(q) && !sku.includes(q)) return false;
    }
    
    return true;
  });

  const totalWidth = Object.values(colWidths).reduce((a, b) => a + b, 0);

  // Build category name map
  const categoryMap = new Map(storeCategories.map(c => [c.id, c.name]));

  const cols = [
    { key: "check", label: "", resizable: false },
    { key: "photo", label: "Фото", resizable: false },
    { key: "title", label: "Название", resizable: true },
    { key: "desc", label: "Описание", resizable: true },
    { key: "price", label: "Цена", resizable: true },
    { key: "storeCategory", label: "Категория товара", resizable: true },
    { key: "category", label: "Категория Авито", resizable: true },
    { key: "adType", label: "Вид объявления", resizable: true },
    { key: "goodsType", label: "Вид товара", resizable: true },
    { key: "promo", label: "Promo", resizable: true },
    { key: "promoManual", label: "PromoManual", resizable: true },
    { key: "cpcBid", label: "Ставка CPC", resizable: true },
    { key: "address", label: "Адрес", resizable: true },
    { key: "avitoNumber", label: "№ на Авито", resizable: true },
    { key: "managerName", label: "Контактное лицо", resizable: true },
    { key: "contactPhone", label: "Телефон", resizable: true },
    { key: "email", label: "Почта", resizable: true },
    { key: "companyName", label: "Компания", resizable: true },
    { key: "imgs", label: "📷", resizable: false },
    { key: "actions", label: "", resizable: false },
  ];

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <div style={{ minWidth: totalWidth }}>
          {/* Header */}
          <div className="flex bg-muted/50 border-b text-xs font-medium text-muted-foreground select-none">
            {cols.map((col) => (
              <div
                key={col.key}
                className="relative px-2 py-2 flex-shrink-0 truncate"
                style={{ width: colWidths[col.key] }}
              >
                {col.key === "check" ? (
                  <Checkbox
                    checked={selectedFeedProducts.size === filteredFeedProducts.length && filteredFeedProducts.length > 0}
                    onCheckedChange={(checked) => {
                      if (checked) setSelectedFeedProducts(new Set(filteredFeedProducts.map(fp => fp.product_id)));
                      else setSelectedFeedProducts(new Set());
                    }}
                  />
                ) : col.label}
                {col.resizable && <ResizeHandle col={col.key} />}
              </div>
            ))}
          </div>
          {/* Body */}
          <div>
            {filteredFeedProducts.map((fp) => {
              const product = storeProducts.find(p => p.id === fp.product_id);
              if (!product) return null;
              const imageUrl = product.images?.[0] || product.image;
              const params = fp.avito_params || {};
              const isGenerating = aiGeneratingIds.has(fp.product_id);
              const isDone = aiDoneIds.has(fp.product_id);
              const isQueued = aiQueuedIds.has(fp.product_id);

              return (
                <div key={fp.id} className={`flex border-b text-xs hover:bg-muted/30 items-start transition-colors ${isDone ? 'bg-green-50 dark:bg-green-950/20' : isGenerating ? 'bg-yellow-50 dark:bg-yellow-950/20' : isQueued ? 'bg-muted/20' : ''}`}>
                  <div className="flex-shrink-0 px-2 pt-2.5" style={{ width: colWidths.check }}>
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
                  </div>
                  <div className="flex-shrink-0 px-1 py-1" style={{ width: colWidths.photo }}>
                    {imageUrl ? (
                      <img src={imageUrl} alt="" className="w-9 h-9 rounded object-cover" />
                    ) : (
                      <div className="w-9 h-9 rounded bg-muted flex items-center justify-center">
                        <Package className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0 px-1 overflow-hidden" style={{ width: colWidths.title }}>
                    <InlineCell
                      value={params.title || product.name}
                      onChange={(val) => handleInlineParamUpdate(fp.product_id, "title", val)}
                      placeholder={product.name}
                      maxLength={50}
                    />
                    <span className="text-[10px] text-muted-foreground/50 px-1.5">
                      {(params.title || product.name || "").length}/50
                    </span>
                  </div>
                  <div className="flex-shrink-0 px-1 overflow-hidden" style={{ width: colWidths.desc }}>
                    {isGenerating ? (
                      <div className="flex items-center gap-1.5 py-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin text-yellow-500" /> Генерация...
                      </div>
                    ) : isDone ? (
                      <div className="flex items-center gap-1.5 py-2 text-xs text-green-600">
                        <Check className="h-3 w-3" /> Готово
                      </div>
                    ) : isQueued ? (
                      <div className="flex items-center gap-1.5 py-2 text-xs text-muted-foreground/60">
                        <Clock className="h-3 w-3" /> В очереди...
                      </div>
                    ) : (
                      <InlineCell
                        value={params.description || product.description || ""}
                        onChange={(val) => handleInlineParamUpdate(fp.product_id, "description", val)}
                        placeholder="Описание для Авито"
                        type="textarea"
                      />
                    )}
                  </div>
                  <div className="flex-shrink-0 px-1 overflow-hidden" style={{ width: colWidths.price }}>
                    <InlineCell
                      value={String(params.price || params.Price || product.pricePerUnit || 0)}
                      onChange={(val) => handleInlineParamUpdate(fp.product_id, "price", val)}
                      placeholder="0"
                      type="number"
                    />
                  </div>
                  {/* Категория магазина (из прайс-листа) */}
                  <div className="flex-shrink-0 px-1 overflow-hidden" style={{ width: colWidths.storeCategory }}>
                    <div className="px-1.5 py-1 text-xs text-muted-foreground truncate" title={
                      (product.categories || []).map(cid => categoryMap.get(cid) || "").filter(Boolean).join(", ") || "—"
                    }>
                      {(product.categories || []).map(cid => categoryMap.get(cid) || "").filter(Boolean).join(", ") || "—"}
                    </div>
                  </div>
                  {/* Категория Авито */}
                  <div className="flex-shrink-0 px-1 overflow-hidden" style={{ width: colWidths.category }}>
                    <InlineCell
                      value={params.category || ""}
                      onChange={(val) => handleInlineParamUpdate(fp.product_id, "category", val)}
                      placeholder={localDefaults.category || "Категория"}
                    />
                  </div>
                  {/* Вид объявления (AdType/goodsType) */}
                  <div className="flex-shrink-0 px-1 overflow-hidden" style={{ width: colWidths.adType }}>
                    <InlineCell
                      value={params.goodsType || params.adType || ""}
                      onChange={(val) => handleInlineParamUpdate(fp.product_id, "goodsType", val)}
                      placeholder={localDefaults.goodsType || "Вид объявления"}
                    />
                  </div>
                  {/* Вид товара (GoodsType/goodsSubType) */}
                  <div className="flex-shrink-0 px-1 overflow-hidden" style={{ width: colWidths.goodsType }}>
                    <InlineCell
                      value={params.goodsSubType || params.GoodsType || ""}
                      onChange={(val) => handleInlineParamUpdate(fp.product_id, "goodsSubType", val)}
                      placeholder={localDefaults.goodsSubType || "Вид товара"}
                    />
                  </div>
                  {/* Promo */}
                  <div className="flex-shrink-0 px-1 overflow-hidden" style={{ width: colWidths.promo }}>
                    <InlineCell
                      value={params.promo || ""}
                      onChange={(val) => handleInlineParamUpdate(fp.product_id, "promo", val)}
                      placeholder={localDefaults.promo || "—"}
                    />
                  </div>
                  {/* Ставка CPC */}
                  <div className="flex-shrink-0 px-1 overflow-hidden" style={{ width: colWidths.cpcBid }}>
                    <InlineCell
                      value={params.cpcBid || ""}
                      onChange={(val) => handleInlineParamUpdate(fp.product_id, "cpcBid", val)}
                      placeholder="—"
                      type="number"
                    />
                  </div>
                  {/* PromoManualOptions - Город|цена|лимит */}
                  <div className="flex-shrink-0 px-1 overflow-hidden" style={{ width: colWidths.promoManual }}>
                    <InlineCell
                      value={(() => {
                        const region = params.promoRegion || "";
                        const price = params.promoPrice || "";
                        const limit = params.promoLimit || "";
                        if (region || price || limit) return [region, price, limit].filter(Boolean).join("|");
                        return "";
                      })()}
                      onChange={(val) => {
                        const parts = val.split("|").map(s => s.trim());
                        handleInlineParamUpdate(fp.product_id, "promoRegion", parts[0] || "");
                        handleInlineParamUpdate(fp.product_id, "promoPrice", parts[1] || "");
                        handleInlineParamUpdate(fp.product_id, "promoLimit", parts[2] || "");
                      }}
                      placeholder="Город|цена|лимит"
                    />
                  </div>
                  {/* Ставка CPC */}
                  <div className="flex-shrink-0 px-1 overflow-hidden" style={{ width: colWidths.cpcBid }}>
                    <InlineCell
                      value={params.cpcBid || ""}
                      onChange={(val) => handleInlineParamUpdate(fp.product_id, "cpcBid", val)}
                      placeholder="—"
                      type="number"
                    />
                  </div>
                  <div className="flex-shrink-0 px-1 overflow-hidden" style={{ width: colWidths.address }}>
                    <InlineCell
                      value={params.address || ""}
                      onChange={(val) => handleInlineParamUpdate(fp.product_id, "address", val)}
                      placeholder={localDefaults.address || "Адрес"}
                    />
                  </div>
                  {/* Номер объявления на Авито */}
                  <div className="flex-shrink-0 px-1 overflow-hidden" style={{ width: colWidths.avitoNumber }}>
                    <InlineCell
                      value={params.avitoNumber || ""}
                      onChange={(val) => handleInlineParamUpdate(fp.product_id, "avitoNumber", val)}
                      placeholder="—"
                    />
                  </div>
                  {/* Контактное лицо */}
                  <div className="flex-shrink-0 px-1 overflow-hidden" style={{ width: colWidths.managerName }}>
                    <InlineCell
                      value={params.managerName || ""}
                      onChange={(val) => handleInlineParamUpdate(fp.product_id, "managerName", val)}
                      placeholder={localDefaults.managerName || "—"}
                    />
                  </div>
                  {/* Телефон */}
                  <div className="flex-shrink-0 px-1 overflow-hidden" style={{ width: colWidths.contactPhone }}>
                    <InlineCell
                      value={params.contactPhone || ""}
                      onChange={(val) => handleInlineParamUpdate(fp.product_id, "contactPhone", val)}
                      placeholder={localDefaults.contactPhone || "—"}
                    />
                  </div>
                  {/* Почта */}
                  <div className="flex-shrink-0 px-1 overflow-hidden" style={{ width: colWidths.email }}>
                    <InlineCell
                      value={params.email || ""}
                      onChange={(val) => handleInlineParamUpdate(fp.product_id, "email", val)}
                      placeholder={localDefaults.email || "—"}
                    />
                  </div>
                  {/* Компания */}
                  <div className="flex-shrink-0 px-1 overflow-hidden" style={{ width: colWidths.companyName }}>
                    <InlineCell
                      value={params.companyName || ""}
                      onChange={(val) => handleInlineParamUpdate(fp.product_id, "companyName", val)}
                      placeholder={localDefaults.companyName || "—"}
                    />
                  </div>
                  <div className="flex-shrink-0 px-2 pt-2.5 text-muted-foreground" style={{ width: colWidths.imgs }}>
                    <div className="flex items-center gap-0.5">
                      <ImageIcon className="h-3 w-3" />
                      {(product.images || []).length}
                    </div>
                  </div>
                  <div className="flex-shrink-0 px-1 pt-1.5" style={{ width: colWidths.actions }}>
                    <div className="flex items-center gap-0">
                      <Button size="icon" variant="ghost" className="h-6 w-6" title="AI описание" onClick={() => openAiForProducts([fp.product_id])}>
                        <Wand2 className="h-3.5 w-3.5 text-primary" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeProductFromFeed(fp.product_id)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AvitoSection({ storeId, products: storeProducts = [], storeCategories = [], avitoFeed }: AvitoSectionProps) {
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
  const [feedSearchQuery, setFeedSearchQuery] = useState("");
  const [feedPriceFilter, setFeedPriceFilter] = useState("all");

  // AI generation state
  const [aiPromptOpen, setAiPromptOpen] = useState(false);
  const [aiMode, setAiMode] = useState<"description" | "title">("description");
  const [aiInstruction, setAiInstruction] = useState("");
  const [aiMaxChars, setAiMaxChars] = useState(500);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiGeneratingIds, setAiGeneratingIds] = useState<Set<string>>(new Set());
  const [aiDoneIds, setAiDoneIds] = useState<Set<string>>(new Set());
  const [aiQueuedIds, setAiQueuedIds] = useState<Set<string>>(new Set());
  const [aiProgress, setAiProgress] = useState({ done: 0, total: 0 });
  const [aiSingleProductId, setAiSingleProductId] = useState<string | null>(null);

  // Saved templates
  interface AiTemplate { id: string; name: string; instruction: string; maxChars: number; }
  const TEMPLATES_KEY = `avito_ai_templates_${storeId}`;
  const [savedTemplates, setSavedTemplates] = useState<AiTemplate[]>([]);
  const [newTemplateName, setNewTemplateName] = useState("");

  useEffect(() => {
    if (!storeId) return;
    try {
      const saved = localStorage.getItem(TEMPLATES_KEY);
      if (saved) setSavedTemplates(JSON.parse(saved));
    } catch {}
  }, [storeId]);

  const saveTemplate = () => {
    if (!newTemplateName.trim()) { toast({ title: "Введите название шаблона", variant: "destructive" }); return; }
    const tpl: AiTemplate = { id: Date.now().toString(), name: newTemplateName.trim(), instruction: aiInstruction, maxChars: aiMaxChars };
    const updated = [...savedTemplates, tpl];
    setSavedTemplates(updated);
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(updated));
    setNewTemplateName("");
    toast({ title: "Шаблон сохранён" });
  };

  const deleteTemplate = (id: string) => {
    const updated = savedTemplates.filter(t => t.id !== id);
    setSavedTemplates(updated);
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(updated));
  };

  const loadTemplate = (tpl: AiTemplate) => {
    setAiInstruction(tpl.instruction);
    setAiMaxChars(tpl.maxChars);
  };

  const openAiForProducts = (productIds: string[], mode: "description" | "title" = "description") => {
    setAiMode(mode);
    if (mode === "title") {
      setAiMaxChars(50);
    } else {
      setAiMaxChars(500);
    }
    if (productIds.length === 1) {
      setAiSingleProductId(productIds[0]);
    } else {
      setAiSingleProductId(null);
    }
    setAiPromptOpen(true);
  };

  // Local defaults form state
  const [localDefaults, setLocalDefaults] = useState<AvitoDefaults>(avitoFeed?.defaults || {
    managerName: "", contactPhone: "", email: "", companyName: "", address: "",
    category: "Продукты питания", goodsType: "Товар от производителя",
    goodsSubType: "Мясо, птица, субпродукты", contactMethod: "По телефону и в сообщениях",
    listingFee: "Package", targetAudience: "Частные лица и бизнес",
    promo: "", promoRegion: "", promoBudget: "", promoPrice: "", promoLimit: "", cpcBid: "",
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

  // === AI DESCRIPTION/TITLE GENERATION ===
  const handleAiGenerate = async () => {
    if (!avitoFeed) return;
    const targetIds = aiSingleProductId ? [aiSingleProductId] : Array.from(selectedFeedProducts);
    if (targetIds.length === 0) return;

    setAiGenerating(true);
    setAiDoneIds(new Set());
    setAiQueuedIds(new Set(targetIds));
    setAiGeneratingIds(new Set());
    setAiProgress({ done: 0, total: targetIds.length });

    const batchSize = 10;
    let totalUpdated = 0;

    try {
      for (let i = 0; i < targetIds.length; i += batchSize) {
        const batchIds = targetIds.slice(i, i + batchSize);
        
        // Mark current batch as generating
        setAiGeneratingIds(new Set(batchIds));
        setAiQueuedIds(prev => {
          const next = new Set(prev);
          batchIds.forEach(id => next.delete(id));
          return next;
        });

        const productsToGenerate = batchIds.map(pid => {
          const product = storeProducts.find(p => p.id === pid);
          return product ? { id: pid, name: product.name, description: product.description, price: product.pricePerUnit } : null;
        }).filter(Boolean);

        try {
          const { data, error } = await supabase.functions.invoke("ai-avito-description", {
            body: { products: productsToGenerate, instruction: aiInstruction, maxChars: aiMaxChars, mode: aiMode },
          });

          if (error) throw error;
          if (data?.error) throw new Error(data.error);

          const descriptions = data?.descriptions || {};

          for (const [pid, value] of Object.entries(descriptions)) {
            if (value && typeof value === "string") {
              const fp = avitoFeed.feedProducts.find(f => f.product_id === pid);
              const currentParams = fp?.avito_params || {};
              if (aiMode === "title") {
                await avitoFeed.updateProductParams(pid, { ...currentParams, title: value });
              } else {
                await avitoFeed.updateProductParams(pid, { ...currentParams, description: value });
              }
              totalUpdated++;
            }
          }
        } catch (batchErr: any) {
          console.error("AI batch error:", batchErr);
          // Continue with next batch even if one fails
        }

        // Mark batch as done
        setAiDoneIds(prev => {
          const next = new Set(prev);
          batchIds.forEach(id => next.add(id));
          return next;
        });
        setAiGeneratingIds(new Set());
        setAiProgress(prev => ({ ...prev, done: Math.min(i + batchSize, targetIds.length) }));
      }

      toast({ title: aiMode === "title" ? `Сокращено ${totalUpdated} названий` : `Сгенерировано ${totalUpdated} описаний` });
      setAiPromptOpen(false);
      setAiSingleProductId(null);
    } catch (err: any) {
      console.error("AI generation error:", err);
      toast({ title: "Ошибка генерации", description: err.message, variant: "destructive" });
    } finally {
      setAiGenerating(false);
      setAiGeneratingIds(new Set());
      setAiQueuedIds(new Set());
      // Keep aiDoneIds visible for a few seconds then clear
      setTimeout(() => setAiDoneIds(new Set()), 5000);
    }
  };

  // === EXCEL EXPORT (ZIP with images) ===
  const [exporting, setExporting] = useState(false);

  const handleExportExcel = async () => {
    if (!avitoFeed || avitoFeed.feedProducts.length === 0) {
      toast({ title: "Нет товаров для экспорта", variant: "destructive" }); return;
    }

    setExporting(true);
    try {
      const d = localDefaults;
      const categoryLine = `Для дома и дачи - ${d.category} - ${d.goodsSubType}`;

      const row1 = [categoryLine, "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""];
      const row2 = [
        "Уникальный идентификатор объявления", "Способ размещения", "Номер объявления на Авито",
        "Контактное лицо", "Номер телефона", "Название объявления", "Описание объявления",
        "Ссылки на фото", "Названия фото", "Способ связи", "Цена", "Категория",
        "Вид объявления", "Вид товара", "Целевая аудитория", "Включая НДС", "Адрес",
        "AvitoStatus", "Почта", "Название компании", "AvitoDateEnd",
        "Promo", "PromoManualOptions", "PromoAutoOptions",
      ];
      const row3 = [
        "Обязательный", "Необязательный", "Необязательный", "Необязательный", "Необязательный",
        "Обязательный", "Обязательный", "Необязательный", "Обязательный", "Необязательный",
        "Необязательный", "Обязательный", "Обязательный", "Обязательный", "Необязательный",
        "Необязательный", "Обязательный", "", "", "", "",
        "Необязательный", "Необязательный", "Необязательный",
      ];
      const row4 = [
        "Текст", "Одно значение из выпадающего списка в ячейке", "Текст",
        "Текст", "Текст", "Текст до 50 символов", "Текст",
        "Ссылки через |", "Имена через |", "Одно значение из выпадающего списка в ячейке",
        "Целое число", "Одно значение из выпадающего списка в ячейке",
        "Одно значение из выпадающего списка в ячейке", "Одно значение из выпадающего списка в ячейке",
        "Одно значение из выпадающего списка в ячейке", "Одно значение из выпадающего списка в ячейке",
        "Текст", "", "", "", "",
        "Одно значение из выпадающего списка в ячейке", "Текст", "Текст",
      ];

      const zip = new JSZip();
      const productRows: any[][] = [];
      let imageCounter = 0;

      for (const fp of avitoFeed.feedProducts) {
        const product = storeProducts.find(p => p.id === fp.product_id);
        if (!product) continue;

        const params = fp.avito_params || {};
        const images = product.images || [];
        const title = (params.title || product.name || "").substring(0, 50);
        const description = params.description || product.description || product.name || "";
        const price = params.price || product.pricePerUnit || 0;

        // Download images and add to ZIP — skip small/thumbnail images
        const imageNames: string[] = [];
        for (let i = 0; i < images.length; i++) {
          const imgUrl = images[i];
          if (!imgUrl || imgUrl.startsWith("data:")) continue;
          // Skip thumbnail URLs (common patterns for small sizes)
          if (/[_\-](thumb|small|xs|50x|100x|150x)/i.test(imgUrl)) continue;
          try {
            const ext = imgUrl.split('.').pop()?.split('?')[0]?.substring(0, 4) || "jpg";
            const fileName = `photo_${imageCounter + 1}.${ext}`;
            const response = await fetch(imgUrl);
            if (response.ok) {
              const blob = await response.blob();
              // Skip images smaller than 10KB (likely thumbnails)
              if (blob.size < 10240) continue;
              imageCounter++;
              zip.file(fileName, blob);
              imageNames.push(fileName);
            }
          } catch (e) {
            console.warn("Failed to download image:", imgUrl, e);
          }
        }

        productRows.push([
          params.avitoId || product.id.substring(0, 10),
          params.listingFee || d.listingFee,
          params.avitoNumber || "",
          params.managerName || d.managerName,
          params.contactPhone || d.contactPhone,
          title, description,
          "", // Ссылки на фото — пустые, т.к. загружаем файлом
          imageNames.join(" | "), // Названия фото
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
          // Promo columns
          (() => {
            const promo = params.promo || d.promo || "";
            return promo;
          })(),
          (() => {
            const promo = params.promo || d.promo || "";
            if (promo === "Manual") {
              const region = params.promoRegion || d.promoRegion || "";
              const promoPrice = params.promoPrice || d.promoPrice || "";
              const limit = params.promoLimit || d.promoLimit || "";
              return [region, promoPrice, limit].filter(Boolean).join(", ");
            }
            return "";
          })(),
          (() => {
            const promo = params.promo || d.promo || "";
            if (promo && promo.startsWith("Auto")) {
              const region = params.promoRegion || d.promoRegion || "";
              const budget = params.promoBudget || d.promoBudget || "";
              return [region, budget].filter(Boolean).join(", ");
            }
            return "";
          })(),
        ]);
      }

      const wsData = [row1, row2, row3, row4, ...productRows];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = [
        { wch: 30 }, { wch: 18 }, { wch: 22 }, { wch: 18 }, { wch: 16 },
        { wch: 50 }, { wch: 60 }, { wch: 60 }, { wch: 30 }, { wch: 28 },
        { wch: 10 }, { wch: 20 }, { wch: 25 }, { wch: 28 }, { wch: 25 },
        { wch: 14 }, { wch: 40 }, { wch: 14 }, { wch: 25 }, { wch: 22 }, { wch: 25 },
        { wch: 12 }, { wch: 30 }, { wch: 30 },
      ];
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
        ["Инструкция"],
        ["Этот файл создан для автозагрузки на Авито."],
        ["Фотографии находятся в этом же архиве — загрузите весь ZIP целиком."],
        ["Загрузите его в разделе Автозагрузка → Загрузка файлом на avito.ru"],
        [""], ["Строки 1-4 — служебные, не изменяйте их."], ["Данные о товарах начинаются с 5 строки."],
      ]);
      XLSX.utils.book_append_sheet(wb, instrWs, "Инструкция");

      // Add Excel to ZIP
      const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      zip.file(`avito_export.xlsx`, new Uint8Array(excelBuffer));

      // Generate and download ZIP
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `avito_export_${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);

      toast({ title: `Экспортировано ${productRows.length} товар(ов) с ${imageCounter} фото в ZIP-архив` });
    } catch (err: any) {
      console.error("Export error:", err);
      toast({ title: "Ошибка экспорта", description: err.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  // === EXCEL EXPORT (Excel only, no images) ===
  const [exportingExcel, setExportingExcel] = useState(false);

  const handleExportExcelOnly = async () => {
    if (!avitoFeed || avitoFeed.feedProducts.length === 0) {
      toast({ title: "Нет товаров для экспорта", variant: "destructive" });
      return;
    }

    setExportingExcel(true);
    try {
      const d = localDefaults;
      const categoryLine = `Для дома и дачи - ${d.category} - ${d.goodsSubType}`;

      const row1 = [categoryLine, "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""];
      const row2 = [
        "Уникальный идентификатор объявления", "Способ размещения", "Номер объявления на Авито",
        "Контактное лицо", "Номер телефона", "Название объявления", "Описание объявления",
        "Ссылки на фото", "Названия фото", "Способ связи", "Цена", "Категория",
        "Вид объявления", "Вид товара", "Целевая аудитория", "Включая НДС", "Адрес",
        "AvitoStatus", "Почта", "Название компании", "AvitoDateEnd",
        "Promo", "PromoManualOptions", "PromoAutoOptions",
      ];
      const row3 = [
        "Обязательный", "Необязательный", "Необязательный", "Необязательный", "Необязательный",
        "Обязательный", "Обязательный", "Необязательный", "Обязательный", "Необязательный",
        "Необязательный", "Обязательный", "Обязательный", "Обязательный", "Необязательный",
        "Необязательный", "Обязательный", "", "", "", "",
        "Необязательный", "Необязательный", "Необязательный",
      ];
      const row4 = [
        "Текст", "Одно значение из выпадающего списка в ячейке", "Текст",
        "Текст", "Текст", "Текст до 50 символов", "Текст",
        "Ссылки через |", "Имена через |", "Одно значение из выпадающего списка в ячейке",
        "Целое число", "Одно значение из выпадающего списка в ячейке",
        "Одно значение из выпадающего списка в ячейке", "Одно значение из выпадающего списка в ячейке",
        "Одно значение из выпадающего списка в ячейке", "Одно значение из выпадающего списка в ячейке",
        "Текст", "", "", "", "",
        "Одно значение из выпадающего списка в ячейке", "Текст", "Текст",
      ];

      const productRows: any[][] = [];

      for (const fp of avitoFeed.feedProducts) {
        const product = storeProducts.find(p => p.id === fp.product_id);
        if (!product) continue;

        const params = fp.avito_params || {};
        const title = (params.title || product.name || "").substring(0, 50);
        const description = params.description || product.description || product.name || "";
        const price = params.price || product.pricePerUnit || 0;

        productRows.push([
          params.avitoId || product.id.substring(0, 10),
          params.listingFee || d.listingFee,
          params.avitoNumber || "",
          params.managerName || d.managerName,
          params.contactPhone || d.contactPhone,
          title, description,
          "", // Ссылки на фото
          "", // Названия фото
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
          // Promo columns
          (() => {
            const promo = params.promo || d.promo || "";
            return promo;
          })(),
          (() => {
            const promo = params.promo || d.promo || "";
            if (promo === "Manual") {
              const region = params.promoRegion || d.promoRegion || "";
              const promoPrice = params.promoPrice || d.promoPrice || "";
              const limit = params.promoLimit || d.promoLimit || "";
              return [region, promoPrice, limit].filter(Boolean).join(", ");
            }
            return "";
          })(),
          (() => {
            const promo = params.promo || d.promo || "";
            if (promo && promo.startsWith("Auto")) {
              const region = params.promoRegion || d.promoRegion || "";
              const budget = params.promoBudget || d.promoBudget || "";
              return [region, budget].filter(Boolean).join(", ");
            }
            return "";
          })(),
        ]);
      }

      const wsData = [row1, row2, row3, row4, ...productRows];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = [
        { wch: 30 }, { wch: 18 }, { wch: 22 }, { wch: 18 }, { wch: 16 },
        { wch: 50 }, { wch: 60 }, { wch: 60 }, { wch: 30 }, { wch: 28 },
        { wch: 10 }, { wch: 20 }, { wch: 25 }, { wch: 28 }, { wch: 25 },
        { wch: 14 }, { wch: 40 }, { wch: 14 }, { wch: 25 }, { wch: 22 }, { wch: 25 },
        { wch: 12 }, { wch: 30 }, { wch: 30 },
      ];
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
        ["Инструкция"],
        ["Этот файл создан для автозагрузки на Авито."],
        ["Это только таблица данных — фото не включены."],
        ["Загрузите его в разделе Автозагрузка → Загрузка файлом на avito.ru"],
        [""], ["Строки 1-4 — служебные, не изменяйте их."], ["Данные о товарах начинаются с 5 строки."],
      ]);
      XLSX.utils.book_append_sheet(wb, instrWs, "Инструкция");

      const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const url = URL.createObjectURL(new Blob([new Uint8Array(excelBuffer)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `avito_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);

      toast({ title: `Экспортировано ${productRows.length} товар(ов) в Excel` });
    } catch (err: any) {
      console.error("Export error:", err);
      toast({ title: "Ошибка экспорта", description: err.message, variant: "destructive" });
    } finally {
      setExportingExcel(false);
    }
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

                {/* Promo settings */}
                <div className="pt-3 border-t space-y-3">
                  <Label className="text-xs font-medium">Настройка цены целевого действия (Promo)</Label>
                  <p className="text-[11px] text-muted-foreground">Оставьте пустым, если продвижение не нужно. Выберите режим и заполните параметры.</p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Режим продвижения (Promo)</Label>
                      <Select value={localDefaults.promo} onValueChange={(v) => setLocalDefaults(p => ({ ...p, promo: v }))}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Не использовать" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Не использовать</SelectItem>
                          <SelectItem value="Manual">Manual — ручной режим</SelectItem>
                          <SelectItem value="Auto_1">Auto_1 — авто, бюджет на 1 день</SelectItem>
                          <SelectItem value="Auto_7">Auto_7 — авто, бюджет на 7 дней</SelectItem>
                          <SelectItem value="Auto_30">Auto_30 — авто, бюджет на 30 дней</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Регион</Label>
                      <Input value={localDefaults.promoRegion} onChange={(e) => setLocalDefaults(p => ({ ...p, promoRegion: e.target.value }))} placeholder="Москва" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Бюджет (₽)</Label>
                      <Input value={localDefaults.promoBudget} onChange={(e) => setLocalDefaults(p => ({ ...p, promoBudget: e.target.value }))} placeholder="1000" className="h-8 text-sm" type="number" />
                    </div>
                    {localDefaults.promo === "Manual" && (
                      <>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Цена целевого действия (₽)</Label>
                          <Input value={localDefaults.promoPrice} onChange={(e) => setLocalDefaults(p => ({ ...p, promoPrice: e.target.value }))} placeholder="50" className="h-8 text-sm" type="number" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Лимит в день (₽)</Label>
                          <Input value={localDefaults.promoLimit} onChange={(e) => setLocalDefaults(p => ({ ...p, promoLimit: e.target.value }))} placeholder="500" className="h-8 text-sm" type="number" />
                        </div>
                      </>
                    )}
                  </div>
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
               <div className="flex items-center justify-between flex-wrap gap-3">
                 <div className="flex items-center gap-2">
                   <Download className="h-4 w-4 text-primary" />
                   <span className="font-medium text-sm">Экспорт для Авито</span>
                 </div>
                 <div className="flex items-center gap-2 flex-wrap">
                   <Button size="sm" onClick={handleExportExcelOnly} disabled={exportingExcel}>
                     {exportingExcel ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                     {exportingExcel ? "Подготовка..." : "Скачать Excel"}
                   </Button>
                   <Button size="sm" onClick={handleExportExcel} disabled={exporting}>
                     {exporting ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                     {exporting ? "Подготовка ZIP..." : "Скачать ZIP с фото"}
                   </Button>
                 </div>
               </div>
              <p className="text-xs text-muted-foreground">
                Скачайте ZIP-архив (Excel + фотографии) и загрузите его целиком на{" "}
                <a href="https://www.avito.ru/autoload/settings" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  Авито → Автозагрузка
                </a>{" "}(способ «Загрузка файлом»). Также доступна ссылка на XML-фид:
              </p>
              <div className="flex items-center gap-2">
                {(() => {
                  const urlStr = `https://${projectId}.supabase.co/functions/v1/avito-feed?store_id=${storeId}`;
                  return (
                    <>
                      <Input
                        readOnly
                        value={urlStr}
                        className="h-8 text-xs font-mono"
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                      />
                      <Button size="sm" variant="outline" onClick={() => {
                        navigator.clipboard.writeText(urlStr);
                        toast({ title: "Ссылка скопирована" });
                      }}>
                        Копировать
                      </Button>
                    </>
                  );
                })()}
              </div>
              <p className="text-xs text-muted-foreground">
                Настройки (адрес, категория, контакты) берутся автоматически из сохранённых параметров выше.
              </p>
            </Card>
          )}

          {/* Quick bulk-apply fields */}
          {avitoFeed && avitoFeed.feedProducts.length > 0 && (() => {
            const applyToTargets = async (applyFn: (targets: AvitoFeedProduct[]) => Promise<void>, onlySelected: boolean) => {
              const targets = onlySelected
                ? avitoFeed.feedProducts.filter(fp => selectedFeedProducts.has(fp.product_id))
                : avitoFeed.feedProducts;
              if (targets.length === 0) { toast({ title: "Нет товаров для обновления", variant: "destructive" }); return; }
              await applyFn(targets);
            };

            const BulkButtons = ({ onApply }: { onApply: (onlySelected: boolean) => void }) => (
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button size="sm" variant="outline" className="h-8 text-xs whitespace-nowrap" onClick={() => onApply(false)}>
                  <Check className="h-3.5 w-3.5 mr-1" /> Ко всем
                </Button>
                {selectedFeedProducts.size > 0 && (
                  <Button size="sm" variant="default" className="h-8 text-xs whitespace-nowrap" onClick={() => onApply(true)}>
                    <Check className="h-3.5 w-3.5 mr-1" /> К {selectedFeedProducts.size} выбр.
                  </Button>
                )}
              </div>
            );

            return (
            <Card className="p-3 space-y-2.5">
              <p className="text-xs font-medium text-muted-foreground">Массовая простановка значений {selectedFeedProducts.size > 0 && <Badge variant="secondary" className="ml-1 text-[10px]">Выбрано: {selectedFeedProducts.size}</Badge>}</p>
              
              {/* Address row */}
              <div className="flex items-center gap-2 flex-wrap">
                <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <Input
                  value={localDefaults.address}
                  onChange={(e) => setLocalDefaults(prev => ({ ...prev, address: e.target.value }))}
                  onBlur={() => avitoFeed.saveDefaults(localDefaults)}
                  placeholder="Адрес для всех товаров"
                  className="h-8 text-xs flex-1 min-w-[200px]"
                />
                <BulkButtons onApply={async (onlySelected) => {
                  if (!localDefaults.address) { toast({ title: "Введите адрес", variant: "destructive" }); return; }
                  await applyToTargets(async (targets) => {
                    for (const fp of targets) {
                      const params = { ...(fp.avito_params || {}), address: localDefaults.address };
                      await avitoFeed.updateProductParams(fp.product_id, params);
                    }
                    toast({ title: `Адрес проставлен для ${targets.length} товар(ов)` });
                  }, onlySelected);
                }} />
              </div>

              {/* Category row */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground w-[80px] flex-shrink-0">Категория</span>
                <Input
                  value={localDefaults.category}
                  onChange={(e) => setLocalDefaults(prev => ({ ...prev, category: e.target.value }))}
                  onBlur={() => avitoFeed.saveDefaults(localDefaults)}
                  placeholder="Продукты питания"
                  className="h-8 text-xs flex-1 min-w-[180px]"
                />
                <BulkButtons onApply={async (onlySelected) => {
                  if (!localDefaults.category) { toast({ title: "Введите категорию", variant: "destructive" }); return; }
                  await applyToTargets(async (targets) => {
                    for (const fp of targets) {
                      const params = { ...(fp.avito_params || {}), category: localDefaults.category };
                      await avitoFeed.updateProductParams(fp.product_id, params);
                    }
                    toast({ title: `Категория проставлена для ${targets.length} товар(ов)` });
                  }, onlySelected);
                }} />
              </div>

              {/* Ad type (goodsType) row */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground w-[80px] flex-shrink-0">Вид объявл.</span>
                <Select value={localDefaults.goodsType} onValueChange={(v) => { setLocalDefaults(prev => ({ ...prev, goodsType: v })); }}>
                  <SelectTrigger className="h-8 text-xs flex-1 min-w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Товар от производителя">Товар от производителя</SelectItem>
                    <SelectItem value="Товар приобретен на продажу">Товар приобретен на продажу</SelectItem>
                  </SelectContent>
                </Select>
                <BulkButtons onApply={async (onlySelected) => {
                  await applyToTargets(async (targets) => {
                    for (const fp of targets) {
                      const params = { ...(fp.avito_params || {}), goodsType: localDefaults.goodsType };
                      await avitoFeed.updateProductParams(fp.product_id, params);
                    }
                    avitoFeed.saveDefaults(localDefaults);
                    toast({ title: `Вид объявления проставлен для ${targets.length} товар(ов)` });
                  }, onlySelected);
                }} />
              </div>

              {/* Goods sub-type row */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground w-[80px] flex-shrink-0">Вид товара</span>
                <Input
                  value={localDefaults.goodsSubType}
                  onChange={(e) => setLocalDefaults(prev => ({ ...prev, goodsSubType: e.target.value }))}
                  onBlur={() => avitoFeed.saveDefaults(localDefaults)}
                  placeholder="Мясо, птица, субпродукты"
                  className="h-8 text-xs flex-1 min-w-[180px]"
                />
                <BulkButtons onApply={async (onlySelected) => {
                  if (!localDefaults.goodsSubType) { toast({ title: "Введите вид товара", variant: "destructive" }); return; }
                  await applyToTargets(async (targets) => {
                    for (const fp of targets) {
                      const params = { ...(fp.avito_params || {}), goodsSubType: localDefaults.goodsSubType };
                      await avitoFeed.updateProductParams(fp.product_id, params);
                    }
                    toast({ title: `Вид товара проставлен для ${targets.length} товар(ов)` });
                  }, onlySelected);
                }} />
              </div>

              {/* Promo row */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground w-[80px] flex-shrink-0">Promo</span>
                <Select value={localDefaults.promo} onValueChange={(v) => { setLocalDefaults(prev => ({ ...prev, promo: v })); }}>
                  <SelectTrigger className="h-8 text-xs flex-1 min-w-[180px]"><SelectValue placeholder="Не использовать" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Не использовать</SelectItem>
                    <SelectItem value="Manual">Manual — ручной</SelectItem>
                    <SelectItem value="Auto_1">Auto_1 — 1 день</SelectItem>
                    <SelectItem value="Auto_7">Auto_7 — 7 дней</SelectItem>
                    <SelectItem value="Auto_30">Auto_30 — 30 дней</SelectItem>
                  </SelectContent>
                </Select>
                <BulkButtons onApply={async (onlySelected) => {
                  const promoVal = localDefaults.promo === "none" ? "" : localDefaults.promo;
                  await applyToTargets(async (targets) => {
                    for (const fp of targets) {
                      const params = { ...(fp.avito_params || {}) };
                      if (promoVal) {
                        params.promo = promoVal;
                        if (localDefaults.promoRegion) params.promoRegion = localDefaults.promoRegion;
                        if (localDefaults.promoBudget) params.promoBudget = localDefaults.promoBudget;
                        if (localDefaults.promoPrice) params.promoPrice = localDefaults.promoPrice;
                        if (localDefaults.promoLimit) params.promoLimit = localDefaults.promoLimit;
                      } else {
                        delete params.promo;
                        delete params.promoRegion;
                        delete params.promoBudget;
                        delete params.promoPrice;
                        delete params.promoLimit;
                      }
                      await avitoFeed.updateProductParams(fp.product_id, params);
                    }
                    avitoFeed.saveDefaults(localDefaults);
                    toast({ title: promoVal ? `Promo проставлен для ${targets.length} товар(ов)` : `Promo убран у ${targets.length} товар(ов)` });
                  }, onlySelected);
                }} />
              </div>

              {/* CPC Bid row */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground w-[80px] flex-shrink-0">Ставка CPC</span>
                <Input
                  className="h-8 text-xs flex-1 min-w-[120px] max-w-[200px]"
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="Ставка за клик (₽)"
                  value={localDefaults.cpcBid || ""}
                  onChange={(e) => setLocalDefaults(prev => ({ ...prev, cpcBid: e.target.value }))}
                />
                <BulkButtons onApply={async (onlySelected) => {
                  const val = localDefaults.cpcBid || "";
                  await applyToTargets(async (targets) => {
                    for (const fp of targets) {
                      const params = { ...(fp.avito_params || {}) };
                      if (val) {
                        params.cpcBid = val;
                      } else {
                        delete params.cpcBid;
                      }
                      await avitoFeed.updateProductParams(fp.product_id, params);
                    }
                    avitoFeed.saveDefaults(localDefaults);
                    toast({ title: val ? `Ставка CPC ${val}₽ проставлена для ${targets.length} товар(ов)` : `Ставка CPC убрана у ${targets.length} товар(ов)` });
                  }, onlySelected);
                }} />
              </div>

              {/* Contact person row */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground w-[80px] flex-shrink-0">Конт. лицо</span>
                <Input
                  className="h-8 text-xs flex-1 min-w-[180px]"
                  placeholder="Имя менеджера"
                  value={localDefaults.managerName || ""}
                  onChange={(e) => setLocalDefaults(prev => ({ ...prev, managerName: e.target.value }))}
                />
                <BulkButtons onApply={async (onlySelected) => {
                  if (!localDefaults.managerName) { toast({ title: "Введите контактное лицо", variant: "destructive" }); return; }
                  await applyToTargets(async (targets) => {
                    for (const fp of targets) {
                      const params = { ...(fp.avito_params || {}), managerName: localDefaults.managerName };
                      await avitoFeed.updateProductParams(fp.product_id, params);
                    }
                    avitoFeed.saveDefaults(localDefaults);
                    toast({ title: `Контактное лицо проставлено для ${targets.length} товар(ов)` });
                  }, onlySelected);
                }} />
              </div>

              {/* Phone row */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground w-[80px] flex-shrink-0">Телефон</span>
                <Input
                  className="h-8 text-xs flex-1 min-w-[180px]"
                  placeholder="79001234567"
                  value={localDefaults.contactPhone || ""}
                  onChange={(e) => setLocalDefaults(prev => ({ ...prev, contactPhone: e.target.value }))}
                />
                <BulkButtons onApply={async (onlySelected) => {
                  if (!localDefaults.contactPhone) { toast({ title: "Введите телефон", variant: "destructive" }); return; }
                  await applyToTargets(async (targets) => {
                    for (const fp of targets) {
                      const params = { ...(fp.avito_params || {}), contactPhone: localDefaults.contactPhone };
                      await avitoFeed.updateProductParams(fp.product_id, params);
                    }
                    avitoFeed.saveDefaults(localDefaults);
                    toast({ title: `Телефон проставлен для ${targets.length} товар(ов)` });
                  }, onlySelected);
                }} />
              </div>

              {/* Email row */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground w-[80px] flex-shrink-0">Почта</span>
                <Input
                  className="h-8 text-xs flex-1 min-w-[180px]"
                  placeholder="email@example.com"
                  value={localDefaults.email || ""}
                  onChange={(e) => setLocalDefaults(prev => ({ ...prev, email: e.target.value }))}
                />
                <BulkButtons onApply={async (onlySelected) => {
                  if (!localDefaults.email) { toast({ title: "Введите email", variant: "destructive" }); return; }
                  await applyToTargets(async (targets) => {
                    for (const fp of targets) {
                      const params = { ...(fp.avito_params || {}), email: localDefaults.email };
                      await avitoFeed.updateProductParams(fp.product_id, params);
                    }
                    avitoFeed.saveDefaults(localDefaults);
                    toast({ title: `Почта проставлена для ${targets.length} товар(ов)` });
                  }, onlySelected);
                }} />
              </div>

              {/* Company name row */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground w-[80px] flex-shrink-0">Компания</span>
                <Input
                  className="h-8 text-xs flex-1 min-w-[180px]"
                  placeholder="ООО Компания"
                  value={localDefaults.companyName || ""}
                  onChange={(e) => setLocalDefaults(prev => ({ ...prev, companyName: e.target.value }))}
                />
                <BulkButtons onApply={async (onlySelected) => {
                  if (!localDefaults.companyName) { toast({ title: "Введите название компании", variant: "destructive" }); return; }
                  await applyToTargets(async (targets) => {
                    for (const fp of targets) {
                      const params = { ...(fp.avito_params || {}), companyName: localDefaults.companyName };
                      await avitoFeed.updateProductParams(fp.product_id, params);
                    }
                    avitoFeed.saveDefaults(localDefaults);
                    toast({ title: `Компания проставлена для ${targets.length} товар(ов)` });
                  }, onlySelected);
                }} />
              </div>

              {/* Target audience row */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground w-[80px] flex-shrink-0">Аудитория</span>
                <Select value={localDefaults.targetAudience} onValueChange={(v) => { setLocalDefaults(prev => ({ ...prev, targetAudience: v })); }}>
                  <SelectTrigger className="h-8 text-xs flex-1 min-w-[180px]"><SelectValue placeholder="Частные лица и бизнес" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Частные лица и бизнес">Частные лица и бизнес</SelectItem>
                    <SelectItem value="Частные лица">Частные лица</SelectItem>
                    <SelectItem value="Бизнес">Бизнес</SelectItem>
                  </SelectContent>
                </Select>
                <BulkButtons onApply={async (onlySelected) => {
                  await applyToTargets(async (targets) => {
                    for (const fp of targets) {
                      const params = { ...(fp.avito_params || {}), targetAudience: localDefaults.targetAudience };
                      await avitoFeed.updateProductParams(fp.product_id, params);
                    }
                    avitoFeed.saveDefaults(localDefaults);
                    toast({ title: `Аудитория проставлена для ${targets.length} товар(ов)` });
                  }, onlySelected);
                }} />
              </div>
            </Card>
            );
          })()}

          {/* Filter bar */}
          {avitoFeed && avitoFeed.feedProducts.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[180px] max-w-xs">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Поиск по названию, описанию, артикулу..."
                  value={feedSearchQuery}
                  onChange={(e) => setFeedSearchQuery(e.target.value)}
                  className="h-8 text-xs pl-8"
                />
              </div>
              <Select value={feedPriceFilter} onValueChange={setFeedPriceFilter}>
                <SelectTrigger className="h-8 text-xs w-[160px]">
                  <SelectValue placeholder="Цена" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все цены</SelectItem>
                  <SelectItem value="zero">Цена = 0</SelectItem>
                  <SelectItem value="nonzero">Цена &gt; 0</SelectItem>
                </SelectContent>
              </Select>
              {(feedSearchQuery || feedPriceFilter !== "all") && (
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setFeedSearchQuery(""); setFeedPriceFilter("all"); }}>
                  <X className="h-3.5 w-3.5 mr-1" /> Сбросить фильтры
                </Button>
              )}
            </div>
          )}

          {/* Bulk actions bar */}
          {avitoFeed && avitoFeed.feedProducts.length > 0 && (
            <div className="flex items-center justify-between gap-2 flex-wrap">
              {selectedFeedProducts.size > 0 ? (
                <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-1.5 w-full">
                  <span className="text-sm font-medium">Выбрано: {selectedFeedProducts.size}</span>
                  <div className="flex gap-2 ml-auto">
                     <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => openAiForProducts(Array.from(selectedFeedProducts), "title")}>
                       <Wand2 className="h-3.5 w-3.5" /> AI название
                     </Button>
                     <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => openAiForProducts(Array.from(selectedFeedProducts), "description")}>
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
            <AvitoFeedTable
              feedProducts={avitoFeed.feedProducts}
              storeProducts={storeProducts}
              storeCategories={storeCategories}
              selectedFeedProducts={selectedFeedProducts}
              setSelectedFeedProducts={setSelectedFeedProducts}
              aiGeneratingIds={aiGeneratingIds}
              aiDoneIds={aiDoneIds}
              aiQueuedIds={aiQueuedIds}
              localDefaults={localDefaults}
              handleInlineParamUpdate={handleInlineParamUpdate}
              openAiForProducts={openAiForProducts}
              removeProductFromFeed={avitoFeed.removeProductFromFeed}
              feedSearchQuery={feedSearchQuery}
              feedPriceFilter={feedPriceFilter}
            />
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

      {/* AI Generation Sheet */}
      <Sheet open={aiPromptOpen} onOpenChange={(open) => { setAiPromptOpen(open); if (!open) setAiSingleProductId(null); }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-base flex items-center gap-2">
              {aiMode === "title" ? <Wand2 className="h-4 w-4 text-primary" /> : <Sparkles className="h-4 w-4 text-primary" />}
              {aiMode === "title" ? "AI-сокращение названий" : "AI-генерация описаний"}
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-5 mt-4">
            {/* Target info */}
            <p className="text-xs text-muted-foreground">
              {aiSingleProductId ? (
                <>Генерация для: <span className="font-medium text-foreground">{storeProducts.find(p => p.id === aiSingleProductId)?.name || "товар"}</span></>
              ) : (
                <>Будет сгенерировано для {selectedFeedProducts.size} выбранных товаров</>
              )}
            </p>

            {/* Saved templates */}
            {savedTemplates.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5" /> Сохранённые шаблоны
                </Label>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {savedTemplates.map((tpl) => (
                    <div key={tpl.id} className="flex items-center gap-2 p-2 rounded-md border bg-muted/30 hover:bg-muted/60 transition-colors group">
                      <button
                        className="flex-1 text-left text-xs font-medium truncate"
                        onClick={() => loadTemplate(tpl)}
                        title={tpl.instruction || "Стандартное описание"}
                      >
                        {tpl.name}
                      </button>
                      <span className="text-[10px] text-muted-foreground shrink-0">{tpl.maxChars} сим.</span>
                      <Button
                        size="icon" variant="ghost"
                        className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        onClick={() => deleteTemplate(tpl.id)}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Prompt */}
            <div className="space-y-1.5">
              <Label className="text-xs">
                {aiMode === "title" ? "Инструкция для сокращения названий" : "Инструкция для AI (промпт)"}
              </Label>
              <Textarea
                value={aiInstruction}
                onChange={(e) => setAiInstruction(e.target.value)}
                placeholder={aiMode === "title" 
                  ? "Например: Сохраняй бренд и вес. Убирай слова на латинице если есть русский аналог."
                  : "Например: Пиши от лица оптового поставщика мясной продукции. Упоминай, что доставка по Москве и МО."
                }
                className="text-sm min-h-[120px]"
              />
              <p className="text-[10px] text-muted-foreground">
                {aiMode === "title" ? "Оставьте пустым для стандартного сокращения" : "Оставьте пустым для стандартного описания"}
              </p>
            </div>

            {/* Max chars */}
            <div className="space-y-1.5">
              <Label className="text-xs">
                {aiMode === "title" ? "Максимум символов в названии" : "Максимум символов"}
              </Label>
              <Input type="number" value={aiMaxChars} onChange={(e) => setAiMaxChars(Number(e.target.value) || (aiMode === "title" ? 50 : 500))} className="h-8 text-sm w-32" min={10} max={2000} />
              {aiMode === "title" && <p className="text-[10px] text-muted-foreground">Авито рекомендует до 50 символов</p>}
            </div>

            {/* Save template */}
            <div className="space-y-1.5">
              <Label className="text-xs">Сохранить как шаблон</Label>
              <div className="flex gap-2">
                <Input
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="Название шаблона"
                  className="h-8 text-sm"
                  onKeyDown={(e) => { if (e.key === "Enter") saveTemplate(); }}
                />
                <Button size="sm" variant="outline" onClick={saveTemplate} className="h-8 shrink-0">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Сохранить
                </Button>
              </div>
            </div>

            {/* Progress */}
            {aiGenerating && aiProgress.total > 0 && (
              <div className="pt-2 border-t space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Прогресс генерации</span>
                  <span>{aiProgress.done} / {aiProgress.total}</span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${(aiProgress.done / aiProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2 border-t">
              <Button className="flex-1" onClick={handleAiGenerate} disabled={aiGenerating}>
                {aiGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Wand2 className="h-3.5 w-3.5 mr-1" />}
                {aiGenerating ? `${aiProgress.done}/${aiProgress.total}...` : (aiMode === "title" ? "Сократить названия" : "Сгенерировать")}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

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
