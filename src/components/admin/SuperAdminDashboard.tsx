import { useState, useEffect } from 'react';
import { 
  Users, 
  Store, 
  FileText, 
  Package, 
  TrendingUp, 
  ShoppingCart,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface StatsData {
  sellers: { total: number; today: number };
  customers: { total: number; today: number };
  stores: { total: number; today: number };
  catalogs: { total: number; today: number };
  products: { total: number; totalSum: number; today: number };
  orders: { total: number; today: number };
}

interface StatCardProps {
  title: string;
  value: number | string;
  todayChange?: number;
  subtitle?: string;
  icon: React.ReactNode;
  color?: 'default' | 'primary' | 'success' | 'warning';
  fullWidth?: boolean;
  onClick?: () => void;
}

interface SuperAdminDashboardProps {
  onNavigate?: (tab: string) => void;
}

function StatCard({ title, value, todayChange, subtitle, icon, color = 'default', fullWidth = false, onClick }: StatCardProps) {
  const colorClasses = {
    default: 'bg-card border-border',
    primary: 'bg-primary/5 border-primary/20',
    success: 'bg-green-500/5 border-green-500/20',
    warning: 'bg-orange-500/5 border-orange-500/20',
  };

  const iconColorClasses = {
    default: 'text-muted-foreground',
    primary: 'text-primary',
    success: 'text-green-500',
    warning: 'text-orange-500',
  };

  return (
    <Card 
      className={`${colorClasses[color]} ${fullWidth ? 'col-span-2' : ''} transition-all hover:shadow-md ${onClick ? 'cursor-pointer hover:scale-[1.02]' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {title}
            </p>
            <p className="text-3xl sm:text-4xl font-bold tracking-tight">
              {typeof value === 'number' ? value.toLocaleString('ru-RU') : value}
            </p>
            {subtitle && (
              <p className="text-sm text-muted-foreground">
                {subtitle}
              </p>
            )}
            {todayChange !== undefined && (
              <p className={`text-xs font-medium ${todayChange > 0 ? 'text-green-500' : 'text-muted-foreground'}`}>
                {todayChange > 0 ? '+' : ''}{todayChange} за сегодня
              </p>
            )}
          </div>
          <div className={`p-2 rounded-lg bg-background ${iconColorClasses[color]}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)} млн ₽`;
  }
  if (value >= 1000) {
    return `${Math.round(value / 1000)} тыс ₽`;
  }
  return `${value.toLocaleString('ru-RU')} ₽`;
}

export default function SuperAdminDashboard({ onNavigate }: SuperAdminDashboardProps) {
  const { session } = useAuth();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  const fetchStats = async (showRefresh = false) => {
    if (!session?.access_token) return;
    
    if (showRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/super-admin-stats`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch stats');
      }

      const data = await response.json();
      setStats(data);
    } catch (error: any) {
      console.error('Error fetching stats:', error);
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось загрузить статистику',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (session?.access_token) {
      fetchStats();
    }
  }, [session?.access_token]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">Статистика платформы</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className={`h-[120px] ${i >= 4 ? 'col-span-2 lg:col-span-2' : ''}`} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Статистика платформы</h2>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => fetchStats(true)}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Обновить
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Row 1: Sellers & Customers */}
        <StatCard
          title="Продавцы"
          value={stats?.sellers.total ?? 0}
          todayChange={stats?.sellers.today ?? 0}
          icon={<Users className="h-5 w-5" />}
          color="primary"
          onClick={() => onNavigate?.('stores')}
        />
        <StatCard
          title="Покупатели"
          value={stats?.customers.total ?? 0}
          todayChange={stats?.customers.today ?? 0}
          icon={<Users className="h-5 w-5" />}
          color="success"
          onClick={() => onNavigate?.('customers')}
        />

        {/* Row 2: Stores & Catalogs */}
        <StatCard
          title="Магазины"
          value={stats?.stores.total ?? 0}
          todayChange={stats?.stores.today ?? 0}
          icon={<Store className="h-5 w-5" />}
          onClick={() => onNavigate?.('stores')}
        />
        <StatCard
          title="Прайс-листы"
          value={stats?.catalogs.total ?? 0}
          todayChange={stats?.catalogs.today ?? 0}
          icon={<FileText className="h-5 w-5" />}
        />

        {/* Row 3: Products (full width on mobile, half on desktop) */}
        <StatCard
          title="Товаров"
          value={stats?.products.total ?? 0}
          todayChange={stats?.products.today ?? 0}
          subtitle={`Сумма: ${formatCurrency(stats?.products.totalSum ?? 0)}`}
          icon={<Package className="h-5 w-5" />}
          color="warning"
          fullWidth
          onClick={() => onNavigate?.('products')}
        />

        {/* Row 4: Orders */}
        <StatCard
          title="Заказов"
          value={stats?.orders.total ?? 0}
          todayChange={stats?.orders.today ?? 0}
          icon={<ShoppingCart className="h-5 w-5" />}
          fullWidth
        />
      </div>

      {/* Summary card */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary text-primary-foreground">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium">Активность за сегодня</p>
              <p className="text-xs text-muted-foreground">
                Новых продавцов: <span className="font-medium text-foreground">{stats?.sellers.today ?? 0}</span> • 
                Покупателей: <span className="font-medium text-foreground">{stats?.customers.today ?? 0}</span> • 
                Товаров: <span className="font-medium text-foreground">{stats?.products.today ?? 0}</span> • 
                Заказов: <span className="font-medium text-foreground">{stats?.orders.today ?? 0}</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
