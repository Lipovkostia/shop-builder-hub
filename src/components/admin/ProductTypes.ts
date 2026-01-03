export type ProductType = "weight" | "piece";

// Тип упаковки товара
export type PackagingType = "head" | "package" | "piece" | "can" | "box";

export interface WeightVariant {
  type: "full" | "half" | "quarter";
  weight: number;
}

export interface PieceVariant {
  type: "box" | "single";
  quantity: number;
}

// Настройки наценки
export interface MarkupSettings {
  type: "percent" | "rubles";
  value: number;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  pricePerUnit: number; // Цена за единицу (кг или шт)
  unit: string; // Единица измерения (кг, шт, л и т.д.)
  image: string;
  imageFull?: string;
  productType: ProductType;
  packagingType?: PackagingType; // Тип упаковки (голова, ящик и т.д.)
  unitWeight?: number; // Вес единицы товара (для головки сыра и т.д.)
  weightVariants?: WeightVariant[];
  pieceVariants?: PieceVariant[];
  inStock: boolean;
  isHit: boolean;
  source?: "local" | "moysklad";
  moyskladId?: string;
  autoSync?: boolean;
  buyPrice?: number; // Себестоимость
  markup?: MarkupSettings; // Наценка
  accountId?: string;
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
  productIds: string[];
  createdAt: string;
}

// Вспомогательные функции
export const formatPrice = (price: number) => {
  return new Intl.NumberFormat("ru-RU").format(Math.round(price)) + " ₽";
};

// Расчёт цены продажи с учётом наценки
export const calculateSalePrice = (buyPrice: number, markup?: MarkupSettings): number => {
  if (!markup || !buyPrice) return buyPrice;
  
  if (markup.type === "percent") {
    return buyPrice * (1 + markup.value / 100);
  } else {
    return buyPrice + markup.value;
  }
};

// Расчёт цен для различных вариантов (целая головка, половина, четверть)
export const calculatePackagingPrices = (
  pricePerKg: number,
  unitWeight?: number,
  packagingType?: PackagingType
): { full: number; half: number; quarter: number } | null => {
  if (!unitWeight || packagingType !== "head") return null;
  
  return {
    full: pricePerKg * unitWeight,
    half: pricePerKg * (unitWeight / 2),
    quarter: pricePerKg * (unitWeight / 4),
  };
};

// Названия типов упаковки
export const packagingTypeLabels: Record<PackagingType, string> = {
  head: "Голова",
  package: "Упаковка",
  piece: "Штука",
  can: "Банка",
  box: "Ящик",
};

// Единицы измерения
export const unitOptions = [
  { value: "кг", label: "кг" },
  { value: "шт", label: "шт" },
  { value: "л", label: "л" },
  { value: "уп", label: "уп" },
  { value: "г", label: "г" },
  { value: "мл", label: "мл" },
];
