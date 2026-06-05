export interface KieModel {
  /** Уникальный ключ модели для UI и edge-функции. Может содержать суффикс `:1K|:2K|:4K`. */
  id: string;
  label: string;
  /** USD per image (примерные цены kie.ai) */
  priceUsd: number;
  /** Supports image-to-image editing (requires source) */
  supportsEdit: boolean;
  /** Supports pure text-to-image */
  supportsTextToImage: boolean;
  description?: string;
}

/**
 * Точные ID моделей kie.ai (см. docs.kie.ai/market/...).
 * Edge-функция `generate-product-image` разбирает суффикс `:1K|:2K|:4K`
 * и подставляет нужный параметр resolution для семейства Nano Banana 2.
 */
export const KIE_MODELS: KieModel[] = [
  {
    id: "google/nano-banana-edit",
    label: "Nano Banana Edit — редактор фото (Gemini)",
    priceUsd: 0.02,
    supportsEdit: true,
    supportsTextToImage: false,
    description: "Самая дешёвая и быстрая. Берёт ваше фото и меняет фон/сцену по описанию. Лучший выбор для повседневной обработки товаров.",
  },
  {
    id: "google/nano-banana",
    label: "Nano Banana — генерация с нуля (Gemini)",
    priceUsd: 0.02,
    supportsEdit: false,
    supportsTextToImage: true,
    description: "Дешёвая и быстрая. Создаёт фото только по тексту, без исходника. Подходит когда нет фото товара.",
  },
  {
    id: "nano-banana-2:1K",
    label: "Nano Banana 2 · 1K — улучшенное качество",
    priceUsd: 0.04,
    supportsEdit: true,
    supportsTextToImage: true,
    description: "Новая Nano Banana 2 в 1K. Лучше детали и текст на упаковке. Средняя цена.",
  },
  {
    id: "nano-banana-2:2K",
    label: "Nano Banana 2 · 2K — высокое качество",
    priceUsd: 0.06,
    supportsEdit: true,
    supportsTextToImage: true,
    description: "Nano Banana 2 в 2K. Подходит для карточек товара и баннеров.",
  },
  {
    id: "nano-banana-2:4K",
    label: "Nano Banana 2 · 4K — максимум качества",
    priceUsd: 0.09,
    supportsEdit: true,
    supportsTextToImage: true,
    description: "Nano Banana 2 в 4K. Для постеров и больших рендеров. Самая дорогая Nano Banana.",
  },
  {
    id: "bytedance/seedream-v4-edit",
    label: "Seedream 4 Edit — редактирование фото",
    priceUsd: 0.04,
    supportsEdit: true,
    supportsTextToImage: false,
    description: "ByteDance Seedream 4. Хорошо переносит товар в новые сцены, реалистичный свет.",
  },
  {
    id: "bytedance/seedream-v4-text-to-image",
    label: "Seedream 4 — генерация с нуля",
    priceUsd: 0.03,
    supportsEdit: false,
    supportsTextToImage: true,
    description: "ByteDance Seedream 4. Создаёт фото по тексту, реалистичные товары и обстановка.",
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
