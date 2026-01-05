import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface CustomerRole {
  id: string;
  store_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
}

export function useCustomerRoles(storeId: string | null) {
  const { toast } = useToast();
  const [roles, setRoles] = useState<CustomerRole[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch all roles for the store
  const fetchRoles = useCallback(async () => {
    if (!storeId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("customer_roles")
        .select("*")
        .eq("store_id", storeId)
        .order("sort_order", { ascending: true });

      if (error) throw error;
      setRoles(data || []);
    } catch (error: any) {
      console.error("Error fetching roles:", error);
      toast({
        title: "Ошибка загрузки ролей",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [storeId, toast]);

  // Create a new role
  const createRole = useCallback(async (role: Omit<CustomerRole, "id" | "created_at">) => {
    try {
      const { data, error } = await supabase
        .from("customer_roles")
        .insert({
          store_id: role.store_id,
          name: role.name,
          description: role.description,
          sort_order: role.sort_order,
        })
        .select()
        .single();

      if (error) throw error;
      
      setRoles(prev => [...prev, data]);
      return data;
    } catch (error: any) {
      console.error("Error creating role:", error);
      toast({
        title: "Ошибка создания роли",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }
  }, [toast]);

  // Update a role
  const updateRole = useCallback(async (role: CustomerRole) => {
    try {
      const { data, error } = await supabase
        .from("customer_roles")
        .update({
          name: role.name,
          description: role.description,
          sort_order: role.sort_order,
        })
        .eq("id", role.id)
        .select()
        .single();

      if (error) throw error;
      
      setRoles(prev => prev.map(r => r.id === role.id ? data : r));
      return data;
    } catch (error: any) {
      console.error("Error updating role:", error);
      toast({
        title: "Ошибка обновления роли",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }
  }, [toast]);

  // Delete a role
  const deleteRole = useCallback(async (roleId: string) => {
    try {
      const { error } = await supabase
        .from("customer_roles")
        .delete()
        .eq("id", roleId);

      if (error) throw error;
      
      setRoles(prev => prev.filter(r => r.id !== roleId));
      return true;
    } catch (error: any) {
      console.error("Error deleting role:", error);
      toast({
        title: "Ошибка удаления роли",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  }, [toast]);

  // Initial fetch
  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  return {
    roles,
    loading,
    createRole,
    updateRole,
    deleteRole,
    refetch: fetchRoles,
  };
}
