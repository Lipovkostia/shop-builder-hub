import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Package, Download, RefreshCw, Check, X, Loader2, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
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

type ProductType = "weight" | "piece";

interface WeightVariant {
  type: "full" | "half" | "quarter";
  weight: number;
}

interface PieceVariant {
  type: "box" | "single";
  quantity: number;
}

interface Product {
  id: string;
  name: string;
  description: string;
  pricePerUnit: number;
  unit: string;
  image: string;
  productType: ProductType;
  weightVariants?: WeightVariant[];
  pieceVariants?: PieceVariant[];
  inStock: boolean;
  isHit: boolean;
}

interface MoySkladProduct {
  id: string;
  name: string;
  description: string;
  code: string;
  article: string;
  price: number;
  buyPrice: number;
  quantity: number;
  stock: number;
  productType: string;
  images: string | null;
  imagesCount: number;
  uom: string;
  weight: number;
  volume: number;
  archived: boolean;
}

// Local test products
const testProducts: Product[] = [
  {
    id: "1",
    name: "Пармезан Reggiano 24 мес",
    description: "Выдержка 24 месяца, Италия",
    pricePerUnit: 2890,
    unit: "кг",
    image: "https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=400&h=400&fit=crop",
    productType: "weight",
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

const formatPrice = (price: number) => {
  return new Intl.NumberFormat("ru-RU").format(Math.round(price)) + " ₽";
};

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

type ActiveSection = "products" | "import";

export default function AdminPanel() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState<ActiveSection>("products");
  
  // MoySklad import state
  const [isLoading, setIsLoading] = useState(false);
  const [moyskladProducts, setMoyskladProducts] = useState<MoySkladProduct[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [importedProducts, setImportedProducts] = useState<Product[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);

  const fetchMoySkladProducts = async () => {
    setIsLoading(true);
    try {
      console.log("Fetching products from MoySklad...");
      
      const { data, error } = await supabase.functions.invoke('moysklad', {
        body: { action: 'get_assortment', limit: 100, offset: 0 }
      });

      if (error) {
        console.error("Error fetching products:", error);
        toast({
          title: "Ошибка",
          description: "Не удалось загрузить товары из МойСклад. Проверьте токен API.",
          variant: "destructive",
        });
        return;
      }

      console.log("Fetched products:", data);
      setMoyskladProducts(data.products || []);
      setTotalProducts(data.meta?.size || 0);
      
      toast({
        title: "Успешно",
        description: `Загружено ${data.products?.length || 0} товаров из МойСклад`,
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
    if (selectedProducts.size === 0) {
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

      // Fetch images for this product
      let imageUrl = "https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=400&h=400&fit=crop"; // default
      
      if (msProduct.imagesCount > 0) {
        try {
          const { data: imagesData } = await supabase.functions.invoke('moysklad', {
            body: { action: 'get_product_images', productId: msProduct.id }
          });
          
          if (imagesData?.images?.[0]?.miniature) {
            // Get actual image content
            const { data: imageContent } = await supabase.functions.invoke('moysklad', {
              body: { action: 'get_image_content', imageUrl: imagesData.images[0].miniature }
            });
            if (imageContent?.imageData) {
              imageUrl = imageContent.imageData;
            }
          }
        } catch (err) {
          console.log("Could not fetch image for product:", msProduct.id);
        }
      }

      // Convert to local product format
      const newProduct: Product = {
        id: msProduct.id,
        name: msProduct.name,
        description: msProduct.description || "",
        pricePerUnit: msProduct.price || 0,
        unit: msProduct.uom || "кг",
        image: imageUrl,
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

  const allProducts = [...testProducts, ...importedProducts];

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
              onClick={() => setActiveSection("import")}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeSection === "import"
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-muted"
              }`}
            >
              <Download className="h-4 w-4" />
              Импорт из МойСклад
            </button>
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-4">
          {activeSection === "products" && (
            <>
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-foreground">Все товары</h2>
                <p className="text-sm text-muted-foreground">
                  Всего товаров: {allProducts.length}
                </p>
              </div>

              <div className="bg-card rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">Фото</TableHead>
                      <TableHead>Название</TableHead>
                      <TableHead>Описание</TableHead>
                      <TableHead>Тип</TableHead>
                      <TableHead>Цена/{"\u00A0"}ед.</TableHead>
                      <TableHead>Варианты</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead>Хит</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allProducts.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell>
                          <img
                            src={product.image}
                            alt={product.name}
                            className="w-10 h-10 rounded object-cover"
                          />
                        </TableCell>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {product.description}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {product.productType === "weight" ? "Весовой" : "Штучный"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatPrice(product.pricePerUnit)}/{product.unit}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px]">
                          {formatVariants(product)}
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
                          {product.isHit && (
                            <Badge className="bg-destructive text-destructive-foreground text-xs">
                              ХИТ
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          {activeSection === "import" && (
            <>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Импорт из МойСклад</h2>
                  <p className="text-sm text-muted-foreground">
                    Подключитесь к МойСклад и выберите товары для импорта
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={fetchMoySkladProducts}
                    disabled={isLoading}
                    variant="outline"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Загрузить товары
                  </Button>
                  {moyskladProducts.length > 0 && (
                    <Button
                      onClick={importSelectedProducts}
                      disabled={isLoading || selectedProducts.size === 0}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Импортировать ({selectedProducts.size})
                    </Button>
                  )}
                </div>
              </div>

              {moyskladProducts.length === 0 ? (
                <div className="bg-card rounded-lg border border-border p-8 text-center">
                  <Download className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-medium text-foreground mb-2">Нет загруженных товаров</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Нажмите "Загрузить товары", чтобы получить список из МойСклад
                  </p>
                  <Button onClick={fetchMoySkladProducts} disabled={isLoading}>
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Загрузить товары
                  </Button>
                </div>
              ) : (
                <div className="bg-card rounded-lg border border-border overflow-hidden">
                  <div className="p-3 border-b border-border bg-muted/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedProducts.size === moyskladProducts.length}
                        onCheckedChange={selectAllProducts}
                      />
                      <span className="text-sm text-muted-foreground">
                        Выбрано: {selectedProducts.size} из {moyskladProducts.length}
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
                        <TableHead>Название</TableHead>
                        <TableHead>Артикул</TableHead>
                        <TableHead>Код</TableHead>
                        <TableHead>Цена продажи</TableHead>
                        <TableHead>Закупочная</TableHead>
                        <TableHead>Остаток</TableHead>
                        <TableHead>Ед. изм.</TableHead>
                        <TableHead>Фото</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {moyskladProducts.map((product) => (
                        <TableRow 
                          key={product.id}
                          className={selectedProducts.has(product.id) ? "bg-primary/5" : ""}
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedProducts.has(product.id)}
                              onCheckedChange={() => toggleProductSelection(product.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{product.name}</TableCell>
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
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
