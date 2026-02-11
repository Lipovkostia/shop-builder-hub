import { useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { ChevronDown, ChevronUp, Package, MessageSquare, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ExchangeRequest, ExchangeResponse } from "@/hooks/useExchange";
import { ExchangeResponseForm } from "@/components/admin/ExchangeResponseForm";

interface ExchangeRequestCardProps {
  request: ExchangeRequest;
  isOwn: boolean;
  onClose?: () => void;
  onFetchResponses?: () => Promise<ExchangeResponse[]>;
  onSubmitResponse?: (prices: { request_item_id: string; price: number }[]) => void;
}

export function ExchangeRequestCard({
  request,
  isOwn,
  onClose,
  onFetchResponses,
  onSubmitResponse,
}: ExchangeRequestCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [responses, setResponses] = useState<ExchangeResponse[]>([]);
  const [loadingResponses, setLoadingResponses] = useState(false);

  const handleExpand = async () => {
    const next = !expanded;
    setExpanded(next);

    if (next && isOwn && onFetchResponses && responses.length === 0) {
      setLoadingResponses(true);
      const data = await onFetchResponses();
      setResponses(data);
      setLoadingResponses(false);
    }
  };

  const isActive = request.status === "active";

  return (
    <div
      className={cn(
        "bg-card rounded-lg border border-border overflow-hidden transition-shadow hover:shadow-sm",
        "border-l-4",
        isActive ? "border-l-green-500" : "border-l-muted-foreground/30"
      )}
    >
      {/* Header row */}
      <button
        onClick={handleExpand}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {format(new Date(request.created_at), "dd MMM yyyy", { locale: ru })}
          </span>
          <div className="flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm font-medium">{request.items_count || 0} поз.</span>
          </div>
          <Badge variant={isActive ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
            {isActive ? "Активна" : "Закрыта"}
          </Badge>
          {isOwn && (request.responses_count || 0) > 0 && (
            <div className="flex items-center gap-1 text-primary">
              <MessageSquare className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">{request.responses_count}</span>
            </div>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border px-4 py-3 space-y-3">
          {/* Items list */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Позиции заявки
            </p>
            <div className="divide-y divide-border">
              {(request.items || []).map((item) => (
                <div key={item.id} className="flex items-center justify-between py-1.5 text-sm">
                  <span className="text-foreground">
                    {item.product_name || item.custom_name || "Без названия"}
                  </span>
                  <span className="text-xs text-muted-foreground">{item.unit}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Own request: show responses */}
          {isOwn && (
            <div className="space-y-2">
              {loadingResponses ? (
                <p className="text-xs text-muted-foreground">Загрузка откликов...</p>
              ) : responses.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Предложения поставщиков
                  </p>
                  {responses.map((resp) => (
                    <div key={resp.id} className="bg-muted/50 rounded-md p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{resp.store_name || "Поставщик"}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(resp.created_at), "dd.MM.yyyy HH:mm")}
                        </span>
                      </div>
                      <div className="divide-y divide-border/50">
                        {(resp.items || []).map((ri) => {
                          const matchedItem = (request.items || []).find(
                            (i) => i.id === ri.request_item_id
                          );
                          return (
                            <div key={ri.id} className="flex justify-between py-1 text-sm">
                              <span className="text-muted-foreground">
                                {matchedItem?.product_name || matchedItem?.custom_name || "—"}
                              </span>
                              <span className="font-medium text-foreground">
                                {Number(ri.price).toLocaleString("ru-RU")} ₽
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Пока нет откликов</p>
              )}

              {isActive && onClose && (
                <Button variant="outline" size="sm" onClick={onClose} className="mt-2">
                  <X className="h-3.5 w-3.5 mr-1" />
                  Закрыть заявку
                </Button>
              )}
            </div>
          )}

          {/* Other's request: show response form */}
          {!isOwn && onSubmitResponse && (
            <ExchangeResponseForm
              items={request.items || []}
              onSubmit={onSubmitResponse}
            />
          )}
        </div>
      )}
    </div>
  );
}
