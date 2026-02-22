import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface CustomerAddress {
  id: string;
  profile_id: string;
  address: string;
  city: string | null;
  label: string | null;
  is_default: boolean;
  last_used_at: string;
  created_at: string;
}

export const useCustomerAddresses = () => {
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchAddresses = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!profile) return;

      const { data, error } = await supabase
        .from("customer_addresses")
        .select("*")
        .eq("profile_id", profile.id)
        .order("last_used_at", { ascending: false });

      if (error) throw error;
      setAddresses(data || []);
    } catch (error) {
      console.error("Error fetching addresses:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAddresses();
  }, [fetchAddresses]);

  const addAddress = useCallback(async (address: string, label?: string, city?: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Не авторизован");

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!profile) throw new Error("Профиль не найден");

      // Check if address already exists
      const existingAddress = addresses.find(
        (a) => a.address.toLowerCase().trim() === address.toLowerCase().trim()
      );

      if (existingAddress) {
        await supabase
          .from("customer_addresses")
          .update({ last_used_at: new Date().toISOString(), city: city || existingAddress.city })
          .eq("id", existingAddress.id);
        
        await fetchAddresses();
        return existingAddress.id;
      }

      // Limit to 5 addresses
      if (addresses.length >= 5) {
        toast({
          title: "Лимит адресов",
          description: "Максимум 5 адресов. Удалите один из существующих.",
          variant: "destructive",
        });
        return null;
      }

      const { data, error } = await supabase
        .from("customer_addresses")
        .insert({
          profile_id: profile.id,
          address: address.trim(),
          label: label?.trim() || null,
          city: city?.trim() || null,
          is_default: addresses.length === 0,
        })
        .select()
        .single();

      if (error) throw error;
      
      await fetchAddresses();
      return data.id;
    } catch (error: any) {
      console.error("Error adding address:", error);
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось сохранить адрес",
        variant: "destructive",
      });
      return null;
    }
  }, [addresses, fetchAddresses, toast]);

  const updateLastUsed = useCallback(async (addressId: string) => {
    try {
      await supabase
        .from("customer_addresses")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", addressId);
      
      await fetchAddresses();
    } catch (error) {
      console.error("Error updating address:", error);
    }
  }, [fetchAddresses]);

  const deleteAddress = useCallback(async (addressId: string) => {
    try {
      const { error } = await supabase
        .from("customer_addresses")
        .delete()
        .eq("id", addressId);

      if (error) throw error;
      
      await fetchAddresses();
      toast({
        title: "Адрес удалён",
      });
    } catch (error: any) {
      console.error("Error deleting address:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось удалить адрес",
        variant: "destructive",
      });
    }
  }, [fetchAddresses, toast]);

  // Get the most recently used address
  const lastUsedAddress = addresses.length > 0 ? addresses[0] : null;

  return {
    addresses,
    loading,
    addAddress,
    updateLastUsed,
    deleteAddress,
    lastUsedAddress,
    refetch: fetchAddresses,
  };
};
