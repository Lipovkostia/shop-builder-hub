import { useState, useEffect, useCallback, useRef } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Wand2, Image as ImageIcon, Upload, X, Check, Maximize, Layers, Download,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ImageInfo {
  url: string;
  width: number;
  height: number;
  isGenerated?: boolean;
}

interface AvitoImageEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  images: string[];
  storeId: string;
  /** Currently selected avito images from params */
  avitoImages?: string[];
  onSave: (selectedImages: string[]) => void;
  /** Callback when new images are uploaded to product */
  onImagesAdded?: (newImageUrls: string[]) => void;
}

function loadImageDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = url;
  });
}

/** Canvas-based resize to target dimensions (crop/fit) */
function canvasResize(imageUrl: string, targetW: number, targetH: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d")!;
      
      // Fill with white background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, targetW, targetH);

      // Calculate cover-fit (center crop)
      const srcRatio = img.naturalWidth / img.naturalHeight;
      const dstRatio = targetW / targetH;
      let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
      
      if (srcRatio > dstRatio) {
        // Source is wider — crop sides
        sw = img.naturalHeight * dstRatio;
        sx = (img.naturalWidth - sw) / 2;
      } else {
        // Source is taller — crop top/bottom
        sh = img.naturalWidth / dstRatio;
        sy = (img.naturalHeight - sh) / 2;
      }
      
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas toBlob failed"));
      }, "image/jpeg", 0.92);
    };
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = imageUrl;
  });
}

/** Canvas-based template overlay */
function canvasOverlay(imageUrl: string, templateUrl: string, targetW: number, targetH: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const tpl = new window.Image();
    img.crossOrigin = "anonymous";
    tpl.crossOrigin = "anonymous";
    
    let imgLoaded = false, tplLoaded = false;
    
    const tryDraw = () => {
      if (!imgLoaded || !tplLoaded) return;
      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d")!;
      
      // Draw product image (cover fit)
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, targetW, targetH);
      
      const srcRatio = img.naturalWidth / img.naturalHeight;
      const dstRatio = targetW / targetH;
      let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
      if (srcRatio > dstRatio) {
        sw = img.naturalHeight * dstRatio;
        sx = (img.naturalWidth - sw) / 2;
      } else {
        sh = img.naturalWidth / dstRatio;
        sy = (img.naturalHeight - sh) / 2;
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);
      
      // Draw template on top
      ctx.drawImage(tpl, 0, 0, targetW, targetH);
      
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas toBlob failed"));
      }, "image/png", 1);
    };
    
    img.onload = () => { imgLoaded = true; tryDraw(); };
    tpl.onload = () => { tplLoaded = true; tryDraw(); };
    img.onerror = () => reject(new Error("Image load failed"));
    tpl.onerror = () => reject(new Error("Template load failed"));
    img.src = imageUrl;
    tpl.src = templateUrl;
  });
}

export function AvitoImageEditor({
  open, onOpenChange, productId, productName, images, storeId, avitoImages, onSave,
}: AvitoImageEditorProps) {
  const { toast } = useToast();
  const [imageInfos, setImageInfos] = useState<ImageInfo[]>([]);
  const [generatedImages, setGeneratedImages] = useState<ImageInfo[]>([]);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState<Set<string>>(new Set());
  const [templateUrl, setTemplateUrl] = useState<string | null>(null);
  const [templatePreview, setTemplatePreview] = useState<string | null>(null);
  const templateInputRef = useRef<HTMLInputElement>(null);
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

  // Load image dimensions
  useEffect(() => {
    if (!open || images.length === 0) return;
    let cancelled = false;

    const load = async () => {
      const infos: ImageInfo[] = [];
      for (const url of images) {
        const dims = await loadImageDimensions(url);
        if (cancelled) return;
        infos.push({ url, ...dims });
      }
      setImageInfos(infos);
    };
    load();

    return () => { cancelled = true; };
  }, [open, images]);

  // Initialize selected from avitoImages param
  useEffect(() => {
    if (open) {
      if (avitoImages && avitoImages.length > 0) {
        setSelectedUrls(new Set(avitoImages));
      } else {
        // Default: all original images selected
        setSelectedUrls(new Set(images));
      }
      setGeneratedImages([]);
    }
  }, [open, avitoImages, images]);

  const toggleSelect = (url: string) => {
    setSelectedUrls(prev => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const handleCanvasResize = useCallback(async (imageUrl: string) => {
    setProcessing(prev => new Set(prev).add(imageUrl));
    try {
      const blob = await canvasResize(imageUrl, 1280, 960);
      // Upload to storage
      const fileName = `${storeId}/${productId}/avito_resize_${Date.now()}.jpg`;
      const { error } = await supabase.storage
        .from("avito-images")
        .upload(fileName, blob, { contentType: "image/jpeg", upsert: true });
      if (error) throw error;
      
      const { data: urlData } = supabase.storage.from("avito-images").getPublicUrl(fileName);
      const dims = await loadImageDimensions(urlData.publicUrl);
      
      const newImg: ImageInfo = { url: urlData.publicUrl, ...dims, isGenerated: true };
      setGeneratedImages(prev => [...prev, newImg]);
      setSelectedUrls(prev => new Set(prev).add(urlData.publicUrl));
      toast({ title: "Фото изменено до 1280×960 (4:3)" });
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(prev => { const n = new Set(prev); n.delete(imageUrl); return n; });
    }
  }, [storeId, productId, toast]);

  const handleAiResize = useCallback(async (imageUrl: string) => {
    setProcessing(prev => new Set(prev).add(`ai_${imageUrl}`));
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/avito-image-edit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "ai_resize",
            image_url: imageUrl,
            store_id: storeId,
            product_id: productId,
            target_width: 1280,
            target_height: 960,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "AI error");
      
      const dims = await loadImageDimensions(data.url);
      const newImg: ImageInfo = { url: data.url, ...dims, isGenerated: true };
      setGeneratedImages(prev => [...prev, newImg]);
      setSelectedUrls(prev => new Set(prev).add(data.url));
      toast({ title: "AI: фото адаптировано для Авито" });
    } catch (err: any) {
      toast({ title: "Ошибка AI", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(prev => { const n = new Set(prev); n.delete(`ai_${imageUrl}`); return n; });
    }
  }, [storeId, productId, projectId, toast]);

  const handleTemplateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const localUrl = URL.createObjectURL(file);
    setTemplatePreview(localUrl);
    
    // Upload template to storage for edge function access
    const uploadTemplate = async () => {
      const fileName = `${storeId}/templates/tpl_${Date.now()}.png`;
      const { error } = await supabase.storage
        .from("avito-images")
        .upload(fileName, file, { contentType: file.type, upsert: true });
      if (error) {
        toast({ title: "Ошибка загрузки шаблона", variant: "destructive" });
        return;
      }
      const { data: urlData } = supabase.storage.from("avito-images").getPublicUrl(fileName);
      setTemplateUrl(urlData.publicUrl);
      toast({ title: "Шаблон загружен" });
    };
    uploadTemplate();
    e.target.value = "";
  };

  const handleApplyTemplate = useCallback(async (imageUrl: string) => {
    if (!templateUrl && !templatePreview) {
      toast({ title: "Сначала загрузите шаблон", variant: "destructive" });
      return;
    }
    setProcessing(prev => new Set(prev).add(`tpl_${imageUrl}`));
    try {
      // Use canvas overlay for instant result
      const overlayUrl = templatePreview || templateUrl!;
      const blob = await canvasOverlay(imageUrl, overlayUrl, 1280, 960);
      
      const fileName = `${storeId}/${productId}/avito_tpl_${Date.now()}.png`;
      const { error } = await supabase.storage
        .from("avito-images")
        .upload(fileName, blob, { contentType: "image/png", upsert: true });
      if (error) throw error;
      
      const { data: urlData } = supabase.storage.from("avito-images").getPublicUrl(fileName);
      const dims = await loadImageDimensions(urlData.publicUrl);
      
      const newImg: ImageInfo = { url: urlData.publicUrl, ...dims, isGenerated: true };
      setGeneratedImages(prev => [...prev, newImg]);
      setSelectedUrls(prev => new Set(prev).add(urlData.publicUrl));
      toast({ title: "Шаблон наложен" });
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(prev => { const n = new Set(prev); n.delete(`tpl_${imageUrl}`); return n; });
    }
  }, [templateUrl, templatePreview, storeId, productId, toast]);

  const handleSave = () => {
    onSave(Array.from(selectedUrls));
    onOpenChange(false);
  };

  const handleRemoveGenerated = (url: string) => {
    setGeneratedImages(prev => prev.filter(img => img.url !== url));
    setSelectedUrls(prev => { const n = new Set(prev); n.delete(url); return n; });
  };

  const allImages = [...imageInfos, ...generatedImages];
  const is43 = (w: number, h: number) => w > 0 && h > 0 && Math.abs((w / h) - (4 / 3)) < 0.05;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <ImageIcon className="h-4 w-4" />
            Фото для Авито — {productName}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {/* Template section */}
          <div className="mb-4 p-3 rounded-lg border bg-muted/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5" />
                Шаблон (накладывается поверх фото)
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => templateInputRef.current?.click()}
              >
                <Upload className="h-3 w-3 mr-1" />
                {templatePreview ? "Заменить" : "Загрузить PNG"}
              </Button>
              <input
                ref={templateInputRef}
                type="file"
                accept="image/png"
                className="hidden"
                onChange={handleTemplateUpload}
              />
            </div>
            {templatePreview && (
              <div className="flex items-center gap-3">
                <img src={templatePreview} alt="Шаблон" className="h-16 rounded border bg-[repeating-conic-gradient(#80808022_0%_25%,transparent_0%_50%)_50%/16px_16px]" />
                <div className="text-xs text-muted-foreground">
                  Шаблон загружен. Нажмите «Шаблон» на любом фото для наложения.
                </div>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 ml-auto" onClick={() => { setTemplatePreview(null); setTemplateUrl(null); }}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
            {!templatePreview && (
              <p className="text-xs text-muted-foreground">
                Загрузите PNG с прозрачным фоном. Он будет наложен поверх фото товара.
              </p>
            )}
          </div>

          {/* Avito requirements info */}
          <div className="mb-3 flex items-center gap-2 text-[11px] text-muted-foreground">
            <Maximize className="h-3 w-3" />
            Оптимально: 1280×960 (4:3). Допустимо: 1920×1440. JPG/PNG до 30 МБ.
          </div>

          {/* Original images */}
          {imageInfos.length > 0 && (
            <div className="mb-3">
              <h4 className="text-xs font-medium mb-2 text-muted-foreground">Оригинальные фото ({imageInfos.length})</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {imageInfos.map((info, idx) => {
                  const isProcessing = processing.has(info.url) || processing.has(`ai_${info.url}`) || processing.has(`tpl_${info.url}`);
                  const isSelected = selectedUrls.has(info.url);
                  const isOptimal = is43(info.width, info.height);
                  
                  return (
                    <div key={info.url} className={`relative border rounded-lg overflow-hidden transition-all ${isSelected ? "ring-2 ring-primary" : "opacity-70"}`}>
                      <div className="relative aspect-[4/3] bg-muted">
                        <img src={info.url} alt="" className="w-full h-full object-cover" />
                        {/* Checkbox overlay */}
                        <div className="absolute top-2 left-2">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(info.url)}
                            className="bg-background/80 border-2"
                          />
                        </div>
                        {/* Dimensions badge */}
                        <div className="absolute top-2 right-2">
                          <Badge variant={isOptimal ? "default" : "secondary"} className="text-[10px] px-1.5 py-0.5">
                            {info.width}×{info.height}
                          </Badge>
                        </div>
                        {isOptimal && (
                          <div className="absolute bottom-2 right-2">
                            <Badge className="text-[10px] px-1.5 py-0.5 bg-green-600 text-white">4:3 ✓</Badge>
                          </div>
                        )}
                      </div>
                      {/* Actions */}
                      <div className="flex gap-1 p-1.5 bg-card">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px] flex-1"
                          disabled={isProcessing}
                          onClick={() => handleCanvasResize(info.url)}
                        >
                          {processing.has(info.url) ? <Loader2 className="h-3 w-3 animate-spin" /> : <Maximize className="h-3 w-3 mr-0.5" />}
                          4:3
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px] flex-1"
                          disabled={isProcessing}
                          onClick={() => handleAiResize(info.url)}
                        >
                          {processing.has(`ai_${info.url}`) ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3 mr-0.5" />}
                          AI
                        </Button>
                        {(templatePreview || templateUrl) && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[10px] flex-1"
                            disabled={isProcessing}
                            onClick={() => handleApplyTemplate(info.url)}
                          >
                            {processing.has(`tpl_${info.url}`) ? <Loader2 className="h-3 w-3 animate-spin" /> : <Layers className="h-3 w-3 mr-0.5" />}
                            Шаблон
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Generated images */}
          {generatedImages.length > 0 && (
            <div className="mb-3">
              <h4 className="text-xs font-medium mb-2 text-muted-foreground">
                Сгенерированные фото ({generatedImages.length})
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {generatedImages.map((info) => {
                  const isSelected = selectedUrls.has(info.url);
                  const isOptimal = is43(info.width, info.height);
                  
                  return (
                    <div key={info.url} className={`relative border rounded-lg overflow-hidden transition-all ${isSelected ? "ring-2 ring-primary" : "opacity-70"}`}>
                      <div className="relative aspect-[4/3] bg-muted">
                        <img src={info.url} alt="" className="w-full h-full object-cover" />
                        <div className="absolute top-2 left-2">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(info.url)}
                            className="bg-background/80 border-2"
                          />
                        </div>
                        <div className="absolute top-2 right-2">
                          <Badge variant={isOptimal ? "default" : "secondary"} className="text-[10px] px-1.5 py-0.5">
                            {info.width}×{info.height}
                          </Badge>
                        </div>
                        {isOptimal && (
                          <div className="absolute bottom-2 right-2">
                            <Badge className="text-[10px] px-1.5 py-0.5 bg-green-600 text-white">4:3 ✓</Badge>
                          </div>
                        )}
                        {/* Remove generated */}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="absolute bottom-2 left-2 h-5 w-5 p-0 bg-destructive/80 hover:bg-destructive text-white rounded-full"
                          onClick={() => handleRemoveGenerated(info.url)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {images.length === 0 && (
            <div className="py-8 text-center text-muted-foreground text-sm">
              У этого товара нет фотографий
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t mt-2">
          <span className="text-xs text-muted-foreground">
            Выбрано для Авито: {selectedUrls.size} из {allImages.length} фото
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button size="sm" onClick={handleSave}>
              <Check className="h-3.5 w-3.5 mr-1" />
              Сохранить ({selectedUrls.size})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
