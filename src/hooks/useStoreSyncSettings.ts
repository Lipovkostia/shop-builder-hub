import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Json } from "@/integrations/supabase/types";

export interface SyncFieldMapping {
  buyPrice: boolean;
  price: boolean;
  quantity: boolean;
  name: boolean;
  description: boolean;
  unit: boolean;
}

export interface SyncSettings {
  id?: string;
  store_id: string;
  enabled: boolean;
  interval_minutes: number;
  last_sync_time: string | null;
  next_sync_time: string | null;
  field_mapping: SyncFieldMapping;
  // MoySklad order sync fields
  moysklad_organization_id: string | null;
  moysklad_counterparty_id: string | null;
  sync_orders_enabled: boolean;
}

export const defaultSyncSettings: Omit<SyncSettings, "store_id"> = {
  enabled: false,
  interval_minutes: 30,
  last_sync_time: null,
  next_sync_time: null,
  field_mapping: {
    buyPrice: true,
    price: false,
    quantity: true,
    name: false,
    description: false,
    unit: false,
  },
  // MoySklad order sync defaults
  moysklad_organization_id: null,
  moysklad_counterparty_id: null,
  sync_orders_enabled: false,
};

function parseFieldMapping(json: Json | null): SyncFieldMapping {
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    return defaultSyncSettings.field_mapping;
  }
  const obj = json as Record<string, unknown>;
  return {
    buyPrice: Boolean(obj.buyPrice ?? true),
    price: Boolean(obj.price ?? false),
    quantity: Boolean(obj.quantity ?? true),
    name: Boolean(obj.name ?? false),
    description: Boolean(obj.description ?? false),
    unit: Boolean(obj.unit ?? false),
  };
}

function toJson(mapping: SyncFieldMapping): Json {
  return {
    buyPrice: mapping.buyPrice,
    price: mapping.price,
    quantity: mapping.quantity,
    name: mapping.name,
    description: mapping.description,
    unit: mapping.unit,
  };
}

export function useStoreSyncSettings(storeId: string | null) {
  const [settings, setSettings] = useState<SyncSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!storeId) {
      setSettings(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("store_sync_settings")
        .select("*")
        .eq("store_id", storeId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings({
          id: data.id,
          store_id: data.store_id,
          enabled: data.enabled,
          interval_minutes: data.interval_minutes,
          last_sync_time: data.last_sync_time,
          next_sync_time: data.next_sync_time,
          field_mapping: parseFieldMapping(data.field_mapping),
          moysklad_organization_id: data.moysklad_organization_id ?? null,
          moysklad_counterparty_id: data.moysklad_counterparty_id ?? null,
          sync_orders_enabled: data.sync_orders_enabled ?? false,
        });
      } else {
        // No settings yet, use defaults
        setSettings({
          store_id: storeId,
          ...defaultSyncSettings,
        });
      }
    } catch (error) {
      console.error("Error fetching sync settings:", error);
      setSettings({
        store_id: storeId,
        ...defaultSyncSettings,
      });
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = useCallback(
    async (updates: Partial<SyncSettings>) => {
      if (!storeId) return null;

      try {
        // Check if settings exist
        const { data: existing } = await supabase
          .from("store_sync_settings")
          .select("id")
          .eq("store_id", storeId)
          .maybeSingle();

        if (existing) {
          // Update existing
          const updateData: Record<string, unknown> = {};
          if (updates.enabled !== undefined) updateData.enabled = updates.enabled;
          if (updates.interval_minutes !== undefined) updateData.interval_minutes = updates.interval_minutes;
          if (updates.last_sync_time !== undefined) updateData.last_sync_time = updates.last_sync_time;
          if (updates.next_sync_time !== undefined) updateData.next_sync_time = updates.next_sync_time;
          if (updates.field_mapping !== undefined) updateData.field_mapping = toJson(updates.field_mapping);
          if (updates.moysklad_organization_id !== undefined) updateData.moysklad_organization_id = updates.moysklad_organization_id;
          if (updates.moysklad_counterparty_id !== undefined) updateData.moysklad_counterparty_id = updates.moysklad_counterparty_id;
          if (updates.sync_orders_enabled !== undefined) updateData.sync_orders_enabled = updates.sync_orders_enabled;

          const { data, error } = await supabase
            .from("store_sync_settings")
            .update(updateData)
            .eq("store_id", storeId)
            .select()
            .single();

          if (error) throw error;

          setSettings({
            id: data.id,
            store_id: data.store_id,
            enabled: data.enabled,
            interval_minutes: data.interval_minutes,
            last_sync_time: data.last_sync_time,
            next_sync_time: data.next_sync_time,
            field_mapping: parseFieldMapping(data.field_mapping),
            moysklad_organization_id: data.moysklad_organization_id ?? null,
            moysklad_counterparty_id: data.moysklad_counterparty_id ?? null,
            sync_orders_enabled: data.sync_orders_enabled ?? false,
          });
          return data;
        } else {
          // Insert new
          const newSettings = {
            store_id: storeId,
            enabled: updates.enabled ?? defaultSyncSettings.enabled,
            interval_minutes:
              updates.interval_minutes ?? defaultSyncSettings.interval_minutes,
            last_sync_time: updates.last_sync_time ?? null,
            next_sync_time: updates.next_sync_time ?? null,
            field_mapping: toJson(
              updates.field_mapping ?? defaultSyncSettings.field_mapping
            ),
            moysklad_organization_id: updates.moysklad_organization_id ?? null,
            moysklad_counterparty_id: updates.moysklad_counterparty_id ?? null,
            sync_orders_enabled: updates.sync_orders_enabled ?? false,
          };

          const { data, error } = await supabase
            .from("store_sync_settings")
            .insert(newSettings)
            .select()
            .single();

          if (error) throw error;

          setSettings({
            id: data.id,
            store_id: data.store_id,
            enabled: data.enabled,
            interval_minutes: data.interval_minutes,
            last_sync_time: data.last_sync_time,
            next_sync_time: data.next_sync_time,
            field_mapping: parseFieldMapping(data.field_mapping),
            moysklad_organization_id: data.moysklad_organization_id ?? null,
            moysklad_counterparty_id: data.moysklad_counterparty_id ?? null,
            sync_orders_enabled: data.sync_orders_enabled ?? false,
          });
          return data;
        }
      } catch (error) {
        console.error("Error updating sync settings:", error);
        return null;
      }
    },
    [storeId]
  );

  return {
    settings,
    loading,
    updateSettings,
    refetch: fetchSettings,
  };
}
