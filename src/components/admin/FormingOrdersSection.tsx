import React, { useState } from 'react';
import { ShoppingCart, Clock, ChevronsUpDown } from 'lucide-react';
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
      <CollapsibleTrigger asChild>
        <div className="py-2 cursor-pointer hover:bg-muted/50 transition-colors">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <div className="flex items-center gap-1.5">
              <ActivityBadge status={status} timeAgo={timeAgo} />
            </div>
            <span className="font-bold text-sm tabular-nums whitespace-nowrap">
              {order.total.toLocaleString()} ₽
            </span>
          </div>
          
          <div className="flex items-center gap-1.5 text-sm">
            <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <span className="font-medium text-foreground truncate">
              {order.customerName}
            </span>
            {order.items && order.items.length > 0 && !isExpanded && (
              <span className="text-muted-foreground text-xs whitespace-nowrap">
                · {order.items.length} поз.
              </span>
            )}
          </div>
          
          <div className="flex items-center justify-between gap-2 mt-0.5 text-[11px] text-muted-foreground">
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
              <span className="truncate max-w-[140px]">
                {order.customerPhone}
              </span>
            )}
          </div>
        </div>
      </CollapsibleTrigger>
      
      <CollapsibleContent>
        <div className="pb-2">
          {order.items && order.items.length > 0 ? (
            <div className="border-t border-border/40 pt-1.5">
              <ScrollArea className="max-h-[200px]">
                <div className="space-y-0.5 pr-2">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-baseline justify-between gap-1.5 text-xs py-0.5">
                      <span className="text-foreground truncate min-w-0 flex-1 leading-tight">
                        {item.productName}
                      </span>
                      <span className="text-muted-foreground whitespace-nowrap flex-shrink-0 tabular-nums">
                        {item.quantity}×{item.price.toLocaleString()}
                      </span>
                      <span className="font-semibold text-primary tabular-nums whitespace-nowrap flex-shrink-0">
                        {(item.quantity * item.price).toLocaleString()} ₽
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              
              <div className="flex items-center justify-between pt-1.5 mt-1.5 border-t border-dashed border-border/40">
                <span className="text-[11px] text-muted-foreground">
                  Итого · {order.items.length} поз.
                </span>
                <span className="font-bold text-sm tabular-nums">
                  {order.total.toLocaleString()} ₽
                </span>
              </div>
            </div>
          ) : (
            <div className="border-t border-border/40 pt-1.5 text-xs text-muted-foreground italic">
              Корзина пуста
            </div>
          )}
        </div>
      </CollapsibleContent>
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
      <div>
        <div className="flex items-center gap-2 mb-2">
          <ShoppingCart className="h-4 w-4" />
          <span className="font-semibold text-sm">Сейчас формируют</span>
        </div>
        <div className="text-sm text-muted-foreground">Загрузка...</div>
      </div>
    );
  }

  if (formingOrders.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <ShoppingCart className="h-4 w-4 text-primary" />
        <span className="font-semibold text-sm">Сейчас формируют</span>
        <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
          {formingOrders.length}
        </Badge>
      </div>
      <div className="divide-y divide-border/30">
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
    </div>
  );
};
