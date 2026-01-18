import React, { useState, useMemo } from 'react';
import { format, isToday, isYesterday, startOfDay, subDays, subMonths } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Search, Filter, Calendar, Loader2, ChevronDown, Package, FolderOpen, ShoppingCart, Users, Settings, Tag, Shield, Plus, Pencil, Trash2, Download, Upload, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useActivityLogs,
  ActivityLog,
  ActionType,
  EntityType,
  getActionLabel,
  getEntityLabel,
  getActionColor,
} from '@/hooks/useActivityLogs';

interface ActivityHistorySectionProps {
  storeId: string | null;
}

const actionTypeOptions: { value: ActionType; label: string }[] = [
  { value: 'create', label: 'Создание' },
  { value: 'update', label: 'Обновление' },
  { value: 'delete', label: 'Удаление' },
  { value: 'import', label: 'Импорт' },
  { value: 'export', label: 'Экспорт' },
  { value: 'sync', label: 'Синхронизация' },
  { value: 'status_change', label: 'Изменение статуса' },
  { value: 'access_grant', label: 'Доступ предоставлен' },
  { value: 'access_revoke', label: 'Доступ отозван' },
];

const entityTypeOptions: { value: EntityType; label: string }[] = [
  { value: 'product', label: 'Товары' },
  { value: 'catalog', label: 'Прайс-листы' },
  { value: 'order', label: 'Заказы' },
  { value: 'customer', label: 'Клиенты' },
  { value: 'category', label: 'Категории' },
  { value: 'role', label: 'Роли' },
  { value: 'settings', label: 'Настройки' },
];

const periodOptions = [
  { value: 'all', label: 'За всё время' },
  { value: 'today', label: 'Сегодня' },
  { value: 'week', label: 'За неделю' },
  { value: 'month', label: 'За месяц' },
  { value: '3months', label: 'За 3 месяца' },
];

function getActionIcon(actionType: ActionType): React.ReactNode {
  const iconClass = "h-4 w-4";
  switch (actionType) {
    case 'create':
      return <Plus className={iconClass} />;
    case 'update':
      return <Pencil className={iconClass} />;
    case 'delete':
      return <Trash2 className={iconClass} />;
    case 'import':
      return <Download className={iconClass} />;
    case 'export':
      return <Upload className={iconClass} />;
    case 'sync':
      return <RefreshCw className={iconClass} />;
    case 'status_change':
      return <ShoppingCart className={iconClass} />;
    case 'access_grant':
      return <CheckCircle className={iconClass} />;
    case 'access_revoke':
      return <XCircle className={iconClass} />;
    default:
      return <Settings className={iconClass} />;
  }
}

function getEntityIcon(entityType: EntityType): React.ReactNode {
  const iconClass = "h-3.5 w-3.5 text-muted-foreground";
  switch (entityType) {
    case 'product':
      return <Package className={iconClass} />;
    case 'catalog':
      return <FolderOpen className={iconClass} />;
    case 'order':
      return <ShoppingCart className={iconClass} />;
    case 'customer':
      return <Users className={iconClass} />;
    case 'category':
      return <Tag className={iconClass} />;
    case 'role':
      return <Shield className={iconClass} />;
    case 'settings':
      return <Settings className={iconClass} />;
    default:
      return <Settings className={iconClass} />;
  }
}

function formatLogDetails(log: ActivityLog): string | null {
  if (!log.details) return null;
  
  const details = log.details;
  
  // Price changes
  if (details.field === 'price' && details.old_value !== undefined && details.new_value !== undefined) {
    return `Цена: ${details.old_value}₽ → ${details.new_value}₽`;
  }
  
  // Status changes
  if (details.old_status && details.new_status) {
    const statusLabels: Record<string, string> = {
      pending: 'Новый',
      processing: 'В обработке',
      shipped: 'Отправлен',
      delivered: 'Доставлен',
      cancelled: 'Отменён',
    };
    return `${statusLabels[details.old_status] || details.old_status} → ${statusLabels[details.new_status] || details.new_status}`;
  }
  
  // Import results
  if (details.source && (details.created !== undefined || details.updated !== undefined)) {
    const parts = [];
    if (details.created) parts.push(`+${details.created} новых`);
    if (details.updated) parts.push(`обновлено ${details.updated}`);
    if (details.hidden) parts.push(`скрыто ${details.hidden}`);
    return parts.join(', ');
  }
  
  // Generic field change
  if (details.field && details.old_value !== undefined && details.new_value !== undefined) {
    return `${details.field}: ${details.old_value} → ${details.new_value}`;
  }
  
  // Catalog access
  if (details.catalog_name) {
    return `Каталог: ${details.catalog_name}`;
  }

  return null;
}

function formatDateGroup(date: Date): string {
  if (isToday(date)) return 'Сегодня';
  if (isYesterday(date)) return 'Вчера';
  return format(date, 'd MMMM yyyy', { locale: ru });
}

export function ActivityHistorySection({ storeId }: ActivityHistorySectionProps) {
  const [search, setSearch] = useState('');
  const [selectedActionType, setSelectedActionType] = useState<string>('all');
  const [selectedEntityType, setSelectedEntityType] = useState<string>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');

  // Calculate date range based on selected period
  const dateRange = useMemo(() => {
    const now = new Date();
    switch (selectedPeriod) {
      case 'today':
        return { startDate: startOfDay(now), endDate: undefined };
      case 'week':
        return { startDate: subDays(now, 7), endDate: undefined };
      case 'month':
        return { startDate: subMonths(now, 1), endDate: undefined };
      case '3months':
        return { startDate: subMonths(now, 3), endDate: undefined };
      default:
        return { startDate: undefined, endDate: undefined };
    }
  }, [selectedPeriod]);

  const { logs, loading, hasMore, loadMore } = useActivityLogs(storeId, {
    actionTypes: selectedActionType !== 'all' ? [selectedActionType as ActionType] : undefined,
    entityTypes: selectedEntityType !== 'all' ? [selectedEntityType as EntityType] : undefined,
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    limit: 30,
  });

  // Filter logs by search term
  const filteredLogs = useMemo(() => {
    if (!search.trim()) return logs;
    const searchLower = search.toLowerCase();
    return logs.filter(log => 
      log.entity_name?.toLowerCase().includes(searchLower) ||
      getActionLabel(log.action_type).toLowerCase().includes(searchLower) ||
      getEntityLabel(log.entity_type).toLowerCase().includes(searchLower)
    );
  }, [logs, search]);

  // Group logs by date
  const groupedLogs = useMemo(() => {
    const groups: { date: string; logs: ActivityLog[] }[] = [];
    let currentDate = '';
    
    filteredLogs.forEach(log => {
      const logDate = formatDateGroup(new Date(log.created_at));
      if (logDate !== currentDate) {
        currentDate = logDate;
        groups.push({ date: logDate, logs: [log] });
      } else {
        groups[groups.length - 1].logs.push(log);
      }
    });
    
    return groups;
  }, [filteredLogs]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold">История действий</h2>
        <p className="text-sm text-muted-foreground">Все изменения в вашем магазине</p>
      </div>

      {/* Filters */}
      <Card className="p-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Action type filter */}
          <Select value={selectedActionType} onValueChange={setSelectedActionType}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Действие" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все действия</SelectItem>
              {actionTypeOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Entity type filter */}
          <Select value={selectedEntityType} onValueChange={setSelectedEntityType}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <Package className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Объект" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все объекты</SelectItem>
              {entityTypeOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Period filter */}
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Период" />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Logs list */}
      <div className="space-y-4">
        {loading && logs.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">
              {search ? 'Ничего не найдено' : 'История пуста'}
            </p>
          </Card>
        ) : (
          <>
            {groupedLogs.map((group) => (
              <div key={group.date} className="space-y-2">
                {/* Date header */}
                <div className="flex items-center gap-2 px-1">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">{group.date}</span>
                </div>

                {/* Logs for this date */}
                <Card className="divide-y divide-border overflow-hidden">
                  {group.logs.map((log) => (
                    <div key={log.id} className="p-3 hover:bg-muted/50 transition-colors">
                      <div className="flex items-start gap-3">
                        {/* Action icon */}
                        <div className={`flex-shrink-0 p-2 rounded-lg ${getActionColor(log.action_type)}`}>
                          {getActionIcon(log.action_type)}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Time */}
                            <span className="text-xs text-muted-foreground font-mono">
                              {format(new Date(log.created_at), 'HH:mm')}
                            </span>

                            {/* Action badge */}
                            <Badge variant="secondary" className="text-xs">
                              {getActionLabel(log.action_type)}
                            </Badge>

                            {/* Entity type */}
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              {getEntityIcon(log.entity_type)}
                              <span>{getEntityLabel(log.entity_type)}</span>
                            </div>
                          </div>

                          {/* Entity name */}
                          {log.entity_name && (
                            <p className="mt-1 font-medium truncate">
                              {log.entity_name}
                            </p>
                          )}

                          {/* Details */}
                          {log.details && (
                            <p className="mt-0.5 text-sm text-muted-foreground">
                              {formatLogDetails(log)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </Card>
              </div>
            ))}

            {/* Load more button */}
            {hasMore && (
              <div className="flex justify-center pt-2">
                <Button
                  variant="outline"
                  onClick={loadMore}
                  disabled={loading}
                  className="w-full sm:w-auto"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <ChevronDown className="h-4 w-4 mr-2" />
                  )}
                  Загрузить ещё
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
