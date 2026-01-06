import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ShoppingBag, Mail, Lock, User, ArrowLeft, Loader2 } from "lucide-react";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().trim().email("Введите корректный email"),
  password: z.string().min(6, "Пароль должен быть не менее 6 символов"),
});

const registerSchema = loginSchema.extend({
  fullName: z.string().trim().min(2, "Введите ваше имя"),
  phone: z.string().optional(),
});

const CustomerAuth = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const catalogAccessCode = searchParams.get("catalog");
  const storeId = searchParams.get("store");
  
  const [isLogin, setIsLogin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [catalogInfo, setCatalogInfo] = useState<{ name: string; storeName: string } | null>(null);

  // Fetch catalog info
  useEffect(() => {
    const fetchCatalogInfo = async () => {
      if (!catalogAccessCode) return;

      const { data: catalog } = await supabase
        .from("catalogs")
        .select("name, store_id")
        .eq("access_code", catalogAccessCode)
        .single();

      if (catalog) {
        const { data: store } = await supabase
          .from("stores")
          .select("name")
          .eq("id", catalog.store_id)
          .single();

        setCatalogInfo({
          name: catalog.name,
          storeName: store?.name || "Магазин",
        });
      }
    };

    fetchCatalogInfo();
  }, [catalogAccessCode]);

  // Check if already logged in
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // Redirect back to catalog access page to handle the flow
        if (catalogAccessCode) {
          navigate(`/catalog/${catalogAccessCode}`);
        } else {
          navigate("/customer-dashboard");
        }
      }
    };
    checkSession();
  }, [navigate, catalogAccessCode]);

  const validateForm = () => {
    try {
      if (isLogin) {
        loginSchema.parse({ email, password });
      } else {
        registerSchema.parse({ email, password, fullName, phone });
      }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        
        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            toast({
              title: "Ошибка входа",
              description: "Неверный email или пароль",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Ошибка",
              description: error.message,
              variant: "destructive",
            });
          }
          return;
        }
        
        toast({
          title: "Добро пожаловать!",
          description: "Вы успешно вошли в систему",
        });

        // Redirect to catalog access or dashboard
        if (catalogAccessCode) {
          navigate(`/catalog/${catalogAccessCode}`);
        } else {
          navigate("/customer-dashboard");
        }
      } else {
        // Register new customer
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: catalogAccessCode 
              ? `${window.location.origin}/catalog/${catalogAccessCode}`
              : `${window.location.origin}/customer-dashboard`,
            data: {
              full_name: fullName.trim(),
              phone: phone.trim() || null,
              role: "customer",
            },
          },
        });
        
        if (error) {
          if (error.message.includes("already registered")) {
            toast({
              title: "Email уже зарегистрирован",
              description: "Попробуйте войти или используйте другой email",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Ошибка регистрации",
              description: error.message,
              variant: "destructive",
            });
          }
          return;
        }

        // If we have store and catalog info, create customer and access records
        if (data.user && storeId && catalogAccessCode) {
          try {
            // Wait a bit for the trigger to create profile
            await new Promise(resolve => setTimeout(resolve, 500));

            // Get the profile
            const { data: profile } = await supabase
              .from("profiles")
              .select("id")
              .eq("user_id", data.user.id)
              .single();

            if (profile) {
              // Create store_customer record
              const { data: storeCustomer, error: customerError } = await supabase
                .from("store_customers")
                .insert({
                  profile_id: profile.id,
                  store_id: storeId,
                })
                .select()
                .single();

              if (!customerError && storeCustomer) {
                // Get catalog by access_code
                const { data: catalog } = await supabase
                  .from("catalogs")
                  .select("id")
                  .eq("access_code", catalogAccessCode)
                  .single();

                if (catalog) {
                  // Create catalog access
                  await supabase
                    .from("customer_catalog_access")
                    .insert({
                      store_customer_id: storeCustomer.id,
                      catalog_id: catalog.id,
                    });
                }
              }
            }
          } catch (err) {
            console.error("Error setting up customer access:", err);
          }
        }
        
        toast({
          title: "Регистрация успешна!",
          description: "Добро пожаловать",
        });

        // Redirect
        navigate("/customer-dashboard");
      }
    } catch (error) {
      toast({
        title: "Произошла ошибка",
        description: "Попробуйте позже",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute inset-0 gradient-hero" />
      <div className="absolute top-20 left-10 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute bottom-20 right-10 h-72 w-72 rounded-full bg-primary/5 blur-3xl" />

      <div className="container relative flex min-h-screen flex-col items-center justify-center py-10">
        <Link 
          to="/" 
          className="absolute top-6 left-6 flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          На главную
        </Link>

        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-primary">
            <ShoppingBag className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="font-display text-2xl font-bold">Личный кабинет</span>
        </div>

        {catalogInfo && (
          <div className="mb-4 text-center">
            <p className="text-sm text-muted-foreground">
              Прайс-лист: <span className="font-medium text-foreground">{catalogInfo.name}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              от магазина <span className="font-medium text-foreground">{catalogInfo.storeName}</span>
            </p>
          </div>
        )}

        <Card className="w-full max-w-md border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader className="text-center">
            <CardTitle className="font-display text-2xl">
              {isLogin ? "Вход" : "Регистрация"}
            </CardTitle>
            <CardDescription>
              {isLogin 
                ? "Войдите, чтобы просматривать прайс-листы" 
                : "Зарегистрируйтесь для доступа к прайс-листам"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Ваше имя</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="fullName"
                        type="text"
                        placeholder="Иван Иванов"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="pl-10"
                        disabled={isLoading}
                      />
                    </div>
                    {errors.fullName && (
                      <p className="text-sm text-destructive">{errors.fullName}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Телефон (необязательно)</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+7 (999) 123-45-67"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                </>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    disabled={isLoading}
                  />
                </div>
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Пароль</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    disabled={isLoading}
                  />
                </div>
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password}</p>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full gradient-primary border-0"
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isLogin ? "Войти" : "Зарегистрироваться"}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm">
              {isLogin ? (
                <p className="text-muted-foreground">
                  Нет аккаунта?{" "}
                  <button
                    onClick={() => setIsLogin(false)}
                    className="font-medium text-primary hover:underline"
                  >
                    Зарегистрироваться
                  </button>
                </p>
              ) : (
                <p className="text-muted-foreground">
                  Уже есть аккаунт?{" "}
                  <button
                    onClick={() => setIsLogin(true)}
                    className="font-medium text-primary hover:underline"
                  >
                    Войти
                  </button>
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CustomerAuth;
