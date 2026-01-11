import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface StoreNotificationSettings {
  id: string;
  store_id: string;
  notification_email: string | null;
  email_enabled: boolean;
  notification_telegram: string | null;
  telegram_enabled: boolean;
  notification_whatsapp: string | null;
  whatsapp_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export function useStoreNotificationSettings(storeId: string | null) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<StoreNotificationSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    if (!storeId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("store_notification_settings")
        .select("*")
        .eq("store_id", storeId)
        .maybeSingle();

      if (error) throw error;
      
      setSettings(data as StoreNotificationSettings | null);
    } catch (error: any) {
      console.error("Error fetching notification settings:", error);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  const saveSettings = useCallback(async (updates: {
    notification_email?: string | null;
    email_enabled?: boolean;
    notification_telegram?: string | null;
    telegram_enabled?: boolean;
    notification_whatsapp?: string | null;
    whatsapp_enabled?: boolean;
  }) => {
    if (!storeId) return false;

    try {
      setSaving(true);

      if (settings) {
        // Update existing settings
        const { error } = await supabase
          .from("store_notification_settings")
          .update({
            ...updates,
            updated_at: new Date().toISOString(),
          })
          .eq("id", settings.id);

        if (error) throw error;

        setSettings(prev => prev ? { ...prev, ...updates } : null);
      } else {
        // Create new settings
        const { data, error } = await supabase
          .from("store_notification_settings")
          .insert({
            store_id: storeId,
            ...updates,
          })
          .select()
          .single();

        if (error) throw error;

        setSettings(data as StoreNotificationSettings);
      }

      toast({
        title: "Настройки сохранены",
        description: "Уведомления о заказах настроены",
      });

      return true;
    } catch (error: any) {
      console.error("Error saving notification settings:", error);
      toast({
        title: "Ошибка сохранения",
        description: error.message,
        variant: "destructive",
      });
      return false;
    } finally {
      setSaving(false);
    }
  }, [storeId, settings, toast]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return {
    settings,
    loading,
    saving,
    saveSettings,
    refetch: fetchSettings,
  };
}
