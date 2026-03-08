import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, GripVertical, Upload, X, Loader2 } from "lucide-react";

interface InfoBlock {
  id: string;
  title: string;
  description: string;
  icon: string | null;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
}

const ICON_OPTIONS = [
  { value: "Rocket", label: "🚀 Ракета" },
  { value: "Store", label: "🏪 Магазин" },
  { value: "Zap", label: "⚡ Молния" },
  { value: "Shield", label: "🛡 Щит" },
  { value: "BarChart3", label: "📊 График" },
  { value: "Globe", label: "🌐 Глобус" },
];

export default function LandingInfoBlocksManager() {
  const { toast } = useToast();
  const [blocks, setBlocks] = useState<InfoBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

  const fetchBlocks = async () => {
    const { data, error } = await supabase
      .from("landing_info_blocks")
      .select("*")
      .order("sort_order", { ascending: true });
    if (!error && data) setBlocks(data as unknown as InfoBlock[]);
    setLoading(false);
  };

  useEffect(() => { fetchBlocks(); }, []);

  const handleAdd = async () => {
    const maxOrder = blocks.reduce((max, b) => Math.max(max, b.sort_order), 0);
    const { error } = await supabase.from("landing_info_blocks").insert({
      title: "Новый блок",
      description: "Описание блока",
      icon: "Rocket",
      sort_order: maxOrder + 1,
      is_active: false,
    });
    if (error) {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    } else {
      fetchBlocks();
    }
  };

  const handleUpdate = async (id: string, updates: Partial<InfoBlock>) => {
    setSaving(id);
    const { error } = await supabase
      .from("landing_info_blocks")
      .update(updates)
      .eq("id", id);
    if (error) {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    } else {
      setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...updates } : b)));
    }
    setSaving(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить блок?")) return;
    const { error } = await supabase.from("landing_info_blocks").delete().eq("id", id);
    if (!error) setBlocks((prev) => prev.filter((b) => b.id !== id));
  };

  const handleImageUpload = async (blockId: string, file: File) => {
    setUploadingFor(blockId);
    const ext = file.name.split(".").pop();
    const path = `info-blocks/${blockId}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("landing-info")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast({ title: "Ошибка загрузки", description: uploadError.message, variant: "destructive" });
      setUploadingFor(null);
      return;
    }

    const { data: urlData } = supabase.storage.from("landing-info").getPublicUrl(path);
    await handleUpdate(blockId, { image_url: urlData.publicUrl } as any);
    setUploadingFor(null);
  };

  const handleRemoveImage = async (blockId: string) => {
    await handleUpdate(blockId, { image_url: null } as any);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Информационные блоки</h3>
          <p className="text-sm text-muted-foreground">Рекламные плитки на главной странице под каруселью</p>
        </div>
        <Button onClick={handleAdd} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Добавить
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && uploadingFor) handleImageUpload(uploadingFor, file);
          e.target.value = "";
        }}
      />

      {blocks.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">Нет блоков. Нажмите «Добавить» для создания.</p>
      )}

      <div className="grid gap-3">
        {blocks.map((block) => (
          <Card key={block.id} className={!block.is_active ? "opacity-60" : ""}>
            <CardContent className="p-4">
              <div className="flex gap-4">
                {/* Image preview / upload */}
                <div className="shrink-0 w-[120px] h-[100px] rounded-lg border bg-muted overflow-hidden relative group">
                  {block.image_url ? (
                    <>
                      <img src={block.image_url} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={() => handleRemoveImage(block.id)}
                        className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        setUploadingFor(block.id);
                        fileInputRef.current?.click();
                      }}
                      className="w-full h-full flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {uploadingFor === block.id ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          <Upload className="h-5 w-5" />
                          <span className="text-[10px]">Загрузить</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Fields */}
                <div className="flex-1 space-y-2 min-w-0">
                  <div className="flex items-center gap-2">
                    <Input
                      value={block.title}
                      onChange={(e) => setBlocks((prev) => prev.map((b) => b.id === block.id ? { ...b, title: e.target.value } : b))}
                      onBlur={() => handleUpdate(block.id, { title: block.title })}
                      className="h-8 text-sm font-semibold"
                      placeholder="Заголовок"
                    />
                    <Select
                      value={block.icon || "Rocket"}
                      onValueChange={(v) => handleUpdate(block.id, { icon: v })}
                    >
                      <SelectTrigger className="w-[130px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ICON_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Textarea
                    value={block.description}
                    onChange={(e) => setBlocks((prev) => prev.map((b) => b.id === block.id ? { ...b, description: e.target.value } : b))}
                    onBlur={() => handleUpdate(block.id, { description: block.description })}
                    className="text-xs min-h-[50px] resize-none"
                    placeholder="Описание блока"
                  />

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={block.is_active}
                        onCheckedChange={(v) => handleUpdate(block.id, { is_active: v })}
                      />
                      <span className="text-xs text-muted-foreground">
                        {block.is_active ? "Активен" : "Скрыт"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        value={block.sort_order}
                        onChange={(e) => setBlocks((prev) => prev.map((b) => b.id === block.id ? { ...b, sort_order: Number(e.target.value) } : b))}
                        onBlur={() => handleUpdate(block.id, { sort_order: block.sort_order })}
                        className="w-16 h-7 text-xs text-center"
                        title="Порядок сортировки"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => handleDelete(block.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
