import { useState, useRef, useCallback } from "react";
import { Image, Upload, Trash2, X, Clock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CategoryBannerManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
  categoryName: string;
  storeId: string;
  initialData: {
    banner_enabled: boolean;
    banner_images: string[];
    banner_interval: number;
    banner_effect: string;
  };
  onSaved: () => void;
}

export function CategoryBannerManager({
  open,
  onOpenChange,
  categoryId,
  categoryName,
  storeId,
  initialData,
  onSaved,
}: CategoryBannerManagerProps) {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(initialData.banner_enabled);
  const [images, setImages] = useState<string[]>(initialData.banner_images || []);
  const [interval, setInterval] = useState(initialData.banner_interval || 5);
  const [effect, setEffect] = useState(initialData.banner_effect || "fade");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const newUrls: string[] = [];

      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${storeId}/banners/${categoryId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(path, file, { contentType: file.type });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("product-images")
          .getPublicUrl(path);

        newUrls.push(urlData.publicUrl);
      }

      setImages((prev) => [...prev, ...newUrls]);
      toast({ title: "Загружено", description: `${newUrls.length} изображений добавлено` });
    } catch (err: any) {
      console.error("Upload error:", err);
      toast({ title: "Ошибка загрузки", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }, [storeId, categoryId, toast]);

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("categories")
        .update({
          banner_enabled: enabled,
          banner_images: images,
          banner_interval: interval,
          banner_effect: effect,
        } as any)
        .eq("id", categoryId);

      if (error) throw error;

      toast({ title: "Баннер сохранён" });
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Save error:", err);
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Image className="h-5 w-5" />
            Баннер: {categoryName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Enable toggle */}
          <div className="flex items-center justify-between">
            <Label>Показывать баннер вместо текста</Label>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          {/* Images */}
          <div className="space-y-2">
            <Label>Изображения баннера</Label>
            <p className="text-xs text-muted-foreground">
              Для шапки категории: 1200×300px (4:1). Для сайдбара: 260×60px. Для Retina — удвойте размеры.
            </p>

            <div className="grid grid-cols-2 gap-2">
              {images.map((url, idx) => (
                <div key={idx} className="relative group rounded-lg overflow-hidden border aspect-[4/1]">
                  <img src={url} alt={`Баннер ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeImage(idx)}
                    className="absolute top-1 right-1 p-1 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  <span className="absolute bottom-1 left-1 text-[10px] bg-black/50 text-white px-1.5 py-0.5 rounded">
                    #{idx + 1}
                  </span>
                </div>
              ))}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleUpload(e.target.files)}
            />

            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full"
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? "Загрузка..." : "Загрузить изображения"}
            </Button>
          </div>

          {/* Interval */}
          {images.length > 1 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                Интервал смены (сек)
              </Label>
              <Input
                type="number"
                min={2}
                max={30}
                value={interval}
                onChange={(e) => setInterval(Number(e.target.value) || 5)}
              />
            </div>
          )}

          {/* Effect */}
          {images.length > 1 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Sparkles className="h-4 w-4" />
                Эффект перехода
              </Label>
              <Select value={effect} onValueChange={setEffect}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fade">Плавное затухание</SelectItem>
                  <SelectItem value="slide">Сдвиг</SelectItem>
                  <SelectItem value="zoom">Масштабирование</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Сохранение..." : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
