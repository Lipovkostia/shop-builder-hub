// Client-side upload validation with human-readable errors (RU).

export interface UploadPreset {
  /** Максимальный размер в байтах. */
  maxBytes: number;
  /** Разрешённые MIME-типы (нижним регистром). */
  mimes: string[];
  /** Список расширений — используется как фолбэк, если MIME не распознан (HEIC и т.п.). */
  exts?: string[];
  /** Рекомендуемый размер картинки для подсказки. */
  recommend?: string;
  /** Человекочитаемое перечисление форматов, напр. "JPG, PNG, WEBP". */
  formatsLabel?: string;
  /** Целевая ширина в px (для кроппера). */
  targetWidth?: number;
  /** Целевая высота в px (для кроппера). */
  targetHeight?: number;
}

export const UPLOAD_PRESETS = {
  heroBanner: {
    maxBytes: 3 * 1024 * 1024,
    mimes: ["image/jpeg", "image/png", "image/webp"],
    exts: ["jpg", "jpeg", "png", "webp"],
    recommend: "1920×900 px",
    formatsLabel: "JPG, PNG, WEBP",
    targetWidth: 1920,
    targetHeight: 900,
  },
  heroSideBlock: {
    maxBytes: 2 * 1024 * 1024,
    mimes: ["image/jpeg", "image/png", "image/webp"],
    exts: ["jpg", "jpeg", "png", "webp"],
    recommend: "800×600 px",
    formatsLabel: "JPG, PNG, WEBP",
    targetWidth: 800,
    targetHeight: 600,
  },
  landingSlide: {
    maxBytes: 3 * 1024 * 1024,
    mimes: ["image/jpeg", "image/png", "image/webp"],
    exts: ["jpg", "jpeg", "png", "webp"],
    recommend: "1920×800 px",
    formatsLabel: "JPG, PNG, WEBP",
    targetWidth: 1920,
    targetHeight: 800,
  },
  landingInfoBlock: {
    maxBytes: 2 * 1024 * 1024,
    mimes: ["image/jpeg", "image/png", "image/webp"],
    exts: ["jpg", "jpeg", "png", "webp"],
    recommend: "800×600 px",
    formatsLabel: "JPG, PNG, WEBP",
    targetWidth: 800,
    targetHeight: 600,
  },
  productImage: {
    maxBytes: 5 * 1024 * 1024,
    mimes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    exts: ["jpg", "jpeg", "png", "webp", "gif"],
    recommend: "1000×1000 px",
    formatsLabel: "JPG, PNG, WEBP, GIF",
  },
  avitoImage: {
    maxBytes: 10 * 1024 * 1024,
    mimes: ["image/jpeg", "image/png", "image/webp"],
    exts: ["jpg", "jpeg", "png", "webp"],
    recommend: "1280×960 px",
    formatsLabel: "JPG, PNG, WEBP",
  },
  storeLogo: {
    maxBytes: 1 * 1024 * 1024,
    mimes: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"],
    exts: ["png", "jpg", "jpeg", "webp", "svg"],
    recommend: "512×512 px",
    formatsLabel: "PNG, JPG, WEBP, SVG",
  },
  orderAttachment: {
    maxBytes: 10 * 1024 * 1024,
    mimes: [
      "image/jpeg", "image/png", "image/webp", "image/gif",
      "application/pdf",
    ],
    exts: ["jpg", "jpeg", "png", "webp", "gif", "pdf"],
    recommend: "PDF или фото",
    formatsLabel: "JPG, PNG, PDF",
  },
} as const satisfies Record<string, UploadPreset>;

export type UploadPresetKey = keyof typeof UPLOAD_PRESETS;

function formatMB(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return `${mb % 1 === 0 ? mb.toFixed(0) : mb.toFixed(1)} МБ`;
  }
  return `${Math.round(bytes / 1024)} КБ`;
}

export function hintText(preset: UploadPreset): string {
  const parts: string[] = [];
  if (preset.formatsLabel) parts.push(`Формат: ${preset.formatsLabel}`);
  if (preset.recommend) parts.push(`Реком.: ${preset.recommend}`);
  parts.push(`До ${formatMB(preset.maxBytes)}`);
  return parts.join(" · ");
}

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

export function validateUpload(file: File, preset: UploadPreset): ValidationResult {
  const ext = extOf(file.name);
  const mime = (file.type || "").toLowerCase();

  const mimeOk = mime && preset.mimes.includes(mime);
  const extOk = !!ext && (preset.exts?.includes(ext) ?? false);

  // Спец-подсказка для HEIC/HEIF (частый iPhone-случай).
  if (!mimeOk && !extOk) {
    if (ext === "heic" || ext === "heif" || mime === "image/heic" || mime === "image/heif") {
      return {
        ok: false,
        error: "Формат HEIC не поддерживается. На iPhone сохраните фото как JPG (Настройки → Камера → Форматы → Наиболее совместимый) или конвертируйте перед загрузкой.",
      };
    }
    return {
      ok: false,
      error: `Формат «${ext || mime || "неизвестен"}» не поддерживается. Разрешено: ${preset.formatsLabel ?? preset.mimes.join(", ")}.`,
    };
  }

  if (file.size > preset.maxBytes) {
    return {
      ok: false,
      error: `Файл слишком большой — ${formatMB(file.size)}. Максимум ${formatMB(preset.maxBytes)}. Сожмите изображение перед загрузкой.`,
    };
  }

  if (file.size === 0) {
    return { ok: false, error: "Пустой файл — попробуйте ещё раз." };
  }

  return { ok: true };
}
