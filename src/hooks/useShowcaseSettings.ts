import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ShowcaseTheme {
  primaryColor?: string;
  accentColor?: string;
  headerStyle?: "minimal" | "full" | "centered";
  productCardStyle?: "modern" | "classic" | "compact";
  fonts?: {
    productName?: { family?: string; size?: string };
    productPrice?: { family?: string; size?: string };
    productDescription?: { family?: string; size?: string };
    catalog?: { family?: string; size?: string };
  };
}

export interface ShowcaseSettings {
  showcase_enabled: boolean;
  showcase_theme: ShowcaseTheme;
  showcase_logo_url: string | null;
  showcase_name: string | null;
  showcase_seo_title: string | null;
  showcase_seo_description: string | null;
  showcase_favicon_url: string | null;
  showcase_custom_domain: string | null;
  subdomain: string;
  showcase_catalog_id: string | null;
  showcase_phone: string | null;
  showcase_telegram_username: string | null;
  showcase_whatsapp_phone: string | null;
  showcase_delivery_time: string | null;
  showcase_delivery_info: string | null;
  showcase_delivery_free_from: number | null;
  showcase_delivery_region: string | null;
  showcase_footer_delivery_payment: string | null;
  showcase_footer_returns: string | null;
}

export function useShowcaseSettings(storeId: string | null) {
  const [settings, setSettings] = useState<ShowcaseSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchSettings = useCallback(async () => {
    if (!storeId) { setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from("stores")
        .select("showcase_enabled, showcase_theme, showcase_logo_url, showcase_name, showcase_seo_title, showcase_seo_description, showcase_favicon_url, showcase_custom_domain, subdomain, showcase_catalog_id, showcase_phone, showcase_telegram_username, showcase_whatsapp_phone, showcase_delivery_time, showcase_delivery_info, showcase_delivery_free_from, showcase_delivery_region, showcase_footer_delivery_payment, showcase_footer_returns")
        .eq("id", storeId)
        .single();
      if (error) throw error;
      const d = data as any;
      setSettings({
        showcase_enabled: d.showcase_enabled || false,
        showcase_theme: (d.showcase_theme as ShowcaseTheme) || {},
        showcase_logo_url: d.showcase_logo_url,
        showcase_name: d.showcase_name || null,
        showcase_seo_title: d.showcase_seo_title || null,
        showcase_seo_description: d.showcase_seo_description || null,
        showcase_favicon_url: d.showcase_favicon_url || null,
        showcase_custom_domain: d.showcase_custom_domain || null,
        subdomain: d.subdomain,
        showcase_catalog_id: d.showcase_catalog_id || null,
        showcase_phone: d.showcase_phone || null,
        showcase_telegram_username: d.showcase_telegram_username || null,
        showcase_whatsapp_phone: d.showcase_whatsapp_phone || null,
        showcase_delivery_time: d.showcase_delivery_time || null,
        showcase_delivery_info: d.showcase_delivery_info || null,
        showcase_delivery_free_from: d.showcase_delivery_free_from || null,
        showcase_delivery_region: d.showcase_delivery_region || null,
        showcase_footer_delivery_payment: d.showcase_footer_delivery_payment || null,
        showcase_footer_returns: d.showcase_footer_returns || null,
      });
    } catch (err) {
      console.error("Error fetching showcase settings:", err);
      toast({ variant: "destructive", title: "Ошибка", description: "Не удалось загрузить настройки витрины" });
    } finally { setLoading(false); }
  }, [storeId, toast]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const updateField = useCallback(async (field: string, value: any, successMsg: string) => {
    if (!storeId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("stores").update({ [field]: value } as any).eq("id", storeId);
      if (error) throw error;
      setSettings(prev => prev ? { ...prev, [field]: value } : null);
      toast({ title: successMsg });
    } catch (err) {
      console.error(`Error updating ${field}:`, err);
      toast({ variant: "destructive", title: "Ошибка", description: `Не удалось сохранить` });
    } finally { setSaving(false); }
  }, [storeId, toast]);

  const updateFields = useCallback(async (fields: Record<string, any>, successMsg: string) => {
    if (!storeId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("stores").update(fields as any).eq("id", storeId);
      if (error) throw error;
      setSettings(prev => prev ? { ...prev, ...fields } : null);
      toast({ title: successMsg });
    } catch (err) {
      console.error("Error updating fields:", err);
      toast({ variant: "destructive", title: "Ошибка", description: "Не удалось сохранить" });
    } finally { setSaving(false); }
  }, [storeId, toast]);

  const updateShowcaseEnabled = useCallback((enabled: boolean) =>
    updateField("showcase_enabled", enabled, enabled ? "Витрина включена" : "Витрина выключена"), [updateField]);

  const updateShowcaseTheme = useCallback((theme: ShowcaseTheme) =>
    updateField("showcase_theme", theme, "Дизайн сохранён"), [updateField]);

  const updateShowcaseName = useCallback((name: string | null) =>
    updateField("showcase_name", name || null, "Название сохранено"), [updateField]);

  const updateSeoSettings = useCallback((seo: { showcase_seo_title: string | null; showcase_seo_description: string | null }) =>
    updateFields(seo, "SEO сохранено"), [updateFields]);

  const updateCustomDomain = useCallback((domain: string | null) =>
    updateField("showcase_custom_domain", domain || null, domain ? "Домен сохранён" : "Домен удалён"), [updateField]);

  const updateShowcaseCatalog = useCallback((catalogId: string | null) =>
    updateField("showcase_catalog_id", catalogId || null, catalogId ? "Прайс-лист обновлён" : "Прайс-лист сброшен"), [updateField]);

  const updateContactSettings = useCallback((contact: { showcase_phone: string | null; showcase_telegram_username: string | null; showcase_whatsapp_phone: string | null }) =>
    updateFields(contact, "Контакты сохранены"), [updateFields]);

  const updateDeliverySettings = useCallback((delivery: { showcase_delivery_time: string | null; showcase_delivery_info: string | null; showcase_delivery_free_from: number | null; showcase_delivery_region: string | null }) =>
    updateFields(delivery, "Настройки доставки сохранены"), [updateFields]);

  const updateFooterSettings = useCallback((footer: { showcase_footer_delivery_payment: string | null; showcase_footer_returns: string | null }) =>
    updateFields(footer, "Контент футера сохранён"), [updateFields]);

  const compressImage = async (file: File, maxSizeMB: number = 2): Promise<File> => {
    if (file.size <= maxSizeMB * 1024 * 1024) return file;
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      img.onload = () => {
        let { width, height } = img;
        const maxDimension = 1200;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) { height = (height / width) * maxDimension; width = maxDimension; }
          else { width = (width / height) * maxDimension; height = maxDimension; }
        }
        canvas.width = width; canvas.height = height;
        if (!ctx) { resolve(file); return; }
        ctx.drawImage(img, 0, 0, width, height);
        const isPng = file.type === 'image/png';
        canvas.toBlob(
          (blob) => blob ? resolve(new File([blob], file.name, { type: isPng ? 'image/png' : 'image/jpeg', lastModified: Date.now() })) : resolve(file),
          isPng ? 'image/png' : 'image/jpeg', isPng ? 0.9 : 0.85
        );
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  };

  const uploadShowcaseLogo = useCallback(async (file: File) => {
    if (!storeId) return;
    setSaving(true);
    try {
      const processedFile = await compressImage(file, 2);
      const fileExt = processedFile.name.split(".").pop() || 'png';
      const fileName = `${storeId}/showcase-logo.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("product-images").upload(fileName, processedFile, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("product-images").getPublicUrl(fileName);
      const { error: updateError } = await supabase.from("stores").update({ showcase_logo_url: publicUrl } as any).eq("id", storeId);
      if (updateError) throw updateError;
      setSettings(prev => prev ? { ...prev, showcase_logo_url: publicUrl } : null);
      toast({ title: "Логотип загружен" });
    } catch (err) {
      console.error("Error uploading logo:", err);
      toast({ variant: "destructive", title: "Ошибка", description: "Не удалось загрузить логотип" });
    } finally { setSaving(false); }
  }, [storeId, toast]);

  const uploadFavicon = useCallback(async (file: File) => {
    if (!storeId) return;
    setSaving(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${storeId}/showcase-favicon.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("product-images").upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("product-images").getPublicUrl(fileName);
      const { error: updateError } = await supabase.from("stores").update({ showcase_favicon_url: publicUrl } as any).eq("id", storeId);
      if (updateError) throw updateError;
      setSettings(prev => prev ? { ...prev, showcase_favicon_url: publicUrl } : null);
      toast({ title: "Favicon загружен" });
    } catch (err) {
      console.error("Error uploading favicon:", err);
      toast({ variant: "destructive", title: "Ошибка", description: "Не удалось загрузить favicon" });
    } finally { setSaving(false); }
  }, [storeId, toast]);

  const deleteShowcaseLogo = useCallback(() => updateField("showcase_logo_url", null, "Логотип удалён"), [updateField]);
  const deleteFavicon = useCallback(() => updateField("showcase_favicon_url", null, "Favicon удалён"), [updateField]);

  return {
    settings, loading, saving,
    updateShowcaseEnabled, updateShowcaseTheme, updateShowcaseName,
    updateSeoSettings, updateCustomDomain, updateShowcaseCatalog,
    updateContactSettings, updateDeliverySettings, updateFooterSettings,
    uploadShowcaseLogo, uploadFavicon, deleteShowcaseLogo, deleteFavicon,
    refetch: fetchSettings,
  };
}
