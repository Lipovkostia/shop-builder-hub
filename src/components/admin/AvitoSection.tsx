import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
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
  Plus, Trash2, BookOpen, Clock, ImagePlus, AlertCircle, AlertTriangle, Upload, Folder, Inbox,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Product } from "./types";
import { AvitoImageEditor } from "./AvitoImageEditor";
import { AvitoFeedProduct, AvitoDefaults } from "@/hooks/useAvitoFeedProducts";
import { AvitoCityTabsBar } from "./AvitoCityTabsBar";
import { StoreCategory } from "@/hooks/useStoreCategories";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import { AvitoAiDescriptionWorkspace } from "./AvitoAiDescriptionWorkspace";
import { AvitoCategoryCombobox } from "./AvitoCategoryCombobox";
import { AvitoListingVariantsManager } from "./AvitoListingVariantsManager";
import { AvitoGroupsSidebar, AvitoGroupBadge } from "./AvitoGroupsSidebar";
import { AvitoSheetsPanel } from "./AvitoSheetsPanel";
import { AvitoPhotosPanel } from "./AvitoPhotosPanel";
import { useAvitoProductGroups, AvitoProductGroup, colorClass } from "@/hooks/useAvitoProductGroups";
import { Copy as CopyIcon } from "lucide-react";

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
  onOpenInPhotoStudio?: (productId: string) => void;
  onOpenInPriceList?: (productId: string) => void;
  autoOpenImageEditorForProductId?: string | null;
  onAutoOpenImageEditorHandled?: () => void;
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
    assignGroup?: (productIds: string[], groupId: string | null) => Promise<void>;
    refetch: () => Promise<void>;
  };
  cityTabs?: {
    tabs: any[];
    activeTab: any;
    activeTabId: string | null;
    setActiveTabId: (id: string) => void;
    createTab: (input: any) => Promise<any>;
    updateTab: (id: string, patch: any) => Promise<void>;
    deleteTab: (id: string) => Promise<void>;
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
const DEFAULT_COL_WIDTHS: Record<string, number> = { check: 36, group: 90, photo: 48, title: 180, desc: 260, price: 80, storeCategory: 120, category: 130, goodsType: 130, adType: 130, promo: 100, promoManual: 140, promoAuto: 140, cpcBid: 80, address: 120, avitoId: 110, avitoNumber: 100, managerName: 120, contactPhone: 110, email: 120, companyName: 120, imgs: 50, actions: 60 };

// Column classification: "export" = goes into Avito XLSX/ZIP, "internal" = only for filtering/grouping
type ColKind = "export" | "internal" | "system";
const COL_KIND: Record<string, ColKind> = {
  check: "system", photo: "system", imgs: "system", actions: "system",
  group: "internal", storeCategory: "internal",
  title: "export", desc: "export", price: "export", category: "export",
  adType: "export", goodsType: "export", promo: "export", promoManual: "export",
  promoAuto: "export", cpcBid: "export", address: "export", avitoId: "export",
  avitoNumber: "export", managerName: "export", contactPhone: "export",
  email: "export", companyName: "export",
};

// === Avito validation: detect missing/invalid fields per feed product ===
// === Avito validation: detect missing/invalid fields per feed product ===
export type AvitoIssueKind =
  | "title_missing" | "title_too_long"
  | "description_missing" | "description_too_short"
  | "price_missing"
  | "images_missing"
  | "category_missing" | "goodsType_missing" | "goodsSubType_missing"
  | "address_missing" | "targetAudience_missing"
  | "contactPhone_missing" | "managerName_missing"
  | "avito_moderation"
  | "not_published";

export interface AvitoIssue { kind: AvitoIssueKind; label: string; severity: "error" | "warning"; aiFixable: boolean; }

export function computeAvitoIssues(fp: AvitoFeedProduct, product: Product, d: AvitoDefaults): AvitoIssue[] {
  const p = fp.avito_params || {};
  const issues: AvitoIssue[] = [];
  const title = (p.title || product.name || "").trim();
  const description = (p.description || product.description || "").trim();
  const price = Number(p.Price) || Number(p.price) || Number(product.pricePerUnit) || 0;
  const imgs = (p.avitoImages && p.avitoImages.length > 0)
    ? p.avitoImages
    : (product.images || []).filter((u: string) => u && !u.startsWith("data:"));

  if (!title) issues.push({ kind: "title_missing", label: "Нет названия", severity: "error", aiFixable: true });
  else if (title.length > 50) issues.push({ kind: "title_too_long", label: `Название > 50 символов (${title.length})`, severity: "error", aiFixable: true });

  if (!description) issues.push({ kind: "description_missing", label: "Нет описания", severity: "error", aiFixable: true });
  else if (description.length < 30) issues.push({ kind: "description_too_short", label: `Слишком короткое описание (${description.length})`, severity: "warning", aiFixable: true });

  if (!price || price <= 0) issues.push({ kind: "price_missing", label: "Цена не указана", severity: "error", aiFixable: false });
  if (imgs.length === 0) issues.push({ kind: "images_missing", label: "Нет фото", severity: "error", aiFixable: false });

  if (!(p.category || d.category)) issues.push({ kind: "category_missing", label: "Нет категории Авито", severity: "error", aiFixable: false });
  if (!(p.goodsType || d.goodsType)) issues.push({ kind: "goodsType_missing", label: "Не указан вид объявления", severity: "error", aiFixable: false });
  if (!(p.goodsSubType || d.goodsSubType)) issues.push({ kind: "goodsSubType_missing", label: "Не указан вид товара", severity: "error", aiFixable: false });
  if (!(p.address || d.address)) issues.push({ kind: "address_missing", label: "Не указан адрес", severity: "error", aiFixable: false });
  if (!(p.targetAudience || d.targetAudience)) issues.push({ kind: "targetAudience_missing", label: "Не указана аудитория", severity: "warning", aiFixable: false });
  if (!(p.contactPhone || d.contactPhone)) issues.push({ kind: "contactPhone_missing", label: "Нет телефона", severity: "error", aiFixable: false });
  if (!(p.managerName || d.managerName)) issues.push({ kind: "managerName_missing", label: "Нет контактного лица", severity: "warning", aiFixable: false });

  // Moderation errors pulled from Avito autoload reports
  const mod = p.moderation;
  if (mod) {
    if (mod.published === false) {
      issues.push({
        kind: "not_published",
        label: mod.status ? `Не опубликовано: ${mod.status}` : "Не опубликовано на Авито",
        severity: "warning",
        aiFixable: false,
      });
    }
    if (Array.isArray(mod.messages)) {
      for (const m of mod.messages) {
        if (!m?.text) continue;
        const sev: "error" | "warning" = /warn|warning|info/i.test(String(m.type || "")) ? "warning" : "error";
        issues.push({
          kind: "avito_moderation",
          label: `Авито: ${m.text}`,
          severity: sev,
          aiFixable: false,
        });
      }
    }
  }

  return issues;
}




// Column filter dropdown component - uses fixed positioning to escape overflow containers
function ColumnFilterDropdown({ values, selected, onSelect, colKey }: {
  values: string[];
  selected: string;
  onSelect: (val: string) => void;
  colKey: string;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className={`ml-1 p-0.5 rounded hover:bg-primary/10 ${selected ? "text-primary" : "text-muted-foreground/50"}`}
        title="Фильтр"
      >
        <Filter className="h-3 w-3" />
      </button>
      {open && createPortal(
        <div
          ref={dropdownRef}
          className="fixed bg-popover border border-border rounded-md shadow-lg min-w-[180px] max-h-[280px] overflow-y-auto text-xs"
          style={{ top: pos.top, left: pos.left, zIndex: 9999 }}
        >
          <button
            className={`w-full text-left px-3 py-1.5 hover:bg-muted/60 ${!selected ? "font-semibold text-primary" : ""}`}
            onClick={() => { onSelect(""); setOpen(false); }}
          >
            Все
          </button>
          <button
            className={`w-full text-left px-3 py-1.5 hover:bg-muted/60 ${selected === "__empty__" ? "font-semibold text-primary" : ""}`}
            onClick={() => { onSelect("__empty__"); setOpen(false); }}
          >
            <span className="text-muted-foreground italic">Пустые</span>
          </button>
          {values.map((v) => (
            <button
              key={v}
              className={`w-full text-left px-3 py-1.5 hover:bg-muted/60 truncate ${selected === v ? "font-semibold text-primary" : ""}`}
              onClick={() => { onSelect(v); setOpen(false); }}
            >
              {v}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}

function AvitoFeedTable({
  feedProducts, storeProducts, storeCategories, selectedFeedProducts, setSelectedFeedProducts,
  aiGeneratingIds, aiDoneIds, aiQueuedIds, localDefaults, handleInlineParamUpdate, openAiForProducts, removeProductFromFeed,
  feedSearchQuery, feedPriceFilter, storeId, onUpdateProductParams, onOpenInPhotoStudio, onOpenInPriceList,
  autoOpenImageEditorForProductId, onAutoOpenImageEditorHandled,
  groups, onAssignGroup, onCreateGroup, hideInternal,
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
  storeId: string;
  onUpdateProductParams: (productId: string, params: any) => Promise<void>;
  onOpenInPhotoStudio?: (productId: string) => void;
  onOpenInPriceList?: (productId: string) => void;
  autoOpenImageEditorForProductId?: string | null;
  onAutoOpenImageEditorHandled?: () => void;
  groups: import("@/hooks/useAvitoProductGroups").AvitoProductGroup[];
  onAssignGroup: (productIds: string[], groupId: string | null) => Promise<void>;
  onCreateGroup: (name: string, color?: string) => Promise<import("@/hooks/useAvitoProductGroups").AvitoProductGroup | null>;
  hideInternal: boolean;
}) {
  const { toast } = useToast();
  const [editingImageProduct, setEditingImageProduct] = useState<{ id: string; name: string; images: string[] } | null>(null);
  const [variantsManagerProductId, setVariantsManagerProductId] = useState<string | null>(null);

  // Auto-open image editor when navigated from another section (e.g. AI Photo → Avito)
  useEffect(() => {
    if (!autoOpenImageEditorForProductId) return;
    const product = storeProducts.find((p) => p.id === autoOpenImageEditorForProductId);
    if (!product) return;
    setEditingImageProduct({ id: product.id, name: product.name, images: product.images || [] });
    onAutoOpenImageEditorHandled?.();
  }, [autoOpenImageEditorForProductId, storeProducts, onAutoOpenImageEditorHandled]);



  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem(AVITO_COL_STORAGE_KEY);
      return saved ? { ...DEFAULT_COL_WIDTHS, ...JSON.parse(saved) } : { ...DEFAULT_COL_WIDTHS };
    } catch { return { ...DEFAULT_COL_WIDTHS }; }
  });
  const resizingRef = useRef<{ col: string; startX: number; startW: number } | null>(null);

  // Column filters state
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  // Sorting state
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const setFilter = (col: string, val: string) => {
    setColumnFilters(prev => {
      const next = { ...prev };
      if (val) next[col] = val;
      else delete next[col];
      return next;
    });
  };

  const activeFilterCount = Object.keys(columnFilters).length;

  const handleSort = (colKey: string) => {
    setSortConfig(prev => {
      if (!prev || prev.key !== colKey) return { key: colKey, direction: 'asc' };
      if (prev.direction === 'asc') return { key: colKey, direction: 'desc' };
      return null;
    });
  };

  const SortIndicator = ({ colKey }: { colKey: string }) => {
    if (!sortConfig || sortConfig.key !== colKey) return <span className="ml-1 text-muted-foreground/30">↕</span>;
    return sortConfig.direction === 'asc' 
      ? <span className="ml-1 text-primary">↑</span> 
      : <span className="ml-1 text-primary">↓</span>;
  };

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

  // Build category name map
  const categoryMap = new Map(storeCategories.map(c => [c.id, c.name]));

  // Helper: get column value for a feed product
  // Helper: get column value for a feed product
  const getColValue = (fp: AvitoFeedProduct, product: Product, colKey: string): string => {
    const params = fp.avito_params || {};
    switch (colKey) {
      case "storeCategory":
        return (product.categories || []).map(cid => categoryMap.get(cid) || "").filter(Boolean).join(", ");
      case "category": return params.category || "";
      case "adType": return params.goodsType || params.adType || "";
      case "goodsType": return params.goodsSubType || params.GoodsType || "";
      case "promo": return params.promo || "";
      case "promoAuto": return params.promoAutoOptions || "";
      case "address": return params.address || "";
      case "avitoId": return params.avitoId || product.id.substring(0, 10);
      case "managerName": return params.managerName || "";
      case "contactPhone": return params.contactPhone || "";
      case "email": return params.email || "";
      case "companyName": return params.companyName || "";
      default: return "";
    }
  };

  // Filterable columns
  const filterableCols = ["storeCategory", "category", "adType", "goodsType", "promo", "address", "managerName", "contactPhone", "email", "companyName"];
  // Sortable columns
  const sortableCols = ["title", "price", "storeCategory", "category"];

  // Pre-filter: search + price
  const preFiltered = feedProducts.filter((fp) => {
    const product = storeProducts.find(p => p.id === fp.product_id);
    if (!product) return false;
    const params = fp.avito_params || {};
    const price = Number(params.Price) || Number(params.price) || Number(product.pricePerUnit) || 0;
    if (feedPriceFilter === "zero" && price !== 0) return false;
    if (feedPriceFilter === "nonzero" && price === 0) return false;
    if (feedSearchQuery) {
      const q = feedSearchQuery.toLowerCase().replace(/^#/, "");
      const title = (params.title || product.name || "").toLowerCase();
      const desc = (params.description || product.description || "").toLowerCase();
      const sku = (product.sku || "").toLowerCase();
      const shortId = String(fp.product_id || "").slice(0, 8).toLowerCase();
      if (!title.includes(q) && !desc.includes(q) && !sku.includes(q) && !shortId.includes(q)) return false;
    }
    return true;
  });

  // Collect unique values for filterable columns (from preFiltered set)
  const uniqueValues = useMemo(() => {
    const result: Record<string, string[]> = {};
    for (const col of filterableCols) {
      const valSet = new Set<string>();
      for (const fp of preFiltered) {
        const product = storeProducts.find(p => p.id === fp.product_id);
        if (!product) continue;
        const v = getColValue(fp, product, col);
        if (v) valSet.add(v);
      }
      result[col] = Array.from(valSet).sort((a, b) => a.localeCompare(b, "ru"));
    }
    return result;
  }, [preFiltered, storeProducts, storeCategories]);

  // Apply column filters + sorting
  const filteredFeedProducts = useMemo(() => {
    let result = preFiltered.filter((fp) => {
      const product = storeProducts.find(p => p.id === fp.product_id);
      if (!product) return false;
      for (const [col, filterVal] of Object.entries(columnFilters)) {
        const cellVal = getColValue(fp, product, col);
        if (filterVal === "__empty__") {
          if (cellVal) return false;
        } else {
          if (cellVal !== filterVal) return false;
        }
      }
      return true;
    });

    if (sortConfig) {
      result = [...result].sort((a, b) => {
        const productA = storeProducts.find(p => p.id === a.product_id);
        const productB = storeProducts.find(p => p.id === b.product_id);
        if (!productA || !productB) return 0;
        const paramsA = a.avito_params || {};
        const paramsB = b.avito_params || {};
        let valA = "";
        let valB = "";
        switch (sortConfig.key) {
          case "title":
            valA = (paramsA.title || productA.name || "").toLowerCase();
            valB = (paramsB.title || productB.name || "").toLowerCase();
            break;
          case "price": {
            const numA = Number(paramsA.Price) || Number(paramsA.price) || Number(productA.pricePerUnit) || 0;
            const numB = Number(paramsB.Price) || Number(paramsB.price) || Number(productB.pricePerUnit) || 0;
            return sortConfig.direction === 'asc' ? numA - numB : numB - numA;
          }
          case "storeCategory":
            valA = (productA.categories || []).map(cid => categoryMap.get(cid) || "").filter(Boolean).join(", ").toLowerCase();
            valB = (productB.categories || []).map(cid => categoryMap.get(cid) || "").filter(Boolean).join(", ").toLowerCase();
            break;
          case "category":
            valA = (paramsA.category || "").toLowerCase();
            valB = (paramsB.category || "").toLowerCase();
            break;
          default:
            return 0;
        }
        const cmp = valA.localeCompare(valB, 'ru');
        return sortConfig.direction === 'asc' ? cmp : -cmp;
      });
    }

    return result;
  }, [preFiltered, storeProducts, columnFilters, sortConfig, categoryMap]);
  const totalWidth = Object.values(colWidths).reduce((a, b) => a + b, 0);

  const allCols = [
    { key: "check", label: "", resizable: false },
    { key: "group", label: "Группа", resizable: true },
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
    { key: "promoAuto", label: "PromoAuto", resizable: true },
    { key: "cpcBid", label: "Ставка CPC", resizable: true },
    { key: "address", label: "Адрес", resizable: true },
    { key: "avitoId", label: "ID из файла", resizable: true },
    { key: "avitoNumber", label: "№ на Авито", resizable: true },
    { key: "managerName", label: "Контактное лицо", resizable: true },
    { key: "contactPhone", label: "Телефон", resizable: true },
    { key: "email", label: "Почта", resizable: true },
    { key: "companyName", label: "Компания", resizable: true },
    { key: "imgs", label: "📷", resizable: false },
    { key: "actions", label: "", resizable: false },
  ];
  const cols = hideInternal ? allCols.filter(c => COL_KIND[c.key] !== "internal") : allCols;
  const visibleColKeys = new Set(cols.map(c => c.key));

  // Header background tint by column kind
  const headerKindBg = (k: string): string => {
    const kind = COL_KIND[k];
    if (kind === "export") return "bg-emerald-50 dark:bg-emerald-950/30";
    if (kind === "internal") return "bg-amber-50 dark:bg-amber-950/30";
    return "bg-muted/50";
  };
  const cellKindBg = (k: string): string => {
    const kind = COL_KIND[k];
    if (kind === "internal") return "bg-amber-50/40 dark:bg-amber-950/10";
    return "";
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Color legend: export vs internal columns */}
      <div className="flex items-center gap-3 px-3 py-1.5 bg-background border-b text-[11px] flex-wrap">
        <span className="text-muted-foreground font-medium">Колонки:</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-3.5 rounded bg-emerald-200 dark:bg-emerald-900 border border-emerald-300 dark:border-emerald-800" />
          <span>идут в выгрузку Авито</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-3.5 rounded bg-amber-200 dark:bg-amber-900 border border-amber-300 dark:border-amber-800" />
          <span>только для вашей фильтрации (не в выгрузке)</span>
        </span>
      </div>
      {/* Active filters bar */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/30 border-b text-xs flex-wrap">
          <span className="text-muted-foreground">Фильтры:</span>
          {Object.entries(columnFilters).map(([col, val]) => {
            const colDef = cols.find(c => c.key === col);
            return (
              <Badge key={col} variant="secondary" className="text-xs gap-1 py-0.5">
                {colDef?.label}: {val === "__empty__" ? "Пустые" : val}
                <button onClick={() => setFilter(col, "")} className="ml-0.5 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
          <Button variant="ghost" size="sm" className="h-5 text-xs px-2" onClick={() => setColumnFilters({})}>
            Сбросить все
          </Button>
        </div>
      )}
      <div className="overflow-x-auto">
        <div style={{ minWidth: totalWidth }}>
          {/* Header */}
          <div className="flex border-b text-xs font-medium text-muted-foreground select-none">
            {cols.map((col) => (
              <div
                key={col.key}
                className={`relative px-2 py-2 flex-shrink-0 truncate flex items-center ${headerKindBg(col.key)}`}
                style={{ width: colWidths[col.key] }}
                title={
                  COL_KIND[col.key] === "export"
                    ? "Это поле уходит в выгрузку Авито"
                    : COL_KIND[col.key] === "internal"
                      ? "Внутреннее поле — в выгрузку не попадает"
                      : undefined
                }
              >
                {col.key === "check" ? (
                  <Checkbox
                    checked={selectedFeedProducts.size === filteredFeedProducts.length && filteredFeedProducts.length > 0}
                    onCheckedChange={(checked) => {
                      if (checked) setSelectedFeedProducts(new Set(filteredFeedProducts.map(fp => fp.product_id)));
                      else setSelectedFeedProducts(new Set());
                    }}
                  />
                ) : (
                  <>
                    {sortableCols.includes(col.key) ? (
                      <button
                        className="truncate flex items-center hover:text-foreground transition-colors"
                        onClick={() => handleSort(col.key)}
                      >
                        <span className="truncate">{col.label}</span>
                        {sortConfig?.key === col.key ? (
                          sortConfig.direction === 'asc' 
                            ? <span className="ml-1 text-primary">↑</span> 
                            : <span className="ml-1 text-primary">↓</span>
                        ) : (
                          <span className="ml-1 text-muted-foreground/30">↕</span>
                        )}
                      </button>
                    ) : (
                      <span className="truncate">{col.label}</span>
                    )}
                    {filterableCols.includes(col.key) && (
                      <ColumnFilterDropdown
                        values={uniqueValues[col.key] || []}
                        selected={columnFilters[col.key] || ""}
                        onSelect={(val) => setFilter(col.key, val)}
                        colKey={col.key}
                      />
                    )}
                  </>
                )}
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
              const shortId = String(fp.product_id || "").slice(0, 8);
              const modMessages: any[] = Array.isArray(params.moderation?.messages) ? params.moderation.messages : [];
              const hasModError = modMessages.some((m) => !/warn|warning|info/i.test(String(m?.type || "")));
              const hasModWarning = modMessages.length > 0 && !hasModError;
              const excluded = params.excluded_from_feed === true;
              const modStatus: string | undefined = params.moderation?.status;
              const notPublished = params.moderation?.published === false;

              const rowBg = excluded
                ? "bg-muted/40 opacity-60"
                : hasModError
                  ? "bg-destructive/5 border-l-2 border-l-destructive"
                  : notPublished
                    ? "bg-amber-500/10 border-l-2 border-l-amber-500"
                    : hasModWarning
                      ? "bg-amber-500/5 border-l-2 border-l-amber-500"
                      : isDone ? 'bg-green-50 dark:bg-green-950/20'
                        : isGenerating ? 'bg-yellow-50 dark:bg-yellow-950/20'
                          : isQueued ? 'bg-muted/20' : '';

              return (
                <div key={fp.id} className={`flex border-b text-xs hover:bg-muted/30 items-start transition-colors ${rowBg}`}>
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
                  {visibleColKeys.has("group") && (
                    <div className={`flex-shrink-0 px-1 pt-1.5 ${cellKindBg("group")}`} style={{ width: colWidths.group }}>
                      <AvitoGroupBadge
                        currentGroupId={fp.group_id}
                        groups={groups}
                        onChange={(gid) => onAssignGroup([fp.product_id], gid)}
                        onCreateGroup={onCreateGroup}
                      />
                    </div>
                  )}
                  <div className="flex-shrink-0 px-1 py-1 cursor-pointer" style={{ width: colWidths.photo }} onClick={() => setEditingImageProduct({ id: product.id, name: product.name, images: product.images || [] })}>
                    {imageUrl ? (
                      <img src={imageUrl} alt="" className="w-9 h-9 rounded object-cover hover:ring-2 hover:ring-primary transition-all" />
                    ) : (
                      <div className="w-9 h-9 rounded bg-muted flex items-center justify-center hover:ring-2 hover:ring-primary transition-all">
                        <Package className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0 px-1 overflow-hidden" style={{ width: colWidths.title }}>
                    <div className="flex items-center gap-1 px-1.5 pt-0.5">
                      <button
                        type="button"
                        title="ID объявления (клик — скопировать)"
                        onClick={() => { navigator.clipboard?.writeText(shortId); toast({ title: "ID скопирован", description: shortId }); }}
                        className={`font-mono text-[10px] px-1 py-0 rounded ${hasModError ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground hover:text-foreground"}`}
                      >
                        #{shortId}
                      </button>
                      {excluded && <span className="text-[9px] px-1 rounded bg-muted text-muted-foreground">не выгр.</span>}
                      {hasModError && <span className="text-[9px] px-1 rounded bg-destructive/15 text-destructive">ошибка</span>}
                      {!hasModError && hasModWarning && <span className="text-[9px] px-1 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400">предупр.</span>}
                      {notPublished && <span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-700 dark:text-amber-400 font-medium" title={modStatus || "Не опубликовано на Авито"}>не опубл.{modStatus ? `: ${modStatus}` : ""}</span>}
                    </div>
                    <InlineCell
                      value={params.title || product.name}
                      onChange={(val) => handleInlineParamUpdate(fp.product_id, "title", val)}
                      placeholder={product.name}
                      maxLength={50}
                    />
                    <span className="text-[10px] text-muted-foreground/50 px-1.5">
                      {(params.title || product.name || "").length}/50
                    </span>
                    {modMessages.length > 0 && (
                      <div className="px-1.5 pt-1 space-y-0.5">
                        {modMessages.slice(0, 3).map((m: any, i: number) => (
                          <div key={i} className="text-[10px] leading-tight">
                            <div className={hasModError ? "text-destructive font-medium" : "text-amber-700 dark:text-amber-400"}>• {m.text}</div>
                            {m.hint && <div className="text-muted-foreground italic">{m.hint}</div>}
                          </div>
                        ))}
                        {modMessages.length > 3 && (
                          <div className="text-[10px] text-muted-foreground">+ ещё {modMessages.length - 3}</div>
                        )}
                      </div>
                    )}
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
                      value={String(Number(params.Price) || Number(params.price) || Number(product.pricePerUnit) || 0)}
                      onChange={(val) => handleInlineParamUpdate(fp.product_id, "Price", val)}
                      placeholder="0"
                      type="number"
                    />
                  </div>
                  {/* Категория магазина (из прайс-листа) — внутренняя */}
                  {visibleColKeys.has("storeCategory") && (
                    <div className={`flex-shrink-0 px-1 overflow-hidden ${cellKindBg("storeCategory")}`} style={{ width: colWidths.storeCategory }}>
                      <div className="px-1.5 py-1 text-xs text-muted-foreground truncate" title={
                        (product.categories || []).map(cid => categoryMap.get(cid) || "").filter(Boolean).join(", ") || "—"
                      }>
                        {(product.categories || []).map(cid => categoryMap.get(cid) || "").filter(Boolean).join(", ") || "—"}
                      </div>
                    </div>
                  )}
                  {/* Категория Авито */}
                  <div className="flex-shrink-0 px-1 overflow-hidden" style={{ width: colWidths.category }}>
                    <AvitoCategoryCombobox
                      compact
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
                   {/* PromoManualOptions - Город|цена|лимит (многострочное) */}
                  <div className="flex-shrink-0 px-1 overflow-hidden" style={{ width: colWidths.promoManual }}>
                    <InlineCell
                      value={params.promoManualOptions || ""}
                      onChange={(val) => handleInlineParamUpdate(fp.product_id, "promoManualOptions", val)}
                      placeholder="Город|цена|лимит"
                      type="textarea"
                    />
                   </div>
                   {/* PromoAutoOptions - Город|Бюджет (многострочное) */}
                  <div className="flex-shrink-0 px-1 overflow-hidden" style={{ width: colWidths.promoAuto }}>
                    <InlineCell
                      value={params.promoAutoOptions || ""}
                      onChange={(val) => handleInlineParamUpdate(fp.product_id, "promoAutoOptions", val)}
                      placeholder="Город|Бюджет"
                      type="textarea"
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
                   {/* ID из файла */}
                   <div className="flex-shrink-0 px-1 overflow-hidden" style={{ width: colWidths.avitoId }}>
                     <InlineCell
                       value={params.avitoId || product.id.substring(0, 10)}
                       onChange={(val) => handleInlineParamUpdate(fp.product_id, "avitoId", val)}
                       placeholder="—"
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
                      {onOpenInPhotoStudio && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          title="Открыть в AI Фото"
                          onClick={() => onOpenInPhotoStudio(fp.product_id)}
                        >
                          <ImagePlus className="h-3.5 w-3.5 text-emerald-600" />
                        </Button>
                      )}
                      {onOpenInPriceList && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          title="Открыть в прайс-листе"
                          onClick={() => onOpenInPriceList(fp.product_id)}
                        >
                          <ExternalLink className="h-3.5 w-3.5 text-sky-600" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        title="Дубли объявления для Авито"
                        onClick={() => setVariantsManagerProductId(fp.product_id)}
                      >
                        <CopyIcon className="h-3.5 w-3.5 text-amber-600" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        title={excluded ? "Включить в автозалив" : "Отключить от автозалива"}
                        onClick={() => {
                          const newParams = { ...(fp.avito_params || {}), excluded_from_feed: !excluded };
                          onUpdateProductParams(fp.product_id, newParams);
                        }}
                      >
                        {excluded
                          ? <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                          : <AlertCircle className={`h-3.5 w-3.5 ${hasModError ? "text-destructive" : "text-muted-foreground"}`} />}
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

      {/* Avito Image Editor Dialog */}
      {editingImageProduct && (
        <AvitoImageEditor
          open={!!editingImageProduct}
          onOpenChange={(open) => { if (!open) setEditingImageProduct(null); }}
          productId={editingImageProduct.id}
          productName={editingImageProduct.name}
          images={editingImageProduct.images}
          storeId={storeId}
          avitoImages={(() => {
            const fp = feedProducts.find(f => f.product_id === editingImageProduct.id);
            const params = fp?.avito_params || {};
            return params.avitoImages || undefined;
          })()}
          onSave={async (selectedImages) => {
            const fp = feedProducts.find(f => f.product_id === editingImageProduct.id);
            const currentParams = fp?.avito_params || {};
            const newParams = { ...currentParams, avitoImages: selectedImages };
            onUpdateProductParams(editingImageProduct.id, newParams);
            setEditingImageProduct(null);
          }}
          onImagesAdded={(newUrls) => {
            setEditingImageProduct(prev => prev ? {
              ...prev,
              images: [...(prev.images || []), ...newUrls],
            } : null);
          }}
        />
      )}

      {variantsManagerProductId && (() => {
        const p = storeProducts.find(sp => sp.id === variantsManagerProductId);
        const sourceProduct = p
          ? { id: p.id, name: p.name, description: p.description, price: p.pricePerUnit, images: p.images || [] }
          : null;
        return (
          <AvitoListingVariantsManager
            open={!!variantsManagerProductId}
            onOpenChange={(open) => { if (!open) setVariantsManagerProductId(null); }}
            storeId={storeId}
            product={sourceProduct}
          />
        );
      })()}
    </div>
  );
}

export function AvitoSection({ storeId, products: storeProducts = [], storeCategories = [], avitoFeed, cityTabs, onOpenInPhotoStudio, onOpenInPriceList, autoOpenImageEditorForProductId, onAutoOpenImageEditorHandled }: AvitoSectionProps) {
  const { toast } = useToast();
  const [account, setAccount] = useState<AvitoAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [fetchingErrors, setFetchingErrors] = useState(false);
  const [importingErrors, setImportingErrors] = useState(false);
  const errorsFileInputRef = useRef<HTMLInputElement>(null);

  const [disconnecting, setDisconnecting] = useState(false);

  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");

  const [items, setItems] = useState<AvitoItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [detailDialogItem, setDetailDialogItem] = useState<AvitoItem | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activeTab, setActiveTab] = useState("feed");
  const [errorsFilter, setErrorsFilter] = useState<"all" | "errors" | "unpublished" | "excluded" | "file">("all");
  const [selectedFeedProducts, setSelectedFeedProducts] = useState<Set<string>>(new Set());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [feedSearchQuery, setFeedSearchQuery] = useState("");
  const [feedPriceFilter, setFeedPriceFilter] = useState("all");

  // Product groups (internal categorization, not exported)
  const { groups: avitoGroups, createGroup: createAvitoGroup, updateGroup: updateAvitoGroup, deleteGroup: deleteAvitoGroup } = useAvitoProductGroups(storeId);
  const [selectedGroupId, setSelectedGroupId] = useState<string | "all" | "none">("all");
  const [selectedSourceCategoryId, setSelectedSourceCategoryId] = useState<string | null>(null);
  const [hideInternalCols, setHideInternalCols] = useState(false);

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
  interface AiTemplate {
    id: string;
    name: string;
    instruction: string;
    maxChars: number;
    blocks?: { heading: string; main: string; advantages: string; cta: string };
    stopWords?: string;
    preserveCta?: boolean;
  }

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

  const handleFetchAutoloadErrors = async () => {
    if (!storeId) return;
    setFetchingErrors(true);
    try {
      const data = await callAvitoApi({ action: "fetch_autoload_errors", store_id: storeId });
      if (data?.fallback || data?.success === false) {
        toast({
          title: "Авито недоступен",
          description: data?.message || "Не удалось получить отчёт автозагрузки. Проверьте, что автозагрузка настроена в кабинете Авито и приложению выданы права 'autoload'.",
          variant: "destructive",
        });
        return;
      }
      await avitoFeed?.refetch?.();
      toast({
        title: "Ошибки модерации обновлены",
        description: `Проверено ${data.inspected ?? 0} объявлений, с ошибками: ${data.with_errors ?? 0}, обновлено: ${data.updated ?? 0}`,
      });
    } catch (err: any) {
      toast({ title: "Ошибка загрузки отчёта", description: err.message, variant: "destructive" });
    } finally { setFetchingErrors(false); }
  };

  const detectAvitoField = (text: string): string | undefined => {
    const t = text.toLowerCase();
    if (/назван|заголов|title/.test(t)) return "title";
    if (/описан|description/.test(t)) return "description";
    if (/цен|price|стоимост/.test(t)) return "price";
    if (/фото|image|картин|изображ/.test(t)) return "images";
    if (/адрес|address/.test(t)) return "address";
    if (/категор/.test(t)) return "category";
    if (/телефон|phone/.test(t)) return "contactPhone";
    if (/email|почт/.test(t)) return "email";
    return undefined;
  };

  // Извлекает подсказку категории из текста комментария модератора.
  // Пример: «Для дома и дачи → Продукты питания → Мясо, птица, субпродукты»
  const extractCategorySuggestion = (text: string): string | undefined => {
    if (!text) return undefined;
    // Ищем содержимое в любых кавычках
    const candidates: string[] = [];
    const re = /[«"„]([^»"”]+)[»"”]/g;
    let m;
    while ((m = re.exec(text)) !== null) candidates.push(m[1]);
    for (const c of candidates) {
      // Должно содержать разделитель иерархии
      if (/→|->|>|—/.test(c)) {
        return c.split(/\s*(?:→|->|>|—)\s*/).map((s) => s.trim()).filter(Boolean).join("---");
      }
    }
    return undefined;
  };

  const handleImportAvitoErrorsFile = async (file: File) => {
    if (!storeId || !avitoFeed) return;
    setImportingErrors(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellNF: false, cellHTML: false });
      // Map: first-8-chars of product UUID -> array of {text, hint, field}
      const errorMap = new Map<string, { text: string; hint?: string; field?: string }[]>();
      // Map: first-8-chars of product UUID -> raw status text from Avito report
      const statusMap = new Map<string, string>();
      for (const sheetName of wb.SheetNames) {
        if (sheetName === "Инструкция" || sheetName.startsWith("Спр-")) continue;
        const ws = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: null });
        if (rows.length < 5) continue;
        const headers = (rows[1] || []) as any[];
        const errIdx = headers.findIndex((h) => String(h || "").trim() === "Ошибка");
        const idIdx = headers.findIndex((h) => String(h || "").trim() === "Уникальный идентификатор объявления");
        const statusIdx = headers.findIndex((h) => /^статус/i.test(String(h || "").trim()));
        if (idIdx < 0) continue;
        for (let i = 4; i < rows.length; i++) {
          const row = rows[i] || [];
          const aid = String(row[idIdx] || "").trim().toLowerCase();
          if (!aid) continue;
          if (statusIdx >= 0) {
            const st = String(row[statusIdx] || "").trim();
            if (st) statusMap.set(aid, st);
          }
          if (errIdx < 0) continue;
          const err = String(row[errIdx] || "").trim();
          if (!err) continue;
          // Read cell comment from the "Ошибка" cell
          const cellAddr = XLSX.utils.encode_cell({ r: i, c: errIdx });
          const cell = (ws as any)[cellAddr];
          const commentText: string = (cell?.c && Array.isArray(cell.c))
            ? cell.c.map((c: any) => String(c?.t || "").trim()).filter(Boolean).join("\n")
            : "";
          const parts = err.split(/;\s*/).map((s) => s.trim()).filter(Boolean);
          const prev = errorMap.get(aid) || [];
          const next = [...prev];
          for (const p of parts) {
            if (next.find((x) => x.text === p)) continue;
            next.push({ text: p, hint: commentText || undefined, field: detectAvitoField(p + " " + commentText) });
          }
          errorMap.set(aid, next);
        }
      }

      if (errorMap.size === 0 && statusMap.size === 0) {
        toast({ title: "Данные не найдены в файле", description: "Не удалось распознать колонки «Ошибка» / «Статус» / «Уникальный идентификатор объявления».", variant: "destructive" });
        return;
      }

      const checkedAt = new Date().toISOString();
      let updated = 0;
      let matched = 0;
      let unpublishedCount = 0;
      let cleared = 0;
      let withSuggestion = 0;
      const feed = avitoFeed.feedProducts || [];
      // Множество product_id, упомянутых в файле — нужно для зачистки старых данных
      const matchedProductIds = new Set<string>();
      for (const fp of feed) {
        const prefix = String(fp.product_id || "").slice(0, 8).toLowerCase();
        const errs = errorMap.get(prefix);
        const status = statusMap.get(prefix);
        const oldMod = (fp.avito_params as any)?.moderation;
        if ((!errs || errs.length === 0) && !status) {
          // Если у товара была старая модерация — стираем (его уже нет в свежем файле, значит исправлен)
          if (oldMod) {
            const cleaned = { ...(fp.avito_params || {}) };
            delete (cleaned as any).moderation;
            try { await avitoFeed.updateProductParams(fp.product_id, cleaned); cleared++; } catch {}
          }
          continue;
        }
        matched++;
        matchedProductIds.add(fp.product_id);
        // Берём первую найденную подсказку категории среди всех комментариев
        let suggestedCategory: string | undefined;
        for (const m of errs || []) {
          const s = extractCategorySuggestion(`${m.text} ${m.hint || ""}`);
          if (s) { suggestedCategory = s; break; }
        }
        if (suggestedCategory) withSuggestion++;
        const messages = (errs || []).map((m) => ({
          type: /заблокир|удален|отклон/i.test(m.text) ? "error" : "warning",
          text: m.text,
          hint: m.hint,
          field: m.field,
        }));
        const published = status ? !/не\s*опубл|снят|откло|заблок|удал/i.test(status) : undefined;
        if (published === false) unpublishedCount++;
        const newParams = {
          ...(fp.avito_params || {}),
          moderation: {
            source: "xlsx_import",
            checked_at: checkedAt,
            file_name: file.name,
            status: status || undefined,
            published,
            messages,
            suggested_category: suggestedCategory,
          },
        };
        try {
          await avitoFeed.updateProductParams(fp.product_id, newParams);
          updated++;
        } catch {}
      }

      await avitoFeed.refetch?.();
      const totalAvito = new Set([...errorMap.keys(), ...statusMap.keys()]).size;
      const unmatched = totalAvito - matched;
      // Автоматически переключаемся на новый фильтр "из файла"
      setErrorsFilter("file");
      toast({
        title: "Файл Авито обработан",
        description: `В файле: ${totalAvito}. С ошибками: ${errorMap.size}. Не опубликовано: ${unpublishedCount}. Сопоставлено: ${matched}. Подсказок категории: ${withSuggestion}. Старых отметок очищено: ${cleared}. Не найдено в фиде: ${unmatched}.`,
      });
    } catch (err: any) {
      console.error("Import avito errors xlsx failed", err);
      toast({ title: "Не удалось разобрать файл", description: err?.message || String(err), variant: "destructive" });
    } finally {
      setImportingErrors(false);
      if (errorsFileInputRef.current) errorsFileInputRef.current.value = "";
    }
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
    const newParams: any = { ...currentParams, [key]: value || undefined };

    // Smart split for hierarchical Avito category path "A---B---C"
    if (key === "category" && value && value.includes("---")) {
      const parts = value.split("---").map((s: string) => s.trim()).filter(Boolean);
      // <Category> in XML = level 2 (Avito autoload convention), or level 1 if no level 2
      newParams.category = parts.length >= 2 ? parts[1] : parts[0];
      // <GoodsType> in XML = leaf (most specific level)
      if (parts.length >= 3) {
        newParams.goodsSubType = parts[parts.length - 1];
        delete newParams.GoodsType;
      }
      // Persist full original path for display / audit
      newParams.categoryPath = value;
      toast({
        title: "Категория сохранена",
        description: `В выгрузку: Категория = «${newParams.category}»${newParams.goodsSubType ? `, Вид товара = «${newParams.goodsSubType}»` : ""}`,
      });
    }

    Object.keys(newParams).forEach(k => { if (!newParams[k]) delete newParams[k]; });
    await avitoFeed.updateProductParams(productId, newParams);
  }, [avitoFeed, toast]);
  // === AI DESCRIPTION/TITLE GENERATION ===
  const handleAiGenerate = async (overrides?: { instruction?: string; maxChars?: number; priceMode?: "auto" | "custom" | "none"; customPrice?: number | null }) => {
    if (!avitoFeed) return;
    const effInstruction = overrides?.instruction ?? aiInstruction;
    const effMaxChars = overrides?.maxChars ?? aiMaxChars;
    const priceMode = overrides?.priceMode ?? "auto";
    const customPrice = overrides?.customPrice ?? null;
    const resolvePrice = (raw?: number) => {
      if (priceMode === "none") return undefined;
      if (priceMode === "custom") return customPrice && customPrice > 0 ? customPrice : undefined;
      return raw;
    };
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
          return product ? { id: pid, name: product.name, description: product.description, price: resolvePrice(product.pricePerUnit) } : null;
        }).filter(Boolean);

        try {
          const { data, error } = await supabase.functions.invoke("ai-avito-description", {
            body: { products: productsToGenerate, instruction: effInstruction, maxChars: effMaxChars, mode: aiMode },
          });

          if (error) throw error;
          if (data?.error) throw new Error(data.error);

          const descriptions = data?.descriptions || {};

          const city = (localDefaults.address?.split(",")[0]?.trim()) || "вашем городе";
          for (const [pid, rawValue] of Object.entries(descriptions)) {
            if (rawValue && typeof rawValue === "string") {
              const prod = storeProducts.find(p => p.id === pid);
              // post-process placeholders the AI was told to keep verbatim
              const value = rawValue
                .replace(/\{product_name\}/g, prod?.name ?? "")
                .replace(/\{price\}/g, (() => { const ep = resolvePrice(prod?.pricePerUnit); return ep ? `${Math.round(ep)} ₽` : ""; })())
                .replace(/\{city\}/g, city)
                .replace(/\{description\}/g, prod?.description ?? "");
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
        const price = Number(params.Price) || Number(params.price) || Number(product.pricePerUnit) || 0;

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
          // PromoManualOptions - use stored multi-line value
          params.promoManualOptions || "",
          // PromoAutoOptions - use stored multi-line value
          params.promoAutoOptions || "",
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
        const price = Number(params.Price) || Number(params.price) || Number(product.pricePerUnit) || 0;

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
          // PromoManualOptions - use stored multi-line value
          params.promoManualOptions || "",
          // PromoAutoOptions - use stored multi-line value
          params.promoAutoOptions || "",
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

  // === EXCEL IMPORT ===
  const [importingExcel, setImportingExcel] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !avitoFeed) return;
    setImportingExcel(true);
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) throw new Error("Лист не найден");

      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      // Find header row (row2 in our export) — look for "Уникальный идентификатор"
      let headerRowIdx = -1;
      for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const row = rows[i];
        if (row && row.some((cell: any) => String(cell || "").includes("Уникальный идентификатор"))) {
          headerRowIdx = i;
          break;
        }
      }
      if (headerRowIdx < 0) throw new Error("Не найдена строка заголовков. Убедитесь, что файл был экспортирован из этого сервиса.");

      const headers = (rows[headerRowIdx] || []).map((h: any) => String(h || "").trim());
      // Column index mapping
      const colIdx = (name: string) => headers.findIndex(h => h.toLowerCase().includes(name.toLowerCase()));
      const idxId = colIdx("Уникальный идентификатор");
      const idxListingFee = colIdx("Способ размещения");
      const idxAvitoNumber = colIdx("Номер объявления");
      const idxManager = colIdx("Контактное лицо");
      const idxPhone = colIdx("Номер телефона");
      const idxTitle = colIdx("Название объявления");
      const idxDesc = colIdx("Описание объявления");
      const idxContactMethod = colIdx("Способ связи");
      const idxPrice = colIdx("Цена");
      const idxCategory = colIdx("Категория");
      const idxAdType = colIdx("Вид объявления");
      const idxGoodsType = colIdx("Вид товара");
      const idxTargetAudience = colIdx("Целевая аудитория");
      const idxAddress = colIdx("Адрес");
      const idxEmail = colIdx("Почта");
      const idxCompany = colIdx("Название компании");
      const idxPromo = colIdx("Promo");
      const idxPromoManual = colIdx("PromoManualOptions");
      const idxPromoAuto = colIdx("PromoAutoOptions");

      // Data starts after headerRowIdx + 2 rows (required/type rows)
      const dataStartIdx = headerRowIdx + 3; // skip header, required, type rows
      // But if we exported with row1=category line, row2=headers, row3=required, row4=type → data at row5 (idx=4)
      // Let's just use headerRowIdx + 3 as start and handle sparse
      
      // Build product lookup by avitoId (first 10 chars of product.id) 
      const feedProductMap = new Map<string, AvitoFeedProduct>();
      for (const fp of avitoFeed.feedProducts) {
        const product = storeProducts.find(p => p.id === fp.product_id);
        if (product) {
          feedProductMap.set(product.id.substring(0, 10), fp);
          feedProductMap.set(product.id, fp);
        }
      }

      const updates: Array<{ productId: string; params: any }> = [];
      for (let i = dataStartIdx; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;
        const avitoId = String(row[idxId] || "").trim();
        if (!avitoId) continue;

        const fp = feedProductMap.get(avitoId);
        if (!fp) continue;

        const params: any = { ...(fp.avito_params || {}) };
        const setIfPresent = (idx: number, key: string) => {
          if (idx >= 0 && row[idx] !== undefined && row[idx] !== null && String(row[idx]).trim() !== "") {
            params[key] = String(row[idx]).trim();
          }
        };

        setIfPresent(idxTitle, "title");
        setIfPresent(idxDesc, "description");
        if (idxPrice >= 0 && row[idxPrice] !== undefined && String(row[idxPrice]).trim() !== "") {
          params.price = String(row[idxPrice]);
        }
        setIfPresent(idxCategory, "category");
        setIfPresent(idxAdType, "goodsType");
        setIfPresent(idxGoodsType, "goodsSubType");
        setIfPresent(idxAddress, "address");
        setIfPresent(idxManager, "managerName");
        setIfPresent(idxPhone, "contactPhone");
        setIfPresent(idxEmail, "email");
        setIfPresent(idxCompany, "companyName");
        setIfPresent(idxListingFee, "listingFee");
        setIfPresent(idxContactMethod, "contactMethod");
        setIfPresent(idxTargetAudience, "targetAudience");
        setIfPresent(idxAvitoNumber, "avitoNumber");
        setIfPresent(idxPromo, "promo");
        if (idxPromoManual >= 0 && row[idxPromoManual]) {
          params.promoManualOptions = String(row[idxPromoManual]).trim();
        }
        if (idxPromoAuto >= 0 && row[idxPromoAuto]) {
          params.promoAutoOptions = String(row[idxPromoAuto]).trim();
        }

        updates.push({ productId: fp.product_id, params });
      }

      // Persist updates in parallel batches — без сохранения изменения не уходили в БД
      let updated = 0;
      const BATCH = 25;
      for (let i = 0; i < updates.length; i += BATCH) {
        const chunk = updates.slice(i, i + BATCH);
        await Promise.all(chunk.map(async u => {
          await avitoFeed.updateProductParams(u.productId, u.params);
          updated++;
        }));
      }

      await avitoFeed.refetch();
      toast({
        title: `Импортировано: ${updated} товар(ов) обновлено`,
        description: updates.length === 0 ? "Не найдено совпадений по «Уникальный идентификатор». Проверьте, что файл выгружен из этого сервиса." : undefined,
      });
    } catch (err: any) {
      console.error("Import error:", err);
      toast({ title: "Ошибка импорта", description: err.message, variant: "destructive" });
    } finally {
      setImportingExcel(false);
      if (importFileRef.current) importFileRef.current.value = "";
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

      {/* Validation: detect issues per feed product */}
      {(() => null)()}

      {cityTabs && (
        <AvitoCityTabsBar
          tabs={cityTabs.tabs}
          activeTabId={cityTabs.activeTabId}
          onSelect={cityTabs.setActiveTabId}
          onCreate={cityTabs.createTab}
          onUpdate={cityTabs.updateTab}
          onDelete={cityTabs.deleteTab}
        />
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="feed">Товары для Авито ({avitoFeed?.feedProducts.length || 0})</TabsTrigger>
          <TabsTrigger value="errors" className="data-[state=active]:text-destructive">
            <AlertCircle className="h-3.5 w-3.5 mr-1" />
            Объявления с ошибками{(() => {
              const c = (avitoFeed?.feedProducts || []).filter((fp) => {
                const p = storeProducts.find((sp) => sp.id === fp.product_id);
                if (!p) return false;
                return computeAvitoIssues(fp, p, localDefaults).length > 0;
              }).length;
              return c > 0 ? ` (${c})` : "";
            })()}
          </TabsTrigger>
          {isConnected && <TabsTrigger value="active">Активные объявления</TabsTrigger>}
        </TabsList>


        {/* Feed Products Tab */}
        <TabsContent value="feed">
          <AvitoSheetsPanel storeId={storeId} />
          <AvitoPhotosPanel storeId={storeId} />
          <div className="flex gap-0 h-[calc(100vh-220px)]">
            {/* Groups Sidebar (internal categorization) */}
            {avitoFeed && (
              <AvitoGroupsSidebar
                groups={avitoGroups}
                feedProducts={avitoFeed.feedProducts}
                selectedGroupId={selectedGroupId}
                onSelectGroup={setSelectedGroupId}
                errorIds={new Set(
                  (avitoFeed.feedProducts || [])
                    .filter((fp) => {
                      const p = storeProducts.find((sp) => sp.id === fp.product_id);
                      if (!p) return false;
                      return computeAvitoIssues(fp, p, localDefaults).length > 0;
                    })
                    .map((fp) => fp.product_id)
                )}
                onCreateGroup={createAvitoGroup}
                onUpdateGroup={updateAvitoGroup}
                onDeleteGroup={deleteAvitoGroup}
                storeProducts={storeProducts as any}
                storeCategories={storeCategories as any}
                selectedCategoryId={selectedSourceCategoryId}
                onSelectCategory={setSelectedSourceCategoryId}
              />
            )}
            {/* Left Sidebar - Settings, Filters, Bulk Actions */}
            <div className="w-[260px] min-w-[220px] flex-shrink-0 border-r overflow-y-auto bg-muted/10">
              <ScrollArea className="h-full">
                <div className="p-3 space-y-3">

                  {/* Search & Price Filter */}
                  {avitoFeed && avitoFeed.feedProducts.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Поиск</p>
                      <div className="relative">
                        <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Название, артикул, ID (#abc12345)..."
                          value={feedSearchQuery}
                          onChange={(e) => setFeedSearchQuery(e.target.value)}
                          className="h-7 text-xs pl-7"
                        />
                      </div>
                      <Select value={feedPriceFilter} onValueChange={setFeedPriceFilter}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Цена" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Все цены</SelectItem>
                          <SelectItem value="zero">Цена = 0</SelectItem>
                          <SelectItem value="nonzero">Цена &gt; 0</SelectItem>
                        </SelectContent>
                      </Select>
                      {(feedSearchQuery || feedPriceFilter !== "all") && (
                        <Button size="sm" variant="ghost" className="h-6 text-[10px] w-full" onClick={() => { setFeedSearchQuery(""); setFeedPriceFilter("all"); }}>
                          <X className="h-3 w-3 mr-1" /> Сбросить
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Bulk Apply Section */}
                  {avitoFeed && avitoFeed.feedProducts.length > 0 && (() => {
                    const applyToTargets = async (applyFn: (targets: AvitoFeedProduct[]) => Promise<void>, onlySelected: boolean) => {
                      const targets = onlySelected
                        ? avitoFeed.feedProducts.filter(fp => selectedFeedProducts.has(fp.product_id))
                        : avitoFeed.feedProducts;
                      if (targets.length === 0) { toast({ title: "Нет товаров для обновления", variant: "destructive" }); return; }
                      await applyFn(targets);
                    };

                    const BulkButtons = ({ onApply }: { onApply: (onlySelected: boolean) => void }) => (
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="outline" className="h-6 text-[10px] px-1.5" onClick={() => onApply(false)} title="Ко всем">
                          <Check className="h-3 w-3" />
                        </Button>
                        {selectedFeedProducts.size > 0 && (
                          <Button size="sm" variant="default" className="h-6 text-[10px] px-1.5" onClick={() => onApply(true)} title={`К ${selectedFeedProducts.size} выбранным`}>
                            <Check className="h-3 w-3" /> {selectedFeedProducts.size}
                          </Button>
                        )}
                      </div>
                    );

                    return (
                      <div className="space-y-2">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                          Массовые значения
                          {selectedFeedProducts.size > 0 && <Badge variant="secondary" className="ml-1 text-[9px] py-0">{selectedFeedProducts.size} выбр.</Badge>}
                        </p>

                        {/* Address */}
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Адрес</Label>
                          <div className="flex gap-1">
                            <Input value={localDefaults.address} onChange={(e) => setLocalDefaults(prev => ({ ...prev, address: e.target.value }))} onBlur={() => avitoFeed.saveDefaults(localDefaults)} placeholder="Москва, ул..." className="h-7 text-xs flex-1" />
                            <BulkButtons onApply={async (onlySelected) => {
                              if (!localDefaults.address) { toast({ title: "Введите адрес", variant: "destructive" }); return; }
                              await applyToTargets(async (targets) => {
                                for (const fp of targets) { await avitoFeed.updateProductParams(fp.product_id, { ...(fp.avito_params || {}), address: localDefaults.address }); }
                                toast({ title: `Адрес проставлен для ${targets.length} товар(ов)` });
                              }, onlySelected);
                            }} />
                          </div>
                        </div>

                        {/* Category */}
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Категория Авито</Label>
                          <div className="flex gap-1">
                            <div className="flex-1 min-w-0">
                              <AvitoCategoryCombobox
                                value={localDefaults.category}
                                onChange={(val) => {
                                  const next = { ...localDefaults, category: val };
                                  setLocalDefaults(next);
                                  avitoFeed.saveDefaults(next);
                                }}
                                placeholder="Выберите категорию Авито..."
                              />
                            </div>
                            <BulkButtons onApply={async (onlySelected) => {
                              if (!localDefaults.category) { toast({ title: "Введите категорию", variant: "destructive" }); return; }
                              await applyToTargets(async (targets) => {
                                for (const fp of targets) { await avitoFeed.updateProductParams(fp.product_id, { ...(fp.avito_params || {}), category: localDefaults.category }); }
                                toast({ title: `Категория проставлена для ${targets.length} товар(ов)` });
                              }, onlySelected);
                            }} />
                          </div>
                        </div>

                        {/* Ad type */}
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Вид объявления</Label>
                          <div className="flex gap-1">
                            <Select value={localDefaults.goodsType} onValueChange={(v) => setLocalDefaults(prev => ({ ...prev, goodsType: v }))}>
                              <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Товар от производителя">Товар от производителя</SelectItem>
                                <SelectItem value="Товар приобретен на продажу">Товар приобретен на продажу</SelectItem>
                              </SelectContent>
                            </Select>
                            <BulkButtons onApply={async (onlySelected) => {
                              await applyToTargets(async (targets) => {
                                for (const fp of targets) { await avitoFeed.updateProductParams(fp.product_id, { ...(fp.avito_params || {}), goodsType: localDefaults.goodsType }); }
                                avitoFeed.saveDefaults(localDefaults);
                                toast({ title: `Вид объявления проставлен для ${targets.length} товар(ов)` });
                              }, onlySelected);
                            }} />
                          </div>
                        </div>

                        {/* Goods sub-type */}
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Вид товара</Label>
                          <div className="flex gap-1">
                            <Input value={localDefaults.goodsSubType} onChange={(e) => setLocalDefaults(prev => ({ ...prev, goodsSubType: e.target.value }))} onBlur={() => avitoFeed.saveDefaults(localDefaults)} placeholder="Мясо, птица..." className="h-7 text-xs flex-1" />
                            <BulkButtons onApply={async (onlySelected) => {
                              if (!localDefaults.goodsSubType) { toast({ title: "Введите вид товара", variant: "destructive" }); return; }
                              await applyToTargets(async (targets) => {
                                for (const fp of targets) { await avitoFeed.updateProductParams(fp.product_id, { ...(fp.avito_params || {}), goodsSubType: localDefaults.goodsSubType }); }
                                toast({ title: `Вид товара проставлен для ${targets.length} товар(ов)` });
                              }, onlySelected);
                            }} />
                          </div>
                        </div>

                        {/* Promo */}
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Promo</Label>
                          <div className="flex gap-1">
                            <Select value={localDefaults.promo} onValueChange={(v) => setLocalDefaults(prev => ({ ...prev, promo: v }))}>
                              <SelectTrigger className="h-7 text-xs flex-1"><SelectValue placeholder="Не использовать" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Не использовать</SelectItem>
                                <SelectItem value="Manual">Manual</SelectItem>
                                <SelectItem value="Auto_1">Auto_1</SelectItem>
                                <SelectItem value="Auto_7">Auto_7</SelectItem>
                                <SelectItem value="Auto_30">Auto_30</SelectItem>
                              </SelectContent>
                            </Select>
                            <BulkButtons onApply={async (onlySelected) => {
                              const promoVal = localDefaults.promo === "none" ? "" : localDefaults.promo;
                              await applyToTargets(async (targets) => {
                                for (const fp of targets) {
                                  const params = { ...(fp.avito_params || {}) };
                                  if (promoVal) { params.promo = promoVal; if (localDefaults.promoRegion) params.promoRegion = localDefaults.promoRegion; if (localDefaults.promoBudget) params.promoBudget = localDefaults.promoBudget; if (localDefaults.promoPrice) params.promoPrice = localDefaults.promoPrice; if (localDefaults.promoLimit) params.promoLimit = localDefaults.promoLimit; }
                                  else { delete params.promo; delete params.promoRegion; delete params.promoBudget; delete params.promoPrice; delete params.promoLimit; }
                                  await avitoFeed.updateProductParams(fp.product_id, params);
                                }
                                avitoFeed.saveDefaults(localDefaults);
                                toast({ title: promoVal ? `Promo проставлен для ${targets.length} товар(ов)` : `Promo убран у ${targets.length} товар(ов)` });
                              }, onlySelected);
                            }} />
                          </div>
                        </div>

                        {/* PromoManual details */}
                        {localDefaults.promo === "Manual" && (
                          <div className="space-y-1.5 border-t border-dashed pt-2">
                            <p className="text-[9px] text-muted-foreground">Формат: Город|Цена|Лимит</p>
                            <div className="space-y-1">
                              <Input className="h-7 text-xs" placeholder="Город/Регион" value={localDefaults.promoRegion || ""} onChange={(e) => setLocalDefaults(prev => ({ ...prev, promoRegion: e.target.value }))} />
                              <Input className="h-7 text-xs" placeholder="Цена действия (₽)" type="number" value={localDefaults.promoPrice || ""} onChange={(e) => setLocalDefaults(prev => ({ ...prev, promoPrice: e.target.value }))} />
                              <Input className="h-7 text-xs" placeholder="Лимит в день (₽)" type="number" value={localDefaults.promoLimit || ""} onChange={(e) => setLocalDefaults(prev => ({ ...prev, promoLimit: e.target.value }))} />
                            </div>
                            <p className="text-[9px] text-muted-foreground">
                              Результат: <code className="bg-muted px-1 rounded text-foreground">{(() => { const r = localDefaults.promoRegion || ""; const p = localDefaults.promoPrice || ""; const l = localDefaults.promoLimit || ""; if (!p && !l) return "—"; return `${r}|${p}|${l}`; })()}</code>
                            </p>
                            <BulkButtons onApply={async (onlySelected) => {
                              const promoPrice = localDefaults.promoPrice || "";
                              if (!promoPrice) { toast({ title: "Укажите цену целевого действия", variant: "destructive" }); return; }
                              const line = `${localDefaults.promoRegion || ""}|${promoPrice}|${localDefaults.promoLimit || ""}`;
                              await applyToTargets(async (targets) => {
                                for (const fp of targets) { await avitoFeed.updateProductParams(fp.product_id, { ...(fp.avito_params || {}), promoManualOptions: line }); }
                                avitoFeed.saveDefaults(localDefaults);
                                toast({ title: `PromoManual проставлен для ${targets.length} товар(ов)` });
                              }, onlySelected);
                            }} />
                          </div>
                        )}

                        {/* PromoAuto details */}
                        {(localDefaults.promo === "Auto_1" || localDefaults.promo === "Auto_7" || localDefaults.promo === "Auto_30") && (
                          <div className="space-y-1.5 border-t border-dashed pt-2">
                            <p className="text-[9px] text-muted-foreground">Формат: Город|Бюджет</p>
                            <p className="text-[9px] text-muted-foreground">Несколько городов — каждый с новой строки. Бюджет в рублях.</p>
                            <div className="space-y-1">
                              <Input className="h-7 text-xs" placeholder="Город/Регион" value={localDefaults.promoRegion || ""} onChange={(e) => setLocalDefaults(prev => ({ ...prev, promoRegion: e.target.value }))} />
                              <Input className="h-7 text-xs" placeholder="Бюджет (₽)" type="number" value={localDefaults.promoBudget || ""} onChange={(e) => setLocalDefaults(prev => ({ ...prev, promoBudget: e.target.value }))} />
                            </div>
                            <p className="text-[9px] text-muted-foreground">
                              Результат: <code className="bg-muted px-1 rounded text-foreground">{(() => { const r = localDefaults.promoRegion || ""; const b = localDefaults.promoBudget || ""; if (!b) return "—"; return `${r}|${b}`; })()}</code>
                            </p>
                            <BulkButtons onApply={async (onlySelected) => {
                              const budget = localDefaults.promoBudget || "";
                              if (!budget) { toast({ title: "Укажите бюджет", variant: "destructive" }); return; }
                              const line = `${localDefaults.promoRegion || ""}|${budget}`;
                              await applyToTargets(async (targets) => {
                                for (const fp of targets) { await avitoFeed.updateProductParams(fp.product_id, { ...(fp.avito_params || {}), promoAutoOptions: line }); }
                                avitoFeed.saveDefaults(localDefaults);
                                toast({ title: `PromoAuto проставлен для ${targets.length} товар(ов)` });
                              }, onlySelected);
                            }} />
                          </div>
                        )}


                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Ставка CPC</Label>
                          <div className="flex gap-1">
                            <Input className="h-7 text-xs flex-1" type="number" min="0" step="0.1" placeholder="₽ за клик" value={localDefaults.cpcBid || ""} onChange={(e) => setLocalDefaults(prev => ({ ...prev, cpcBid: e.target.value }))} />
                            <BulkButtons onApply={async (onlySelected) => {
                              const val = localDefaults.cpcBid || "";
                              await applyToTargets(async (targets) => {
                                for (const fp of targets) { const params = { ...(fp.avito_params || {}) }; if (val) params.cpcBid = val; else delete params.cpcBid; await avitoFeed.updateProductParams(fp.product_id, params); }
                                avitoFeed.saveDefaults(localDefaults);
                                toast({ title: val ? `CPC ${val}₽ для ${targets.length} товар(ов)` : `CPC убран у ${targets.length} товар(ов)` });
                              }, onlySelected);
                            }} />
                          </div>
                        </div>

                        {/* Contact Person */}
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Конт. лицо</Label>
                          <div className="flex gap-1">
                            <Input className="h-7 text-xs flex-1" placeholder="Имя" value={localDefaults.managerName || ""} onChange={(e) => setLocalDefaults(prev => ({ ...prev, managerName: e.target.value }))} />
                            <BulkButtons onApply={async (onlySelected) => {
                              if (!localDefaults.managerName) { toast({ title: "Введите контактное лицо", variant: "destructive" }); return; }
                              await applyToTargets(async (targets) => {
                                for (const fp of targets) { await avitoFeed.updateProductParams(fp.product_id, { ...(fp.avito_params || {}), managerName: localDefaults.managerName }); }
                                avitoFeed.saveDefaults(localDefaults);
                                toast({ title: `Конт. лицо проставлено для ${targets.length} товар(ов)` });
                              }, onlySelected);
                            }} />
                          </div>
                        </div>

                        {/* Phone */}
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Телефон</Label>
                          <div className="flex gap-1">
                            <Input className="h-7 text-xs flex-1" placeholder="79001234567" value={localDefaults.contactPhone || ""} onChange={(e) => setLocalDefaults(prev => ({ ...prev, contactPhone: e.target.value }))} />
                            <BulkButtons onApply={async (onlySelected) => {
                              if (!localDefaults.contactPhone) { toast({ title: "Введите телефон", variant: "destructive" }); return; }
                              await applyToTargets(async (targets) => {
                                for (const fp of targets) { await avitoFeed.updateProductParams(fp.product_id, { ...(fp.avito_params || {}), contactPhone: localDefaults.contactPhone }); }
                                avitoFeed.saveDefaults(localDefaults);
                                toast({ title: `Телефон проставлен для ${targets.length} товар(ов)` });
                              }, onlySelected);
                            }} />
                          </div>
                        </div>

                        {/* Email */}
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Почта</Label>
                          <div className="flex gap-1">
                            <Input className="h-7 text-xs flex-1" placeholder="email@example.com" value={localDefaults.email || ""} onChange={(e) => setLocalDefaults(prev => ({ ...prev, email: e.target.value }))} />
                            <BulkButtons onApply={async (onlySelected) => {
                              if (!localDefaults.email) { toast({ title: "Введите email", variant: "destructive" }); return; }
                              await applyToTargets(async (targets) => {
                                for (const fp of targets) { await avitoFeed.updateProductParams(fp.product_id, { ...(fp.avito_params || {}), email: localDefaults.email }); }
                                avitoFeed.saveDefaults(localDefaults);
                                toast({ title: `Почта проставлена для ${targets.length} товар(ов)` });
                              }, onlySelected);
                            }} />
                          </div>
                        </div>

                        {/* Company */}
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Компания</Label>
                          <div className="flex gap-1">
                            <Input className="h-7 text-xs flex-1" placeholder="ООО Компания" value={localDefaults.companyName || ""} onChange={(e) => setLocalDefaults(prev => ({ ...prev, companyName: e.target.value }))} />
                            <BulkButtons onApply={async (onlySelected) => {
                              if (!localDefaults.companyName) { toast({ title: "Введите название компании", variant: "destructive" }); return; }
                              await applyToTargets(async (targets) => {
                                for (const fp of targets) { await avitoFeed.updateProductParams(fp.product_id, { ...(fp.avito_params || {}), companyName: localDefaults.companyName }); }
                                avitoFeed.saveDefaults(localDefaults);
                                toast({ title: `Компания проставлена для ${targets.length} товар(ов)` });
                              }, onlySelected);
                            }} />
                          </div>
                        </div>

                        {/* Target Audience */}
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Аудитория</Label>
                          <div className="flex gap-1">
                            <Select value={localDefaults.targetAudience} onValueChange={(v) => setLocalDefaults(prev => ({ ...prev, targetAudience: v }))}>
                              <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Частные лица и бизнес">Частные лица и бизнес</SelectItem>
                                <SelectItem value="Частные лица">Частные лица</SelectItem>
                                <SelectItem value="Бизнес">Бизнес</SelectItem>
                              </SelectContent>
                            </Select>
                            <BulkButtons onApply={async (onlySelected) => {
                              await applyToTargets(async (targets) => {
                                for (const fp of targets) { await avitoFeed.updateProductParams(fp.product_id, { ...(fp.avito_params || {}), targetAudience: localDefaults.targetAudience }); }
                                avitoFeed.saveDefaults(localDefaults);
                                toast({ title: `Аудитория проставлена для ${targets.length} товар(ов)` });
                              }, onlySelected);
                            }} />
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* API Connection - collapsible */}
                  <Collapsible>
                    <CollapsibleTrigger className="flex items-center justify-between w-full py-1">
                      <div className="flex items-center gap-1.5">
                        <Link2 className="h-3.5 w-3.5 text-primary" />
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">API подключение</span>
                      </div>
                      <Badge variant="secondary" className="text-[9px] py-0">▼</Badge>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2 space-y-2">
                      <p className="text-[9px] text-muted-foreground">
                        Client ID и Secret с{" "}
                        <a href="https://www.avito.ru/professionals/api" target="_blank" rel="noopener noreferrer" className="text-primary underline">avito.ru/professionals/api</a>
                      </p>
                      <div className="space-y-1.5">
                        <Input value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="Client ID" className="h-7 text-xs" />
                        <Input type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} placeholder="Client Secret" className="h-7 text-xs" />
                      </div>
                      <div className="flex gap-1.5">
                        <Button size="sm" className="h-7 text-xs flex-1" onClick={handleConnect} disabled={connecting || !clientId.trim() || !clientSecret.trim()}>
                          {connecting && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                          {isConnected ? "Переподключить" : "Подключить"}
                        </Button>
                        {isConnected && (
                          <Button size="sm" variant="outline" className="h-7 text-xs text-destructive" onClick={handleDisconnect} disabled={disconnecting}>
                            {disconnecting && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                            <Unlink className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Settings Defaults */}
                  <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
                    <CollapsibleTrigger className="flex items-center justify-between w-full py-1">
                      <div className="flex items-center gap-1.5">
                        <Settings className="h-3.5 w-3.5 text-primary" />
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Настройки</span>
                      </div>
                      <Badge variant="secondary" className="text-[9px] py-0">{settingsOpen ? "▲" : "▼"}</Badge>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2 space-y-2">
                      <p className="text-[9px] text-muted-foreground">Значения по умолчанию для экспорта</p>
                      <div className="space-y-1.5">
                        <div className="space-y-0.5">
                          <Label className="text-[10px]">Способ связи</Label>
                          <Select value={localDefaults.contactMethod} onValueChange={(v) => setLocalDefaults(p => ({ ...p, contactMethod: v }))}>
                            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="По телефону и в сообщениях">По телефону и в сообщениях</SelectItem>
                              <SelectItem value="По телефону">По телефону</SelectItem>
                              <SelectItem value="В сообщениях">В сообщениях</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-0.5">
                          <Label className="text-[10px]">Способ размещения</Label>
                          <Select value={localDefaults.listingFee} onValueChange={(v) => setLocalDefaults(p => ({ ...p, listingFee: v }))}>
                            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Package">Package</SelectItem>
                              <SelectItem value="PackageSingle">PackageSingle</SelectItem>
                              <SelectItem value="Single">Single</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Button size="sm" className="h-7 text-xs w-full" onClick={() => { avitoFeed?.saveDefaults(localDefaults); toast({ title: "Настройки сохранены" }); }}>
                        <Save className="h-3 w-3 mr-1" /> Сохранить
                      </Button>
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Export Section */}
                  {avitoFeed && avitoFeed.feedProducts.length > 0 && storeId && (
                    <div className="space-y-2 border-t pt-2">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Экспорт</p>
                      <div className="space-y-1.5">
                        <Button size="sm" variant="outline" className="h-7 text-xs w-full" onClick={() => importFileRef.current?.click()} disabled={importingExcel}>
                          {importingExcel ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Plus className="h-3 w-3 mr-1" />}
                          {importingExcel ? "Импорт..." : "Загрузить Excel"}
                        </Button>
                        <input ref={importFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportExcel} />
                        <Button size="sm" className="h-7 text-xs w-full" onClick={handleExportExcelOnly} disabled={exportingExcel}>
                          {exportingExcel ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Download className="h-3 w-3 mr-1" />}
                          {exportingExcel ? "Подготовка..." : "Скачать Excel"}
                        </Button>
                        <Button size="sm" className="h-7 text-xs w-full" onClick={handleExportExcel} disabled={exporting}>
                          {exporting ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Download className="h-3 w-3 mr-1" />}
                          {exporting ? "ZIP..." : "Скачать ZIP с фото"}
                        </Button>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[9px] text-muted-foreground">XML-фид:</p>
                        <div className="flex gap-1">
                          {(() => {
                            const urlStr = `https://${projectId}.supabase.co/functions/v1/avito-feed?store_id=${storeId}`;
                            return (
                              <Button size="sm" variant="outline" className="h-6 text-[10px] w-full" onClick={() => { navigator.clipboard.writeText(urlStr); toast({ title: "Ссылка скопирована" }); }}>
                                Копировать ссылку фида
                              </Button>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Right Area - Table */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              {/* Bulk actions bar - always visible when there are products */}
              {avitoFeed && avitoFeed.feedProducts.length > 0 && (() => {
                // (filtering computed below, with category filter included)
                const descendantCatIds = (() => {
                  if (!selectedSourceCategoryId) return null;
                  const set = new Set<string>([selectedSourceCategoryId]);
                  const childMap = new Map<string, string[]>();
                  for (const c of storeCategories) {
                    if (c.parent_id) {
                      const arr = childMap.get(c.parent_id) || [];
                      arr.push(c.id); childMap.set(c.parent_id, arr);
                    }
                  }
                  const walk = (id: string) => {
                    for (const k of childMap.get(id) || []) { set.add(k); walk(k); }
                  };
                  walk(selectedSourceCategoryId);
                  return set;
                })();
                const groupFilteredFeed = avitoFeed.feedProducts.filter((fp) => {
                  if (selectedGroupId === "none" && fp.group_id) return false;
                  if (selectedGroupId !== "all" && selectedGroupId !== "none" && fp.group_id !== selectedGroupId) return false;
                  if (descendantCatIds) {
                    const p = storeProducts.find(sp => sp.id === fp.product_id);
                    if (!p) return false;
                    const ids = [
                      ...((p as any).category ? [(p as any).category] : []),
                      ...((p as any).categories || []),
                    ];
                    if (!ids.some(id => descendantCatIds.has(id))) return false;
                  }
                  return true;
                });
                const currentGroupName = selectedGroupId === "all"
                  ? "Все товары"
                  : selectedGroupId === "none"
                    ? "Без группы"
                    : (avitoGroups.find(g => g.id === selectedGroupId)?.name || "Группа");
                const assignGroupFn = avitoFeed.assignGroup
                  || (async (ids: string[], gid: string | null) => {
                    for (const id of ids) {
                      await avitoFeed.updateProductParams(id, { ...(avitoFeed.feedProducts.find(fp => fp.product_id === id)?.avito_params || {}) });
                    }
                  });
                return (
                  <>
                    <div className="flex items-center gap-2 bg-primary/5 border-b border-primary/20 px-3 py-1.5 flex-shrink-0 flex-wrap">
                      <span className="text-xs font-medium flex items-center gap-1.5">
                        {selectedGroupId !== "all" && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-background border text-[10px]">
                            {selectedGroupId !== "none" && (
                              <span className={`h-2 w-2 rounded-full ${colorClass(avitoGroups.find(g => g.id === selectedGroupId)?.color)}`} />
                            )}
                            {currentGroupName}
                            <button onClick={() => setSelectedGroupId("all")} className="ml-0.5 hover:text-destructive">
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </span>
                        )}
                        {selectedFeedProducts.size > 0
                          ? `Выбрано: ${selectedFeedProducts.size}`
                          : `Показано: ${groupFilteredFeed.length} из ${avitoFeed.feedProducts.length}`}
                      </span>
                      <div className="flex gap-1.5 ml-auto items-center flex-wrap">
                        <Button
                          size="sm"
                          variant={hideInternalCols ? "default" : "outline"}
                          className="h-6 text-[10px] gap-1"
                          onClick={() => setHideInternalCols(v => !v)}
                          title="Скрыть служебные колонки (не идущие в выгрузку)"
                        >
                          {hideInternalCols ? "Показать все" : "Только выгрузка"}
                        </Button>
                        {selectedFeedProducts.size > 0 && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1">
                                <Folder className="h-3 w-3" /> В группу ({selectedFeedProducts.size})
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuGroup>
                                <DropdownMenuItem onSelect={async () => {
                                  await assignGroupFn(Array.from(selectedFeedProducts), null);
                                  setSelectedFeedProducts(new Set());
                                }}>
                                  <Inbox className="h-3.5 w-3.5 mr-2" /> Без группы
                                </DropdownMenuItem>
                              </DropdownMenuGroup>
                              {avitoGroups.length > 0 && <DropdownMenuSeparator />}
                              <DropdownMenuGroup>
                                {avitoGroups.map(g => (
                                  <DropdownMenuItem key={g.id} onSelect={async () => {
                                    await assignGroupFn(Array.from(selectedFeedProducts), g.id);
                                    setSelectedFeedProducts(new Set());
                                  }}>
                                    <span className={`h-2.5 w-2.5 rounded-full mr-2 ${colorClass(g.color)}`} />
                                    {g.name}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuGroup>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                        <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={() => {
                          const ids = selectedFeedProducts.size > 0 ? Array.from(selectedFeedProducts) : groupFilteredFeed.map(fp => fp.product_id);
                          openAiForProducts(ids, "title");
                        }}>
                          <Wand2 className="h-3 w-3" /> AI название {selectedFeedProducts.size > 0 ? `(${selectedFeedProducts.size})` : "(все)"}
                        </Button>
                        <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={() => {
                          const ids = selectedFeedProducts.size > 0 ? Array.from(selectedFeedProducts) : groupFilteredFeed.map(fp => fp.product_id);
                          openAiForProducts(ids, "description");
                        }}>
                          <Sparkles className="h-3 w-3" /> AI описание {selectedFeedProducts.size > 0 ? `(${selectedFeedProducts.size})` : "(все)"}
                        </Button>
                        {selectedFeedProducts.size > 0 && (
                          <>
                            <Button size="sm" variant="destructive" className="h-6 text-[10px]" onClick={async () => {
                              await avitoFeed.removeProductsFromFeed(Array.from(selectedFeedProducts));
                              setSelectedFeedProducts(new Set());
                            }}>
                              <X className="h-3 w-3 mr-0.5" /> Убрать
                            </Button>
                            <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setSelectedFeedProducts(new Set())}>Сбросить</Button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Table */}
                    <div className="flex-1 overflow-auto">
                      <AvitoFeedTable
                        feedProducts={groupFilteredFeed}
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
                        storeId={storeId || ""}
                        onUpdateProductParams={avitoFeed.updateProductParams}
                        onOpenInPhotoStudio={onOpenInPhotoStudio}
                        onOpenInPriceList={onOpenInPriceList}
                        autoOpenImageEditorForProductId={autoOpenImageEditorForProductId}
                        onAutoOpenImageEditorHandled={onAutoOpenImageEditorHandled}
                        groups={avitoGroups}
                        onAssignGroup={assignGroupFn}
                        onCreateGroup={createAvitoGroup}
                        hideInternal={hideInternalCols}
                      />
                    </div>
                  </>
                );
              })()}
              {(!avitoFeed || avitoFeed.feedProducts.length === 0) && (
                <div className="flex-1 overflow-auto">
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground mb-1">Нет товаров для размещения на Авито</p>
                      <p className="text-xs text-muted-foreground">Перейдите в «Ассортимент», выберите товары и нажмите «В Авито»</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Errors Tab */}
        <TabsContent value="errors" className="space-y-3">
          <input
            ref={errorsFileInputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImportAvitoErrorsFile(f);
            }}
          />

          {/* Видная карточка загрузки ошибок */}
          <Card className="border-2 border-dashed border-primary/40 bg-primary/5 p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Upload className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Загрузить файл ошибок Авито</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Загрузите XLSX-файл выгрузки Авито с колонкой «Ошибка». Система найдёт объявления по ID и подсветит проблемы.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  size="default"
                  className="h-9 px-4"
                  onClick={() => errorsFileInputRef.current?.click()}
                  disabled={importingErrors}
                >
                  {importingErrors ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  Загрузить XLSX
                </Button>
                {isConnected && (
                  <Button size="default" variant="outline" className="h-9 px-4" onClick={handleFetchAutoloadErrors} disabled={fetchingErrors}>
                    {fetchingErrors ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    Обновить с Авито
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {(() => {

            const fullList = (avitoFeed?.feedProducts || [])
              .map((fp) => {
                const product = storeProducts.find((sp) => sp.id === fp.product_id);
                if (!product) return null;
                const issues = computeAvitoIssues(fp, product, localDefaults);
                if (!issues.length) return null;
                return { fp, product, issues };
              })
              .filter(Boolean) as { fp: AvitoFeedProduct; product: Product; issues: AvitoIssue[] }[];

            const errorsCount = fullList.filter((r) => r.issues.some((i) => i.severity === "error" && i.kind !== "not_published")).length;
            const unpublishedCount = fullList.filter((r) => r.issues.some((i) => i.kind === "not_published")).length;
            const excludedCount = fullList.filter((r) => r.fp.avito_params?.excluded_from_feed === true).length;
            const fileCount = fullList.filter((r) => (r.fp.avito_params as any)?.moderation?.source === "xlsx_import").length;

            const list = fullList.filter((r) => {
              if (errorsFilter === "errors") return r.issues.some((i) => i.severity === "error" && i.kind !== "not_published");
              if (errorsFilter === "unpublished") return r.issues.some((i) => i.kind === "not_published");
              if (errorsFilter === "excluded") return r.fp.avito_params?.excluded_from_feed === true;
              if (errorsFilter === "file") return (r.fp.avito_params as any)?.moderation?.source === "xlsx_import";
              return true;
            });

            const titleFixable = list.filter((r) => r.issues.some((i) => i.kind === "title_missing" || i.kind === "title_too_long"));
            const descFixable = list.filter((r) => r.issues.some((i) => i.kind === "description_missing" || i.kind === "description_too_short"));
            const noImages = list.filter((r) => r.issues.some((i) => i.kind === "images_missing"));

            const filterChips = (
              <div className="flex items-center gap-1.5 flex-wrap">
                {([
                  { key: "all", label: `Все`, count: fullList.length },
                  { key: "file", label: `Из последнего файла`, count: fileCount },
                  { key: "errors", label: `Ошибки`, count: errorsCount },
                  { key: "unpublished", label: `Не опубликованы`, count: unpublishedCount },
                  { key: "excluded", label: `Отключены от автозалива`, count: excludedCount },
                ] as const).map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setErrorsFilter(c.key as any)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      errorsFilter === c.key
                        ? c.key === "unpublished"
                          ? "bg-amber-500/15 border-amber-500/50 text-amber-700 dark:text-amber-400"
                          : c.key === "errors"
                            ? "bg-destructive/15 border-destructive/50 text-destructive"
                            : c.key === "excluded"
                              ? "bg-muted border-muted-foreground/30 text-foreground"
                              : "bg-primary/15 border-primary/50 text-primary"
                        : "bg-background border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {c.label} <span className="ml-1 font-semibold">{c.count}</span>
                  </button>
                ))}
              </div>
            );

            if (fullList.length === 0) {
              return (
                <Card className="p-8 text-center">
                  <Check className="h-8 w-8 mx-auto mb-2 text-emerald-600" />
                  <p className="text-sm font-medium">Все объявления заполнены корректно</p>
                  <p className="text-xs text-muted-foreground mt-1">Здесь появятся объявления с проблемами: пустые поля, нет фото, длинное название и т.д.</p>
                </Card>
              );
            }

            return (
              <>
                {filterChips}
                <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <span className="text-sm font-medium">
                      Показано {list.length} из {fullList.length}
                      {errorsFilter === "unpublished" ? " (не опубликованные)" : errorsFilter === "errors" ? " (с ошибками)" : errorsFilter === "excluded" ? " (отключены)" : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {titleFixable.length > 0 && (
                      <Button size="sm" variant="outline" onClick={() => openAiForProducts(titleFixable.map((r) => r.product.id), "title")}>
                        <Wand2 className="h-3.5 w-3.5 mr-1" /> AI исправить названия ({titleFixable.length})
                      </Button>
                    )}
                    {descFixable.length > 0 && (
                      <Button size="sm" variant="outline" onClick={() => openAiForProducts(descFixable.map((r) => r.product.id), "description")}>
                        <Sparkles className="h-3.5 w-3.5 mr-1" /> AI исправить описания ({descFixable.length})
                      </Button>
                    )}
                    {noImages.length > 0 && onOpenInPhotoStudio && (
                      <Button size="sm" variant="outline" onClick={() => onOpenInPhotoStudio(noImages[0].product.id)}>
                        <ImagePlus className="h-3.5 w-3.5 mr-1" /> Сгенерировать фото ({noImages.length})
                      </Button>
                    )}
                    {(() => {
                      const catList = list.filter((r) => !!(r.fp.avito_params as any)?.moderation?.suggested_category);
                      if (catList.length === 0) return null;
                      return (
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={async () => {
                            let ok = 0;
                            for (const r of catList) {
                              const sug = (r.fp.avito_params as any)?.moderation?.suggested_category;
                              if (!sug) continue;
                              try {
                                await handleInlineParamUpdate(r.product.id, "category", sug);
                                ok++;
                              } catch {}
                            }
                            await avitoFeed!.refetch?.();
                            toast({ title: `Категории применены: ${ok} из ${catList.length}` });
                          }}
                        >
                          <Check className="h-3.5 w-3.5 mr-1" /> Применить все рекомендации ({catList.length})
                        </Button>
                      );
                    })()}
                    {(() => {
                      const modList = list.filter((r) => (r.issues.some((i) => i.severity === "error" && i.kind !== "not_published") || r.issues.some((i) => i.kind === "not_published")) && !r.fp.avito_params?.excluded_from_feed);
                      if (modList.length === 0) return null;
                      return (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={async () => {
                            for (const r of modList) {
                              await avitoFeed!.updateProductParams(r.product.id, { ...(r.fp.avito_params || {}), excluded_from_feed: true });
                            }
                            await avitoFeed!.refetch?.();
                            toast({ title: `Отключено от автозалива: ${modList.length}` });
                          }}
                        >
                          <AlertCircle className="h-3.5 w-3.5 mr-1" /> Отключить от автозалива ({modList.length})
                        </Button>
                      );
                    })()}
                  </div>
                </div>


                <div className="border rounded-lg overflow-hidden">
                  <ScrollArea className="h-[calc(100vh-280px)]">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow className="text-xs">
                          <TableHead className="w-14 px-2">Фото</TableHead>
                          <TableHead className="min-w-[220px] px-2">Товар</TableHead>
                          <TableHead className="px-2">Проблемы</TableHead>
                          <TableHead className="w-[280px] px-2 text-right">Действия</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {list.map(({ fp, product, issues }) => {
                          const imgs = (fp.avito_params?.avitoImages && fp.avito_params.avitoImages.length > 0)
                            ? fp.avito_params.avitoImages
                            : (product.images || []);
                          const firstImg = imgs[0];
                          const canFixTitle = issues.some((i) => i.kind === "title_missing" || i.kind === "title_too_long");
                          const canFixDesc = issues.some((i) => i.kind === "description_missing" || i.kind === "description_too_short");
                          const needPhoto = issues.some((i) => i.kind === "images_missing");
                          const shortId = String(fp.product_id || "").slice(0, 8);
                          const modMessages: any[] = Array.isArray(fp.avito_params?.moderation?.messages) ? fp.avito_params.moderation.messages : [];
                          const excluded = fp.avito_params?.excluded_from_feed === true;
                          const modStatus: string | undefined = fp.avito_params?.moderation?.status;
                          const notPublished = fp.avito_params?.moderation?.published === false;
                          const hasHardError = issues.some((i) => i.severity === "error" && i.kind !== "not_published");
                          const rowTone = excluded
                            ? "opacity-60 bg-muted/30"
                            : notPublished && !hasHardError
                              ? "bg-amber-500/10 border-l-4 border-l-amber-500"
                              : hasHardError
                                ? "bg-destructive/5 border-l-4 border-l-destructive"
                                : "";
                          return (
                            <TableRow key={fp.product_id} className={`align-top ${rowTone}`}>
                              <TableCell className="px-2 py-2">
                                {firstImg ? (
                                  <img src={firstImg} alt="" className="w-12 h-12 rounded object-cover" />
                                ) : (
                                  <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="px-2 py-2">
                                <div className="flex items-center gap-1 flex-wrap mb-1">
                                  <button
                                    type="button"
                                    title="ID объявления (клик — скопировать)"
                                    onClick={() => { navigator.clipboard?.writeText(shortId); toast({ title: "ID скопирован", description: shortId }); }}
                                    className={`font-mono text-[10px] px-1 py-0 rounded ${hasHardError ? "bg-destructive/10 text-destructive hover:bg-destructive/20" : notPublished ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-500/25" : "bg-muted text-muted-foreground hover:text-foreground"}`}
                                  >
                                    #{shortId}
                                  </button>
                                  {notPublished && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 font-medium">
                                      {modStatus ? `не опубл.: ${modStatus}` : "не опубл."}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs font-medium leading-tight line-clamp-2">{product.name}</div>
                                {product.sku && <div className="text-[10px] text-muted-foreground mt-1">арт. {product.sku}</div>}
                                {excluded && <div className="text-[10px] text-muted-foreground mt-1">не в автозаливе</div>}
                              </TableCell>
                              <TableCell className="px-2 py-2">
                                <div className="flex flex-wrap gap-1 mb-1">
                                  {issues.filter((i) => i.kind !== "avito_moderation").map((iss, idx) => (
                                    <Badge
                                      key={idx}
                                      variant={iss.severity === "error" ? "destructive" : "secondary"}
                                      className="text-[10px] font-normal"
                                    >
                                      {iss.severity === "error"
                                        ? <AlertCircle className="h-2.5 w-2.5 mr-1" />
                                        : <AlertTriangle className="h-2.5 w-2.5 mr-1" />}
                                      {iss.label}
                                    </Badge>
                                  ))}
                                </div>
                                {modMessages.length > 0 && (
                                  <div className="rounded border border-destructive/30 bg-destructive/5 p-2 space-y-1.5">
                                    <div className="text-[10px] uppercase tracking-wide text-destructive font-semibold flex items-center gap-1">
                                      <AlertCircle className="h-3 w-3" /> Что исправить (по выгрузке Авито)
                                    </div>
                                    {modMessages.map((m: any, i: number) => (
                                      <div key={i} className="text-[11px] leading-snug">
                                        <div className="font-medium">• {m.text}</div>
                                        {m.hint && <div className="text-muted-foreground italic whitespace-pre-line">{m.hint}</div>}
                                        {m.field && <div className="text-[9px] uppercase text-muted-foreground/70 mt-0.5">поле: {m.field}</div>}
                                      </div>
                                    ))}
                                    {(() => {
                                      const sug: string | undefined = (fp.avito_params as any)?.moderation?.suggested_category;
                                      if (!sug) return null;
                                      const parts = sug.split("---");
                                      return (
                                        <div className="rounded bg-emerald-500/10 border border-emerald-500/30 p-1.5 mt-1.5">
                                          <div className="text-[10px] uppercase tracking-wide text-emerald-700 dark:text-emerald-400 font-semibold mb-0.5">
                                            Рекомендуемая категория
                                          </div>
                                          <div className="text-[11px] font-medium leading-tight mb-1">
                                            {parts.join(" → ")}
                                          </div>
                                          <Button
                                            size="sm"
                                            className="h-6 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white"
                                            onClick={async () => {
                                              await handleInlineParamUpdate(product.id, "category", sug);
                                              await avitoFeed!.refetch?.();
                                            }}
                                          >
                                            <Check className="h-3 w-3 mr-1" /> Применить категорию
                                          </Button>
                                        </div>
                                      );
                                    })()}
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-6 text-[10px] mt-1"
                                      onClick={() => {
                                        const text = modMessages.map((m: any) => `• ${m.text}${m.hint ? "\n  " + m.hint : ""}`).join("\n");
                                        navigator.clipboard?.writeText(text);
                                        toast({ title: "Инструкция скопирована" });
                                      }}
                                    >
                                      <CopyIcon className="h-3 w-3 mr-1" /> Скопировать инструкцию
                                    </Button>
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="px-2 py-2 text-right">
                                <div className="flex items-center justify-end gap-1 flex-wrap">
                                  {canFixTitle && (
                                    <Button size="sm" variant="outline" className="h-7 text-[11px]"
                                      onClick={() => openAiForProducts([product.id], "title")}>
                                      <Wand2 className="h-3 w-3 mr-1" /> AI название
                                    </Button>
                                  )}
                                  {canFixDesc && (
                                    <Button size="sm" variant="outline" className="h-7 text-[11px]"
                                      onClick={() => openAiForProducts([product.id], "description")}>
                                      <Sparkles className="h-3 w-3 mr-1" /> AI описание
                                    </Button>
                                  )}
                                  {needPhoto && onOpenInPhotoStudio && (
                                    <Button size="sm" variant="outline" className="h-7 text-[11px]"
                                      onClick={() => onOpenInPhotoStudio(product.id)}>
                                      <ImagePlus className="h-3 w-3 mr-1" /> Фото
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant={excluded ? "default" : "outline"}
                                    className="h-7 text-[11px]"
                                    onClick={async () => {
                                      await avitoFeed!.updateProductParams(product.id, { ...(fp.avito_params || {}), excluded_from_feed: !excluded });
                                      await avitoFeed!.refetch?.();
                                    }}
                                  >
                                    {excluded ? "Вернуть в автозалив" : "Не заливать"}
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-7 text-[11px]"
                                    onClick={() => { setActiveTab("feed"); setFeedSearchQuery(shortId); }}>
                                    Открыть
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Кнопки AI открывают окно генерации — там вы задаёте инструкцию и нажимаете «Сгенерировать». Результат сохраняется автоматически и подставляется в объявление.
                </p>
              </>
            );
          })()}
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
      {/* AI Generation Sheet — used only for TITLE mode */}
      <Sheet open={aiPromptOpen && aiMode === "title"} onOpenChange={(open) => { setAiPromptOpen(open); if (!open) setAiSingleProductId(null); }}>
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
              <Button className="flex-1" onClick={() => handleAiGenerate()} disabled={aiGenerating}>
                {aiGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Wand2 className="h-3.5 w-3.5 mr-1" />}
                {aiGenerating ? `${aiProgress.done}/${aiProgress.total}...` : (aiMode === "title" ? "Сократить названия" : "Сгенерировать")}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Full-screen workspace for DESCRIPTION mode */}
      <AvitoAiDescriptionWorkspace
        open={aiPromptOpen && aiMode === "description"}
        onOpenChange={(open) => { setAiPromptOpen(open); if (!open) setAiSingleProductId(null); }}
        selectedCount={selectedFeedProducts.size}
        singleProduct={aiSingleProductId ? (() => {
          const p = storeProducts.find(sp => sp.id === aiSingleProductId);
          return p ? { id: p.id, name: p.name, description: p.description, pricePerUnit: p.pricePerUnit } : null;
        })() : null}
        previewProduct={(() => {
          const firstId = aiSingleProductId || Array.from(selectedFeedProducts)[0] || avitoFeed?.feedProducts[0]?.product_id;
          const p = firstId ? storeProducts.find(sp => sp.id === firstId) : null;
          return p ? { id: p.id, name: p.name, description: p.description, pricePerUnit: p.pricePerUnit } : null;
        })()}
        city={localDefaults.address?.split(",")[0]?.trim() || "Москва"}
        instruction={aiInstruction}
        setInstruction={setAiInstruction}
        maxChars={aiMaxChars}
        setMaxChars={setAiMaxChars}
        templates={savedTemplates}
        onSaveTemplate={(tpl) => {
          const full: AiTemplate = { id: Date.now().toString(), ...tpl };
          const updated = [...savedTemplates, full];
          setSavedTemplates(updated);
          localStorage.setItem(TEMPLATES_KEY, JSON.stringify(updated));
          toast({ title: "Шаблон сохранён" });
        }}
        onDeleteTemplate={deleteTemplate}
        generating={aiGenerating}
        progress={aiProgress}
        onGenerate={({ instruction, maxChars, priceMode, customPrice }) => {
          setAiInstruction(instruction);
          setAiMaxChars(maxChars);
          handleAiGenerate({ instruction, maxChars, priceMode, customPrice });
        }}
      />

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
