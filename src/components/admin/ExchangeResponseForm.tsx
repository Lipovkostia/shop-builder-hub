import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";
import type { ExchangeRequestItem } from "@/hooks/useExchange";

interface ExchangeResponseFormProps {
  items: ExchangeRequestItem[];
  onSubmit: (prices: { request_item_id: string; price: number }[]) => void;
}

export function ExchangeResponseForm({ items, onSubmit }: ExchangeResponseFormProps) {
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const priceEntries = items
      .map((item) => ({
        request_item_id: item.id,
        price: parseFloat(prices[item.id] || "0"),
      }))
      .filter((p) => p.price > 0);

    if (priceEntries.length === 0) return;

    setSubmitting(true);
    await onSubmit(priceEntries);
    setSubmitting(false);
    setPrices({});
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Ваше предложение
      </p>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-2">
            <span className="text-sm text-foreground flex-1 truncate">
              {item.product_name || item.custom_name || "Без названия"}
            </span>
            <Input
              type="number"
              placeholder="Цена, ₽"
              className="w-28 h-8 text-sm"
              value={prices[item.id] || ""}
              onChange={(e) =>
                setPrices((prev) => ({ ...prev, [item.id]: e.target.value }))
              }
            />
          </div>
        ))}
      </div>
      <Button
        size="sm"
        onClick={handleSubmit}
        disabled={submitting || Object.values(prices).every((v) => !v || parseFloat(v) <= 0)}
      >
        <Send className="h-3.5 w-3.5 mr-1" />
        Отправить предложение
      </Button>
    </div>
  );
}
