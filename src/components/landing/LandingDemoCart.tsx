import { useMemo } from "react";
import { Trash2, ShoppingCart, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface DemoProduct {
  id: string;
  name: string;
  sku?: string;
  price?: number;
  unit?: string;
  image?: string;
  category?: string;
  images_count?: number;
}

interface LandingDemoCartProps {
  items: DemoProduct[];
  onRemove: (id: string) => void;
  onClear: () => void;
}

export default function LandingDemoCart({ items, onRemove, onClear }: LandingDemoCartProps) {
  // Group items by category
  const grouped = useMemo(() => {
    const map = new Map<string, DemoProduct[]>();
    items.forEach((item) => {
      const cat = item.category || "Без категории";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(item);
    });
    return map;
  }, [items]);

  return (
    <div className="rounded-lg border bg-card overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b bg-muted/30 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <ShoppingCart className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Моя витрина · {items.length}
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

      {/* Content */}
      <div className="overflow-y-auto flex-1 min-h-0">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2 p-4">
            <Package className="h-10 w-10 opacity-20" />
            <p className="text-xs text-center leading-relaxed">
              Выберите товары из списка слева<br />
              и нажмите «Добавить»
            </p>
            <p className="text-[10px] text-center text-muted-foreground/60">
              Здесь появится ваша витрина — точно такая, как видят покупатели
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {Array.from(grouped.entries()).map(([category, products]) => (
              <div key={category}>
                {/* Category header */}
                <div className="px-3 py-1.5 bg-muted/20 border-b border-border/30">
                  <span className="text-[11px] font-medium text-muted-foreground">{category}</span>
                </div>
                {/* Product cards — catalog style */}
                {products.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2.5 px-2 py-1.5 border-b border-border/30 hover:bg-muted/20 transition-colors animate-fade-in group"
                  >
                    {/* Thumbnail */}
                    <div className="w-14 h-14 rounded-md bg-muted/40 border border-border/50 overflow-hidden shrink-0 relative">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-5 w-5 text-muted-foreground/30" />
                        </div>
                      )}
                      {(item.images_count ?? 0) > 1 && (
                        <Badge className="absolute bottom-0.5 left-0.5 text-[8px] px-1 py-0 h-3.5 bg-foreground/70 text-background">
                          {item.images_count}
                        </Badge>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold leading-tight truncate">{item.name}</p>
                      {item.price ? (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {item.price.toLocaleString("ru-RU")} ₽{item.unit ? `/${item.unit}` : ""}
                        </p>
                      ) : null}
                    </div>

                    {/* Price button (decorative, like real catalog) */}
                    <div className="shrink-0 flex items-center">
                      {item.price ? (
                        <div className="border border-border rounded-md px-2 py-1 text-[11px] font-medium text-foreground/80 whitespace-nowrap">
                          + {item.price.toLocaleString("ru-RU")}
                        </div>
                      ) : null}
                      <button
                        onClick={() => onRemove(item.id)}
                        className="ml-1 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
