// Типы для продуктов
export type ProductType = "weight" | "piece";
export type PackagingType = "head" | "package" | "piece" | "can" | "box";

export interface WeightVariant {
  type: "full" | "half" | "quarter";
  weight: number;
}

export interface PieceVariant {
  type: "box" | "single";
  quantity: number;
}

export interface MarkupSettings {
  type: "percent" | "rubles";
  value: number;
}

// Цены для порций (целая, половина, четверть, порция)
export interface PortionPrices {
  fullPricePerKg?: number;      // Цена за кг при покупке целиком
  halfPricePerKg?: number;      // Цена за кг при покупке половины
  quarterPricePerKg?: number;   // Цена за кг при покупке четверти
  portionPrice?: number;        // Фикс. цена за порцию (шт)
}

export interface CustomVariantPrices {
  halfPrice?: number;
  quarterPrice?: number;
}

export type ProductStatus = "in_stock" | "out_of_stock" | "hidden";

export interface Product {
  id: string;
  name: string;
  description: string;
  pricePerUnit: number;
  unit: string;
  image: string;
  imageFull?: string;
  productType: ProductType;
  packagingType?: PackagingType;
  unitWeight?: number;
  portionWeight?: number;       // Вес порции (для кнопки "Купить порцию")
  weightVariants?: WeightVariant[];
  pieceVariants?: PieceVariant[];
  inStock: boolean;
  isHit: boolean;
  status?: ProductStatus;       // Статус товара: в наличии, нет, скрыт
  source?: "local" | "moysklad";
  moyskladId?: string;
  autoSync?: boolean;
  buyPrice?: number;
  markup?: MarkupSettings;
  accountId?: string;
  customVariantPrices?: CustomVariantPrices;
  portionPrices?: PortionPrices;  // Цены для порций
  roleVisibility?: string[];      // ID ролей которые видят товар
  category?: string;              // Категория товара (legacy, для обратной совместимости)
  categories?: string[];          // Категории товара (массив ID категорий)
}

// Категория товара
export interface Category {
  id: string;
  name: string;
}

export interface MoySkladProduct {
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

export interface MoySkladAccount {
  id: string;
  login: string;
  password: string;
  name: string;
  lastSync?: string;
}

export interface Catalog {
  id: string;
  name: string;
  description?: string;
  productIds: string[];
  categoryIds?: string[];  // Категории в которых будет отображаться прайс-лист
  createdAt: string;
}

// Роль клиента
export interface CustomerRole {
  id: string;
  store_id: string;
  name: string;
  description?: string;
  sort_order: number;
  created_at: string;
}

// Наценка для роли
export interface RoleProductPricing {
  id: string;
  product_id: string;
  role_id: string;
  markup_type: "percent" | "rubles";
  markup_value: number;
}

// Вспомогательные функции
export const formatPrice = (price: number) => {
  return new Intl.NumberFormat("ru-RU").format(Math.round(price)) + " ₽";
};

export const calculateSalePrice = (buyPrice: number, markup?: MarkupSettings): number => {
  if (!markup || !buyPrice) return buyPrice;
  
  if (markup.type === "percent") {
    return buyPrice * (1 + markup.value / 100);
  } else {
    return buyPrice + markup.value;
  }
};

// Расчёт цен для различных вариантов
export const calculatePackagingPrices = (
  pricePerKg: number,
  unitWeight?: number,
  packagingType?: PackagingType,
  customVariantPrices?: CustomVariantPrices,
  portionPrices?: PortionPrices
): { 
  full: number; 
  half: number; 
  quarter: number; 
  portion?: number;
  isFullCustom: boolean;
  isHalfCustom: boolean; 
  isQuarterCustom: boolean;
  fullPricePerKg: number;
  halfPricePerKg: number;
  quarterPricePerKg: number;
} | null => {
  if (!unitWeight || packagingType !== "head") return null;
  
  // Цены за кг для каждой порции (по умолчанию = базовая цена)
  const fullPricePerKg = portionPrices?.fullPricePerKg ?? pricePerKg;
  const halfPricePerKg = portionPrices?.halfPricePerKg ?? pricePerKg;
  const quarterPricePerKg = portionPrices?.quarterPricePerKg ?? pricePerKg;
  
  const calculatedFull = fullPricePerKg * unitWeight;
  const calculatedHalf = halfPricePerKg * (unitWeight / 2);
  const calculatedQuarter = quarterPricePerKg * (unitWeight / 4);
  
  return {
    full: calculatedFull,
    half: calculatedHalf,
    quarter: calculatedQuarter,
    portion: portionPrices?.portionPrice,
    isFullCustom: portionPrices?.fullPricePerKg !== undefined,
    isHalfCustom: portionPrices?.halfPricePerKg !== undefined,
    isQuarterCustom: portionPrices?.quarterPricePerKg !== undefined,
    fullPricePerKg,
    halfPricePerKg,
    quarterPricePerKg,
  };
};

export const packagingTypeLabels: Record<PackagingType, string> = {
  head: "Голова",
  package: "Упаковка",
  piece: "Штука",
  can: "Банка",
  box: "Ящик",
};

export const unitOptions = [
  { value: "кг", label: "кг" },
  { value: "шт", label: "шт" },
  { value: "л", label: "л" },
  { value: "уп", label: "уп" },
  { value: "г", label: "г" },
  { value: "мл", label: "мл" },
];
