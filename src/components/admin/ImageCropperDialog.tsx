import { useCallback, useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  file: File | null;
  targetWidth: number;
  targetHeight: number;
  recommendLabel?: string;
  onCropped: (blob: Blob) => void | Promise<void>;
}

async function getCroppedBlob(
  imageSrc: string,
  area: Area,
  outW: number,
  outH: number,
  mime: string,
): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = imageSrc;
  });
  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, outW, outH);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("blob failed"))), mime, 0.9);
  });
}

export default function ImageCropperDialog({
  open,
  onOpenChange,
  file,
  targetWidth,
  targetHeight,
  recommendLabel,
  onCropped,
}: Props) {
  const [src, setSrc] = useState<string>("");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const aspect = targetWidth / targetHeight;

  useEffect(() => {
    if (!file) return setSrc("");
    const url = URL.createObjectURL(file);
    setSrc(url);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onComplete = useCallback((_: Area, pixels: Area) => setArea(pixels), []);

  const handleSave = async () => {
    if (!src || !area || !file) return;
    setBusy(true);
    try {
      const mime = file.type || "image/jpeg";
      const blob = await getCroppedBlob(src, area, targetWidth, targetHeight, mime);
      await onCropped(blob);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Кадрирование изображения</DialogTitle>
          <DialogDescription>
            Область внутри рамки будет использована как баннер. Целевой размер: <b>{recommendLabel || `${targetWidth}×${targetHeight} px`}</b>. Перетаскивайте картинку и меняйте масштаб.
          </DialogDescription>
        </DialogHeader>

        <div className="relative h-[420px] w-full overflow-hidden rounded-md bg-muted">
          {src && (
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onComplete}
              objectFit="contain"
            />
          )}
        </div>

        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Масштаб</div>
          <Slider value={[zoom]} min={1} max={4} step={0.01} onValueChange={(v) => setZoom(v[0])} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Отмена</Button>
          <Button onClick={handleSave} disabled={busy || !area}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Обрезать и загрузить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
