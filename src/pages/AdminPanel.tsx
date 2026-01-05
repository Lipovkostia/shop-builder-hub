import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { ArrowLeft, Package, Download, RefreshCw, Check, X, Loader2, Image as ImageIcon, LogIn, Lock, Unlock, ExternalLink, Filter, Plus, ChevronRight, Trash2, FolderOpen, Edit2, Settings, Users, Shield, ChevronDown, ChevronUp, Tag, Store } from "lucide-react";
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
import { CustomerRolesManager } from "@/components/admin/CustomerRolesManager";
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

const MOYSKLAD_ACCOUNTS_KEY = "moysklad_accounts";
const IMPORTED_PRODUCTS_KEY = "moysklad_imported_products";
const SYNC_SETTINGS_KEY = "moysklad_sync_settings";
const DELETED_MOYSKLAD_IDS_KEY = "moysklad_deleted_product_ids";

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

type ActiveSection = "products" | "import" | "catalogs" | "roles" | "visibility";
type ImportView = "accounts" | "catalog";
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

export default function AdminPanel() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { user, profile, isSuperAdmin, loading: authLoading } = useAuth();
  const isMobile = useIsMobile();

  // Note: We don't force auth redirect here - admin panel can be viewed without login
  // Auth is only required for specific actions like uploading images

  // Store context - for super admin switching
  const storeIdFromUrl = searchParams.get('storeId');
  const sectionFromUrl = searchParams.get('section');
  const [currentStoreId, setCurrentStoreId] = useState<string | null>(null);
  const [currentStoreName, setCurrentStoreName] = useState<string | null>(null);
  const [userStoreId, setUserStoreId] = useState<string | null>(null);
  
  const [activeSection, setActiveSection] = useState<ActiveSection>(() => {
    const section = searchParams.get('section');
    if (section === 'products' || section === 'import' || section === 'catalogs' || section === 'roles' || section === 'visibility') {
      return section;
    }
    return "products";
  });
  
  // Product visibility in catalogs state
  const [productCatalogVisibility, setProductCatalogVisibility] = useState<Record<string, Set<string>>>({});
  const [importView, setImportView] = useState<ImportView>("accounts");
  
  // MoySklad import state
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [moyskladProducts, setMoyskladProducts] = useState<MoySkladProduct[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [importedProducts, setImportedProducts] = useState<Product[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  
  // Multiple accounts support
  const [accounts, setAccounts] = useState<MoySkladAccount[]>([]);
  const [currentAccount, setCurrentAccount] = useState<MoySkladAccount | null>(null);
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
  });

  // Filters for MoySklad import table
  const [importFilters, setImportFilters] = useState({
    name: "",
    article: "",
    code: "",
    stock: "all",
  });

  // Catalogs state
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
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
  const [localTestProducts, setLocalTestProducts] = useState<Product[]>(testProducts);
  
  // Product order state for drag and drop
  const [productOrder, setProductOrder] = useState<string[]>([]);
  
  // Bulk selection state for products
  const [selectedBulkProducts, setSelectedBulkProducts] = useState<Set<string>>(new Set());

  // Column visibility state for products table
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    drag: true,
    sync: true,
    checkbox: true,
    photo: true,
    name: true,
    desc: true,
    source: true,
    unit: true,
    type: true,
    volume: true,
    cost: true,
  });

  const columnLabels: Record<string, string> = {
    drag: "⋮⋮",
    sync: "Синхр.",
    checkbox: "Выбор",
    photo: "Фото",
    name: "Название",
    desc: "Описание",
    source: "Источник",
    unit: "Ед.",
    type: "Вид",
    volume: "Объем",
    cost: "Себест.",
  };

  const toggleColumnVisibility = (columnId: string) => {
    setVisibleColumns(prev => ({ ...prev, [columnId]: !prev[columnId] }));
  };

  // Customer roles state
  const [customerRoles, setCustomerRoles] = useState<CustomerRole[]>([]);
  const [rolePricing, setRolePricing] = useState<RoleProductPricing[]>([]);

  // Custom options state (for units and packaging types added by user)
  const [customUnits, setCustomUnits] = useState<string[]>([]);
  const [customPackagingTypes, setCustomPackagingTypes] = useState<string[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([
    { id: "cheese", name: "Сыры" },
    { id: "meat", name: "Мясо" },
    { id: "fish", name: "Рыба" },
    { id: "dairy", name: "Молочные продукты" },
  ]);
  const [newCategoryName, setNewCategoryName] = useState("");

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

  // Determine which store context to use
  const effectiveStoreId = storeIdFromUrl || userStoreId;
  const isSuperAdminContext = !!storeIdFromUrl && isSuperAdmin;

  // Fetch user's own store or the store from URL (for super admin)
  useEffect(() => {
    const fetchStoreContext = async () => {
      if (!user || !profile) return;
      
      // If super admin with storeId in URL
      if (storeIdFromUrl && isSuperAdmin) {
        const { data: store } = await supabase
          .from('stores')
          .select('id, name')
          .eq('id', storeIdFromUrl)
          .single();
        
        if (store) {
          setCurrentStoreId(store.id);
          setCurrentStoreName(store.name);
          
          // Set section if provided
          if (sectionFromUrl === 'products') {
            setActiveSection('products');
          } else if (sectionFromUrl === 'customers') {
            setActiveSection('roles'); // Customers section
          }
        }
      } else if (profile.role === 'seller') {
        // Fetch seller's own store
        const { data: store } = await supabase
          .from('stores')
          .select('id, name')
          .eq('owner_id', profile.id)
          .single();
        
        if (store) {
          setUserStoreId(store.id);
          setCurrentStoreId(store.id);
          setCurrentStoreName(store.name);
        }
      }
    };
    
    fetchStoreContext();
  }, [user, profile, storeIdFromUrl, isSuperAdmin, sectionFromUrl]);

  // Handle section change with URL update
  const handleSectionChange = useCallback((section: ActiveSection) => {
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

  // Load saved accounts, imported products, and catalogs on mount
  useEffect(() => {
    const savedAccounts = localStorage.getItem(MOYSKLAD_ACCOUNTS_KEY);
    if (savedAccounts) {
      try {
        setAccounts(JSON.parse(savedAccounts));
      } catch (e) {
        console.error("Failed to parse saved accounts");
      }
    }
    
    const savedProducts = localStorage.getItem(IMPORTED_PRODUCTS_KEY);
    if (savedProducts) {
      try {
        setImportedProducts(JSON.parse(savedProducts));
      } catch (e) {
        console.error("Failed to parse saved products");
      }
    }

    const savedCatalogs = localStorage.getItem(CATALOGS_KEY);
    if (savedCatalogs) {
      try {
        setCatalogs(JSON.parse(savedCatalogs));
      } catch (e) {
        console.error("Failed to parse saved catalogs");
      }
    }
  }, []);

  // Save accounts to localStorage
  useEffect(() => {
    if (accounts.length > 0) {
      localStorage.setItem(MOYSKLAD_ACCOUNTS_KEY, JSON.stringify(accounts));
    }
  }, [accounts]);

  // Save imported products to localStorage whenever they change
  useEffect(() => {
    if (importedProducts.length > 0) {
      localStorage.setItem(IMPORTED_PRODUCTS_KEY, JSON.stringify(importedProducts));
    }
  }, [importedProducts]);

  // Save catalogs to localStorage
  useEffect(() => {
    localStorage.setItem(CATALOGS_KEY, JSON.stringify(catalogs));
  }, [catalogs]);

  // Load sync settings from localStorage
  useEffect(() => {
    const savedSyncSettings = localStorage.getItem(SYNC_SETTINGS_KEY);
    if (savedSyncSettings) {
      try {
        setSyncSettings(JSON.parse(savedSyncSettings));
      } catch (e) {
        console.error("Failed to parse saved sync settings");
      }
    }
  }, []);

  // Save sync settings to localStorage
  useEffect(() => {
    localStorage.setItem(SYNC_SETTINGS_KEY, JSON.stringify(syncSettings));
  }, [syncSettings]);

  // Load deleted MoySklad IDs from localStorage
  useEffect(() => {
    const savedDeletedIds = localStorage.getItem(DELETED_MOYSKLAD_IDS_KEY);
    if (savedDeletedIds) {
      try {
        setDeletedMoyskladIds(new Set(JSON.parse(savedDeletedIds)));
      } catch (e) {
        console.error("Failed to parse saved deleted MoySklad IDs");
      }
    }
  }, []);

  // Save deleted MoySklad IDs to localStorage
  useEffect(() => {
    if (deletedMoyskladIds.size > 0) {
      localStorage.setItem(DELETED_MOYSKLAD_IDS_KEY, JSON.stringify(Array.from(deletedMoyskladIds)));
    }
  }, [deletedMoyskladIds]);

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

  // Toggle product visibility in a catalog
  const toggleProductCatalogVisibility = (productId: string, catalogId: string) => {
    // Update local visibility state
    setProductCatalogVisibility(prev => {
      const newVisibility = { ...prev };
      if (!newVisibility[productId]) {
        newVisibility[productId] = new Set();
      }
      const productCatalogs = new Set(newVisibility[productId]);
      if (productCatalogs.has(catalogId)) {
        productCatalogs.delete(catalogId);
      } else {
        productCatalogs.add(catalogId);
      }
      newVisibility[productId] = productCatalogs;
      return newVisibility;
    });

    // Update catalogs state
    setCatalogs(prev => prev.map(catalog => {
      if (catalog.id !== catalogId) return catalog;
      const hasProduct = catalog.productIds.includes(productId);
      if (hasProduct) {
        return { ...catalog, productIds: catalog.productIds.filter(id => id !== productId) };
      } else {
        return { ...catalog, productIds: [...catalog.productIds, productId] };
      }
    }));
  };

  // Save all products to localStorage for TestStore
  // Images from Storage (URLs) are saved, but base64 images are excluded to avoid quota issues
  useEffect(() => {
    const allProductsData = [...localTestProducts, ...importedProducts].map(p => {
      // Keep images if they are URLs (from Storage), exclude if they are base64
      const filteredImages = p.images?.filter(img => !img.startsWith('data:'));
      const filteredImage = p.image?.startsWith('data:') ? undefined : p.image;
      const filteredImageFull = p.imageFull?.startsWith('data:') ? undefined : p.imageFull;
      return { 
        ...p, 
        images: filteredImages?.length ? filteredImages : undefined,
        image: filteredImage,
        imageFull: filteredImageFull,
      };
    });
    try {
      localStorage.setItem("admin_all_products", JSON.stringify(allProductsData));
    } catch (e) {
      console.warn("Failed to save products to localStorage:", e);
    }
  }, [localTestProducts, importedProducts]);

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

      const newProduct: Product = {
        id: `ms_${msProduct.id}`,
        name: msProduct.name,
        description: msProduct.description || "",
        pricePerUnit: msProduct.price || 0,
        buyPrice: msProduct.buyPrice,
        unit: msProduct.uom || "кг",
        image: imageUrl,
        imageFull: imageFullUrl,
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
        autoSync: true, // Enable auto-sync by default when linking
        accountId: currentAccount.id,
      };

      // Replace existing product with same moyskladId instead of adding duplicate
      setImportedProducts(prev => {
        const filtered = prev.filter(p => p.moyskladId !== msProduct.id);
        return [...filtered, newProduct];
      });
      
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
      
      toast({
        title: "Товар связан",
        description: `${msProduct.name} добавлен с авто-синхронизацией`,
      });
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
    const productsToSync = importedProducts.filter(p => p.autoSync && p.moyskladId);
    if (productsToSync.length === 0) return;

    const mapping = fieldMapping || syncSettings.fieldMapping;

    // Group products by account
    const productsByAccount = productsToSync.reduce((acc, p) => {
      const accountId = p.accountId || '';
      if (!acc[accountId]) acc[accountId] = [];
      acc[accountId].push(p);
      return acc;
    }, {} as Record<string, Product[]>);

    setIsSyncing(true);
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
          
          setImportedProducts(prev => prev.map(product => {
            if (product.autoSync && product.moyskladId && product.accountId === accountId) {
              const msProduct = msProductsMap.get(product.moyskladId) as MoySkladProduct | undefined;
              if (msProduct) {
                const updates: Partial<Product> = {};
                
                // Apply field mapping
                if (mapping.buyPrice && msProduct.buyPrice !== undefined) {
                  updates.buyPrice = msProduct.buyPrice;
                }
                if (mapping.price && msProduct.price !== undefined) {
                  updates.pricePerUnit = msProduct.price;
                }
                if (mapping.quantity) {
                  updates.inStock = msProduct.quantity > 0 || msProduct.stock > 0;
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
                
                return { ...product, ...updates };
              }
            }
            return product;
          }));
        }
      }

      // Update last sync time
      setSyncSettings(prev => ({
        ...prev,
        lastSyncTime: new Date().toISOString(),
        nextSyncTime: prev.enabled 
          ? new Date(Date.now() + prev.intervalMinutes * 60000).toISOString()
          : undefined,
      }));

      toast({
        title: "Синхронизация завершена",
        description: `Обновлено ${productsToSync.length} товаров`,
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

  // Toggle auto-sync for a product
  const toggleAutoSync = (productId: string) => {
    setImportedProducts(prev => prev.map(product => 
      product.id === productId 
        ? { ...product, autoSync: !product.autoSync }
        : product
    ));
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
        
        // Update in state
        if (product.source === "moysklad") {
          setImportedProducts(prev => prev.map(p => 
            p.id === productId ? { ...p, images: newImages } : p
          ));
        } else {
          setLocalTestProducts(prev => prev.map(p => 
            p.id === productId ? { ...p, images: newImages } : p
          ));
        }

        // Note: Database sync happens through localStorage persistence

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
      
      // Update in state
      if (product.source === "moysklad") {
        setImportedProducts(prev => prev.map(p => 
          p.id === productId ? { ...p, images: updatedImages } : p
        ));
      } else {
        setLocalTestProducts(prev => prev.map(p => 
          p.id === productId ? { ...p, images: updatedImages } : p
        ));
      }

      // Note: Database sync happens through localStorage persistence

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

    // Update the main image and imageFull
    const updatedProduct = {
      ...product,
      images: newImages,
      image: newImages[0],
      imageFull: newImages[0],
      syncedMoyskladImages: newSyncedImages,
    };

    // Update in state
    if (product.source === "moysklad") {
      setImportedProducts(prev => prev.map(p => 
        p.id === productId ? updatedProduct : p
      ));
    } else {
      setLocalTestProducts(prev => prev.map(p => 
        p.id === productId ? updatedProduct : p
      ));
    }

    toast({
      title: "Главное фото изменено",
      description: "Выбранное фото теперь отображается первым",
    });
  };

  // Catalog management functions
  const createCatalog = () => {
    if (!newCatalogName.trim()) {
      toast({
        title: "Ошибка",
        description: "Введите название прайс-листа",
        variant: "destructive",
      });
      return;
    }

    const newCatalog: Catalog = {
      id: `catalog_${Date.now()}`,
      name: newCatalogName.trim(),
      description: newCatalogDescription.trim() || undefined,
      productIds: [],
      categoryIds: Array.from(newCatalogCategories),
      createdAt: new Date().toISOString(),
    };

    setCatalogs(prev => [...prev, newCatalog]);
    setNewCatalogName("");
    setNewCatalogDescription("");
    setNewCatalogCategories(new Set());
    setShowAddCatalog(false);
    
    toast({
      title: "Прайс-лист создан",
      description: `Прайс-лист "${newCatalog.name}" успешно создан`,
    });
  };

  const deleteCatalog = (catalogId: string) => {
    setCatalogs(prev => prev.filter(c => c.id !== catalogId));
    if (currentCatalog?.id === catalogId) {
      setCurrentCatalog(null);
      setCatalogView("list");
    }
    toast({
      title: "Прайс-лист удалён",
    });
  };

  const openCatalog = (catalog: Catalog) => {
    // Get fresh catalog data from catalogs array to ensure we have the latest product IDs
    const freshCatalog = catalogs.find(c => c.id === catalog.id) || catalog;
    setCurrentCatalog(freshCatalog);
    setSelectedCatalogProducts(new Set(freshCatalog.productIds));
    setCatalogView("detail");
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

  // Get catalog-specific pricing for a product
  const getCatalogProductPricing = (catalogId: string, productId: string): CatalogProductPricing | undefined => {
    const catalog = catalogs.find(c => c.id === catalogId);
    return catalog?.productPricing?.find(p => p.productId === productId);
  };

  // Update catalog-specific pricing for a product
  const updateCatalogProductPricing = (
    catalogId: string, 
    productId: string, 
    updates: Partial<CatalogProductPricing>
  ) => {
    setCatalogs(prev => prev.map(catalog => {
      if (catalog.id !== catalogId) return catalog;
      
      const existingPricing = catalog.productPricing || [];
      const existingIndex = existingPricing.findIndex(p => p.productId === productId);
      
      if (existingIndex >= 0) {
        // Update existing pricing
        const updatedPricing = [...existingPricing];
        updatedPricing[existingIndex] = { 
          ...updatedPricing[existingIndex], 
          ...updates 
        };
        return { ...catalog, productPricing: updatedPricing };
      } else {
        // Add new pricing entry
        return { 
          ...catalog, 
          productPricing: [
            ...existingPricing, 
            { productId, ...updates }
          ] 
        };
      }
    }));

    // Also update currentCatalog if it's the same
    if (currentCatalog?.id === catalogId) {
      setCurrentCatalog(prev => {
        if (!prev) return null;
        const existingPricing = prev.productPricing || [];
        const existingIndex = existingPricing.findIndex(p => p.productId === productId);
        
        if (existingIndex >= 0) {
          const updatedPricing = [...existingPricing];
          updatedPricing[existingIndex] = { 
            ...updatedPricing[existingIndex], 
            ...updates 
          };
          return { ...prev, productPricing: updatedPricing };
        } else {
          return { 
            ...prev, 
            productPricing: [
              ...existingPricing, 
              { productId, ...updates }
            ] 
          };
        }
      });
    }
  };

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

      const newAccount: MoySkladAccount = {
        id: `acc_${Date.now()}`,
        login: newAccountLogin,
        password: newAccountPassword,
        name: newAccountName || newAccountLogin,
        lastSync: new Date().toISOString(),
      };

      setAccounts(prev => [...prev, newAccount]);
      setNewAccountLogin("");
      setNewAccountPassword("");
      setNewAccountName("");
      setShowAddAccount(false);

      toast({
        title: "Аккаунт добавлен",
        description: `Подключен аккаунт ${newAccount.name}`,
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

  const deleteAccount = (accountId: string) => {
    setAccounts(prev => prev.filter(a => a.id !== accountId));
    // Also remove products from this account
    setImportedProducts(prev => prev.filter(p => p.accountId !== accountId));
    toast({
      title: "Аккаунт удалён",
      description: "Аккаунт и связанные товары удалены",
    });
  };

  const selectAccount = async (account: MoySkladAccount) => {
    setCurrentAccount(account);
    setImportView("catalog");
    await fetchMoySkladProducts(account);
  };

  const fetchMoySkladProducts = async (account?: MoySkladAccount) => {
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

    // Replace duplicates instead of adding - filter out any existing products with same moyskladId
    setImportedProducts(prev => {
      const newMoyskladIds = new Set(newProducts.map(p => p.moyskladId).filter(Boolean));
      const filtered = prev.filter(p => !p.moyskladId || !newMoyskladIds.has(p.moyskladId));
      return [...filtered, ...newProducts];
    });
    setSelectedProducts(new Set());
    setIsLoading(false);

    toast({
      title: "Импорт завершён",
      description: `Импортировано ${newProducts.length} товаров`,
    });
  };

  const allProducts = [...localTestProducts, ...importedProducts];

  // Update product (works for both local and imported)
  const updateProduct = (updatedProduct: Product) => {
    if (updatedProduct.source === "moysklad") {
      setImportedProducts(prev => prev.map(p => 
        p.id === updatedProduct.id ? updatedProduct : p
      ));
    } else {
      setLocalTestProducts(prev => prev.map(p => 
        p.id === updatedProduct.id ? updatedProduct : p
      ));
    }
    toast({
      title: "Товар сохранён",
      description: `${updatedProduct.name} обновлён`,
    });
  };

  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    setEditDialogOpen(true);
  };

  // Bulk update products
  const bulkUpdateProducts = (updates: Partial<Product>) => {
    const selectedIds = Array.from(selectedBulkProducts);
    
    // Update imported products
    setImportedProducts(prev => prev.map(p => {
      if (selectedIds.includes(p.id)) {
        return { ...p, ...updates };
      }
      return p;
    }));
    
    // Update local products
    setLocalTestProducts(prev => prev.map(p => {
      if (selectedIds.includes(p.id)) {
        return { ...p, ...updates };
      }
      return p;
    }));
    
    toast({
      title: "Товары обновлены",
      description: `Изменено ${selectedIds.length} товар(ов)`,
    });
    
    setSelectedBulkProducts(new Set());
  };

  // Bulk delete products
  const bulkDeleteProducts = () => {
    const selectedIds = Array.from(selectedBulkProducts);
    
    // Collect moyskladIds of products being deleted to allow re-import
    const deletedMsIds: string[] = [];
    const allCurrentProducts = [...importedProducts, ...localTestProducts];
    
    selectedIds.forEach(id => {
      const product = allCurrentProducts.find(p => p.id === id);
      if (product?.moyskladId) {
        deletedMsIds.push(product.moyskladId);
        // Clear image cache for this product
        setProductImagesCache(prev => {
          const newCache = { ...prev };
          delete newCache[product.moyskladId!];
          return newCache;
        });
      }
    });
    
    // Add to deleted MoySklad IDs set
    if (deletedMsIds.length > 0) {
      setDeletedMoyskladIds(prev => {
        const newSet = new Set(prev);
        deletedMsIds.forEach(id => newSet.add(id));
        return newSet;
      });
    }
    
    setImportedProducts(prev => prev.filter(p => !selectedIds.includes(p.id)));
    setLocalTestProducts(prev => prev.filter(p => !selectedIds.includes(p.id)));
    
    toast({
      title: "Товары удалены",
      description: `Удалено ${selectedIds.length} товар(ов)`,
    });
    
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
  }, [allProducts, allProductsFilters, productOrder]);
  
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

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Super Admin Context Banner */}
      {isSuperAdminContext && (
        <div className="bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="font-medium">Режим супер-администратора:</span>
            <span>Вы просматриваете магазин "{currentStoreName}"</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="bg-white/20 border-amber-950/30 hover:bg-white/30"
            onClick={() => window.close()}
          >
            Закрыть вкладку
          </Button>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/test-store")}
            className="h-16 w-16"
          >
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Красная крыша */}
              <path d="M2 9L12 3L22 9H2Z" fill="#ef4444" stroke="#dc2626" strokeWidth="1" strokeLinejoin="round"/>
              {/* Корпус магазина */}
              <rect x="4" y="9" width="16" height="12" fill="currentColor" fillOpacity="0.1" stroke="currentColor" strokeWidth="1.5"/>
              {/* Дверь */}
              <rect x="10" y="14" width="4" height="7" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1"/>
              {/* Окно слева */}
              <rect x="5.5" y="11" width="3" height="3" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="0.75"/>
              {/* Окно справа */}
              <rect x="15.5" y="11" width="3" height="3" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="0.75"/>
            </svg>
          </Button>
          
          {/* Super admin quick link */}
          {isSuperAdmin && !isSuperAdminContext && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/super-admin')}
              className="flex items-center gap-2"
            >
              <Shield className="h-4 w-4" />
              Панель супер-админа
            </Button>
          )}
        </div>
      </header>

      {/* Tab Navigation - same for mobile and desktop */}
      <MobileTabNav
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
      />

      {/* Main content */}
      <main 
        id={`panel-${activeSection}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeSection}`}
        className="flex-1 p-4 min-h-[calc(100vh-112px)] overflow-y-auto"
      >
          {activeSection === "products" && (
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
              />

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
                    { id: "status", minWidth: 70, defaultWidth: 80 },
                    { id: "sync", minWidth: 50, defaultWidth: 50 },
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
                      {visibleColumns.sync && (
                        <ResizableTableHead columnId="sync" minWidth={50} resizable={false}>Синхр.</ResizableTableHead>
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
                    </ResizableTableRow>
                    {/* Row 2: Filters */}
                    <ResizableTableRow className="h-6 border-b-0">
                      {visibleColumns.drag && (
                        <ResizableTableHead columnId="drag" minWidth={32} resizable={false}></ResizableTableHead>
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
                                <ImageIcon className="h-5 w-5 text-muted-foreground" />
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
                              fixedStart={["drag", "sync", "checkbox"]}
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
                customerRoles={customerRoles}
                rolePricing={rolePricing}
                onSaveRolePricing={setRolePricing}
              />
            </>
          )}

          {activeSection === "import" && (
            <>
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
                            {account.lastSync && (
                              <p className="text-xs text-muted-foreground">
                                Последняя синхр.: {new Date(account.lastSync).toLocaleDateString('ru-RU')}
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
                  />

                  {isLoading && moyskladProducts.length === 0 ? (
                    <div className="bg-card rounded-lg border border-border p-8 text-center">
                      <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin mb-4" />
                      <p className="text-muted-foreground">Загрузка товаров...</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-green-600 border-green-600">
                            <Check className="h-3 w-3 mr-1" />
                            Подключено
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {filteredMoyskladProducts.length} товаров
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <Button
                            onClick={() => fetchMoySkladProducts()}
                            disabled={isLoading}
                            variant="outline"
                            size="sm"
                            className="h-8 px-2 sm:px-3"
                          >
                            {isLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                            <span className="hidden sm:inline ml-1.5">Обновить</span>
                          </Button>
                          <Button
                            onClick={bulkSyncSelectedProducts}
                            disabled={isSyncing || selectedProducts.size === 0}
                            variant="outline"
                            size="sm"
                            className="h-8 px-2 sm:px-3"
                          >
                            {isSyncing ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                            <span className="ml-1.5">
                              <span className="hidden sm:inline">Синхр. </span>({selectedProducts.size})
                            </span>
                          </Button>
                          <Button
                            onClick={bulkDownloadPhotosForSelected}
                            disabled={downloadingImages || selectedProducts.size === 0}
                            variant="outline"
                            size="sm"
                            className="h-8 px-2 sm:px-3"
                          >
                            {downloadingImages ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <ImageIcon className="h-4 w-4" />
                            )}
                            <span className="ml-1.5">
                              <span className="hidden sm:inline">Фото </span>({selectedProducts.size})
                            </span>
                          </Button>
                          <Button
                            onClick={importSelectedProducts}
                            disabled={isLoading || selectedProducts.size === 0}
                            size="sm"
                            className="h-8 px-2 sm:px-3"
                          >
                            <Download className="h-4 w-4" />
                            <span className="ml-1.5">
                              <span className="hidden sm:inline">Импорт </span>({selectedProducts.size})
                            </span>
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

          {activeSection === "catalogs" && (
            <>
              {catalogView === "list" && (
                <>
                  <div className="mb-4">
                    <h2 className="text-xl font-semibold text-foreground">Прайс-листы</h2>
                    <p className="text-sm text-muted-foreground">
                      Создавайте прайс-листы и добавляйте в них товары
                    </p>
                  </div>

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
                                <span className="font-medium text-foreground truncate">{catalog.name}</span>
                                <Badge variant="outline" className="text-xs flex-shrink-0">
                                  {catalogProducts.length}
                                </Badge>
                              </button>
                              
                              {/* Category multi-select dropdown */}
                              <div className="relative flex-shrink-0">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedCatalogId(isExpanded ? null : catalog.id);
                                  }}
                                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors border ${
                                    isExpanded 
                                      ? "bg-primary text-primary-foreground border-primary" 
                                      : catalog.categoryIds && catalog.categoryIds.length > 0
                                        ? "bg-primary/10 text-primary border-primary/30 hover:bg-primary/20"
                                        : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                                  }`}
                                >
                                  <Tag className="h-3 w-3" />
                                  {catalog.categoryIds && catalog.categoryIds.length > 0 ? (
                                    <span>{catalog.categoryIds.length}</span>
                                  ) : (
                                    <span>Категории</span>
                                  )}
                                  <ChevronDown className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                </button>
                                
                                {/* Dropdown menu */}
                                {isExpanded && (
                                  <div 
                                    className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg min-w-[200px] max-h-[300px] overflow-y-auto"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div className="p-2 space-y-1">
                                      {categories.length > 0 ? (
                                        categories.map((cat) => {
                                          const isSelected = catalog.categoryIds?.includes(cat.id) ?? false;
                                          return (
                                            <label
                                              key={cat.id}
                                              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
                                            >
                                              <Checkbox
                                                checked={isSelected}
                                                onCheckedChange={() => {
                                                  setCatalogs(prev => prev.map(c => {
                                                    if (c.id !== catalog.id) return c;
                                                    const currentIds = c.categoryIds || [];
                                                    const newIds = isSelected
                                                      ? currentIds.filter(id => id !== cat.id)
                                                      : [...currentIds, cat.id];
                                                    return { ...c, categoryIds: newIds };
                                                  }));
                                                }}
                                              />
                                              <span className="text-sm">{cat.name}</span>
                                            </label>
                                          );
                                        })
                                      ) : (
                                        <p className="text-sm text-muted-foreground px-2 py-1">Нет категорий</p>
                                      )}
                                    </div>
                                    <div className="border-t border-border p-2 flex gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1 text-xs h-7"
                                        onClick={() => openCatalog(catalog)}
                                      >
                                        <Edit2 className="h-3 w-3 mr-1" />
                                        Товары
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 px-2"
                                        onClick={() => {
                                          deleteCatalog(catalog.id);
                                          setExpandedCatalogId(null);
                                        }}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
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

                  {/* Add new catalog form */}
                  {showAddCatalog ? (
                    <div className="bg-card rounded-lg border border-border p-6 max-w-md">
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
                        <div className="space-y-2">
                          <Label htmlFor="catalog-desc">Описание</Label>
                          <Input
                            id="catalog-desc"
                            type="text"
                            placeholder="Описание прайс-листа"
                            value={newCatalogDescription}
                            onChange={(e) => setNewCatalogDescription(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Категории</Label>
                          <p className="text-xs text-muted-foreground">
                            Выберите категории, в которых будет отображаться прайс-лист
                          </p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {categories.map((cat) => (
                              <button
                                key={cat.id}
                                onClick={() => {
                                  setNewCatalogCategories(prev => {
                                    const next = new Set(prev);
                                    if (next.has(cat.id)) {
                                      next.delete(cat.id);
                                    } else {
                                      next.add(cat.id);
                                    }
                                    return next;
                                  });
                                }}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                                  newCatalogCategories.has(cat.id)
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                                }`}
                              >
                                {cat.name}
                              </button>
                            ))}
                          </div>
                          {newCatalogCategories.size > 0 && (
                            <p className="text-xs text-primary mt-1">
                              Выбрано: {newCatalogCategories.size}
                            </p>
                          )}
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
                      className="w-full max-w-md"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Создать прайс-лист
                    </Button>
                  )}
                </>
              )}

              {catalogView === "detail" && currentCatalog && (
                <>
                  <div className="mb-4 flex items-center gap-4">
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
                      Назад к прайс-листам
                    </Button>
                    <div className="flex items-center gap-2">
                      {editingCatalogName ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={currentCatalog.name}
                            onChange={(e) => setCurrentCatalog(prev => prev ? { ...prev, name: e.target.value } : null)}
                            className="h-8 w-48"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") updateCatalogName(currentCatalog.name);
                              if (e.key === "Escape") setEditingCatalogName(false);
                            }}
                          />
                          <Button size="sm" variant="ghost" onClick={() => updateCatalogName(currentCatalog.name)}>
                            <Check className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <h2 className="text-xl font-semibold text-foreground">{currentCatalog.name}</h2>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => setEditingCatalogName(true)}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        Выбрано: {selectedCatalogProducts.size} из {allProducts.length}
                      </Badge>
                    </div>
                    <Button onClick={saveCatalogProducts} size="sm">
                      <Check className="h-4 w-4 mr-2" />
                      Сохранить
                    </Button>
                  </div>

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
                    * Фото, название, описание, ед. изм., объём и вид синхронизируются из ассортимента. Категории, наценка, цены порций и статус — индивидуальны для каждого прайс-листа.
                  </p>
                  <div className="bg-card rounded-lg border border-border overflow-x-auto">
                    <ResizableTable
                      storageKey="catalog-products-table"
                      columns={[
                        { id: "bulkCheckbox", minWidth: 40, defaultWidth: 40 },
                        { id: "photo", minWidth: 50, defaultWidth: 60 },
                        { id: "name", minWidth: 120, defaultWidth: 180 },
                        { id: "category", minWidth: 100, defaultWidth: 120 },
                        { id: "description", minWidth: 100, defaultWidth: 200 },
                        { id: "unit", minWidth: 60, defaultWidth: 80 },
                        { id: "volume", minWidth: 60, defaultWidth: 80 },
                        { id: "type", minWidth: 80, defaultWidth: 100 },
                        { id: "buyPrice", minWidth: 70, defaultWidth: 90 },
                        { id: "markup", minWidth: 70, defaultWidth: 90 },
                        { id: "price", minWidth: 80, defaultWidth: 100 },
                        { id: "priceFull", minWidth: 70, defaultWidth: 90 },
                        { id: "priceHalf", minWidth: 70, defaultWidth: 90 },
                        { id: "priceQuarter", minWidth: 70, defaultWidth: 90 },
                        { id: "pricePortion", minWidth: 70, defaultWidth: 90 },
                        { id: "status", minWidth: 80, defaultWidth: 100 },
                      ]}
                    >
                      <ResizableTableHeader>
                        <ResizableTableRow>
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
                          <ResizableTableHead columnId="photo">Фото</ResizableTableHead>
                          <ResizableTableHead columnId="name">Название</ResizableTableHead>
                          <ResizableTableHead columnId="category">Категория</ResizableTableHead>
                          <ResizableTableHead columnId="description">Описание</ResizableTableHead>
                          <ResizableTableHead columnId="unit">Ед. изм.</ResizableTableHead>
                          <ResizableTableHead columnId="volume">Объем</ResizableTableHead>
                          <ResizableTableHead columnId="type">Вид</ResizableTableHead>
                          <ResizableTableHead columnId="buyPrice" title="Себестоимость из ассортимента (только чтение)">Себест-ть*</ResizableTableHead>
                          <ResizableTableHead columnId="markup">Наценка</ResizableTableHead>
                          <ResizableTableHead columnId="price">Цена</ResizableTableHead>
                          <ResizableTableHead columnId="priceFull">Целая</ResizableTableHead>
                          <ResizableTableHead columnId="priceHalf">½</ResizableTableHead>
                          <ResizableTableHead columnId="priceQuarter">¼</ResizableTableHead>
                          <ResizableTableHead columnId="pricePortion">Порция</ResizableTableHead>
                          <ResizableTableHead columnId="status">Статус</ResizableTableHead>
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
                                {/* Фото - из ассортимента (только чтение) */}
                                <ResizableTableCell columnId="photo">
                                  <img
                                    src={product.image}
                                    alt={baseName}
                                    className="w-10 h-10 rounded object-cover"
                                  />
                                </ResizableTableCell>
                                {/* Название - из ассортимента (только чтение) */}
                                <ResizableTableCell columnId="name" className="font-medium">
                                  <span className="text-sm" title="Синхронизировано из ассортимента">{baseName}</span>
                                </ResizableTableCell>
                                {/* Категории - редактируемые для каталога */}
                                <ResizableTableCell columnId="category">
                                  <InlineMultiSelectCell
                                    values={effectiveCategories || []}
                                    options={categories.map(c => ({ value: c.id, label: c.name }))}
                                    onSave={(cats) => {
                                      if (currentCatalog) {
                                        updateCatalogProductPricing(currentCatalog.id, product.id, { categories: cats });
                                      }
                                    }}
                                    placeholder="Категории"
                                  />
                                </ResizableTableCell>
                                {/* Описание - из ассортимента (только чтение) */}
                                <ResizableTableCell columnId="description">
                                  <span className="text-xs text-muted-foreground truncate max-w-[150px] block" title={baseDescription || "Нет описания"}>
                                    {baseDescription || "-"}
                                  </span>
                                </ResizableTableCell>
                                {/* Единица измерения - из ассортимента (только чтение) */}
                                <ResizableTableCell columnId="unit">
                                  <span className="text-xs" title="Синхронизировано из ассортимента">{baseUnit}</span>
                                </ResizableTableCell>
                                {/* Объём - из ассортимента (только чтение) */}
                                <ResizableTableCell columnId="volume">
                                  <span className="text-xs text-muted-foreground" title="Синхронизировано из ассортимента">
                                    {baseUnitWeight ?? "-"}
                                  </span>
                                </ResizableTableCell>
                                {/* Вид упаковки - из ассортимента (только чтение) */}
                                <ResizableTableCell columnId="type">
                                  <span className="text-xs" title="Синхронизировано из ассортимента">
                                    {basePackagingType ? packagingTypeLabels[basePackagingType as PackagingType] || basePackagingType : "-"}
                                  </span>
                                </ResizableTableCell>
                                {/* Себестоимость - read-only, берётся из ассортимента */}
                                <ResizableTableCell columnId="buyPrice">
                                  <span className="text-xs text-muted-foreground">
                                    {product.buyPrice ? formatPrice(product.buyPrice) : "-"}
                                  </span>
                                </ResizableTableCell>
                                {/* Наценка - независимая для каждого каталога */}
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
                                <ResizableTableCell columnId="price" className="font-medium">
                                  <span className="text-xs">{formatPrice(salePrice)}/{baseUnit}</span>
                                </ResizableTableCell>
                                <ResizableTableCell columnId="priceFull">
                                  {packagingPrices ? (
                                    <span className="text-xs font-medium">{formatPrice(packagingPrices.full)}</span>
                                  ) : "-"}
                                </ResizableTableCell>
                                {/* Цена за ½ - независимая для каждого каталога */}
                                <ResizableTableCell columnId="priceHalf">
                                  {basePackagingType === "head" ? (
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
                                        placeholder="авто"
                                        suffix={`/${baseUnit}`}
                                      />
                                      {baseUnitWeight && effectivePortionPrices?.halfPricePerKg && (
                                        <span className="text-[10px] text-muted-foreground">
                                          = {formatPrice(effectivePortionPrices.halfPricePerKg * (baseUnitWeight / 2))}
                                        </span>
                                      )}
                                    </div>
                                  ) : "-"}
                                </ResizableTableCell>
                                {/* Цена за ¼ - независимая для каждого каталога */}
                                <ResizableTableCell columnId="priceQuarter">
                                  {basePackagingType === "head" ? (
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
                                        placeholder="авто"
                                        suffix={`/${baseUnit}`}
                                      />
                                      {baseUnitWeight && effectivePortionPrices?.quarterPricePerKg && (
                                        <span className="text-[10px] text-muted-foreground">
                                          = {formatPrice(effectivePortionPrices.quarterPricePerKg * (baseUnitWeight / 4))}
                                        </span>
                                      )}
                                    </div>
                                  ) : "-"}
                                </ResizableTableCell>
                                {/* Цена за порцию - независимая для каждого каталога */}
                                <ResizableTableCell columnId="pricePortion">
                                  {basePackagingType === "head" ? (
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
                                  ) : "-"}
                                </ResizableTableCell>
                                {/* Статус - независимый для каждого каталога */}
                                <ResizableTableCell columnId="status">
                                  <button
                                    onClick={() => {
                                      if (!currentCatalog) return;
                                      const nextStatus: ProductStatus = 
                                        effectiveStatus === "in_stock" ? "out_of_stock" :
                                        effectiveStatus === "out_of_stock" ? "hidden" : "in_stock";
                                      updateCatalogProductPricing(currentCatalog.id, product.id, { status: nextStatus });
                                    }}
                                    className="focus:outline-none"
                                  >
                                    <Badge
                                      variant={effectiveStatus === "hidden" ? "outline" : effectiveStatus === "in_stock" ? "default" : "secondary"}
                                      className={`text-xs cursor-pointer transition-colors ${
                                        effectiveStatus === "hidden"
                                          ? "bg-muted/50 text-muted-foreground border-dashed"
                                          : effectiveStatus === "in_stock"
                                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 hover:bg-green-200 dark:hover:bg-green-800"
                                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                                      }`}
                                    >
                                      {effectiveStatus === "hidden" ? "Скрыт" : 
                                       effectiveStatus === "in_stock" ? "В наличии" : "Нет"}
                                    </Badge>
                                  </button>
                                </ResizableTableCell>
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

          {activeSection === "visibility" && (
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

          {activeSection === "roles" && effectiveStoreId && (
            <CustomerRolesManager
              roles={customerRoles}
              storeId={effectiveStoreId}
              onCreateRole={(role) => {
                const newRole: CustomerRole = {
                  ...role,
                  id: `role_${Date.now()}`,
                  created_at: new Date().toISOString(),
                };
                setCustomerRoles((prev) => [...prev, newRole]);
              }}
              onUpdateRole={(role) => {
                setCustomerRoles((prev) =>
                  prev.map((r) => (r.id === role.id ? role : r))
                );
              }}
              onDeleteRole={(roleId) => {
                setCustomerRoles((prev) => prev.filter((r) => r.id !== roleId));
                setRolePricing((prev) => prev.filter((rp) => rp.role_id !== roleId));
              }}
            />
          )}
        </main>
    </div>
  );
}
