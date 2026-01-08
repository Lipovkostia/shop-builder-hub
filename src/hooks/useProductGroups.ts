import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ProductGroup {
  id: string;
  store_id: string;
  name: string;
  description?: string;
  sort_order: number;
  created_at: string;
}

export interface ProductGroupAssignment {
  id: string;
  product_id: string;
  group_id: string;
  created_at: string;
}

export function useProductGroups(storeId: string | null) {
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [assignments, setAssignments] = useState<ProductGroupAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Fetch groups
  const fetchGroups = useCallback(async () => {
    if (!storeId) {
      setGroups([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("product_groups")
      .select("*")
      .eq("store_id", storeId)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Error fetching product groups:", error);
    } else {
      setGroups(data || []);
    }
    setLoading(false);
  }, [storeId]);

  // Fetch assignments
  const fetchAssignments = useCallback(async () => {
    if (!storeId) {
      setAssignments([]);
      return;
    }

    // Get all assignments for products in this store
    const { data, error } = await supabase
      .from("product_group_assignments")
      .select(`
        id,
        product_id,
        group_id,
        created_at,
        product_groups!inner(store_id)
      `)
      .eq("product_groups.store_id", storeId);

    if (error) {
      console.error("Error fetching product group assignments:", error);
    } else {
      setAssignments(data?.map(d => ({
        id: d.id,
        product_id: d.product_id,
        group_id: d.group_id,
        created_at: d.created_at
      })) || []);
    }
  }, [storeId]);

  useEffect(() => {
    fetchGroups();
    fetchAssignments();
  }, [fetchGroups, fetchAssignments]);

  // Create a new group
  const createGroup = useCallback(async (name: string, description?: string) => {
    if (!storeId) return null;

    const { data, error } = await supabase
      .from("product_groups")
      .insert({
        store_id: storeId,
        name,
        description,
        sort_order: groups.length
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating product group:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось создать группу",
        variant: "destructive"
      });
      return null;
    }

    setGroups(prev => [...prev, data]);
    toast({
      title: "Группа создана",
      description: `Группа "${name}" успешно создана`
    });
    return data;
  }, [storeId, groups.length, toast]);

  // Delete a group
  const deleteGroup = useCallback(async (groupId: string) => {
    const { error } = await supabase
      .from("product_groups")
      .delete()
      .eq("id", groupId);

    if (error) {
      console.error("Error deleting product group:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось удалить группу",
        variant: "destructive"
      });
      return false;
    }

    setGroups(prev => prev.filter(g => g.id !== groupId));
    setAssignments(prev => prev.filter(a => a.group_id !== groupId));
    toast({
      title: "Группа удалена"
    });
    return true;
  }, [toast]);

  // Update group
  const updateGroup = useCallback(async (groupId: string, updates: Partial<Pick<ProductGroup, "name" | "description" | "sort_order">>) => {
    const { error } = await supabase
      .from("product_groups")
      .update(updates)
      .eq("id", groupId);

    if (error) {
      console.error("Error updating product group:", error);
      return false;
    }

    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, ...updates } : g));
    return true;
  }, []);

  // Assign product to group
  const assignProductToGroup = useCallback(async (productId: string, groupId: string) => {
    const { data, error } = await supabase
      .from("product_group_assignments")
      .insert({
        product_id: productId,
        group_id: groupId
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        // Already exists
        return true;
      }
      console.error("Error assigning product to group:", error);
      return false;
    }

    setAssignments(prev => [...prev, data]);
    return true;
  }, []);

  // Remove product from group
  const removeProductFromGroup = useCallback(async (productId: string, groupId: string) => {
    const { error } = await supabase
      .from("product_group_assignments")
      .delete()
      .eq("product_id", productId)
      .eq("group_id", groupId);

    if (error) {
      console.error("Error removing product from group:", error);
      return false;
    }

    setAssignments(prev => prev.filter(a => !(a.product_id === productId && a.group_id === groupId)));
    return true;
  }, []);

  // Set product groups (replace all assignments for a product)
  const setProductGroups = useCallback(async (productId: string, groupIds: string[]) => {
    const currentGroupIds = assignments
      .filter(a => a.product_id === productId)
      .map(a => a.group_id);

    const toAdd = groupIds.filter(id => !currentGroupIds.includes(id));
    const toRemove = currentGroupIds.filter(id => !groupIds.includes(id));

    // Remove
    for (const groupId of toRemove) {
      await removeProductFromGroup(productId, groupId);
    }

    // Add
    for (const groupId of toAdd) {
      await assignProductToGroup(productId, groupId);
    }

    return true;
  }, [assignments, assignProductToGroup, removeProductFromGroup]);

  // Get groups for a product
  const getProductGroups = useCallback((productId: string): ProductGroup[] => {
    const groupIds = assignments
      .filter(a => a.product_id === productId)
      .map(a => a.group_id);
    return groups.filter(g => groupIds.includes(g.id));
  }, [assignments, groups]);

  // Get group IDs for a product
  const getProductGroupIds = useCallback((productId: string): string[] => {
    return assignments
      .filter(a => a.product_id === productId)
      .map(a => a.group_id);
  }, [assignments]);

  return {
    groups,
    assignments,
    loading,
    createGroup,
    deleteGroup,
    updateGroup,
    assignProductToGroup,
    removeProductFromGroup,
    setProductGroups,
    getProductGroups,
    getProductGroupIds,
    refetch: () => {
      fetchGroups();
      fetchAssignments();
    }
  };
}
