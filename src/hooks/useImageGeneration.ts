import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface GenerationParams {
  aspect_ratio: string;
  width?: number;
  height?: number;
  n?: number;
  quality?: "low" | "medium" | "high";
  model?: string;
}

export interface GenerationTask {
  id: string;
  product_id: string;
  source_image_url: string | null;
  prompt: string;
}

export interface GenerationResult {
  task_id: string;
  url?: string;
  error?: string;
  status: "pending" | "success" | "error";
}

const MAX_PARALLEL = 3;

export function useImageGeneration() {
  const [results, setResults] = useState<Record<string, GenerationResult>>({});
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const generateOne = useCallback(async (task: GenerationTask, params: GenerationParams): Promise<GenerationResult> => {
    try {
      const { data, error } = await supabase.functions.invoke("generate-product-image", {
        body: {
          product_id: task.product_id,
          source_image_url: task.source_image_url,
          prompt: task.prompt,
          aspect_ratio: params.aspect_ratio,
          width: params.width,
          height: params.height,
          n: params.n ?? 1,
          quality: params.quality ?? "medium",
          model: params.model,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return { task_id: task.id, url: (data as any)?.url, status: "success" };
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      return { task_id: task.id, error: msg, status: "error" };
    }
  }, []);

  const generateBatch = useCallback(async (tasks: GenerationTask[], params: GenerationParams) => {
    if (!tasks.length) return;
    setRunning(true);
    setProgress({ done: 0, total: tasks.length });
    setResults((prev) => {
      const next = { ...prev };
      tasks.forEach((t) => {
        next[t.id] = { task_id: t.id, status: "pending" };
      });
      return next;
    });

    const queue = [...tasks];
    let done = 0;
    const workers = Array.from({ length: Math.min(MAX_PARALLEL, queue.length) }, async () => {
      while (queue.length) {
        const t = queue.shift();
        if (!t) break;
        const res = await generateOne(t, params);
        setResults((prev) => ({ ...prev, [t.id]: res }));
        done += 1;
        setProgress({ done, total: tasks.length });
        if (res.status === "error") {
          toast.error(`Ошибка: ${res.error?.slice(0, 120)}`);
        }
      }
    });
    await Promise.all(workers);
    setRunning(false);
    toast.success(`Готово: ${tasks.length} изображений`);
  }, [generateOne]);

  const clearResult = useCallback((taskId: string) => {
    setResults((prev) => {
      const n = { ...prev };
      delete n[taskId];
      return n;
    });
  }, []);

  const clearAll = useCallback(() => setResults({}), []);

  return { results, running, progress, generateBatch, generateOne, clearResult, clearAll };
}
