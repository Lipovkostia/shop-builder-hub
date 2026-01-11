import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { ArrowLeft, Package, Download, RefreshCw, Check, X, Loader2, Image as ImageIcon, LogIn, Lock, Unlock, ExternalLink, Filter, Plus, ChevronRight, Trash2, FolderOpen, Edit2, Settings, Users, Shield, ChevronDown, ChevronUp, Tag, Store, Clipboard, Link2, Copy, ShoppingCart, Eye, Clock, ChevronsUpDown, Send, MessageCircle, Mail, User, Key, LogOut, FileSpreadsheet, Sheet, Upload } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SpotlightOverlay } from "@/components/onboarding/SpotlightOverlay";
import { useOnboardingSpotlight } from "@/components/onboarding/useOnboardingSpotlight";
import { adminPanelSpotlightSteps } from "@/components/onboarding/onboardingSteps";
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

type ActiveSection = "products" | "import" | "catalogs" | "visibility" | "profile" | "orders" | "clients" | "help";
type ImportView = "accounts" | "catalog";
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
  onTriggerOnboardingStep9?: () => void;
}

export default function AdminPanel({ 
  workspaceMode, 
  storeIdOverride, 
  storeSubdomainOverride,
  onSwitchToStorefront,
  initialSection,
  onTriggerOnboardingStep9
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
  const effectiveStoreId = workspaceMode && storeIdOverride ? storeIdOverride : (storeIdFromUrl || userStoreId || currentStoreId);
  
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
  const { categories: storeCategories, loading: categoriesLoading, createCategory, updateCategoryOrder, refetch: refetchCategories } = useStoreCategories(effectiveStoreId);
  const [categoryOrderDialogOpen, setCategoryOrderDialogOpen] = useState(false);
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
    if (section === 'products' || section === 'import' || section === 'catalogs' || section === 'visibility' || section === 'orders' || section === 'clients' || section === 'help') {
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

  // Filters for "All Products" table
  const [allProductsFilters, setAllProductsFilters] = useState({
    name: "",
    desc: "",
    source: "all",
    unit: "all",
    type: "all",
    volume: "",
    cost: "",
    status: "all",
    sync: "all",
    groups: [] as string[],
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
  const [selectedCatalogProducts, setSelectedCatalogProducts] = useState<Set<string>>(new Set());
  const [editingCatalogName, setEditingCatalogName] = useState(false);
  const [selectedCatalogBulkProducts, setSelectedCatalogBulkProducts] = useState<Set<string>>(new Set());
  const [expandedCatalogId, setExpandedCatalogId] = useState<string | null>(null);
  const [catalogSettingsOpen, setCatalogSettingsOpen] = useState<string | null>(null);
  const [editingCatalogListName, setEditingCatalogListName] = useState<string | null>(null);
  const [catalogListNameValue, setCatalogListNameValue] = useState("");
  
  // Onboarding step 6 sub-step state: "volume" | "half" | "quarter" | "done"
  const [onboardingStep6SubStep, setOnboardingStep6SubStep] = useState<"volume" | "half" | "quarter" | "done">("volume");
  
  // Onboarding step 7 visibility state
  const [onboardingStep7Visible, setOnboardingStep7Visible] = useState(true);
  
  // Onboarding step 8 visibility state
  const [onboardingStep8Visible, setOnboardingStep8Visible] = useState(false);

  // Collapsed orders state - to hide/show order items
  const [collapsedOrders, setCollapsedOrders] = useState<Set<string>>(new Set());
  
  // Spotlight onboarding for guided tour
  // Активируем когда есть товары но нет прайс-листов (шаг 2 старого онбординга)
  const spotlightCondition = supabaseProducts.length > 0 && supabaseCatalogs.length === 0 && !productsLoading && !catalogsLoading;
  const {
    currentStep: spotlightStep,
    isSpotlightActive,
    nextStep: nextSpotlightStep,
    skipSpotlight,
    closeSpotlight,
    startSpotlightFromStep
  } = useOnboardingSpotlight({
    storageKey: 'admin_panel_spotlight_v2_completed',
    steps: adminPanelSpotlightSteps,
    isOnboardingActive: spotlightCondition,
    onComplete: () => {
      console.log('Spotlight onboarding completed');
    }
  });
  
  // Order notifications settings panel state
  const [showOrderNotificationsPanel, setShowOrderNotificationsPanel] = useState(false);
  const [selectedNotificationChannel, setSelectedNotificationChannel] = useState<'telegram' | 'whatsapp' | 'email' | 'moysklad' | null>(null);
  const [notificationContacts, setNotificationContacts] = useState({
    telegram: '',
    whatsapp: '',
    email: '',
  });
  
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
  const [newPassword, setNewPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingStore, setSavingStore] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [profileSubSection, setProfileSubSection] = useState<'personal' | 'store' | 'settings'>('personal');
  const [isExportingProducts, setIsExportingProducts] = useState(false);
  const [catalogExportDialogOpen, setCatalogExportDialogOpen] = useState(false);
  const [isExportingCatalog, setIsExportingCatalog] = useState(false);

  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    drag: true,
    checkbox: true,
    photo: true,
    name: true,
    desc: true,
    source: true,
    unit: true,
    type: true,
    volume: true,
    cost: true,
    groups: true,
    catalogs: true,
    sync: true,
  });

  const columnLabels: Record<string, string> = {
    drag: "⋮⋮",
    checkbox: "Выбор",
    photo: "Фото",
    name: "Название",
    desc: "Описание",
    source: "Источник",
    unit: "Ед.",
    type: "Вид",
    volume: "Объем",
    cost: "Себест.",
    groups: "Группа",
    catalogs: "Прайс-листы",
    sync: "Синхр.",
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
    categories: "Категории",
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
  const categories = storeCategories.map(c => ({ id: c.id, name: c.name, sort_order: c.sort_order }));
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
          const { data: store } = await supabase
            .from('stores')
            .select('id, name, subdomain')
            .eq('owner_id', profile.id)
            .single();
          
          if (store) {
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
      if (activeSection === 'profile' && effectiveStoreId) {
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
          .select('name, contact_phone, contact_email, address, description')
          .eq('id', effectiveStoreId)
          .single();
        
        if (storeData) {
          setStoreName(storeData.name || '');
          setStorePhone(storeData.contact_phone || '');
          setStoreEmail(storeData.contact_email || '');
          setStoreAddress(storeData.address || '');
          setStoreDescription(storeData.description || '');
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
        });
        
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
        });
        
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

        const { data } = await supabase.functions.invoke('moysklad', {
          body: { 
            action: 'get_assortment', 
            limit: 100, 
            offset: 0,
            login: account.login,
            password: account.password
          }
        });

        if (data?.products) {
          const msProductsMap = new Map(data.products.map((p: MoySkladProduct) => [p.id, p]));
          
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
    // Clear existing timer
    if (syncTimerRef.current) {
      clearInterval(syncTimerRef.current);
      syncTimerRef.current = null;
    }

    if (!syncSettings.enabled) return;

    const syncedProductsCount = importedProducts.filter(p => p.autoSync).length;
    if (syncedProductsCount === 0) return;

    // Set initial next sync time if not set
    if (!syncSettings.nextSyncTime) {
      setSyncSettings(prev => ({
        ...prev,
        nextSyncTime: new Date(Date.now() + prev.intervalMinutes * 60000).toISOString(),
      }));
    }

    // Check every second if it's time to sync
    syncTimerRef.current = setInterval(() => {
      if (syncSettings.nextSyncTime) {
        const now = Date.now();
        const nextSync = new Date(syncSettings.nextSyncTime).getTime();
        
        if (now >= nextSync && !isSyncing) {
          syncAutoSyncProducts(syncSettings.fieldMapping);
        }
      }
    }, 10000); // Check every 10 seconds

    return () => {
      if (syncTimerRef.current) {
        clearInterval(syncTimerRef.current);
      }
    };
  }, [syncSettings.enabled, syncSettings.intervalMinutes, syncSettings.nextSyncTime, importedProducts.length]);

  // Handle sync settings change
  const handleSyncSettingsChange = (newSettings: SyncSettings) => {
    setSyncSettings(newSettings);
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
          
          // Calculate effective price
          const buyPrice = product.buyPrice || 0;
          const markup = catalogPricing?.markup || product.markup;
          const price = calculateSalePrice(buyPrice, markup);
          
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
            name: product.name,
            description: product.description,
            categories: catalogPricing?.categories || null,
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
      markup: dbSettings.markup_value > 0 ? {
        type: dbSettings.markup_type === 'fixed' ? 'rubles' : 'percent',
        value: dbSettings.markup_value
      } : undefined,
      status: dbSettings.status as ProductStatus,
      categories: dbSettings.categories,
      portionPrices: dbSettings.portion_prices || undefined,
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
    const buyPrice = product.buyPrice || 0;
    const markup = catalogPricing?.markup || product.markup;
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
    await fetchMoySkladProducts(account);
  };

  const fetchMoySkladProducts = async (account?: MoyskladAccount) => {
    const acc = account || currentAccount;
    if (!acc) return;
    
    setIsLoading(true);
    try {
      console.log("Fetching products from MoySklad...");
      
      const { data, error } = await supabase.functions.invoke('moysklad', {
        body: { 
          action: 'get_assortment', 
          limit: 100, 
          offset: 0,
          login: acc.login,
          password: acc.password
        }
      });

      if (error) {
        console.error("Error fetching products:", error);
        toast({
          title: "Ошибка",
          description: "Не удалось загрузить товары из МойСклад",
          variant: "destructive",
        });
        return;
      }

      if (data.error) {
        console.error("MoySklad API error:", data.error);
        toast({
          title: "Ошибка авторизации",
          description: "Неверный логин или пароль МойСклад",
          variant: "destructive",
        });
        return;
      }

      console.log("Fetched products:", data);
      setMoyskladProducts(data.products || []);
      setTotalProducts(data.meta?.size || 0);
      
      // Update account's last sync time
      setAccounts(prev => prev.map(a => 
        a.id === acc.id ? { ...a, lastSync: new Date().toISOString() } : a
      ));
      
      toast({
        title: "Товары загружены",
        description: `Загружено ${data.products?.length || 0} товаров`,
      });
    } catch (err) {
      console.error("Error:", err);
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
      const { data } = await supabase.functions.invoke('moysklad', {
        body: { action: 'get_assortment', limit: 100, offset: 0, login: currentAccount.login, password: currentAccount.password }
      });

      if (data?.products) {
        const msProductsMap = new Map(data.products.map((p: MoySkladProduct) => [p.id, p]));
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
      // Check if product already exists in Supabase by moysklad_id
      const existingSupabaseProduct = supabaseProducts.find(sp => sp.moysklad_id === product.moyskladId);
      
      if (existingSupabaseProduct) {
        // Update existing product
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
        });
        savedCount++;
      } else {
        // Create new product in Supabase
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
        });
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
    return supabaseProducts.map(sp => ({
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
      source: (sp.source || "manual") as "moysklad" | undefined,
      moyskladId: sp.moysklad_id || undefined,
      autoSync: sp.auto_sync || false,
      accountId: sp.moysklad_account_id || undefined,
      syncedMoyskladImages: sp.synced_moysklad_images || [],
      status: sp.is_active ? "in_stock" as const : "hidden" as const,
    })) as Product[];
  }, [supabaseProducts]);

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

  // Loading state - wait for auth and store context
  // В workspaceMode не показываем спиннер, так как данные магазина уже загружены в SellerWorkspace
  if (!workspaceMode && (authLoading || (storeIdFromUrl && storeContextLoading))) {
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
              <div className="mb-2 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Товары</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                    {filteredAllProducts.length}
                  </Badge>
                  {importedProducts.length > 0 && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                      МС: {importedProducts.length}
                    </Badge>
                  )}
                  <div className="relative" data-onboarding="add-product-button">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => setQuickAddDialogOpen(true)}
                      title="Добавить товар"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    {/* Hint for empty state */}
                    {allProducts.length === 0 && (
                      <div className="absolute left-8 top-1/2 -translate-y-1/2 whitespace-nowrap bg-primary text-primary-foreground text-xs px-2 py-1 rounded shadow-lg animate-pulse">
                        Добавьте свой первый товар
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 bg-primary rotate-45" />
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {importedProducts.some(p => p.autoSync) && (
                    <Button
                      onClick={() => syncAutoSyncProducts()}
                      disabled={isSyncing}
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                    >
                      {isSyncing ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3 w-3" />
                      )}
                      <span className="hidden sm:inline ml-1">Синхр.</span>
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={handleExportProducts}
                    disabled={isExportingProducts || supabaseProducts.length === 0}
                    title="Скачать ассортимент в Excel"
                  >
                    {isExportingProducts ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1">
                        <Settings className="h-3 w-3" />
                        <span className="hidden sm:inline">Столбцы</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      {Object.entries(columnLabels).map(([id, label]) => (
                        <DropdownMenuCheckboxItem
                          key={id}
                          checked={visibleColumns[id]}
                          onCheckedChange={() => toggleColumnVisibility(id)}
                          className="text-xs"
                        >
                          {label}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Bulk Edit Panel */}
              <BulkEditPanel
                selectedCount={selectedBulkProducts.size}
                onClearSelection={() => setSelectedBulkProducts(new Set())}
                onBulkUpdate={bulkUpdateProducts}
                onBulkDelete={bulkDeleteProducts}
                unitOptions={allUnitOptions}
                packagingOptions={allPackagingOptions}
                catalogs={catalogs}
                onAddToCatalog={async (catalogId) => {
                  const productIds = Array.from(selectedBulkProducts);
                  let addedCount = 0;
                  for (const productId of productIds) {
                    const currentSet = productCatalogVisibility[productId] || new Set();
                    if (!currentSet.has(catalogId)) {
                      await toggleProductCatalogVisibility(productId, catalogId);
                      addedCount++;
                    }
                  }
                  const catalogName = catalogs.find(c => c.id === catalogId)?.name || "прайс-лист";
                  toast({
                    title: "Товары добавлены",
                    description: `${addedCount} товар(ов) добавлено в "${catalogName}"`,
                  });
                  setSelectedBulkProducts(new Set());
                }}
                onCreateCatalogAndAdd={async (catalogName) => {
                  const newCatalog = await createSupabaseCatalog(catalogName);
                  if (newCatalog) {
                    const productIds = Array.from(selectedBulkProducts);
                    for (const productId of productIds) {
                      await toggleProductCatalogVisibility(productId, newCatalog.id);
                    }
                    toast({
                      title: "Прайс-лист создан",
                      description: `"${catalogName}" создан и ${productIds.length} товар(ов) добавлено`,
                    });
                    setSelectedBulkProducts(new Set());
                  }
                }}
              />

              {/* Onboarding Step 2: Create price list hint - show only when no catalogs exist */}
              {supabaseProducts.length > 0 && catalogs.length === 0 && (
                <div 
                  className="bg-primary/10 border border-primary/30 rounded-lg p-3 mb-3 cursor-pointer hover:bg-primary/15 transition-colors"
                  onClick={() => {
                    // Scroll table to show catalogs column
                    const catalogsHeader = document.querySelector('[data-column-id="catalogs"]');
                    if (catalogsHeader) {
                      catalogsHeader.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                      // Highlight the column briefly
                      catalogsHeader.classList.add('animate-pulse', 'bg-primary/20');
                      setTimeout(() => {
                        catalogsHeader.classList.remove('animate-pulse', 'bg-primary/20');
                      }, 2000);
                    }
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-primary font-bold text-sm">2</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">Создайте прайс-лист для типа покупателей</p>
                      <p className="text-xs text-muted-foreground">
                        Например: «Рестораны» с наценкой 30%, «Оптовики» с наценкой 15%
                      </p>
                      <p className="text-xs text-primary mt-1">
                        Нажмите «+» в столбике «Прайс-листы» →
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-primary" />
                  </div>
                </div>
              )}

              {/* Onboarding Step 3: Go to price list - show only when catalog exists, product linked, but no buyPrice set yet */}
              {supabaseProducts.length > 0 && catalogs.length > 0 && 
               Object.values(productCatalogVisibility).some(cats => cats.size > 0) &&
               !supabaseProducts.some(p => p.buy_price && p.buy_price > 0) && (
                <div 
                  className="bg-primary/10 border border-primary/30 rounded-lg p-3 mb-3 cursor-pointer hover:bg-primary/15 transition-colors"
                  onClick={() => {
                    // Scroll table to show catalogs column
                    const catalogsHeader = document.querySelector('[data-column-id="catalogs"]');
                    if (catalogsHeader) {
                      catalogsHeader.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                    }
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-primary font-bold text-sm">3</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">Перейдите в прайс-лист для настройки цен</p>
                      <p className="text-xs text-muted-foreground">
                        Один товар может быть в разных прайс-листах с разными ценами
                      </p>
                      <p className="text-xs text-primary mt-1">
                        Нажмите на кнопку «→» рядом с прайс-листом
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-primary" />
                  </div>
                </div>
              )}

              <div className="bg-card rounded-lg border border-border">
                <DraggableTableWrapper items={productIds} onReorder={handleProductReorder}>
                <ResizableTable
                  storageKey="admin-products-v4"
                  columns={[
                    { id: "checkbox", minWidth: 40, defaultWidth: 40 },
                    { id: "drag", minWidth: 32, defaultWidth: 32 },
                    { id: "photo", minWidth: 50, defaultWidth: 50 },
                    { id: "name", minWidth: 120, defaultWidth: 180 },
                    { id: "desc", minWidth: 100, defaultWidth: 150 },
                    { id: "source", minWidth: 80, defaultWidth: 90 },
                    { id: "unit", minWidth: 60, defaultWidth: 70 },
                    { id: "type", minWidth: 70, defaultWidth: 85 },
                    { id: "volume", minWidth: 70, defaultWidth: 80 },
                    { id: "cost", minWidth: 70, defaultWidth: 90 },
                    { id: "groups", minWidth: 100, defaultWidth: 120 },
                    { id: "catalogs", minWidth: 100, defaultWidth: 120 },
                    { id: "status", minWidth: 70, defaultWidth: 80 },
                    { id: "sync", minWidth: 36, defaultWidth: 36 },
                    { id: "actions", minWidth: 40, defaultWidth: 40 },
                  ]}
                >
                  <ResizableTableHeader>
                    {/* Row 1: Column names */}
                    <ResizableTableRow className="h-6">
                      {visibleColumns.drag && (
                        <ResizableTableHead columnId="drag" minWidth={32} resizable={false}>
                          <span className="text-muted-foreground/50 text-[10px]">⋮⋮</span>
                        </ResizableTableHead>
                      )}
                      {visibleColumns.checkbox && (
                        <ResizableTableHead columnId="checkbox" minWidth={40} resizable={false}>
                          <Checkbox
                            checked={selectedBulkProducts.size === filteredAllProducts.length && filteredAllProducts.length > 0}
                            onCheckedChange={selectAllBulkProducts}
                          />
                        </ResizableTableHead>
                      )}
                      {visibleColumns.photo && (
                        <ResizableTableHead columnId="photo" minWidth={50} resizable={false}>Фото</ResizableTableHead>
                      )}
                      {visibleColumns.name && (
                        <ResizableTableHead columnId="name" minWidth={120}>Название</ResizableTableHead>
                      )}
                      {visibleColumns.desc && (
                        <ResizableTableHead columnId="desc" minWidth={100}>Описание</ResizableTableHead>
                      )}
                      {visibleColumns.source && (
                        <ResizableTableHead columnId="source" minWidth={80}>Источник</ResizableTableHead>
                      )}
                      {visibleColumns.unit && (
                        <ResizableTableHead columnId="unit" minWidth={60}>Ед.</ResizableTableHead>
                      )}
                      {visibleColumns.type && (
                        <ResizableTableHead columnId="type" minWidth={70}>Вид</ResizableTableHead>
                      )}
                      {visibleColumns.volume && (
                        <ResizableTableHead columnId="volume" minWidth={70}>Объем</ResizableTableHead>
                      )}
                      {visibleColumns.cost && (
                        <ResizableTableHead columnId="cost" minWidth={70}>Себест.</ResizableTableHead>
                      )}
                      {visibleColumns.groups && (
                        <ResizableTableHead columnId="groups" minWidth={100}>Группа</ResizableTableHead>
                      )}
                      {visibleColumns.catalogs && (
                        <ResizableTableHead columnId="catalogs" minWidth={120} data-onboarding="catalog-column-header">Прайс-листы</ResizableTableHead>
                      )}
                      {visibleColumns.sync && (
                        <ResizableTableHead columnId="sync" minWidth={50} resizable={false}>
                          <RefreshCw className="h-3.5 w-3.5" />
                        </ResizableTableHead>
                      )}
                    </ResizableTableRow>
                    {/* Row 2: Filters */}
                    <ResizableTableRow className="h-6 border-b-0">
                      {visibleColumns.drag && (
                        <ResizableTableHead columnId="drag" minWidth={32} resizable={false}></ResizableTableHead>
                      )}
                      {visibleColumns.checkbox && (
                        <ResizableTableHead columnId="checkbox" minWidth={40} resizable={false}></ResizableTableHead>
                      )}
                      {visibleColumns.photo && (
                        <ResizableTableHead columnId="photo" minWidth={50} resizable={false}></ResizableTableHead>
                      )}
                      {visibleColumns.name && (
                        <ResizableTableHead columnId="name" minWidth={120} resizable={false}>
                          <ColumnFilter 
                            value={allProductsFilters.name} 
                            onChange={(v) => setAllProductsFilters(f => ({...f, name: v}))}
                            placeholder="Поиск..."
                          />
                        </ResizableTableHead>
                      )}
                      {visibleColumns.desc && (
                        <ResizableTableHead columnId="desc" minWidth={100} resizable={false}>
                          <ColumnFilter 
                            value={allProductsFilters.desc} 
                            onChange={(v) => setAllProductsFilters(f => ({...f, desc: v}))}
                            placeholder="Поиск..."
                          />
                        </ResizableTableHead>
                      )}
                      {visibleColumns.source && (
                        <ResizableTableHead columnId="source" minWidth={80} resizable={false}>
                          <SelectFilter
                            value={allProductsFilters.source}
                            onChange={(v) => setAllProductsFilters(f => ({...f, source: v}))}
                            options={[
                              { value: "moysklad", label: "МС" },
                              { value: "local", label: "Лок" },
                            ]}
                            placeholder="Все"
                          />
                        </ResizableTableHead>
                      )}
                      {visibleColumns.unit && (
                        <ResizableTableHead columnId="unit" minWidth={60} resizable={false}>
                          <SelectFilter
                            value={allProductsFilters.unit}
                            onChange={(v) => setAllProductsFilters(f => ({...f, unit: v}))}
                            options={[
                              { value: "кг", label: "кг" },
                              { value: "шт", label: "шт" },
                              { value: "л", label: "л" },
                              { value: "уп", label: "уп" },
                            ]}
                            placeholder="Все"
                          />
                        </ResizableTableHead>
                      )}
                      {visibleColumns.type && (
                        <ResizableTableHead columnId="type" minWidth={70} resizable={false}>
                          <SelectFilter
                            value={allProductsFilters.type}
                            onChange={(v) => setAllProductsFilters(f => ({...f, type: v}))}
                            options={[
                              { value: "weight", label: "Вес" },
                              { value: "piece", label: "Шт" },
                            ]}
                            placeholder="Все"
                          />
                        </ResizableTableHead>
                      )}
                      {visibleColumns.volume && (
                        <ResizableTableHead columnId="volume" minWidth={70} resizable={false}>
                          <ColumnFilter 
                            value={allProductsFilters.volume} 
                            onChange={(v) => setAllProductsFilters(f => ({...f, volume: v}))}
                            placeholder="Поиск..."
                          />
                        </ResizableTableHead>
                      )}
                      {visibleColumns.cost && (
                        <ResizableTableHead columnId="cost" minWidth={70} resizable={false}>
                          <ColumnFilter 
                            value={allProductsFilters.cost} 
                            onChange={(v) => setAllProductsFilters(f => ({...f, cost: v}))}
                            placeholder="Поиск..."
                          />
                        </ResizableTableHead>
                      )}
                      {visibleColumns.groups && (
                        <ResizableTableHead columnId="groups" minWidth={100} resizable={false}>
                          <MultiSelectFilter
                            values={allProductsFilters.groups}
                            onChange={(v) => setAllProductsFilters(f => ({...f, groups: v}))}
                            options={[
                              { value: "none", label: "Без группы" },
                              ...productGroups.map(g => ({ value: g.id, label: g.name }))
                            ]}
                            placeholder="Все"
                          />
                        </ResizableTableHead>
                      )}
                      {visibleColumns.catalogs && (
                        <ResizableTableHead columnId="catalogs" minWidth={120} resizable={false}></ResizableTableHead>
                      )}
                      {visibleColumns.sync && (
                        <ResizableTableHead columnId="sync" minWidth={50} resizable={false}>
                          <SelectFilter
                            value={allProductsFilters.sync}
                            onChange={(v) => setAllProductsFilters(f => ({...f, sync: v}))}
                            options={[
                              { value: "synced", label: "Да" },
                              { value: "notSynced", label: "Нет" },
                            ]}
                            placeholder="Все"
                          />
                        </ResizableTableHead>
                      )}
                    </ResizableTableRow>
                  </ResizableTableHeader>
                  <SortableTableBody>
                    {filteredAllProducts.map((product) => {
                      const salePrice = getProductSalePrice(product);
                      const packagingPrices = calculatePackagingPrices(
                        salePrice,
                        product.unitWeight,
                        product.packagingType,
                        product.customVariantPrices
                      );
                      
                      // Define all cells with their column IDs
                      const cellsMap: Record<string, React.ReactNode> = {
                        checkbox: (
                          <ResizableTableCell key="checkbox" columnId="checkbox">
                            <Checkbox
                              checked={selectedBulkProducts.has(product.id)}
                              onCheckedChange={() => toggleBulkProductSelection(product.id)}
                            />
                          </ResizableTableCell>
                        ),
                        photo: (
                          <ResizableTableCell key="photo" columnId="photo">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-auto px-1 gap-1 flex items-center"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setExpandedAssortmentImages(
                                  expandedAssortmentImages === product.id ? null : product.id
                                );
                              }}
                            >
                              {product.image ? (
                                <img
                                  src={product.image}
                                  alt={product.name}
                                  className="w-6 h-6 rounded object-cover flex-shrink-0"
                                />
                              ) : (
                                <div className="w-6 h-6 rounded bg-muted flex items-center justify-center flex-shrink-0 hover:bg-primary/10 transition-colors">
                                  <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                                </div>
                              )}
                              {product.images && product.images.length > 0 && (
                                <Badge variant="secondary" className="text-[10px] px-1 py-0">
                                  {product.images.length}
                                </Badge>
                              )}
                              {expandedAssortmentImages === product.id ? (
                                <ChevronUp className="h-3 w-3 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-3 w-3 text-muted-foreground" />
                              )}
                            </Button>
                          </ResizableTableCell>
                        ),
                        name: (
                          <ResizableTableCell key="name" columnId="name">
                            <InlineEditableCell
                              value={product.name}
                              onSave={(newName) => updateProduct({ ...product, name: newName })}
                              placeholder="Название"
                            />
                          </ResizableTableCell>
                        ),
                        desc: (
                          <ResizableTableCell key="desc" columnId="desc">
                            <InlineEditableCell
                              value={product.description || ""}
                              onSave={(newDesc) => updateProduct({ ...product, description: newDesc })}
                              placeholder="Описание..."
                              className="text-muted-foreground"
                            />
                          </ResizableTableCell>
                        ),
                        source: (
                          <ResizableTableCell key="source" columnId="source">
                            {product.source === "moysklad" ? (
                              <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800 whitespace-nowrap">
                                МС
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] whitespace-nowrap">
                                Лок
                              </Badge>
                            )}
                          </ResizableTableCell>
                        ),
                        unit: (
                          <ResizableTableCell key="unit" columnId="unit">
                            <InlineSelectCell
                              value={product.unit}
                              options={allUnitOptions}
                              onSave={(newUnit) => updateProduct({ ...product, unit: newUnit })}
                              onAddOption={(newUnit) => setCustomUnits(prev => [...prev, newUnit])}
                              addNewPlaceholder="Ед..."
                            />
                          </ResizableTableCell>
                        ),
                        type: (
                          <ResizableTableCell key="type" columnId="type">
                            <InlineSelectCell
                              value={product.packagingType || (product.productType === "weight" ? "head" : "piece")}
                              options={allPackagingOptions}
                              onSave={(newType) => updateProduct({ ...product, packagingType: newType as PackagingType })}
                              onAddOption={(newType) => setCustomPackagingTypes(prev => [...prev, newType])}
                              addNewPlaceholder="Вид..."
                            />
                          </ResizableTableCell>
                        ),
                        volume: (
                          <ResizableTableCell key="volume" columnId="volume">
                            <InlinePriceCell
                              value={product.unitWeight}
                              onSave={(newVolume) => updateProduct({ ...product, unitWeight: newVolume })}
                              placeholder="0"
                              suffix={product.unit}
                            />
                          </ResizableTableCell>
                        ),
                        cost: (
                          <ResizableTableCell key="cost" columnId="cost">
                            <InlinePriceCell
                              value={product.buyPrice}
                              onSave={(newPrice) => updateProduct({ ...product, buyPrice: newPrice })}
                              placeholder="0"
                            />
                          </ResizableTableCell>
                        ),
                        groups: (
                          <ResizableTableCell key="groups" columnId="groups">
                            <InlineMultiSelectCell
                              values={getProductGroupIds(product.id)}
                              options={productGroups.map(g => ({ value: g.id, label: g.name }))}
                              onSave={(selectedIds) => {
                                setProductGroupAssignments(product.id, selectedIds);
                              }}
                              onAddOption={async (newGroupName) => {
                                const newGroup = await createProductGroup(newGroupName);
                                if (newGroup) {
                                  return newGroup.id;
                                }
                                return null;
                              }}
                              placeholder="Группа..."
                              addNewPlaceholder="Новая группа..."
                              allowAddNew={true}
                            />
                          </ResizableTableCell>
                        ),
                        catalogs: (
                          <ResizableTableCell key="catalogs" columnId="catalogs">
                            <InlineMultiSelectCell
                              values={Array.from(productCatalogVisibility[product.id] || [])}
                              options={catalogs.map(c => ({ value: c.id, label: c.name }))}
                              onSave={(selectedIds) => {
                                const currentSet = productCatalogVisibility[product.id] || new Set();
                                const newSet = new Set(selectedIds);
                                
                                // Find added and removed
                                selectedIds.forEach(id => {
                                  if (!currentSet.has(id)) {
                                    toggleProductCatalogVisibility(product.id, id);
                                  }
                                });
                                currentSet.forEach(id => {
                                  if (!newSet.has(id)) {
                                    toggleProductCatalogVisibility(product.id, id);
                                  }
                                });
                              }}
                              onAddOption={async (newCatalogName) => {
                                const newCatalog = await createSupabaseCatalog(newCatalogName);
                                if (newCatalog) {
                                  return newCatalog.id;
                                }
                                return null;
                              }}
                              onNavigate={(catalogId) => {
                                const supabaseCatalog = supabaseCatalogs.find(c => c.id === catalogId);
                                if (supabaseCatalog) {
                                  // Navigate to catalogs section within admin panel
                                  handleSectionChange("catalogs");
                                  // Open this specific catalog
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
                              placeholder="Выбрать..."
                              addNewPlaceholder="Новый прайс-лист..."
                              addNewButtonLabel="Создать прайс-лист"
                              allowAddNew={true}
                              emptyStateMessage="Нет прайс-листов"
                              showNavigateOnboardingHint={
                                supabaseProducts.length > 0 && 
                                catalogs.length > 0 && 
                                Object.values(productCatalogVisibility).some(cats => cats.size > 0) &&
                                (productCatalogVisibility[product.id]?.size || 0) > 0 &&
                                !supabaseProducts.some(p => p.buy_price && p.buy_price > 0)
                              }
                            />
                          </ResizableTableCell>
                        ),
                        sync: (
                          <ResizableTableCell key="sync" columnId="sync">
                            {product.source === "moysklad" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className={`h-6 w-6 ${product.autoSync ? "text-primary" : "text-muted-foreground"}`}
                                onClick={() => toggleAutoSync(product.id)}
                                title={product.autoSync ? "Синхр. вкл" : "Синхр. выкл"}
                              >
                                {product.autoSync ? (
                                  <Lock className="h-3 w-3" />
                                ) : (
                                  <Unlock className="h-3 w-3" />
                                )}
                              </Button>
                            )}
                          </ResizableTableCell>
                        ),
                      };
                      
                      return (
                        <React.Fragment key={product.id}>
                          <SortableTableRow id={product.id}>
                            <OrderedCellsContainer 
                              cells={cellsMap} 
                              fixedStart={["drag", "checkbox"]}
                              fixedEnd={["sync"]}
                              visibleColumns={visibleColumns}
                            />
                          </SortableTableRow>
                          {/* Expanded images row */}
                          {expandedAssortmentImages === product.id && (
                            <TableRow className="bg-muted/30 hover:bg-muted/50">
                              <TableCell colSpan={13} className="py-3 px-4">
                                <ImageGalleryViewer
                                  images={product.images || []}
                                  productName={product.name}
                                  productId={product.id}
                                  onDeleteImage={(index) => handleDeleteProductImage(product.id, index)}
                                  onAddImages={(files, source) => handleAddProductImages(product.id, files, source)}
                                  onSetMainImage={(index) => handleSetMainImage(product.id, index)}
                                  isDeleting={deletingImageProductId === product.id}
                                  isUploading={uploadingImageProductId === product.id}
                                />
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </SortableTableBody>
                </ResizableTable>
                </DraggableTableWrapper>
              </div>

              {/* Product Pricing Dialog */}
              <ProductPricingDialog
                product={editingProduct}
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                onSave={updateProduct}
              />
            </>
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

              {importView === "catalog" && currentAccount && (
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

                  {/* Sync Settings Panel */}
                  <SyncSettingsPanel
                    settings={syncSettings}
                    onSettingsChange={handleSyncSettingsChange}
                    onSyncNow={handleSyncNow}
                    isSyncing={isSyncing}
                    syncedProductsCount={importedProducts.filter(p => p.autoSync).length}
                    syncOrdersEnabled={supabaseSyncSettings?.sync_orders_enabled}
                    onNavigateToOrderSettings={() => {
                      setActiveSection('orders');
                      setShowOrderNotificationsPanel(true);
                      setSelectedNotificationChannel('moysklad');
                    }}
                  />

                  {isLoading && moyskladProducts.length === 0 ? (
                    <div className="bg-card rounded-lg border border-border p-8 text-center">
                      <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin mb-4" />
                      <p className="text-muted-foreground">Загрузка товаров...</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-2 px-1">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                          <span className="text-xs text-muted-foreground font-medium">
                            {filteredMoyskladProducts.length}
                          </span>
                        </div>
                        <div className="flex items-center gap-0.5">
                          <Button
                            onClick={() => fetchMoySkladProducts()}
                            disabled={isLoading}
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Обновить список"
                          >
                            {isLoading ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3.5 w-3.5" />
                            )}
                          </Button>
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
                              <TableHead>Цена продажи</TableHead>
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
                                      {product.price > 0 ? formatPrice(product.price) : "-"}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                      {product.buyPrice > 0 ? formatPrice(product.buyPrice) : "-"}
                                    </TableCell>
                                    <TableCell>
                                      <Badge
                                        variant={product.quantity > 0 || product.stock > 0 ? "default" : "secondary"}
                                        className={`text-xs ${
                                          product.quantity > 0 || product.stock > 0
                                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                                            : "bg-muted text-muted-foreground"
                                        }`}
                                      >
                                        {product.quantity || product.stock || 0}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                      {product.uom || "-"}
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

                  {/* Onboarding Step 7: Price list link explanation - show when step 6 is complete */}
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
                    
                    // Step 6 is complete when all portion data is filled
                    const step6Complete = hasVolume && hasHalfPrice && hasQuarterPrice;
                    
                    // Show step 7 only when step 6 is complete and step 7 hasn't been dismissed
                    const shouldShowStep7 = supabaseProducts.length > 0 && catalogs.length > 0 && 
                      Object.values(productCatalogVisibility).some(cats => cats.size > 0) && 
                      hasBuyPrice && hasMarkup && step6Complete && onboardingStep7Visible;
                    
                    if (!shouldShowStep7) return null;
                    
                    return (
                      <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 mb-3">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                            <span className="text-primary font-bold text-sm">7</span>
                          </div>
                          <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                              <Link2 className="h-5 w-5 text-primary" />
                              <p className="text-sm font-medium text-foreground">Это ссылка на ваш прайс-лист</p>
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">
                              🔗 Каждый прайс-лист имеет уникальную ссылку
                            </p>
                            <p className="text-xs text-muted-foreground mb-3">
                              При переходе покупатель регистрируется и видит каталог строго с ценами этого прайс-листа. Он сможет оформить заказ по своим ценам.
                            </p>
                            <Button
                              size="sm"
                              onClick={() => {
                                // Highlight the link button
                                const linkButton = document.querySelector('[data-onboarding-link-button]');
                                if (linkButton) {
                                  linkButton.classList.add('animate-pulse', 'bg-primary/20', 'ring-2', 'ring-primary', 'ring-offset-2');
                                  setTimeout(() => {
                                    linkButton.classList.remove('animate-pulse', 'bg-primary/20', 'ring-2', 'ring-primary', 'ring-offset-2');
                                  }, 3000);
                                }
                                setOnboardingStep7Visible(false);
                                setOnboardingStep8Visible(true);
                              }}
                            >
                              Я понял. Продолжить
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Onboarding Step 8: Go to Storefront */}
                  {onboardingStep8Visible && (
                    <div 
                      className="bg-primary/10 border border-primary/30 rounded-lg p-4 mb-3 cursor-pointer hover:bg-primary/15 transition-colors"
                      onClick={() => {
                        // Highlight the storefront button in WorkspaceHeader
                        const storefrontButton = document.querySelector('[data-onboarding-storefront-button]');
                        if (storefrontButton) {
                          storefrontButton.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                          storefrontButton.classList.add('animate-pulse', 'ring-2', 'ring-primary', 'ring-offset-2', 'bg-primary/20');
                          setTimeout(() => {
                            storefrontButton.classList.remove('animate-pulse', 'ring-2', 'ring-primary', 'ring-offset-2', 'bg-primary/20');
                          }, 3000);
                        }
                        // Trigger step 9 and switch to storefront
                        setOnboardingStep8Visible(false);
                        if (onTriggerOnboardingStep9) {
                          onTriggerOnboardingStep9();
                        }
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                          <span className="text-primary font-bold text-sm">8</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Store className="h-4 w-4 text-primary" />
                            <p className="text-sm font-medium text-foreground">Перейдите в раздел "Витрина"</p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            В разделе "Витрина" можно просматривать свои прайс-листы и визуально ими управлять. Нажмите сюда, чтобы перейти.
                          </p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-primary" />
                      </div>
                    </div>
                  )}

                  <div className="mb-4">
                    <Input
                      type="text"
                      placeholder="Поиск товаров..."
                      value={catalogProductSearch}
                      onChange={(e) => setCatalogProductSearch(e.target.value)}
                      className="max-w-sm"
                    />
                  </div>

                  {/* Bulk Edit Panel for catalog products */}
                  <BulkEditPanel
                    selectedCount={selectedCatalogBulkProducts.size}
                    onClearSelection={() => setSelectedCatalogBulkProducts(new Set())}
                    onBulkUpdate={(updates) => {
                      selectedCatalogBulkProducts.forEach(productId => {
                        const product = allProducts.find(p => p.id === productId);
                        if (product) {
                          updateProduct({ ...product, ...updates });
                        }
                      });
                      setSelectedCatalogBulkProducts(new Set());
                      toast({
                        title: "Товары обновлены",
                        description: `Обновлено ${selectedCatalogBulkProducts.size} товаров`,
                      });
                    }}
                    unitOptions={allUnitOptions}
                    packagingOptions={allPackagingOptions}
                    showDelete={false}
                  />

                  <p className="text-xs text-muted-foreground mb-2">
                    * Фото, название, описание, ед. изм., объём и вид синхронизируются из ассортимента. Категории, наценка и цены порций — индивидуальны для каждого прайс-листа. Статус синхронизируется с витриной.
                  </p>
                  <div className="bg-card rounded-lg border border-border overflow-x-auto">
                    <ResizableTable
                      storageKey="catalog-products-table"
                      columns={[
                        ...(catalogVisibleColumns.bulkCheckbox ? [{ id: "bulkCheckbox", minWidth: 40, defaultWidth: 40 }] : []),
                        ...(catalogVisibleColumns.photo ? [{ id: "photo", minWidth: 50, defaultWidth: 60 }] : []),
                        ...(catalogVisibleColumns.name ? [{ id: "name", minWidth: 120, defaultWidth: 180 }] : []),
                        ...(catalogVisibleColumns.description ? [{ id: "description", minWidth: 100, defaultWidth: 200 }] : []),
                        ...(catalogVisibleColumns.categories ? [{ id: "categories", minWidth: 100, defaultWidth: 140 }] : []),
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
                          {catalogVisibleColumns.name && <ResizableTableHead columnId="name">Название</ResizableTableHead>}
                          {catalogVisibleColumns.description && <ResizableTableHead columnId="description">Описание</ResizableTableHead>}
                          {catalogVisibleColumns.categories && <ResizableTableHead columnId="categories">Категории</ResizableTableHead>}
                          {catalogVisibleColumns.unit && <ResizableTableHead columnId="unit">Ед. изм.</ResizableTableHead>}
                          {catalogVisibleColumns.volume && <ResizableTableHead columnId="volume">Объем</ResizableTableHead>}
                          {catalogVisibleColumns.type && <ResizableTableHead columnId="type">Вид</ResizableTableHead>}
                          {catalogVisibleColumns.buyPrice && <ResizableTableHead columnId="buyPrice">Себест-ть</ResizableTableHead>}
                          {catalogVisibleColumns.markup && <ResizableTableHead columnId="markup">Наценка</ResizableTableHead>}
                          {catalogVisibleColumns.price && <ResizableTableHead columnId="price">Цена</ResizableTableHead>}
                          {catalogVisibleColumns.priceFull && <ResizableTableHead columnId="priceFull">Целая</ResizableTableHead>}
                          {catalogVisibleColumns.priceHalf && <ResizableTableHead columnId="priceHalf">½</ResizableTableHead>}
                          {catalogVisibleColumns.priceQuarter && <ResizableTableHead columnId="priceQuarter">¼</ResizableTableHead>}
                          {catalogVisibleColumns.pricePortion && <ResizableTableHead columnId="pricePortion">Порция</ResizableTableHead>}
                          {catalogVisibleColumns.status && <ResizableTableHead columnId="status">Статус</ResizableTableHead>}
                        </ResizableTableRow>
                      </ResizableTableHeader>
                      <ResizableTableBody>
                        {allProducts
                          .filter(p => selectedCatalogProducts.has(p.id))
                          .filter(p => !catalogProductSearch || p.name.toLowerCase().includes(catalogProductSearch.toLowerCase()))
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
                              <ResizableTableRow
                                key={product.id}
                                className={`${selectedCatalogProducts.has(product.id) ? "bg-primary/5" : ""} ${selectedCatalogBulkProducts.has(product.id) ? "bg-primary/10" : ""}`}
                              >
                                {catalogVisibleColumns.bulkCheckbox && (
                                  <ResizableTableCell columnId="bulkCheckbox">
                                    <Checkbox
                                      checked={selectedCatalogBulkProducts.has(product.id)}
                                      onCheckedChange={() => {
                                        setSelectedCatalogBulkProducts(prev => {
                                          const newSet = new Set(prev);
                                          if (newSet.has(product.id)) {
                                            newSet.delete(product.id);
                                          } else {
                                            newSet.add(product.id);
                                          }
                                          return newSet;
                                        });
                                      }}
                                    />
                                  </ResizableTableCell>
                                )}
                                {/* Фото - из ассортимента (только чтение) */}
                                {catalogVisibleColumns.photo && (
                                  <ResizableTableCell columnId="photo">
                                    <img
                                      src={product.image}
                                      alt={baseName}
                                      className="w-10 h-10 rounded object-cover"
                                    />
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
                                      onReorder={() => setCategoryOrderDialogOpen(true)}
                                      placeholder="Категории..."
                                      addNewPlaceholder="Новая категория..."
                                      addNewButtonLabel="Создать категорию"
                                      allowAddNew={true}
                                      showReorderButton={true}
                                    />
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
                                    <span className="text-xs">{formatPrice(salePrice)}/{baseUnit}</span>
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
                              </ResizableTableRow>
                            );
                          })}
                      </ResizableTableBody>
                    </ResizableTable>
                  </div>
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
            <StoreCustomersTable storeId={effectiveStoreId} />
          )}

          {effectiveStoreId && activeSection === "orders" && (
            <>
              <div className="mb-4">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h2 className="text-xl font-semibold text-foreground">Заказы</h2>
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
                            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                              <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                                Подключение Telegram-уведомлений
                              </p>
                              <p className="text-xs text-muted-foreground mb-3">
                                Нажмите кнопку ниже, чтобы открыть бота в Telegram. 
                                После нажатия «Start» вы начнете получать уведомления о новых заказах.
                              </p>
                              <div className="flex flex-col gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full"
                                  onClick={async () => {
                                    try {
                                      const response = await fetch(
                                        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-webhook?setup=true`
                                      );
                                      const result = await response.json();
                                      if (result.ok) {
                                        toast({
                                          title: "Telegram бот настроен",
                                          description: "Webhook успешно зарегистрирован. Теперь нажмите 'Открыть бота'.",
                                        });
                                      } else {
                                        throw new Error(result.description || "Ошибка настройки");
                                      }
                                    } catch (error: any) {
                                      toast({
                                        title: "Ошибка настройки",
                                        description: error.message,
                                        variant: "destructive",
                                      });
                                    }
                                  }}
                                >
                                  <Settings className="h-4 w-4 mr-2" />
                                  Настроить бота
                                </Button>
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
                            </div>
                            
                            {notificationContacts.telegram && (
                              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                                <Check className="h-4 w-4" />
                                <span>Telegram подключен (ID: {notificationContacts.telegram})</span>
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
                              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                                <p className="text-sm text-amber-800 dark:text-amber-200">
                                  ⚠️ Для отправки заказов в МойСклад сначала настройте подключение в разделе «Импорт товаров»
                                </p>
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
                                            fetchOrganizations();
                                            fetchCounterparties();
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
                                              onClick={() => fetchOrganizations()}
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
                                              onClick={() => fetchOrganizations()}
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
                                              onClick={() => fetchCounterparties()}
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
                                              onClick={() => fetchCounterparties()}
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

              {ordersLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : orders.length === 0 ? (
                <div className="bg-card rounded-lg border border-border p-8 text-center">
                  <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-medium text-foreground mb-2">Нет заказов</h3>
                  <p className="text-sm text-muted-foreground">
                    Заказы появятся здесь, когда покупатели оформят их через прайс-листы
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <Collapsible 
                      key={order.id} 
                      open={!collapsedOrders.has(order.id)}
                      onOpenChange={(open) => {
                        setCollapsedOrders(prev => {
                          const next = new Set(prev);
                          if (open) {
                            next.delete(order.id);
                          } else {
                            next.add(order.id);
                          }
                          return next;
                        });
                      }}
                      className="bg-card rounded-lg border border-border"
                    >
                      <CollapsibleTrigger asChild>
                        <button className="w-full p-3 sm:p-4 text-left hover:bg-muted/30 transition-colors">
                          {/* Mobile-first compact layout */}
                          <div className="flex items-center gap-3">
                            {/* Toggle icon */}
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-muted/50 flex items-center justify-center">
                              <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                            
                            {/* Main content */}
                            <div className="flex-1 min-w-0">
                              {/* Top row: status + price */}
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <Badge 
                                  variant={
                                    order.status === 'delivered' ? 'default' :
                                    order.status === 'cancelled' ? 'destructive' :
                                    order.status === 'shipped' ? 'secondary' :
                                    'outline'
                                  }
                                  className={`text-[10px] px-1.5 py-0 h-5 ${
                                    order.status === 'pending' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 border-amber-200' : ''
                                  }`}
                                >
                                  {order.status === 'pending' && 'Новый'}
                                  {order.status === 'processing' && 'В обработке'}
                                  {order.status === 'shipped' && 'Отправлен'}
                                  {order.status === 'delivered' && 'Доставлен'}
                                  {order.status === 'cancelled' && 'Отменён'}
                                </Badge>
                                <span className="font-bold text-base sm:text-lg tabular-nums whitespace-nowrap">
                                  {order.total.toLocaleString()} ₽
                                </span>
                              </div>
                              
                              {/* Middle row: order number + items count */}
                              <div className="flex items-center gap-2 text-xs sm:text-sm">
                                <span className="font-medium text-foreground truncate">
                                  {order.order_number}
                                </span>
                                {order.items && order.items.length > 0 && collapsedOrders.has(order.id) && (
                                  <span className="text-muted-foreground whitespace-nowrap">
                                    • {order.items.length} поз.
                                  </span>
                                )}
                              </div>
                              
                              {/* Bottom row: date + customer */}
                              <div className="flex items-center justify-between gap-2 mt-1 text-[11px] sm:text-xs text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3 flex-shrink-0" />
                                  <span>
                                    {new Date(order.created_at).toLocaleString('ru-RU', { 
                                      day: 'numeric', 
                                      month: 'short', 
                                      hour: '2-digit', 
                                      minute: '2-digit' 
                                    })}
                                  </span>
                                </div>
                                {order.customer_name && (
                                  <span className="truncate max-w-[120px] sm:max-w-[180px]">
                                    {order.customer_name}
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {/* Copy button */}
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopySellerOrder(order);
                              }}
                              className="flex-shrink-0 w-8 h-8 rounded-full bg-muted/50 hover:bg-muted flex items-center justify-center cursor-pointer transition-colors"
                              title="Скопировать заказ"
                            >
                              <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                          </div>
                        </button>
                      </CollapsibleTrigger>
                      
                      <CollapsibleContent>
                        <div className="px-3 sm:px-4 pb-3 sm:pb-4">
                          {/* Order items - styled like cart */}
                          {order.items && order.items.length > 0 && (
                            <div className="border-t border-border pt-3 mb-3">
                              <div className="space-y-2.5">
                                {order.items.map((item) => (
                                  <div key={item.id} className="flex items-center gap-2">
                                    {/* Product info */}
                                    <div className="flex-1 min-w-0">
                                      <div className="font-medium text-sm">{item.product_name}</div>
                                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <span>{item.quantity} шт</span>
                                        <span>·</span>
                                        <span>{item.price.toLocaleString()} ₽/шт</span>
                                      </div>
                                    </div>
                                    
                                    {/* Total price */}
                                    <div className="text-right flex-shrink-0">
                                      <div className="font-bold text-sm text-primary tabular-nums">
                                        {item.total.toLocaleString()} ₽
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              
                              {/* Order summary */}
                              <div className="flex items-center justify-between mt-3 pt-3 border-t border-dashed border-border">
                                <span className="text-sm text-muted-foreground">
                                  Итого ({order.items.length} {order.items.length === 1 ? 'товар' : order.items.length < 5 ? 'товара' : 'товаров'})
                                </span>
                                <span className="font-bold text-base sm:text-lg">{order.total.toLocaleString()} ₽</span>
                              </div>
                            </div>
                          )}
                          
                          {/* Shipping address */}
                          {order.shipping_address && (
                            <div className="bg-muted/30 rounded-lg p-3 mb-3 text-sm">
                              <div className="flex items-start gap-2 mb-1.5">
                                <span className="text-muted-foreground">📍</span>
                                <span className="text-foreground">{order.shipping_address.address}</span>
                              </div>
                              {order.shipping_address.phone && (
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-muted-foreground">📱</span>
                                  <a href={`tel:${order.shipping_address.phone}`} className="text-primary hover:underline">
                                    {order.shipping_address.phone}
                                  </a>
                                </div>
                              )}
                              {order.shipping_address.comment && (
                                <div className="flex items-start gap-2 text-muted-foreground">
                                  <span>💬</span>
                                  <span className="italic">{order.shipping_address.comment}</span>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* Status change buttons */}
                          {(order.status === 'pending' || order.status === 'processing' || order.status === 'shipped') && (
                            <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                              {order.status === 'pending' && (
                                <>
                                  <Button size="sm" className="flex-1 sm:flex-none" onClick={() => updateOrderStatus(order.id, 'processing')}>
                                    <Check className="h-3 w-3 mr-1" />
                                    Принять
                                  </Button>
                                  <Button size="sm" variant="destructive" className="flex-1 sm:flex-none" onClick={() => updateOrderStatus(order.id, 'cancelled')}>
                                    <X className="h-3 w-3 mr-1" />
                                    Отменить
                                  </Button>
                                </>
                              )}
                              {order.status === 'processing' && (
                                <Button size="sm" className="flex-1 sm:flex-none" onClick={() => updateOrderStatus(order.id, 'shipped')}>
                                  <Package className="h-3 w-3 mr-1" />
                                  Отправить
                                </Button>
                              )}
                              {order.status === 'shipped' && (
                                <Button size="sm" className="flex-1 sm:flex-none" onClick={() => updateOrderStatus(order.id, 'delivered')}>
                                  <Check className="h-3 w-3 mr-1" />
                                  Доставлен
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>
              )}
            </>
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
                {/* Quick Start */}
                <div className="bg-card rounded-lg border border-border p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Package className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="font-semibold text-foreground">Быстрый старт</h3>
                    </div>
                    <Button
                      onClick={() => {
                        localStorage.setItem('seller_onboarding_step1', 'true');
                        if (onSwitchToStorefront) {
                          onSwitchToStorefront();
                        }
                      }}
                    >
                      Старт
                    </Button>
                  </div>
                </div>

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
        onOpenChange={setCategoryOrderDialogOpen}
        categories={storeCategories}
        onSave={async (orderedIds) => {
          await updateCategoryOrder(orderedIds);
          toast({
            title: "Порядок сохранён",
            description: "Порядок отображения категорий обновлён",
          });
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

      {/* Spotlight Onboarding Overlay */}
      <SpotlightOverlay
        steps={adminPanelSpotlightSteps}
        currentStep={spotlightStep}
        onStepComplete={nextSpotlightStep}
        onSkip={skipSpotlight}
        onClose={closeSpotlight}
        isActive={isSpotlightActive}
      />
    </div>
  );
}
