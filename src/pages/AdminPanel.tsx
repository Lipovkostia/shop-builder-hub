import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Package, Download, RefreshCw, Check, X, Loader2, Image as ImageIcon, LogIn, Lock, Unlock, ExternalLink, Filter, Plus, ChevronRight, Trash2, FolderOpen, Edit2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  Product,
  MoySkladProduct,
  MoySkladAccount,
  Catalog,
  formatPrice,
  calculateSalePrice,
  calculatePackagingPrices,
  packagingTypeLabels,
  PackagingType,
  CustomVariantPrices,
} from "@/components/admin/ProductTypes";
import { ProductEditDialog } from "@/components/admin/ProductEditDialog";

const MOYSKLAD_ACCOUNTS_KEY = "moysklad_accounts";
const IMPORTED_PRODUCTS_KEY = "moysklad_imported_products";

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

type ActiveSection = "products" | "import" | "catalogs";
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
    <div className="mt-1">
      <Input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 text-xs"
      />
    </div>
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
    <div className="mt-1">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-7 text-xs">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{placeholder}</SelectItem>
          {options.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function AdminPanel() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState<ActiveSection>("products");
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
    source: "all",
    type: "all",
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
  const [showAddCatalog, setShowAddCatalog] = useState(false);
  const [catalogProductSearch, setCatalogProductSearch] = useState("");
  const [selectedCatalogProducts, setSelectedCatalogProducts] = useState<Set<string>>(new Set());
  const [editingCatalogName, setEditingCatalogName] = useState(false);

  // Product editing state
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [localTestProducts, setLocalTestProducts] = useState<Product[]>(testProducts);

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

  // Check if a MoySklad product is linked (imported) to all products
  const isProductLinked = (msProductId: string) => {
    return importedProducts.some(p => p.moyskladId === msProductId);
  };

  // Get linked product from importedProducts
  const getLinkedProduct = (msProductId: string) => {
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

      setImportedProducts(prev => [...prev, newProduct]);
      
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
  const syncAutoSyncProducts = async () => {
    const productsToSync = importedProducts.filter(p => p.autoSync && p.moyskladId);
    if (productsToSync.length === 0) return;

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
                return {
                  ...product,
                  pricePerUnit: msProduct.price || product.pricePerUnit,
                  buyPrice: msProduct.buyPrice,
                  inStock: msProduct.quantity > 0 || msProduct.stock > 0,
                };
              }
            }
            return product;
          }));
        }
      }

      toast({
        title: "Синхронизация завершена",
        description: `Обновлено ${productsToSync.length} товаров`,
      });
    } catch (err) {
      console.error("Sync error:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Toggle auto-sync for a product
  const toggleAutoSync = (productId: string) => {
    setImportedProducts(prev => prev.map(product => 
      product.id === productId 
        ? { ...product, autoSync: !product.autoSync }
        : product
    ));
  };

  // Catalog management functions
  const createCatalog = () => {
    if (!newCatalogName.trim()) {
      toast({
        title: "Ошибка",
        description: "Введите название каталога",
        variant: "destructive",
      });
      return;
    }

    const newCatalog: Catalog = {
      id: `catalog_${Date.now()}`,
      name: newCatalogName.trim(),
      productIds: [],
      createdAt: new Date().toISOString(),
    };

    setCatalogs(prev => [...prev, newCatalog]);
    setNewCatalogName("");
    setShowAddCatalog(false);
    
    toast({
      title: "Каталог создан",
      description: `Каталог "${newCatalog.name}" успешно создан`,
    });
  };

  const deleteCatalog = (catalogId: string) => {
    setCatalogs(prev => prev.filter(c => c.id !== catalogId));
    if (currentCatalog?.id === catalogId) {
      setCurrentCatalog(null);
      setCatalogView("list");
    }
    toast({
      title: "Каталог удалён",
    });
  };

  const openCatalog = (catalog: Catalog) => {
    setCurrentCatalog(catalog);
    setSelectedCatalogProducts(new Set(catalog.productIds));
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
      title: "Каталог сохранён",
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

      // Check if already imported
      if (importedProducts.some(p => p.moyskladId === msProduct.id)) {
        continue; // Skip already imported
      }

      // Fetch images for this product - both miniature and full size
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
            
            // Get miniature for thumbnail
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
            
            // Get full size image
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

    setImportedProducts(prev => [...prev, ...newProducts]);
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

  // Get sale price with markup
  const getProductSalePrice = (product: Product): number => {
    if (product.buyPrice && product.markup) {
      return calculateSalePrice(product.buyPrice, product.markup);
    }
    return product.pricePerUnit;
  };

  // Filtered "All Products"
  const filteredAllProducts = useMemo(() => {
    return allProducts.filter(product => {
      if (allProductsFilters.name && !product.name.toLowerCase().includes(allProductsFilters.name.toLowerCase())) {
        return false;
      }
      if (allProductsFilters.source !== "all") {
        const isMs = product.source === "moysklad";
        if (allProductsFilters.source === "moysklad" && !isMs) return false;
        if (allProductsFilters.source === "local" && isMs) return false;
      }
      if (allProductsFilters.type !== "all" && product.productType !== allProductsFilters.type) {
        return false;
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
  }, [allProducts, allProductsFilters]);

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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/test-store")}
              className="h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="font-semibold text-lg text-foreground">Панель управления</h1>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-56 border-r border-border min-h-[calc(100vh-56px)] bg-card">
          <nav className="p-2 space-y-1">
            <button
              onClick={() => setActiveSection("products")}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeSection === "products"
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-muted"
              }`}
            >
              <Package className="h-4 w-4" />
              Все товары
            </button>
            <button
              onClick={() => {
                setActiveSection("import");
                setImportView("accounts");
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeSection === "import"
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-muted"
              }`}
            >
              <Download className="h-4 w-4" />
              Импорт из МойСклад
            </button>
            <button
              onClick={() => {
                setActiveSection("catalogs");
                setCatalogView("list");
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeSection === "catalogs"
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-muted"
              }`}
            >
              <FolderOpen className="h-4 w-4" />
              Каталоги
            </button>
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-4">
          {activeSection === "products" && (
            <>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Все товары</h2>
                  <p className="text-sm text-muted-foreground">
                    Всего товаров: {filteredAllProducts.length} (из МойСклад: {importedProducts.length})
                  </p>
                </div>
                {importedProducts.some(p => p.autoSync) && (
                  <Button
                    onClick={syncAutoSyncProducts}
                    disabled={isSyncing}
                    variant="outline"
                    size="sm"
                  >
                    {isSyncing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Синхронизировать
                  </Button>
                )}
              </div>

              <div className="bg-card rounded-lg border border-border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">Фото</TableHead>
                      <TableHead>
                        Название
                        <ColumnFilter 
                          value={allProductsFilters.name} 
                          onChange={(v) => setAllProductsFilters(f => ({...f, name: v}))}
                          placeholder="Фильтр..."
                        />
                      </TableHead>
                      <TableHead>
                        Источник
                        <SelectFilter
                          value={allProductsFilters.source}
                          onChange={(v) => setAllProductsFilters(f => ({...f, source: v}))}
                          options={[
                            { value: "moysklad", label: "МойСклад" },
                            { value: "local", label: "Локальный" },
                          ]}
                          placeholder="Все"
                        />
                      </TableHead>
                      <TableHead>Ед. изм.</TableHead>
                      <TableHead>Вид</TableHead>
                      <TableHead>Себест-ть</TableHead>
                      <TableHead>Наценка</TableHead>
                      <TableHead>Цена</TableHead>
                      <TableHead>Цены за ед.</TableHead>
                      <TableHead>
                        Статус
                        <SelectFilter
                          value={allProductsFilters.status}
                          onChange={(v) => setAllProductsFilters(f => ({...f, status: v}))}
                          options={[
                            { value: "inStock", label: "В наличии" },
                            { value: "outOfStock", label: "Нет в наличии" },
                          ]}
                          placeholder="Все"
                        />
                      </TableHead>
                      <TableHead>
                        Синхр.
                        <SelectFilter
                          value={allProductsFilters.sync}
                          onChange={(v) => setAllProductsFilters(f => ({...f, sync: v}))}
                          options={[
                            { value: "synced", label: "Включена" },
                            { value: "notSynced", label: "Отключена" },
                          ]}
                          placeholder="Все"
                        />
                      </TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAllProducts.map((product) => {
                      const salePrice = getProductSalePrice(product);
                      const packagingPrices = calculatePackagingPrices(
                        salePrice,
                        product.unitWeight,
                        product.packagingType,
                        product.customVariantPrices
                      );
                      
                      return (
                        <TableRow key={product.id}>
                          <TableCell>
                            <img
                              src={product.image}
                              alt={product.name}
                              className="w-10 h-10 rounded object-cover cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => {
                                if (product.imageFull) {
                                  window.open(product.imageFull, '_blank');
                                }
                              }}
                              title={product.imageFull ? "Нажмите для просмотра в полном размере" : ""}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            <div>
                              {product.name}
                              {product.description && (
                                <p className="text-xs text-muted-foreground mt-0.5 max-w-[200px] truncate">{product.description}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {product.source === "moysklad" ? (
                              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800">
                                <ExternalLink className="h-3 w-3 mr-1" />
                                МойСклад
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                Локальный
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {product.unit}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {product.packagingType 
                                ? packagingTypeLabels[product.packagingType] 
                                : (product.productType === "weight" ? "Весовой" : "Штучный")}
                            </Badge>
                            {product.packagingType === "head" && product.unitWeight && (
                              <span className="text-xs text-muted-foreground block mt-0.5">
                                {product.unitWeight} кг
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {product.buyPrice ? formatPrice(product.buyPrice) : "-"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {product.markup ? (
                              <span className="text-green-600 dark:text-green-400">
                                +{product.markup.value}{product.markup.type === "percent" ? "%" : "₽"}
                              </span>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatPrice(salePrice)}/{product.unit}
                          </TableCell>
                          <TableCell>
                            {packagingPrices ? (
                              <div className="text-xs space-y-0.5">
                                <div className="flex justify-between gap-2">
                                  <span className="text-muted-foreground">Целая:</span>
                                  <span className="font-medium">{formatPrice(packagingPrices.full)}</span>
                                </div>
                                <div className="flex justify-between gap-2">
                                  <span className="text-muted-foreground">½:</span>
                                  <span className="font-medium">{formatPrice(packagingPrices.half)}</span>
                                </div>
                                <div className="flex justify-between gap-2">
                                  <span className="text-muted-foreground">¼:</span>
                                  <span className="font-medium">{formatPrice(packagingPrices.quarter)}</span>
                                </div>
                              </div>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={product.inStock ? "default" : "secondary"}
                              className={`text-xs ${
                                product.inStock
                                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {product.inStock ? "В наличии" : "Нет"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {product.source === "moysklad" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className={`h-8 w-8 ${product.autoSync ? "text-primary" : "text-muted-foreground"}`}
                                onClick={() => toggleAutoSync(product.id)}
                                title={product.autoSync ? "Авто-синхронизация включена" : "Включить авто-синхронизацию"}
                              >
                                {product.autoSync ? (
                                  <Lock className="h-4 w-4" />
                                ) : (
                                  <Unlock className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-primary"
                              onClick={() => openEditDialog(product)}
                              title="Редактировать товар"
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Product Edit Dialog */}
              <ProductEditDialog
                product={editingProduct}
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                onSave={updateProduct}
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
                        <div className="flex gap-2">
                          <Button
                            onClick={() => fetchMoySkladProducts()}
                            disabled={isLoading}
                            variant="outline"
                            size="sm"
                          >
                            {isLoading ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4 mr-2" />
                            )}
                            Обновить
                          </Button>
                          <Button
                            onClick={importSelectedProducts}
                            disabled={isLoading || selectedProducts.size === 0}
                            size="sm"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Импортировать ({selectedProducts.size})
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
                              <TableHead>Связь</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredMoyskladProducts.map((product) => {
                              const linkedProduct = getLinkedProduct(product.id);
                              const isLinked = !!linkedProduct;
                              
                              return (
                                <TableRow 
                                  key={product.id}
                                  className={selectedProducts.has(product.id) ? "bg-primary/5" : ""}
                                >
                                  <TableCell>
                                    <Checkbox
                                      checked={selectedProducts.has(product.id)}
                                      onCheckedChange={() => toggleProductSelection(product.id)}
                                      disabled={isLinked}
                                    />
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
                                      <Badge variant="outline" className="text-xs">
                                        <ImageIcon className="h-3 w-3 mr-1" />
                                        {product.imagesCount}
                                      </Badge>
                                    ) : (
                                      <span className="text-muted-foreground text-xs">-</span>
                                    )}
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
                                </TableRow>
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
                    <h2 className="text-xl font-semibold text-foreground">Каталоги</h2>
                    <p className="text-sm text-muted-foreground">
                      Создавайте каталоги и добавляйте в них товары
                    </p>
                  </div>

                  {/* Catalogs list */}
                  <div className="space-y-3 mb-6">
                    {catalogs.map((catalog) => {
                      const catalogProducts = getCatalogProducts(catalog);
                      return (
                        <div
                          key={catalog.id}
                          className="bg-card rounded-lg border border-border p-4 flex items-center justify-between hover:border-primary/50 transition-colors cursor-pointer"
                          onClick={() => openCatalog(catalog)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <FolderOpen className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <h3 className="font-medium text-foreground">{catalog.name}</h3>
                              <p className="text-sm text-muted-foreground">
                                {catalogProducts.length} товаров
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteCatalog(catalog.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          </div>
                        </div>
                      );
                    })}

                    {catalogs.length === 0 && !showAddCatalog && (
                      <div className="bg-card rounded-lg border border-border p-8 text-center">
                        <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <h3 className="font-medium text-foreground mb-2">Нет каталогов</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Создайте каталог для группировки товаров
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Add new catalog form */}
                  {showAddCatalog ? (
                    <div className="bg-card rounded-lg border border-border p-6 max-w-md">
                      <div className="flex items-center gap-2 mb-4">
                        <Plus className="h-5 w-5 text-primary" />
                        <h3 className="font-medium text-foreground">Новый каталог</h3>
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="catalog-name">Название каталога</Label>
                          <Input
                            id="catalog-name"
                            type="text"
                            placeholder="Например: Сыры премиум"
                            value={newCatalogName}
                            onChange={(e) => setNewCatalogName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && createCatalog()}
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
                      Создать каталог
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
                      Назад к каталогам
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

                  <div className="bg-card rounded-lg border border-border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]">
                            <Checkbox
                              checked={selectedCatalogProducts.size === allProducts.length && allProducts.length > 0}
                              onCheckedChange={() => {
                                if (selectedCatalogProducts.size === allProducts.length) {
                                  setSelectedCatalogProducts(new Set());
                                } else {
                                  setSelectedCatalogProducts(new Set(allProducts.map(p => p.id)));
                                }
                              }}
                            />
                          </TableHead>
                          <TableHead className="w-[50px]">Фото</TableHead>
                          <TableHead>Название</TableHead>
                          <TableHead>Ед. изм.</TableHead>
                          <TableHead>Вид</TableHead>
                          <TableHead>Себест-ть</TableHead>
                          <TableHead>Наценка</TableHead>
                          <TableHead>Цена</TableHead>
                          <TableHead>Цены за ед.</TableHead>
                          <TableHead>Статус</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allProducts
                          .filter(p => !catalogProductSearch || p.name.toLowerCase().includes(catalogProductSearch.toLowerCase()))
                          .map((product) => {
                            const salePrice = getProductSalePrice(product);
                            const packagingPrices = calculatePackagingPrices(
                              salePrice,
                              product.unitWeight,
                              product.packagingType,
                              product.customVariantPrices
                            );
                            
                            return (
                              <TableRow
                                key={product.id}
                                className={selectedCatalogProducts.has(product.id) ? "bg-primary/5" : ""}
                              >
                                <TableCell>
                                  <Checkbox
                                    checked={selectedCatalogProducts.has(product.id)}
                                    onCheckedChange={() => toggleCatalogProduct(product.id)}
                                  />
                                </TableCell>
                                <TableCell>
                                  <img
                                    src={product.image}
                                    alt={product.name}
                                    className="w-10 h-10 rounded object-cover"
                                  />
                                </TableCell>
                                <TableCell className="font-medium">
                                  <div>
                                    {product.name}
                                    {product.description && (
                                      <p className="text-xs text-muted-foreground mt-0.5 max-w-[200px] truncate">{product.description}</p>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs">
                                    {product.unit}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs">
                                    {product.packagingType 
                                      ? packagingTypeLabels[product.packagingType] 
                                      : (product.productType === "weight" ? "Весовой" : "Штучный")}
                                  </Badge>
                                  {product.packagingType === "head" && product.unitWeight && (
                                    <span className="text-xs text-muted-foreground block mt-0.5">
                                      {product.unitWeight} кг
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                  {product.buyPrice ? formatPrice(product.buyPrice) : "-"}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {product.markup ? (
                                    <span className="text-green-600 dark:text-green-400">
                                      +{product.markup.value}{product.markup.type === "percent" ? "%" : "₽"}
                                    </span>
                                  ) : (
                                    "-"
                                  )}
                                </TableCell>
                                <TableCell className="font-medium">
                                  {formatPrice(salePrice)}/{product.unit}
                                </TableCell>
                                <TableCell>
                                  {packagingPrices ? (
                                    <div className="text-xs space-y-0.5">
                                      <div className="flex justify-between gap-2">
                                        <span className="text-muted-foreground">Целая:</span>
                                        <span className="font-medium">{formatPrice(packagingPrices.full)}</span>
                                      </div>
                                      <div className="flex justify-between gap-2">
                                        <span className="text-muted-foreground">½:</span>
                                        <span className="font-medium">{formatPrice(packagingPrices.half)}</span>
                                      </div>
                                      <div className="flex justify-between gap-2">
                                        <span className="text-muted-foreground">¼:</span>
                                        <span className="font-medium">{formatPrice(packagingPrices.quarter)}</span>
                                      </div>
                                    </div>
                                  ) : (
                                    "-"
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant={product.inStock ? "default" : "secondary"}
                                    className={`text-xs ${
                                      product.inStock
                                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                                        : "bg-muted text-muted-foreground"
                                    }`}
                                  >
                                    {product.inStock ? "В наличии" : "Нет"}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
