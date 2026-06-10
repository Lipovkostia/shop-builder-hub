import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Layers, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  product: { id: string; name: string } | null;
  onDone?: () => void;
}

export function AvitoBulkDuplicateDialog({ open, onOpenChange, storeId, product, onDone }: Props) {
  const { toast } = useToast();
  const [count, setCount] = useState(5);
  const [rewriteTitle, setRewriteTitle] = useState(true);
  const [rewriteDescription, setRewriteDescription] = useState(true);
  const [reuploadImages, setReuploadImages] = useState(true);
  const [jitterPrice, setJitterPrice] = useState(true);
  const [instruction, setInstruction] = useState("");
  const [running, setRunning] = useState(false);

  const run = async () => {
    if (!product) return;
    if (count < 1 || count > 20) {
      toast({ title: "Количество должно быть от 1 до 20", variant: "destructive" });
      return;
    }
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("avito-bulk-duplicate", {
        body: {
          storeId,
          sourceProductId: product.id,
          count,
          options: { rewriteTitle, rewriteDescription, reuploadImages, jitterPrice, instruction: instruction.trim() || undefined },
        },
      });
      if (error) throw error;
      const created = (data as any)?.created ?? 0;
      const errs = (data as any)?.errors ?? [];
      if (created > 0) {
        toast({
          title: `Создано ${created} дубль(ей)`,
          description: errs.length ? `Ошибок: ${errs.length}. Откройте «Дубли объявления» для проверки.` : "Дубли попадут в фид при следующей публикации.",
        });
        onDone?.();
        onOpenChange(false);
      } else {
        toast({ title: "Не удалось создать дубли", description: errs[0]?.error || "Неизвестная ошибка", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Ошибка", description: e?.message || "Не удалось", variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!running) onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Layers className="h-4 w-4 text-amber-600" />
            Сделать дубли объявления
          </DialogTitle>
          <DialogDescription className="text-xs">
            {product ? <>«{product.name}»</> : null} — каждый дубль получит уникальный текст, перезалитые фото и сдвиг цены, чтобы Авито считал его новым объявлением.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs">Количество дублей (1–20)</Label>
            <Input
              type="number"
              min={1}
              max={20}
              value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
            />
          </div>

          <div className="space-y-2 rounded-md border p-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={rewriteTitle} onCheckedChange={(v) => setRewriteTitle(!!v)} />
              Переписать <b>заголовок</b> ИИ (другие слова, тот же смысл)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={rewriteDescription} onCheckedChange={(v) => setRewriteDescription(!!v)} />
              Переписать <b>описание</b> ИИ
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={reuploadImages} onCheckedChange={(v) => setReuploadImages(!!v)} />
              Перезалить <b>фото</b> с новыми URL (анти-дубль по хешу)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={jitterPrice} onCheckedChange={(v) => setJitterPrice(!!v)} />
              Сместить <b>цену</b> на ±3–10 ₽
            </label>
          </div>

          <div>
            <Label className="text-xs">Инструкция для ИИ (опц.)</Label>
            <Textarea
              rows={3}
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="Например: тон — деловой, добавь упоминание доставки по РФ, без эмодзи."
            />
          </div>

          <div className="text-[11px] text-muted-foreground">
            Дубли сохраняются в таблицу вариантов объявления и автоматически попадают в фид Авито при следующем обновлении. Артикул, адрес, телефон, категория Авито — не меняются.
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={running}>Отмена</Button>
          <Button onClick={run} disabled={running || !product}>
            {running
              ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Генерирую…</>
              : <><Sparkles className="h-3.5 w-3.5 mr-1" /> Запустить генерацию</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
