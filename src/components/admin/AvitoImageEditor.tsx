import { useState, useRef, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Crop, Expand, Layers, Upload, Loader2, Check, X, Trash2, ImageIcon, Wand2, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

const AVITO_WIDTH = 1280;
const AVITO_HEIGHT = 960;
const AVITO_RATIO = 4 / 3;

interface AvitoImageEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  images: string[];
  productName: string;
  productId: string;
  storeId: string;
  onImagesUpdate: (images: string[]) => void;
}

interface ImageInfo {
  url: string;
  width: number;
  height: number;
  ratio: string;
  isAvito: boolean;
  selected: boolean;
}

interface Template {
  id: string;
  name: string;
  url: string;
}

const TEMPLATES_KEY = "avito_photo_templates_";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function getImageDimensions(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = src;
  });
}

function smartCrop(img: HTMLImageElement, targetW: number, targetH: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d")!;

  const srcRatio = img.naturalWidth / img.naturalHeight;
  const targetRatio = targetW / targetH;

  let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;

  if (srcRatio > targetRatio) {
    // Source is wider — crop sides
    sw = img.naturalHeight * targetRatio;
    sx = (img.naturalWidth - sw) / 2;
  } else {
    // Source is taller — crop top/bottom
    sh = img.naturalWidth / targetRatio;
    sy = (img.naturalHeight - sh) / 2;
  }

  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);
  return canvas.toDataURL("image/jpeg", 0.92);
}

function overlayTemplate(
  baseImg: HTMLImageElement,
  templateImg: HTMLImageElement,
  targetW: number,
  targetH: number
): string {
  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d")!;

  // Draw base image (crop to fit)
  const srcRatio = baseImg.naturalWidth / baseImg.naturalHeight;
  const targetRatio = targetW / targetH;
  let sx = 0, sy = 0, sw = baseImg.naturalWidth, sh = baseImg.naturalHeight;
  if (srcRatio > targetRatio) {
    sw = baseImg.naturalHeight * targetRatio;
    sx = (baseImg.naturalWidth - sw) / 2;
  } else {
    sh = baseImg.naturalWidth / targetRatio;
    sy = (baseImg.naturalHeight - sh) / 2;
  }
  ctx.drawImage(baseImg, sx, sy, sw, sh, 0, 0, targetW, targetH);

  // Overlay template
  ctx.drawImage(templateImg, 0, 0, targetW, targetH);

  return canvas.toDataURL("image/jpeg", 0.92);
}

export default function AvitoImageEditor({
  open, onOpenChange, images, productName, productId, storeId, onImagesUpdate,
}: AvitoImageEditorProps) {
  const { toast } = useToast();
  const [imageInfos, setImageInfos] = useState<ImageInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState<Set<number>>(new Set());
  const [processedImages, setProcessedImages] = useState<Map<number, string>>(new Map());
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("photos");
  const templateInputRef = useRef<HTMLInputElement>(null);
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

  // Load image dimensions
  useEffect(() => {
    if (!open || images.length === 0) return;
    setLoading(true);
    Promise.all(
      images.map(async (url) => {
        const dims = await getImageDimensions(url);
        const ratio = dims.width && dims.height
          ? `${dims.width}×${dims.height}`
          : "?";
        const isAvito =
          dims.width >= 1200 &&
          Math.abs(dims.width / dims.height - AVITO_RATIO) < 0.05;
        return { url, ...dims, ratio, isAvito, selected: true } as ImageInfo;
      })
    ).then((infos) => {
      setImageInfos(infos);
      setLoading(false);
    });
  }, [open, images]);

  // Load templates from localStorage
  useEffect(() => {
    if (!storeId) return;
    try {
      const saved = localStorage.getItem(TEMPLATES_KEY + storeId);
      if (saved) setTemplates(JSON.parse(saved));
    } catch {}
  }, [storeId]);

  const saveTemplates = (tpls: Template[]) => {
    setTemplates(tpls);
    localStorage.setItem(TEMPLATES_KEY + storeId, JSON.stringify(tpls));
  };

  const handleCrop = async (index: number) => {
    setProcessing((prev) => new Set(prev).add(index));
    try {
      const img = await loadImage(imageInfos[index].url);
      const result = smartCrop(img, AVITO_WIDTH, AVITO_HEIGHT);
      setProcessedImages((prev) => new Map(prev).set(index, result));
      toast({ title: `Фото ${index + 1} обрезано до 4:3` });
    } catch (err) {
      toast({ title: "Ошибка обрезки", variant: "destructive" });
    } finally {
      setProcessing((prev) => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    }
  };

  const handleOutpaint = async (index: number) => {
    setProcessing((prev) => new Set(prev).add(index));
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/avito-image-process`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "outpaint",
            image_url: imageInfos[index].url,
            target_width: AVITO_WIDTH,
            target_height: AVITO_HEIGHT,
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Ошибка");
      if (data.image) {
        setProcessedImages((prev) => new Map(prev).set(index, data.image));
        toast({ title: `Фото ${index + 1} дорисовано AI до 4:3` });
      }
    } catch (err: any) {
      toast({
        title: "Ошибка AI дорисовки",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setProcessing((prev) => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    }
  };

  const handleApplyTemplate = async (index: number) => {
    if (!selectedTemplate) {
      toast({ title: "Выберите шаблон", variant: "destructive" });
      return;
    }
    setProcessing((prev) => new Set(prev).add(index));
    try {
      const sourceUrl = processedImages.get(index) || imageInfos[index].url;
      const baseImg = await loadImage(sourceUrl);
      const tplImg = await loadImage(selectedTemplate);
      const result = overlayTemplate(baseImg, tplImg, AVITO_WIDTH, AVITO_HEIGHT);
      setProcessedImages((prev) => new Map(prev).set(index, result));
      toast({ title: `Шаблон наложен на фото ${index + 1}` });
    } catch (err) {
      toast({ title: "Ошибка наложения шаблона", variant: "destructive" });
    } finally {
      setProcessing((prev) => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    }
  };

  const handleApplyTemplateToSelected = async () => {
    if (!selectedTemplate) {
      toast({ title: "Выберите шаблон", variant: "destructive" });
      return;
    }
    const selectedIndexes = imageInfos
      .map((info, i) => (info.selected ? i : -1))
      .filter((i) => i >= 0);
    for (const idx of selectedIndexes) {
      await handleApplyTemplate(idx);
    }
  };

  const handleUploadTemplate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/avito-image-process`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "upload_template",
              store_id: storeId,
              image_data: base64,
            }),
          }
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Ошибка загрузки");

        const newTemplate: Template = {
          id: Date.now().toString(),
          name: file.name.replace(/\.\w+$/, ""),
          url: data.url,
        };
        saveTemplates([...templates, newTemplate]);
        toast({ title: "Шаблон загружен" });
      } catch (err: any) {
        toast({ title: "Ошибка", description: err.message, variant: "destructive" });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteTemplate = (id: string) => {
    saveTemplates(templates.filter((t) => t.id !== id));
  };

  const handleSave = async () => {
    // Build final image list: for selected images, use processed version if available
    const finalImages: string[] = [];
    setLoading(true);

    for (let i = 0; i < imageInfos.length; i++) {
      if (!imageInfos[i].selected) continue;

      const processed = processedImages.get(i);
      if (processed) {
        // Upload processed image
        try {
          const response = await fetch(
            `https://${projectId}.supabase.co/functions/v1/avito-image-process`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "upload_processed",
                store_id: storeId,
                product_id: productId,
                image_data: processed,
              }),
            }
          );
          const data = await response.json();
          if (response.ok && data.url) {
            finalImages.push(data.url);
          } else {
            finalImages.push(imageInfos[i].url);
          }
        } catch {
          finalImages.push(imageInfos[i].url);
        }
      } else {
        finalImages.push(imageInfos[i].url);
      }
    }

    onImagesUpdate(finalImages);
    setLoading(false);
    toast({ title: `Сохранено ${finalImages.length} фото для Авито` });
    onOpenChange(false);
  };

  const toggleSelect = (index: number) => {
    setImageInfos((prev) =>
      prev.map((info, i) =>
        i === index ? { ...info, selected: !info.selected } : info
      )
    );
  };

  const resetProcessed = (index: number) => {
    setProcessedImages((prev) => {
      const next = new Map(prev);
      next.delete(index);
      return next;
    });
  };

  const selectedCount = imageInfos.filter((i) => i.selected).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ImageIcon className="h-4 w-4" />
            Фоторедактор для Авито — {productName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
          <Info className="h-3.5 w-3.5 shrink-0" />
          Оптимальный размер: <strong>1280×960</strong> (4:3). Выберите фото галочками и нажмите «Сохранить».
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="photos" className="text-xs gap-1">
              <ImageIcon className="h-3.5 w-3.5" />
              Фото ({imageInfos.length})
            </TabsTrigger>
            <TabsTrigger value="templates" className="text-xs gap-1">
              <Layers className="h-3.5 w-3.5" />
              Шаблоны ({templates.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="photos" className="flex-1 min-h-0 mt-2">
            <ScrollArea className="h-[55vh]">
              {loading && imageInfos.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 pr-3">
                  {imageInfos.map((info, idx) => {
                    const isProcessing = processing.has(idx);
                    const processed = processedImages.get(idx);
                    return (
                      <div
                        key={idx}
                        className={cn(
                          "rounded-lg border overflow-hidden transition-colors",
                          info.selected ? "border-primary bg-primary/5" : "border-border opacity-50"
                        )}
                      >
                        {/* Image preview */}
                        <div className="relative aspect-[4/3] bg-muted">
                          <img
                            src={processed || info.url}
                            alt={`Фото ${idx + 1}`}
                            className="w-full h-full object-contain"
                          />
                          {isProcessing && (
                            <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                              <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                          )}
                          {/* Checkbox overlay */}
                          <div className="absolute top-2 left-2">
                            <Checkbox
                              checked={info.selected}
                              onCheckedChange={() => toggleSelect(idx)}
                              className="bg-background/80"
                            />
                          </div>
                          {/* Photo number */}
                          <Badge
                            variant="secondary"
                            className="absolute top-2 right-2 text-[10px] px-1.5 py-0 bg-background/80"
                          >
                            {idx + 1}
                          </Badge>
                          {/* Processed indicator */}
                          {processed && (
                            <Badge className="absolute bottom-2 left-2 text-[10px] px-1.5 py-0 bg-green-600">
                              <Check className="h-3 w-3 mr-0.5" />
                              Обработано
                            </Badge>
                          )}
                        </div>

                        {/* Info & actions */}
                        <div className="p-2 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-medium">{info.ratio}</span>
                            <div className="flex items-center gap-1">
                              {info.isAvito && !processed && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 text-green-600 border-green-300">
                                  4:3 ✓
                                </Badge>
                              )}
                              {!info.isAvito && !processed && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 text-orange-500 border-orange-300">
                                  не 4:3
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="flex gap-1 flex-wrap">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-[10px] px-2 gap-1"
                              onClick={() => handleCrop(idx)}
                              disabled={isProcessing}
                            >
                              <Crop className="h-3 w-3" />
                              Обрезка 4:3
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-[10px] px-2 gap-1"
                              onClick={() => handleOutpaint(idx)}
                              disabled={isProcessing}
                            >
                              <Expand className="h-3 w-3" />
                              AI дорисовка
                            </Button>
                            {selectedTemplate && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-[10px] px-2 gap-1"
                                onClick={() => handleApplyTemplate(idx)}
                                disabled={isProcessing}
                              >
                                <Layers className="h-3 w-3" />
                                Шаблон
                              </Button>
                            )}
                            {processed && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-[10px] px-2 gap-1 text-destructive"
                                onClick={() => resetProcessed(idx)}
                              >
                                <X className="h-3 w-3" />
                                Сброс
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="templates" className="flex-1 min-h-0 mt-2">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Загрузите PNG-шаблон с прозрачным фоном. Он будет наложен поверх фото.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={() => templateInputRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Загрузить
                </Button>
                <input
                  ref={templateInputRef}
                  type="file"
                  accept="image/png"
                  className="hidden"
                  onChange={handleUploadTemplate}
                />
              </div>

              {templates.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  Нет шаблонов. Загрузите PNG-файл с прозрачным фоном.
                </div>
              ) : (
                <ScrollArea className="h-[45vh]">
                  <div className="grid grid-cols-3 gap-3 pr-3">
                    {templates.map((tpl) => (
                      <div
                        key={tpl.id}
                        className={cn(
                          "rounded-lg border overflow-hidden cursor-pointer transition-all",
                          selectedTemplate === tpl.url
                            ? "border-primary ring-2 ring-primary/20"
                            : "border-border hover:border-primary/50"
                        )}
                        onClick={() =>
                          setSelectedTemplate(
                            selectedTemplate === tpl.url ? null : tpl.url
                          )
                        }
                      >
                        <div className="aspect-[4/3] bg-[repeating-conic-gradient(#ddd_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]">
                          <img
                            src={tpl.url}
                            alt={tpl.name}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div className="p-1.5 flex items-center justify-between">
                          <span className="text-[11px] truncate">{tpl.name}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTemplate(tpl.id);
                            }}
                            className="text-destructive hover:text-destructive/80"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer actions */}
        <div className="flex items-center justify-between border-t pt-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Выбрано: <strong>{selectedCount}</strong> из {imageInfos.length}
            </span>
            {selectedTemplate && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={handleApplyTemplateToSelected}
                disabled={processing.size > 0}
              >
                <Wand2 className="h-3.5 w-3.5" />
                Шаблон на выбранные
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={loading || processing.size > 0 || selectedCount === 0}
              className="gap-1"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              Сохранить ({selectedCount} фото)
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
