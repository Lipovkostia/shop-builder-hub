import { useState } from "react";
import { Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// Тестовые данные товаров
const testProducts = [
  {
    id: "1",
    name: "Беспроводные наушники Premium",
    description: "Активное шумоподавление",
    price: 12990,
    unit: "шт",
    weight: "0.3 кг",
    images: ["https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop"],
    variants: [
      { label: "1 шт", price: 12990 },
      { label: "2 шт", price: 24990 },
    ],
    inStock: true,
    isHit: true,
  },
  {
    id: "2",
    name: "Умные часы Sport Pro",
    description: "GPS, пульсометр, водозащита",
    price: 8490,
    unit: "шт",
    weight: "0.15 кг",
    images: ["https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop"],
    variants: [
      { label: "1 шт", price: 8490 },
    ],
    inStock: true,
    isHit: false,
  },
  {
    id: "3",
    name: "Кожаная сумка Classic",
    description: "Натуральная кожа",
    price: 7990,
    unit: "шт",
    weight: "0.8 кг",
    images: ["https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400&h=400&fit=crop"],
    variants: [],
    inStock: false,
    isHit: false,
  },
  {
    id: "4",
    name: "Минималистичная лампа",
    description: "Скандинавский дизайн, LED",
    price: 3490,
    unit: "шт",
    weight: "1.2 кг",
    images: ["https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop"],
    variants: [],
    inStock: false,
    isHit: false,
  },
  {
    id: "5",
    name: "Кроссовки Urban Runner",
    description: "Легкие, дышащие",
    price: 6990,
    unit: "пара",
    weight: "0.6 кг",
    images: ["https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=400&fit=crop"],
    variants: [
      { label: "1 пара", price: 6990 },
      { label: "2 пары", price: 12990 },
    ],
    inStock: true,
    isHit: true,
  },
  {
    id: "6",
    name: "Керамическая ваза",
    description: "Ручная роспись",
    price: 2490,
    unit: "шт",
    weight: "0.5 кг",
    images: ["https://images.unsplash.com/photo-1578500494198-246f612d3b3d?w=400&h=400&fit=crop"],
    variants: [
      { label: "1 шт", price: 2490 },
    ],
    inStock: true,
    isHit: false,
  },
];

// Форматирование цены
const formatPrice = (price: number) => {
  return new Intl.NumberFormat("ru-RU").format(price) + " ₽";
};

// Компонент карточки товара
function ProductCard({ product }: { product: typeof testProducts[0] }) {
  return (
    <div className="flex items-start gap-3 p-3 bg-background border-b border-border">
      {/* Изображение */}
      <div className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-muted">
        <img
          src={product.images[0]}
          alt={product.name}
          className="w-full h-full object-cover"
        />
        {/* Бейдж ХИТ */}
        {product.isHit && (
          <Badge className="absolute bottom-1 left-1 bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0.5 rounded">
            ХИТ
          </Badge>
        )}
      </div>

      {/* Информация о товаре */}
      <div className="flex-1 min-w-0">
        {/* Название */}
        <h3 className="font-semibold text-sm text-foreground leading-tight mb-1">
          {product.name}
        </h3>
        
        {/* Цена и вес */}
        <p className="text-sm text-muted-foreground mb-2">
          {formatPrice(product.price)}/{product.unit} · {product.weight}
        </p>

        {/* Варианты или статус */}
        <div className="flex flex-wrap items-center gap-2">
          {product.inStock ? (
            product.variants.length > 0 ? (
              product.variants.map((variant, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs rounded-full border-primary/30 hover:bg-primary/10 hover:border-primary"
                >
                  <span className={`w-2 h-2 rounded-full mr-1.5 ${
                    index === 0 ? 'bg-primary/30' : index === 1 ? 'bg-primary/60' : 'bg-primary'
                  }`} />
                  {formatPrice(variant.price)}
                </Button>
              ))
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs rounded-full border-primary/30 hover:bg-primary/10 hover:border-primary"
              >
                <span className="w-2 h-2 rounded-full mr-1.5 bg-primary" />
                {formatPrice(product.price)}
              </Button>
            )
          ) : (
            <Button
              variant="secondary"
              size="sm"
              className="h-8 px-4 text-xs rounded-full bg-muted text-muted-foreground"
              disabled
            >
              Нет в наличии
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Компонент шапки с корзиной
function StoreHeader() {
  const [cartItems] = useState(2);
  const [cartWeight] = useState(3.97);
  const [cartTotal] = useState(9937.5);

  return (
    <header className="sticky top-0 z-50 bg-background border-b border-border">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Корзина */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Truck className="w-10 h-10 text-primary" strokeWidth={1.5} />
            {cartItems > 0 && (
              <span className="absolute -top-1 -left-1 w-5 h-5 bg-destructive text-destructive-foreground text-xs font-bold rounded-full flex items-center justify-center">
                {cartItems}
              </span>
            )}
          </div>
          <div className="text-sm">
            <p className="text-foreground">
              Позиций: <span className="font-medium">{cartItems}</span>
            </p>
            <p className="text-muted-foreground">
              Вес, кг: ~{cartWeight}
            </p>
            <p className="text-muted-foreground">
              Сумма, ₽: {new Intl.NumberFormat("ru-RU").format(cartTotal)}
            </p>
          </div>
        </div>

        {/* Авторизация */}
        <div className="flex items-center gap-2 text-sm">
          <button className="text-foreground hover:text-primary transition-colors">
            Войти
          </button>
          <span className="text-border">|</span>
          <button className="text-primary font-medium hover:text-primary/80 transition-colors">
            Регистрация
          </button>
        </div>
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
