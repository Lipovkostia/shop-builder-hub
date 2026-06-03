import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, Image as ImageIcon } from "lucide-react";
import { AvitoPhotoDrawer } from "./AvitoPhotoDrawer";

interface Props {
  storeId: string;
}

export function AvitoPhotosPanel({ storeId }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Card className="p-4 mb-4 border-violet-500/30 bg-violet-500/5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <ImageIcon className="h-5 w-5 text-violet-600" />
            <div>
              <div className="font-medium text-sm">Массовая обработка фото</div>
              <div className="text-xs text-muted-foreground">
                Импорт папок Google Drive · AI уникализация фото для обхода дубль-фильтра Avito
              </div>
            </div>
          </div>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Sparkles className="h-4 w-4" />
            Открыть фото-студию
          </Button>
        </div>
      </Card>
      <AvitoPhotoDrawer
        open={open}
        onOpenChange={setOpen}
        storeId={storeId}
        productId={storeId}
        productName="Общая библиотека магазина"
      />
    </>
  );
}
