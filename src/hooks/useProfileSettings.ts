import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useProfileSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile-settings", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from("profiles")
        .select("id, toast_notifications_enabled")
        .eq("user_id", user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const updateSettings = useMutation({
    mutationFn: async (settings: { toast_notifications_enabled?: boolean }) => {
      if (!profile?.id) throw new Error("Profile not found");
      
      const { error } = await supabase
        .from("profiles")
        .update(settings)
        .eq("id", profile.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile-settings", user?.id] });
    },
  });

  return {
    profile,
    isLoading,
    toastEnabled: profile?.toast_notifications_enabled ?? true,
    updateSettings: updateSettings.mutate,
    isUpdating: updateSettings.isPending,
  };
}
