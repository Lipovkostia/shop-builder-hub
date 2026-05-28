import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil, Loader2 } from "lucide-react";
import { useImagePrompts, type ImagePrompt } from "@/hooks/useImagePrompts";
import { toast } from "sonner";

const AR = ["1:1", "16:9", "9:16", "4:3", "3:4", "2:3", "3:2", "21:9"];

export function PromptsManager({ storeId }: { storeId: string }) {
  const { prompts, create, update, remove } = useImagePrompts(storeId);
  const [editing, setEditing] = useState<ImagePrompt | null>(null);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [ar, setAr] = useState("1:1");
  const [saving, setSaving] = useState(false);

  const reset = () => { setEditing(null); setName(""); setText(""); setAr("1:1"); };

  const startEdit = (p: ImagePrompt) => {
    setEditing(p); setName(p.name); setText(p.prompt_template); setAr(p.default_aspect_ratio ?? "1:1");
  };

  const save = async () => {
    if (!name.trim()) { toast.error("Укажите название"); return; }
    if (!text.trim()) { toast.error("Введите текст промпта"); return; }
    setSaving(true);
    try {
      if (editing && !editing.is_system) {
        await update(editing.id, { name, prompt_template: text, default_aspect_ratio: ar });
      } else {
        await create({ name, prompt_template: text, default_aspect_ratio: ar });
      }
      reset();
    } finally { setSaving(false); }
  };

  return (
    <div className="grid grid-cols-12 gap-3">
      <div className="col-span-12 lg:col-span-5 rounded-lg border border-border bg-card p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Шаблоны промптов</h3>
          <Button size="sm" onClick={reset}><Plus className="h-4 w-4" />Новый</Button>
        </div>
        <ScrollArea className="h-[500px]">
          <div className="space-y-1">
            {prompts.map((p) => (
              <div key={p.id} className="flex items-start gap-2 p-2 rounded hover:bg-muted">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium flex items-center gap-1">
                    {p.is_system && <Badge variant="secondary" className="text-xs">сист.</Badge>}
                    {p.name}
                  </div>
                  <div className="text-xs text-muted-foreground line-clamp-2">{p.prompt_template}</div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => startEdit(p)}><Pencil className="h-3 w-3" /></Button>
                {!p.is_system && (
                  <Button size="sm" variant="ghost" onClick={() => remove(p.id)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
      <div className="col-span-12 lg:col-span-7 rounded-lg border border-border bg-card p-3 space-y-3">
        <h3 className="font-semibold">
          {editing ? (editing.is_system ? "Создать на основе системного" : "Редактировать промпт") : "Новый промпт"}
        </h3>
        <div className="space-y-2">
          <Label>Название</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Например: Студийное фото" />
        </div>
        <div className="space-y-2">
          <Label>Промпт (используйте {`{product_name}`} для подстановки)</Label>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} />
        </div>
        <div className="space-y-2">
          <Label>Соотношение по умолчанию</Label>
          <Select value={ar} onValueChange={setAr}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>{AR.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}Сохранить
        </Button>
      </div>
    </div>
  );
}
