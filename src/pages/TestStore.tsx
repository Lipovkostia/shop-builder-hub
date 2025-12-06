import { useState } from "react";
import { ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Типы товаров
type ProductType = "weight" | "piece";

interface WeightVariant {
  type: "full" | "half" | "quarter";
  weight: number; // в кг
}

interface PieceVariant {
  type: "box" | "single";
  quantity: number;
}

interface Product {
  id: string;
  name: string;
  description: string;
  pricePerUnit: number; // цена за кг или за штуку
  unit: string;
  image: string;
  productType: ProductType;
  weightVariants?: WeightVariant[];
  pieceVariants?: PieceVariant[];
  inStock: boolean;
  isHit: boolean;
}

// Тестовые данные - сыры и хамон
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
];

// Форматирование цены
const formatPrice = (price: number) => {
  return new Intl.NumberFormat("ru-RU").format(Math.round(price)) + " ₽";
};

// Получение названия варианта веса
const getWeightLabel = (type: "full" | "half" | "quarter") => {
  switch (type) {
    case "full": return "Головка";
    case "half": return "½ головки";
    case "quarter": return "¼ головки";
  }
};

// Компонент индикатора порции (круг)
function PortionIndicator({ 
  type, 
  isSelected,
  onClick 
}: { 
  type: "full" | "half" | "quarter";
  isSelected: boolean;
  onClick: () => void;
}) {
  const getIndicatorStyle = () => {
    const baseClasses = "w-5 h-5 rounded-full border-2 border-primary cursor-pointer transition-all";
    
    if (type === "full") {
      return `${baseClasses} ${isSelected ? "bg-primary" : "bg-primary"}`;
    }
    if (type === "half") {
      return `${baseClasses} ${isSelected ? "bg-primary" : ""}`;
    }
    if (type === "quarter") {
      return `${baseClasses} ${isSelected ? "bg-primary" : ""}`;
    }
    return baseClasses;
  };

  const renderInnerContent = () => {
    if (type === "full") {
      return <div className="w-full h-full rounded-full bg-primary" />;
    }
    if (type === "half") {
      return (
        <div className="w-full h-full rounded-full overflow-hidden">
          <div className="w-1/2 h-full bg-primary" />
        </div>
      );
    }
    if (type === "quarter") {
      return (
        <div className="w-full h-full rounded-full overflow-hidden relative">
          <div 
            className="absolute top-0 left-0 w-1/2 h-1/2 bg-primary"
            style={{ borderBottomRightRadius: "100%" }}
          />
        </div>
      );
    }
    return null;
  };

  return (
    <button
      onClick={onClick}
      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all
        ${isSelected 
          ? "border-primary ring-2 ring-primary/30" 
          : "border-primary/60 hover:border-primary"
        }`}
    >
      <div className="w-4 h-4 rounded-full overflow-hidden relative">
        {renderInnerContent()}
      </div>
    </button>
  );
}

// Компонент карточки товара
function ProductCard({ product }: { product: Product }) {
  const [selectedVariant, setSelectedVariant] = useState<number>(0);

  const calculatePrice = () => {
    if (product.productType === "weight" && product.weightVariants) {
      const variant = product.weightVariants[selectedVariant];
      return product.pricePerUnit * variant.weight;
    }
    if (product.productType === "piece" && product.pieceVariants) {
      const variant = product.pieceVariants[selectedVariant];
      return product.pricePerUnit * variant.quantity;
    }
    return product.pricePerUnit;
  };

  const getSelectedWeight = () => {
    if (product.productType === "weight" && product.weightVariants) {
      return product.weightVariants[selectedVariant].weight;
    }
    return null;
  };

  const getSelectedQuantity = () => {
    if (product.productType === "piece" && product.pieceVariants) {
      return product.pieceVariants[selectedVariant].quantity;
    }
    return null;
  };

  return (
    <div className="flex items-start gap-3 p-3 bg-background border-b border-border">
      {/* Изображение */}
      <div className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-muted">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover"
        />
        {product.isHit && (
          <Badge className="absolute bottom-1 left-1 bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0.5 rounded">
            ХИТ
          </Badge>
        )}
      </div>

      {/* Информация о товаре */}
      <div className="flex-1 min-w-0">
        {/* Название */}
        <h3 className="font-semibold text-sm text-foreground leading-tight mb-0.5">
          {product.name}
        </h3>
        
        {/* Описание */}
        <p className="text-xs text-muted-foreground mb-1.5">
          {product.description}
        </p>

        {/* Цена за единицу */}
        <p className="text-sm font-medium text-foreground mb-2">
          {formatPrice(product.pricePerUnit)}/{product.unit}
        </p>

        {/* Варианты или статус */}
        {product.inStock ? (
          <div className="space-y-2">
            {/* Варианты по весу (сыр, хамон) */}
            {product.productType === "weight" && product.weightVariants && (
              <div className="flex flex-wrap items-center gap-2">
                {product.weightVariants.map((variant, index) => (
                  <button
                    key={variant.type}
                    onClick={() => setSelectedVariant(index)}
                    className={`flex items-center gap-1.5 h-9 px-3 rounded-full border text-xs transition-all
                      ${selectedVariant === index 
                        ? "border-primary bg-primary/10 text-primary font-medium" 
                        : "border-border hover:border-primary/50"
                      }`}
                  >
                    <PortionIndicator 
                      type={variant.type} 
                      isSelected={selectedVariant === index}
                      onClick={() => setSelectedVariant(index)}
                    />
                    <span className="flex flex-col items-start leading-tight">
                      <span className="font-medium">
                        {formatPrice(product.pricePerUnit * variant.weight)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        ~{variant.weight} кг
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Варианты по штукам */}
            {product.productType === "piece" && product.pieceVariants && (
              <div className="flex flex-wrap items-center gap-2">
                {product.pieceVariants.map((variant, index) => (
                  <button
                    key={variant.type}
                    onClick={() => setSelectedVariant(index)}
                    className={`flex items-center gap-1.5 h-9 px-3 rounded-full border text-xs transition-all
                      ${selectedVariant === index 
                        ? "border-primary bg-primary/10 text-primary font-medium" 
                        : "border-border hover:border-primary/50"
                      }`}
                  >
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold
                      ${variant.type === "box" 
                        ? "bg-primary text-primary-foreground" 
                        : "border-2 border-primary text-primary"
                      }`}
                    >
                      {variant.quantity}
                    </span>
                    <span className="flex flex-col items-start leading-tight">
                      <span className="font-medium">
                        {formatPrice(product.pricePerUnit * variant.quantity)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {variant.type === "box" ? "коробка" : "штука"}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <button
            className="h-9 px-4 text-xs rounded-full bg-muted text-muted-foreground cursor-not-allowed"
            disabled
          >
            Нет в наличии
          </button>
        )}
      </div>
    </div>
  );
}

// Компонент шапки
function StoreHeader() {
  const [cartItems] = useState(3);
  const [cartTotal] = useState(47850);

  return (
    <header className="sticky top-0 z-50 bg-background border-b border-border">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Логотип и название */}
        <div>
          <h1 className="font-bold text-lg text-foreground">Сыры & Хамон</h1>
          <p className="text-xs text-muted-foreground">Оптовый каталог</p>
        </div>

        {/* Корзина */}
        <button className="relative flex items-center gap-2 bg-primary/10 hover:bg-primary/20 transition-colors rounded-full py-2 px-4">
          <ShoppingCart className="w-5 h-5 text-primary" />
          <div className="text-sm text-right">
            <p className="font-semibold text-foreground">{formatPrice(cartTotal)}</p>
          </div>
          {cartItems > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-xs font-bold rounded-full flex items-center justify-center">
              {cartItems}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}

export default function TestStore() {
  return (
    <div className="min-h-screen bg-background">
      <StoreHeader />

      {/* Список товаров */}
      <main>
        <div className="flex flex-col">
          {testProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </main>
    </div>
  );
}
