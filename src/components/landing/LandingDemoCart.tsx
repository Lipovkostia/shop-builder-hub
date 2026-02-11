import { useMemo } from "react";
import { Trash2, Package, Store, ShoppingCart } from "lucide-react";
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

const MAX_VISIBLE = 10;

export default function LandingDemoCart({ items, onRemove, onClear }: LandingDemoCartProps) {
  const visibleItems = useMemo(() => items.slice(0, MAX_VISIBLE), [items]);
  const hiddenCount = Math.max(0, items.length - MAX_VISIBLE);

  return (
    <div className="rounded-xl border bg-card overflow-hidden flex flex-col h-full shadow-sm">
      {/* Storefront-style header */}
      <div className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border-b">
        {/* Top bar mimicking store contacts */}
        <div className="px-3 py-1 bg-muted/40 border-b border-border/30 flex items-center justify-center">
          <span className="text-[9px] text-muted-foreground tracking-wide">
            Демо-витрина · Посмотрите, как видят покупатели
          </span>
        </div>

        {/* Store name + logo area */}
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Store className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight text-foreground leading-none">
                Моя витрина
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {items.length > 0 ? `${items.length} товар${items.length === 1 ? '' : items.length < 5 ? 'а' : 'ов'}` : 'Пока пусто'}
              </p>
            </div>
          </div>

          {items.length > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="relative">
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                <Badge className="absolute -top-1.5 -right-2 text-[7px] px-1 py-0 h-3.5 min-w-[14px] bg-primary text-primary-foreground">
                  {items.length}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-[9px] text-muted-foreground hover:text-destructive"
                onClick={onClear}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3 p-6">
            <div className="w-16 h-16 rounded-2xl bg-muted/30 border border-dashed border-border flex items-center justify-center">
              <Package className="h-8 w-8 opacity-15" />
            </div>
            <div className="text-center">
              <p className="text-xs font-medium text-foreground/60">
                Выберите товары из списка слева
              </p>
              <p className="text-xs text-foreground/60">
                и нажмите «Добавить»
              </p>
            </div>
            <p className="text-[10px] text-muted-foreground/50 text-center max-w-[200px]">
              Здесь появится ваша витрина — точно такая, как видят покупатели
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {visibleItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 px-3 py-2 hover:bg-muted/20 transition-colors animate-fade-in group"
              >
                {/* Thumbnail */}
                <div className="w-11 h-11 rounded-lg bg-muted/30 border border-border/40 overflow-hidden shrink-0 relative">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-4 w-4 text-muted-foreground/20" />
                    </div>
                  )}
                  {(item.images_count ?? 0) > 1 && (
                    <Badge className="absolute bottom-0 left-0 text-[7px] px-0.5 py-0 h-3 bg-foreground/60 text-background rounded-none rounded-tr-sm">
                      {item.images_count}
                    </Badge>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium leading-tight truncate text-foreground">{item.name}</p>
                  {item.price ? (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {item.price.toLocaleString("ru-RU")} ₽{item.unit ? ` / ${item.unit}` : ""}
                    </p>
                  ) : null}
                </div>

                {/* Remove */}
                <button
                  onClick={() => onRemove(item.id)}
                  className="shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}

            {/* Hidden items indicator */}
            {hiddenCount > 0 && (
              <div className="px-3 py-2 bg-muted/20 text-center">
                <span className="text-[10px] text-muted-foreground">
                  и ещё {hiddenCount} товар{hiddenCount === 1 ? '' : hiddenCount < 5 ? 'а' : 'ов'}...
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer CTA */}
      {items.length > 0 && (
        <div className="px-3 py-2 border-t bg-muted/20 shrink-0">
          <Button
            className="w-full h-8 text-xs font-medium"
            variant="default"
            disabled
          >
            Зарегистрироваться и получить каталог
          </Button>
        </div>
      )}
    </div>
  );
}
