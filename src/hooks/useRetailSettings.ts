import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface RetailTheme {
  primaryColor?: string;
  accentColor?: string;
  headerStyle?: "minimal" | "full" | "centered";
  productCardStyle?: "modern" | "classic" | "compact";
  // Font settings
  fonts?: {
    productName?: {
      family?: string;
      size?: string;
    };
    productPrice?: {
      family?: string;
      size?: string;
    };
    productDescription?: {
      family?: string;
      size?: string;
    };
    catalog?: {
      family?: string;
      size?: string;
    };
  };
}

export interface RetailSettings {
  retail_enabled: boolean;
  retail_theme: RetailTheme;
  retail_logo_url: string | null;
  retail_name: string | null;
  seo_title: string | null;
  seo_description: string | null;
  favicon_url: string | null;
  custom_domain: string | null;
  subdomain: string;
  retail_catalog_id: string | null;
  // Contact fields for mobile header
  retail_phone: string | null;
  telegram_username: string | null;
  whatsapp_phone: string | null;
  // Delivery info fields
  retail_delivery_time: string | null;
  retail_delivery_info: string | null;
  retail_delivery_free_from: number | null;
  retail_delivery_region: string | null;
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
        .select("retail_enabled, retail_theme, retail_logo_url, retail_name, seo_title, seo_description, favicon_url, custom_domain, subdomain, retail_catalog_id, retail_phone, telegram_username, whatsapp_phone, retail_delivery_time, retail_delivery_info, retail_delivery_free_from, retail_delivery_region")
        .eq("id", storeId)
        .single();

      if (error) throw error;

      setSettings({
        retail_enabled: data.retail_enabled || false,
        retail_theme: (data.retail_theme as RetailTheme) || {},
        retail_logo_url: data.retail_logo_url,
        retail_name: (data as { retail_name?: string | null }).retail_name || null,
        seo_title: data.seo_title,
        seo_description: data.seo_description,
        favicon_url: data.favicon_url,
        custom_domain: data.custom_domain,
        subdomain: data.subdomain,
        retail_catalog_id: data.retail_catalog_id,
        retail_phone: data.retail_phone,
        telegram_username: data.telegram_username,
        whatsapp_phone: data.whatsapp_phone,
        retail_delivery_time: (data as { retail_delivery_time?: string | null }).retail_delivery_time || null,
        retail_delivery_info: (data as { retail_delivery_info?: string | null }).retail_delivery_info || null,
        retail_delivery_free_from: (data as { retail_delivery_free_from?: number | null }).retail_delivery_free_from || null,
        retail_delivery_region: (data as { retail_delivery_region?: string | null }).retail_delivery_region || null,
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

  const updateRetailCatalog = useCallback(async (catalogId: string | null) => {
    if (!storeId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("stores")
        .update({ retail_catalog_id: catalogId || null })
        .eq("id", storeId);

      if (error) throw error;

      setSettings(prev => prev ? { ...prev, retail_catalog_id: catalogId } : null);
      toast({
        title: "Прайс-лист обновлён",
        description: catalogId ? "Товары из выбранного прайс-листа будут отображаться в магазине" : "Все активные товары будут отображаться в магазине",
      });
    } catch (err) {
      console.error("Error updating retail_catalog_id:", err);
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось обновить прайс-лист",
      });
    } finally {
      setSaving(false);
    }
  }, [storeId, toast]);

  const updateRetailName = useCallback(async (name: string | null) => {
    if (!storeId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("stores")
        .update({ retail_name: name || null })
        .eq("id", storeId);

      if (error) throw error;

      setSettings(prev => prev ? { ...prev, retail_name: name } : null);
      toast({
        title: "Название сохранено",
        description: "Название магазина обновлено",
      });
    } catch (err) {
      console.error("Error updating retail_name:", err);
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось сохранить название",
      });
    } finally {
      setSaving(false);
    }
  }, [storeId, toast]);

  // Compress image before upload
  const compressImage = async (file: File, maxSizeMB: number = 2): Promise<File> => {
    // If file is already small enough, return as is
    if (file.size <= maxSizeMB * 1024 * 1024) return file;
    
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      img.onload = () => {
        // Calculate new dimensions while maintaining aspect ratio
        let { width, height } = img;
        const maxDimension = 1200;
        
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height / width) * maxDimension;
            width = maxDimension;
          } else {
            width = (width / height) * maxDimension;
            height = maxDimension;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        if (!ctx) {
          resolve(file);
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        // Determine output type - keep PNG for transparency
        const isPng = file.type === 'image/png';
        const outputType = isPng ? 'image/png' : 'image/jpeg';
        const quality = isPng ? 0.9 : 0.85;
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: outputType,
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          outputType,
          quality
        );
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  };

  const uploadRetailLogo = useCallback(async (file: File) => {
    if (!storeId) return;

    setSaving(true);
    try {
      // Compress image if needed
      const processedFile = await compressImage(file, 2);
      
      const fileExt = processedFile.name.split(".").pop() || 'png';
      const fileName = `${storeId}/retail-logo.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(fileName, processedFile, { upsert: true });

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

  const updateContactSettings = useCallback(async (contact: { 
    retail_phone: string | null; 
    telegram_username: string | null;
    whatsapp_phone: string | null;
  }) => {
    if (!storeId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("stores")
        .update(contact)
        .eq("id", storeId);

      if (error) throw error;

      setSettings(prev => prev ? { ...prev, ...contact } : null);
      toast({
        title: "Контакты сохранены",
        description: "Контактные данные для мобильной версии обновлены",
      });
    } catch (err) {
      console.error("Error updating contact settings:", err);
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось сохранить контактные данные",
      });
    } finally {
      setSaving(false);
    }
  }, [storeId, toast]);

  const updateDeliverySettings = useCallback(async (delivery: { 
    retail_delivery_time: string | null; 
    retail_delivery_info: string | null;
    retail_delivery_free_from: number | null;
    retail_delivery_region: string | null;
  }) => {
    if (!storeId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("stores")
        .update(delivery)
        .eq("id", storeId);

      if (error) throw error;

      setSettings(prev => prev ? { ...prev, ...delivery } : null);
      toast({
        title: "Настройки доставки сохранены",
        description: "Информация о доставке обновлена",
      });
    } catch (err) {
      console.error("Error updating delivery settings:", err);
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось сохранить настройки доставки",
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
    updateRetailName,
    updateSeoSettings,
    updateCustomDomain,
    updateRetailCatalog,
    updateContactSettings,
    updateDeliverySettings,
    uploadRetailLogo,
    uploadFavicon,
    deleteRetailLogo,
    deleteFavicon,
    refetch: fetchSettings,
  };
}
