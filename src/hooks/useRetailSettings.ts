import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface RetailTheme {
  primaryColor?: string;
  accentColor?: string;
  headerStyle?: "minimal" | "full" | "centered";
  productCardStyle?: "modern" | "classic" | "compact";
}

export interface RetailSettings {
  retail_enabled: boolean;
  retail_theme: RetailTheme;
  retail_logo_url: string | null;
  seo_title: string | null;
  seo_description: string | null;
  favicon_url: string | null;
  custom_domain: string | null;
  subdomain: string;
}

export function useRetailSettings(storeId: string | null) {
  const [settings, setSettings] = useState<RetailSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchSettings = useCallback(async () => {
    if (!storeId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("stores")
        .select("retail_enabled, retail_theme, retail_logo_url, seo_title, seo_description, favicon_url, custom_domain, subdomain")
        .eq("id", storeId)
        .single();

      if (error) throw error;

      setSettings({
        retail_enabled: data.retail_enabled || false,
        retail_theme: (data.retail_theme as RetailTheme) || {},
        retail_logo_url: data.retail_logo_url,
        seo_title: data.seo_title,
        seo_description: data.seo_description,
        favicon_url: data.favicon_url,
        custom_domain: data.custom_domain,
        subdomain: data.subdomain,
      });
    } catch (err) {
      console.error("Error fetching retail settings:", err);
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось загрузить настройки розничного магазина",
      });
    } finally {
      setLoading(false);
    }
  }, [storeId, toast]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateRetailEnabled = useCallback(async (enabled: boolean) => {
    if (!storeId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("stores")
        .update({ retail_enabled: enabled })
        .eq("id", storeId);

      if (error) throw error;

      setSettings(prev => prev ? { ...prev, retail_enabled: enabled } : null);
      toast({
        title: enabled ? "Магазин включён" : "Магазин выключен",
        description: enabled 
          ? "Розничный магазин теперь доступен по ссылке" 
          : "Розничный магазин скрыт от покупателей",
      });
    } catch (err) {
      console.error("Error updating retail_enabled:", err);
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось обновить статус магазина",
      });
    } finally {
      setSaving(false);
    }
  }, [storeId, toast]);

  const updateRetailTheme = useCallback(async (theme: RetailTheme) => {
    if (!storeId) return;

    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase
        .from("stores")
        .update({ retail_theme: theme as any })
        .eq("id", storeId);

      if (error) throw error;

      setSettings(prev => prev ? { ...prev, retail_theme: theme } : null);
      toast({
        title: "Дизайн сохранён",
        description: "Настройки темы обновлены",
      });
    } catch (err) {
      console.error("Error updating retail_theme:", err);
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось сохранить настройки дизайна",
      });
    } finally {
      setSaving(false);
    }
  }, [storeId, toast]);

  const updateSeoSettings = useCallback(async (seo: { 
    seo_title: string | null; 
    seo_description: string | null;
  }) => {
    if (!storeId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("stores")
        .update(seo)
        .eq("id", storeId);

      if (error) throw error;

      setSettings(prev => prev ? { ...prev, ...seo } : null);
      toast({
        title: "SEO сохранено",
        description: "Мета-теги обновлены",
      });
    } catch (err) {
      console.error("Error updating SEO:", err);
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось сохранить SEO настройки",
      });
    } finally {
      setSaving(false);
    }
  }, [storeId, toast]);

  const updateCustomDomain = useCallback(async (domain: string | null) => {
    if (!storeId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("stores")
        .update({ custom_domain: domain || null })
        .eq("id", storeId);

      if (error) throw error;

      setSettings(prev => prev ? { ...prev, custom_domain: domain } : null);
      toast({
        title: "Домен сохранён",
        description: domain ? "Кастомный домен обновлён" : "Кастомный домен удалён",
      });
    } catch (err) {
      console.error("Error updating custom_domain:", err);
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось сохранить домен",
      });
    } finally {
      setSaving(false);
    }
  }, [storeId, toast]);

  const uploadRetailLogo = useCallback(async (file: File) => {
    if (!storeId) return;

    setSaving(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${storeId}/retail-logo.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("product-images")
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from("stores")
        .update({ retail_logo_url: publicUrl })
        .eq("id", storeId);

      if (updateError) throw updateError;

      setSettings(prev => prev ? { ...prev, retail_logo_url: publicUrl } : null);
      toast({
        title: "Логотип загружен",
        description: "Логотип розничного магазина обновлён",
      });
    } catch (err) {
      console.error("Error uploading logo:", err);
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось загрузить логотип",
      });
    } finally {
      setSaving(false);
    }
  }, [storeId, toast]);

  const uploadFavicon = useCallback(async (file: File) => {
    if (!storeId) return;

    setSaving(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${storeId}/favicon.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("product-images")
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from("stores")
        .update({ favicon_url: publicUrl })
        .eq("id", storeId);

      if (updateError) throw updateError;

      setSettings(prev => prev ? { ...prev, favicon_url: publicUrl } : null);
      toast({
        title: "Favicon загружен",
        description: "Иконка сайта обновлена",
      });
    } catch (err) {
      console.error("Error uploading favicon:", err);
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось загрузить favicon",
      });
    } finally {
      setSaving(false);
    }
  }, [storeId, toast]);

  const deleteRetailLogo = useCallback(async () => {
    if (!storeId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("stores")
        .update({ retail_logo_url: null })
        .eq("id", storeId);

      if (error) throw error;

      setSettings(prev => prev ? { ...prev, retail_logo_url: null } : null);
      toast({
        title: "Логотип удалён",
      });
    } catch (err) {
      console.error("Error deleting logo:", err);
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось удалить логотип",
      });
    } finally {
      setSaving(false);
    }
  }, [storeId, toast]);

  const deleteFavicon = useCallback(async () => {
    if (!storeId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("stores")
        .update({ favicon_url: null })
        .eq("id", storeId);

      if (error) throw error;

      setSettings(prev => prev ? { ...prev, favicon_url: null } : null);
      toast({
        title: "Favicon удалён",
      });
    } catch (err) {
      console.error("Error deleting favicon:", err);
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось удалить favicon",
      });
    } finally {
      setSaving(false);
    }
  }, [storeId, toast]);

  return {
    settings,
    loading,
    saving,
    updateRetailEnabled,
    updateRetailTheme,
    updateSeoSettings,
    updateCustomDomain,
    uploadRetailLogo,
    uploadFavicon,
    deleteRetailLogo,
    deleteFavicon,
    refetch: fetchSettings,
  };
}
