import { useState } from "react";
import { ShoppingCart, Heart, Star, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Тестовые данные товаров
const testProducts = [
  {
    id: "1",
    name: "Беспроводные наушники Premium",
    description: "Активное шумоподавление, 30 часов работы",
    price: 12990,
    comparePrice: 15990,
    images: ["https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop"],
    category: "Электроника",
    rating: 4.8,
    reviewsCount: 124,
    inStock: true,
  },
  {
    id: "2",
    name: "Умные часы Sport Pro",
    description: "GPS, пульсометр, водозащита IP68",
    price: 8490,
    comparePrice: null,
    images: ["https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop"],
    category: "Электроника",
    rating: 4.5,
    reviewsCount: 89,
    inStock: true,
  },
  {
    id: "3",
    name: "Кожаная сумка Classic",
    description: "Натуральная кожа, ручная работа",
    price: 7990,
    comparePrice: 9990,
    images: ["https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400&h=400&fit=crop"],
    category: "Аксессуары",
    rating: 4.9,
    reviewsCount: 56,
    inStock: true,
  },
  {
    id: "4",
    name: "Минималистичная лампа",
    description: "Скандинавский дизайн, LED",
    price: 3490,
    comparePrice: null,
    images: ["https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop"],
    category: "Дом",
    rating: 4.3,
    reviewsCount: 34,
    inStock: false,
  },
  {
    id: "5",
    name: "Кроссовки Urban Runner",
    description: "Легкие, дышащие, амортизация",
    price: 6990,
    comparePrice: 8990,
    images: ["https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=400&fit=crop"],
    category: "Обувь",
    rating: 4.7,
    reviewsCount: 203,
    inStock: true,
  },
  {
    id: "6",
    name: "Керамическая ваза",
    description: "Ручная роспись, авторская работа",
    price: 2490,
    comparePrice: null,
    images: ["https://images.unsplash.com/photo-1578500494198-246f612d3b3d?w=400&h=400&fit=crop"],
    category: "Дом",
    rating: 4.6,
    reviewsCount: 18,
    inStock: true,
  },
];

// Компонент карточки товара (формат списка)
function ProductCard({ product }: { product: typeof testProducts[0] }) {
  const [isLiked, setIsLiked] = useState(false);
  
  const discount = product.comparePrice 
    ? Math.round((1 - product.price / product.comparePrice) * 100) 
    : null;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("ru-RU").format(price) + " ₽";
  };

  return (
    <div className="flex bg-card border-b border-border/30 active:bg-muted/50 transition-colors">
      {/* Изображение */}
      <div className="relative w-28 h-28 sm:w-32 sm:h-32 flex-shrink-0 bg-muted">
        <img
          src={product.images[0]}
          alt={product.name}
          className="w-full h-full object-cover"
        />
        
        {/* Бейдж скидки */}
        {discount && (
          <Badge className="absolute top-1.5 left-1.5 bg-destructive text-destructive-foreground text-xs px-1.5 py-0.5">
            -{discount}%
          </Badge>
        )}
        
        {/* Нет в наличии */}
        {!product.inStock && (
          <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
            <span className="text-xs text-muted-foreground font-medium">Нет в наличии</span>
          </div>
        )}
      </div>

      {/* Информация */}
      <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
        <div className="space-y-1">
          {/* Название */}
          <h3 className="font-medium text-sm text-foreground line-clamp-2 leading-tight">
            {product.name}
          </h3>

          {/* Рейтинг */}
          <div className="flex items-center gap-1">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span className="text-xs font-medium">{product.rating}</span>
            <span className="text-xs text-muted-foreground">
              ({product.reviewsCount})
            </span>
          </div>
        </div>

        {/* Цена и действия */}
        <div className="flex items-end justify-between mt-2">
          <div className="flex flex-col">
            <span className="text-base font-bold text-foreground">
              {formatPrice(product.price)}
            </span>
            {product.comparePrice && (
              <span className="text-xs text-muted-foreground line-through">
                {formatPrice(product.comparePrice)}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsLiked(!isLiked);
              }}
              className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
            >
              <Heart
                className={`w-4 h-4 ${
                  isLiked ? "fill-destructive text-destructive" : "text-muted-foreground"
                }`}
              />
            </button>
            <Button 
              size="sm"
              className="h-8 px-3 text-xs"
              disabled={!product.inStock}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TestStore() {
  return (
    <div className="min-h-screen bg-background">
      {/* Шапка магазина */}
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="px-3 py-3 sm:px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                <Package className="w-4 h-4 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-bold text-base">Тестовый Магазин</h1>
              </div>
            </div>
            <Button variant="outline" size="sm" className="h-9 w-9 p-0">
              <ShoppingCart className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Контент */}
      <main>
        {/* Заголовок каталога */}
        <div className="px-3 py-3 sm:px-4 border-b border-border bg-muted/30">
          <h2 className="text-sm font-semibold text-foreground">Каталог товаров</h2>
          <p className="text-xs text-muted-foreground">
            {testProducts.length} товаров
          </p>
        </div>

        {/* Список товаров с отступом 1px */}
        <div className="flex flex-col gap-px bg-border">
          {testProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </main>
    </div>
  );
}
