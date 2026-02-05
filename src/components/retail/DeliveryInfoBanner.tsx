import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";

interface DeliveryInfoBannerProps {
  isExpanded: boolean;
  onToggle: () => void;
  nextDeliveryTime: string | null;
  deliveryInfo: string | null;
  deliveryFreeFrom: number | null;
  deliveryRegion: string | null;
}

export function DeliveryInfoBanner({
  isExpanded,
  onToggle,
  nextDeliveryTime,
  deliveryInfo,
  deliveryFreeFrom,
  deliveryRegion,
}: DeliveryInfoBannerProps) {
  // Don't render if no delivery time is set
  if (!nextDeliveryTime) {
    return null;
  }

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      {/* Mobile delivery trigger */}
      <button
        onClick={onToggle}
        className="md:hidden w-full flex items-center justify-center gap-2 px-4 py-1 bg-muted/30 border-b text-xs"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[hsl(var(--delivery))] opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[hsl(var(--delivery))]"></span>
        </span>
        <span className="font-medium">Доставка в {nextDeliveryTime}</span>
        <ChevronDown 
          className={cn(
            "h-4 w-4 transition-transform",
            isExpanded && "rotate-180"
          )} 
        />
      </button>

      {/* Expanded content */}
      <CollapsibleContent>
        <div className="bg-muted/20 border-b px-4 lg:px-6 py-4 animate-fade-in">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[hsl(var(--delivery))] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[hsl(var(--delivery))]"></span>
              </span>
            </div>
              <div className="space-y-2">
                <p className="font-medium text-sm">
                  Ближайшая доставка сегодня в {nextDeliveryTime}
                </p>
                {deliveryInfo && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {deliveryInfo}
                  </p>
                )}
                {(deliveryFreeFrom || deliveryRegion) && (
                  <div className="flex flex-wrap gap-3 pt-2">
                    {deliveryFreeFrom && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--delivery))]" />
                        Бесплатная доставка от {deliveryFreeFrom.toLocaleString('ru-RU')} ₽
                      </div>
                    )}
                    {deliveryRegion && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--delivery))]" />
                        Доставка по {deliveryRegion}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
