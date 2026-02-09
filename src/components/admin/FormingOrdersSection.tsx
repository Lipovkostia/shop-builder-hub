import React, { useState } from 'react';
import { ShoppingCart, Clock, ChevronsUpDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useFormingOrders, FormingOrder } from '@/hooks/useFormingOrders';

interface FormingOrdersSectionProps {
  storeId: string;
}

const formatPrice = (price: number) => {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
};

const ActivityBadge: React.FC<{ status: 'active' | 'idle' | 'abandoned'; timeAgo: string }> = ({
  status,
  timeAgo,
}) => {
  const statusConfig = {
    active: {
      color: 'bg-green-500',
    },
    idle: {
      color: 'bg-yellow-500',
    },
    abandoned: {
      color: 'bg-red-500',
    },
  };

  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${config.color} animate-pulse`} />
      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 bg-primary/10 text-primary border-primary/20">
        {timeAgo}
      </Badge>
    </div>
  );
};

const FormingOrderCard: React.FC<{
  order: FormingOrder;
  getActivityStatus: (date: string) => 'active' | 'idle' | 'abandoned';
  formatTimeAgo: (date: string) => string;
  isExpanded: boolean;
  onToggle: () => void;
}> = ({ order, getActivityStatus, formatTimeAgo, isExpanded, onToggle }) => {
  const status = getActivityStatus(order.lastActivityAt);
  const timeAgo = formatTimeAgo(order.lastActivityAt);

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className="rounded-lg border border-primary/20 bg-primary/5 overflow-hidden">
        <CollapsibleTrigger asChild>
          <div className="p-3 cursor-pointer hover:bg-primary/10 transition-colors">
            {/* Top row: Badge + Activity + Price */}
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2">
                <Badge 
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 h-5 bg-primary/10 text-primary border-primary/30"
                >
                  Формируют
                </Badge>
                <ActivityBadge status={status} timeAgo={timeAgo} />
              </div>
              <span className="font-bold text-base tabular-nums whitespace-nowrap">
                {order.total.toLocaleString()} ₽
              </span>
            </div>
            
            {/* Middle row: customer name + items count */}
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <ChevronsUpDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="font-medium text-foreground truncate">
                {order.customerName}
              </span>
              {order.items && order.items.length > 0 && !isExpanded && (
                <span className="text-muted-foreground whitespace-nowrap">
                  • {order.items.length} поз.
                </span>
              )}
            </div>
            
            {/* Bottom row: time + phone */}
            <div className="flex items-center justify-between gap-2 mt-1 text-[11px] sm:text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3 flex-shrink-0" />
                <span>
                  {new Date(order.createdAt).toLocaleString('ru-RU', { 
                    day: 'numeric', 
                    month: 'short', 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </span>
              </div>
              {order.customerPhone && (
                <span className="truncate max-w-[120px] sm:max-w-[180px]">
                  {order.customerPhone}
                </span>
              )}
            </div>
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="px-3 pb-3">
            {order.items && order.items.length > 0 ? (
              <div className="border-t border-border pt-3 mb-3">
                <div className="space-y-2.5">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{item.productName}</div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span>{item.quantity} шт</span>
                          <span>·</span>
                          <span>{item.price.toLocaleString()} ₽/шт</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="font-semibold text-primary text-sm tabular-nums">
                          {(item.quantity * item.price).toLocaleString()} ₽
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="flex items-center justify-between pt-3 mt-3 border-t border-dashed border-border">
                  <span className="text-sm text-muted-foreground">
                    Итого ({order.items.length} {order.items.length === 1 ? 'товар' : order.items.length < 5 ? 'товара' : 'товаров'})
                  </span>
                  <span className="font-bold text-base tabular-nums">
                    {order.total.toLocaleString()} ₽
                  </span>
                </div>
              </div>
            ) : (
              <div className="border-t border-border pt-3 text-sm text-muted-foreground">
                Корзина пуста — покупатель ещё не добавил товары
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

export const FormingOrdersSection: React.FC<FormingOrdersSectionProps> = ({ storeId }) => {
  const { formingOrders, isLoading, getActivityStatus, formatTimeAgo } = useFormingOrders(storeId);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  const toggleOrder = (orderId: string) => {
    setExpandedOrders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  if (isLoading && formingOrders.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Сейчас формируют
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Загрузка...</div>
        </CardContent>
      </Card>
    );
  }

  if (formingOrders.length === 0) {
    return null;
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-primary" />
          <span>Сейчас формируют</span>
          <Badge variant="secondary" className="ml-auto">
            {formingOrders.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="max-h-[400px]">
          <div className="space-y-3">
            {formingOrders.map((order) => (
              <FormingOrderCard
                key={order.id}
                order={order}
                getActivityStatus={getActivityStatus}
                formatTimeAgo={formatTimeAgo}
                isExpanded={expandedOrders.has(order.id)}
                onToggle={() => toggleOrder(order.id)}
              />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
