import React from 'react';
import { ShoppingCart, User, Clock, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
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
      label: 'Активен',
      badgeVariant: 'default' as const,
    },
    idle: {
      color: 'bg-yellow-500',
      label: 'Неактивен',
      badgeVariant: 'secondary' as const,
    },
    abandoned: {
      color: 'bg-red-500',
      label: 'Забросил',
      badgeVariant: 'destructive' as const,
    },
  };

  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${config.color} animate-pulse`} />
      <Badge variant={config.badgeVariant} className="text-xs">
        {timeAgo}
      </Badge>
    </div>
  );
};

const FormingOrderCard: React.FC<{
  order: FormingOrder;
  getActivityStatus: (date: string) => 'active' | 'idle' | 'abandoned';
  formatTimeAgo: (date: string) => string;
}> = ({ order, getActivityStatus, formatTimeAgo }) => {
  const status = getActivityStatus(order.lastActivityAt);
  const timeAgo = formatTimeAgo(order.lastActivityAt);

  return (
    <Card className="border-l-4 border-l-primary/50 bg-muted/30">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{order.customerName}</span>
            {order.customerPhone && (
              <span className="text-sm text-muted-foreground">{order.customerPhone}</span>
            )}
          </div>
          <ActivityBadge status={status} timeAgo={timeAgo} />
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
          <div className="flex items-center gap-1">
            <Package className="h-3.5 w-3.5" />
            <span>{order.items.length} поз.</span>
          </div>
          <div className="font-medium text-foreground">
            {formatPrice(order.total)}
          </div>
        </div>

        {order.items.length > 0 && (
          <div className="space-y-1 pl-4 border-l-2 border-muted">
            {order.items.slice(0, 3).map((item) => (
              <div key={item.id} className="text-sm flex justify-between">
                <span className="text-muted-foreground truncate max-w-[200px]">
                  {item.productName}
                </span>
                <span className="text-foreground ml-2">
                  × {item.quantity}
                </span>
              </div>
            ))}
            {order.items.length > 3 && (
              <div className="text-sm text-muted-foreground italic">
                и ещё {order.items.length - 3} поз...
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export const FormingOrdersSection: React.FC<FormingOrdersSectionProps> = ({ storeId }) => {
  const { formingOrders, isLoading, getActivityStatus, formatTimeAgo } = useFormingOrders(storeId);

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
              />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
