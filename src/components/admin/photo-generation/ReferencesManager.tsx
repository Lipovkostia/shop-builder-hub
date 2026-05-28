import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
import { useImageReferences } from "@/hooks/useImageReferences";
import { toast } from "sonner";

export function ReferencesManager({ storeId }: { storeId: string }) {
  const { refs, upload, create, remove } = useImageReferences(storeId);
  const [name, setName] = useState("");
  const [url, setUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    const u = await upload(file);
    setUploading(false);
    if (u) setUrl(u);
  };

  const save = async () => {
    if (!name.trim()) { toast.error("Укажите название"); return; }
    if (!url) { toast.error("Загрузите картинку"); return; }
    setSaving(true);
    try {
      await create(name, url);
      setName(""); setUrl(null);
    } finally { setSaving(false); }
  };

  return (
    <div className="grid grid-cols-12 gap-3">
      <div className="col-span-12 lg:col-span-5 rounded-lg border border-border bg-card p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Референсы (картинки)</h3>
          <Button size="sm" onClick={() => { setName(""); setUrl(null); }}><Plus className="h-4 w-4" />Новый</Button>
        </div>
        <ScrollArea className="h-[500px]">
          <div className="grid grid-cols-2 gap-2">
            {refs.map((r) => (
              <div key={r.id} className="rounded-lg border border-border p-2 space-y-1">
                <img src={r.image_url} alt={r.name} className="w-full aspect-square object-cover rounded" />
                <div className="flex items-center justify-between gap-1">
                  <div className="text-xs font-medium truncate flex items-center gap-1">
                    {r.is_system && <Badge variant="secondary" className="text-[10px]">сист.</Badge>}
                    {r.name}
                  </div>
                  {!r.is_system && (
                    <Button size="sm" variant="ghost" onClick={() => remove(r.id)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {refs.length === 0 && (
              <div className="col-span-2 text-sm text-muted-foreground">Пока нет референсов — добавьте первый справа</div>
            )}
          </div>
        </ScrollArea>
      </div>
      <div className="col-span-12 lg:col-span-7 rounded-lg border border-border bg-card p-3 space-y-3">
        <h3 className="font-semibold">Новый референс</h3>
        <div className="space-y-2">
          <Label>Название</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Например: Деревянный фон" />
        </div>
        <div className="space-y-2">
          <Label>Изображение</Label>
          <div className="flex items-center gap-3">
            {url ? (
              <div className="relative">
                <img src={url} alt="" className="h-32 w-32 rounded object-cover border" />
                <button type="button" onClick={() => setUrl(null)}
                  className="absolute -top-2 -right-2 rounded-full bg-destructive text-destructive-foreground p-1">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="h-32 w-32 rounded border-2 border-dashed border-border bg-muted/30 flex items-center justify-center text-xs text-muted-foreground">
                нет фото
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }} />
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              {url ? "Заменить" : "Загрузить"}
            </Button>
          </div>
        </div>
        <Button onClick={save} disabled={saving || !url || !name.trim()}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}Сохранить референс
        </Button>
      </div>
    </div>
  );
}
