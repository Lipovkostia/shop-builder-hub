import { useMemo, useEffect } from "react";
import { Trash2, Package, ShoppingCart, LayoutGrid, LogIn, Search, SlidersHorizontal, Phone, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TelegramIcon } from "@/components/icons/TelegramIcon";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";

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
  onRequestDefaults?: () => void;
}

const MAX_VISIBLE = 10;

export default function LandingDemoCart({ items, onRemove, onClear }: LandingDemoCartProps) {
  const visibleItems = useMemo(() => items.slice(0, MAX_VISIBLE), [items]);
  const hiddenCount = Math.max(0, items.length - MAX_VISIBLE);

  const total = useMemo(() => items.reduce((s, i) => s + (i.price || 0), 0), [items]);

  return (
    <div className="rounded-xl border bg-card overflow-hidden flex flex-col h-full shadow-sm">
      {/* Mock storefront header — mimics real catalog UI */}
      <div className="border-b bg-background">
        {/* Top navigation bar */}
        <div className="px-3 py-2 flex items-center justify-between border-b border-border/40">
          {/* Cart button */}
          <div className="flex items-center gap-1 border rounded-full px-2.5 py-1 text-xs font-medium text-foreground bg-background">
            <ShoppingCart className="h-3.5 w-3.5" />
            <span>{total > 0 ? `${total.toLocaleString("ru-RU")} ₽` : "0 ₽"}</span>
          </div>

          {/* Center icons */}
          <div className="flex items-center gap-3">
            <LayoutGrid className="h-4.5 w-4.5 text-muted-foreground" />
            <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
              <span className="text-primary text-[10px] font-bold">AI</span>
            </div>
          </div>

          {/* Login */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <LogIn className="h-3.5 w-3.5" />
            <span className="text-[11px]">Войти</span>
          </div>
        </div>

        {/* Contact bar */}
        <div className="px-3 py-1.5 flex items-center justify-center gap-3 border-b border-border/30">
          <WhatsAppIcon className="h-4 w-4 text-muted-foreground" />
          <TelegramIcon className="h-4 w-4 text-muted-foreground" />
          <div className="w-px h-3.5 bg-border" />
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Phone className="h-3 w-3" />
            <span>+7 (900) 000-00-00</span>
          </div>
        </div>

        {/* Filters bar */}
        <div className="px-3 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg border border-primary/30 bg-primary/5 flex items-center justify-center">
              <Image className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="w-7 h-7 rounded-full border border-border/50 flex items-center justify-center">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </div>
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
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
          <div className="overflow-y-auto h-full">
            {/* Category label mock */}
            {visibleItems.length > 0 && visibleItems[0].category && (
              <div className="px-3 py-1.5 bg-muted/20 border-b border-border/30">
                <span className="text-[11px] font-medium text-muted-foreground">{visibleItems[0].category}</span>
              </div>
            )}

            <div className="divide-y divide-border/40">
              {visibleItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2.5 px-3 py-2 hover:bg-muted/20 transition-colors animate-fade-in group"
                >
                  {/* Thumbnail */}
                  <div className="w-14 h-14 rounded-lg bg-muted/30 border border-border/40 overflow-hidden shrink-0 relative">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-5 w-5 text-muted-foreground/20" />
                      </div>
                    )}
                    {(item.images_count ?? 0) > 1 && (
                      <Badge className="absolute bottom-0 left-0 text-[7px] px-0.5 py-0 h-3.5 min-w-[14px] bg-foreground/60 text-background rounded-none rounded-tr-sm">
                        {item.images_count}
                      </Badge>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold leading-tight line-clamp-2 text-foreground">{item.name}</p>
                    {item.price ? (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {item.price.toLocaleString("ru-RU")} ₽{item.unit ? ` / ${item.unit}` : ""}
                      </p>
                    ) : null}
                  </div>

                  {/* Price button */}
                  {item.price ? (
                    <div className="shrink-0 flex items-center gap-1 border rounded-md px-2 py-1 text-[11px] font-medium text-foreground bg-background hover:bg-muted/30 transition-colors cursor-default">
                      <span className="text-primary text-xs">+</span>
                      <span>{item.price.toLocaleString("ru-RU")}</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => onRemove(item.id)}
                      className="shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
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
          </div>
        )}
      </div>

      {/* Footer CTA */}
      {items.length > 0 && (
        <div className="px-3 py-2 border-t bg-muted/20 shrink-0 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[9px] text-muted-foreground hover:text-destructive"
            onClick={onClear}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Очистить
          </Button>
          <Button
            className="h-8 text-xs font-medium px-4"
            variant="default"
            disabled
          >
            Зарегистрироваться
          </Button>
        </div>
      )}
    </div>
  );
}
