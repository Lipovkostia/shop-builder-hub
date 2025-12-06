import { useState } from "react";
import { ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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

interface CartItem {
  productId: string;
  variantIndex: number;
  quantity: number;
  price: number;
}

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

// Индикатор порции
function PortionIndicator({ type }: { type: "full" | "half" | "quarter" }) {
  return (
    <div className="w-3.5 h-3.5 rounded-full overflow-hidden border border-primary bg-background">
      {type === "full" && <div className="w-full h-full bg-primary" />}
      {type === "half" && <div className="w-1/2 h-full bg-primary" />}
      {type === "quarter" && (
        <div className="w-1/2 h-1/2 bg-primary" style={{ borderBottomRightRadius: "100%" }} />
      )}
    </div>
  );
}

// Карточка товара
function ProductCard({ 
  product, 
  cart, 
  onAddToCart 
}: { 
  product: Product;
  cart: CartItem[];
  onAddToCart: (productId: string, variantIndex: number, price: number) => void;
}) {
  const getCartQuantity = (variantIndex: number) => {
    const item = cart.find(
      (c) => c.productId === product.id && c.variantIndex === variantIndex
    );
    return item?.quantity || 0;
  };

  return (
    <div className="flex gap-1.5 px-1.5 py-1 h-[calc((100vh-44px)/8)] min-h-[72px] bg-background border-b border-border">
      {/* Изображение */}
      <div className="relative w-14 h-14 flex-shrink-0 rounded overflow-hidden bg-muted self-center">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover"
        />
        {product.isHit && (
          <Badge className="absolute -top-0.5 -left-0.5 bg-destructive text-destructive-foreground text-[8px] px-1 py-0 rounded leading-tight">
            ХИТ
          </Badge>
        )}
      </div>

      {/* Контент справа */}
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
        {/* Название с эффектом затухания */}
        <div className="relative overflow-hidden">
          <h3 className="font-medium text-xs text-foreground leading-tight whitespace-nowrap pr-4">
            {product.name} · {formatPrice(product.pricePerUnit)}/{product.unit}
          </h3>
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent" />
        </div>

        {/* Кнопки */}
        <div className="flex items-center gap-0.5">
          {product.inStock ? (
            <>
              {product.productType === "weight" && product.weightVariants?.map((variant, idx) => {
                const qty = getCartQuantity(idx);
                const price = product.pricePerUnit * variant.weight;
                return (
                  <button
                    key={variant.type}
                    onClick={() => onAddToCart(product.id, idx, price)}
                    className="relative flex flex-col items-center justify-center h-9 w-14 rounded border border-border hover:border-primary hover:bg-primary/5 transition-all"
                  >
                    {qty > 0 && (
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center">
                        {qty}
                      </span>
                    )}
                    <PortionIndicator type={variant.type} />
                    <span className="text-[9px] font-medium text-foreground leading-none mt-0.5">
                      {formatPrice(price)}
                    </span>
                  </button>
                );
              })}

              {product.productType === "piece" && product.pieceVariants?.map((variant, idx) => {
                const qty = getCartQuantity(idx);
                const price = product.pricePerUnit * variant.quantity;
                return (
                  <button
                    key={variant.type}
                    onClick={() => onAddToCart(product.id, idx, price)}
                    className="relative flex flex-col items-center justify-center h-9 w-14 rounded border border-border hover:border-primary hover:bg-primary/5 transition-all"
                  >
                    {qty > 0 && (
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center">
                        {qty}
                      </span>
                    )}
                    <span className={`w-3 h-3 rounded-full flex items-center justify-center text-[8px] font-bold ${
                      variant.type === "box" ? "bg-primary text-primary-foreground" : "border border-primary text-primary"
                    }`}>
                      {variant.quantity}
                    </span>
                    <span className="text-[9px] font-medium text-foreground leading-none mt-0.5">
                      {formatPrice(price)}
                    </span>
                  </button>
                );
              })}
            </>
          ) : (
            <span className="text-[10px] text-muted-foreground">Нет в наличии</span>
          )}
        </div>
      </div>
    </div>
  );
}

// Шапка
function StoreHeader({ cart }: { cart: CartItem[] }) {
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <header className="sticky top-0 z-50 bg-background border-b border-border h-12 flex items-center justify-between px-3">
      <div>
        <h1 className="font-bold text-sm text-foreground leading-tight">Сыры & Хамон</h1>
        <p className="text-[10px] text-muted-foreground leading-tight">Оптовый каталог</p>
      </div>

      <button className="relative flex items-center gap-1.5 bg-primary/10 hover:bg-primary/20 transition-colors rounded-full py-1.5 px-3">
        <ShoppingCart className="w-4 h-4 text-primary" />
        <span className="text-xs font-semibold text-foreground">{formatPrice(totalPrice)}</span>
        {totalItems > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
            {totalItems}
          </span>
        )}
      </button>
    </header>
  );
}

export default function TestStore() {
  const [cart, setCart] = useState<CartItem[]>([]);

  const handleAddToCart = (productId: string, variantIndex: number, price: number) => {
    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.productId === productId && item.variantIndex === variantIndex
      );
      
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex].quantity += 1;
        return updated;
      }
      
      return [...prev, { productId, variantIndex, quantity: 1, price }];
    });
  };

  return (
    <div className="h-screen bg-background flex flex-col">
      <StoreHeader cart={cart} />
      <main className="flex-1 overflow-auto">
        {testProducts.map((product) => (
          <ProductCard 
            key={product.id} 
            product={product} 
            cart={cart}
            onAddToCart={handleAddToCart}
          />
        ))}
      </main>
    </div>
  );
}
