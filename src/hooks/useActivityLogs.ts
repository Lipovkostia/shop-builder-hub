import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type ActionType = 'create' | 'update' | 'delete' | 'trash' | 'restore' | 'permanent_delete' | 'import' | 'export' | 'sync' | 'status_change' | 'access_grant' | 'access_revoke';
export type EntityType = 'product' | 'catalog' | 'order' | 'customer' | 'settings' | 'category' | 'role';

export interface ActivityLog {
  id: string;
  store_id: string;
  user_id: string;
  action_type: ActionType;
  entity_type: EntityType;
  entity_id?: string;
  entity_name?: string;
  details?: Record<string, any>;
  created_at: string;
}

export interface LogActivityParams {
  storeId: string;
  actionType: ActionType;
  entityType: EntityType;
  entityId?: string;
  entityName?: string;
  details?: Record<string, any>;
}

// Standalone function to log activity (can be imported and used anywhere)
export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('store_activity_logs')
      .insert({
        store_id: params.storeId,
        user_id: user.id,
        action_type: params.actionType,
        entity_type: params.entityType,
        entity_id: params.entityId,
        entity_name: params.entityName,
        details: params.details,
      });

    if (error) {
      console.error('Error logging activity:', error);
    }
  } catch (err) {
    console.error('Error logging activity:', err);
  }
}

export interface UseActivityLogsOptions {
  limit?: number;
  actionTypes?: ActionType[];
  entityTypes?: EntityType[];
  startDate?: Date;
  endDate?: Date;
}

export function useActivityLogs(storeId: string | null, options: UseActivityLogsOptions = {}) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  const limit = options.limit || 20;

  const fetchLogs = useCallback(async (reset = false) => {
    if (!storeId) {
      setLogs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const currentOffset = reset ? 0 : offset;

    try {
      let query = supabase
        .from('store_activity_logs')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .range(currentOffset, currentOffset + limit - 1);

      // Apply filters
      if (options.actionTypes && options.actionTypes.length > 0) {
        query = query.in('action_type', options.actionTypes);
      }
      if (options.entityTypes && options.entityTypes.length > 0) {
        query = query.in('entity_type', options.entityTypes);
      }
      if (options.startDate) {
        query = query.gte('created_at', options.startDate.toISOString());
      }
      if (options.endDate) {
        query = query.lte('created_at', options.endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      const typedLogs = (data || []) as ActivityLog[];

      if (reset) {
        setLogs(typedLogs);
        setOffset(limit);
      } else {
        setLogs(prev => [...prev, ...typedLogs]);
        setOffset(prev => prev + limit);
      }

      setHasMore(typedLogs.length === limit);
    } catch (error) {
      console.error('Error fetching activity logs:', error);
    } finally {
      setLoading(false);
    }
  }, [storeId, offset, limit, options.actionTypes, options.entityTypes, options.startDate, options.endDate]);

  // Initial fetch and refetch when filters change
  useEffect(() => {
    setOffset(0);
    fetchLogs(true);
  }, [storeId, options.actionTypes?.join(','), options.entityTypes?.join(','), options.startDate?.toISOString(), options.endDate?.toISOString()]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      fetchLogs(false);
    }
  }, [loading, hasMore, fetchLogs]);

  const refetch = useCallback(() => {
    setOffset(0);
    fetchLogs(true);
  }, [fetchLogs]);

  return {
    logs,
    loading,
    hasMore,
    loadMore,
    refetch,
  };
}

// Helper functions for formatting log messages
export function getActionLabel(actionType: ActionType): string {
  const labels: Record<ActionType, string> = {
    create: 'Создание',
    update: 'Обновление',
    delete: 'Удаление',
    trash: 'В корзину',
    restore: 'Восстановление',
    permanent_delete: 'Удалено навсегда',
    import: 'Импорт',
    export: 'Экспорт',
    sync: 'Синхронизация',
    status_change: 'Изменение статуса',
    access_grant: 'Доступ предоставлен',
    access_revoke: 'Доступ отозван',
  };
  return labels[actionType] || actionType;
}

export function getEntityLabel(entityType: EntityType): string {
  const labels: Record<EntityType, string> = {
    product: 'Товар',
    catalog: 'Прайс-лист',
    order: 'Заказ',
    customer: 'Клиент',
    settings: 'Настройки',
    category: 'Категория',
    role: 'Роль',
  };
  return labels[entityType] || entityType;
}

export function getActionColor(actionType: ActionType): string {
  const colors: Record<ActionType, string> = {
    create: 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400',
    update: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400',
    delete: 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400',
    trash: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400',
    restore: 'text-teal-600 bg-teal-100 dark:bg-teal-900/30 dark:text-teal-400',
    permanent_delete: 'text-red-700 bg-red-200 dark:bg-red-900/50 dark:text-red-300',
    import: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400',
    export: 'text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400',
    sync: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400',
    status_change: 'text-indigo-600 bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400',
    access_grant: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400',
    access_revoke: 'text-rose-600 bg-rose-100 dark:bg-rose-900/30 dark:text-rose-400',
  };
  return colors[actionType] || 'text-gray-600 bg-gray-100';
}

export function getActionIcon(actionType: ActionType): string {
  const icons: Record<ActionType, string> = {
    create: '🟢',
    update: '✏️',
    delete: '🗑️',
    trash: '📥',
    restore: '♻️',
    permanent_delete: '💀',
    import: '📥',
    export: '📤',
    sync: '🔄',
    status_change: '📦',
    access_grant: '✅',
    access_revoke: '🚫',
  };
  return icons[actionType] || '📋';
}
