import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import { Switch } from "@/components/ui/switch";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { ArrowLeft, Package, Download, RefreshCw, Check, X, Loader2, Image as ImageIcon, LogIn, Lock, Unlock, ExternalLink, Filter, Plus, ChevronRight, Trash2, FolderOpen, Edit2, Settings, Users, Shield, ChevronDown, ChevronUp, Tag, Store, Clipboard, Link2, Copy, ShoppingCart, Eye, EyeOff, Clock, ChevronsUpDown, Send, MessageCircle, Mail, User, Key, LogOut, FileSpreadsheet, Sheet, Upload, Sparkles, RotateCcw, FileText } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ResizableTable,
  ResizableTableBody,
  ResizableTableCell,
  ResizableTableHead,
  ResizableTableHeader,
  ResizableTableRow,
  SortableTableBody,
  SortableTableRow,
  DraggableTableWrapper,
  OrderedCellsContainer,
} from "@/components/admin/ResizableTable";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Product,
  ProductStatus,
  MoySkladProduct,
  MoySkladAccount,
  MoySkladImageInfo,
  Catalog,
  CatalogProductPricing,
  CustomerRole,
  RoleProductPricing,
  formatPrice,
  calculateSalePrice,
  calculatePackagingPrices,
  packagingTypeLabels,
  PackagingType,
  MarkupSettings,
  PortionPrices,
} from "@/components/admin/types";
import { ProductPricingDialog } from "@/components/admin/ProductPricingDialog";

import { InlineProductRow } from "@/components/admin/InlineProductRow";
import { InlineEditableCell } from "@/components/admin/InlineEditableCell";
import { InlineSelectCell } from "@/components/admin/InlineSelectCell";
import { InlineMultiSelectCell } from "@/components/admin/InlineMultiSelectCell";
import { InlinePriceCell } from "@/components/admin/InlinePriceCell";
import { InlineMarkupCell } from "@/components/admin/InlineMarkupCell";
import { MobileTabNav } from "@/components/admin/MobileTabNav";
import { BulkEditPanel } from "@/components/admin/BulkEditPanel";
import { uploadProductImages, deleteSingleImage, uploadFilesToStorage } from "@/hooks/useProductImages";
import { ImageGalleryViewer } from "@/components/admin/ImageGalleryViewer";
import { SyncSettingsPanel, SyncSettings, SyncFieldMapping, defaultSyncSettings } from "@/components/admin/SyncSettingsPanel";
import { useStoreProducts, StoreProduct } from "@/hooks/useStoreProducts";
import { useStoreCatalogs, Catalog as StoreCatalog } from "@/hooks/useStoreCatalogs";

import { useMoyskladAccounts, MoyskladAccount } from "@/hooks/useMoyskladAccounts";
import { useStoreSyncSettings, SyncSettings as StoreSyncSettings, SyncFieldMapping as StoreSyncFieldMapping, defaultSyncSettings as defaultStoreSyncSettings } from "@/hooks/useStoreSyncSettings";
import { useStoreOrders, Order } from "@/hooks/useOrders";
import { StoreCustomersTable } from "@/components/admin/StoreCustomersTable";
import { useCatalogProductSettings } from "@/hooks/useCatalogProductSettings";
import { useProductGroups } from "@/hooks/useProductGroups";
import { useProductCategories } from "@/hooks/useProductCategories";
import { useStoreCategories, StoreCategory } from "@/hooks/useStoreCategories";
import { CategoryOrderDialog } from "@/components/admin/CategoryOrderDialog";
import { useStoreNotificationSettings } from "@/hooks/useStoreNotificationSettings";
import { useMoyskladOrders } from "@/hooks/useMoyskladOrders";
import { Textarea } from "@/components/ui/textarea";
import { ImportSourceCard } from "@/components/admin/ImportSourceCard";
import { downloadExcelTemplate, importProductsFromExcel, ImportProgress, exportProductsToExcel, exportCatalogToExcel, CatalogExportProduct } from "@/lib/excelImport";
import { ExcelImportSection } from "@/components/admin/ExcelImportSection";
import { CatalogExportDialog } from "@/components/admin/CatalogExportDialog";
import { CatalogPdfExportDialog } from "@/components/admin/CatalogPdfExportDialog";
import { CatalogImportDialog } from "@/components/admin/CatalogImportDialog";
import { exportCatalogToPdf } from "@/lib/pdfExport";
import { QuickStartList } from "@/components/onboarding/QuickStartList";
import { AdminOnboardingBanner } from "@/components/onboarding/AdminOnboardingBanner";
import { AIAssistantPanel } from "@/components/admin/AIAssistantPanel";
import { ActivityHistorySection } from "@/components/admin/ActivityHistorySection";
import { TrashSection } from "@/components/admin/TrashSection";
import { RetailSettingsSection } from "@/components/admin/RetailSettingsSection";
import { WholesaleSettingsSection } from "@/components/admin/WholesaleSettingsSection";
import { FormingOrdersSection } from "@/components/admin/FormingOrdersSection";
import { ProductsSection } from "@/components/admin/ProductsSection";
import { CategorySettingsSection } from "@/components/admin/CategorySettingsSection";
import { MegacatalogSection } from "@/components/admin/MegacatalogSection";
import { ExchangeSection } from "@/components/admin/ExchangeSection";
import { OrdersSection } from "@/components/admin/OrdersSection";
import { MoyskladCounterpartiesSection } from "@/components/admin/MoyskladCounterpartiesSection";
import { AvitoSection } from "@/components/admin/AvitoSection";
import { useAvitoFeedProducts } from "@/hooks/useAvitoFeedProducts";

// Removed localStorage keys - now using Supabase

// Local test products
const testProducts: Product[] = [
  {
    id: "1",
    name: "Пармезан Reggiano 24 мес",
    description: "Выдержка 24 месяца, Италия",
    pricePerUnit: 2890,
    buyPrice: 2200,
    markup: { type: "percent", value: 30 },
    unit: "кг",
    image: "https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=400&h=400&fit=crop",
    productType: "weight",
    packagingType: "head",
    unitWeight: 38,
    weightVariants: [
      { type: "full", weight: 38 },
      { type: "half", weight: 19 },
      { type: "quarter", weight: 9.5 },
    ],
    inStock: true,
    isHit: true,
  },
  {
    id: "2",
    name: "Грана Падано DOP",
    description: "Выдержка 16 месяцев",
    pricePerUnit: 1890,
    unit: "кг",
    image: "https://images.unsplash.com/photo-1552767059-ce182ead6c1b?w=400&h=400&fit=crop",
    productType: "weight",
    weightVariants: [
      { type: "full", weight: 35 },
      { type: "half", weight: 17.5 },
    ],
    inStock: true,
    isHit: false,
  },
  {
    id: "3",
    name: "Хамон Серрано Резерва",
    description: "Выдержка 18 месяцев, Испания",
    pricePerUnit: 3490,
    unit: "кг",
    image: "https://images.unsplash.com/photo-1600891964092-4316c288032e?w=400&h=400&fit=crop",
    productType: "weight",
    weightVariants: [
      { type: "full", weight: 7.5 },
      { type: "half", weight: 3.75 },
    ],
    inStock: true,
    isHit: true,
  },
  {
    id: "4",
    name: "Моцарелла Буффало",
    description: "Свежая, 125г",
    pricePerUnit: 390,
    unit: "шт",
    image: "https://images.unsplash.com/photo-1631379578550-7038263db699?w=400&h=400&fit=crop",
    productType: "piece",
    pieceVariants: [
      { type: "box", quantity: 12 },
      { type: "single", quantity: 1 },
    ],
    inStock: true,
    isHit: false,
  },
  {
    id: "5",
    name: "Бри де Мо AOP",
    description: "Мягкий сыр с белой плесенью",
    pricePerUnit: 2190,
    unit: "кг",
    image: "https://images.unsplash.com/photo-1559561853-08451507cbe7?w=400&h=400&fit=crop",
    productType: "weight",
    weightVariants: [
      { type: "full", weight: 2.8 },
      { type: "half", weight: 1.4 },
      { type: "quarter", weight: 0.7 },
    ],
    inStock: false,
    isHit: false,
  },
  {
    id: "6",
    name: "Чоризо Иберико",
    description: "Сыровяленая колбаса, 200г",
    pricePerUnit: 890,
    unit: "шт",
    image: "https://images.unsplash.com/photo-1623653387945-2fd25214f8fc?w=400&h=400&fit=crop",
    productType: "piece",
    pieceVariants: [
      { type: "box", quantity: 6 },
      { type: "single", quantity: 1 },
    ],
    inStock: true,
    isHit: false,
  },
  {
    id: "7",
    name: "Пекорино Романо DOP",
    description: "Овечий сыр, 12 мес",
    pricePerUnit: 2450,
    unit: "кг",
    image: "https://images.unsplash.com/photo-1589881133595-a3c085cb731d?w=400&h=400&fit=crop",
    productType: "weight",
    weightVariants: [
      { type: "full", weight: 25 },
      { type: "half", weight: 12.5 },
    ],
    inStock: true,
    isHit: false,
  },
  {
    id: "8",
    name: "Горгонзола Дольче",
    description: "Мягкая с голубой плесенью",
    pricePerUnit: 1990,
    unit: "кг",
    image: "https://images.unsplash.com/photo-1452195100486-9cc805987862?w=400&h=400&fit=crop",
    productType: "weight",
    weightVariants: [
      { type: "full", weight: 6 },
      { type: "half", weight: 3 },
    ],
    inStock: true,
    isHit: false,
  },
  {
    id: "9",
    name: "Манчего 6 мес",
    description: "Испанский овечий сыр",
    pricePerUnit: 2290,
    unit: "кг",
    image: "https://images.unsplash.com/photo-1634487359989-3e90c9432133?w=400&h=400&fit=crop",
    productType: "weight",
    weightVariants: [
      { type: "full", weight: 3.2 },
      { type: "half", weight: 1.6 },
    ],
    inStock: true,
    isHit: true,
  },
  {
    id: "10",
    name: "Прошутто ди Парма",
    description: "18 месяцев выдержки",
    pricePerUnit: 4890,
    unit: "кг",
    image: "https://images.unsplash.com/photo-1551248429-40975aa4de74?w=400&h=400&fit=crop",
    productType: "weight",
    weightVariants: [
      { type: "full", weight: 8 },
      { type: "half", weight: 4 },
    ],
    inStock: true,
    isHit: false,
  },
];

const formatVariants = (product: Product) => {
  if (product.productType === "weight" && product.weightVariants) {
    return product.weightVariants
      .map((v) => {
        const label = v.type === "full" ? "Целая" : v.type === "half" ? "Половина" : "Четверть";
        return `${label}: ${v.weight} кг`;
      })
      .join(", ");
  }
  if (product.productType === "piece" && product.pieceVariants) {
    return product.pieceVariants
      .map((v) => {
        const label = v.type === "box" ? "Коробка" : "Штука";
        return `${label}: ${v.quantity} шт`;
      })
      .join(", ");
  }
  return "-";
};

type ActiveSection = "products" | "megacatalog" | "import" | "catalogs" | "visibility" | "profile" | "orders" | "clients" | "history" | "trash" | "help" | "retail" | "showcase" | "wholesale" | "category-settings" | "exchange" | "avito";
type ImportView = "accounts" | "catalog" | "counterparties";
type ImportSource = "select" | "moysklad" | "excel" | "google-sheets";
type CatalogView = "list" | "detail";

const CATALOGS_KEY = "admin_catalogs";

// Filter component for column headers
function ColumnFilter({ 
  value, 
  onChange, 
  placeholder 
}: { 
  value: string; 
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <Input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-5 text-[10px] px-1"
    />
  );
}

function SelectFilter({
  value,
  onChange,
  options,
  placeholder
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-5 text-[10px] px-1">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{placeholder}</SelectItem>
        {options.map(opt => (
          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function MultiSelectFilter({
  values,
  onChange,
  options,
  placeholder
}: {
  values: string[];
  onChange: (values: string[]) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = (optionValue: string) => {
    if (values.includes(optionValue)) {
      onChange(values.filter(v => v !== optionValue));
    } else {
      onChange([...values, optionValue]);
    }
  };

  const selectedLabels = values
    .map(v => options.find(o => o.value === v)?.label)
    .filter(Boolean);

  const displayText = values.length === 0 
    ? placeholder 
    : selectedLabels.length <= 1 
      ? selectedLabels.join(", ") 
      : `${selectedLabels.length} групп`;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button className={`flex items-center justify-between w-full h-5 text-[10px] px-1 border rounded-md bg-background hover:bg-muted/50 ${values.length > 0 ? 'border-primary/50' : 'border-input'}`}>
          <span className="truncate">{displayText}</span>
          <ChevronDown className="h-3 w-3 ml-1 flex-shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="start">
        <div className="flex flex-col gap-0.5 max-h-[200px] overflow-y-auto">
          {options.map((option) => {
            const isSelected = values.includes(option.value);
            return (
              <div
                key={option.value}
                onClick={() => handleToggle(option.value)}
                className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted cursor-pointer text-xs"
              >
                <Checkbox checked={isSelected} className="h-3 w-3 pointer-events-none" />
                <span className="truncate">{option.label}</span>
              </div>
            );
          })}
          {options.length === 0 && (
            <p className="text-xs text-muted-foreground px-2 py-1">Нет групп</p>
          )}
        </div>
        {values.length > 0 && (
          <div className="border-t mt-1 pt-1">
            <button
              onClick={() => onChange([])}
              className="w-full text-xs text-muted-foreground hover:text-foreground px-2 py-1 text-left"
            >
              Сбросить фильтр
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// Props interface for workspace mode
interface AdminPanelProps {
  workspaceMode?: boolean;
  storeIdOverride?: string;
  storeSubdomainOverride?: string;
  onSwitchToStorefront?: () => void;
  initialSection?: ActiveSection;
}

export default function AdminPanel({ 
  workspaceMode, 
  storeIdOverride, 
  storeSubdomainOverride,
  onSwitchToStorefront,
  initialSection
}: AdminPanelProps = {}) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { user, profile, isSuperAdmin, loading: authLoading, signOut } = useAuth();
  const isMobile = useIsMobile();

  // Note: We don't force auth redirect here - admin panel can be viewed without login
  // Auth is only required for specific actions like uploading images

  // Store context - for super admin switching
  const storeIdFromUrl = searchParams.get('storeId');
  const sectionFromUrl = searchParams.get('section');
  const [currentStoreId, setCurrentStoreId] = useState<string | null>(null);
  const [currentStoreName, setCurrentStoreName] = useState<string | null>(null);
  const [currentStoreSubdomain, setCurrentStoreSubdomain] = useState<string | null>(null);
  const [userStoreId, setUserStoreId] = useState<string | null>(null);
  // В workspaceMode загрузка контекста не нужна - сразу false
  const [storeContextLoading, setStoreContextLoading] = useState(!workspaceMode || !storeIdOverride);
  
  // Determine which store context to use - workspace mode takes priority
  // IMPORTANT: do NOT fallback to currentStoreId here, because it can temporarily differ from
  // userStoreId during async context resolution, causing the assortment to "flash" and disappear.
  const effectiveStoreId = workspaceMode && storeIdOverride ? storeIdOverride : (storeIdFromUrl || userStoreId);
  
  // ================ SUPABASE DATA HOOKS ================
  // Products from Supabase
  const { 
    products: supabaseProducts, 
    loading: productsLoading, 
    createProduct: createSupabaseProduct,
    updateProduct: updateSupabaseProduct,
    deleteProduct: deleteSupabaseProduct,
    deleteProducts: deleteSupabaseProducts,
    refetch: refetchProducts
  } = useStoreProducts(effectiveStoreId);
  
  // Avito feed products
  const avitoFeed = useAvitoFeedProducts(effectiveStoreId);
  
  // Catalogs from Supabase
  const {
    catalogs: supabaseCatalogs,
    productVisibility: supabaseProductVisibility,
    loading: catalogsLoading,
    createCatalog: createSupabaseCatalog,
    updateCatalog: updateSupabaseCatalog,
    deleteCatalog: deleteSupabaseCatalog,
    toggleProductVisibility: toggleSupabaseProductVisibility,
    setProductCatalogs: setSupabaseProductCatalogs,
    removeProductsFromCatalog: removeSupabaseProductsFromCatalog,
    refetch: refetchCatalogs
  } = useStoreCatalogs(effectiveStoreId);
  
  // MoySklad accounts from Supabase
  const {
    accounts: supabaseMoyskladAccounts,
    loading: accountsLoading,
    createAccount: createMoyskladAccount,
    updateAccount: updateMoyskladAccount,
    deleteAccount: deleteMoyskladAccount,
    refetch: refetchAccounts
  } = useMoyskladAccounts(effectiveStoreId);
  
  // Sync settings from Supabase
  const {
    settings: supabaseSyncSettings,
    loading: syncSettingsLoading,
    updateSettings: updateSyncSettings,
  } = useStoreSyncSettings(effectiveStoreId);
  
  
  // Orders from Supabase
  const {
    orders,
    loading: ordersLoading,
    updateOrderStatus,
    refetch: refetchOrders
  } = useStoreOrders(effectiveStoreId);
  
  // Notification settings from Supabase
  const {
    settings: notificationSettings,
    loading: notificationSettingsLoading,
    saving: savingNotificationSettings,
    saveSettings: saveNotificationSettings,
  } = useStoreNotificationSettings(effectiveStoreId);

  // Get first MoySklad account credentials for order sync
  const firstMoyskladAccount = supabaseMoyskladAccounts[0] || null;
  
  // MoySklad orders hook for fetching organizations and counterparties
  const {
    organizations: moyskladOrganizations,
    counterparties: moyskladCounterparties,
    loading: moyskladOrdersLoading,
    fetchOrganizations,
    fetchCounterparties,
  } = useMoyskladOrders(
    firstMoyskladAccount?.login || null,
    firstMoyskladAccount?.password || null
  );

  // MoySklad order settings state
  const [moyskladOrderSettingsOpen, setMoyskladOrderSettingsOpen] = useState(false);
  const [savingMoyskladOrderSettings, setSavingMoyskladOrderSettings] = useState(false);

  const handleCopySellerOrder = async (order: Order) => {
    if (!order.items || order.items.length === 0) return;

    const statusText = 
      order.status === 'pending' ? 'Новый' :
      order.status === 'processing' ? 'В обработке' :
      order.status === 'shipped' ? 'Отправлен' :
      order.status === 'delivered' ? 'Доставлен' :
      'Отменён';

    const orderDate = new Date(order.created_at);
    const dateStr = orderDate.toLocaleDateString('ru-RU', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
    const timeStr = orderDate.toLocaleTimeString('ru-RU', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    // Header
    let text = `📦 ЗАКАЗ ${order.order_number}\n`;
    text += `📅 ${dateStr} в ${timeStr}\n`;
    text += `📍 Статус: ${statusText}\n`;
    if (order.customer_name) text += `👤 Клиент: ${order.customer_name}\n`;
    text += `─────────────────────\n\n`;

    // Items
    text += `🛒 ТОВАРЫ:\n\n`;
    order.items.forEach((item, idx) => {
      text += `${idx + 1}. ${item.product_name}\n`;
      text += `   ${item.quantity} шт × ${item.price.toLocaleString()} ₽ = ${item.total.toLocaleString()} ₽\n`;
    });

    text += `\n─────────────────────\n`;
    text += `📊 ИТОГО: ${order.items.length} поз.\n`;
    text += `💰 СУММА: ${order.total.toLocaleString()} ₽\n`;

    // Shipping address
    if (order.shipping_address) {
      text += `\n─────────────────────\n`;
      text += `📬 ДОСТАВКА:\n`;
      if (order.shipping_address.name) text += `👤 ${order.shipping_address.name}\n`;
      if (order.shipping_address.phone) text += `📱 ${order.shipping_address.phone}\n`;
      if (order.shipping_address.address) text += `🏠 ${order.shipping_address.address}\n`;
      if (order.shipping_address.comment) text += `💬 ${order.shipping_address.comment}\n`;
    }

    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Заказ скопирован",
        description: "Можно вставить в мессенджер",
      });
    } catch (err) {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        toast({
          title: "Заказ скопирован",
          description: "Можно вставить в мессенджер",
        });
      } catch (e) {
        toast({
          title: "Ошибка",
          description: "Не удалось скопировать",
          variant: "destructive",
        });
      }
      document.body.removeChild(textArea);
    }
  };
  
  // Catalog product settings from Supabase (categories, markup, status per catalog)
  const {
    settings: catalogProductSettings,
    getProductSettings: getCatalogProductSettingsFromDB,
    updateProductSettings: updateCatalogProductSettingsInDB,
    bulkUpdateStatus: bulkUpdateCatalogStatus,
    updateProductSortOrders: updateCatalogProductSortOrders,
    refetch: refetchCatalogProductSettings
  } = useCatalogProductSettings(effectiveStoreId);
  
  // Product groups from Supabase
  const {
    groups: productGroups,
    getProductGroupIds,
    setProductGroups: setProductGroupAssignments,
    createGroup: createProductGroup,
    deleteGroup: deleteProductGroup,
    refetch: refetchProductGroups,
  } = useProductGroups(effectiveStoreId);

  // Product categories
  const {
    getProductCategoryIds,
    setProductCategoryAssignments,
  } = useProductCategories(effectiveStoreId);

  // Store categories from Supabase
  const { categories: storeCategories, loading: categoriesLoading, createCategory, updateCategoryOrder, updateCatalogCategoryOrder, renameCategory, deleteCategory, refetch: refetchCategories } = useStoreCategories(effectiveStoreId);
  const [categoryOrderDialogOpen, setCategoryOrderDialogOpen] = useState(false);
  const [categoryOrderCatalogId, setCategoryOrderCatalogId] = useState<string | null>(null);
  // ================ END SUPABASE DATA HOOKS ================
  
  const [activeSection, setActiveSection] = useState<ActiveSection>(() => {
    // В workspace режиме используем initialSection если передан
    if (workspaceMode && initialSection) {
      return initialSection;
    }
    const section = searchParams.get('section');
    if (section === 'products' || section === 'import' || section === 'catalogs' || section === 'visibility' || section === 'profile' || section === 'orders' || section === 'clients') {
      return section;
    }
    return "products";
  });
  
  // Sync activeSection with URL parameter changes (только при внешних изменениях URL)
  // Используем ref чтобы избежать двойного рендера при setSearchParams
  const isInternalUrlChange = useRef(false);
  
  useEffect(() => {
    if (isInternalUrlChange.current) {
      isInternalUrlChange.current = false;
      return;
    }
    
    // В workspace режиме синхронизируемся с initialSection
    if (workspaceMode && initialSection) {
      setActiveSection(initialSection);
      return;
    }
    
    const section = searchParams.get('section');
    if (section === 'products' || section === 'import' || section === 'catalogs' || section === 'visibility' || section === 'orders' || section === 'clients' || section === 'help' || section === 'category-settings' || section === 'profile' || section === 'history' || section === 'trash' || section === 'retail' || section === 'wholesale' || section === 'avito' || section === 'showcase' || section === 'megacatalog' || section === 'exchange') {
      setActiveSection(section);
    }
  }, [searchParams, workspaceMode, initialSection]);
  
  // Product visibility in catalogs state - now using Supabase data
  const productCatalogVisibility = supabaseProductVisibility;
  // Create a setter wrapper for compatibility
  const setProductCatalogVisibility = useCallback((updater: ((prev: Record<string, Set<string>>) => Record<string, Set<string>>) | Record<string, Set<string>>) => {
    // For now, visibility is managed through toggleSupabaseProductVisibility
    // This is a no-op placeholder for compatibility
    console.log('setProductCatalogVisibility is now managed through Supabase hooks');
  }, []);
  
  const [importView, setImportView] = useState<ImportView>("accounts");
  const [importSource, setImportSource] = useState<ImportSource>("select");
  
  // MoySklad import state
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [moyskladProducts, setMoyskladProducts] = useState<MoySkladProduct[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [totalProducts, setTotalProducts] = useState(0);
  
  // Convert Supabase products to legacy Product format for compatibility
  const importedProducts: Product[] = useMemo(() => {
    return supabaseProducts
      .filter(p => p.source === 'moysklad')
      .map(sp => ({
        id: sp.id,
        name: sp.name,
        description: sp.description || "",
        pricePerUnit: sp.price,
        buyPrice: sp.buy_price || undefined,
        markup: sp.markup_type && sp.markup_value ? { 
          type: (sp.markup_type === "fixed" ? "rubles" : sp.markup_type) as "percent" | "rubles", 
          value: sp.markup_value 
        } : undefined,
        unit: sp.unit || "кг",
        image: sp.images?.[0] || "",
        imageFull: sp.images?.[0] || "",
        images: sp.images || [],
        productType: sp.unit === "шт" ? "piece" as const : "weight" as const,
        packagingType: (sp.packaging_type || "piece") as PackagingType,
        unitWeight: sp.unit_weight || undefined,
        inStock: (sp.quantity || 0) > 0,
        isHit: false,
        source: "moysklad" as const,
        moyskladId: sp.moysklad_id || undefined,
        autoSync: sp.auto_sync || false,
        accountId: sp.moysklad_account_id || undefined,
        syncedMoyskladImages: sp.synced_moysklad_images || [],
        status: sp.is_active ? "in_stock" as const : "hidden" as const,
        isFixedPrice: sp.is_fixed_price || false,
        moyskladPrices: sp.moysklad_prices || null,
      }));
  }, [supabaseProducts]);
  
  // Wrapper to update products in Supabase
  const setImportedProducts = useCallback((updater: React.SetStateAction<Product[]>) => {
    // This is a complex migration - for now we'll handle updates via direct Supabase calls
    console.log('setImportedProducts now routes through Supabase');
  }, []);
  
  // Use Supabase accounts - create alias for compatibility
  const accounts = supabaseMoyskladAccounts;
  const setAccounts = useCallback((updater: React.SetStateAction<MoyskladAccount[]>) => {
    // This is managed via Supabase hooks
    console.log('setAccounts now routes through Supabase');
  }, []);
  
  const [currentAccount, setCurrentAccount] = useState<MoyskladAccount | null>(null);
  const [newAccountLogin, setNewAccountLogin] = useState("");
  const [newAccountPassword, setNewAccountPassword] = useState("");
  const [newAccountName, setNewAccountName] = useState("");
  const [showAddAccount, setShowAddAccount] = useState(false);

  const getMoyskladCacheKey = useCallback((accountId: string) => {
    return `moysklad_catalog_cache:${effectiveStoreId || "no-store"}:${accountId}`;
  }, [effectiveStoreId]);

  const hydrateMoyskladProductsFromCache = useCallback((account: MoyskladAccount): boolean => {
    try {
      const raw = localStorage.getItem(getMoyskladCacheKey(account.id));
      if (!raw) return false;

      const parsed = JSON.parse(raw) as { products?: MoySkladProduct[]; total?: number; cachedAt?: string };
      const cachedProducts = Array.isArray(parsed?.products) ? parsed.products : [];
      if (cachedProducts.length === 0) return false;

      setMoyskladProducts(cachedProducts);
      setTotalProducts(parsed.total || cachedProducts.length);
      return true;
    } catch {
      return false;
    }
  }, [getMoyskladCacheKey]);

  // Filters for "All Products" table
  const [allProductsFilters, setAllProductsFilters] = useState({
    name: "",
    sku: "",
    desc: "",
    source: "all",
    unit: "all",
    type: "all",
    volume: "",
    cost: "",
    status: "all",
    sync: "all",
    groups: [] as string[],
    msAccount: "all",
  });

  // Filters for MoySklad import table
  const [importFilters, setImportFilters] = useState({
    name: "",
    article: "",
    code: "",
    stock: "all",
  });

  // Catalogs state - now using Supabase data
  // Create legacy compatible catalogs from Supabase
  const catalogs = useMemo(() => {
    return supabaseCatalogs.map(sc => ({
      id: sc.id,
      name: sc.name,
      description: sc.description || undefined,
      productIds: Object.entries(productCatalogVisibility)
        .filter(([_, cats]) => cats.has(sc.id))
        .map(([productId]) => productId),
      categoryIds: [],
      createdAt: sc.created_at,
    })) as Catalog[];
  }, [supabaseCatalogs, productCatalogVisibility]);
  
  const setCatalogs = useCallback((updater: React.SetStateAction<Catalog[]>) => {
    // Now managed through Supabase hooks
    console.log('setCatalogs now routes through Supabase');
  }, []);
  
  const [catalogView, setCatalogView] = useState<CatalogView>("list");
  const [currentCatalog, setCurrentCatalog] = useState<Catalog | null>(null);
  const [newCatalogName, setNewCatalogName] = useState("");
  const [newCatalogDescription, setNewCatalogDescription] = useState("");
  const [newCatalogCategories, setNewCatalogCategories] = useState<Set<string>>(new Set());
  const [showAddCatalog, setShowAddCatalog] = useState(false);
  const [catalogProductSearch, setCatalogProductSearch] = useState("");
  const [catalogFilterCategory, setCatalogFilterCategory] = useState("");
  const [catalogFilterStatus, setCatalogFilterStatus] = useState("");
  const [catalogFilterPrice, setCatalogFilterPrice] = useState("all");
  const [selectedCatalogProducts, setSelectedCatalogProducts] = useState<Set<string>>(new Set());
  const [editingCatalogName, setEditingCatalogName] = useState(false);
  const [selectedCatalogBulkProducts, setSelectedCatalogBulkProducts] = useState<Set<string>>(new Set());
  const [lastSelectedCatalogProductId, setLastSelectedCatalogProductId] = useState<string | null>(null);
  const [expandedCatalogId, setExpandedCatalogId] = useState<string | null>(null);
  const [catalogSettingsOpen, setCatalogSettingsOpen] = useState<string | null>(null);
  const [editingCatalogListName, setEditingCatalogListName] = useState<string | null>(null);
  const [catalogListNameValue, setCatalogListNameValue] = useState("");
  
  // Column sorting for price list
  type CatalogSortColumn = "name" | "categories" | "buyPrice" | "price" | "status" | "unit" | "type" | null;
  type SortDir = "asc" | "desc";
  const [catalogSortColumn, setCatalogSortColumn] = useState<CatalogSortColumn>(null);
  const [catalogSortDirection, setCatalogSortDirection] = useState<SortDir>("asc");
  
   // (Hidden orders state moved to OrdersSection component)
  
   // Order notifications settings panel state
  const [showOrderNotificationsPanel, setShowOrderNotificationsPanel] = useState(false);
  const [selectedNotificationChannel, setSelectedNotificationChannel] = useState<'telegram' | 'whatsapp' | 'email' | 'moysklad' | null>(null);
  const [notificationContacts, setNotificationContacts] = useState({
    telegram: '',
    whatsapp: '',
    email: '',
  });
  
  // (Hide/restore order handlers moved to OrdersSection component)
  
  // Load notification settings from Supabase when they become available
  useEffect(() => {
    if (notificationSettings) {
      setNotificationContacts({
        telegram: notificationSettings.notification_telegram || '',
        whatsapp: notificationSettings.notification_whatsapp || '',
        email: notificationSettings.notification_email || '',
      });
      // Auto-select channel if enabled
      if (notificationSettings.email_enabled && notificationSettings.notification_email) {
        setSelectedNotificationChannel('email');
      } else if (notificationSettings.telegram_enabled && notificationSettings.notification_telegram) {
        setSelectedNotificationChannel('telegram');
      } else if (notificationSettings.whatsapp_enabled && notificationSettings.notification_whatsapp) {
        setSelectedNotificationChannel('whatsapp');
      }
    }
  }, [notificationSettings]);

  // Expanded product images state for import section
  const [expandedProductImages, setExpandedProductImages] = useState<string | null>(null);
  const [productImagesCache, setProductImagesCache] = useState<Record<string, MoySkladImageInfo[]>>({});
  const [loadingProductImages, setLoadingProductImages] = useState<string | null>(null);
  
  // Selected images for selective download
  const [selectedImagesForDownload, setSelectedImagesForDownload] = useState<Record<string, Set<number>>>({});
  const [downloadingImages, setDownloadingImages] = useState<boolean>(false);

  // Sync settings state
  const [syncSettings, setSyncSettings] = useState<SyncSettings>(defaultSyncSettings);
  const syncTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Track deleted MoySklad product IDs to allow re-import
  const [deletedMoyskladIds, setDeletedMoyskladIds] = useState<Set<string>>(new Set());

  // Hydrate sync settings from backend settings table
  useEffect(() => {
    if (!supabaseSyncSettings) return;

    setSyncSettings((prev) => ({
      ...prev,
      enabled: supabaseSyncSettings.enabled,
      intervalMinutes: supabaseSyncSettings.interval_minutes,
      lastSyncTime: supabaseSyncSettings.last_sync_time || undefined,
      nextSyncTime: supabaseSyncSettings.next_sync_time || undefined,
      fieldMapping: {
        ...prev.fieldMapping,
        ...supabaseSyncSettings.field_mapping,
      },
    }));
  }, [supabaseSyncSettings]);

  // Expanded product images state for assortment section
  const [expandedAssortmentImages, setExpandedAssortmentImages] = useState<string | null>(null);
  const [deletingImageProductId, setDeletingImageProductId] = useState<string | null>(null);
  const [uploadingImageProductId, setUploadingImageProductId] = useState<string | null>(null);

  // Product editing state
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  
  // Quick add product dialog state
  const [quickAddDialogOpen, setQuickAddDialogOpen] = useState(false);
  const [quickAddProductName, setQuickAddProductName] = useState("");
  
  // Product order state for drag and drop
  const [productOrder, setProductOrder] = useState<string[]>([]);
  
  // Bulk selection state for products
  const [selectedBulkProducts, setSelectedBulkProducts] = useState<Set<string>>(new Set());

  // Profile editing state
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [storeName, setStoreName] = useState("");
  const [storePhone, setStorePhone] = useState("");
  const [storeEmail, setStoreEmail] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
   const [storeDescription, setStoreDescription] = useState("");
   const [showcasePhone, setShowcasePhone] = useState("");
   const [showcaseWhatsapp, setShowcaseWhatsapp] = useState("");
   const [showcaseTelegram, setShowcaseTelegram] = useState("");
   const [showcaseMaxLink, setShowcaseMaxLink] = useState("");
   const [showcaseFloatingMessenger, setShowcaseFloatingMessenger] = useState(false);
   const [savingShowcase, setSavingShowcase] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingStore, setSavingStore] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [profileSubSection, setProfileSubSection] = useState<'personal' | 'store' | 'settings'>('personal');
  const [isExportingProducts, setIsExportingProducts] = useState(false);
  const [catalogExportDialogOpen, setCatalogExportDialogOpen] = useState(false);
  const [catalogPdfExportDialogOpen, setCatalogPdfExportDialogOpen] = useState(false);
  const [catalogImportDialogOpen, setCatalogImportDialogOpen] = useState(false);
  const [isExportingCatalog, setIsExportingCatalog] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [pdfExportProgress, setPdfExportProgress] = useState<{ current: number; total: number } | null>(null);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);

  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    drag: true,
    checkbox: true,
    photo: true,
    name: true,
    sku: true,
    desc: true,
    source: true,
    unit: true,
    type: true,
    volume: true,
    cost: true,
    groups: true,
    catalogs: true,
    sync: true,
    msPrices: false,
  });

  const columnLabels: Record<string, string> = {
    drag: "⋮⋮",
    checkbox: "Выбор",
    photo: "Фото",
    name: "Название",
    sku: "Код",
    desc: "Описание",
    source: "Источник",
    unit: "Ед.",
    type: "Вид",
    volume: "Объем",
    cost: "Себест.",
    groups: "Группа",
    catalogs: "Прайс-листы",
    sync: "Синхр.",
    msPrices: "МС цены",
  };

  const toggleColumnVisibility = (columnId: string) => {
    setVisibleColumns(prev => ({ ...prev, [columnId]: !prev[columnId] }));
  };

  // Column visibility state for catalog detail table
  const [catalogVisibleColumns, setCatalogVisibleColumns] = useState<Record<string, boolean>>({
    bulkCheckbox: true,
    photo: true,
    name: true,
    description: true,
    categories: true,
    subcategory: true,
    unit: true,
    volume: true,
    type: true,
    buyPrice: true,
    markup: true,
    price: true,
    priceFull: true,
    priceHalf: true,
    priceQuarter: true,
    pricePortion: true,
    status: true,
  });

  const catalogColumnLabels: Record<string, string> = {
    bulkCheckbox: "Выбор",
    photo: "Фото",
    name: "Название",
    description: "Описание",
    categories: "Главная категория",
    subcategory: "Подкатегория",
    unit: "Ед. изм.",
    volume: "Объем",
    type: "Вид",
    buyPrice: "Себест-ть",
    markup: "Наценка",
    price: "Цена",
    priceFull: "Целая",
    priceHalf: "½",
    priceQuarter: "¼",
    pricePortion: "Порция",
    status: "Статус",
  };

  const toggleCatalogColumnVisibility = (columnId: string) => {
    setCatalogVisibleColumns(prev => ({ ...prev, [columnId]: !prev[columnId] }));
  };


  // Custom options state (for units and packaging types added by user)
  const [customUnits, setCustomUnits] = useState<string[]>([]);
  const [customPackagingTypes, setCustomPackagingTypes] = useState<string[]>([]);
  
  // Extract custom packaging types and units from products on load
  const predefinedPackagingTypes = ["head", "package", "piece", "can", "box", "carcass", "half_carcass", "quarter_carcass"];
  const predefinedUnits = ["кг", "шт", "л", "уп", "г", "мл"];
  
  useEffect(() => {
    if (supabaseProducts.length > 0) {
      // Extract custom packaging types from products
      const productPackagingTypes = supabaseProducts
        .map(p => p.packaging_type)
        .filter((type): type is string => !!type && !predefinedPackagingTypes.includes(type));
      const uniqueCustomTypes = [...new Set(productPackagingTypes)];
      if (uniqueCustomTypes.length > 0) {
        setCustomPackagingTypes(prev => {
          const combined = [...new Set([...prev, ...uniqueCustomTypes])];
          return combined;
        });
      }
      
      // Extract custom units from products
      const productUnits = supabaseProducts
        .map(p => p.unit)
        .filter((unit): unit is string => !!unit && !predefinedUnits.includes(unit));
      const uniqueCustomUnits = [...new Set(productUnits)];
      if (uniqueCustomUnits.length > 0) {
        setCustomUnits(prev => {
          const combined = [...new Set([...prev, ...uniqueCustomUnits])];
          return combined;
        });
      }
    }
  }, [supabaseProducts]);
  
  // Categories from Supabase - use storeCategories directly
  const categories = storeCategories.map(c => ({ id: c.id, name: c.name, sort_order: c.sort_order, parent_id: c.parent_id }));
  const [newCategoryName, setNewCategoryName] = useState("");
  
  // Add new category handler - creates in backend
  const handleAddCategory = useCallback(async (categoryName: string): Promise<string | null> => {
    if (!effectiveStoreId) return null;

    const normalized = categoryName.trim();
    if (!normalized) return null;

    // Check if category already exists (case-insensitive)
    const existing = storeCategories.find(
      (c) => c.name.toLowerCase() === normalized.toLowerCase()
    );

    if (existing) {
      toast({
        title: "Категория уже существует",
        description: `Категория "${normalized}" уже есть в списке`,
      });
      return existing.id;
    }

    try {
      const created = await createCategory(normalized);

      if (!created) throw new Error("createCategory returned null");

      toast({
        title: "Категория создана",
        description: `Категория "${normalized}" успешно добавлена`,
      });

      // Safety: if realtime is delayed, force refresh
      refetchCategories();

      return created.id;
    } catch (error) {
      console.error("Error creating category:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось создать категорию",
        variant: "destructive",
      });
      return null;
    }
  }, [effectiveStoreId, storeCategories, toast, createCategory, refetchCategories]);

  // Build combined options lists
  const allUnitOptions = [
    { value: "кг", label: "кг" },
    { value: "шт", label: "шт" },
    { value: "л", label: "л" },
    { value: "уп", label: "уп" },
    { value: "г", label: "г" },
    { value: "мл", label: "мл" },
    ...customUnits.map(u => ({ value: u, label: u })),
  ];

  const allPackagingOptions = [
    { value: "head", label: "Голова" },
    { value: "package", label: "Упаковка" },
    { value: "piece", label: "Штука" },
    { value: "can", label: "Банка" },
    { value: "box", label: "Ящик" },
    ...customPackagingTypes.map(p => ({ value: p, label: p })),
  ];

  // Note: effectiveStoreId is now defined earlier in the component
  const isSuperAdminContext = !!storeIdFromUrl && isSuperAdmin;

  // Fetch user's own store or the store from URL
  // В workspaceMode не нужно загружать контекст - он уже передан через пропсы
  useEffect(() => {
    // В workspaceMode пропускаем загрузку контекста
    if (workspaceMode && storeIdOverride) {
      setStoreContextLoading(false);
      return;
    }
    
    const fetchStoreContext = async () => {
      setStoreContextLoading(true);
      try {
        // If storeId is in URL - fetch that store (for both sellers and super admins)
        if (storeIdFromUrl) {
          const { data: store } = await supabase
            .from('stores')
            .select('id, name, subdomain, owner_id')
            .eq('id', storeIdFromUrl)
            .single();
          
          if (store) {
            setCurrentStoreId(store.id);
            setCurrentStoreName(store.name);
            setCurrentStoreSubdomain(store.subdomain);
            
            // section берём из URL через отдельный useEffect (не трогаем здесь, чтобы не вызывать лишние перерисовки)

          }
          setStoreContextLoading(false);
          return;
        }
        
        // Otherwise fetch seller's own store if logged in
        if (!user || !profile) {
          setStoreContextLoading(false);
          return;
        }
        
        if (profile.role === 'seller') {
          // A seller can end up with multiple stores (e.g. store creation flow run twice).
          // We must pick ONE deterministically and keep it stable across renders.
          const { data: stores } = await supabase
            .from('stores')
            .select('id, name, subdomain, updated_at')
            .eq('owner_id', profile.id)
            .order('updated_at', { ascending: false });

          const storePreferenceKey = `seller_last_store_id_${profile.id}`;
          const preferredId = (() => {
            try {
              return localStorage.getItem(storePreferenceKey);
            } catch {
              return null;
            }
          })();

          const store = (preferredId && stores?.find((s) => s.id === preferredId))
            ? stores?.find((s) => s.id === preferredId)
            : stores?.[0];

          if (store) {
            try {
              localStorage.setItem(storePreferenceKey, store.id);
            } catch {
              // ignore
            }

            setUserStoreId(store.id);
            setCurrentStoreId(store.id);
            setCurrentStoreName(store.name);
            setCurrentStoreSubdomain(store.subdomain);
          }
        }
      } catch (error) {
        console.error('Error fetching store context:', error);
      } finally {
        setStoreContextLoading(false);
      }
    };
    
    fetchStoreContext();
  }, [user, profile, storeIdFromUrl, isSuperAdmin, workspaceMode, storeIdOverride]);

  // Handle section change with URL update
  const handleSectionChange = useCallback((section: ActiveSection) => {
    // Предотвращаем повторный setActiveSection из useEffect
    isInternalUrlChange.current = true;
    setActiveSection(section);
    
    // Update URL with section for SPA navigation
    const newParams = new URLSearchParams(searchParams);
    newParams.set('section', section);
    setSearchParams(newParams, { replace: true });
    
    // Reset sub-views when switching sections
    if (section === "import") {
      setImportView("accounts");
    } else if (section === "catalogs") {
      setCatalogView("list");
      // Reset currentCatalog to force re-read from catalogs array with fresh product data
      setCurrentCatalog(null);
      setSelectedCatalogProducts(new Set());
    }
  }, [searchParams, setSearchParams]);

  // Initialize profile and store data when profile section is active
  useEffect(() => {
    const loadProfileData = async () => {
      if ((activeSection === 'profile' || activeSection === 'showcase') && effectiveStoreId) {
        // Load profile data
        if (profile) {
          setProfileName(profile.full_name || '');
        }
        if (user) {
          // Fetch full profile data including phone
          const { data: profileData } = await supabase
            .from('profiles')
            .select('full_name, phone')
            .eq('user_id', user.id)
            .single();
          if (profileData) {
            setProfileName(profileData.full_name || '');
            setProfilePhone(profileData.phone || '');
          }
        }
        
        // Load store data
        const { data: storeData } = await supabase
          .from('stores')
          .select('name, contact_phone, contact_email, address, description, showcase_phone, showcase_whatsapp_phone, showcase_telegram_username, showcase_max_link, showcase_floating_messenger_enabled')
          .eq('id', effectiveStoreId)
          .single();
        
        if (storeData) {
          setStoreName(storeData.name || '');
          setStorePhone(storeData.contact_phone || '');
          setStoreEmail(storeData.contact_email || '');
          setStoreAddress(storeData.address || '');
          setStoreDescription(storeData.description || '');
          setShowcasePhone(storeData.showcase_phone || '');
          setShowcaseWhatsapp((storeData as any).showcase_whatsapp_phone || '');
          setShowcaseTelegram((storeData as any).showcase_telegram_username || '');
           setShowcaseMaxLink((storeData as any).showcase_max_link || '');
           setShowcaseFloatingMessenger(!!(storeData as any).showcase_floating_messenger_enabled);
        }
      }
    };
    loadProfileData();
  }, [activeSection, effectiveStoreId, profile, user]);

  // Save profile handler
  const handleSaveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profileName.trim() || null,
        })
        .eq('user_id', user.id);
      
      if (error) throw error;
      toast({ title: "Профиль сохранён" });
    } catch (error: any) {
      toast({ title: "Ошибка сохранения", description: error.message, variant: "destructive" });
    } finally {
      setSavingProfile(false);
    }
  };

  // Save store handler
  const handleSaveStore = async () => {
    if (!effectiveStoreId) return;
    setSavingStore(true);
    try {
      const { error } = await supabase
        .from('stores')
        .update({
          name: storeName.trim(),
          contact_phone: storePhone.trim() || null,
          contact_email: storeEmail.trim() || null,
          address: storeAddress.trim() || null,
          description: storeDescription.trim() || null,
        })
        .eq('id', effectiveStoreId);
      
      if (error) throw error;
      // Update local state
      setCurrentStoreName(storeName.trim());
      toast({ title: "Магазин сохранён" });
    } catch (error: any) {
      toast({ title: "Ошибка сохранения", description: error.message, variant: "destructive" });
    } finally {
      setSavingStore(false);
    }
  };

  // Change password handler
  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast({ title: "Ошибка", description: "Пароль должен быть минимум 6 символов", variant: "destructive" });
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast({ title: "Пароль изменён" });
      setNewPassword("");
    } catch (error: any) {
      toast({ title: "Ошибка смены пароля", description: error.message, variant: "destructive" });
    } finally {
      setChangingPassword(false);
    }
  };

  // Sign out handler
  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  // NOTE: Data is now loaded via Supabase hooks (useStoreProducts, useStoreCatalogs, useMoyskladAccounts, useStoreSyncSettings)
  // The localStorage persistence is no longer needed as data is stored in the database

  // Initialize visibility state from catalogs
  useEffect(() => {
    const visibility: Record<string, Set<string>> = {};
    catalogs.forEach(catalog => {
      catalog.productIds.forEach(productId => {
        if (!visibility[productId]) {
          visibility[productId] = new Set();
        }
        visibility[productId].add(catalog.id);
      });
    });
    setProductCatalogVisibility(visibility);
  }, [catalogs]);

  // Toggle product visibility in a catalog - now uses Supabase hook
  const toggleProductCatalogVisibility = useCallback((productId: string, catalogId: string) => {
    toggleSupabaseProductVisibility(productId, catalogId);
  }, [toggleSupabaseProductVisibility]);

  // NOTE: Products are now stored in Supabase and synced automatically
  // The localStorage for TestStore is no longer needed

  // Check if a MoySklad product is linked (imported) to all products
  // Also checks if it was previously deleted - if so, it's not considered linked
  const isProductLinked = (msProductId: string) => {
    if (deletedMoyskladIds.has(msProductId)) return false;
    return importedProducts.some(p => p.moyskladId === msProductId);
  };

  // Get linked product from importedProducts
  // Returns undefined if the product was deleted
  const getLinkedProduct = (msProductId: string) => {
    if (deletedMoyskladIds.has(msProductId)) return undefined;
    return importedProducts.find(p => p.moyskladId === msProductId);
  };

  // Toggle auto-sync for a MoySklad product in import view (works for both linked and non-linked products)
  const toggleImportAutoSync = async (msProductId: string) => {
    const linkedProduct = getLinkedProduct(msProductId);
    if (linkedProduct) {
      // Already imported - just toggle sync
      toggleAutoSync(linkedProduct.id);
    } else {
      // Not imported yet - import with auto-sync enabled
      await importAndLinkProduct(msProductId);
    }
  };

  // Helper: resolve or create a category from MoySklad folder path
  // pathName format: "Parent/Child/SubChild" or just "CategoryName"
  const msfolderCategoryCache = useRef<Record<string, string>>({});
  
  const resolveOrCreateCategory = async (productFolderName: string | null | undefined): Promise<string | null> => {
    if (!productFolderName || !effectiveStoreId) return null;
    
    // Use the leaf folder name (last segment of path)
    const segments = productFolderName.split('/').map(s => s.trim()).filter(Boolean);
    if (segments.length === 0) return null;
    
    const leafName = segments[segments.length - 1];
    
    // Check cache first
    if (msfolderCategoryCache.current[leafName]) {
      return msfolderCategoryCache.current[leafName];
    }
    
    // Check existing categories by name
    const existingCat = storeCategories.find(c => c.name === leafName);
    if (existingCat) {
      msfolderCategoryCache.current[leafName] = existingCat.id;
      return existingCat.id;
    }
    
    // Create new category
    const created = await createCategory(leafName);
    if (created) {
      msfolderCategoryCache.current[leafName] = created.id;
      
      // If has parent segments, try to set parent
      if (segments.length > 1) {
        const parentName = segments[segments.length - 2];
        const parentId = await resolveOrCreateCategory(segments.slice(0, -1).join('/'));
        if (parentId && parentId !== created.id) {
          await supabase
            .from('categories')
            .update({ parent_id: parentId })
            .eq('id', created.id);
        }
      }
      
      return created.id;
    }
    return null;
  };

  // Import a single product and enable auto-sync
  const importAndLinkProduct = async (msProductId: string) => {
    if (!currentAccount) return;
    
    const msProduct = moyskladProducts.find(p => p.id === msProductId);
    if (!msProduct) return;

    // Check if already imported (and not deleted) - prevent duplicates
    const existingProduct = importedProducts.find(p => p.moyskladId === msProduct.id);
    if (existingProduct && !deletedMoyskladIds.has(msProduct.id)) {
      // Already imported - just enable auto-sync
      if (!existingProduct.autoSync) {
        toggleAutoSync(existingProduct.id);
      }
      return;
    }

    setIsLoading(true);
    try {
      // Fetch images
      let imageUrl = "https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=400&h=400&fit=crop";
      let imageFullUrl = imageUrl;
      
      if (msProduct.imagesCount > 0) {
        try {
          const { data: imagesData } = await supabase.functions.invoke('moysklad', {
            body: { 
              action: 'get_product_images', 
              productId: msProduct.id,
              login: currentAccount.login,
              password: currentAccount.password
            }
          });
          
          if (imagesData?.images?.[0]) {
            const imageInfo = imagesData.images[0];
            
            if (imageInfo.miniature) {
              const { data: imageContent } = await supabase.functions.invoke('moysklad', {
                body: { 
                  action: 'get_image_content', 
                  imageUrl: imageInfo.miniature,
                  login: currentAccount.login,
                  password: currentAccount.password
                }
              });
              if (imageContent?.imageData) {
                imageUrl = imageContent.imageData;
              }
            }
            
            if (imageInfo.fullSize || imageInfo.downloadHref) {
              const { data: fullImageContent } = await supabase.functions.invoke('moysklad', {
                body: { 
                  action: 'get_image_content', 
                  imageUrl: imageInfo.fullSize || imageInfo.downloadHref,
                  login: currentAccount.login,
                  password: currentAccount.password
                }
              });
              if (fullImageContent?.imageData) {
                imageFullUrl = fullImageContent.imageData;
              }
            }
          }
        } catch (err) {
          console.log("Could not fetch image for product:", msProduct.id);
        }
      }

      // Check if product already exists in Supabase with same moysklad_id
      const existingSupabaseProduct = supabaseProducts.find(p => p.moysklad_id === msProduct.id);
      
      // Resolve category from MoySklad folder
      const categoryId = await resolveOrCreateCategory(msProduct.productFolderName);
      
      if (existingSupabaseProduct) {
        // Update existing product
        await updateSupabaseProduct(existingSupabaseProduct.id, {
          name: msProduct.name,
          description: msProduct.description || null,
          price: msProduct.price || 0,
          buy_price: msProduct.buyPrice || null,
          unit: msProduct.uom || "кг",
          quantity: msProduct.quantity || msProduct.stock || 0,
          auto_sync: true,
          is_active: true,
          ...(categoryId ? { category_id: categoryId } : {}),
          ...(msProduct.salePrices?.length ? { moysklad_prices: Object.fromEntries(msProduct.salePrices.map(sp => [sp.name, sp.value])) } : {}),
        } as any);
        
        toast({
          title: "Товар обновлён",
          description: `${msProduct.name} синхронизирован`,
        });
      } else {
        // Create new product in Supabase
        const slug = msProduct.name.toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-а-яё]/gi, '') || `product-${Date.now()}`;
        
        await createSupabaseProduct({
          name: msProduct.name,
          slug,
          description: msProduct.description || null,
          price: msProduct.price || 0,
          buy_price: msProduct.buyPrice || null,
          unit: msProduct.uom || "кг",
          unit_weight: msProduct.weight > 0 ? msProduct.weight : null,
          quantity: msProduct.quantity || msProduct.stock || 0,
          images: imageFullUrl ? [imageFullUrl] : (imageUrl ? [imageUrl] : null),
          packaging_type: msProduct.weight > 0 ? "head" : "piece",
          source: "moysklad",
          moysklad_id: msProduct.id,
          moysklad_account_id: currentAccount.id,
          auto_sync: true,
          is_active: true,
          ...(categoryId ? { category_id: categoryId } : {}),
          ...(msProduct.salePrices?.length ? { moysklad_prices: Object.fromEntries(msProduct.salePrices.map(sp => [sp.name, sp.value])) } : {}),
        } as any);
        
        toast({
          title: "Товар импортирован",
          description: `${msProduct.name} добавлен в ассортимент`,
        });
      }
      
      // Remove from deleted IDs set since we're re-importing
      setDeletedMoyskladIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(msProduct.id);
        return newSet;
      });
      
      // Clear image cache for fresh start
      setProductImagesCache(prev => {
        const newCache = { ...prev };
        delete newCache[msProduct.id];
        return newCache;
      });
      
      // Refresh products from Supabase
      refetchProducts();
      
    } catch (err) {
      console.error("Error importing product:", err);
      toast({
        title: "Ошибка",
        description: "Не удалось импортировать товар",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-sync products with MoySklad that have autoSync enabled
  const syncAutoSyncProducts = async (fieldMapping?: SyncFieldMapping) => {
    // Use Supabase products that have auto_sync enabled
    const productsToSync = supabaseProducts.filter(p => p.auto_sync && p.moysklad_id);
    if (productsToSync.length === 0) {
      toast({
        title: "Нет товаров для синхронизации",
        description: "Импортируйте товары с включенной авто-синхронизацией",
      });
      return;
    }

    const mapping = fieldMapping || syncSettings.fieldMapping;

    // Group products by account
    const productsByAccount = productsToSync.reduce((acc, p) => {
      const accountId = p.moysklad_account_id || '';
      if (!acc[accountId]) acc[accountId] = [];
      acc[accountId].push(p);
      return acc;
    }, {} as Record<string, typeof productsToSync>);

    setIsSyncing(true);
    let updatedCount = 0;
    
    try {
      for (const [accountId, products] of Object.entries(productsByAccount)) {
        const account = accounts.find(a => a.id === accountId);
        if (!account) continue;

        // Fetch ALL products with pagination
        const allMsProducts: MoySkladProduct[] = [];
        let offset = 0;
        const batchSize = 20;
        let hasMore = true;
        while (hasMore) {
          const { data, error } = await supabase.functions.invoke('moysklad', {
            body: { 
              action: 'get_assortment', 
              limit: batchSize, 
              offset,
              login: account.login,
              password: account.password
            }
          });

          if (error) throw error;
          if (data?.error) throw new Error(data.error);

          const page = data?.products || [];
          const total = data?.meta?.size || 0;
          const effectiveLimit = data?.meta?.limit || batchSize;

          if (page.length > 0) {
            allMsProducts.push(...page);
            offset += page.length;
            hasMore = offset < total && page.length >= effectiveLimit;
          } else {
            hasMore = false;
          }
        }

        if (allMsProducts.length > 0) {
          const msProductsMap = new Map(allMsProducts.map((p: MoySkladProduct) => [p.id, p]));
          
          // Update each product in Supabase
          for (const product of products) {
            const msProduct = msProductsMap.get(product.moysklad_id!) as MoySkladProduct | undefined;
            if (msProduct) {
              const updates: Partial<StoreProduct> = {};
              
              // Apply field mapping
              if (mapping.buyPrice && msProduct.buyPrice !== undefined) {
                updates.buy_price = msProduct.buyPrice;
              }
              if (mapping.price && msProduct.price !== undefined) {
                updates.price = msProduct.price;
              }
              if (mapping.quantity) {
                updates.quantity = msProduct.quantity || msProduct.stock || 0;
              }
              if (mapping.name && msProduct.name) {
                updates.name = msProduct.name;
              }
              if (mapping.description && msProduct.description) {
                updates.description = msProduct.description;
              }
              if (mapping.unit && msProduct.uom) {
                updates.unit = msProduct.uom;
              }
              
              // Always sync all price types
              if (msProduct.salePrices?.length) {
                (updates as any).moysklad_prices = Object.fromEntries(msProduct.salePrices.map(sp => [sp.name, sp.value]));
              }
              
              // Only update if there are changes
              if (Object.keys(updates).length > 0) {
                await updateSupabaseProduct(product.id, updates);
                updatedCount++;
              }
            }
          }
        }
      }

      // Update last sync time in Supabase
      await updateSyncSettings({
        last_sync_time: new Date().toISOString(),
        next_sync_time: syncSettings.enabled 
          ? new Date(Date.now() + syncSettings.intervalMinutes * 60000).toISOString()
          : undefined,
      });

      // Refresh products
      refetchProducts();

      toast({
        title: "Синхронизация завершена",
        description: `Обновлено ${updatedCount} товаров`,
      });
    } catch (err) {
      console.error("Sync error:", err);
      toast({
        title: "Ошибка синхронизации",
        description: "Не удалось обновить данные",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Auto-sync timer effect
  useEffect(() => {
    if (syncTimerRef.current) {
      clearInterval(syncTimerRef.current);
      syncTimerRef.current = null;
    }

    if (!syncSettings.enabled) return;

    const syncedProductsCount = importedProducts.filter(p => p.autoSync).length;
    if (syncedProductsCount === 0) return;

    if (!syncSettings.nextSyncTime) {
      const nextSyncAt = new Date(Date.now() + syncSettings.intervalMinutes * 60000).toISOString();
      setSyncSettings(prev => ({ ...prev, nextSyncTime: nextSyncAt }));
      void updateSyncSettings({ next_sync_time: nextSyncAt });
      return;
    }

    syncTimerRef.current = setInterval(() => {
      if (syncSettings.nextSyncTime) {
        const now = Date.now();
        const nextSync = new Date(syncSettings.nextSyncTime).getTime();

        if (now >= nextSync && !isSyncing) {
          syncAutoSyncProducts(syncSettings.fieldMapping);
        }
      }
    }, 10000);

    return () => {
      if (syncTimerRef.current) {
        clearInterval(syncTimerRef.current);
      }
    };
  }, [syncSettings.enabled, syncSettings.intervalMinutes, syncSettings.nextSyncTime, importedProducts.length, isSyncing]);

  // Handle sync settings change
  const handleSyncSettingsChange = async (newSettings: SyncSettings) => {
    setSyncSettings(newSettings);
    await updateSyncSettings({
      enabled: newSettings.enabled,
      interval_minutes: newSettings.intervalMinutes,
      next_sync_time: newSettings.nextSyncTime || null,
      field_mapping: newSettings.fieldMapping as any,
    } as any);
  };

  // Manual sync now handler
  const handleSyncNow = () => {
    syncAutoSyncProducts(syncSettings.fieldMapping);
  };

  // Export products to Excel
  const handleExportProducts = async () => {
    if (!effectiveStoreId) return;
    
    setIsExportingProducts(true);
    try {
      await exportProductsToExcel(
        effectiveStoreId,
        supabaseProducts,
        getProductGroupIds
      );
      toast({
        title: "Экспорт завершён",
        description: `Экспортировано ${supabaseProducts.length} товаров`
      });
    } catch (error: any) {
      console.error('Export error:', error);
      toast({
        title: "Ошибка экспорта",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsExportingProducts(false);
    }
  };

  // Export catalog to Excel with selected columns
  const handleExportCatalog = async (enabledColumns: string[]) => {
    if (!currentCatalog || !effectiveStoreId) return;
    
    setIsExportingCatalog(true);
    try {
      // Get products that are in the current catalog
      const catalogProducts = allProducts
        .filter(p => selectedCatalogProducts.has(p.id))
        .map(product => {
          const catalogPricing = getCatalogProductPricing(currentCatalog.id, product.id);
          
          // Calculate effective price using same logic as table display
          const price = getCatalogSalePrice(product, catalogPricing);
          const buyPrice = product.buyPrice || 0;
          const markup = catalogPricing?.markup !== undefined ? catalogPricing.markup : product.markup;
          
          // Calculate packaging prices
          const packagingPrices = calculatePackagingPrices(
            price,
            product.unitWeight,
            product.packagingType as PackagingType | undefined
          );
          
          // Format markup string
          let markupStr = '';
          if (markup) {
            markupStr = markup.type === 'percent' 
              ? `${markup.value}%` 
              : `${markup.value} ₽`;
          }
          
          // Get status
          const status = catalogPricing?.status || product.status || (product.inStock ? 'in_stock' : 'out_of_stock');
          
          // Get portion prices from catalog settings or calculate
          const portionPrices = catalogPricing?.portionPrices;
          
          return {
            sku: product.sku || null,
            name: product.name,
            description: product.description,
            categories: (() => {
              const names = (catalogPricing?.categories || [])
                .map(catId => categories.find(c => c.id === catId)?.name)
                .filter(Boolean) as string[];
              return names.length > 0 ? names : null;
            })(),
            unit: product.unit,
            unitWeight: product.unitWeight,
            packagingType: product.packagingType,
            buyPrice: product.buyPrice,
            markup: markupStr,
            price,
            priceFull: packagingPrices?.full ?? null,
            priceHalf: packagingPrices?.half ?? null,
            priceQuarter: packagingPrices?.quarter ?? null,
            pricePortion: portionPrices?.portionPrice ?? null,
            status,
            images: product.images,
          } as CatalogExportProduct;
        });

      exportCatalogToExcel(currentCatalog.name, catalogProducts, enabledColumns);
      
      toast({
        title: "Экспорт завершён",
        description: `Экспортировано ${catalogProducts.length} товаров`
      });
    } catch (error: any) {
      console.error('Catalog export error:', error);
      toast({
        title: "Ошибка экспорта",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsExportingCatalog(false);
      setCatalogExportDialogOpen(false);
    }
  };

  // Export catalog to PDF with selected columns
  const handleExportCatalogPdf = async (enabledColumns: string[], includePhotos: boolean) => {
    if (!currentCatalog || !effectiveStoreId) return;
    
    setIsExportingPdf(true);
    setPdfExportProgress(null);
    try {
      const catalogProducts = allProducts
        .filter(p => selectedCatalogProducts.has(p.id))
        .map(product => {
          const catalogPricing = getCatalogProductPricing(currentCatalog.id, product.id);
          const price = getCatalogSalePrice(product, catalogPricing);
          const buyPrice = product.buyPrice || 0;
          const markup = catalogPricing?.markup !== undefined ? catalogPricing.markup : product.markup;
          const packagingPrices = calculatePackagingPrices(
            price,
            product.unitWeight,
            product.packagingType as PackagingType | undefined
          );
          let markupStr = '';
          if (markup) {
            markupStr = markup.type === 'percent' 
              ? `${markup.value}%` 
              : `${markup.value} ₽`;
          }
          const status = catalogPricing?.status || product.status || (product.inStock ? 'in_stock' : 'out_of_stock');
          const portionPrices = catalogPricing?.portionPrices;
          
          return {
            sku: product.sku || null,
            name: product.name,
            description: product.description,
            categories: (() => {
              const names = (catalogPricing?.categories || [])
                .map(catId => categories.find(c => c.id === catId)?.name)
                .filter(Boolean) as string[];
              return names.length > 0 ? names : null;
            })(),
            unit: product.unit,
            unitWeight: product.unitWeight,
            packagingType: product.packagingType,
            buyPrice: product.buyPrice,
            markup: markupStr,
            price,
            priceFull: packagingPrices?.full ?? null,
            priceHalf: packagingPrices?.half ?? null,
            priceQuarter: packagingPrices?.quarter ?? null,
            pricePortion: portionPrices?.portionPrice ?? null,
            status,
            images: product.images,
          } as CatalogExportProduct;
        });

      await exportCatalogToPdf(
        currentCatalog.name,
        catalogProducts,
        enabledColumns,
        includePhotos,
        (current, total) => setPdfExportProgress({ current, total }),
      );
      
      toast({
        title: "PDF готов",
        description: `Экспортировано ${catalogProducts.length} товаров`
      });
    } catch (error: any) {
      console.error('PDF export error:', error);
      toast({
        title: "Ошибка экспорта PDF",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsExportingPdf(false);
      setPdfExportProgress(null);
      setCatalogPdfExportDialogOpen(false);
    }
  };

  // Toggle auto-sync for a product
  const toggleAutoSync = async (productId: string) => {
    const product = supabaseProducts.find(p => p.id === productId);
    if (!product) return;
    
    await updateSupabaseProduct(productId, {
      auto_sync: !product.auto_sync,
    });
  };

  // Delete a single image from a product
  const handleDeleteProductImage = async (productId: string, imageIndex: number) => {
    const product = allProducts.find(p => p.id === productId);
    if (!product?.images || !product.images[imageIndex]) return;

    const imageUrl = product.images[imageIndex];
    setDeletingImageProductId(productId);

    try {
      // Delete from storage
      const deleted = await deleteSingleImage(imageUrl);
      
      if (deleted) {
        // Update product images array
        const newImages = product.images.filter((_, idx) => idx !== imageIndex);
        
        // Update in Supabase
        await updateSupabaseProduct(productId, { images: newImages });

        toast({
          title: "Изображение удалено",
        });
      } else {
        toast({
          title: "Ошибка",
          description: "Не удалось удалить изображение",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Error deleting image:", err);
      toast({
        title: "Ошибка",
        description: "Произошла ошибка при удалении",
        variant: "destructive",
      });
    } finally {
      setDeletingImageProductId(null);
    }
  };

  // Add new images to a product
  const handleAddProductImages = async (productId: string, files: FileList, source: 'file' | 'camera') => {
    if (!user) {
      toast({
        title: "Требуется авторизация",
        description: "Войдите в аккаунт для загрузки изображений",
        variant: "destructive",
      });
      return;
    }

    const product = allProducts.find(p => p.id === productId);
    if (!product) return;

    setUploadingImageProductId(productId);

    try {
      const filesArray = Array.from(files);
      const existingImages = product.images || [];
      
      // Use a storage-friendly ID
      const storageId = productId;
      
      // Upload new files
      const newImageUrls = await uploadFilesToStorage(filesArray, storageId, existingImages.length);
      
      if (newImageUrls.length === 0) {
        toast({
          title: "Ошибка",
          description: "Не удалось загрузить изображения",
          variant: "destructive",
        });
        return;
      }

      const updatedImages = [...existingImages, ...newImageUrls];
      
      // Update in Supabase
      await updateSupabaseProduct(productId, { images: updatedImages });

      toast({
        title: "Изображения добавлены",
        description: `Загружено ${newImageUrls.length} фото`,
      });
    } catch (err) {
      console.error("Error adding images:", err);
      toast({
        title: "Ошибка",
        description: "Произошла ошибка при загрузке",
        variant: "destructive",
      });
    } finally {
      setUploadingImageProductId(null);
    }
  };

  // Set an image as the main (first) image for a product
  const handleSetMainImage = (productId: string, imageIndex: number) => {
    const product = allProducts.find(p => p.id === productId);
    if (!product?.images || imageIndex === 0 || imageIndex >= product.images.length) return;

    // Move the selected image to the first position
    const newImages = [...product.images];
    const [selectedImage] = newImages.splice(imageIndex, 1);
    newImages.unshift(selectedImage);

    // Also reorder syncedMoyskladImages if they exist
    let newSyncedImages = product.syncedMoyskladImages;
    if (product.syncedMoyskladImages && product.syncedMoyskladImages.length === product.images.length) {
      newSyncedImages = [...product.syncedMoyskladImages];
      const [selectedSyncedImage] = newSyncedImages.splice(imageIndex, 1);
      newSyncedImages.unshift(selectedSyncedImage);
    }


    // Update in Supabase
    updateSupabaseProduct(productId, { 
      images: newImages,
      synced_moysklad_images: newSyncedImages 
    });

    toast({
      title: "Главное фото изменено",
      description: "Выбранное фото теперь отображается первым",
    });
  };

  // Quick add product function
  const handleQuickAddProduct = async () => {
    if (!quickAddProductName.trim()) {
      toast({
        title: "Ошибка",
        description: "Введите название товара",
        variant: "destructive",
      });
      return;
    }
    
    if (!effectiveStoreId) {
      toast({
        title: "Ошибка",
        description: "Магазин не выбран",
        variant: "destructive",
      });
      return;
    }
    
    const newProduct = await createSupabaseProduct({
      name: quickAddProductName.trim(),
      price: 0,
      quantity: 0,
      source: 'manual',
      is_active: true,
    });
    
    if (newProduct) {
      setQuickAddProductName("");
      setQuickAddDialogOpen(false);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setQuickAddProductName(text.trim());
      }
    } catch (error) {
      toast({
        title: "Не удалось вставить",
        description: "Разрешите доступ к буферу обмена",
        variant: "destructive",
      });
    }
  };

  // Add products from megacatalog
  const handleAddProductsFromMegacatalog = async (megaProducts: any[]) => {
    if (!effectiveStoreId) {
      toast({
        title: "Ошибка",
        description: "Магазин не выбран",
        variant: "destructive",
      });
      return;
    }

    let addedCount = 0;
    for (const mp of megaProducts) {
      try {
        // Generate unique slug
        const baseSlug = mp.name
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-а-яё]/gi, '')
          .substring(0, 50);
        const slug = `${baseSlug}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

        await createSupabaseProduct({
          name: mp.name,
          description: mp.description || null,
          price: mp.price || 0,
          buy_price: mp.buy_price || null,
          images: mp.images || null,
          unit: mp.unit || 'шт',
          sku: mp.sku || null,
          packaging_type: mp.packaging_type || 'piece',
          unit_weight: mp.unit_weight || null,
          quantity: 0,
          source: 'megacatalog',
          is_active: true,
          slug,
        });
        addedCount++;
      } catch (error) {
        console.error('Error adding product from megacatalog:', error);
      }
    }

    if (addedCount > 0) {
      toast({
        title: "Товары добавлены",
        description: `${addedCount} товар(ов) добавлено в ваш ассортимент`,
      });
    }
  };

  // Catalog management functions - now using Supabase
  const createCatalog = async () => {
    if (!newCatalogName.trim()) {
      toast({
        title: "Ошибка",
        description: "Введите название прайс-листа",
        variant: "destructive",
      });
      return;
    }

    const created = await createSupabaseCatalog(newCatalogName.trim(), newCatalogDescription.trim() || undefined);
    
    if (created) {
      setNewCatalogName("");
      setNewCatalogDescription("");
      setNewCatalogCategories(new Set());
      setShowAddCatalog(false);
    }
  };

  const deleteCatalog = async (catalogId: string) => {
    const deleted = await deleteSupabaseCatalog(catalogId);
    if (deleted && currentCatalog?.id === catalogId) {
      setCurrentCatalog(null);
      setCatalogView("list");
    }
  };

  const openCatalog = (catalog: Catalog) => {
    // Get fresh catalog data from supabaseCatalogs array
    const freshCatalog = supabaseCatalogs.find(c => c.id === catalog.id);
    if (freshCatalog) {
      // Convert to legacy Catalog format
      const legacyCatalog: Catalog = {
        id: freshCatalog.id,
        name: freshCatalog.name,
        description: freshCatalog.description || undefined,
        productIds: Object.entries(productCatalogVisibility)
          .filter(([_, catalogs]) => catalogs.has(freshCatalog.id))
          .map(([productId]) => productId),
        categoryIds: [],
        createdAt: freshCatalog.created_at,
      };
      setCurrentCatalog(legacyCatalog);
      setSelectedCatalogProducts(new Set(legacyCatalog.productIds));
      setCatalogView("detail");
    }
  };

  const saveCatalogProducts = () => {
    if (!currentCatalog) return;
    
    setCatalogs(prev => prev.map(c => 
      c.id === currentCatalog.id 
        ? { ...c, productIds: Array.from(selectedCatalogProducts) }
        : c
    ));
    setCurrentCatalog(prev => prev ? { ...prev, productIds: Array.from(selectedCatalogProducts) } : null);
    
    toast({
      title: "Прайс-лист сохранён",
      description: `Добавлено ${selectedCatalogProducts.size} товаров`,
    });
  };

  const updateCatalogName = (newName: string) => {
    if (!currentCatalog || !newName.trim()) return;
    
    setCatalogs(prev => prev.map(c => 
      c.id === currentCatalog.id 
        ? { ...c, name: newName.trim() }
        : c
    ));
    setCurrentCatalog(prev => prev ? { ...prev, name: newName.trim() } : null);
    setEditingCatalogName(false);
  };

  const updateCatalogField = (catalogId: string, field: keyof Catalog, value: string) => {
    setCatalogs(prev => prev.map(c => 
      c.id === catalogId 
        ? { ...c, [field]: value.trim() || undefined }
        : c
    ));
    toast({
      title: "Сохранено",
    });
  };

  const toggleCatalogProduct = (productId: string) => {
    setSelectedCatalogProducts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const getCatalogProducts = (catalog: Catalog) => {
    return allProducts.filter(p => catalog.productIds.includes(p.id));
  };

  // Get catalog-specific pricing for a product (from Supabase)
  // Status is treated as "global" for the storefront and is mirrored into price-lists.
  const getCatalogProductPricing = useCallback((catalogId: string, productId: string): CatalogProductPricing | undefined => {
    const dbSettings = getCatalogProductSettingsFromDB(catalogId, productId);

    // If this catalog doesn't have a settings row yet, fall back to any known status
    // (we keep it synced across catalogs, but missing rows can exist for older products).
    if (!dbSettings) {
      const anyStatus = catalogProductSettings.find((s) => s.product_id === productId)?.status as ProductStatus | undefined;
      if (!anyStatus) return undefined;
      return { productId, status: anyStatus };
    }

    return {
      productId: dbSettings.product_id,
      // Ноль = валидная наценка (цена = себестоимость), undefined только если null
      markup: dbSettings.markup_value !== null && dbSettings.markup_value !== undefined ? {
        type: dbSettings.markup_type === 'fixed' ? 'rubles' : 'percent',
        value: dbSettings.markup_value
      } : undefined,
      status: dbSettings.status as ProductStatus,
      categories: dbSettings.categories,
      portionPrices: dbSettings.portion_prices || undefined,
      fixedPrice: dbSettings.fixed_price,
      isFixedPrice: dbSettings.is_fixed_price,
    };
  }, [getCatalogProductSettingsFromDB, catalogProductSettings]);

  // Update catalog-specific pricing for a product (save to Supabase)
  const updateCatalogProductPricing = useCallback(async (
    catalogId: string,
    productId: string,
    updates: Partial<CatalogProductPricing>
  ) => {
    // Admin panel can be opened without login; editing requires auth.
    if (!user) {
      toast({
        title: "Требуется вход",
        description: "Войдите в аккаунт продавца, чтобы сохранять изменения в прайс-листе.",
        variant: "destructive",
      });
      return;
    }

    const dbUpdates: Parameters<typeof updateCatalogProductSettingsInDB>[2] = {};

    if (updates.categories !== undefined) {
      dbUpdates.categories = updates.categories;
    }
    if (updates.markup !== undefined) {
      dbUpdates.markup_type = updates.markup?.type === "rubles" ? "fixed" : "percent";
      dbUpdates.markup_value = updates.markup?.value || 0;
    }
    if (updates.status !== undefined) {
      dbUpdates.status = updates.status;
    }
    if (updates.portionPrices !== undefined) {
      dbUpdates.portion_prices = updates.portionPrices;
    }

    await updateCatalogProductSettingsInDB(catalogId, productId, dbUpdates);
  }, [updateCatalogProductSettingsInDB, user, toast]);

  // Get effective sale price for catalog (using catalog markup or falling back to base product)
  const getCatalogSalePrice = (product: Product, catalogPricing?: CatalogProductPricing): number => {
    // Приоритет 1: Фиксированная цена каталога
    if (catalogPricing?.isFixedPrice && catalogPricing?.fixedPrice != null) {
      return catalogPricing.fixedPrice;
    }
    // Приоритет 2: Глобальная фиксированная цена товара
    if (product.isFixedPrice) {
      return product.pricePerUnit || 0;
    }
    // Приоритет 3: Расчёт по наценке
    const buyPrice = product.buyPrice || 0;
    const markup = catalogPricing?.markup !== undefined ? catalogPricing.markup : product.markup;
    return calculateSalePrice(buyPrice, markup);
  };

  // Get effective status for catalog
  const getCatalogProductStatus = (product: Product, catalogPricing?: CatalogProductPricing): ProductStatus => {
    return catalogPricing?.status || product.status || (product.inStock ? "in_stock" : "out_of_stock");
  };

  const addNewAccount = async () => {
    if (!newAccountLogin || !newAccountPassword) {
      toast({
        title: "Ошибка",
        description: "Введите логин и пароль",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Test connection
      const { data, error } = await supabase.functions.invoke('moysklad', {
        body: { 
          action: 'get_assortment', 
          limit: 1, 
          offset: 0,
          login: newAccountLogin,
          password: newAccountPassword
        }
      });

      if (error || data.error) {
        toast({
          title: "Ошибка авторизации",
          description: "Неверный логин или пароль МойСклад",
          variant: "destructive",
        });
        return;
      }

      // Create account in Supabase
      const createdAccount = await createMoyskladAccount({
        store_id: effectiveStoreId!,
        login: newAccountLogin,
        password: newAccountPassword,
        name: newAccountName || newAccountLogin,
        last_sync: new Date().toISOString(),
      });

      if (!createdAccount) {
        toast({
          title: "Ошибка",
          description: "Не удалось сохранить аккаунт",
          variant: "destructive",
        });
        return;
      }

      setNewAccountLogin("");
      setNewAccountPassword("");
      setNewAccountName("");
      setShowAddAccount(false);

      toast({
        title: "Аккаунт добавлен",
        description: `Подключен аккаунт ${createdAccount.name}`,
      });
    } catch (err) {
      console.error("Error:", err);
      toast({
        title: "Ошибка",
        description: "Произошла ошибка при подключении",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const deleteAccount = async (accountId: string) => {
    const deleted = await deleteMoyskladAccount(accountId);
    if (deleted) {
      toast({
        title: "Аккаунт удалён",
        description: "Аккаунт и связанные товары удалены",
      });
    }
  };

  const selectAccount = async (account: MoyskladAccount) => {
    setCurrentAccount(account);
    setImportView("catalog");

    const hasCachedProducts = hydrateMoyskladProductsFromCache(account);
    if (!hasCachedProducts) {
      await fetchMoySkladProducts(account);
    }
  };

  const fetchMoySkladProducts = async (account?: MoyskladAccount) => {
    const acc = account || currentAccount;
    if (!acc) return;

    setIsLoading(true);
    try {
      const allProducts: MoySkladProduct[] = [];
      let offset = 0;
      const batchSize = 20;
      let totalSize = 0;
      let hasMore = true;
      let pageCount = 0;
      const maxPages = 500;
      let previousOffset = -1;

      while (hasMore && pageCount < maxPages) {
        const { data, error } = await supabase.functions.invoke('moysklad', {
          body: {
            action: 'get_assortment',
            limit: batchSize,
            offset,
            login: acc.login,
            password: acc.password
          }
        });

        if (error) {
          toast({
            title: "Ошибка",
            description: "Не удалось загрузить товары из МойСклад",
            variant: "destructive",
          });
          break;
        }

        if (data?.error) {
          toast({
            title: "Ошибка авторизации",
            description: data.error,
            variant: "destructive",
          });
          break;
        }

        const page = (data?.products || []) as MoySkladProduct[];
        totalSize = data?.meta?.size || totalSize || page.length;
        const effectiveLimit = data?.meta?.limit || batchSize;

        if (page.length === 0) {
          hasMore = false;
          break;
        }

        allProducts.push(...page);
        previousOffset = offset;
        offset += page.length;
        pageCount += 1;

        // Защита от зависания на повторяющейся странице
        if (offset === previousOffset || page.length < effectiveLimit || offset >= totalSize) {
          hasMore = false;
        }
      }

      setMoyskladProducts(allProducts);
      setTotalProducts(totalSize || allProducts.length);

      try {
        localStorage.setItem(
          getMoyskladCacheKey(acc.id),
          JSON.stringify({
            products: allProducts,
            total: totalSize || allProducts.length,
            cachedAt: new Date().toISOString(),
          })
        );
      } catch {
        // ignore cache write errors
      }

      if (pageCount >= maxPages) {
        toast({
          title: "Загрузка частично завершена",
          description: "Достигнут лимит страниц, обновите список вручную",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Товары загружены",
          description: `Загружено ${allProducts.length} товаров`,
        });
      }
    } catch {
      toast({
        title: "Ошибка",
        description: "Произошла ошибка при подключении к МойСклад",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const backToAccounts = () => {
    setImportView("accounts");
    setCurrentAccount(null);
    setMoyskladProducts([]);
    setSelectedProducts(new Set());
    setExpandedProductImages(null);
    setProductImagesCache({});
  };

  // Toggle expanded images for a product and fetch them if needed
  const toggleProductImages = async (productId: string) => {
    if (expandedProductImages === productId) {
      setExpandedProductImages(null);
      return;
    }

    setExpandedProductImages(productId);

    // If already cached, don't refetch
    if (productImagesCache[productId]) {
      return;
    }

    if (!currentAccount) return;

    // Get linked product to check synced images
    const linkedProduct = getLinkedProduct(productId);
    const syncedImages = linkedProduct?.syncedMoyskladImages || [];
    const productImages = linkedProduct?.images || [];

    setLoadingProductImages(productId);
    try {
      const { data: imagesData } = await supabase.functions.invoke('moysklad', {
        body: { 
          action: 'get_product_images', 
          productId: productId,
          login: currentAccount.login,
          password: currentAccount.password
        }
      });

      if (imagesData?.images && imagesData.images.length > 0) {
        // Fetch all images content (only miniatures for preview)
        const imagePromises = imagesData.images.map(async (img: { miniature?: string; fullSize?: string; downloadHref?: string }, idx: number) => {
          let miniatureData = '';
          
          // Check if this image is already synced
          const imageSourceUrl = img.fullSize || img.downloadHref || '';
          const isSynced = syncedImages.includes(imageSourceUrl);
          const syncedUrl = isSynced && productImages[syncedImages.indexOf(imageSourceUrl)] 
            ? productImages[syncedImages.indexOf(imageSourceUrl)] 
            : undefined;

          if (img.miniature) {
            const { data: miniContent } = await supabase.functions.invoke('moysklad', {
              body: { 
                action: 'get_image_content', 
                imageUrl: img.miniature,
                login: currentAccount.login,
                password: currentAccount.password
              }
            });
            miniatureData = miniContent?.imageData || '';
          }

          return { 
            miniature: miniatureData, 
            fullSize: img.fullSize || img.downloadHref || '',
            downloadHref: img.downloadHref,
            isSynced,
            syncedUrl
          } as MoySkladImageInfo;
        });

        const loadedImages = await Promise.all(imagePromises);
        setProductImagesCache(prev => ({
          ...prev,
          [productId]: loadedImages.filter(img => img.miniature || img.fullSize)
        }));
      } else {
        setProductImagesCache(prev => ({ ...prev, [productId]: [] }));
      }
    } catch (err) {
      console.error("Error fetching product images:", err);
      setProductImagesCache(prev => ({ ...prev, [productId]: [] }));
    } finally {
      setLoadingProductImages(null);
    }
  };

  // Toggle image selection for download
  const toggleImageSelection = (productId: string, imageIndex: number) => {
    setSelectedImagesForDownload(prev => {
      const productSelected = prev[productId] || new Set<number>();
      const newSet = new Set(productSelected);
      if (newSet.has(imageIndex)) {
        newSet.delete(imageIndex);
      } else {
        newSet.add(imageIndex);
      }
      return { ...prev, [productId]: newSet };
    });
  };

  // Select all new (not synced) images for a product
  const selectAllNewImages = (productId: string) => {
    const images = productImagesCache[productId] || [];
    const newImageIndexes = images
      .map((img, idx) => ({ img, idx }))
      .filter(({ img }) => !img.isSynced)
      .map(({ idx }) => idx);
    
    setSelectedImagesForDownload(prev => ({
      ...prev,
      [productId]: new Set(newImageIndexes)
    }));
  };

  // Download selected images for a product
  const downloadSelectedImages = async (productId: string) => {
    if (!user) {
      const redirect = `${window.location.pathname}${window.location.search}`;
      toast({
        title: "Нужен вход",
        description: "Чтобы загружать фото, войдите в аккаунт",
        variant: "destructive",
      });
      navigate(`/auth?redirect=${encodeURIComponent(redirect)}`);
      return;
    }

    const selectedIndexes = selectedImagesForDownload[productId];
    if (!selectedIndexes || selectedIndexes.size === 0 || !currentAccount) return;

    const images = productImagesCache[productId] || [];
    const linkedProduct = getLinkedProduct(productId);
    
    if (!linkedProduct) {
      toast({
        title: "Ошибка",
        description: "Сначала импортируйте товар",
        variant: "destructive",
      });
      return;
    }

    setDownloadingImages(true);
    try {
      const newImages: string[] = [];
      const newSyncedUrls: string[] = [];

      for (const idx of Array.from(selectedIndexes)) {
        const img = images[idx];
        if (!img || img.isSynced) continue;

        // Fetch full size image
        const imageUrl = img.fullSize || img.downloadHref;
        if (!imageUrl) continue;

        const { data: fullContent } = await supabase.functions.invoke('moysklad', {
          body: { 
            action: 'get_image_content', 
            imageUrl: imageUrl,
            login: currentAccount.login,
            password: currentAccount.password
          }
        });

        if (fullContent?.imageData) {
          // Upload to storage
          const uploadedUrls = await uploadProductImages([fullContent.imageData], linkedProduct.id);
          if (uploadedUrls.length > 0) {
            newImages.push(uploadedUrls[0]);
            newSyncedUrls.push(imageUrl);
          }
        }
      }

      if (newImages.length > 0) {
        // Update product with new images
        const updatedImages = [...(linkedProduct.images || []), ...newImages];
        const updatedSyncedMoyskladImages = [...(linkedProduct.syncedMoyskladImages || []), ...newSyncedUrls];
        
        const updatedProduct = {
          ...linkedProduct,
          images: updatedImages,
          syncedMoyskladImages: updatedSyncedMoyskladImages,
        };
        
        // Update in local state (will be persisted to localStorage automatically)
        setImportedProducts(prev => prev.map(p => 
          p.id === linkedProduct.id ? updatedProduct : p
        ));

        // Update cache to reflect synced status
        setProductImagesCache(prev => ({
          ...prev,
          [productId]: images.map((img, idx) => {
            if (selectedIndexes.has(idx)) {
              return { ...img, isSynced: true, syncedUrl: newImages[Array.from(selectedIndexes).indexOf(idx)] };
            }
            return img;
          })
        }));

        // Clear selection
        setSelectedImagesForDownload(prev => ({ ...prev, [productId]: new Set() }));

        toast({
          title: "Изображения загружены",
          description: `Загружено ${newImages.length} изображений`,
        });
      }
    } catch (err) {
      console.error("Error downloading images:", err);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить изображения",
        variant: "destructive",
      });
    } finally {
      setDownloadingImages(false);
    }
  };

  // Count new images for a product
  const getNewImagesCount = (productId: string): number => {
    const images = productImagesCache[productId];
    if (!images) return 0;
    return images.filter(img => !img.isSynced).length;
  };

  const toggleProductSelection = (productId: string) => {
    setSelectedProducts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const selectAllProducts = () => {
    if (selectedProducts.size === moyskladProducts.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(moyskladProducts.map(p => p.id)));
    }
  };

  // Bulk sync selected products (only linked ones)
  const bulkSyncSelectedProducts = async () => {
    if (selectedProducts.size === 0 || !currentAccount) {
      toast({ title: "Внимание", description: "Выберите товары для синхронизации", variant: "destructive" });
      return;
    }

    const linkedProductsToSync = Array.from(selectedProducts)
      .map(msId => getLinkedProduct(msId))
      .filter((p): p is Product => !!p);

    if (linkedProductsToSync.length === 0) {
      toast({ title: "Внимание", description: "Среди выбранных нет импортированных товаров", variant: "destructive" });
      return;
    }

    setIsSyncing(true);
    try {
      // Fetch ALL products with pagination
      const allMsProducts: MoySkladProduct[] = [];
      let syncOffset = 0;
      const syncBatchSize = 20;
      let syncHasMore = true;
      while (syncHasMore) {
        const { data, error } = await supabase.functions.invoke('moysklad', {
          body: { action: 'get_assortment', limit: syncBatchSize, offset: syncOffset, login: currentAccount.login, password: currentAccount.password }
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        const page = data?.products || [];
        const total = data?.meta?.size || 0;
        const effectiveLimit = data?.meta?.limit || syncBatchSize;

        if (page.length > 0) {
          allMsProducts.push(...page);
          syncOffset += page.length;
          syncHasMore = syncOffset < total && page.length >= effectiveLimit;
        } else {
          syncHasMore = false;
        }
      }

      if (allMsProducts.length > 0) {
        const msProductsMap = new Map(allMsProducts.map((p: MoySkladProduct) => [p.id, p]));
        const mapping = syncSettings.fieldMapping;
        
        setImportedProducts(prev => prev.map(product => {
          if (product.moyskladId && linkedProductsToSync.some(lp => lp.id === product.id)) {
            const msProduct = msProductsMap.get(product.moyskladId) as MoySkladProduct | undefined;
            if (msProduct) {
              const updates: Partial<Product> = {};
              if (mapping.buyPrice && msProduct.buyPrice !== undefined) updates.buyPrice = msProduct.buyPrice;
              if (mapping.price && msProduct.price !== undefined) updates.pricePerUnit = msProduct.price;
              if (mapping.quantity) updates.inStock = msProduct.quantity > 0 || msProduct.stock > 0;
              if (mapping.name && msProduct.name) updates.name = msProduct.name;
              if (mapping.description && msProduct.description) updates.description = msProduct.description;
              if (mapping.unit && msProduct.uom) updates.unit = msProduct.uom;
              return { ...product, ...updates };
            }
          }
          return product;
        }));

        toast({ title: "Синхронизация завершена", description: `Обновлено ${linkedProductsToSync.length} товаров` });
      }
    } catch (err) {
      console.error("Bulk sync error:", err);
      toast({ title: "Ошибка синхронизации", description: "Не удалось обновить данные", variant: "destructive" });
    } finally {
      setIsSyncing(false);
    }
  };

  // Bulk download all photos for selected linked products
  const bulkDownloadPhotosForSelected = async () => {
    if (selectedProducts.size === 0 || !currentAccount) {
      toast({ title: "Внимание", description: "Выберите товары для загрузки фото", variant: "destructive" });
      return;
    }

    if (!user) {
      const redirect = `${window.location.pathname}${window.location.search}`;
      toast({ title: "Нужен вход", description: "Чтобы загружать фото, войдите в аккаунт", variant: "destructive" });
      navigate(`/auth?redirect=${encodeURIComponent(redirect)}`);
      return;
    }

    const linkedProductsWithImages = Array.from(selectedProducts)
      .map(msId => {
        const msProduct = moyskladProducts.find(p => p.id === msId);
        const linkedProduct = getLinkedProduct(msId);
        return { msProduct, linkedProduct, msId };
      })
      .filter((item): item is { msProduct: MoySkladProduct; linkedProduct: Product; msId: string } => 
        !!item.msProduct && !!item.linkedProduct && (item.msProduct.imagesCount || 0) > 0
      );

    if (linkedProductsWithImages.length === 0) {
      toast({ title: "Внимание", description: "Среди выбранных нет импортированных товаров с фотографиями", variant: "destructive" });
      return;
    }

    setDownloadingImages(true);
    let totalDownloaded = 0;

    try {
      for (const { linkedProduct, msId } of linkedProductsWithImages) {
        const { data: imagesData } = await supabase.functions.invoke('moysklad', {
          body: { action: 'get_product_images', productId: msId, login: currentAccount.login, password: currentAccount.password }
        });

        if (!imagesData?.images || imagesData.images.length === 0) continue;

        const syncedImages = linkedProduct.syncedMoyskladImages || [];
        const newImages: string[] = [];
        const newSyncedUrls: string[] = [];

        for (const img of imagesData.images) {
          const imageUrl = img.fullSize || img.downloadHref;
          if (!imageUrl || syncedImages.includes(imageUrl)) continue;

          const { data: fullContent } = await supabase.functions.invoke('moysklad', {
            body: { action: 'get_image_content', imageUrl, login: currentAccount.login, password: currentAccount.password }
          });

          if (fullContent?.imageData) {
            const uploadedUrls = await uploadProductImages([fullContent.imageData], linkedProduct.id);
            if (uploadedUrls.length > 0) {
              newImages.push(uploadedUrls[0]);
              newSyncedUrls.push(imageUrl);
            }
          }
        }

        if (newImages.length > 0) {
          const updatedImages = [...(linkedProduct.images || []), ...newImages];
          const updatedSyncedMoyskladImages = [...(linkedProduct.syncedMoyskladImages || []), ...newSyncedUrls];
          
          setImportedProducts(prev => prev.map(p => 
            p.id === linkedProduct.id ? { ...p, images: updatedImages, syncedMoyskladImages: updatedSyncedMoyskladImages } : p
          ));
          totalDownloaded += newImages.length;
        }
      }

      toast({ title: "Загрузка завершена", description: `Загружено ${totalDownloaded} новых фотографий для ${linkedProductsWithImages.length} товаров` });
    } catch (err) {
      console.error("Bulk photo download error:", err);
      toast({ title: "Ошибка", description: "Не удалось загрузить фотографии", variant: "destructive" });
    } finally {
      setDownloadingImages(false);
    }
  };

  const importSelectedProducts = async () => {
    if (selectedProducts.size === 0 || !currentAccount) {
      toast({
        title: "Внимание",
        description: "Выберите товары для импорта",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    const newProducts: Product[] = [];

    for (const productId of selectedProducts) {
      const msProduct = moyskladProducts.find(p => p.id === productId);
      if (!msProduct) continue;

      // Check if already imported (and not deleted)
      const existingProduct = importedProducts.find(p => p.moyskladId === msProduct.id);
      if (existingProduct && !deletedMoyskladIds.has(msProduct.id)) {
        continue; // Skip already imported (unless it was deleted)
      }

      // Fetch images for this product - both miniature and full size
      let imageUrl = "https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=400&h=400&fit=crop";
      let imageFullUrl = imageUrl;
      let allImages: string[] = [];
      let syncedMoyskladImages: string[] = []; // Track original MoySklad URLs
      
      if (msProduct.imagesCount > 0) {
        try {
          const { data: imagesData } = await supabase.functions.invoke('moysklad', {
            body: { 
              action: 'get_product_images', 
              productId: msProduct.id,
              login: currentAccount.login,
              password: currentAccount.password
            }
          });
          
          if (imagesData?.images && imagesData.images.length > 0) {
            // Fetch all images (full size) for best quality
            const imagePromises = imagesData.images.map(async (imageInfo: { miniature?: string; fullSize?: string; downloadHref?: string }) => {
              // Prefer fullSize, then downloadHref for best quality
              const sourceUrl = imageInfo.fullSize || imageInfo.downloadHref || '';
              if (sourceUrl) {
                const { data: fullContent } = await supabase.functions.invoke('moysklad', {
                  body: { 
                    action: 'get_image_content', 
                    imageUrl: sourceUrl,
                    login: currentAccount.login,
                    password: currentAccount.password
                  }
                });
                return { base64: fullContent?.imageData || '', sourceUrl };
              }
              return { base64: '', sourceUrl: '' };
            });
            
            const loadedImages = await Promise.all(imagePromises);
            const validImages = loadedImages.filter(img => img.base64);
            
            // Upload images to Storage and get public URLs
            if (validImages.length > 0) {
              const productStorageId = `ms_${msProduct.id}`;
              allImages = await uploadProductImages(validImages.map(img => img.base64), productStorageId);
              syncedMoyskladImages = validImages.map(img => img.sourceUrl);
              
              // Use first image as main thumbnail
              if (allImages.length > 0) {
                imageFullUrl = allImages[0];
                imageUrl = allImages[0];
              }
            }
          }
        } catch (err) {
          console.log("Could not fetch image for product:", msProduct.id);
        }
      }

      // Convert to local product format
      const newProduct: Product = {
        id: `ms_${msProduct.id}`,
        name: msProduct.name,
        description: msProduct.description || "",
        pricePerUnit: msProduct.price || 0,
        buyPrice: msProduct.buyPrice,
        unit: msProduct.uom || "кг",
        image: imageUrl,
        imageFull: imageFullUrl,
        images: allImages.length > 0 ? allImages : undefined,
        syncedMoyskladImages: syncedMoyskladImages.length > 0 ? syncedMoyskladImages : undefined,
        productType: msProduct.weight > 0 ? "weight" : "piece",
        weightVariants: msProduct.weight > 0 ? [
          { type: "full", weight: msProduct.weight },
          { type: "half", weight: msProduct.weight / 2 },
        ] : undefined,
        pieceVariants: msProduct.weight <= 0 ? [
          { type: "box", quantity: 10 },
          { type: "single", quantity: 1 },
        ] : undefined,
        inStock: msProduct.quantity > 0 || msProduct.stock > 0,
        isHit: false,
        source: "moysklad",
        moyskladId: msProduct.id,
        autoSync: false,
        accountId: currentAccount.id,
      };

      newProducts.push(newProduct);
    }

    // Remove re-imported products from deleted IDs set
    const reimportedMoyskladIds = newProducts.map(p => p.moyskladId).filter(Boolean) as string[];
    if (reimportedMoyskladIds.length > 0) {
      setDeletedMoyskladIds(prev => {
        const newSet = new Set(prev);
        reimportedMoyskladIds.forEach(id => newSet.delete(id));
        return newSet;
      });
      
      // Clear image cache for fresh start
      setProductImagesCache(prev => {
        const newCache = { ...prev };
        reimportedMoyskladIds.forEach(id => delete newCache[id]);
        return newCache;
      });
    }

    // Save products to Supabase
    let savedCount = 0;
    for (const product of newProducts) {
      const msProduct = moyskladProducts.find(p => p.id === product.moyskladId);
      const categoryId = msProduct ? await resolveOrCreateCategory(msProduct.productFolderName) : null;
      const msPrices = msProduct?.salePrices?.length ? Object.fromEntries(msProduct.salePrices.map(sp => [sp.name, sp.value])) : undefined;
      
      const existingSupabaseProduct = supabaseProducts.find(sp => sp.moysklad_id === product.moyskladId);
      
      if (existingSupabaseProduct) {
        await updateSupabaseProduct(existingSupabaseProduct.id, {
          name: product.name,
          description: product.description || null,
          price: product.pricePerUnit,
          buy_price: product.buyPrice || null,
          unit: product.unit || null,
          images: product.images || null,
          quantity: product.inStock ? 1 : 0,
          is_active: true,
          source: 'moysklad',
          moysklad_id: product.moyskladId || null,
          moysklad_account_id: currentAccount.id,
          auto_sync: product.autoSync || false,
          synced_moysklad_images: product.syncedMoyskladImages || null,
          ...(categoryId ? { category_id: categoryId } : {}),
          ...(msPrices ? { moysklad_prices: msPrices } : {}),
        } as any);
        savedCount++;
      } else {
        const slug = product.name
          .toLowerCase()
          .replace(/[^a-zа-яё0-9\s]/gi, '')
          .replace(/\s+/g, '-')
          .substring(0, 50) + '-' + Date.now();
        
        await createSupabaseProduct({
          name: product.name,
          description: product.description || null,
          price: product.pricePerUnit,
          buy_price: product.buyPrice || null,
          unit: product.unit || null,
          images: product.images || null,
          quantity: product.inStock ? 1 : 0,
          is_active: true,
          source: 'moysklad',
          moysklad_id: product.moyskladId || null,
          moysklad_account_id: currentAccount.id,
          auto_sync: product.autoSync || false,
          synced_moysklad_images: product.syncedMoyskladImages || null,
          slug,
          store_id: effectiveStoreId!,
          ...(categoryId ? { category_id: categoryId } : {}),
          ...(msPrices ? { moysklad_prices: msPrices } : {}),
        } as any);
        savedCount++;
      }
    }

    setSelectedProducts(new Set());
    setIsLoading(false);

    toast({
      title: "Импорт завершён",
      description: `Импортировано ${savedCount} товаров в ассортимент`,
    });
  };

  // Use Supabase products - convert to legacy format for compatibility
  const allProducts = useMemo(() => {
    return supabaseProducts.map(sp => {
      // Get category assignments for this product
      const assignedCategoryIds = getProductCategoryIds(sp.id);
      // Build categories array: use assignments first, fallback to category_id
      const categories = assignedCategoryIds.length > 0
        ? assignedCategoryIds
        : sp.category_id ? [sp.category_id] : [];
      
      return {
        id: sp.id,
        name: sp.name,
        sku: sp.sku || undefined,
        description: sp.description || "",
        pricePerUnit: sp.price,
        buyPrice: sp.buy_price || undefined,
        markup: sp.markup_type && sp.markup_value ? { 
          type: (sp.markup_type === "fixed" ? "rubles" : sp.markup_type) as "percent" | "rubles", 
          value: sp.markup_value 
        } : undefined,
        unit: sp.unit || "кг",
        image: sp.images?.[0] || "",
        imageFull: sp.images?.[0] || "",
        images: sp.images || [],
        productType: sp.unit === "шт" ? "piece" as const : "weight" as const,
        packagingType: (sp.packaging_type || "piece") as PackagingType,
        unitWeight: sp.unit_weight || undefined,
        inStock: (sp.quantity || 0) > 0,
        isHit: false,
        source: (sp.source || "manual") as "moysklad" | undefined,
        moyskladId: sp.moysklad_id || undefined,
        autoSync: sp.auto_sync || false,
        accountId: sp.moysklad_account_id || undefined,
        moyskladAccountName: sp.moysklad_account_id 
          ? accounts.find(a => a.id === sp.moysklad_account_id)?.name || undefined
          : undefined,
        syncedMoyskladImages: sp.synced_moysklad_images || [],
        status: sp.is_active ? "in_stock" as const : "hidden" as const,
        isFixedPrice: sp.is_fixed_price || false,
        moyskladPrices: sp.moysklad_prices || null,
        categories,
      };
    }) as Product[];
  }, [supabaseProducts, accounts, getProductCategoryIds]);

  // Update product via Supabase
  const updateProduct = async (updatedProduct: Product) => {
    // Admin panel can be opened without login; editing requires auth.
    if (!user) {
      toast({
        title: "Требуется вход",
        description: "Войдите в аккаунт продавца, чтобы сохранять изменения.",
        variant: "destructive",
      });
      return;
    }

    const result = await updateSupabaseProduct(updatedProduct.id, {
      name: updatedProduct.name,
      sku: updatedProduct.sku || null,
      description: updatedProduct.description || null,
      price: updatedProduct.pricePerUnit,
      buy_price: updatedProduct.buyPrice || null,
      markup_type: updatedProduct.markup?.type || null,
      markup_value: updatedProduct.markup?.value || null,
      unit: updatedProduct.unit || null,
      unit_weight: updatedProduct.unitWeight || null,
      packaging_type: updatedProduct.packagingType || null,
      quantity: updatedProduct.inStock ? 1 : 0,
      images: updatedProduct.images || null,
      is_active: updatedProduct.status !== "hidden",
      auto_sync: updatedProduct.autoSync || false,
      is_fixed_price: updatedProduct.isFixedPrice || false,
    });

    if (result) {
      toast({
        title: "Товар сохранён",
        description: `${updatedProduct.name} обновлён`,
      });
    } else {
      toast({
        title: "Не удалось сохранить",
        description: "Проверьте, что вы авторизованы и у вас есть доступ к магазину.",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    setEditDialogOpen(true);
  };

  // Bulk update products via Supabase
  const bulkUpdateProducts = async (updates: Partial<Product>) => {
    const selectedIds = Array.from(selectedBulkProducts);
    
    // Convert Product updates to StoreProduct format
    const supabaseUpdates: Partial<StoreProduct> = {};
    if (updates.unit) supabaseUpdates.unit = updates.unit;
    if (updates.packagingType) supabaseUpdates.packaging_type = updates.packagingType;
    if (updates.unitWeight !== undefined) supabaseUpdates.unit_weight = updates.unitWeight || null;
    if (updates.markup) {
      supabaseUpdates.markup_type = updates.markup.type;
      supabaseUpdates.markup_value = updates.markup.value;
    }
    
    // Update each product in Supabase
    for (const id of selectedIds) {
      await updateSupabaseProduct(id, supabaseUpdates);
    }
    
    toast({
      title: "Товары обновлены",
      description: `Изменено ${selectedIds.length} товар(ов)`,
    });
    
    setSelectedBulkProducts(new Set());
  };

  // Bulk delete products via Supabase
  const bulkDeleteProducts = async () => {
    const selectedIds = Array.from(selectedBulkProducts);
    
    // Delete from Supabase
    const deleted = await deleteSupabaseProducts(selectedIds);
    
    if (deleted) {
      toast({
        title: "Товары удалены",
        description: `Удалено ${selectedIds.length} товар(ов)`,
      });
    }
    
    setSelectedBulkProducts(new Set());
  };

  // Toggle bulk product selection
  const toggleBulkProductSelection = (productId: string) => {
    setSelectedBulkProducts(prev => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };


  // Get sale price with markup
  const getProductSalePrice = (product: Product): number => {
    if (product.buyPrice && product.markup) {
      return calculateSalePrice(product.buyPrice, product.markup);
    }
    return product.pricePerUnit;
  };

  // Filtered "All Products"
  const filteredAllProducts = useMemo(() => {
    const filtered = allProducts.filter(product => {
      if (allProductsFilters.name && !product.name.toLowerCase().includes(allProductsFilters.name.toLowerCase())) {
        return false;
      }
      if (allProductsFilters.sku && !(product.sku || '').toLowerCase().includes(allProductsFilters.sku.toLowerCase())) {
        return false;
      }
      if (allProductsFilters.desc && !(product.description || '').toLowerCase().includes(allProductsFilters.desc.toLowerCase())) {
        return false;
      }
      if (allProductsFilters.source !== "all") {
        const isMs = product.source === "moysklad";
        if (allProductsFilters.source === "moysklad" && !isMs) return false;
        if (allProductsFilters.source === "local" && isMs) return false;
      }
      if (allProductsFilters.unit !== "all" && product.unit !== allProductsFilters.unit) {
        return false;
      }
      if (allProductsFilters.type !== "all" && product.productType !== allProductsFilters.type) {
        return false;
      }
      if (allProductsFilters.volume) {
        const volumeStr = product.unitWeight?.toString() || '';
        if (!volumeStr.includes(allProductsFilters.volume)) return false;
      }
      if (allProductsFilters.cost) {
        const costStr = product.buyPrice?.toString() || '';
        if (!costStr.includes(allProductsFilters.cost)) return false;
      }
      if (allProductsFilters.status !== "all") {
        if (allProductsFilters.status === "inStock" && !product.inStock) return false;
        if (allProductsFilters.status === "outOfStock" && product.inStock) return false;
      }
      if (allProductsFilters.sync !== "all" && product.source === "moysklad") {
        if (allProductsFilters.sync === "synced" && !product.autoSync) return false;
        if (allProductsFilters.sync === "notSynced" && product.autoSync) return false;
      }
      // Filter by groups (multi-select)
      if (allProductsFilters.groups.length > 0) {
        const productGroupIds = getProductGroupIds(product.id);
        // Check if product has at least one of the selected groups
        // Special case: "none" means products without any groups
        const hasNoneFilter = allProductsFilters.groups.includes("none");
        const otherGroupFilters = allProductsFilters.groups.filter(g => g !== "none");
        
        const matchesNone = hasNoneFilter && productGroupIds.length === 0;
        const matchesGroups = otherGroupFilters.length > 0 && otherGroupFilters.some(g => productGroupIds.includes(g));
        
        if (!matchesNone && !matchesGroups) return false;
      }
      // Filter by MoySklad account
      if (allProductsFilters.msAccount && allProductsFilters.msAccount !== "all") {
        if (allProductsFilters.msAccount === "none") {
          if (product.moyskladAccountName) return false;
        } else {
          if (product.moyskladAccountName !== allProductsFilters.msAccount) return false;
        }
      }
      return true;
    });
    
    // Sort by custom order if available
    if (productOrder.length > 0) {
      return [...filtered].sort((a, b) => {
        const indexA = productOrder.indexOf(a.id);
        const indexB = productOrder.indexOf(b.id);
        if (indexA === -1 && indexB === -1) return 0;
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      });
    }
    
    return filtered;
  }, [allProducts, allProductsFilters, productOrder, getProductGroupIds]);
  
  // Product IDs for sortable rows
  const productIds = useMemo(() => filteredAllProducts.map(p => p.id), [filteredAllProducts]);

  // Select all filtered products
  const selectAllBulkProducts = () => {
    if (selectedBulkProducts.size === filteredAllProducts.length) {
      setSelectedBulkProducts(new Set());
    } else {
      setSelectedBulkProducts(new Set(filteredAllProducts.map(p => p.id)));
    }
  };
  
  // Handle row reorder
  const handleProductReorder = useCallback((newOrder: string[]) => {
    setProductOrder(newOrder);
    // Save to localStorage
    localStorage.setItem('admin-products-row-order', JSON.stringify(newOrder));
  }, []);
  
  // Load saved product order on mount
  useEffect(() => {
    const saved = localStorage.getItem('admin-products-row-order');
    if (saved) {
      try {
        setProductOrder(JSON.parse(saved));
      } catch (e) {
        // ignore
      }
    }
  }, []);

  // Filtered MoySklad products
  const filteredMoyskladProducts = useMemo(() => {
    return moyskladProducts.filter(product => {
      if (importFilters.name && !product.name.toLowerCase().includes(importFilters.name.toLowerCase())) {
        return false;
      }
      if (importFilters.article && !product.article?.toLowerCase().includes(importFilters.article.toLowerCase())) {
        return false;
      }
      if (importFilters.code && !product.code?.toLowerCase().includes(importFilters.code.toLowerCase())) {
        return false;
      }
      if (importFilters.stock !== "all") {
        const hasStock = product.quantity > 0 || product.stock > 0;
        if (importFilters.stock === "inStock" && !hasStock) return false;
        if (importFilters.stock === "outOfStock" && hasStock) return false;
      }
      return true;
    });
  }, [moyskladProducts, importFilters]);

  const getPriceByType = useCallback((product: MoySkladProduct, aliases: string[]) => {
    const normalized = aliases.map((name) => name.toLowerCase());
    const found = product.salePrices?.find((sp) => normalized.includes((sp.name || "").toLowerCase()));
    return found?.value ?? null;
  }, []);

  const getCategoryLabel = useCallback((product: MoySkladProduct) => {
    if (!product.productFolderName) return "-";
    const parts = product.productFolderName.split('/').map((x) => x.trim()).filter(Boolean);
    return parts[parts.length - 1] || product.productFolderName;
  }, []);

  const exportMoyskladTableToExcel = useCallback(() => {
    if (filteredMoyskladProducts.length === 0) {
      toast({ title: "Нет данных", description: "Сначала загрузите товары", variant: "destructive" });
      return;
    }

    const rows = filteredMoyskladProducts.map((product) => {
      const linkedProduct = getLinkedProduct(product.id);
      const retailPrice = getPriceByType(product, ["Розница", "Розничная", "Цена продажи"]) ?? product.price;
      const utp1 = getPriceByType(product, ["УТП1", "УТП-1", "Утп 1"]);
      const utp2 = getPriceByType(product, ["УТП2", "УТП-2", "Утп 2"]);

      return {
        "Связан": linkedProduct ? "Да" : "Нет",
        "Автосинхр": linkedProduct?.autoSync ? "Вкл" : "Выкл",
        "Название": product.name,
        "Артикул": product.article || "",
        "Код": product.code || "",
        "Розница": retailPrice,
        "УТП 1": utp1,
        "УТП 2": utp2,
        "Закупочная": product.buyPrice || null,
        "Остаток": product.quantity || product.stock || 0,
        "Ед. изм.": product.uom || "",
        "Категория": getCategoryLabel(product),
        "Путь категории": product.productFolderName || "",
        "Все цены JSON": JSON.stringify(product.salePrices || []),
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "МойСклад");
    XLSX.writeFile(wb, `moysklad_import_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }, [filteredMoyskladProducts, getCategoryLabel, getLinkedProduct, getPriceByType, toast]);

  // Loading state - wait for auth and store context
  // В workspaceMode не показываем спиннер, так как данные магазина уже загружены в SellerWorkspace
  if (!workspaceMode && (authLoading || storeContextLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className={`bg-background ${workspaceMode ? 'h-full' : 'min-h-screen'}`}>

      {/* Header - скрывается в workspaceMode, там свой общий хедер */}
      {!workspaceMode && (
        <header className="sticky top-0 z-50 bg-card border-b border-border">
          <div className="flex items-center justify-between px-4 h-14">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (currentStoreSubdomain || storeSubdomainOverride) {
                    navigate(`/store/${storeSubdomainOverride || currentStoreSubdomain}`);
                  } else {
                    navigate("/");
                  }
                }}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              {currentStoreName && (
                <div className="flex items-center gap-2">
                  <Store className="h-5 w-5 text-primary" />
                  <span className="font-semibold">{currentStoreName}</span>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {/* Super admin quick link */}
              {isSuperAdmin && !isSuperAdminContext && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/super-admin')}
                  className="flex items-center gap-2"
                >
                  <Shield className="h-4 w-4" />
                  <span className="hidden sm:inline">Супер-админ</span>
                </Button>
              )}
            </div>
          </div>
        </header>
      )}

      {/* Tab Navigation - same for mobile and desktop */}
      <MobileTabNav
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        workspaceMode={workspaceMode}
      />

      {/* Admin Onboarding Banner - показывается под лентой на шаге explore-admin */}
      <AdminOnboardingBanner />

      {/* Main content */}
      <main 
        id={`panel-${activeSection}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeSection}`}
        className={`flex-1 p-4 overflow-y-auto ${workspaceMode ? 'min-h-0' : 'min-h-[calc(100vh-112px)]'}`}
      >
          {/* Show loading or no store message if effectiveStoreId is not available */}
          {!effectiveStoreId && !storeContextLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Store className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Магазин не найден</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Не удалось загрузить данные магазина
              </p>
              <Button onClick={() => navigate('/dashboard')}>
                Вернуться на главную
              </Button>
            </div>
          )}
          
          {effectiveStoreId && activeSection === "products" && (
            <>
              <ProductsSection
                products={allProducts}
                catalogs={catalogs}
                productGroups={productGroups}
                productCatalogVisibility={productCatalogVisibility}
                getProductGroupIds={getProductGroupIds}
                onToggleCatalogVisibility={toggleProductCatalogVisibility}
                onSetProductGroupAssignments={setProductGroupAssignments}
                onCreateProductGroup={async (name) => {
                  const group = await createProductGroup(name);
                  return group ? { id: group.id, name: group.name, storeId: effectiveStoreId || '' } : null;
                }}
                onCreateCatalog={async (name) => {
                  const catalog = await createSupabaseCatalog(name);
                  return catalog ? { 
                    id: catalog.id, 
                    name: catalog.name, 
                    productIds: [], 
                    categoryIds: [], 
                    createdAt: catalog.created_at 
                  } : null;
                }}
                onUpdateProduct={updateProduct}
                onDeleteProducts={async (ids) => {
                  await deleteSupabaseProducts(ids);
                }}
                onToggleAutoSync={toggleAutoSync}
                onAddProduct={() => setQuickAddDialogOpen(true)}
                onNavigateToCatalog={(catalogId) => {
                  const supabaseCatalog = supabaseCatalogs.find(c => c.id === catalogId);
                  if (supabaseCatalog) {
                    handleSectionChange("catalogs");
                    setTimeout(() => {
                      const legacyCatalog: Catalog = {
                        id: supabaseCatalog.id,
                        name: supabaseCatalog.name,
                        description: supabaseCatalog.description || undefined,
                        productIds: Object.entries(productCatalogVisibility)
                          .filter(([_, catalogs]) => catalogs.has(supabaseCatalog.id))
                          .map(([productId]) => productId),
                        categoryIds: [],
                        createdAt: supabaseCatalog.created_at,
                      };
                      setCurrentCatalog(legacyCatalog);
                      setSelectedCatalogProducts(new Set(legacyCatalog.productIds));
                      setCatalogView("detail");
                    }, 0);
                  }
                }}
                onOpenAIAssistant={() => setAiAssistantOpen(true)}
                customUnits={customUnits}
                customPackagingTypes={customPackagingTypes}
                onAddCustomUnit={(unit) => setCustomUnits(prev => [...prev, unit])}
                onAddCustomPackaging={(type) => setCustomPackagingTypes(prev => [...prev, type])}
                onAddProductsFromMegacatalog={handleAddProductsFromMegacatalog}
                moyskladLogin={firstMoyskladAccount?.login}
                moyskladPassword={firstMoyskladAccount?.password}
                onAddToAvitoFeed={avitoFeed.addProductsToFeed}
                avitoFeedProductIds={avitoFeed.feedProductIds}
                onRemoveFromAvitoFeed={avitoFeed.removeProductsFromFeed}
              />

              {/* Product Pricing Dialog */}
              <ProductPricingDialog
                product={editingProduct}
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                onSave={updateProduct}
              />
              
              {/* AI Assistant Panel */}
              <AIAssistantPanel
                open={aiAssistantOpen}
                onOpenChange={setAiAssistantOpen}
                storeId={effectiveStoreId}
                catalogId={currentCatalog?.id}
                catalogName={currentCatalog?.name}
              />
            </>
          )}

          {effectiveStoreId && activeSection === "megacatalog" && (
            <MegacatalogSection
              existingProductIds={new Set(allProducts.map(p => p.id))}
              onAddProducts={handleAddProductsFromMegacatalog}
            />
          )}

          {effectiveStoreId && activeSection === "import" && (
            <>
              {/* Source selection screen */}
              {importSource === "select" && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">Импорт товаров</h2>
                    <p className="text-sm text-muted-foreground">
                      Выберите источник для импорта товаров
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <ImportSourceCard
                      icon={<Package className="h-7 w-7 text-primary" />}
                      title="МойСклад"
                      description="Синхронизация товаров с учётной системой"
                      onClick={() => setImportSource("moysklad")}
                    />
                    
                    <ImportSourceCard
                      icon={<FileSpreadsheet className="h-7 w-7 text-green-600" />}
                      title="Импорт из Excel"
                      description="Загрузка товаров из .xlsx файла"
                      onClick={() => setImportSource("excel")}
                      badge="Новое"
                    />
                    
                    <ImportSourceCard
                      icon={<Sheet className="h-7 w-7 text-blue-600" />}
                      title="Google Таблицы"
                      description="Импорт из таблиц Google Sheets"
                      onClick={() => setImportSource("google-sheets")}
                      badge="Скоро"
                      disabled={true}
                    />
                  </div>
                </div>
              )}

              {/* Excel import screen */}
              {importSource === "excel" && (
                <ExcelImportSection 
                  storeId={effectiveStoreId || ''}
                  onBack={() => setImportSource("select")}
                  onComplete={() => {
                    refetchProducts();
                    refetchProductGroups();
                    toast({
                      title: "Импорт завершён",
                      description: "Товары успешно импортированы"
                    });
                  }}
                />
              )}

              {/* Google Sheets import screen */}
              {importSource === "google-sheets" && (
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => setImportSource("select")}>
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Назад
                    </Button>
                    <div>
                      <h2 className="text-xl font-semibold text-foreground">Google Таблицы</h2>
                      <p className="text-sm text-muted-foreground">Подключите Google Sheet для импорта</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4 max-w-md">
                    <div className="space-y-2">
                      <Label>Ссылка на таблицу</Label>
                      <Input placeholder="https://docs.google.com/spreadsheets/d/..." />
                    </div>
                    <Button>
                      <Link2 className="h-4 w-4 mr-2" />
                      Подключить таблицу
                    </Button>
                  </div>
                </div>
              )}

              {/* MoySklad import - existing logic */}
              {importSource === "moysklad" && (
                <>
                  <div className="mb-4">
                    <Button variant="ghost" size="sm" onClick={() => setImportSource("select")} className="mb-2">
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Назад к источникам
                    </Button>
                  </div>
                  
                  {importView === "accounts" && (
                <>
                  <div className="mb-4">
                    <h2 className="text-xl font-semibold text-foreground">Импорт из МойСклад</h2>
                    <p className="text-sm text-muted-foreground">
                      Выберите аккаунт МойСклад для просмотра каталога
                    </p>
                  </div>

                  {/* Accounts list */}
                  <div className="space-y-3 mb-6">
                    {accounts.map((account) => (
                      <div
                        key={account.id}
                        className="bg-card rounded-lg border border-border p-4 flex items-center justify-between hover:border-primary/50 transition-colors cursor-pointer"
                        onClick={() => selectAccount(account)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <LogIn className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-medium text-foreground">{account.name}</h3>
                            <p className="text-sm text-muted-foreground">{account.login}</p>
                            {account.last_sync && (
                              <p className="text-xs text-muted-foreground">
                                Последняя синхр.: {new Date(account.last_sync).toLocaleDateString('ru-RU')}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteAccount(account.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </div>
                    ))}

                    {accounts.length === 0 && !showAddAccount && (
                      <div className="bg-card rounded-lg border border-border p-8 text-center">
                        <LogIn className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <h3 className="font-medium text-foreground mb-2">Нет подключённых аккаунтов</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Добавьте аккаунт МойСклад для импорта товаров
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Add new account form */}
                  {showAddAccount ? (
                    <div className="bg-card rounded-lg border border-border p-6 max-w-md">
                      <div className="flex items-center gap-2 mb-4">
                        <Plus className="h-5 w-5 text-primary" />
                        <h3 className="font-medium text-foreground">Добавить аккаунт</h3>
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="acc-name">Название (для отображения)</Label>
                          <Input
                            id="acc-name"
                            type="text"
                            placeholder="Мой магазин"
                            value={newAccountName}
                            onChange={(e) => setNewAccountName(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="acc-login">Логин</Label>
                          <Input
                            id="acc-login"
                            type="text"
                            placeholder="admin@company"
                            value={newAccountLogin}
                            onChange={(e) => setNewAccountLogin(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="acc-password">Пароль</Label>
                          <Input
                            id="acc-password"
                            type="password"
                            placeholder="••••••••"
                            value={newAccountPassword}
                            onChange={(e) => setNewAccountPassword(e.target.value)}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={addNewAccount}
                            disabled={isLoading || !newAccountLogin || !newAccountPassword}
                            className="flex-1"
                          >
                            {isLoading ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4 mr-2" />
                            )}
                            Подключить
                          </Button>
                          <Button
                            onClick={() => {
                              setShowAddAccount(false);
                              setNewAccountLogin("");
                              setNewAccountPassword("");
                              setNewAccountName("");
                            }}
                            variant="outline"
                          >
                            Отмена
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <Button
                      onClick={() => setShowAddAccount(true)}
                      variant="outline"
                      className="w-full max-w-md"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Добавить аккаунт МойСклад
                    </Button>
                  )}
                </>
              )}

              {(importView === "catalog" || importView === "counterparties") && currentAccount && (
                <>
                  <div className="mb-4 flex items-center gap-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={backToAccounts}
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Назад к аккаунтам
                    </Button>
                    <div>
                      <h2 className="text-xl font-semibold text-foreground">{currentAccount.name}</h2>
                      <p className="text-sm text-muted-foreground">{currentAccount.login}</p>
                    </div>
                  </div>

                  {/* Sub-tabs: Каталог / Контрагенты */}
                  <div className="flex gap-1 mb-4 border-b">
                    <button
                      onClick={() => setImportView("catalog")}
                      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                        importView === "catalog"
                          ? "border-primary text-primary"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      📦 Каталог
                    </button>
                    <button
                      onClick={() => setImportView("counterparties")}
                      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                        importView === "counterparties"
                          ? "border-primary text-primary"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      👥 Контрагенты
                    </button>
                  </div>

                  {importView === "catalog" && (
                    <>


                  <div className="grid gap-2 mb-3">
                    <div className="rounded-md border border-border bg-card p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">1) Разовая загрузка товаров из МойСклад</p>
                          <p className="text-xs text-muted-foreground">Загружает/обновляет список в этом окне и сохраняет его для следующих входов</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            onClick={() => fetchMoySkladProducts()}
                            disabled={isLoading}
                            variant="outline"
                            size="sm"
                            className="h-8"
                          >
                            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
                            Загрузить товары
                          </Button>
                          <Button
                            onClick={exportMoyskladTableToExcel}
                            disabled={filteredMoyskladProducts.length === 0}
                            variant="outline"
                            size="sm"
                            className="h-8"
                            title="Скачать текущую таблицу в Excel"
                          >
                            <FileSpreadsheet className="h-3.5 w-3.5 mr-1" />
                            Excel
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-md border border-border bg-card p-2.5">
                      <p className="text-sm font-medium mb-2">2) Синхронизация по выбранным полям/столбцам</p>
                      <SyncSettingsPanel
                        settings={syncSettings}
                        onSettingsChange={handleSyncSettingsChange}
                        onSyncNow={handleSyncNow}
                        isSyncing={isSyncing}
                        syncedProductsCount={importedProducts.filter(p => p.autoSync).length}
                        syncOrdersEnabled={supabaseSyncSettings?.sync_orders_enabled}
                        availablePriceTypes={Array.from(new Set(moyskladProducts.flatMap((p) => (p.salePrices || []).map((sp) => sp.name)).filter(Boolean)))}
                        onNavigateToOrderSettings={() => {
                          setActiveSection('orders');
                          setShowOrderNotificationsPanel(true);
                          setSelectedNotificationChannel('moysklad');
                        }}
                      />
                    </div>
                  </div>

                  {isLoading && moyskladProducts.length === 0 ? (
                    <div className="bg-card rounded-lg border border-border p-8 text-center">
                      <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin mb-4" />
                      <p className="text-muted-foreground">Загрузка товаров...</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-2 px-1">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-primary" />
                          <span className="text-xs text-muted-foreground font-medium">
                            {filteredMoyskladProducts.length}
                          </span>
                        </div>
                        <div className="flex items-center gap-0.5">
                          <Button
                            onClick={bulkSyncSelectedProducts}
                            disabled={isSyncing || selectedProducts.size === 0}
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 relative"
                            title={`Синхронизировать (${selectedProducts.size})`}
                          >
                            {isSyncing ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3.5 w-3.5" />
                            )}
                            {selectedProducts.size > 0 && (
                              <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 text-[9px] bg-primary text-primary-foreground rounded-full flex items-center justify-center font-medium">
                                {selectedProducts.size}
                              </span>
                            )}
                          </Button>
                          <Button
                            onClick={bulkDownloadPhotosForSelected}
                            disabled={downloadingImages || selectedProducts.size === 0}
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 relative"
                            title={`Скачать фото (${selectedProducts.size})`}
                          >
                            {downloadingImages ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <ImageIcon className="h-3.5 w-3.5" />
                            )}
                            {selectedProducts.size > 0 && (
                              <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 text-[9px] bg-primary text-primary-foreground rounded-full flex items-center justify-center font-medium">
                                {selectedProducts.size}
                              </span>
                            )}
                          </Button>
                          <Button
                            onClick={importSelectedProducts}
                            disabled={isLoading || selectedProducts.size === 0}
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 relative"
                            title={`Импортировать (${selectedProducts.size})`}
                          >
                            <Download className="h-3.5 w-3.5" />
                            {selectedProducts.size > 0 && (
                              <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 text-[9px] bg-primary text-primary-foreground rounded-full flex items-center justify-center font-medium">
                                {selectedProducts.size}
                              </span>
                            )}
                          </Button>
                        </div>
                      </div>
                      <div className="bg-card rounded-lg border border-border overflow-hidden">
                        <div className="p-3 border-b border-border bg-muted/50 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={selectedProducts.size === filteredMoyskladProducts.length && filteredMoyskladProducts.length > 0}
                              onCheckedChange={selectAllProducts}
                            />
                            <span className="text-sm text-muted-foreground">
                              Выбрано: {selectedProducts.size} из {filteredMoyskladProducts.length}
                            </span>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            Всего в МойСклад: {totalProducts}
                          </span>
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[50px]"></TableHead>
                              <TableHead>Связь</TableHead>
                              <TableHead>
                                Название
                                <ColumnFilter 
                                  value={importFilters.name} 
                                  onChange={(v) => setImportFilters(f => ({...f, name: v}))}
                                  placeholder="Фильтр..."
                                />
                              </TableHead>
                              <TableHead>
                                Артикул
                                <ColumnFilter 
                                  value={importFilters.article} 
                                  onChange={(v) => setImportFilters(f => ({...f, article: v}))}
                                  placeholder="Фильтр..."
                                />
                              </TableHead>
                              <TableHead>
                                Код
                                <ColumnFilter 
                                  value={importFilters.code} 
                                  onChange={(v) => setImportFilters(f => ({...f, code: v}))}
                                  placeholder="Фильтр..."
                                />
                              </TableHead>
                              <TableHead>Розница</TableHead>
                              <TableHead>УТП 1</TableHead>
                              <TableHead>УТП 2</TableHead>
                              <TableHead>Закупочная</TableHead>
                              <TableHead>
                                Остаток
                                <SelectFilter
                                  value={importFilters.stock}
                                  onChange={(v) => setImportFilters(f => ({...f, stock: v}))}
                                  options={[
                                    { value: "inStock", label: "В наличии" },
                                    { value: "outOfStock", label: "Нет в наличии" },
                                  ]}
                                  placeholder="Все"
                                />
                              </TableHead>
                              <TableHead>Ед. изм.</TableHead>
                              <TableHead>Категория товара</TableHead>
                              <TableHead>Фото</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredMoyskladProducts.map((product) => {
                              const linkedProduct = getLinkedProduct(product.id);
                              const isLinked = !!linkedProduct;
                              const isExpanded = expandedProductImages === product.id;
                              const cachedImages = productImagesCache[product.id];
                              const isLoadingImages = loadingProductImages === product.id;
                              
                              return (
                                <React.Fragment key={product.id}>
                                  <TableRow 
                                    className={selectedProducts.has(product.id) ? "bg-primary/5" : ""}
                                  >
                                    <TableCell>
                                      <Checkbox
                                        checked={selectedProducts.has(product.id)}
                                        onCheckedChange={() => toggleProductSelection(product.id)}
                                        disabled={isLinked}
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className={`h-8 w-8 ${
                                          isLinked && linkedProduct?.autoSync 
                                            ? "text-primary" 
                                            : "text-muted-foreground hover:text-primary"
                                        }`}
                                        onClick={() => toggleImportAutoSync(product.id)}
                                        title={
                                          isLinked 
                                            ? (linkedProduct?.autoSync ? "Авто-синхронизация включена" : "Включить авто-синхронизацию")
                                            : "Связать и включить авто-синхронизацию"
                                        }
                                      >
                                        {isLinked && linkedProduct?.autoSync ? (
                                          <Lock className="h-4 w-4" />
                                        ) : (
                                          <Unlock className="h-4 w-4" />
                                        )}
                                      </Button>
                                    </TableCell>
                                    <TableCell className="font-medium">
                                      <div className="flex items-center gap-2">
                                        {product.name}
                                        {isLinked && (
                                          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
                                            Импортирован
                                          </Badge>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                      {product.article || "-"}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                      {product.code || "-"}
                                    </TableCell>
                                    <TableCell className="font-medium">
                                      {(getPriceByType(product, ["Розница", "Розничная", "Цена продажи"]) ?? product.price) > 0
                                        ? formatPrice(getPriceByType(product, ["Розница", "Розничная", "Цена продажи"]) ?? product.price)
                                        : "-"}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                      {(getPriceByType(product, ["УТП1", "УТП-1", "Утп 1"]) ?? 0) > 0
                                        ? formatPrice(getPriceByType(product, ["УТП1", "УТП-1", "Утп 1"]) ?? 0)
                                        : "-"}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                      {(getPriceByType(product, ["УТП2", "УТП-2", "Утп 2"]) ?? 0) > 0
                                        ? formatPrice(getPriceByType(product, ["УТП2", "УТП-2", "Утп 2"]) ?? 0)
                                        : "-"}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                      {product.buyPrice > 0 ? formatPrice(product.buyPrice) : "-"}
                                    </TableCell>
                                    <TableCell>
                                      <Badge
                                        variant={product.quantity > 0 || product.stock > 0 ? "default" : "secondary"}
                                        className={`text-xs ${
                                          product.quantity > 0 || product.stock > 0
                                            ? "bg-primary/15 text-primary"
                                            : "bg-muted text-muted-foreground"
                                        }`}
                                      >
                                        {product.quantity || product.stock || 0}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                      {product.uom || "-"}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground" title={product.productFolderName || undefined}>
                                      {getCategoryLabel(product)}
                                    </TableCell>
                                    <TableCell>
                                      {product.imagesCount > 0 ? (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-7 px-2 gap-1 text-xs"
                                          onClick={() => toggleProductImages(product.id)}
                                        >
                                          <ImageIcon className="h-3 w-3" />
                                          {product.imagesCount}
                                          {isLinked && getNewImagesCount(product.id) > 0 && (
                                            <Badge variant="default" className="ml-1 h-4 px-1 text-[10px] bg-blue-500">
                                              +{getNewImagesCount(product.id)}
                                            </Badge>
                                          )}
                                          {isExpanded ? (
                                            <ChevronUp className="h-3 w-3" />
                                          ) : (
                                            <ChevronDown className="h-3 w-3" />
                                          )}
                                        </Button>
                                      ) : (
                                        <span className="text-muted-foreground text-xs">-</span>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                  
                                  {/* Expanded row with images */}
                                  {isExpanded && (
                                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                                    <TableCell colSpan={10} className="p-4">
                                        {isLoadingImages ? (
                                          <div className="flex items-center justify-center py-4">
                                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                            <span className="ml-2 text-sm text-muted-foreground">Загрузка фотографий...</span>
                                          </div>
                                        ) : cachedImages && cachedImages.length > 0 ? (
                                          <div className="space-y-3">
                                            {/* Action buttons */}
                                            {isLinked && cachedImages.some(img => !img.isSynced) && (
                                              <div className="flex items-center gap-2 pb-2 border-b border-border">
                                                <Button
                                                  variant="outline"
                                                  size="sm"
                                                  onClick={() => selectAllNewImages(product.id)}
                                                  className="text-xs h-7"
                                                >
                                                  Выбрать все новые ({cachedImages.filter(img => !img.isSynced).length})
                                                </Button>
                                                {(selectedImagesForDownload[product.id]?.size || 0) > 0 && (
                                                  <Button
                                                    size="sm"
                                                    onClick={() => downloadSelectedImages(product.id)}
                                                    disabled={downloadingImages}
                                                    className="text-xs h-7"
                                                  >
                                                    {downloadingImages ? (
                                                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                                    ) : (
                                                      <Download className="h-3 w-3 mr-1" />
                                                    )}
                                                    Загрузить выбранные ({selectedImagesForDownload[product.id]?.size || 0})
                                                  </Button>
                                                )}
                                              </div>
                                            )}
                                            
                                            {/* Images grid */}
                                            <div className="flex gap-3 overflow-x-auto pb-2">
                                              {cachedImages.map((img, idx) => {
                                                const isSelected = selectedImagesForDownload[product.id]?.has(idx) || false;
                                                const isSynced = img.isSynced;
                                                
                                                return (
                                                  <div 
                                                    key={idx} 
                                                    className={`relative flex-shrink-0 group ${
                                                      isLinked && !isSynced ? 'cursor-pointer' : ''
                                                    }`}
                                                    onClick={() => {
                                                      if (isLinked && !isSynced) {
                                                        toggleImageSelection(product.id, idx);
                                                      }
                                                    }}
                                                  >
                                                    <img
                                                      src={img.syncedUrl || img.miniature || ''}
                                                      alt={`${product.name} - фото ${idx + 1}`}
                                                      className={`h-24 w-24 object-cover rounded-lg border-2 transition-all ${
                                                        isSynced 
                                                          ? 'border-green-500 opacity-100' 
                                                          : isSelected 
                                                            ? 'border-primary ring-2 ring-primary/30' 
                                                            : 'border-border hover:border-primary/50'
                                                      }`}
                                                    />
                                                    
                                                    {/* Status indicator */}
                                                    {isSynced ? (
                                                      <div className="absolute -top-1 -right-1 bg-green-500 text-white rounded-full p-0.5">
                                                        <Check className="h-3 w-3" />
                                                      </div>
                                                    ) : isLinked ? (
                                                      <div className={`absolute -top-1 -right-1 rounded-full p-0.5 ${
                                                        isSelected ? 'bg-primary text-white' : 'bg-blue-500 text-white'
                                                      }`}>
                                                        {isSelected ? (
                                                          <Check className="h-3 w-3" />
                                                        ) : (
                                                          <span className="text-[10px] px-1 font-medium">NEW</span>
                                                        )}
                                                      </div>
                                                    ) : null}
                                                    
                                                    {/* Checkbox for selection */}
                                                    {isLinked && !isSynced && (
                                                      <div className="absolute bottom-1 left-1">
                                                        <Checkbox
                                                          checked={isSelected}
                                                          onCheckedChange={() => toggleImageSelection(product.id, idx)}
                                                          className="h-4 w-4 bg-white/90"
                                                          onClick={(e) => e.stopPropagation()}
                                                        />
                                                      </div>
                                                    )}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                            
                                            {/* Legend */}
                                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                              <div className="flex items-center gap-1">
                                                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                                <span>Синхронизировано</span>
                                              </div>
                                              <div className="flex items-center gap-1">
                                                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                                                <span>Новое (доступно для загрузки)</span>
                                              </div>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="text-center py-4 text-sm text-muted-foreground">
                                            Не удалось загрузить фотографии
                                          </div>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </>
                  )}
                    </>
                  )}

                  {importView === "counterparties" && (
                    <MoyskladCounterpartiesSection
                      login={currentAccount.login}
                      password={currentAccount.password}
                    />
                  )}

                </>
              )}
                </>
              )}
            </>
          )}

          {effectiveStoreId && activeSection === "catalogs" && (
            <>
              {catalogView === "list" && (
                <>
                  <div className="mb-4">
                    <h2 className="text-xl font-semibold text-foreground">Прайс-листы</h2>
                    <p className="text-sm text-muted-foreground">
                      Создавайте прайс-листы и добавляйте в них товары
                    </p>
                    <p className="text-xs text-muted-foreground mt-2 italic">
                      💡 Одинаковый товар в разных прайс-листах может иметь уникальную цену продажи.
                    </p>
                  </div>

                  {/* Add new catalog form/button - moved above the list */}
                  {showAddCatalog ? (
                    <div className="bg-card rounded-lg border border-border p-6 max-w-md mb-6">
                      <div className="flex items-center gap-2 mb-4">
                        <Plus className="h-5 w-5 text-primary" />
                        <h3 className="font-medium text-foreground">Новый прайс-лист</h3>
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="catalog-name">Название прайс-листа</Label>
                          <Input
                            id="catalog-name"
                            type="text"
                            placeholder="Например: Сыры премиум"
                            value={newCatalogName}
                            onChange={(e) => setNewCatalogName(e.target.value)}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={createCatalog}
                            disabled={!newCatalogName.trim()}
                            className="flex-1"
                          >
                            <Check className="h-4 w-4 mr-2" />
                            Создать
                          </Button>
                          <Button
                            onClick={() => {
                              setShowAddCatalog(false);
                              setNewCatalogName("");
                              setNewCatalogDescription("");
                              setNewCatalogCategories(new Set());
                            }}
                            variant="outline"
                          >
                            Отмена
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <Button
                      onClick={() => setShowAddCatalog(true)}
                      variant="outline"
                      className="w-full max-w-md mb-6"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Создать прайс-лист
                    </Button>
                  )}

                  {/* Catalogs list */}
                  {catalogs.length > 0 ? (
                    <div className="space-y-2 mb-6">
                      {catalogs.map((catalog) => {
                        const catalogProducts = getCatalogProducts(catalog);
                        const isExpanded = expandedCatalogId === catalog.id;
                        
                        return (
                          <div key={catalog.id} className="bg-card rounded-lg border border-border overflow-hidden">
                            {/* Main row */}
                            <div className="flex items-center justify-between px-4 py-3 gap-2">
                              <button
                                onClick={() => openCatalog(catalog)}
                                className="flex items-center gap-3 text-left hover:text-primary transition-colors flex-1 min-w-0"
                              >
                                <FolderOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <Badge variant="outline" className="text-xs flex-shrink-0">
                                  {catalogProducts.length}
                                </Badge>
                                <span className="font-medium text-foreground truncate">{catalog.name}</span>
                              </button>
                              
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {/* Add products button */}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSectionChange("products");
                                  }}
                                  title="Добавить товары из ассортимента"
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                                
                                {/* Copy link button */}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const supabaseCatalog = supabaseCatalogs.find(c => c.id === catalog.id);
                                    if (supabaseCatalog?.access_code) {
                                      const url = `${window.location.origin}/catalog/${supabaseCatalog.access_code}`;
                                      navigator.clipboard.writeText(url);
                                      toast({
                                        title: "Ссылка скопирована",
                                        description: "Отправьте её покупателю для доступа к прайс-листу",
                                      });
                                    }
                                  }}
                                  title="Копировать ссылку"
                                >
                                  <Link2 className="h-4 w-4" />
                                </Button>
                                
                                {/* Settings button */}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={`h-8 w-8 ${catalogSettingsOpen === catalog.id ? 'bg-muted' : ''}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (catalogSettingsOpen === catalog.id) {
                                      setCatalogSettingsOpen(null);
                                      setEditingCatalogListName(null);
                                    } else {
                                      setCatalogSettingsOpen(catalog.id);
                                      setCatalogListNameValue(catalog.name);
                                    }
                                  }}
                                  title="Настройки прайс-листа"
                                >
                                  <Settings className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            
                            {/* Settings panel */}
                            {catalogSettingsOpen === catalog.id && (
                              <div className="border-t border-border px-4 py-3 bg-muted/30">
                                <div className="space-y-3">
                                  {/* Rename */}
                                  <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Название прайс-листа</Label>
                                    {editingCatalogListName === catalog.id ? (
                                      <div className="flex items-center gap-2">
                                        <Input
                                          value={catalogListNameValue}
                                          onChange={(e) => setCatalogListNameValue(e.target.value)}
                                          className="h-8 text-sm"
                                          autoFocus
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter' && catalogListNameValue.trim()) {
                                              updateSupabaseCatalog(catalog.id, { name: catalogListNameValue.trim() });
                                              setEditingCatalogListName(null);
                                            } else if (e.key === 'Escape') {
                                              setEditingCatalogListName(null);
                                              setCatalogListNameValue(catalog.name);
                                            }
                                          }}
                                        />
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 text-green-600"
                                          onClick={() => {
                                            if (catalogListNameValue.trim()) {
                                              updateSupabaseCatalog(catalog.id, { name: catalogListNameValue.trim() });
                                              setEditingCatalogListName(null);
                                            }
                                          }}
                                        >
                                          <Check className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 text-destructive"
                                          onClick={() => {
                                            setEditingCatalogListName(null);
                                            setCatalogListNameValue(catalog.name);
                                          }}
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => setEditingCatalogListName(catalog.id)}
                                        className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-md border border-border hover:bg-muted transition-colors text-sm"
                                      >
                                        <span className="flex-1 truncate">{catalog.name}</span>
                                        <Edit2 className="h-3 w-3 text-muted-foreground" />
                                      </button>
                                    )}
                                  </div>
                                  
                                  {/* Delete */}
                                  <div className="pt-2 border-t border-border">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-destructive hover:text-destructive hover:bg-destructive/10 w-full justify-start"
                                      onClick={() => {
                                        if (window.confirm(`Удалить прайс-лист "${catalog.name}"?`)) {
                                          deleteCatalog(catalog.id);
                                          setCatalogSettingsOpen(null);
                                        }
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Удалить прайс-лист
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : !showAddCatalog ? (
                    <div className="bg-card rounded-lg border border-border p-8 text-center mb-6">
                      <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="font-medium text-foreground mb-2">Нет прайс-листов</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Создайте прайс-лист для группировки товаров
                      </p>
                    </div>
                  ) : null}

                </>
              )}

              {catalogView === "detail" && currentCatalog && (
                <>
                  <div className="mb-4 space-y-2">
                    {/* Название прайс-листа над кнопками */}
                    <div 
                      className="relative max-w-full overflow-hidden"
                      style={{ 
                        maskImage: 'linear-gradient(to right, black 85%, transparent 100%)',
                        WebkitMaskImage: 'linear-gradient(to right, black 85%, transparent 100%)'
                      }}
                    >
                      <span className="text-xs text-muted-foreground whitespace-nowrap block">
                        {currentCatalog.name}
                      </span>
                    </div>
                    
                    {/* Строка с кнопками */}
                    <div className="flex items-center justify-between">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setCatalogView("list");
                          setCurrentCatalog(null);
                          setSelectedCatalogProducts(new Set());
                          setCatalogProductSearch("");
                          setCatalogFilterCategory("");
                          setCatalogFilterStatus("");
                          setCatalogFilterPrice("all");
                        }}
                      >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Назад
                      </Button>
                      <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Добавить товары из ассортимента"
                        onClick={() => handleSectionChange("products")}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Импорт товаров из Excel"
                        onClick={() => setCatalogImportDialogOpen(true)}
                      >
                        <Upload className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Скачать прайс-лист в Excel"
                        onClick={() => setCatalogExportDialogOpen(true)}
                        disabled={selectedCatalogProducts.size === 0}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Скачать прайс-лист в PDF"
                        onClick={() => setCatalogPdfExportDialogOpen(true)}
                        disabled={selectedCatalogProducts.size === 0}
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Скопировать ссылку для покупателя"
                        data-onboarding-link-button
                        onClick={() => {
                          const supabaseCatalog = supabaseCatalogs.find(c => c.id === currentCatalog.id);
                          if (supabaseCatalog?.access_code) {
                            const url = `${window.location.origin}/catalog/${supabaseCatalog.access_code}`;
                            navigator.clipboard.writeText(url);
                            toast({
                              title: "Ссылка скопирована",
                              description: "Отправьте её покупателю для доступа к прайс-листу",
                            });
                          }
                        }}
                      >
                        <Link2 className="h-4 w-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Настройка столбцов">
                            <Settings className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          {Object.entries(catalogColumnLabels).map(([id, label]) => (
                            <DropdownMenuCheckboxItem
                              key={id}
                              checked={catalogVisibleColumns[id]}
                              onCheckedChange={() => toggleCatalogColumnVisibility(id)}
                              className="text-xs"
                            >
                              {label}
                            </DropdownMenuCheckboxItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center mb-4">
                    <Badge variant="outline">
                      Выбрано: {selectedCatalogProducts.size} из {allProducts.length}
                    </Badge>
                  </div>

                  {/* Onboarding Step 4: Set cost price - show only when no buyPrice set yet for products in this catalog */}
                  {(() => {
                    const catalogProductIds = allProducts.filter(p => selectedCatalogProducts.has(p.id)).map(p => p.id);
                    const hasBuyPrice = catalogProductIds.some(id => {
                      const product = allProducts.find(p => p.id === id);
                      return product?.buyPrice && product.buyPrice > 0;
                    });
                    return supabaseProducts.length > 0 && catalogs.length > 0 && 
                      Object.values(productCatalogVisibility).some(cats => cats.size > 0) && 
                      !hasBuyPrice;
                  })() && (
                    <div 
                      className="bg-primary/10 border border-primary/30 rounded-lg p-3 mb-3 cursor-pointer hover:bg-primary/15 transition-colors"
                      onClick={() => {
                        // Find and scroll to the buyPrice column header
                        const buyPriceHeader = document.querySelector('[data-column-id="buyPrice"]');
                        if (buyPriceHeader) {
                          buyPriceHeader.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                          // Highlight the column briefly
                          buyPriceHeader.classList.add('animate-pulse', 'bg-primary/20', 'ring-2', 'ring-primary');
                          setTimeout(() => {
                            buyPriceHeader.classList.remove('animate-pulse', 'bg-primary/20', 'ring-2', 'ring-primary');
                          }, 3000);
                        }
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                          <span className="text-primary font-bold text-sm">4</span>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">Установите себестоимость товара</p>
                          <p className="text-xs text-muted-foreground">Нажмите здесь, чтобы перейти к столбику "Себестоимость"</p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-primary" />
                      </div>
                    </div>
                  )}

                  {/* Onboarding Step 5: Set markup - show only when buyPrice set but no markup set yet */}
                  {(() => {
                    const catalogProductIds = allProducts.filter(p => selectedCatalogProducts.has(p.id)).map(p => p.id);
                    const hasBuyPrice = catalogProductIds.some(id => {
                      const product = allProducts.find(p => p.id === id);
                      return product?.buyPrice && product.buyPrice > 0;
                    });
                    const hasMarkup = currentCatalog && catalogProductIds.some(id => {
                      const setting = catalogProductSettings.find(s => s.catalog_id === currentCatalog.id && s.product_id === id);
                      return setting?.markup_value && setting.markup_value > 0;
                    });
                    return supabaseProducts.length > 0 && catalogs.length > 0 && 
                      Object.values(productCatalogVisibility).some(cats => cats.size > 0) && 
                      hasBuyPrice && !hasMarkup;
                  })() && (
                    <div 
                      className="bg-primary/10 border border-primary/30 rounded-lg p-3 mb-3 cursor-pointer hover:bg-primary/15 transition-colors"
                      onClick={() => {
                        // Find and scroll to the markup column header
                        const markupHeader = document.querySelector('[data-column-id="markup"]');
                        if (markupHeader) {
                          markupHeader.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                          // Highlight the column briefly
                          markupHeader.classList.add('animate-pulse', 'bg-primary/20', 'ring-2', 'ring-primary');
                          setTimeout(() => {
                            markupHeader.classList.remove('animate-pulse', 'bg-primary/20', 'ring-2', 'ring-primary');
                          }, 3000);
                        }
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                          <span className="text-primary font-bold text-sm">5</span>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">Установите наценку для этого прайс-листа</p>
                          <p className="text-xs text-muted-foreground">
                            Наценка определяет цену продажи для данного типа покупателей.
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Пример: себестоимость 1000₽ + наценка 30% = цена 1300₽
                          </p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-primary" />
                      </div>
                    </div>
                  )}

                  {/* Onboarding Step 6: Set portion prices - show only when markup set but no portion prices set yet */}
                  {(() => {
                    const catalogProductIds = allProducts.filter(p => selectedCatalogProducts.has(p.id)).map(p => p.id);
                    const hasBuyPrice = catalogProductIds.some(id => {
                      const product = allProducts.find(p => p.id === id);
                      return product?.buyPrice && product.buyPrice > 0;
                    });
                    const hasMarkup = currentCatalog && catalogProductIds.some(id => {
                      const setting = catalogProductSettings.find(s => s.catalog_id === currentCatalog.id && s.product_id === id);
                      return setting?.markup_value && setting.markup_value > 0;
                    });
                    
                    // Check volume (unitWeight) for any product in catalog
                    const hasVolume = catalogProductIds.some(id => {
                      const product = allProducts.find(p => p.id === id);
                      return product?.unitWeight && product.unitWeight > 0;
                    });
                    
                    // Check half price
                    const hasHalfPrice = currentCatalog && catalogProductIds.some(id => {
                      const setting = catalogProductSettings.find(s => s.catalog_id === currentCatalog.id && s.product_id === id);
                      const portionPrices = setting?.portion_prices as { halfPricePerKg?: number; quarterPricePerKg?: number } | null;
                      return portionPrices?.halfPricePerKg && portionPrices.halfPricePerKg > 0;
                    });
                    
                    // Check quarter price
                    const hasQuarterPrice = currentCatalog && catalogProductIds.some(id => {
                      const setting = catalogProductSettings.find(s => s.catalog_id === currentCatalog.id && s.product_id === id);
                      const portionPrices = setting?.portion_prices as { halfPricePerKg?: number; quarterPricePerKg?: number } | null;
                      return portionPrices?.quarterPricePerKg && portionPrices.quarterPricePerKg > 0;
                    });
                    
                    // Determine current sub-step based on data
                    const currentSubStep = !hasVolume ? "volume" : !hasHalfPrice ? "half" : !hasQuarterPrice ? "quarter" : "done";
                    
                    // Show step 6 only when markup is set and not all portion prices are set
                    const shouldShowStep6 = supabaseProducts.length > 0 && catalogs.length > 0 && 
                      Object.values(productCatalogVisibility).some(cats => cats.size > 0) && 
                      hasBuyPrice && hasMarkup && currentSubStep !== "done";
                    
                    if (!shouldShowStep6) return null;
                    
                    const subStepConfig = {
                      volume: {
                        title: "Шаг 6.1: Установите объём товара",
                        description: "Укажите вес или объём единицы товара (например, 10 кг для головки сыра). Это нужно для расчёта цен на половинки и четвертинки.",
                        columnId: "volume",
                      },
                      half: {
                        title: "Шаг 6.2: Установите цену за ½ (половинку)",
                        description: "Укажите цену за 1 кг при покупке половинки. Например, если целая головка стоит 2000₽/кг, за половинку можно установить 2200₽/кг.",
                        columnId: "priceHalf",
                      },
                      quarter: {
                        title: "Шаг 6.3: Установите цену за ¼ (четвертинку)",
                        description: "Укажите цену за 1 кг при покупке четвертинки. Например, 2500₽/кг. Система автоматически умножит на вес.",
                        columnId: "priceQuarter",
                      },
                    };
                    
                    const config = subStepConfig[currentSubStep as keyof typeof subStepConfig];
                    
                    return (
                      <div 
                        className="bg-primary/10 border border-primary/30 rounded-lg p-3 mb-3 cursor-pointer hover:bg-primary/15 transition-colors"
                        onClick={() => {
                          const header = document.querySelector(`[data-column-id="${config.columnId}"]`);
                          if (header) {
                            header.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                            header.classList.add('animate-pulse', 'bg-primary/20', 'ring-2', 'ring-primary');
                            setTimeout(() => {
                              header.classList.remove('animate-pulse', 'bg-primary/20', 'ring-2', 'ring-primary');
                            }, 3000);
                          }
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                            <span className="text-primary font-bold text-sm">6</span>
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">{config.title}</p>
                            <p className="text-xs text-muted-foreground">{config.description}</p>
                            <div className="flex gap-1 mt-2">
                              <div className={`h-1.5 w-8 rounded-full ${hasVolume ? 'bg-primary' : 'bg-muted'}`} />
                              <div className={`h-1.5 w-8 rounded-full ${hasHalfPrice ? 'bg-primary' : 'bg-muted'}`} />
                              <div className={`h-1.5 w-8 rounded-full ${hasQuarterPrice ? 'bg-primary' : 'bg-muted'}`} />
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 text-primary" />
                        </div>
                      </div>
                    );
                  })()}


                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <Input
                      type="text"
                      placeholder="Поиск товаров..."
                      value={catalogProductSearch}
                      onChange={(e) => setCatalogProductSearch(e.target.value)}
                      className="max-w-[200px] h-9"
                    />
                    <Select value={catalogFilterCategory} onValueChange={setCatalogFilterCategory}>
                      <SelectTrigger className="w-[160px] h-9">
                        <SelectValue placeholder="Категория" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Все категории</SelectItem>
                        {categories
                          .filter(c => !c.parent_id)
                          .map(parent => (
                            <React.Fragment key={parent.id}>
                              <SelectItem value={parent.id} className="font-semibold">{parent.name}</SelectItem>
                              {categories
                                .filter(c => c.parent_id === parent.id)
                                .map(sub => (
                                  <SelectItem key={sub.id} value={sub.id} className="pl-6">{sub.name}</SelectItem>
                                ))}
                            </React.Fragment>
                          ))}
                        {categories.filter(c => c.parent_id && !categories.some(p => p.id === c.parent_id)).map(orphan => (
                          <SelectItem key={orphan.id} value={orphan.id}>{orphan.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={catalogFilterStatus} onValueChange={setCatalogFilterStatus}>
                      <SelectTrigger className="w-[150px] h-9">
                        <SelectValue placeholder="Статус" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Все статусы</SelectItem>
                        <SelectItem value="in_stock">В наличии</SelectItem>
                        <SelectItem value="pre_order">Предзаказ</SelectItem>
                        <SelectItem value="out_of_stock">Нет в наличии</SelectItem>
                        <SelectItem value="hidden">Скрыт</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={catalogFilterPrice} onValueChange={setCatalogFilterPrice}>
                      <SelectTrigger className="w-[130px] h-9">
                        <SelectValue placeholder="Цена" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Все цены</SelectItem>
                        <SelectItem value="with_price">С ценой</SelectItem>
                        <SelectItem value="no_price">Без цены</SelectItem>
                      </SelectContent>
                    </Select>
                    {(catalogFilterCategory && catalogFilterCategory !== "all" || catalogFilterStatus && catalogFilterStatus !== "all" || catalogFilterPrice !== "all") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 px-2 text-muted-foreground"
                        onClick={() => {
                          setCatalogFilterCategory("");
                          setCatalogFilterStatus("");
                          setCatalogFilterPrice("all");
                        }}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Сбросить
                      </Button>
                    )}
                  </div>

                  {/* Bulk Edit Panel for catalog products */}
                  <BulkEditPanel
                    selectedCount={selectedCatalogBulkProducts.size}
                    onClearSelection={() => setSelectedCatalogBulkProducts(new Set())}
                    onBulkUpdate={(updates) => {
                      const count = selectedCatalogBulkProducts.size;
                      if (currentCatalog && updates.status) {
                        // Batch status update to avoid race conditions
                        bulkUpdateCatalogStatus(currentCatalog.id, Array.from(selectedCatalogBulkProducts), updates.status);
                      }
                      // Other updates (unit, packaging, description, markup) go to base product
                      const baseUpdates = { ...updates };
                      delete baseUpdates.status;
                      if (Object.keys(baseUpdates).length > 0) {
                        selectedCatalogBulkProducts.forEach(productId => {
                          const product = allProducts.find(p => p.id === productId);
                          if (product) {
                            updateProduct({ ...product, ...baseUpdates });
                          }
                        });
                      }
                      if (currentCatalog && updates.markup) {
                        selectedCatalogBulkProducts.forEach(productId => {
                          updateCatalogProductPricing(currentCatalog.id, productId, { markup: updates.markup });
                        });
                      }
                      setSelectedCatalogBulkProducts(new Set());
                      toast({
                        title: "Товары обновлены",
                        description: `Обновлено ${count} товаров`,
                      });
                    }}
                    onRemoveFromCatalog={() => {
                      if (currentCatalog) {
                        const productIds = Array.from(selectedCatalogBulkProducts);
                        removeSupabaseProductsFromCatalog(productIds, currentCatalog.id);
                        // Update local state
                        setSelectedCatalogProducts(prev => {
                          const newSet = new Set(prev);
                          productIds.forEach(id => newSet.delete(id));
                          return newSet;
                        });
                        setSelectedCatalogBulkProducts(new Set());
                      }
                    }}
                    currentCatalogName={currentCatalog?.name}
                    unitOptions={allUnitOptions}
                    packagingOptions={allPackagingOptions}
                    showDelete={false}
                    categories={categories}
                    onBulkSetCategories={(categoryIds) => {
                      if (currentCatalog) {
                        const count = selectedCatalogBulkProducts.size;
                        selectedCatalogBulkProducts.forEach(productId => {
                          updateCatalogProductPricing(currentCatalog.id, productId, { categories: categoryIds });
                        });
                        setSelectedCatalogBulkProducts(new Set());
                        toast({
                          title: "Категории обновлены",
                          description: `Категории установлены для ${count} товаров`,
                        });
                      }
                    }}
                    onBulkClearCategories={() => {
                      if (currentCatalog) {
                        const count = selectedCatalogBulkProducts.size;
                        selectedCatalogBulkProducts.forEach(productId => {
                          updateCatalogProductPricing(currentCatalog.id, productId, { categories: [] });
                        });
                        setSelectedCatalogBulkProducts(new Set());
                        toast({
                          title: "Категории сняты",
                          description: `Категории очищены у ${count} товаров`,
                        });
                      }
                    }}
                    onBulkAutoFillCategories={async (mode) => {
                      if (!currentCatalog) return;
                      const selectedIds = Array.from(selectedCatalogBulkProducts);
                      let filled = 0;
                      let skipped = 0;
                      const allCopiedCategoryIds = new Set<string>();
                      let sourceCatalogId: string | null = null;

                      selectedIds.forEach(productId => {
                        const currentSetting = catalogProductSettings.find(
                          s => s.catalog_id === currentCatalog.id && s.product_id === productId
                        );
                        const hasExisting = currentSetting?.categories && currentSetting.categories.length > 0;

                        if (mode === "fill_empty" && hasExisting) {
                          skipped++;
                          return;
                        }

                        const otherSetting = catalogProductSettings.find(
                          s => s.product_id === productId && s.catalog_id !== currentCatalog.id && s.categories && s.categories.length > 0
                        );

                        if (otherSetting) {
                          updateCatalogProductPricing(currentCatalog.id, productId, { categories: otherSetting.categories });
                          filled++;
                          otherSetting.categories.forEach(cid => allCopiedCategoryIds.add(cid));
                          if (!sourceCatalogId) sourceCatalogId = otherSetting.catalog_id;
                        } else {
                          skipped++;
                        }
                      });

                      // Copy category hierarchy (sections) from source catalog
                      if (sourceCatalogId && allCopiedCategoryIds.size > 0) {
                        try {
                          // Fetch all category settings from source catalog
                          const { data: sourceSettings } = await supabase
                            .from('catalog_category_settings')
                            .select('*')
                            .eq('catalog_id', sourceCatalogId);

                          if (sourceSettings && sourceSettings.length > 0) {
                            // Collect parent category IDs too
                            const parentIds = new Set<string>();
                            sourceSettings.forEach(s => {
                              if (allCopiedCategoryIds.has(s.category_id) && s.parent_category_id) {
                                parentIds.add(s.parent_category_id);
                              }
                            });

                            // Settings to copy: copied categories + their parent sections
                            const relevantIds = new Set([...allCopiedCategoryIds, ...parentIds]);
                            const settingsToCopy = sourceSettings.filter(s => relevantIds.has(s.category_id));

                            if (settingsToCopy.length > 0) {
                              const upsertData = settingsToCopy.map(s => ({
                                catalog_id: currentCatalog.id,
                                category_id: s.category_id,
                                parent_category_id: s.parent_category_id,
                                sort_order: s.sort_order,
                                custom_name: s.custom_name,
                              }));

                              await supabase
                                .from('catalog_category_settings')
                                .upsert(upsertData, { onConflict: 'catalog_id,category_id' });
                            }
                          }
                        } catch (err) {
                          console.error('Error copying category hierarchy:', err);
                        }
                      }

                      setSelectedCatalogBulkProducts(new Set());
                      toast({
                        title: "Категории подставлены",
                        description: `Заполнено: ${filled}, пропущено: ${skipped}`,
                      });
                    }}
                    onBulkSetPrice={(price) => {
                      if (currentCatalog) {
                        const count = selectedCatalogBulkProducts.size;
                        selectedCatalogBulkProducts.forEach(productId => {
                          updateCatalogProductSettingsInDB(currentCatalog.id, productId, { 
                            fixed_price: price, 
                            is_fixed_price: true 
                          });
                        });
                        setSelectedCatalogBulkProducts(new Set());
                        toast({
                          title: "Цены обновлены",
                          description: `Фиксированная цена ${price.toLocaleString()} ₽ установлена для ${count} товаров`,
                        });
                      }
                    }}
                    onBulkBestPhoto={async () => {
                      const selectedIds = Array.from(selectedCatalogBulkProducts);
                      const productsWithMultipleImages = selectedIds
                        .map(id => allProducts.find(p => p.id === id))
                        .filter((p): p is Product => !!p && !!p.images && p.images.length >= 2);

                      if (productsWithMultipleImages.length === 0) {
                        toast({ title: "Нет товаров с несколькими фото", description: "Выбранные товары имеют только одно фото или без фото" });
                        return;
                      }

                      const getImageDimensions = (url: string): Promise<{ width: number; height: number }> => {
                        return new Promise((resolve) => {
                          const img = new window.Image();
                          img.crossOrigin = "anonymous";
                          const timeout = setTimeout(() => resolve({ width: 0, height: 0 }), 10000);
                          img.onload = () => { clearTimeout(timeout); resolve({ width: img.naturalWidth, height: img.naturalHeight }); };
                          img.onerror = () => { clearTimeout(timeout); resolve({ width: 0, height: 0 }); };
                          img.src = url;
                        });
                      };

                      let updated = 0;
                      for (const product of productsWithMultipleImages) {
                        try {
                          const dims = await Promise.all(product.images!.map(url => getImageDimensions(url)));
                          const areas = dims.map(d => d.width * d.height);
                          const bestIndex = areas.indexOf(Math.max(...areas));
                          if (bestIndex > 0 && areas[bestIndex] > 0) {
                            const newImages = [...product.images!];
                            const [bestPhoto] = newImages.splice(bestIndex, 1);
                            newImages.unshift(bestPhoto);

                            let newSyncedImages = product.syncedMoyskladImages;
                            if (product.syncedMoyskladImages && product.syncedMoyskladImages.length === product.images!.length) {
                              newSyncedImages = [...product.syncedMoyskladImages];
                              const [s] = newSyncedImages.splice(bestIndex, 1);
                              newSyncedImages.unshift(s);
                            }

                            await updateSupabaseProduct(product.id, { images: newImages, synced_moysklad_images: newSyncedImages });
                            updated++;
                          }
                        } catch (err) {
                          console.error(`Error processing product ${product.id}:`, err);
                        }
                      }

                      toast({
                        title: "Лучшее фото установлено",
                        description: `Обновлено: ${updated} из ${productsWithMultipleImages.length} товаров`,
                      });
                    }}
                    onAddToAvitoFeed={async () => {
                      if (!currentCatalog) return false;
                      const selectedIds = Array.from(selectedCatalogBulkProducts);
                      const priceMap: Record<string, number> = {};
                      selectedIds.forEach(productId => {
                        const product = allProducts.find(p => p.id === productId);
                        if (product) {
                          const cp = getCatalogProductPricing(currentCatalog.id, productId);
                          const price = getCatalogSalePrice(product, cp);
                          if (price > 0) priceMap[productId] = price;
                        }
                      });
                      const ok = await avitoFeed.addProductsToFeed(selectedIds, priceMap);
                      if (ok) setSelectedCatalogBulkProducts(new Set());
                      return ok;
                    }}
                  />

                  <p className="text-xs text-muted-foreground mb-2">
                    * Фото, название, описание, ед. изм., объём и вид синхронизируются из ассортимента. Категории, наценка и цены порций — индивидуальны для каждого прайс-листа. Статус синхронизируется с витриной.
                  </p>
                  {catalogSortColumn && (
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary" className="text-xs">
                        Сортировка: {catalogSortColumn === "name" ? "Название" : catalogSortColumn === "categories" ? "Категория" : catalogSortColumn === "buyPrice" ? "Себестоимость" : catalogSortColumn === "price" ? "Цена" : catalogSortColumn === "status" ? "Статус" : catalogSortColumn === "unit" ? "Ед. изм." : "Вид"} {catalogSortDirection === "asc" ? "А→Я" : "Я→А"}
                      </Badge>
                      <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { setCatalogSortColumn(null); setCatalogSortDirection("asc"); }}>
                        <X className="h-3 w-3 mr-1" />Сбросить сортировку
                      </Button>
                    </div>
                  )}
                  <DraggableTableWrapper
                    items={(() => {
                      return allProducts
                        .filter(p => selectedCatalogProducts.has(p.id))
                        .filter(p => !catalogProductSearch || p.name.toLowerCase().includes(catalogProductSearch.toLowerCase()))
                        .filter(p => {
                          if (catalogFilterCategory && catalogFilterCategory !== "all") {
                            const cp = currentCatalog ? getCatalogProductPricing(currentCatalog.id, p.id) : undefined;
                            const cats = cp?.categories ?? p.categories;
                            if (!cats || !cats.includes(catalogFilterCategory)) return false;
                          }
                          if (catalogFilterStatus && catalogFilterStatus !== "all") {
                            const cp = currentCatalog ? getCatalogProductPricing(currentCatalog.id, p.id) : undefined;
                            const st = getCatalogProductStatus(p, cp);
                            if (st !== catalogFilterStatus) return false;
                          }
                          if (catalogFilterPrice !== "all") {
                            const cp = currentCatalog ? getCatalogProductPricing(currentCatalog.id, p.id) : undefined;
                            const price = getCatalogSalePrice(p, cp);
                            if (catalogFilterPrice === "with_price" && (!price || price <= 0)) return false;
                            if (catalogFilterPrice === "no_price" && price > 0) return false;
                          }
                          return true;
                        })
                        .sort((a, b) => {
                          if (!catalogSortColumn) {
                            const aSettings = currentCatalog ? getCatalogProductSettingsFromDB(currentCatalog.id, a.id) : undefined;
                            const bSettings = currentCatalog ? getCatalogProductSettingsFromDB(currentCatalog.id, b.id) : undefined;
                            return (aSettings?.sort_order ?? 999999) - (bSettings?.sort_order ?? 999999);
                          }
                          return 0;
                        })
                        .map(p => p.id);
                    })()}
                    onReorder={(newOrder) => {
                      if (currentCatalog && !catalogSortColumn) {
                        updateCatalogProductSortOrders(currentCatalog.id, newOrder);
                      }
                    }}
                  >
                  <div className="bg-card rounded-lg border border-border overflow-x-auto">
                    <ResizableTable
                      storageKey="catalog-products-table"
                      columns={[
                        { id: "dragHandle", minWidth: 32, defaultWidth: 32 },
                        ...(catalogVisibleColumns.bulkCheckbox ? [{ id: "bulkCheckbox", minWidth: 40, defaultWidth: 40 }] : []),
                        ...(catalogVisibleColumns.photo ? [{ id: "photo", minWidth: 50, defaultWidth: 60 }] : []),
                        ...(catalogVisibleColumns.name ? [{ id: "name", minWidth: 120, defaultWidth: 180 }] : []),
                        ...(catalogVisibleColumns.description ? [{ id: "description", minWidth: 100, defaultWidth: 200 }] : []),
                        ...(catalogVisibleColumns.categories ? [{ id: "categories", minWidth: 100, defaultWidth: 140 }] : []),
                        ...(catalogVisibleColumns.subcategory ? [{ id: "subcategory", minWidth: 100, defaultWidth: 140 }] : []),
                        ...(catalogVisibleColumns.unit ? [{ id: "unit", minWidth: 60, defaultWidth: 80 }] : []),
                        ...(catalogVisibleColumns.volume ? [{ id: "volume", minWidth: 60, defaultWidth: 80 }] : []),
                        ...(catalogVisibleColumns.type ? [{ id: "type", minWidth: 80, defaultWidth: 100 }] : []),
                        ...(catalogVisibleColumns.buyPrice ? [{ id: "buyPrice", minWidth: 70, defaultWidth: 90 }] : []),
                        ...(catalogVisibleColumns.markup ? [{ id: "markup", minWidth: 110, defaultWidth: 120 }] : []),
                        ...(catalogVisibleColumns.price ? [{ id: "price", minWidth: 80, defaultWidth: 100 }] : []),
                        ...(catalogVisibleColumns.priceFull ? [{ id: "priceFull", minWidth: 70, defaultWidth: 90 }] : []),
                        ...(catalogVisibleColumns.priceHalf ? [{ id: "priceHalf", minWidth: 70, defaultWidth: 90 }] : []),
                        ...(catalogVisibleColumns.priceQuarter ? [{ id: "priceQuarter", minWidth: 70, defaultWidth: 90 }] : []),
                        ...(catalogVisibleColumns.pricePortion ? [{ id: "pricePortion", minWidth: 70, defaultWidth: 90 }] : []),
                        ...(catalogVisibleColumns.status ? [{ id: "status", minWidth: 80, defaultWidth: 100 }] : []),
                      ]}
                    >
                      <ResizableTableHeader>
                         <ResizableTableRow>
                          <ResizableTableHead columnId="dragHandle" resizable={false}>
                            <span className="sr-only">⠿</span>
                          </ResizableTableHead>
                          {catalogVisibleColumns.bulkCheckbox && (
                            <ResizableTableHead columnId="bulkCheckbox">
                              <Checkbox
                                checked={(() => {
                                  const catalogProducts = allProducts.filter(p => selectedCatalogProducts.has(p.id));
                                  return catalogProducts.length > 0 && catalogProducts.every(p => selectedCatalogBulkProducts.has(p.id));
                                })()}
                                onCheckedChange={() => {
                                  const catalogProductIds = allProducts.filter(p => selectedCatalogProducts.has(p.id)).map(p => p.id);
                                  const allSelected = catalogProductIds.every(id => selectedCatalogBulkProducts.has(id));
                                  if (allSelected) {
                                    setSelectedCatalogBulkProducts(new Set());
                                  } else {
                                    setSelectedCatalogBulkProducts(new Set(catalogProductIds));
                                  }
                                }}
                              />
                            </ResizableTableHead>
                          )}
                          {catalogVisibleColumns.photo && <ResizableTableHead columnId="photo">Фото</ResizableTableHead>}
                          {catalogVisibleColumns.name && (
                            <ResizableTableHead columnId="name">
                              <button className="flex items-center gap-1 hover:text-foreground" onClick={() => { setCatalogSortColumn(catalogSortColumn === "name" ? "name" : "name"); setCatalogSortDirection(catalogSortColumn === "name" && catalogSortDirection === "asc" ? "desc" : "asc"); }}>
                                Название {catalogSortColumn === "name" && (catalogSortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                              </button>
                            </ResizableTableHead>
                          )}
                          {catalogVisibleColumns.description && <ResizableTableHead columnId="description">Описание</ResizableTableHead>}
                          {catalogVisibleColumns.categories && (
                            <ResizableTableHead columnId="categories">
                              <button className="flex items-center gap-1 hover:text-foreground" onClick={() => { setCatalogSortColumn("categories"); setCatalogSortDirection(catalogSortColumn === "categories" && catalogSortDirection === "asc" ? "desc" : "asc"); }}>
                                Главная категория {catalogSortColumn === "categories" && (catalogSortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                              </button>
                            </ResizableTableHead>
                          )}
                          {catalogVisibleColumns.subcategory && <ResizableTableHead columnId="subcategory">Подкатегория</ResizableTableHead>}
                          {catalogVisibleColumns.unit && (
                            <ResizableTableHead columnId="unit">
                              <button className="flex items-center gap-1 hover:text-foreground" onClick={() => { setCatalogSortColumn("unit"); setCatalogSortDirection(catalogSortColumn === "unit" && catalogSortDirection === "asc" ? "desc" : "asc"); }}>
                                Ед. изм. {catalogSortColumn === "unit" && (catalogSortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                              </button>
                            </ResizableTableHead>
                          )}
                          {catalogVisibleColumns.volume && <ResizableTableHead columnId="volume">Объем</ResizableTableHead>}
                          {catalogVisibleColumns.type && (
                            <ResizableTableHead columnId="type">
                              <button className="flex items-center gap-1 hover:text-foreground" onClick={() => { setCatalogSortColumn("type"); setCatalogSortDirection(catalogSortColumn === "type" && catalogSortDirection === "asc" ? "desc" : "asc"); }}>
                                Вид {catalogSortColumn === "type" && (catalogSortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                              </button>
                            </ResizableTableHead>
                          )}
                          {catalogVisibleColumns.buyPrice && (
                            <ResizableTableHead columnId="buyPrice">
                              <button className="flex items-center gap-1 hover:text-foreground" onClick={() => { setCatalogSortColumn("buyPrice"); setCatalogSortDirection(catalogSortColumn === "buyPrice" && catalogSortDirection === "asc" ? "desc" : "asc"); }}>
                                Себест-ть {catalogSortColumn === "buyPrice" && (catalogSortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                              </button>
                            </ResizableTableHead>
                          )}
                          {catalogVisibleColumns.markup && <ResizableTableHead columnId="markup">Наценка</ResizableTableHead>}
                          {catalogVisibleColumns.price && (
                            <ResizableTableHead columnId="price">
                              <button className="flex items-center gap-1 hover:text-foreground" onClick={() => { setCatalogSortColumn("price"); setCatalogSortDirection(catalogSortColumn === "price" && catalogSortDirection === "asc" ? "desc" : "asc"); }}>
                                Цена {catalogSortColumn === "price" && (catalogSortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                              </button>
                            </ResizableTableHead>
                          )}
                          {catalogVisibleColumns.priceFull && <ResizableTableHead columnId="priceFull">Целая</ResizableTableHead>}
                          {catalogVisibleColumns.priceHalf && <ResizableTableHead columnId="priceHalf">½</ResizableTableHead>}
                          {catalogVisibleColumns.priceQuarter && <ResizableTableHead columnId="priceQuarter">¼</ResizableTableHead>}
                          {catalogVisibleColumns.pricePortion && <ResizableTableHead columnId="pricePortion">Порция</ResizableTableHead>}
                          {catalogVisibleColumns.status && (
                            <ResizableTableHead columnId="status">
                              <button className="flex items-center gap-1 hover:text-foreground" onClick={() => { setCatalogSortColumn("status"); setCatalogSortDirection(catalogSortColumn === "status" && catalogSortDirection === "asc" ? "desc" : "asc"); }}>
                                Статус {catalogSortColumn === "status" && (catalogSortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                              </button>
                            </ResizableTableHead>
                          )}
                        </ResizableTableRow>
                      </ResizableTableHeader>
                      <ResizableTableBody>
                        {allProducts
                          .filter(p => selectedCatalogProducts.has(p.id))
                          .filter(p => !catalogProductSearch || p.name.toLowerCase().includes(catalogProductSearch.toLowerCase()))
                          .filter(p => {
                            if (catalogFilterCategory && catalogFilterCategory !== "all") {
                              const cp = currentCatalog ? getCatalogProductPricing(currentCatalog.id, p.id) : undefined;
                              const cats = cp?.categories ?? p.categories;
                              if (!cats || !cats.includes(catalogFilterCategory)) return false;
                            }
                            if (catalogFilterStatus && catalogFilterStatus !== "all") {
                              const cp = currentCatalog ? getCatalogProductPricing(currentCatalog.id, p.id) : undefined;
                              const st = getCatalogProductStatus(p, cp);
                              if (st !== catalogFilterStatus) return false;
                            }
                            if (catalogFilterPrice !== "all") {
                              const cp = currentCatalog ? getCatalogProductPricing(currentCatalog.id, p.id) : undefined;
                              const price = getCatalogSalePrice(p, cp);
                              if (catalogFilterPrice === "with_price" && (!price || price <= 0)) return false;
                              if (catalogFilterPrice === "no_price" && price > 0) return false;
                            }
                            return true;
                          })
                          .sort((a, b) => {
                            // If no column sort is active, sort by catalog sort_order
                            if (!catalogSortColumn) {
                              const aSettings = currentCatalog ? getCatalogProductSettingsFromDB(currentCatalog.id, a.id) : undefined;
                              const bSettings = currentCatalog ? getCatalogProductSettingsFromDB(currentCatalog.id, b.id) : undefined;
                              const aOrder = aSettings?.sort_order ?? 999999;
                              const bOrder = bSettings?.sort_order ?? 999999;
                              return aOrder - bOrder;
                            }
                            const dir = catalogSortDirection === "asc" ? 1 : -1;
                            if (catalogSortColumn === "name") return a.name.localeCompare(b.name, 'ru') * dir;
                            if (catalogSortColumn === "categories") {
                              const aCp = currentCatalog ? getCatalogProductPricing(currentCatalog.id, a.id) : undefined;
                              const bCp = currentCatalog ? getCatalogProductPricing(currentCatalog.id, b.id) : undefined;
                              const aCats = aCp?.categories ?? a.categories ?? [];
                              const bCats = bCp?.categories ?? b.categories ?? [];
                              const aCatName = aCats.length > 0 ? (storeCategories.find(c => c.id === aCats[0])?.name || "") : "";
                              const bCatName = bCats.length > 0 ? (storeCategories.find(c => c.id === bCats[0])?.name || "") : "";
                              return aCatName.localeCompare(bCatName, 'ru') * dir;
                            }
                            if (catalogSortColumn === "buyPrice") return ((a.buyPrice || 0) - (b.buyPrice || 0)) * dir;
                            if (catalogSortColumn === "price") {
                              const aCp = currentCatalog ? getCatalogProductPricing(currentCatalog.id, a.id) : undefined;
                              const bCp = currentCatalog ? getCatalogProductPricing(currentCatalog.id, b.id) : undefined;
                              return (getCatalogSalePrice(a, aCp) - getCatalogSalePrice(b, bCp)) * dir;
                            }
                            if (catalogSortColumn === "unit") return (a.unit || "").localeCompare(b.unit || "", 'ru') * dir;
                            if (catalogSortColumn === "type") return (a.packagingType || "").localeCompare(b.packagingType || "", 'ru') * dir;
                            if (catalogSortColumn === "status") {
                              const aCp = currentCatalog ? getCatalogProductPricing(currentCatalog.id, a.id) : undefined;
                              const bCp = currentCatalog ? getCatalogProductPricing(currentCatalog.id, b.id) : undefined;
                              return getCatalogProductStatus(a, aCp).localeCompare(getCatalogProductStatus(b, bCp), 'ru') * dir;
                            }
                            return 0;
                          })
                          .map((product) => {
                            // Get catalog-specific pricing/data
                            const catalogPricing = currentCatalog ? getCatalogProductPricing(currentCatalog.id, product.id) : undefined;
                            
                            // Base product info (synced from assortment - read only in catalogs)
                            // These fields are always from the base product and cannot be edited per catalog
                            const baseName = product.name;
                            const baseDescription = product.description;
                            const baseUnit = product.unit;
                            const baseUnitWeight = product.unitWeight;
                            const basePackagingType = product.packagingType;
                            
                            // Catalog-specific values (editable per catalog)
                            const effectiveCategories = catalogPricing?.categories ?? product.categories;
                            const effectiveMarkup = catalogPricing?.markup ?? product.markup;
                            const effectivePortionPrices = catalogPricing?.portionPrices ?? product.portionPrices;
                            const effectiveStatus = getCatalogProductStatus(product, catalogPricing);
                            
                            // Calculate prices using catalog-specific markup but base product unitWeight
                            const salePrice = getCatalogSalePrice(product, catalogPricing);
                            const packagingPrices = calculatePackagingPrices(
                              salePrice,
                              baseUnitWeight,
                              basePackagingType,
                              product.customVariantPrices,
                              effectivePortionPrices
                            );
                            
                            return (
                              <SortableTableRow
                                id={product.id}
                                disabled={!!catalogSortColumn}
                                className={`${selectedCatalogProducts.has(product.id) ? "bg-primary/5" : ""} ${selectedCatalogBulkProducts.has(product.id) ? "bg-primary/10" : ""}`}
                              >
                                {catalogVisibleColumns.bulkCheckbox && (
                                  <ResizableTableCell columnId="bulkCheckbox">
                                    <div
                                      onClick={(e) => {
                                        const shiftKey = e.shiftKey;
                                        const filteredCatalogProducts = allProducts
                                          .filter(p => selectedCatalogProducts.has(p.id))
                                          .filter(p => !catalogProductSearch || p.name.toLowerCase().includes(catalogProductSearch.toLowerCase()))
                                          .filter(p => {
                                            if (catalogFilterCategory && catalogFilterCategory !== "all") {
                                              const cp = currentCatalog ? getCatalogProductPricing(currentCatalog.id, p.id) : undefined;
                                              const cats = cp?.categories ?? p.categories;
                                              if (!cats || !cats.includes(catalogFilterCategory)) return false;
                                            }
                                            if (catalogFilterStatus && catalogFilterStatus !== "all") {
                                              const cp = currentCatalog ? getCatalogProductPricing(currentCatalog.id, p.id) : undefined;
                                              const st = getCatalogProductStatus(p, cp);
                                              if (st !== catalogFilterStatus) return false;
                                            }
                                            if (catalogFilterPrice !== "all") {
                                              const cp = currentCatalog ? getCatalogProductPricing(currentCatalog.id, p.id) : undefined;
                                              const price = getCatalogSalePrice(p, cp);
                                              if (catalogFilterPrice === "with_price" && (!price || price <= 0)) return false;
                                              if (catalogFilterPrice === "no_price" && price > 0) return false;
                                            }
                                            return true;
                                          });
                                        
                                        setSelectedCatalogBulkProducts(prev => {
                                          const newSet = new Set(prev);
                                          
                                          // If Shift is pressed and we have a last selected product, select range
                                          if (shiftKey && lastSelectedCatalogProductId) {
                                            const lastIndex = filteredCatalogProducts.findIndex(p => p.id === lastSelectedCatalogProductId);
                                            const currentIndex = filteredCatalogProducts.findIndex(p => p.id === product.id);
                                            
                                            if (lastIndex !== -1 && currentIndex !== -1) {
                                              const startIndex = Math.min(lastIndex, currentIndex);
                                              const endIndex = Math.max(lastIndex, currentIndex);
                                              
                                              // Add all products in range
                                              for (let i = startIndex; i <= endIndex; i++) {
                                                newSet.add(filteredCatalogProducts[i].id);
                                              }
                                              return newSet;
                                            }
                                          }
                                          
                                          // Normal toggle behavior
                                          if (newSet.has(product.id)) {
                                            newSet.delete(product.id);
                                          } else {
                                            newSet.add(product.id);
                                          }
                                          return newSet;
                                        });
                                        
                                        // Always update last selected
                                        setLastSelectedCatalogProductId(product.id);
                                      }}
                                      className="cursor-pointer"
                                    >
                                      <Checkbox
                                        checked={selectedCatalogBulkProducts.has(product.id)}
                                        className="pointer-events-none"
                                      />
                                    </div>
                                  </ResizableTableCell>
                                )}
                                {/* Фото - из ассортимента (только чтение) */}
                                {catalogVisibleColumns.photo && (
                                  <ResizableTableCell columnId="photo">
                                    <div className="flex items-center justify-center">
                                      {(product.images?.length || 0) > 0 ? (
                                        <span className="flex items-center gap-0.5 text-green-600">
                                          <ImageIcon className="h-3.5 w-3.5" />
                                          <span className="text-[10px]">{product.images?.length}</span>
                                        </span>
                                      ) : (
                                        <ImageIcon className="h-3.5 w-3.5 text-muted-foreground/40" />
                                      )}
                                    </div>
                                  </ResizableTableCell>
                                )}
                                {/* Название - редактируемое, сохраняется в ассортимент */}
                                {catalogVisibleColumns.name && (
                                  <ResizableTableCell columnId="name" className="font-medium">
                                    <InlineEditableCell
                                      value={baseName}
                                      onSave={(newName) => {
                                        if (newName && newName !== baseName) {
                                          updateProduct({ ...product, name: newName });
                                        }
                                      }}
                                      placeholder="Название"
                                    />
                                  </ResizableTableCell>
                                )}
                                {/* Описание - редактируемое, сохраняется в ассортимент */}
                                {catalogVisibleColumns.description && (
                                  <ResizableTableCell columnId="description">
                                    <InlineEditableCell
                                      value={baseDescription || ""}
                                      onSave={(newDesc) => {
                                        if (newDesc !== baseDescription) {
                                          updateProduct({ ...product, description: newDesc });
                                        }
                                      }}
                                      placeholder="Описание..."
                                      className="text-muted-foreground text-xs"
                                    />
                                  </ResizableTableCell>
                                )}
                                {/* Категории - независимые для каждого каталога */}
                                {catalogVisibleColumns.categories && (
                                  <ResizableTableCell columnId="categories">
                                    <InlineMultiSelectCell
                                      values={effectiveCategories || []}
                                      options={categories.map(c => ({ value: c.id, label: c.name, sort_order: c.sort_order }))}
                                      onSave={(selectedIds) => {
                                        if (currentCatalog) {
                                          updateCatalogProductPricing(currentCatalog.id, product.id, { categories: selectedIds });
                                        }
                                      }}
                                      onAddOption={handleAddCategory}
                                      onReorder={() => {
                                        setCategoryOrderCatalogId(currentCatalog?.id || null);
                                        setCategoryOrderDialogOpen(true);
                                      }}
                                      placeholder="Категории..."
                                      addNewPlaceholder="Новая категория..."
                                      addNewButtonLabel="Создать категорию"
                                      allowAddNew={true}
                                      showReorderButton={true}
                                    />
                                  </ResizableTableCell>
                                )}
                                {/* Подкатегория - пока заглушка */}
                                {catalogVisibleColumns.subcategory && (
                                  <ResizableTableCell columnId="subcategory">
                                    <span className="text-muted-foreground text-xs">—</span>
                                  </ResizableTableCell>
                                )}
                                {/* Единица измерения - редактируемая, сохраняется в ассортимент */}
                                {catalogVisibleColumns.unit && (
                                  <ResizableTableCell columnId="unit">
                                    <InlineSelectCell
                                      value={baseUnit}
                                      options={allUnitOptions}
                                      onSave={(newUnit) => {
                                        if (newUnit !== baseUnit) {
                                          updateProduct({ ...product, unit: newUnit });
                                        }
                                      }}
                                      onAddOption={(newUnit) => setCustomUnits(prev => [...prev, newUnit])}
                                      addNewPlaceholder="Ед..."
                                      allowAddNew={true}
                                    />
                                  </ResizableTableCell>
                                )}
                                {/* Объём - редактируемый, сохраняется в ассортимент */}
                                {catalogVisibleColumns.volume && (
                                  <ResizableTableCell columnId="volume">
                                    <InlinePriceCell
                                      value={baseUnitWeight}
                                      onSave={(newVolume) => {
                                        if (newVolume !== baseUnitWeight) {
                                          updateProduct({ ...product, unitWeight: newVolume });
                                        }
                                      }}
                                      placeholder="0"
                                      suffix={baseUnit}
                                    />
                                  </ResizableTableCell>
                                )}
                                {/* Вид упаковки - редактируемый, сохраняется в ассортимент */}
                                {catalogVisibleColumns.type && (
                                  <ResizableTableCell columnId="type">
                                    <InlineSelectCell
                                      value={basePackagingType || "piece"}
                                      options={allPackagingOptions}
                                      onSave={(newType) => {
                                        if (newType !== basePackagingType) {
                                          updateProduct({ ...product, packagingType: newType as PackagingType });
                                        }
                                      }}
                                      onAddOption={(newType) => setCustomPackagingTypes(prev => [...prev, newType])}
                                      addNewPlaceholder="Вид..."
                                      allowAddNew={true}
                                    />
                                  </ResizableTableCell>
                                )}
                                {/* Себестоимость - редактируемая, сохраняется в ассортимент */}
                                {catalogVisibleColumns.buyPrice && (
                                  <ResizableTableCell columnId="buyPrice">
                                    <InlinePriceCell
                                      value={product.buyPrice}
                                      onSave={(newBuyPrice) => {
                                        if (newBuyPrice !== product.buyPrice) {
                                          updateProduct({ ...product, buyPrice: newBuyPrice });
                                        }
                                      }}
                                      placeholder="—"
                                      suffix="₽"
                                    />
                                  </ResizableTableCell>
                                )}
                                {/* Наценка - независимая для каждого каталога */}
                                {catalogVisibleColumns.markup && (
                                  <ResizableTableCell columnId="markup">
                                    <InlineMarkupCell
                                      value={effectiveMarkup}
                                      onSave={(markup) => {
                                        if (currentCatalog) {
                                          updateCatalogProductPricing(currentCatalog.id, product.id, { markup });
                                        }
                                      }}
                                    />
                                  </ResizableTableCell>
                                )}
                                {catalogVisibleColumns.price && (
                                  <ResizableTableCell columnId="price" className="font-medium">
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5 flex-shrink-0"
                                        onClick={() => {
                                          if (catalogPricing?.isFixedPrice || product.isFixedPrice) {
                                            // Turn off fixed price — for catalog-level if it was set there
                                            if (catalogPricing?.isFixedPrice && currentCatalog) {
                                              updateCatalogProductSettingsInDB(currentCatalog.id, product.id, { 
                                                is_fixed_price: false, fixed_price: null 
                                              });
                                            } else {
                                              updateProduct({ ...product, isFixedPrice: false });
                                            }
                                          } else {
                                            updateProduct({ ...product, isFixedPrice: !product.isFixedPrice });
                                          }
                                        }}
                                        title={catalogPricing?.isFixedPrice || product.isFixedPrice
                                          ? "Фиксированная цена (кликните для расчёта по наценке)" 
                                          : "Цена по наценке (кликните для фиксации)"}
                                      >
                                        {catalogPricing?.isFixedPrice || product.isFixedPrice
                                          ? <Lock className="h-3 w-3 text-amber-500" /> 
                                          : <Unlock className="h-3 w-3 text-muted-foreground/40" />}
                                      </Button>
                                      <InlinePriceCell
                                        value={salePrice || product.pricePerUnit}
                                        onSave={(newPrice) => {
                                          if (currentCatalog && newPrice !== undefined) {
                                            // Save as catalog-specific fixed price
                                            updateCatalogProductSettingsInDB(currentCatalog.id, product.id, { 
                                              fixed_price: newPrice ?? 0, 
                                              is_fixed_price: true 
                                            });
                                          }
                                        }}
                                        placeholder="0"
                                        suffix={`₽/${baseUnit}`}
                                      />
                                    </div>
                                  </ResizableTableCell>
                                )}
                                {catalogVisibleColumns.priceFull && (
                                  <ResizableTableCell columnId="priceFull">
                                    {packagingPrices ? (
                                      <span className="text-xs font-medium">{formatPrice(packagingPrices.full)}</span>
                                    ) : "-"}
                                  </ResizableTableCell>
                                )}
                                {/* Цена за ½ - независимая для каждого каталога */}
                                {catalogVisibleColumns.priceHalf && (
                                  <ResizableTableCell columnId="priceHalf">
                                    <div className="flex flex-col gap-0.5">
                                      <InlinePriceCell
                                        value={effectivePortionPrices?.halfPricePerKg}
                                        onSave={(value) => {
                                          if (currentCatalog) {
                                            updateCatalogProductPricing(currentCatalog.id, product.id, { 
                                              portionPrices: { 
                                                ...effectivePortionPrices, 
                                                halfPricePerKg: value 
                                              } 
                                            });
                                          }
                                        }}
                                        placeholder="—"
                                        suffix=""
                                      />
                                    </div>
                                  </ResizableTableCell>
                                )}
                                {/* Цена за ¼ - независимая для каждого каталога */}
                                {catalogVisibleColumns.priceQuarter && (
                                  <ResizableTableCell columnId="priceQuarter">
                                    <div className="flex flex-col gap-0.5">
                                      <InlinePriceCell
                                        value={effectivePortionPrices?.quarterPricePerKg}
                                        onSave={(value) => {
                                          if (currentCatalog) {
                                            updateCatalogProductPricing(currentCatalog.id, product.id, { 
                                              portionPrices: { 
                                                ...effectivePortionPrices, 
                                                quarterPricePerKg: value 
                                              } 
                                            });
                                          }
                                        }}
                                        placeholder="—"
                                        suffix=""
                                      />
                                    </div>
                                  </ResizableTableCell>
                                )}
                                {/* Цена за порцию - независимая для каждого каталога */}
                                {catalogVisibleColumns.pricePortion && (
                                  <ResizableTableCell columnId="pricePortion">
                                    <InlinePriceCell
                                      value={effectivePortionPrices?.portionPrice}
                                      onSave={(value) => {
                                        if (currentCatalog) {
                                          updateCatalogProductPricing(currentCatalog.id, product.id, { 
                                            portionPrices: { 
                                              ...effectivePortionPrices, 
                                              portionPrice: value 
                                            } 
                                          });
                                        }
                                      }}
                                      placeholder="—"
                                      suffix=""
                                    />
                                  </ResizableTableCell>
                                )}
                                {/* Статус - синхронизируется с витриной */}
                                {catalogVisibleColumns.status && (
                                  <ResizableTableCell columnId="status">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        if (!currentCatalog) return;
                                        const nextStatus: ProductStatus = 
                                          effectiveStatus === "in_stock" ? "pre_order" :
                                          effectiveStatus === "pre_order" ? "out_of_stock" :
                                          effectiveStatus === "out_of_stock" ? "hidden" : "in_stock";
                                        updateCatalogProductPricing(currentCatalog.id, product.id, { status: nextStatus });
                                      }}
                                      onTouchEnd={(e) => {
                                        e.stopPropagation();
                                      }}
                                      className="focus:outline-none touch-manipulation p-1"
                                      style={{ touchAction: 'manipulation' }}
                                    >
                                      <Badge
                                        variant={effectiveStatus === "hidden" ? "outline" : effectiveStatus === "in_stock" ? "default" : "secondary"}
                                        className={`text-xs cursor-pointer transition-colors select-none ${
                                          effectiveStatus === "hidden"
                                            ? "bg-muted/50 text-muted-foreground border-dashed"
                                            : effectiveStatus === "in_stock"
                                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 hover:bg-green-200 dark:hover:bg-green-800"
                                              : effectiveStatus === "pre_order"
                                                ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 hover:bg-blue-200 dark:hover:bg-blue-800"
                                                : "bg-muted text-muted-foreground hover:bg-muted/80"
                                        }`}
                                      >
                                        {effectiveStatus === "hidden" ? "Скрыт" : 
                                         effectiveStatus === "in_stock" ? "В наличии" : 
                                         effectiveStatus === "pre_order" ? "Под заказ" : "Нет"}
                                      </Badge>
                                    </button>
                                  </ResizableTableCell>
                                )}
                              </SortableTableRow>
                            );
                          })}
                      </ResizableTableBody>
                    </ResizableTable>
                  </div>
                  </DraggableTableWrapper>
                </>
              )}
            </>
          )}

          {effectiveStoreId && activeSection === "visibility" && (
            <>
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-foreground">Видимость товаров в прайс-листах</h2>
                <p className="text-sm text-muted-foreground">
                  Управляйте отображением товаров в различных прайс-листах
                </p>
              </div>

              {catalogs.length === 0 ? (
                <div className="bg-card rounded-lg border border-border p-8 text-center">
                  <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">Нет прайс-листов</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Сначала создайте прайс-листы в разделе "Прайс-листы"
                  </p>
                  <Button onClick={() => handleSectionChange("catalogs")}>
                    Перейти к прайс-листам
                  </Button>
                </div>
              ) : (
                <div className="bg-card rounded-lg border border-border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky left-0 bg-card z-10 min-w-[200px]">Товар</TableHead>
                        <TableHead className="min-w-[100px]">Себестоимость</TableHead>
                        {catalogs.map(catalog => (
                          <TableHead key={catalog.id} className="text-center min-w-[120px]">
                            {catalog.name}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allProducts.map(product => {
                        const productCatalogs = productCatalogVisibility[product.id] || new Set();
                        return (
                          <TableRow key={product.id}>
                            <TableCell className="sticky left-0 bg-card z-10 font-medium">
                              <div className="flex items-center gap-2">
                                {product.image && (
                                  <img 
                                    src={product.image} 
                                    alt={product.name} 
                                    className="w-8 h-8 rounded object-cover"
                                  />
                                )}
                                <span className="truncate max-w-[150px]">{product.name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {product.buyPrice ? formatPrice(product.buyPrice) : "-"}
                            </TableCell>
                            {catalogs.map(catalog => (
                              <TableCell key={catalog.id} className="text-center">
                                <Checkbox
                                  checked={productCatalogs.has(catalog.id)}
                                  onCheckedChange={() => toggleProductCatalogVisibility(product.id, catalog.id)}
                                />
                              </TableCell>
                            ))}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}


          {effectiveStoreId && activeSection === "profile" && (
            <>
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-foreground">Профиль</h2>
                <p className="text-sm text-muted-foreground">
                  Управление данными продавца и магазина
                </p>
              </div>

              {/* Подвкладки профиля */}
              <div className="flex border-b border-border bg-muted/30 rounded-t-lg mb-4">
                <button
                  onClick={() => setProfileSubSection('personal')}
                  className={`flex-1 py-2.5 text-xs font-medium transition-colors relative ${
                    profileSubSection === 'personal' 
                      ? 'text-primary' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    <span>Личные данные</span>
                  </div>
                  {profileSubSection === 'personal' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                  )}
                </button>
                <button
                  onClick={() => setProfileSubSection('store')}
                  className={`flex-1 py-2.5 text-xs font-medium transition-colors relative ${
                    profileSubSection === 'store' 
                      ? 'text-primary' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <Store className="w-3.5 h-3.5" />
                    <span>Магазин</span>
                  </div>
                  {profileSubSection === 'store' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                  )}
                </button>
                <button
                  onClick={() => setProfileSubSection('settings')}
                  className={`flex-1 py-2.5 text-xs font-medium transition-colors relative ${
                    profileSubSection === 'settings' 
                      ? 'text-primary' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <Settings className="w-3.5 h-3.5" />
                    <span>Настройки</span>
                  </div>
                  {profileSubSection === 'settings' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                  )}
                </button>
              </div>

              {/* Личные данные */}
              {profileSubSection === 'personal' && (
                <div className="bg-card rounded-lg border border-border p-4 space-y-4 animate-in fade-in duration-150">
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="profile-name">Имя</Label>
                      <Input
                        id="profile-name"
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        placeholder="Ваше имя"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="profile-phone">Телефон (для входа)</Label>
                      <Input
                        id="profile-phone"
                        value={profilePhone}
                        disabled
                        className="bg-muted"
                      />
                      <p className="text-xs text-muted-foreground">Телефон нельзя изменить — он используется для входа</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-muted-foreground">Email</Label>
                      <Input value={user?.email || ''} disabled className="bg-muted" />
                      <p className="text-xs text-muted-foreground">Email нельзя изменить</p>
                    </div>
                    <Button 
                      onClick={handleSaveProfile} 
                      disabled={savingProfile}
                      className="w-full"
                    >
                      {savingProfile && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      Сохранить изменения
                    </Button>
                  </div>
                </div>
              )}

              {/* Данные магазина */}
              {profileSubSection === 'store' && (
                <div className="bg-card rounded-lg border border-border p-4 space-y-4 animate-in fade-in duration-150">
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="store-name">Название магазина</Label>
                      <Input
                        id="store-name"
                        value={storeName}
                        onChange={(e) => setStoreName(e.target.value)}
                        placeholder="Название вашего магазина"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="store-phone">Телефон магазина</Label>
                      <Input
                        id="store-phone"
                        value={storePhone}
                        onChange={(e) => setStorePhone(e.target.value)}
                        placeholder="+7 (999) 123-45-67"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="store-email">Email магазина</Label>
                      <Input
                        id="store-email"
                        value={storeEmail}
                        onChange={(e) => setStoreEmail(e.target.value)}
                        placeholder="shop@example.com"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="store-address">Адрес</Label>
                      <Input
                        id="store-address"
                        value={storeAddress}
                        onChange={(e) => setStoreAddress(e.target.value)}
                        placeholder="Адрес магазина"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="store-description">Описание</Label>
                      <Textarea
                        id="store-description"
                        value={storeDescription}
                        onChange={(e) => setStoreDescription(e.target.value)}
                        placeholder="Краткое описание магазина"
                        rows={3}
                      />
                    </div>
                    <Button 
                      onClick={handleSaveStore} 
                      disabled={savingStore}
                      className="w-full"
                    >
                      {savingStore && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      Сохранить магазин
                    </Button>
                  </div>
                </div>
              )}

              {/* Настройки */}
              {profileSubSection === 'settings' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  {/* Смена пароля */}
                  <div className="bg-card rounded-lg border border-border p-4 space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Key className="w-3.5 h-3.5" />
                      Смена пароля
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        type="password"
                        placeholder="Новый пароль (мин. 6 символов)"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="flex-1"
                      />
                      <Button 
                        onClick={handleChangePassword} 
                        disabled={changingPassword || !newPassword}
                        size="sm"
                      >
                        {changingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : "Сменить"}
                      </Button>
                    </div>
                  </div>

                  {/* Ссылка на магазин */}
                  <div className="bg-card rounded-lg border border-border p-4 space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Link2 className="w-3.5 h-3.5" />
                      Ссылка на магазин
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        value={`${window.location.origin}/store/${currentStoreSubdomain || storeSubdomainOverride}`}
                        readOnly
                        className="flex-1 bg-muted"
                      />
                      <Button 
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/store/${currentStoreSubdomain || storeSubdomainOverride}`);
                          toast({ title: "Ссылка скопирована" });
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Выход */}
                  <div className="pt-4 border-t border-border">
                    <Button variant="outline" onClick={handleSignOut} className="w-full gap-2">
                      <LogOut className="w-4 h-4" />
                      Выйти из аккаунта
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {effectiveStoreId && activeSection === "clients" && (
            <StoreCustomersTable 
              storeId={effectiveStoreId} 
              moyskladLogin={firstMoyskladAccount?.login}
              moyskladPassword={firstMoyskladAccount?.password}
            />
          )}

          {effectiveStoreId && activeSection === "orders" && (
            <>
              <div className="mb-4">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h2 className="text-xl font-semibold text-foreground">Заказы</h2>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowOrderNotificationsPanel(!showOrderNotificationsPanel)}
                      className={`gap-1.5 ${showOrderNotificationsPanel ? 'bg-primary/10 border-primary' : ''}`}
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Отправлять заказы</span>
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Управляйте заказами от ваших покупателей
                </p>
                
                {/* Notifications settings panel */}
                {showOrderNotificationsPanel && (
                  <div className="mt-3 p-4 bg-muted/30 rounded-lg border border-border animate-in slide-in-from-top-2 duration-200">
                    <div className="mb-4">
                      <h4 className="text-sm font-medium mb-1">Настройка уведомлений</h4>
                      <p className="text-xs text-muted-foreground">
                        В этом разделе вы можете настроить оповещения о новых заказах. 
                        Выберите удобный канал связи и укажите контактные данные.
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4">
                      {/* Messenger icons */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground mr-2">Канал:</span>
                        <button
                          onClick={() => setSelectedNotificationChannel(selectedNotificationChannel === 'telegram' ? null : 'telegram')}
                          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                            selectedNotificationChannel === 'telegram' 
                              ? 'bg-[#0088cc] text-white shadow-md' 
                              : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                          }`}
                          title="Telegram"
                        >
                          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                          </svg>
                        </button>
                        <button
                          onClick={() => setSelectedNotificationChannel(selectedNotificationChannel === 'whatsapp' ? null : 'whatsapp')}
                          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                            selectedNotificationChannel === 'whatsapp' 
                              ? 'bg-[#25D366] text-white shadow-md' 
                              : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                          }`}
                          title="WhatsApp"
                        >
                          <MessageCircle className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => setSelectedNotificationChannel(selectedNotificationChannel === 'email' ? null : 'email')}
                          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                            selectedNotificationChannel === 'email' 
                              ? 'bg-primary text-primary-foreground shadow-md' 
                              : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                          }`}
                          title="Email"
                        >
                          <Mail className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => setSelectedNotificationChannel(selectedNotificationChannel === 'moysklad' ? null : 'moysklad')}
                          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                            selectedNotificationChannel === 'moysklad' 
                              ? 'bg-orange-500 text-white shadow-md' 
                              : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                          }`}
                          title="МойСклад"
                        >
                          <Package className="w-5 h-5" />
                        </button>
                      </div>
                      
                      {/* Contact input based on selected channel */}
                      <div className="flex-1">
                        {selectedNotificationChannel === 'telegram' && (
                          <div className="space-y-3">
                            {notificationContacts.telegram ? (
                              <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                  <span className="text-sm font-medium text-green-700 dark:text-green-300">
                                    Бот активен
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground mb-3">
                                  Уведомления о новых заказах будут приходить в Telegram
                                </p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full"
                                  onClick={() => {
                                    const storeId = effectiveStoreId;
                                    if (storeId) {
                                      window.open(`https://t.me/zakaz9999999999_bot?start=${storeId}`, '_blank');
                                    }
                                  }}
                                >
                                  <Send className="h-4 w-4 mr-2" />
                                  Открыть бота
                                </Button>
                              </div>
                            ) : (
                              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                                <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                                  Подключение Telegram-уведомлений
                                </p>
                                <p className="text-xs text-muted-foreground mb-3">
                                  Нажмите кнопку «Открыть бота» и в Telegram нажмите Start.
                                  Уведомления о заказах начнут приходить автоматически.
                                </p>
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="w-full bg-[#0088cc] hover:bg-[#0077b5]"
                                  onClick={() => {
                                    const storeId = effectiveStoreId;
                                    if (storeId) {
                                      window.open(`https://t.me/zakaz9999999999_bot?start=${storeId}`, '_blank');
                                    }
                                  }}
                                >
                                  <Send className="h-4 w-4 mr-2" />
                                  Открыть бота
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                        {selectedNotificationChannel === 'whatsapp' && (
                          <div className="space-y-1">
                            <Label className="text-xs">WhatsApp (номер телефона)</Label>
                            <Input
                              placeholder="+7 999 123-45-67"
                              value={notificationContacts.whatsapp}
                              onChange={(e) => setNotificationContacts(prev => ({ ...prev, whatsapp: e.target.value }))}
                              className="h-9"
                            />
                          </div>
                        )}
                        {selectedNotificationChannel === 'email' && (
                          <div className="space-y-1">
                            <Label className="text-xs">Email адрес</Label>
                            <Input
                              type="email"
                              placeholder="example@mail.ru"
                              value={notificationContacts.email}
                              onChange={(e) => setNotificationContacts(prev => ({ ...prev, email: e.target.value }))}
                              className="h-9"
                            />
                            <p className="text-xs text-muted-foreground mt-2">
                              ⚠️ Первое сообщение о новом заказе может прийти в папку «Спам». 
                              Достаньте его оттуда и нажмите «Это не спам». 
                              Следующие сообщения будут приходить на почту с оповещением.
                            </p>
                          </div>
                        )}
                        {selectedNotificationChannel === 'moysklad' && (
                          <div className="space-y-4">
                            {!firstMoyskladAccount ? (
                              <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                                <p className="text-sm text-amber-800 dark:text-amber-200 mb-3">
                                  ⚠️ Для отправки заказов в МойСклад сначала настройте подключение в разделе «Импорт товаров»
                                </p>
                                <Button 
                                  variant="outline"
                                  size="sm"
                                  className="border-amber-400 text-amber-800 hover:bg-amber-100 dark:border-amber-600 dark:text-amber-200 dark:hover:bg-amber-900/50"
                                  onClick={() => handleSectionChange("import")}
                                >
                                  <Settings className="h-4 w-4 mr-2" />
                                  Настроить подключение
                                </Button>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                {/* Step 1: Enable toggle */}
                                <div className={`relative p-4 rounded-lg border-2 transition-all ${
                                  supabaseSyncSettings?.sync_orders_enabled 
                                    ? 'border-green-500 bg-green-50 dark:bg-green-950/20' 
                                    : 'border-border bg-background'
                                }`}>
                                  <div className="flex items-start gap-3">
                                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm ${
                                      supabaseSyncSettings?.sync_orders_enabled 
                                        ? 'bg-green-500 text-white' 
                                        : 'bg-muted text-muted-foreground'
                                    }`}>
                                      {supabaseSyncSettings?.sync_orders_enabled ? <Check className="h-5 w-5" /> : '1'}
                                    </div>
                                    <div className="flex-1">
                                      <p className="text-sm font-semibold">Включить отправку заказов</p>
                                      <p className="text-xs text-muted-foreground mt-0.5">
                                        Заказы будут автоматически появляться в разделе «Заказы покупателей» МойСклад
                                      </p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={supabaseSyncSettings?.sync_orders_enabled || false}
                                        onChange={async (e) => {
                                          const enabled = e.target.checked;
                                          await updateSyncSettings({ sync_orders_enabled: enabled });
                                          if (enabled && !supabaseSyncSettings?.moysklad_organization_id) {
                                            fetchOrganizations(currentAccount?.login, currentAccount?.password);
                                            fetchCounterparties(currentAccount?.login, currentAccount?.password);
                                          }
                                          toast({
                                            title: enabled ? "Синхронизация включена" : "Синхронизация отключена",
                                          });
                                        }}
                                        className="sr-only peer"
                                      />
                                      <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                                    </label>
                                  </div>
                                </div>

                                {/* Step 2: Organization */}
                                <div className={`relative p-4 rounded-lg border-2 transition-all ${
                                  !supabaseSyncSettings?.sync_orders_enabled 
                                    ? 'border-border bg-muted/30 opacity-50' 
                                    : supabaseSyncSettings?.moysklad_organization_id 
                                      ? 'border-green-500 bg-green-50 dark:bg-green-950/20' 
                                      : 'border-orange-400 bg-orange-50 dark:bg-orange-950/20'
                                }`}>
                                  <div className="flex items-start gap-3">
                                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm ${
                                      supabaseSyncSettings?.moysklad_organization_id 
                                        ? 'bg-green-500 text-white' 
                                        : supabaseSyncSettings?.sync_orders_enabled 
                                          ? 'bg-orange-400 text-white' 
                                          : 'bg-muted text-muted-foreground'
                                    }`}>
                                      {supabaseSyncSettings?.moysklad_organization_id ? <Check className="h-5 w-5" /> : '2'}
                                    </div>
                                    <div className="flex-1 space-y-2">
                                      <p className="text-sm font-semibold">Выберите организацию</p>
                                      {supabaseSyncSettings?.sync_orders_enabled && (
                                        <>
                                          {moyskladOrganizations.length === 0 && !moyskladOrdersLoading ? (
                                            <Button
                                              variant="default"
                                              size="sm"
                                              className="h-9 gap-2 bg-orange-500 hover:bg-orange-600 text-white"
                                              onClick={() => fetchOrganizations(currentAccount?.login, currentAccount?.password)}
                                            >
                                              <Download className="h-4 w-4" />
                                              Загрузить организации
                                            </Button>
                                          ) : (
                                            <Select
                                              value={supabaseSyncSettings?.moysklad_organization_id || ""}
                                              onValueChange={async (value) => {
                                                await updateSyncSettings({ moysklad_organization_id: value });
                                                toast({ title: "Организация сохранена" });
                                              }}
                                              disabled={!supabaseSyncSettings?.sync_orders_enabled}
                                            >
                                              <SelectTrigger className="w-full h-9">
                                                <SelectValue placeholder={moyskladOrdersLoading ? "Загрузка..." : "Выберите организацию"} />
                                              </SelectTrigger>
                                              <SelectContent>
                                                {moyskladOrganizations.map((org) => (
                                                  <SelectItem key={org.id} value={org.id}>
                                                    {org.name}
                                                  </SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          )}
                                          {moyskladOrganizations.length > 0 && (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-7 text-xs gap-1"
                                              onClick={() => fetchOrganizations(currentAccount?.login, currentAccount?.password)}
                                              disabled={moyskladOrdersLoading}
                                            >
                                              <RefreshCw className={`h-3 w-3 ${moyskladOrdersLoading ? 'animate-spin' : ''}`} />
                                              Обновить
                                            </Button>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Step 3: Counterparty */}
                                <div className={`relative p-4 rounded-lg border-2 transition-all ${
                                  !supabaseSyncSettings?.sync_orders_enabled 
                                    ? 'border-border bg-muted/30 opacity-50' 
                                    : supabaseSyncSettings?.moysklad_counterparty_id 
                                      ? 'border-green-500 bg-green-50 dark:bg-green-950/20' 
                                      : supabaseSyncSettings?.moysklad_organization_id 
                                        ? 'border-orange-400 bg-orange-50 dark:bg-orange-950/20' 
                                        : 'border-border bg-muted/30 opacity-50'
                                }`}>
                                  <div className="flex items-start gap-3">
                                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm ${
                                      supabaseSyncSettings?.moysklad_counterparty_id 
                                        ? 'bg-green-500 text-white' 
                                        : supabaseSyncSettings?.sync_orders_enabled && supabaseSyncSettings?.moysklad_organization_id
                                          ? 'bg-orange-400 text-white' 
                                          : 'bg-muted text-muted-foreground'
                                    }`}>
                                      {supabaseSyncSettings?.moysklad_counterparty_id ? <Check className="h-5 w-5" /> : '3'}
                                    </div>
                                    <div className="flex-1 space-y-2">
                                      <p className="text-sm font-semibold">Выберите контрагента</p>
                                      <p className="text-xs text-muted-foreground -mt-1">
                                        Контрагент по умолчанию для всех заказов
                                      </p>
                                      {supabaseSyncSettings?.sync_orders_enabled && supabaseSyncSettings?.moysklad_organization_id && (
                                        <>
                                          {moyskladCounterparties.length === 0 && !moyskladOrdersLoading ? (
                                            <Button
                                              variant="default"
                                              size="sm"
                                              className="h-9 gap-2 bg-orange-500 hover:bg-orange-600 text-white"
                                              onClick={() => fetchCounterparties(currentAccount?.login, currentAccount?.password)}
                                            >
                                              <Download className="h-4 w-4" />
                                              Загрузить контрагентов
                                            </Button>
                                          ) : (
                                            <Select
                                              value={supabaseSyncSettings?.moysklad_counterparty_id || ""}
                                              onValueChange={async (value) => {
                                                await updateSyncSettings({ moysklad_counterparty_id: value });
                                                toast({ title: "Контрагент сохранён" });
                                              }}
                                              disabled={!supabaseSyncSettings?.sync_orders_enabled}
                                            >
                                              <SelectTrigger className="w-full h-9">
                                                <SelectValue placeholder={moyskladOrdersLoading ? "Загрузка..." : "Выберите контрагента"} />
                                              </SelectTrigger>
                                              <SelectContent>
                                                {moyskladCounterparties.map((cp) => (
                                                  <SelectItem key={cp.id} value={cp.id}>
                                                    {cp.name}
                                                  </SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          )}
                                          {moyskladCounterparties.length > 0 && (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-7 text-xs gap-1"
                                              onClick={() => fetchCounterparties(currentAccount?.login, currentAccount?.password)}
                                              disabled={moyskladOrdersLoading}
                                            >
                                              <RefreshCw className={`h-3 w-3 ${moyskladOrdersLoading ? 'animate-spin' : ''}`} />
                                              Обновить
                                            </Button>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Success status */}
                                {supabaseSyncSettings?.sync_orders_enabled && 
                                 supabaseSyncSettings?.moysklad_organization_id && 
                                 supabaseSyncSettings?.moysklad_counterparty_id && (
                                  <div className="flex items-center gap-3 p-4 bg-green-100 dark:bg-green-900/30 rounded-lg border-2 border-green-500">
                                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                                      <Check className="h-6 w-6 text-white" />
                                    </div>
                                    <div>
                                      <p className="text-sm font-semibold text-green-800 dark:text-green-200">
                                        ✓ Интеграция полностью настроена
                                      </p>
                                      <p className="text-xs text-green-700 dark:text-green-300">
                                        Заказы будут автоматически отправляться в МойСклад
                                      </p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        {!selectedNotificationChannel && (
                          <p className="text-xs text-muted-foreground py-2">
                            Выберите канал для получения уведомлений о новых заказах
                          </p>
                        )}
                      </div>
                      
                      {/* Save button - only for notification channels, not moysklad */}
                      {selectedNotificationChannel && selectedNotificationChannel !== 'moysklad' && (
                        <div className="flex items-end">
                          <Button
                            size="sm"
                            onClick={async () => {
                              if (selectedNotificationChannel === 'email') {
                                await saveNotificationSettings({
                                  notification_email: notificationContacts.email || null,
                                  email_enabled: !!notificationContacts.email,
                                });
                              } else if (selectedNotificationChannel === 'telegram') {
                                await saveNotificationSettings({
                                  notification_telegram: notificationContacts.telegram || null,
                                  telegram_enabled: !!notificationContacts.telegram,
                                });
                              } else if (selectedNotificationChannel === 'whatsapp') {
                                await saveNotificationSettings({
                                  notification_whatsapp: notificationContacts.whatsapp || null,
                                  whatsapp_enabled: !!notificationContacts.whatsapp,
                                });
                              }
                            }}
                            disabled={savingNotificationSettings}
                            className="gap-1.5"
                          >
                            {savingNotificationSettings ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="h-3.5 w-3.5" />
                            )}
                            Сохранить
                          </Button>
                        </div>
                      )}
                    </div>
                    
                    {/* Status indicator */}
                    {notificationSettings?.email_enabled && notificationSettings?.notification_email && (
                      <div className="mt-3 flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                        <Check className="h-3.5 w-3.5" />
                        <span>Email уведомления активны: {notificationSettings.notification_email}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Forming Orders Section - Real-time */}
              {effectiveStoreId && (
                <FormingOrdersSection storeId={effectiveStoreId} />
              )}

              <OrdersSection 
                orders={orders}
                loading={ordersLoading}
                updateOrderStatus={updateOrderStatus}
                storeId={effectiveStoreId}
              />
            </>
          )}

          {activeSection === "retail" && effectiveStoreId && (
            <RetailSettingsSection storeId={effectiveStoreId} />
          )}

          {activeSection === "showcase" && effectiveStoreId && (
            <div className="space-y-6">
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-foreground">Витрина</h2>
                <p className="text-sm text-muted-foreground">
                  Настройки публичной витрины магазина
                </p>
              </div>

              <div className="space-y-4 max-w-md">
                <div className="space-y-2">
                  <Label htmlFor="showcase-phone">Номер телефона</Label>
                  <Input
                    id="showcase-phone"
                    type="tel"
                    value={showcasePhone}
                    onChange={(e) => setShowcasePhone(e.target.value)}
                    placeholder="+7 (999) 123-45-67"
                  />
                  <p className="text-xs text-muted-foreground">
                    Будет отображаться на витрине как кликабельный контакт
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="showcase-whatsapp">WhatsApp</Label>
                  <Input
                    id="showcase-whatsapp"
                    type="tel"
                    value={showcaseWhatsapp}
                    onChange={(e) => setShowcaseWhatsapp(e.target.value)}
                    placeholder="+7 999 123-45-67"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="showcase-telegram">Telegram</Label>
                  <Input
                    id="showcase-telegram"
                    value={showcaseTelegram}
                    onChange={(e) => setShowcaseTelegram(e.target.value)}
                    placeholder="@username"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="showcase-max">Max</Label>
                  <Input
                    id="showcase-max"
                    value={showcaseMaxLink}
                    onChange={(e) => setShowcaseMaxLink(e.target.value)}
                    placeholder="max.me/username"
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <Switch
                    id="showcase-floating-messenger"
                    checked={showcaseFloatingMessenger}
                    onCheckedChange={setShowcaseFloatingMessenger}
                  />
                  <Label htmlFor="showcase-floating-messenger" className="text-sm">
                    Плавающая кнопка мессенджеров на витрине
                  </Label>
                </div>

                <Button
                  onClick={async () => {
                    setSavingShowcase(true);
                    try {
                       const { error } = await supabase
                        .from('stores')
                        .update({
                          showcase_phone: showcasePhone || null,
                          showcase_whatsapp_phone: showcaseWhatsapp || null,
                          showcase_telegram_username: showcaseTelegram || null,
                          showcase_max_link: showcaseMaxLink || null,
                          showcase_floating_messenger_enabled: showcaseFloatingMessenger,
                        } as any)
                        .eq('id', effectiveStoreId);
                      if (error) throw error;
                      toast({ title: "Сохранено", description: "Настройки витрины обновлены" });
                    } catch (err: any) {
                      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
                    } finally {
                      setSavingShowcase(false);
                    }
                  }}
                  disabled={savingShowcase}
                  size="sm"
                >
                  {savingShowcase ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Сохранить
                </Button>
              </div>
            </div>
          )}

          {activeSection === "wholesale" && effectiveStoreId && (
            <WholesaleSettingsSection storeId={effectiveStoreId} />
          )}

          {activeSection === "trash" && (
            <TrashSection storeId={effectiveStoreId} />
          )}

          {activeSection === "history" && (
            <ActivityHistorySection storeId={effectiveStoreId} />
          )}

          {activeSection === "help" && (
            <div className="space-y-6">
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-foreground">Помощь</h2>
                <p className="text-sm text-muted-foreground">
                  Руководства и ответы на частые вопросы
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {/* Quick Start - интерактивный список шагов онбординга */}
                <QuickStartList onStepClick={onSwitchToStorefront} />

                {/* Catalogs Help */}
                <div className="bg-card rounded-lg border border-border p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                      <FolderOpen className="h-5 w-5 text-blue-500" />
                    </div>
                    <h3 className="font-semibold text-foreground">Прайс-листы</h3>
                  </div>
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <p>Прайс-листы позволяют создавать разные каталоги товаров для разных групп клиентов.</p>
                    <p>Вы можете настроить индивидуальные цены и наценки для каждого прайс-листа.</p>
                    <p>Каждый прайс-лист имеет уникальную ссылку для доступа.</p>
                  </div>
                </div>

                {/* Import Help */}
                <div className="bg-card rounded-lg border border-border p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                      <Download className="h-5 w-5 text-green-500" />
                    </div>
                    <h3 className="font-semibold text-foreground">Импорт из МойСклад</h3>
                  </div>
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <p>Подключите аккаунт МойСклад для автоматической синхронизации товаров.</p>
                    <p>Товары, цены и остатки будут обновляться автоматически.</p>
                    <p>Вы можете настроить какие поля синхронизировать.</p>
                  </div>
                </div>

                {/* Orders Help */}
                <div className="bg-card rounded-lg border border-border p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                      <ShoppingCart className="h-5 w-5 text-orange-500" />
                    </div>
                    <h3 className="font-semibold text-foreground">Заказы</h3>
                  </div>
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <p>Когда клиент оформляет заказ через прайс-лист, он появится здесь.</p>
                    <p>Управляйте статусами заказов: принять, отправить, доставлен.</p>
                    <p>Все заказы сохраняются в истории.</p>
                  </div>
                </div>

                {/* Visibility Help */}
                <div className="bg-card rounded-lg border border-border p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                      <Eye className="h-5 w-5 text-purple-500" />
                    </div>
                    <h3 className="font-semibold text-foreground">Видимость товаров</h3>
                  </div>
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <p>Настройте видимость товаров для разных ролей клиентов.</p>
                    <p>Создавайте роли (например: VIP, Оптовики, Розница).</p>
                    <p>Назначайте роли клиентам для персональных прайсов.</p>
                  </div>
                </div>

                {/* Clients Help */}
                <div className="bg-card rounded-lg border border-border p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-pink-500/10 flex items-center justify-center">
                      <Users className="h-5 w-5 text-pink-500" />
                    </div>
                    <h3 className="font-semibold text-foreground">Клиенты</h3>
                  </div>
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <p>Просматривайте всех зарегистрированных клиентов.</p>
                    <p>Назначайте клиентам роли для персонализации.</p>
                    <p>Управляйте доступом к прайс-листам.</p>
                  </div>
                </div>
              </div>

              {/* FAQ Section */}
              <div className="bg-card rounded-lg border border-border p-6">
                <h3 className="font-semibold text-foreground mb-4">Часто задаваемые вопросы</h3>
                <div className="space-y-4">
                  <div>
                    <p className="font-medium text-foreground mb-1">Как добавить товар вручную?</p>
                    <p className="text-sm text-muted-foreground">Перейдите в раздел «Ассортимент» и нажмите кнопку «+» или «Добавить товар». Введите название и нажмите ОК.</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-1">Как отправить прайс-лист клиенту?</p>
                    <p className="text-sm text-muted-foreground">Откройте прайс-лист, нажмите на кнопку копирования ссылки и отправьте её клиенту. Клиент увидит только товары из этого прайс-листа.</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-1">Как настроить разные цены для разных клиентов?</p>
                    <p className="text-sm text-muted-foreground">Создайте несколько прайс-листов с разными наценками. Или используйте роли клиентов для индивидуальных скидок/наценок.</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-1">Прайс-лист не отображается?</p>
                    <p className="text-sm text-muted-foreground">Обновите страницу (F5). Убедитесь, что прайс-лист создан и в него добавлены товары.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === "category-settings" && effectiveStoreId && (
            <CategorySettingsSection
              storeId={effectiveStoreId}
              catalogs={supabaseCatalogs}
              categories={storeCategories}
              onCreateCategory={createCategory}
              onRenameCategory={renameCategory}
              onDeleteCategory={deleteCategory}
            />
          )}

          {activeSection === "exchange" && (
            <ExchangeSection storeId={effectiveStoreId} />
          )}

          {activeSection === "avito" && (
            <AvitoSection 
              storeId={effectiveStoreId} 
              products={allProducts}
              avitoFeed={avitoFeed}
              storeCategories={storeCategories}
            />
          )}
        </main>

      {/* Quick Add Product Dialog */}
      <Dialog open={quickAddDialogOpen} onOpenChange={setQuickAddDialogOpen}>
        <DialogContent className="sm:max-w-md top-4 translate-y-0 sm:top-1/2 sm:-translate-y-1/2">
          <DialogHeader>
            <DialogTitle>Добавить товар</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Название товара"
              value={quickAddProductName}
              onChange={(e) => setQuickAddProductName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleQuickAddProduct();
                }
              }}
              autoFocus
              className="flex-1"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handlePasteFromClipboard}
              title="Вставить из буфера"
            >
              <Clipboard className="h-4 w-4" />
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickAddDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleQuickAddProduct}>
              <Check className="h-4 w-4 mr-2" />
              ОК
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Order Dialog */}
      <CategoryOrderDialog
        open={categoryOrderDialogOpen}
        onOpenChange={(open) => {
          setCategoryOrderDialogOpen(open);
          if (!open) setCategoryOrderCatalogId(null);
        }}
        categories={storeCategories}
        catalogId={categoryOrderCatalogId}
        catalogName={categoryOrderCatalogId ? catalogs.find(c => c.id === categoryOrderCatalogId)?.name : undefined}
        onSave={async (orderedIds) => {
          if (categoryOrderCatalogId) {
            await updateCatalogCategoryOrder(categoryOrderCatalogId, orderedIds);
          } else {
            await updateCategoryOrder(orderedIds);
          }
          toast({
            title: "Порядок сохранён",
            description: categoryOrderCatalogId 
              ? "Порядок категорий в прайс-листе обновлён и применён на витрине"
              : "Порядок отображения категорий обновлён",
          });
        }}
        onRename={async (id, newName) => {
          await renameCategory(id, newName);
          toast({ title: "Категория переименована" });
        }}
        onDelete={async (id) => {
          await deleteCategory(id);
          toast({ title: "Категория удалена" });
        }}
      />

      {/* Catalog Export Dialog */}
      <CatalogExportDialog
        open={catalogExportDialogOpen}
        onOpenChange={setCatalogExportDialogOpen}
        catalogName={currentCatalog?.name || ""}
        onExport={handleExportCatalog}
        isExporting={isExportingCatalog}
        productCount={selectedCatalogProducts.size}
      />

      {/* Catalog PDF Export Dialog */}
      <CatalogPdfExportDialog
        open={catalogPdfExportDialogOpen}
        onOpenChange={setCatalogPdfExportDialogOpen}
        catalogName={currentCatalog?.name || ""}
        onExport={handleExportCatalogPdf}
        isExporting={isExportingPdf}
        productCount={selectedCatalogProducts.size}
        exportProgress={pdfExportProgress}
      />

      {/* Catalog Import Dialog */}
      <CatalogImportDialog
        open={catalogImportDialogOpen}
        onOpenChange={setCatalogImportDialogOpen}
        storeId={effectiveStoreId || ""}
        catalogId={currentCatalog?.id || ""}
        catalogName={currentCatalog?.name || ""}
        onComplete={() => {
          // Refresh products and catalog data
          refetchProducts();
          refetchCatalogs();
        }}
      />

    </div>
  );
}
