import { X, Trash2, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DemoProduct {
  id: string;
  name: string;
  sku?: string;
  price?: number;
  unit?: string;
}

interface LandingDemoCartProps {
  items: DemoProduct[];
  onRemove: (id: string) => void;
  onClear: () => void;
}

export default function LandingDemoCart({ items, onRemove, onClear }: LandingDemoCartProps) {
  return (
    <div className="rounded-lg border bg-card overflow-hidden flex flex-col h-full">
      <div className="px-3 py-2 border-b bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <ShoppingCart className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Мой каталог · {items.length}
          </span>
        </div>
        {items.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px] text-muted-foreground hover:text-destructive"
            onClick={onClear}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Очистить
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2 p-4">
            <ShoppingCart className="h-8 w-8 opacity-30" />
            <p className="text-[11px] text-center">
              Выберите товары из списка слева и нажмите «Добавить в каталог»
            </p>
          </div>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b bg-muted/20">
                <th className="text-left text-[10px] font-medium text-muted-foreground px-2 py-1">Название</th>
                <th className="text-right text-[10px] font-medium text-muted-foreground px-2 py-1 w-16">Цена</th>
                <th className="w-7" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-border/50 h-7 animate-fade-in">
                  <td className="px-2 py-0.5">
                    <span className="text-[11px] font-medium truncate block">{item.name}</span>
                  </td>
                  <td className="px-2 py-0.5 text-right">
                    {item.price ? (
                      <span className="text-[11px] text-muted-foreground">
                        {item.price.toLocaleString("ru-RU")} ₽
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-1 py-0.5">
                    <button
                      onClick={() => onRemove(item.id)}
                      className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
