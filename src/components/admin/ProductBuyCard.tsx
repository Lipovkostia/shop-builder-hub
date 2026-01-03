import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import {
  Product,
  formatPrice,
  calculateSalePrice,
  calculatePackagingPrices,
} from "./types";
import { useToast } from "@/hooks/use-toast";

interface ProductBuyCardProps {
  product: Product;
  onAddToCart: (item: {
    productId: string;
    productName: string;
    portionType: "full" | "half" | "quarter" | "portion";
    weight: number;
    price: number;
    quantity: number;
  }) => void;
}

export function ProductBuyCard({ product, onAddToCart }: ProductBuyCardProps) {
  const { toast } = useToast();

  const salePrice = product.buyPrice
    ? calculateSalePrice(product.buyPrice, product.markup)
    : product.pricePerUnit;

  const packagingPrices = calculatePackagingPrices(
    salePrice,
    product.unitWeight,
    product.packagingType,
    product.customVariantPrices,
    product.portionPrices
  );

  const handleAddToCart = (
    portionType: "full" | "half" | "quarter" | "portion",
    weight: number,
    price: number
  ) => {
    onAddToCart({
      productId: product.id,
      productName: product.name,
      portionType,
      weight,
      price,
      quantity: 1,
    });

    const portionLabels = {
      full: "Целая",
      half: "Половина",
      quarter: "Четверть",
      portion: "Порция",
    };

    toast({
      title: "Добавлено в корзину",
      description: `${product.name} — ${portionLabels[portionType]} (${weight} кг) за ${formatPrice(price)}`,
    });
  };

  // Для товаров с порциями (голова сыра и т.д.)
  if (packagingPrices && product.packagingType === "head" && product.unitWeight) {
    return (
      <Card className="overflow-hidden">
        <div className="relative">
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-48 object-cover"
          />
          {product.isHit && (
            <Badge className="absolute top-2 right-2 bg-red-500">ХИТ</Badge>
          )}
          {!product.inStock && (
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
              <Badge variant="secondary">Нет в наличии</Badge>
            </div>
          )}
        </div>

        <CardHeader className="pb-2">
          <h3 className="font-semibold text-lg">{product.name}</h3>
          {product.description && (
            <p className="text-sm text-muted-foreground">{product.description}</p>
          )}
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline">{formatPrice(salePrice)}/кг</Badge>
            <span className="text-xs text-muted-foreground">
              Вес: {product.unitWeight} кг
            </span>
          </div>
        </CardHeader>

        <CardContent className="pb-2">
          <p className="text-xs text-muted-foreground mb-2">Выберите порцию:</p>
        </CardContent>

        <CardFooter className="flex-col gap-2 pt-0">
          {/* Кнопка: Целая */}
          <Button
            variant="default"
            className="w-full justify-between"
            disabled={!product.inStock}
            onClick={() => handleAddToCart("full", product.unitWeight!, packagingPrices.full)}
          >
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              <span>Целиком ({product.unitWeight} кг)</span>
            </div>
            <span className="font-bold">{formatPrice(packagingPrices.full)}</span>
          </Button>

          {/* Кнопка: Половина */}
          <Button
            variant="secondary"
            className="w-full justify-between"
            disabled={!product.inStock}
            onClick={() => 
              handleAddToCart("half", product.unitWeight! / 2, packagingPrices.half)
            }
          >
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              <span>Половина ({(product.unitWeight! / 2).toFixed(1)} кг)</span>
            </div>
            <span className="font-bold">{formatPrice(packagingPrices.half)}</span>
          </Button>

          {/* Кнопка: Четверть */}
          <Button
            variant="secondary"
            className="w-full justify-between"
            disabled={!product.inStock}
            onClick={() =>
              handleAddToCart("quarter", product.unitWeight! / 4, packagingPrices.quarter)
            }
          >
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              <span>Четверть ({(product.unitWeight! / 4).toFixed(1)} кг)</span>
            </div>
            <span className="font-bold">{formatPrice(packagingPrices.quarter)}</span>
          </Button>

          {/* Кнопка: Порция (если настроена) */}
          {packagingPrices.portion && product.portionWeight && (
            <Button
              variant="outline"
              className="w-full justify-between"
              disabled={!product.inStock}
              onClick={() =>
                handleAddToCart("portion", product.portionWeight!, packagingPrices.portion!)
              }
            >
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                <span>Порция ({product.portionWeight} кг)</span>
              </div>
              <span className="font-bold">{formatPrice(packagingPrices.portion)}</span>
            </Button>
          )}
        </CardFooter>
      </Card>
    );
  }

  // Обычный товар (штучный или весовой без порций)
  return (
    <Card className="overflow-hidden">
      <div className="relative">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-48 object-cover"
        />
        {product.isHit && (
          <Badge className="absolute top-2 right-2 bg-red-500">ХИТ</Badge>
        )}
        {!product.inStock && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
            <Badge variant="secondary">Нет в наличии</Badge>
          </div>
        )}
      </div>

      <CardHeader className="pb-2">
        <h3 className="font-semibold text-lg">{product.name}</h3>
        {product.description && (
          <p className="text-sm text-muted-foreground">{product.description}</p>
        )}
      </CardHeader>

      <CardContent>
        <p className="text-2xl font-bold">
          {formatPrice(salePrice)}
          <span className="text-sm font-normal text-muted-foreground">/{product.unit}</span>
        </p>
      </CardContent>

      <CardFooter>
        <Button
          variant="default"
          className="w-full"
          disabled={!product.inStock}
          onClick={() => handleAddToCart("full", 1, salePrice)}
        >
          <ShoppingCart className="h-4 w-4 mr-2" />
          В корзину
        </Button>
      </CardFooter>
    </Card>
  );
}
