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
  Loader2, Wand2, Image as ImageIcon, Upload, X, Check, Maximize, Layers, Download, Bookmark,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ImageInfo {
  url: string;
  width: number;
  height: number;
  isGenerated?: boolean;
}

interface SavedTemplate {
  name: string;
  url: string;
  previewUrl: string;
}

interface AvitoImageEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  images: string[];
  storeId: string;
  avitoImages?: string[];
  onSave: (selectedImages: string[]) => void;
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

function canvasResize(imageUrl: string, targetW: number, targetH: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d")!;
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
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas toBlob failed"));
      }, "image/jpeg", 0.92);
    };
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = imageUrl;
  });
}

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
  open, onOpenChange, productId, productName, images, storeId, avitoImages, onSave, onImagesAdded,
}: AvitoImageEditorProps) {
  const { toast } = useToast();
  const [imageInfos, setImageInfos] = useState<ImageInfo[]>([]);
  const [generatedImages, setGeneratedImages] = useState<ImageInfo[]>([]);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState<Set<string>>(new Set());
  const [templateUrl, setTemplateUrl] = useState<string | null>(null);
  const [templatePreview, setTemplatePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const templateInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

  // Load saved templates from storage
  useEffect(() => {
    if (!open || !storeId) return;
    const loadTemplates = async () => {
      setLoadingTemplates(true);
      try {
        const { data: files, error } = await supabase.storage
          .from("avito-images")
          .list(`${storeId}/templates`, { limit: 50, sortBy: { column: "created_at", order: "desc" } });
        if (error || !files) { setLoadingTemplates(false); return; }
        const templates: SavedTemplate[] = files
          .filter(f => f.name.endsWith(".png"))
          .map(f => {
            const { data: urlData } = supabase.storage.from("avito-images").getPublicUrl(`${storeId}/templates/${f.name}`);
            return { name: f.name, url: urlData.publicUrl, previewUrl: urlData.publicUrl };
          });
        setSavedTemplates(templates);
      } catch {
        // ignore
      } finally {
        setLoadingTemplates(false);
      }
    };
    loadTemplates();
  }, [open, storeId]);

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
      const fileName = `${storeId}/${productId}/avito_resize_${Date.now()}.jpg`;
      const { error } = await supabase.storage.from("avito-images").upload(fileName, blob, { contentType: "image/jpeg", upsert: true });
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
            action: "ai_resize", image_url: imageUrl, store_id: storeId, product_id: productId,
            target_width: 1280, target_height: 960,
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

  const handleTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const localUrl = URL.createObjectURL(file);
    setTemplatePreview(localUrl);

    // Upload template to storage
    const fileName = `${storeId}/templates/tpl_${Date.now()}.png`;
    const { error } = await supabase.storage.from("avito-images").upload(fileName, file, { contentType: file.type, upsert: true });
    if (error) {
      toast({ title: "Ошибка загрузки шаблона", variant: "destructive" });
      e.target.value = "";
      return;
    }
    const { data: urlData } = supabase.storage.from("avito-images").getPublicUrl(fileName);
    setTemplateUrl(urlData.publicUrl);

    // Add to saved templates list
    setSavedTemplates(prev => [{ name: fileName.split("/").pop()!, url: urlData.publicUrl, previewUrl: urlData.publicUrl }, ...prev]);
    toast({ title: "Шаблон загружен и сохранён" });
    e.target.value = "";
  };

  const handleSelectSavedTemplate = (tpl: SavedTemplate) => {
    setTemplateUrl(tpl.url);
    setTemplatePreview(tpl.previewUrl);
    toast({ title: "Шаблон выбран" });
  };

  const handleDeleteTemplate = async (tpl: SavedTemplate) => {
    const path = `${storeId}/templates/${tpl.name}`;
    await supabase.storage.from("avito-images").remove([path]);
    setSavedTemplates(prev => prev.filter(t => t.name !== tpl.name));
    if (templateUrl === tpl.url) {
      setTemplateUrl(null);
      setTemplatePreview(null);
    }
    toast({ title: "Шаблон удалён" });
  };

  const handleApplyTemplate = useCallback(async (imageUrl: string) => {
    if (!templateUrl && !templatePreview) {
      toast({ title: "Сначала загрузите шаблон", variant: "destructive" });
      return;
    }
    setProcessing(prev => new Set(prev).add(`tpl_${imageUrl}`));
    try {
      const overlayUrl = templateUrl || templatePreview!;
      const blob = await canvasOverlay(imageUrl, overlayUrl, 1280, 960);
      const fileName = `${storeId}/${productId}/avito_tpl_${Date.now()}.png`;
      const { error } = await supabase.storage.from("avito-images").upload(fileName, blob, { contentType: "image/png", upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("avito-images").getPublicUrl(fileName);
      const dims = await loadImageDimensions(urlData.publicUrl);
      const newImg: ImageInfo = { url: urlData.publicUrl, ...dims, isGenerated: true };
      setGeneratedImages(prev => [...prev, newImg]);
      // Keep original selected AND add the generated one
      setSelectedUrls(prev => new Set(prev).add(urlData.publicUrl));
      toast({ title: "Шаблон наложен — оригинал сохранён" });
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

  const handleUploadPhotos = useCallback(async (files: FileList | File[]) => {
    const fileArr = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (fileArr.length === 0) return;
    setUploading(true);
    const newUrls: string[] = [];
    try {
      for (const file of fileArr) {
        const ext = file.name.split(".").pop() || "jpg";
        const fileName = `${storeId}/${productId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage.from("product-images").upload(fileName, file, { contentType: file.type, upsert: true });
        if (error) throw error;
        const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(fileName);
        newUrls.push(urlData.publicUrl);
      }
      const currentImages = images || [];
      const updatedImages = [...currentImages, ...newUrls];
      const { error: updateError } = await (supabase as any).from("products").update({ images: updatedImages }).eq("id", productId);
      if (updateError) throw updateError;
      for (const url of newUrls) {
        const dims = await loadImageDimensions(url);
        setImageInfos(prev => [...prev, { url, ...dims }]);
        setSelectedUrls(prev => new Set(prev).add(url));
      }
      onImagesAdded?.(newUrls);
      toast({ title: `Загружено ${newUrls.length} фото` });
    } catch (err: any) {
      toast({ title: "Ошибка загрузки", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }, [storeId, productId, images, toast, onImagesAdded]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) handleUploadPhotos(e.dataTransfer.files);
  }, [handleUploadPhotos]);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false); }, []);

  const allImages = [...imageInfos, ...generatedImages];
  const is43 = (w: number, h: number) => w > 0 && h > 0 && Math.abs((w / h) - (4 / 3)) < 0.05;
  const hasTemplate = !!(templateUrl || templatePreview);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col gap-0">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <ImageIcon className="h-4 w-4" />
            Фото для Авито — {productName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-hidden">
          <ScrollArea className="h-full w-full">
            <div className="px-6 py-4 space-y-4">
              {/* Template section */}
              <div className="p-3 rounded-lg border bg-muted/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5" />
                    Шаблон (накладывается поверх фото)
                  </span>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => templateInputRef.current?.click()}>
                    <Upload className="h-3 w-3 mr-1" />
                    {hasTemplate ? "Загрузить новый" : "Загрузить PNG"}
                  </Button>
                  <input ref={templateInputRef} type="file" accept="image/png" className="hidden" onChange={handleTemplateUpload} />
                </div>

                {/* Active template */}
                {templatePreview && (
                  <div className="flex items-center gap-3 mb-2 p-2 rounded border bg-background">
                    <img src={templatePreview} alt="Шаблон" className="h-14 rounded border bg-muted" />
                    <div className="flex-1">
                      <p className="text-xs font-medium">Активный шаблон</p>
                      <p className="text-[11px] text-muted-foreground">
                        Нажмите <Layers className="h-3 w-3 inline" /> на фото для наложения
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => { setTemplatePreview(null); setTemplateUrl(null); }}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}

                {/* Saved templates gallery */}
                {savedTemplates.length > 0 && (
                  <div>
                    <p className="text-[11px] text-muted-foreground mb-1.5 flex items-center gap-1">
                      <Bookmark className="h-3 w-3" />
                      Сохранённые шаблоны ({savedTemplates.length})
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {savedTemplates.map(tpl => (
                        <div
                          key={tpl.name}
                          className={`relative group cursor-pointer rounded border p-0.5 transition-all ${
                            templateUrl === tpl.url ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/50"
                          }`}
                          onClick={() => handleSelectSavedTemplate(tpl)}
                        >
                          <img src={tpl.previewUrl} alt="Шаблон" className="h-12 w-12 object-contain rounded bg-muted" />
                          <button
                            className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full h-4 w-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(tpl); }}
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!templatePreview && savedTemplates.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Загрузите PNG с прозрачным фоном. Шаблоны сохраняются для повторного использования.
                  </p>
                )}
              </div>

              {/* Avito requirements info */}
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Maximize className="h-3 w-3" />
                Оптимально: 1280×960 (4:3). Допустимо: 1920×1440. JPG/PNG до 30 МБ.
              </div>

              {/* Upload / Drop zone */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => uploadInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                  isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
                }`}
              >
                {uploading ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Загрузка...
                  </div>
                ) : (
                  <>
                    <Upload className="h-6 w-6 mx-auto mb-2 opacity-50" />
                    <p className="text-sm text-muted-foreground">Перетащите фото сюда или нажмите для выбора</p>
                    <p className="text-xs text-muted-foreground mt-1">JPG, PNG до 30 МБ</p>
                  </>
                )}
                <input ref={uploadInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden"
                  onChange={(e) => e.target.files && handleUploadPhotos(e.target.files)} />
              </div>

              {/* Original images */}
              {imageInfos.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold mb-3">Оригинальные фото ({imageInfos.length})</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {imageInfos.map((img) => (
                      <div key={img.url} className="relative">
                        <div className="aspect-[4/3] bg-muted rounded-lg overflow-hidden border relative">
                          <img src={img.url} alt="Оригинал" className="w-full h-full object-cover" />
                          {is43(img.width, img.height) && (
                            <Badge className="absolute top-2 right-2 bg-primary/80 text-xs">4:3</Badge>
                          )}
                          <span className="absolute bottom-1 right-1 text-[10px] bg-background/80 px-1.5 py-0.5 rounded text-muted-foreground">
                            {img.width}×{img.height}
                          </span>
                        </div>
                        {/* Action buttons — always visible */}
                        <div className="flex items-center gap-1 mt-1.5">
                          <Button
                            size="sm" variant="outline" className="h-7 text-xs flex-1"
                            onClick={() => handleCanvasResize(img.url)}
                            disabled={processing.has(img.url)}
                          >
                            {processing.has(img.url) ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Maximize className="h-3 w-3 mr-1" />4:3</>}
                          </Button>
                          <Button
                            size="sm" variant="outline" className="h-7 text-xs flex-1"
                            onClick={() => handleAiResize(img.url)}
                            disabled={processing.has(`ai_${img.url}`)}
                          >
                            {processing.has(`ai_${img.url}`) ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Wand2 className="h-3 w-3 mr-1" />AI</>}
                          </Button>
                          <Button
                            size="sm" variant={hasTemplate ? "default" : "outline"}
                            className="h-7 text-xs flex-1"
                            onClick={() => handleApplyTemplate(img.url)}
                            disabled={!hasTemplate || processing.has(`tpl_${img.url}`)}
                          >
                            {processing.has(`tpl_${img.url}`) ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Layers className="h-3 w-3 mr-1" />Шаблон</>}
                          </Button>
                        </div>
                        <label className="absolute top-2 left-2 flex items-center gap-2 cursor-pointer z-10">
                          <Checkbox checked={selectedUrls.has(img.url)} onCheckedChange={() => toggleSelect(img.url)} />
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Generated images */}
              {generatedImages.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold mb-3">Сгенерированные фото ({generatedImages.length})</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {generatedImages.map((img) => (
                      <div key={img.url} className="relative">
                        <div className="aspect-[4/3] bg-muted rounded-lg overflow-hidden border-2 border-primary/50 relative">
                          <img src={img.url} alt="Сгенерировано" className="w-full h-full object-cover" />
                          <Badge className="absolute top-2 right-2 bg-primary/80 text-xs">Новое</Badge>
                          <span className="absolute bottom-1 right-1 text-[10px] bg-background/80 px-1.5 py-0.5 rounded text-muted-foreground">
                            {img.width}×{img.height}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                          {hasTemplate && (
                            <Button
                              size="sm" variant="outline" className="h-7 text-xs flex-1"
                              onClick={() => handleApplyTemplate(img.url)}
                              disabled={processing.has(`tpl_${img.url}`)}
                            >
                              {processing.has(`tpl_${img.url}`) ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Layers className="h-3 w-3 mr-1" />Шаблон</>}
                            </Button>
                          )}
                          <Button size="sm" variant="outline" className="h-7 text-xs text-destructive" onClick={() => handleRemoveGenerated(img.url)}>
                            <X className="h-3 w-3 mr-1" />Удалить
                          </Button>
                        </div>
                        <label className="absolute top-2 left-2 flex items-center gap-2 cursor-pointer z-10">
                          <Checkbox checked={selectedUrls.has(img.url)} onCheckedChange={() => toggleSelect(img.url)} />
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {allImages.length === 0 && (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  Загрузите фото или выберите из товара
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t mt-2 flex-shrink-0 px-6 py-3">
          <span className="text-xs text-muted-foreground">
            Выбрано для Авито: {selectedUrls.size} из {allImages.length} фото
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Отмена</Button>
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
