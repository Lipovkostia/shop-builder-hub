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

// Компонент карточки товара
function ProductCard({ product }: { product: typeof testProducts[0] }) {
  const [isLiked, setIsLiked] = useState(false);
  
  const discount = product.comparePrice 
    ? Math.round((1 - product.price / product.comparePrice) * 100) 
    : null;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("ru-RU").format(price) + " ₽";
  };

  return (
    <div className="group relative bg-card rounded-2xl overflow-hidden border border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
      {/* Изображение */}
      <div className="relative aspect-square overflow-hidden bg-muted">
        <img
          src={product.images[0]}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        
        {/* Бейджи */}
        <div className="absolute top-3 left-3 flex flex-col gap-2">
          {discount && (
            <Badge className="bg-destructive text-destructive-foreground font-semibold">
              -{discount}%
            </Badge>
          )}
          {!product.inStock && (
            <Badge variant="secondary" className="bg-muted/90 backdrop-blur-sm">
              Нет в наличии
            </Badge>
          )}
        </div>

        {/* Кнопка избранного */}
        <button
          onClick={() => setIsLiked(!isLiked)}
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center transition-all hover:bg-background hover:scale-110"
        >
          <Heart
            className={`w-5 h-5 transition-colors ${
              isLiked ? "fill-destructive text-destructive" : "text-muted-foreground"
            }`}
          />
        </button>

        {/* Быстрая покупка (появляется при наведении) */}
        <div className="absolute inset-x-3 bottom-3 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
          <Button 
            className="w-full gap-2" 
            disabled={!product.inStock}
          >
            <ShoppingCart className="w-4 h-4" />
            В корзину
          </Button>
        </div>
      </div>

      {/* Информация */}
      <div className="p-4 space-y-2">
        {/* Категория */}
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          {product.category}
        </span>

        {/* Название */}
        <h3 className="font-medium text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
          {product.name}
        </h3>

        {/* Описание */}
        <p className="text-sm text-muted-foreground line-clamp-1">
          {product.description}
        </p>

        {/* Рейтинг */}
        <div className="flex items-center gap-1.5">
          <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
          <span className="text-sm font-medium">{product.rating}</span>
          <span className="text-sm text-muted-foreground">
            ({product.reviewsCount})
          </span>
        </div>

        {/* Цена */}
        <div className="flex items-baseline gap-2 pt-1">
          <span className="text-lg font-bold text-foreground">
            {formatPrice(product.price)}
          </span>
          {product.comparePrice && (
            <span className="text-sm text-muted-foreground line-through">
              {formatPrice(product.comparePrice)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TestStore() {
  return (
    <div className="min-h-screen bg-background">
      {/* Шапка магазина */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                <Package className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-bold text-lg">Тестовый Магазин</h1>
                <p className="text-xs text-muted-foreground">Дизайн карточек товаров</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="gap-2">
              <ShoppingCart className="w-4 h-4" />
              Корзина
            </Button>
          </div>
        </div>
      </header>

      {/* Контент */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-2">Каталог товаров</h2>
          <p className="text-muted-foreground">
            Тестовые карточки для отработки дизайна
          </p>
        </div>

        {/* Сетка товаров */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {testProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </main>
    </div>
  );
}
