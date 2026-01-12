import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Store, ShoppingBag, Check } from "lucide-react";

interface CatalogInfo {
  id: string;
  name: string;
  description: string | null;
  store_id: string;
  store_name: string;
  store_logo: string | null;
}

const CatalogAccess = () => {
  const { accessCode } = useParams<{ accessCode: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, session, loading: authLoading } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [catalogInfo, setCatalogInfo] = useState<CatalogInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  // Fetch catalog info by access code
  useEffect(() => {
    const fetchCatalog = async () => {
      if (!accessCode) {
        setError("Неверная ссылка");
        setLoading(false);
        return;
      }

      try {
        // Use RPC function with SECURITY DEFINER to bypass RLS
        // This allows unauthenticated users to lookup catalog info for registration
        const { data: catalogResult, error: catalogError } = await supabase
          .rpc("get_catalog_by_access_code", { _access_code: accessCode })
          .single();

        if (catalogError || !catalogResult) {
          setError("Прайс-лист не найден");
          setLoading(false);
          return;
        }

        setCatalogInfo({
          id: catalogResult.id,
          name: catalogResult.name,
          description: catalogResult.description,
          store_id: catalogResult.store_id,
          store_name: catalogResult.store_name || "Магазин",
          store_logo: catalogResult.store_logo || null,
        });
      } catch (err) {
        console.error("Error fetching catalog:", err);
        setError("Ошибка загрузки");
      } finally {
        setLoading(false);
      }
    };

    fetchCatalog();
  }, [accessCode]);

  // Handle user authentication state
  useEffect(() => {
    if (authLoading || loading || !catalogInfo) return;

    const handleAuthState = async () => {
      if (!user || !session) {
        // User not logged in - redirect to main page with customer tab and catalog info
        navigate(`/?tab=customer&catalog=${accessCode}&store=${catalogInfo.store_id}`);
        return;
      }

      // User is logged in - check if already has access
      let { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      // Если профиля нет - создаём его автоматически
      if (!profile) {
        const { data: newProfile, error: profileError } = await supabase
          .from("profiles")
          .insert({
            user_id: user.id,
            email: user.email || '',
            full_name: user.user_metadata?.full_name || '',
            phone: user.user_metadata?.phone || user.phone || '',
            role: 'customer'
          })
          .select('id')
          .single();

        if (profileError) {
          console.error("Error creating profile:", profileError);
          navigate(`/?tab=customer&catalog=${accessCode}&store=${catalogInfo.store_id}`);
          return;
        }
        profile = newProfile;
      }

      // Check if user is a customer of this store
      const { data: storeCustomer } = await supabase
        .from("store_customers")
        .select("id")
        .eq("profile_id", profile.id)
        .eq("store_id", catalogInfo.store_id)
        .single();

      if (storeCustomer) {
        // Check if already has access to this catalog
        const { data: access } = await supabase
          .from("customer_catalog_access")
          .select("id")
          .eq("store_customer_id", storeCustomer.id)
          .eq("catalog_id", catalogInfo.id)
          .single();

        if (access) {
          // Already has access - go to dashboard
          navigate("/customer-dashboard");
          return;
        }
      }

      // Show confirmation dialog for adding new catalog
      setShowConfirmDialog(true);
    };

    handleAuthState();
  }, [user, session, authLoading, loading, catalogInfo, accessCode, navigate]);

  const handleAddCatalog = async () => {
    if (!catalogInfo || !user) return;

    setIsAdding(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!profile) throw new Error("Профиль не найден");

      // Get or create store_customer record
      let { data: storeCustomer } = await supabase
        .from("store_customers")
        .select("id")
        .eq("profile_id", profile.id)
        .eq("store_id", catalogInfo.store_id)
        .single();

      if (!storeCustomer) {
        const { data: newCustomer, error: customerError } = await supabase
          .from("store_customers")
          .insert({
            profile_id: profile.id,
            store_id: catalogInfo.store_id,
          })
          .select()
          .single();

        if (customerError) throw customerError;
        storeCustomer = newCustomer;
      }

      // Add catalog access
      const { error: accessError } = await supabase
        .from("customer_catalog_access")
        .insert({
          store_customer_id: storeCustomer.id,
          catalog_id: catalogInfo.id,
        });

      if (accessError && !accessError.message.includes("duplicate")) {
        throw accessError;
      }

      toast({
        title: "Прайс-лист добавлен",
        description: `"${catalogInfo.name}" теперь доступен в вашем кабинете`,
      });

      navigate("/customer-dashboard");
    } catch (error: any) {
      console.error("Error adding catalog:", error);
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsAdding(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <Store className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Ошибка</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => navigate("/")} 
              variant="outline" 
              className="w-full"
            >
              На главную
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {catalogInfo?.store_logo ? (
            <img 
              src={catalogInfo.store_logo} 
              alt={catalogInfo.store_name}
              className="h-16 w-16 mx-auto rounded-full object-cover mb-4"
            />
          ) : (
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <ShoppingBag className="h-8 w-8 text-primary" />
            </div>
          )}
          <CardTitle>{catalogInfo?.store_name}</CardTitle>
          <CardDescription>
            Прайс-лист: {catalogInfo?.name}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Проверка доступа...</p>
        </CardContent>
      </Card>

      {/* Confirmation dialog for adding catalog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить прайс-лист?</DialogTitle>
            <DialogDescription>
              Добавить прайс-лист "{catalogInfo?.name}" от магазина "{catalogInfo?.store_name}" в ваш список?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowConfirmDialog(false);
                navigate("/customer-dashboard");
              }}
            >
              Отмена
            </Button>
            <Button onClick={handleAddCatalog} disabled={isAdding}>
              {isAdding ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Да, добавить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CatalogAccess;
