import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Loader2, FolderOpen, Sparkles, Image as ImageIcon, Check, Plus, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  storeId: string;
  productId: string;
  productName?: string;
  initialImages?: string[];
  onApply?: (images: string[]) => void;
}

interface Variant {
  id: string;
  source_url: string | null;
  variant_url: string;
  created_at: string;
}

export function AvitoPhotoDrawer({ open, onOpenChange, storeId, productId, productName, initialImages = [], onApply }: Props) {
  const [folderUrl, setFolderUrl] = useState("");
  const [imported, setImported] = useState<string[]>(initialImages);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [variantsPerImage, setVariantsPerImage] = useState(2);
  const [loadingImport, setLoadingImport] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);

  const loadVariants = async () => {
    const { data, error } = await supabase.functions.invoke("avito-photo-pipeline", {
      body: { action: "list_variants", storeId, productId },
    });
    if (!error) setVariants((data as any)?.variants ?? []);
  };

  useEffect(() => {
    if (open && productId) loadVariants();
  }, [open, productId]);

  const extractFolderId = (input: string) => {
    const m = input.match(/folders\/([a-zA-Z0-9_-]+)/);
    return m ? m[1] : input.trim();
  };

  const importFromDrive = async () => {
    const folderId = extractFolderId(folderUrl);
    if (!folderId) { toast.error("Укажите ссылку или ID папки"); return; }
    setLoadingImport(true);
    try {
      const { data, error } = await supabase.functions.invoke("avito-photo-pipeline", {
        body: { action: "import_drive", storeId, productId, folderId },
      });
      if (error) throw error;
      const urls = (data as any)?.uploaded ?? [];
      setImported((p) => [...urls, ...p]);
      toast.success(`Импортировано: ${urls.length}`);
    } catch (e: any) {
      toast.error(e?.message || "Ошибка импорта");
    } finally {
      setLoadingImport(false);
    }
  };

  const uniquify = async () => {
    const sources = Array.from(selected);
    if (!sources.length) { toast.error("Выберите фото-источники"); return; }
    setLoadingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke("avito-photo-pipeline", {
        body: { action: "uniquify", storeId, productId, sourceUrls: sources, variantsPerImage },
      });
      if (error) throw error;
      toast.success(`Создано вариантов: ${(data as any)?.count ?? 0}`);
      await loadVariants();
    } catch (e: any) {
      toast.error(e?.message || "Ошибка AI обработки");
    } finally {
      setLoadingAI(false);
    }
  };

  const toggle = (url: string) => {
    setSelected((p) => {
      const n = new Set(p);
      n.has(url) ? n.delete(url) : n.add(url);
      return n;
    });
  };

  const allSources = Array.from(new Set([...imported, ...initialImages]));

  const applySelectedToListing = () => {
    const selectedVariants = variants.filter((v) => selected.has(v.variant_url)).map((v) => v.variant_url);
    const merged = Array.from(new Set([...initialImages, ...selectedVariants]));
    onApply?.(merged);
    toast.success("Фото добавлены к объявлению");
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" /> Фото для Avito
          </SheetTitle>
          <SheetDescription>{productName ?? productId}</SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="sources" className="mt-4">
          <TabsList className="grid grid-cols-3">
            <TabsTrigger value="sources">Источники ({allSources.length})</TabsTrigger>
            <TabsTrigger value="ai">AI уникализация</TabsTrigger>
            <TabsTrigger value="variants">Варианты ({variants.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="sources" className="space-y-4">
            <Card className="p-3">
              <Label className="text-xs">Импорт из Google Drive (папка)</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  placeholder="https://drive.google.com/drive/folders/..."
                  value={folderUrl}
                  onChange={(e) => setFolderUrl(e.target.value)}
                />
                <Button onClick={importFromDrive} disabled={loadingImport}>
                  {loadingImport ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderOpen className="h-4 w-4" />}
                  Импорт
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Все картинки из папки загрузятся в хранилище и появятся ниже.
              </p>
            </Card>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {allSources.map((url) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => toggle(url)}
                  className={`relative aspect-square rounded-md overflow-hidden border-2 ${
                    selected.has(url) ? "border-primary" : "border-transparent"
                  }`}
                >
                  <img src={url} alt="" className="object-cover w-full h-full" loading="lazy" />
                  {selected.has(url) && (
                    <span className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </button>
              ))}
              {!allSources.length && (
                <p className="col-span-full text-sm text-muted-foreground text-center py-8">
                  Нет фото. Импортируйте из Google Drive.
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="ai" className="space-y-4">
            <Card className="p-3 space-y-3">
              <div className="flex items-center justify-between">
                <Label>Вариантов на каждое фото</Label>
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="outline" onClick={() => setVariantsPerImage((n) => Math.max(1, n - 1))}>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <Badge variant="secondary" className="min-w-8 justify-center">{variantsPerImage}</Badge>
                  <Button size="icon" variant="outline" onClick={() => setVariantsPerImage((n) => Math.min(5, n + 1))}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Выбрано источников: <b>{selected.size}</b> · Будет создано вариантов: <b>{selected.size * variantsPerImage}</b>
              </p>
              <Button onClick={uniquify} disabled={loadingAI || !selected.size} className="w-full">
                {loadingAI ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Сгенерировать уникальные варианты
              </Button>
              <p className="text-xs text-muted-foreground">
                AI создаёт визуально похожие, но уникальные изображения: тон, свет, микро-кроп — чтобы Avito не считал фото дубликатами.
              </p>
            </Card>
          </TabsContent>

          <TabsContent value="variants" className="space-y-4">
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {variants.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => toggle(v.variant_url)}
                  className={`relative aspect-square rounded-md overflow-hidden border-2 ${
                    selected.has(v.variant_url) ? "border-primary" : "border-transparent"
                  }`}
                >
                  <img src={v.variant_url} alt="" className="object-cover w-full h-full" loading="lazy" />
                  {selected.has(v.variant_url) && (
                    <span className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </button>
              ))}
              {!variants.length && (
                <p className="col-span-full text-sm text-muted-foreground text-center py-8">
                  Пока нет вариантов. Перейдите на вкладку AI.
                </p>
              )}
            </div>
            {onApply && (
              <Button onClick={applySelectedToListing} disabled={!selected.size} className="w-full">
                Применить выбранные ({selected.size}) к объявлению
              </Button>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
