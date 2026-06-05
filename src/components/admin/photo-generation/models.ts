export interface KieModel {
  id: string;
  label: string;
  /** USD per image (примерные цены kie.ai) */
  priceUsd: number;
  /** Supports image-to-image editing (requires source) */
  supportsEdit: boolean;
  /** Supports pure text-to-image */
  supportsTextToImage: boolean;
  description?: string;
  /** Optional fixed resolution param to send to kie.ai (для Nano Banana 2) */
  resolution?: "1K" | "2K" | "4K";
}

// Точные ID моделей kie.ai (см. docs.kie.ai/market/...)
export const KIE_MODELS: KieModel[] = [
  {
    id: "google/nano-banana-edit",
    label: "Nano Banana Edit — редактор фото (Gemini)",
    priceUsd: 0.02,
    supportsEdit: true,
    supportsTextToImage: false,
    description: "Дешёвая и быстрая модель. Берёт ваше фото и меняет фон/сцену. Лучший выбор для повседневной обработки товаров.",
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
    id: "nano-banana-2",
    label: "Nano Banana 2 · 1K — улучшенное качество",
    priceUsd: 0.04,
    supportsEdit: true,
    supportsTextToImage: true,
    resolution: "1K",
    description: "Новая Nano Banana 2 в 1K. Лучше детали и текст на упаковке. Цена средняя.",
  },
  {
    id: "nano-banana-2",
    label: "Nano Banana 2 · 2K — высокое качество",
    priceUsd: 0.06,
    supportsEdit: true,
    supportsTextToImage: true,
    resolution: "2K",
    description: "Nano Banana 2 в 2K. Подходит для карточек товара и баннеров.",
  },
  {
    id: "nano-banana-2",
    label: "Nano Banana 2 · 4K — максимум качества",
    priceUsd: 0.09,
    supportsEdit: true,
    supportsTextToImage: true,
    resolution: "4K",
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

// Уникальный ключ модели для UI (id + resolution)
export function modelKey(m: KieModel): string {
  return m.resolution ? `${m.id}@${m.resolution}` : m.id;
}

export function findModelByKey(key: string): KieModel | undefined {
  return KIE_MODELS.find((m) => modelKey(m) === key);
}

export const DEFAULT_USD_RUB = 95;

export function formatRub(value: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: value < 10 ? 2 : 0,
  }).format(value);
}
