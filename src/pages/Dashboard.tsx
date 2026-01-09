import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Store, Plus, LogOut, Loader2, Package, ShoppingCart, BarChart3 } from "lucide-react";
import { z } from "zod";

const storeSchema = z.object({
  name: z.string().trim().min(2, "Название должно быть не менее 2 символов").max(50),
  subdomain: z.string().trim().min(3, "Поддомен должен быть не менее 3 символов").max(30)
    .regex(/^[a-z0-9-]+$/, "Только латинские буквы, цифры и дефис"),
  description: z.string().max(500).optional(),
});

interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
}

interface StoreData {
  id: string;
  name: string;
  subdomain: string;
  description: string | null;
  status: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stores, setStores] = useState<StoreData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  const [storeName, setStoreName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session?.user) {
        navigate("/auth");
      }
    });

    checkAuth();

    return () => subscription.unsubscribe();
  }, [navigate]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      navigate("/auth");
      return;
    }

    await loadProfile(session.user.id);
    setIsLoading(false);
  };

  const loadProfile = async (userId: string) => {
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (profileError || !profileData) {
      toast({
        title: "Ошибка загрузки профиля",
        variant: "destructive",
      });
      return;
    }

    setProfile(profileData);

    const { data: storesData } = await supabase
      .from("stores")
      .select("*")
      .eq("owner_id", profileData.id);

    if (storesData) {
      setStores(storesData);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const validateStoreForm = () => {
    try {
      storeSchema.parse({ name: storeName, subdomain, description });
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateStoreForm() || !profile) return;
    
    setIsCreating(true);

    try {
      // Check if subdomain is available
      const { data: existing } = await supabase
        .from("stores")
        .select("id")
        .eq("subdomain", subdomain.toLowerCase())
        .single();

      if (existing) {
        setErrors({ subdomain: "Этот поддомен уже занят" });
        setIsCreating(false);
        return;
      }

      const { data, error } = await supabase
        .from("stores")
        .insert({
          owner_id: profile.id,
          name: storeName.trim(),
          subdomain: subdomain.toLowerCase().trim(),
          description: description.trim() || null,
          status: "active",
        })
        .select()
        .single();

      if (error) throw error;

      setStores([...stores, data]);
      setShowCreateForm(false);
      setStoreName("");
      setSubdomain("");
      setDescription("");
      
      toast({
        title: "Магазин создан!",
        description: `Ваш магазин доступен по адресу ${subdomain}.shopforge.com`,
      });

      // Redirect to the store's storefront
      navigate(`/store/${data.subdomain}`);
    } catch (error) {
      toast({
        title: "Ошибка создания магазина",
        description: "Попробуйте позже",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-primary">
              <Store className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-bold">ShopForge</span>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {profile?.full_name || profile?.email}
            </span>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold">Мои магазины</h1>
            <p className="text-muted-foreground">Управляйте вашими интернет-магазинами</p>
          </div>
          
          {!showCreateForm && (
            <Button onClick={() => setShowCreateForm(true)} className="gradient-primary border-0">
              <Plus className="mr-2 h-4 w-4" />
              Создать магазин
            </Button>
          )}
        </div>

        {/* Create Store Form */}
        {showCreateForm && (
          <Card className="mb-8 border-primary/20">
            <CardHeader>
              <CardTitle>Новый магазин</CardTitle>
              <CardDescription>Заполните информацию для создания магазина</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateStore} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="storeName">Название магазина</Label>
                    <Input
                      id="storeName"
                      placeholder="Мой магазин"
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      disabled={isCreating}
                    />
                    {errors.name && (
                      <p className="text-sm text-destructive">{errors.name}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="subdomain">Поддомен</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="subdomain"
                        placeholder="myshop"
                        value={subdomain}
                        onChange={(e) => setSubdomain(e.target.value.toLowerCase())}
                        disabled={isCreating}
                      />
                      <span className="whitespace-nowrap text-sm text-muted-foreground">.shopforge.com</span>
                    </div>
                    {errors.subdomain && (
                      <p className="text-sm text-destructive">{errors.subdomain}</p>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">Описание (опционально)</Label>
                  <Textarea
                    id="description"
                    placeholder="Расскажите о вашем магазине..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={isCreating}
                  />
                </div>
                
                <div className="flex gap-3">
                  <Button type="submit" disabled={isCreating} className="gradient-primary border-0">
                    {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Создать магазин
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowCreateForm(false)}
                    disabled={isCreating}
                  >
                    Отмена
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Stores List */}
        {stores.length === 0 && !showCreateForm ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent">
                <Store className="h-8 w-8 text-primary" />
              </div>
              <h3 className="mb-2 font-display text-xl font-semibold">У вас пока нет магазинов</h3>
              <p className="mb-6 text-center text-muted-foreground">
                Создайте свой первый интернет-магазин и начните продавать
              </p>
              <Button onClick={() => setShowCreateForm(true)} className="gradient-primary border-0">
                <Plus className="mr-2 h-4 w-4" />
                Создать магазин
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {stores.map((store) => (
              <Card key={store.id} className="group transition-all hover:border-primary/30 hover:shadow-lg">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="font-display">{store.name}</CardTitle>
                      <CardDescription>{store.subdomain}.shopforge.com</CardDescription>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                      store.status === "active" 
                        ? "bg-success/10 text-success" 
                        : "bg-warning/10 text-warning"
                    }`}>
                      {store.status === "active" ? "Активен" : "Ожидание"}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  {store.description && (
                    <p className="mb-4 text-sm text-muted-foreground line-clamp-2">
                      {store.description}
                    </p>
                  )}
                  
                  <div className="mb-4 grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <Package className="mx-auto mb-1 h-5 w-5 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">Товары</p>
                      <p className="font-semibold">0</p>
                    </div>
                    <div className="text-center">
                      <ShoppingCart className="mx-auto mb-1 h-5 w-5 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">Заказы</p>
                      <p className="font-semibold">0</p>
                    </div>
                    <div className="text-center">
                      <BarChart3 className="mx-auto mb-1 h-5 w-5 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">Выручка</p>
                      <p className="font-semibold">0₽</p>
                    </div>
                  </div>
                  
                  <Button variant="outline" className="w-full">
                    Управление магазином
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;