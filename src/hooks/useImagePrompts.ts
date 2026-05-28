import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export interface ImagePrompt {
  id: string;
  store_id: string | null;
  name: string;
  prompt_template: string;
  default_aspect_ratio: string | null;
  is_system: boolean;
  sort_order: number;
}

export interface PromptInput {
  name: string;
  prompt_template: string;
  default_aspect_ratio?: string;
}

const STORAGE_KEY = "image_generation_prompts_v1";

const SYSTEM_PROMPTS: ImagePrompt[] = [
  {
    id: "system-studio-white",
    store_id: null,
    name: "Студия на белом фоне",
    prompt_template: "Профессиональное студийное фото товара {product_name} на чистом белом фоне, мягкий свет, реалистичные детали, коммерческая предметная съёмка",
    default_aspect_ratio: "1:1",
    is_system: true,
    sort_order: 10,
  },
  {
    id: "system-lifestyle",
    store_id: null,
    name: "Lifestyle",
    prompt_template: "Реалистичное lifestyle-фото товара {product_name} в естественной сцене использования, аккуратная композиция, премиальный вид",
    default_aspect_ratio: "4:3",
    is_system: true,
    sort_order: 20,
  },
  {
    id: "system-marketplace",
    store_id: null,
    name: "Маркетплейс",
    prompt_template: "Чёткое продающее фото товара {product_name} для маркетплейса, нейтральный фон, товар в центре, высокая детализация, без лишнего текста",
    default_aspect_ratio: "1:1",
    is_system: true,
    sort_order: 30,
  },
  {
    id: "system-avito",
    store_id: null,
    name: "Avito",
    prompt_template: "Яркое реалистичное фото товара {product_name} для объявления, хороший свет, понятный масштаб, доверительный вид, без водяных знаков",
    default_aspect_ratio: "4:3",
    is_system: true,
    sort_order: 40,
  },
];

function readCustomPrompts(storeId: string | null): ImagePrompt[] {
  if (!storeId || typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}:${storeId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeCustomPrompts(storeId: string, prompts: ImagePrompt[]) {
  localStorage.setItem(`${STORAGE_KEY}:${storeId}`, JSON.stringify(prompts));
  try { window.dispatchEvent(new CustomEvent("image-prompts-changed", { detail: { storeId } })); } catch {}
}

const EVENT_NAME = "image-prompts-changed";


export function useImagePrompts(storeId: string | null) {
  const [customPrompts, setCustomPrompts] = useState<ImagePrompt[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setCustomPrompts(readCustomPrompts(storeId));
    setLoading(false);
  }, [storeId]);

  useEffect(() => { load(); }, [load]);

  const prompts = useMemo(
    () => [...SYSTEM_PROMPTS, ...customPrompts].sort((a, b) => Number(b.is_system) - Number(a.is_system) || a.sort_order - b.sort_order),
    [customPrompts],
  );

  const create = async (input: PromptInput) => {
    if (!storeId) { toast.error("Не выбран магазин"); return; }
    if (!input.name.trim()) { toast.error("Укажите название"); return; }
    if (!input.prompt_template.trim()) { toast.error("Укажите текст промпта"); return; }
    const next: ImagePrompt[] = [
      ...customPrompts,
      {
        id: crypto.randomUUID(),
        store_id: storeId,
        name: input.name.trim(),
        prompt_template: input.prompt_template,
        default_aspect_ratio: input.default_aspect_ratio ?? "1:1",
        is_system: false,
        sort_order: Date.now(),
      },
    ];
    writeCustomPrompts(storeId, next);
    setCustomPrompts(next);
    toast.success("Промпт сохранён");
  };

  const update = async (id: string, input: Partial<PromptInput>) => {
    if (!storeId) { toast.error("Не выбран магазин"); return; }
    const next = customPrompts.map((p) => p.id === id ? {
      ...p,
      name: input.name?.trim() || p.name,
      prompt_template: input.prompt_template ?? p.prompt_template,
      default_aspect_ratio: input.default_aspect_ratio ?? p.default_aspect_ratio,
    } : p);
    writeCustomPrompts(storeId, next);
    setCustomPrompts(next);
    toast.success("Обновлено");
  };

  const remove = async (id: string) => {
    if (!storeId) { toast.error("Не выбран магазин"); return; }
    const next = customPrompts.filter((p) => p.id !== id);
    writeCustomPrompts(storeId, next);
    setCustomPrompts(next);
    toast.success("Удалено");
  };

  return { prompts, loading, reload: load, create, update, remove };
}