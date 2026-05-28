export interface KieModel {
  id: string;
  label: string;
  /** USD per image */
  priceUsd: number;
  /** Supports image-to-image editing (requires source) */
  supportsEdit: boolean;
  /** Supports pure text-to-image */
  supportsTextToImage: boolean;
  description?: string;
}

// Approximate kie.ai pricing — easy to adjust in one place
export const KIE_MODELS: KieModel[] = [
  {
    id: "google/nano-banana-edit",
    label: "Nano Banana Edit (Gemini)",
    priceUsd: 0.02,
    supportsEdit: true,
    supportsTextToImage: false,
    description: "Редактирование исходного фото — лучший выбор для товаров",
  },
  {
    id: "google/nano-banana",
    label: "Nano Banana (Gemini)",
    priceUsd: 0.02,
    supportsEdit: false,
    supportsTextToImage: true,
    description: "Генерация фото с нуля по описанию",
  },
  {
    id: "bytedance/seedream-4",
    label: "Seedream 4 (ByteDance)",
    priceUsd: 0.03,
    supportsEdit: true,
    supportsTextToImage: true,
    description: "Высокая детализация, реалистичные товары",
  },
  {
    id: "black-forest-labs/flux-kontext-pro",
    label: "Flux Kontext Pro",
    priceUsd: 0.04,
    supportsEdit: true,
    supportsTextToImage: true,
    description: "Премиум качество, точное следование промпту",
  },
  {
    id: "black-forest-labs/flux-kontext-max",
    label: "Flux Kontext Max",
    priceUsd: 0.08,
    supportsEdit: true,
    supportsTextToImage: true,
    description: "Максимальное качество, для финальных рендеров",
  },
];

export const DEFAULT_USD_RUB = 95;

export function formatRub(value: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: value < 10 ? 2 : 0,
  }).format(value);
}
