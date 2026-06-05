/**
 * Каталог моделей генерации изображений kie.ai.
 *
 * Источник: https://docs.kie.ai (раздел Image Models).
 * Каждая модель помечена `family` — кодом семейства, по которому
 * edge-функция `generate-product-image` собирает корректный `input`
 * (у разных моделей разные параметры: image_urls / image_input / input_urls /
 * image_url, aspect_ratio / image_size, resolution / image_resolution и т.д.).
 *
 * Цены — ориентировочные (USD за 1 изображение). Если не указана точная цена
 * у kie.ai — оставлено 0 (в UI цена не показывается).
 */
export type ModelFamily =
  | "nano-banana"
  | "nano-banana-edit"
  | "nano-banana-2"
  | "nano-banana-pro"
  | "imagen4"
  | "seedream-v3"
  | "seedream-v4-t2i"
  | "seedream-v4-edit"
  | "seedream-4-5-t2i"
  | "seedream-4-5-edit"
  | "z-image"
  | "flux2-t2i"
  | "flux2-i2i"
  | "grok-t2i"
  | "grok-i2i"
  | "gpt-image-1-5-t2i"
  | "gpt-image-1-5-i2i"
  | "gpt-image-2-t2i"
  | "gpt-image-2-i2i"
  | "ideogram-v3-t2i"
  | "ideogram-v3-edit"
  | "ideogram-v3-remix"
  | "ideogram-character"
  | "ideogram-character-edit"
  | "ideogram-character-remix"
  | "qwen-t2i"
  | "qwen-i2i"
  | "qwen-edit"
  | "qwen2-t2i"
  | "qwen2-edit"
  | "wan-image"
  | "topaz-upscale"
  | "recraft-utility"
  // ───── Видео ─────
  | "kling-t2v"
  | "kling-i2v"
  | "seedance-t2v"
  | "seedance-i2v"
  | "hailuo-t2v"
  | "hailuo-i2v"
  | "veo3-t2v"
  | "veo3-i2v";

export interface KieModel {
  /** Уникальный ключ. Суффикс `:1K|:2K|:4K` = разрешение, `:5s|:10s` = длительность видео. */
  id: string;
  /** Имя модели в API kie.ai (без суффикса). */
  apiModel: string;
  family: ModelFamily;
  group: string;
  label: string;
  /** USD за 1 генерацию (0 — не показывать цену) */
  priceUsd: number;
  supportsEdit: boolean;
  supportsTextToImage: boolean;
  /** Тип результата: фото (по умолчанию) или видео */
  kind?: "image" | "video";
  description?: string;
}

export const KIE_MODELS: KieModel[] = [
  // ───────────── Google · Nano Banana ─────────────
  {
    id: "google/nano-banana-edit",
    apiModel: "google/nano-banana-edit",
    family: "nano-banana-edit",
    group: "Google · Nano Banana",
    label: "Nano Banana Edit — редактор фото (Gemini)",
    priceUsd: 0.02,
    supportsEdit: true,
    supportsTextToImage: false,
    description: "Самая дешёвая. Меняет фон/сцену вашего фото по описанию.",
  },
  {
    id: "google/nano-banana",
    apiModel: "google/nano-banana",
    family: "nano-banana",
    group: "Google · Nano Banana",
    label: "Nano Banana — генерация с нуля (Gemini)",
    priceUsd: 0.02,
    supportsEdit: false,
    supportsTextToImage: true,
    description: "Быстрая текст→картинка, когда нет исходного фото.",
  },
  {
    id: "nano-banana-2:1K",
    apiModel: "nano-banana-2",
    family: "nano-banana-2",
    group: "Google · Nano Banana 2",
    label: "Nano Banana 2 · 1K",
    priceUsd: 0.04,
    supportsEdit: true,
    supportsTextToImage: true,
    description: "Улучшенное качество, отличный текст на упаковке.",
  },
  {
    id: "nano-banana-2:2K",
    apiModel: "nano-banana-2",
    family: "nano-banana-2",
    group: "Google · Nano Banana 2",
    label: "Nano Banana 2 · 2K",
    priceUsd: 0.06,
    supportsEdit: true,
    supportsTextToImage: true,
    description: "2K — для карточек товара и баннеров.",
  },
  {
    id: "nano-banana-2:4K",
    apiModel: "nano-banana-2",
    family: "nano-banana-2",
    group: "Google · Nano Banana 2",
    label: "Nano Banana 2 · 4K",
    priceUsd: 0.09,
    supportsEdit: true,
    supportsTextToImage: true,
    description: "4K — для постеров и больших рендеров.",
  },
  {
    id: "nano-banana-pro:1K",
    apiModel: "nano-banana-pro",
    family: "nano-banana-pro",
    group: "Google · Nano Banana Pro",
    label: "Nano Banana Pro · 1K (image→image)",
    priceUsd: 0.08,
    supportsEdit: true,
    supportsTextToImage: false,
    description: "Pro-версия. Максимум деталей, точно следует референсам.",
  },
  {
    id: "nano-banana-pro:2K",
    apiModel: "nano-banana-pro",
    family: "nano-banana-pro",
    group: "Google · Nano Banana Pro",
    label: "Nano Banana Pro · 2K (image→image)",
    priceUsd: 0.12,
    supportsEdit: true,
    supportsTextToImage: false,
  },
  {
    id: "nano-banana-pro:4K",
    apiModel: "nano-banana-pro",
    family: "nano-banana-pro",
    group: "Google · Nano Banana Pro",
    label: "Nano Banana Pro · 4K (image→image)",
    priceUsd: 0.18,
    supportsEdit: true,
    supportsTextToImage: false,
  },

  // ───────────── Google · Imagen 4 ─────────────
  {
    id: "google/imagen4",
    apiModel: "google/imagen4",
    family: "imagen4",
    group: "Google · Imagen 4",
    label: "Imagen 4 — фотореализм",
    priceUsd: 0.04,
    supportsEdit: false,
    supportsTextToImage: true,
    description: "Google Imagen 4. Сильный фотореализм, только текст→картинка.",
  },
  {
    id: "google/imagen4-fast",
    apiModel: "google/imagen4-fast",
    family: "imagen4",
    group: "Google · Imagen 4",
    label: "Imagen 4 Fast — быстрая",
    priceUsd: 0.02,
    supportsEdit: false,
    supportsTextToImage: true,
    description: "Ускоренная Imagen 4. Дешевле, чуть проще по деталям.",
  },
  {
    id: "google/imagen4-ultra",
    apiModel: "google/imagen4-ultra",
    family: "imagen4",
    group: "Google · Imagen 4",
    label: "Imagen 4 Ultra — максимум деталей",
    priceUsd: 0.06,
    supportsEdit: false,
    supportsTextToImage: true,
    description: "Imagen 4 Ultra. Лучший фотореализм Google для T2I.",
  },

  // ───────────── ByteDance · Seedream ─────────────
  {
    id: "bytedance/seedream",
    apiModel: "bytedance/seedream",
    family: "seedream-v3",
    group: "ByteDance · Seedream 3",
    label: "Seedream 3.0 — текст→картинка",
    priceUsd: 0.02,
    supportsEdit: false,
    supportsTextToImage: true,
    description: "Старая, но самая дешёвая Seedream. Для черновиков и арта.",
  },
  {
    id: "bytedance/seedream-v4-text-to-image",
    apiModel: "bytedance/seedream-v4-text-to-image",
    family: "seedream-v4-t2i",
    group: "ByteDance · Seedream 4.0",
    label: "Seedream 4.0 — текст→картинка",
    priceUsd: 0.03,
    supportsEdit: false,
    supportsTextToImage: true,
    description: "Реалистичные товары и обстановка по описанию.",
  },
  {
    id: "bytedance/seedream-v4-edit",
    apiModel: "bytedance/seedream-v4-edit",
    family: "seedream-v4-edit",
    group: "ByteDance · Seedream 4.0",
    label: "Seedream 4.0 Edit — image→image",
    priceUsd: 0.04,
    supportsEdit: true,
    supportsTextToImage: false,
    description: "Переносит товар в новую сцену, реалистичный свет.",
  },
  {
    id: "seedream/4.5-text-to-image",
    apiModel: "seedream/4.5-text-to-image",
    family: "seedream-4-5-t2i",
    group: "ByteDance · Seedream 4.5",
    label: "Seedream 4.5 — текст→картинка",
    priceUsd: 0.04,
    supportsEdit: false,
    supportsTextToImage: true,
    description: "Новее, выше фотореализм и качество кожи/материалов.",
  },
  {
    id: "seedream/4.5-edit",
    apiModel: "seedream/4.5-edit",
    family: "seedream-4-5-edit",
    group: "ByteDance · Seedream 4.5",
    label: "Seedream 4.5 Edit — image→image",
    priceUsd: 0.05,
    supportsEdit: true,
    supportsTextToImage: false,
    description: "Лучший Seedream-edit. Сохраняет геометрию товара.",
  },
  {
    id: "seedream/5-lite-text-to-image",
    apiModel: "seedream/5-lite-text-to-image",
    family: "seedream-4-5-t2i",
    group: "ByteDance · Seedream 5 Lite",
    label: "Seedream 5 Lite — текст→картинка",
    priceUsd: 0.02,
    supportsEdit: false,
    supportsTextToImage: true,
    description: "Новейшая лёгкая модель. Дёшево и быстро.",
  },
  {
    id: "seedream/5-lite-image-to-image",
    apiModel: "seedream/5-lite-image-to-image",
    family: "seedream-4-5-edit",
    group: "ByteDance · Seedream 5 Lite",
    label: "Seedream 5 Lite — image→image",
    priceUsd: 0.025,
    supportsEdit: true,
    supportsTextToImage: false,
    description: "Лёгкая редактирующая Seedream 5.",
  },

  // ───────────── Z-Image ─────────────
  {
    id: "z-image",
    apiModel: "z-image",
    family: "z-image",
    group: "Z-Image",
    label: "Z-Image — фотореализм нового поколения",
    priceUsd: 0.02,
    supportsEdit: false,
    supportsTextToImage: true,
    description: "Сильный фотореализм, кинематографичный свет.",
  },

  // ───────────── Flux 2 ─────────────
  {
    id: "flux-2/pro-text-to-image:1K",
    apiModel: "flux-2/pro-text-to-image",
    family: "flux2-t2i",
    group: "Flux 2 Pro",
    label: "Flux 2 Pro · 1K — текст→картинка",
    priceUsd: 0.04,
    supportsEdit: false,
    supportsTextToImage: true,
    description: "Black Forest Labs Flux 2 Pro. Топ по качеству деталей.",
  },
  {
    id: "flux-2/pro-text-to-image:2K",
    apiModel: "flux-2/pro-text-to-image",
    family: "flux2-t2i",
    group: "Flux 2 Pro",
    label: "Flux 2 Pro · 2K — текст→картинка",
    priceUsd: 0.06,
    supportsEdit: false,
    supportsTextToImage: true,
  },
  {
    id: "flux-2/pro-image-to-image:1K",
    apiModel: "flux-2/pro-image-to-image",
    family: "flux2-i2i",
    group: "Flux 2 Pro",
    label: "Flux 2 Pro · 1K — image→image",
    priceUsd: 0.05,
    supportsEdit: true,
    supportsTextToImage: false,
    description: "Принимает несколько входных фото (товар + референс).",
  },
  {
    id: "flux-2/pro-image-to-image:2K",
    apiModel: "flux-2/pro-image-to-image",
    family: "flux2-i2i",
    group: "Flux 2 Pro",
    label: "Flux 2 Pro · 2K — image→image",
    priceUsd: 0.07,
    supportsEdit: true,
    supportsTextToImage: false,
  },
  {
    id: "flux-2/flex-text-to-image:1K",
    apiModel: "flux-2/flex-text-to-image",
    family: "flux2-t2i",
    group: "Flux 2 Flex",
    label: "Flux 2 Flex · 1K — текст→картинка",
    priceUsd: 0.02,
    supportsEdit: false,
    supportsTextToImage: true,
    description: "Облегчённая Flux 2. Дешевле Pro, чуть проще.",
  },
  {
    id: "flux-2/flex-image-to-image:1K",
    apiModel: "flux-2/flex-image-to-image",
    family: "flux2-i2i",
    group: "Flux 2 Flex",
    label: "Flux 2 Flex · 1K — image→image",
    priceUsd: 0.025,
    supportsEdit: true,
    supportsTextToImage: false,
  },

  // ───────────── Grok Imagine (xAI) ─────────────
  {
    id: "grok-imagine/text-to-image",
    apiModel: "grok-imagine/text-to-image",
    family: "grok-t2i",
    group: "Grok Imagine (xAI)",
    label: "Grok Imagine — текст→картинка",
    priceUsd: 0.04,
    supportsEdit: false,
    supportsTextToImage: true,
    description: "Модель от xAI. Сильно креативная, кинематограф.",
  },
  {
    id: "grok-imagine/image-to-image",
    apiModel: "grok-imagine/image-to-image",
    family: "grok-i2i",
    group: "Grok Imagine (xAI)",
    label: "Grok Imagine — image→image",
    priceUsd: 0.05,
    supportsEdit: true,
    supportsTextToImage: false,
  },

  // ───────────── OpenAI · GPT Image ─────────────
  {
    id: "gpt-image/1.5-text-to-image",
    apiModel: "gpt-image/1.5-text-to-image",
    family: "gpt-image-1-5-t2i",
    group: "OpenAI · GPT Image 1.5",
    label: "GPT Image 1.5 — текст→картинка",
    priceUsd: 0.04,
    supportsEdit: false,
    supportsTextToImage: true,
    description: "OpenAI gpt-image-1.5. Хорошо рисует текст и людей.",
  },
  {
    id: "gpt-image/1.5-image-to-image",
    apiModel: "gpt-image/1.5-image-to-image",
    family: "gpt-image-1-5-i2i",
    group: "OpenAI · GPT Image 1.5",
    label: "GPT Image 1.5 — image→image",
    priceUsd: 0.05,
    supportsEdit: true,
    supportsTextToImage: false,
  },
  {
    id: "gpt-image-2-text-to-image",
    apiModel: "gpt-image-2-text-to-image",
    family: "gpt-image-2-t2i",
    group: "OpenAI · GPT Image 2",
    label: "GPT Image 2 — текст→картинка",
    priceUsd: 0.05,
    supportsEdit: false,
    supportsTextToImage: true,
    description: "Свежая gpt-image-2. Лучше понимает сложный промпт.",
  },
  {
    id: "gpt-image-2-image-to-image",
    apiModel: "gpt-image-2-image-to-image",
    family: "gpt-image-2-i2i",
    group: "OpenAI · GPT Image 2",
    label: "GPT Image 2 — image→image",
    priceUsd: 0.06,
    supportsEdit: true,
    supportsTextToImage: false,
  },

  // ───────────── Ideogram ─────────────
  {
    id: "ideogram/v3-text-to-image",
    apiModel: "ideogram/v3-text-to-image",
    family: "ideogram-v3-t2i",
    group: "Ideogram V3",
    label: "Ideogram V3 — текст→картинка",
    priceUsd: 0.04,
    supportsEdit: false,
    supportsTextToImage: true,
    description: "Лучший в мире генератор текста на изображениях.",
  },
  {
    id: "ideogram/v3-edit",
    apiModel: "ideogram/v3-edit",
    family: "ideogram-v3-edit",
    group: "Ideogram V3",
    label: "Ideogram V3 Edit — редактор по маске",
    priceUsd: 0.05,
    supportsEdit: true,
    supportsTextToImage: false,
    description: "Inpainting: меняет выделенную область по описанию.",
  },
  {
    id: "ideogram/v3-remix",
    apiModel: "ideogram/v3-remix",
    family: "ideogram-v3-remix",
    group: "Ideogram V3",
    label: "Ideogram V3 Remix — переделать фото",
    priceUsd: 0.04,
    supportsEdit: true,
    supportsTextToImage: false,
    description: "Берёт ваше фото и переделывает в новом стиле.",
  },
  {
    id: "ideogram/character",
    apiModel: "ideogram/character",
    family: "ideogram-character",
    group: "Ideogram Character",
    label: "Ideogram Character — сохранить персонажа",
    priceUsd: 0.05,
    supportsEdit: true,
    supportsTextToImage: false,
    description: "Сохраняет внешность человека/маскота в новых сценах.",
  },
  {
    id: "ideogram/character-edit",
    apiModel: "ideogram/character-edit",
    family: "ideogram-character-edit",
    group: "Ideogram Character",
    label: "Ideogram Character Edit (по маске)",
    priceUsd: 0.06,
    supportsEdit: true,
    supportsTextToImage: false,
  },
  {
    id: "ideogram/character-remix",
    apiModel: "ideogram/character-remix",
    family: "ideogram-character-remix",
    group: "Ideogram Character",
    label: "Ideogram Character Remix",
    priceUsd: 0.05,
    supportsEdit: true,
    supportsTextToImage: false,
  },

  // ───────────── Qwen (Alibaba) ─────────────
  {
    id: "qwen/text-to-image",
    apiModel: "qwen/text-to-image",
    family: "qwen-t2i",
    group: "Qwen (Alibaba)",
    label: "Qwen — текст→картинка",
    priceUsd: 0.02,
    supportsEdit: false,
    supportsTextToImage: true,
    description: "Дешёвая китайская модель. Отлично понимает русский/китайский.",
  },
  {
    id: "qwen/image-to-image",
    apiModel: "qwen/image-to-image",
    family: "qwen-i2i",
    group: "Qwen (Alibaba)",
    label: "Qwen — image→image",
    priceUsd: 0.025,
    supportsEdit: true,
    supportsTextToImage: false,
  },
  {
    id: "qwen/image-edit",
    apiModel: "qwen/image-edit",
    family: "qwen-edit",
    group: "Qwen (Alibaba)",
    label: "Qwen Image Edit — редактирование",
    priceUsd: 0.025,
    supportsEdit: true,
    supportsTextToImage: false,
  },
  {
    id: "qwen2/text-to-image",
    apiModel: "qwen2/text-to-image",
    family: "qwen2-t2i",
    group: "Qwen 2 (Alibaba)",
    label: "Qwen 2 — текст→картинка",
    priceUsd: 0.03,
    supportsEdit: false,
    supportsTextToImage: true,
    description: "Qwen 2 — обновлённая, выше качество.",
  },
  {
    id: "qwen2/image-edit",
    apiModel: "qwen2/image-edit",
    family: "qwen2-edit",
    group: "Qwen 2 (Alibaba)",
    label: "Qwen 2 Image Edit",
    priceUsd: 0.035,
    supportsEdit: true,
    supportsTextToImage: false,
  },

  // ───────────── Wan (Alibaba) ─────────────
  {
    id: "wan/2-7-image:2K",
    apiModel: "wan/2-7-image",
    family: "wan-image",
    group: "Wan 2.7",
    label: "Wan 2.7 Image · 2K",
    priceUsd: 0.04,
    supportsEdit: true,
    supportsTextToImage: true,
    description: "Wan 2.7. Хорошо в товарной съёмке, поддерживает референсы.",
  },
  {
    id: "wan/2-7-image-pro:2K",
    apiModel: "wan/2-7-image-pro",
    family: "wan-image",
    group: "Wan 2.7",
    label: "Wan 2.7 Image Pro · 2K",
    priceUsd: 0.06,
    supportsEdit: true,
    supportsTextToImage: true,
    description: "Pro-версия Wan 2.7. Выше качество, дороже.",
  },
  {
    id: "wan/2-7-image-pro:4K",
    apiModel: "wan/2-7-image-pro",
    family: "wan-image",
    group: "Wan 2.7",
    label: "Wan 2.7 Image Pro · 4K",
    priceUsd: 0.09,
    supportsEdit: true,
    supportsTextToImage: true,
  },

  // ───────────── Утилиты (без промпта) ─────────────
  {
    id: "topaz/image-upscale",
    apiModel: "topaz/image-upscale",
    family: "topaz-upscale",
    group: "Утилиты",
    label: "Topaz Upscale — увеличение в 2–4×",
    priceUsd: 0.05,
    supportsEdit: true,
    supportsTextToImage: false,
    description: "Промпт не нужен. Берёт исходник и увеличивает разрешение.",
  },
  {
    id: "recraft/remove-background",
    apiModel: "recraft/remove-background",
    family: "recraft-utility",
    group: "Утилиты",
    label: "Recraft — удалить фон",
    priceUsd: 0.01,
    supportsEdit: true,
    supportsTextToImage: false,
    description: "Промпт не нужен. Вырезает фон, оставляет товар на прозрачном.",
  },
  {
    id: "recraft/crisp-upscale",
    apiModel: "recraft/crisp-upscale",
    family: "recraft-utility",
    group: "Утилиты",
    label: "Recraft Crisp Upscale",
    priceUsd: 0.02,
    supportsEdit: true,
    supportsTextToImage: false,
    description: "Промпт не нужен. Резкое увеличение разрешения.",
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
