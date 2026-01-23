import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Store, LogIn, Shield, User, Mail } from "lucide-react";
import { PhoneInput } from "@/components/ui/phone-input";

const Index = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  // Check if coming from catalog link
  const tabFromUrl = searchParams.get("tab");
  const catalogFromUrl = searchParams.get("catalog");
  const storeFromUrl = searchParams.get("store");
  
  // Active tab state
  const [activeTab, setActiveTab] = useState(tabFromUrl === "customer" ? "customer" : "register");

  // Registration form state
  const [regStoreName, setRegStoreName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  
  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Customer form state
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerPassword, setCustomerPassword] = useState("");
  const [customerFullName, setCustomerFullName] = useState("");
  const [customerLoading, setCustomerLoading] = useState(false);
  const [isCustomerLogin, setIsCustomerLogin] = useState(tabFromUrl !== "customer");

  // Switch to registration mode when coming from catalog link
  useEffect(() => {
    if (tabFromUrl === "customer" && catalogFromUrl) {
      setIsCustomerLogin(false);
    }
  }, [tabFromUrl, catalogFromUrl]);

  // Check if user is already logged in and redirect
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      // Check for super admin
      const { data: platformRole } = await supabase
        .from('platform_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .eq('role', 'super_admin')
        .maybeSingle();

      if (platformRole) {
        navigate('/super-admin');
        return;
      }

      // Get profile and determine role
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('user_id', session.user.id)
        .single();

      if (!profile) return;

      if (profile.role === 'seller') {
        const { data: store } = await supabase
          .from('stores')
          .select('subdomain')
          .eq('owner_id', profile.id)
          .limit(1)
          .maybeSingle();

        if (store) {
          navigate(`/store/${store.subdomain}`);
          return;
        }

        // No store found - auto-create one
        const { data: fullProfile } = await supabase
          .from('profiles')
          .select('full_name, phone')
          .eq('id', profile.id)
          .single();

        const storeName = fullProfile?.full_name || fullProfile?.phone?.replace(/\D/g, '') || 'Мой магазин';
        const baseSubdomain = storeName.toLowerCase()
          .replace(/[^a-zа-яё0-9\s]/gi, '')
          .replace(/\s+/g, '-')
          .substring(0, 20);
        const subdomain = baseSubdomain + '-' + Date.now().toString(36).slice(-4);

        const { error: storeError } = await supabase
          .from('stores')
          .insert({
            name: storeName,
            subdomain,
            owner_id: profile.id,
            status: 'active'
          });

        if (!storeError) {
          toast({ title: "Магазин создан!", description: "Переходим в витрину" });
          localStorage.setItem('seller_onboarding_step1', 'true');
          navigate(`/store/${subdomain}`);
          return;
        }
      } else if (profile.role === 'customer') {
        navigate('/customer-dashboard');
        return;
      }
    };

    checkSession();
  }, [navigate]);

  // Generate subdomain from store name
  const generateSubdomain = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[а-яё]/g, (char) => {
        const map: Record<string, string> = {
          'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
          'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
          'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
          'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
          'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
        };
        return map[char] || char;
      })
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  };

  // Validate email format
  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!regStoreName.trim() || !regEmail.trim() || !regPassword.trim()) {
      toast({ title: "Заполните все обязательные поля", variant: "destructive" });
      return;
    }

    if (!isValidEmail(regEmail)) {
      toast({ title: "Введите корректный email", variant: "destructive" });
      return;
    }

    if (regPassword.length < 6) {
      toast({ title: "Пароль должен быть минимум 6 символов", variant: "destructive" });
      return;
    }

    setRegLoading(true);
    try {
      const subdomain = generateSubdomain(regStoreName);

      // Register user with real email
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: regEmail.trim().toLowerCase(),
        password: regPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: regStoreName,
            role: 'seller'
          }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Ошибка регистрации");

      // Wait for profile to be created by trigger
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Get the profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', authData.user.id)
        .single();

      if (profileError) throw profileError;

      // Update profile with phone if provided
      if (regPhone.trim()) {
        await supabase
          .from('profiles')
          .update({ phone: regPhone })
          .eq('id', profile.id);
      }

      // Create store
      const { error: storeError } = await supabase
        .from('stores')
        .insert({
          name: regStoreName,
          subdomain,
          owner_id: profile.id,
          status: 'active'
        });

      if (storeError) throw storeError;

      toast({ title: "Магазин создан!", description: "Переходим в витрину" });
      localStorage.setItem('seller_onboarding_step1', 'true');
      navigate(`/store/${subdomain}`);
      
    } catch (error: any) {
      console.error('Registration error:', error);
      let message = error.message;
      if (error.message?.includes('already registered')) {
        message = 'Этот email уже зарегистрирован. Попробуйте войти.';
      }
      toast({ 
        title: "Ошибка регистрации", 
        description: message,
        variant: "destructive" 
      });
    } finally {
      setRegLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!loginEmail.trim() || !loginPassword.trim()) {
      toast({ title: "Заполните все поля", variant: "destructive" });
      return;
    }

    if (!isValidEmail(loginEmail)) {
      toast({ title: "Введите корректный email", variant: "destructive" });
      return;
    }

    setLoginLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim().toLowerCase(),
        password: loginPassword
      });

      if (authError) throw authError;

      // Check for super admin first
      const { data: platformRole } = await supabase
        .from('platform_roles')
        .select('role')
        .eq('user_id', authData.user.id)
        .eq('role', 'super_admin')
        .maybeSingle();

      if (platformRole) {
        navigate('/super-admin');
        return;
      }

      // Get user's profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, phone, role')
        .eq('user_id', authData.user.id)
        .single();

      if (profile) {
        if (profile.role === 'customer') {
          navigate('/customer-dashboard');
          return;
        }

        const { data: store } = await supabase
          .from('stores')
          .select('subdomain')
          .eq('owner_id', profile.id)
          .limit(1)
          .maybeSingle();

        if (store) {
          navigate(`/store/${store.subdomain}`);
          return;
        }

        // No store found - auto-create one for sellers
        const storeName = profile.full_name || 'Мой магазин';
        const baseSubdomain = generateSubdomain(storeName);
        const subdomain = baseSubdomain + '-' + Date.now().toString(36).slice(-4);

        const { error: storeError } = await supabase
          .from('stores')
          .insert({
            name: storeName,
            subdomain,
            owner_id: profile.id,
            status: 'active'
          });

        if (!storeError) {
          toast({ title: "Магазин создан!", description: "Переходим в витрину" });
          localStorage.setItem('seller_onboarding_step1', 'true');
          navigate(`/store/${subdomain}`);
          return;
        } else {
          throw storeError;
        }
      }
      
    } catch (error: any) {
      console.error('Login error:', error);
      toast({ 
        title: "Ошибка входа", 
        description: "Неверный email или пароль",
        variant: "destructive" 
      });
    } finally {
      setLoginLoading(false);
    }
  };

  const handleCustomerAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!customerEmail.trim() || !customerPassword.trim()) {
      toast({ title: "Заполните email и пароль", variant: "destructive" });
      return;
    }

    if (!isValidEmail(customerEmail)) {
      toast({ title: "Введите корректный email", variant: "destructive" });
      return;
    }

    if (!isCustomerLogin && !customerFullName.trim()) {
      toast({ title: "Введите ваше имя", variant: "destructive" });
      return;
    }

    if (!isCustomerLogin && customerPassword.length < 6) {
      toast({ title: "Пароль должен быть минимум 6 символов", variant: "destructive" });
      return;
    }

    const email = customerEmail.trim().toLowerCase();

    setCustomerLoading(true);
    try {
      if (isCustomerLogin) {
        // Login
        const { data: authData, error } = await supabase.auth.signInWithPassword({
          email,
          password: customerPassword
        });

        if (error) throw error;

        // Проверяем/создаём профиль после логина
        if (authData.user) {
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('user_id', authData.user.id)
            .maybeSingle();

          if (!existingProfile) {
            await supabase.from('profiles').insert({
              user_id: authData.user.id,
              email: email,
              full_name: customerFullName || '',
              phone: customerPhone || null,
              role: 'customer'
            });
          }
        }

        toast({ title: "Вход выполнен" });
        if (catalogFromUrl) {
          navigate(`/catalog/${catalogFromUrl}`);
        } else {
          navigate('/customer-dashboard');
        }
      } else {
        // Registration
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password: customerPassword,
          options: {
            emailRedirectTo: `${window.location.origin}/customer-dashboard`,
            data: {
              full_name: customerFullName,
              role: 'customer'
            }
          }
        });

        // Handle "user already exists" - try to login instead
        if (authError) {
          if (authError.message.includes('already registered') || authError.code === 'user_already_exists') {
            const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
              email,
              password: customerPassword
            });
            
            if (loginError) {
              toast({ 
                title: "Пользователь уже зарегистрирован", 
                description: "Неверный пароль. Попробуйте войти с правильным паролем.",
                variant: "destructive" 
              });
              setIsCustomerLogin(true);
              setCustomerLoading(false);
              return;
            }

            if (loginData.user) {
              const { data: existingProfile } = await supabase
                .from('profiles')
                .select('id')
                .eq('user_id', loginData.user.id)
                .maybeSingle();

              if (!existingProfile) {
                await supabase.from('profiles').insert({
                  user_id: loginData.user.id,
                  email: email,
                  full_name: customerFullName || '',
                  phone: customerPhone || null,
                  role: 'customer'
                });
              }
            }
            
            toast({ title: "Вход выполнен", description: "Вы уже были зарегистрированы" });
            if (catalogFromUrl) {
              navigate(`/catalog/${catalogFromUrl}`);
            } else {
              navigate('/customer-dashboard');
            }
            setCustomerLoading(false);
            return;
          }
          throw authError;
        }
        
        if (!authData.user) throw new Error("Ошибка регистрации");

        // Update profile with phone if provided
        await new Promise(resolve => setTimeout(resolve, 500));
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', authData.user.id)
          .single();

        if (profile && customerPhone.trim()) {
          await supabase
            .from('profiles')
            .update({ phone: customerPhone })
            .eq('id', profile.id);
        }

        toast({ 
          title: "Регистрация успешна!", 
          description: "Теперь вы можете войти в личный кабинет" 
        });
        if (catalogFromUrl) {
          navigate(`/catalog/${catalogFromUrl}`);
        } else {
          navigate('/customer-dashboard');
        }
      }
    } catch (error: any) {
      console.error('Customer auth error:', error);
      toast({ 
        title: isCustomerLogin ? "Ошибка входа" : "Ошибка регистрации", 
        description: error.message,
        variant: "destructive" 
      });
    } finally {
      setCustomerLoading(false);
    }
  };

  const handleForgotPassword = async (email: string, role: 'seller' | 'customer') => {
    if (!email.trim()) {
      toast({ title: "Введите email для восстановления", variant: "destructive" });
      return;
    }

    if (!isValidEmail(email)) {
      toast({ title: "Введите корректный email", variant: "destructive" });
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/`,
      });

      if (error) throw error;

      toast({ 
        title: "Письмо отправлено", 
        description: "Проверьте вашу почту для восстановления пароля" 
      });
    } catch (error: any) {
      console.error('Password reset error:', error);
      toast({ 
        title: "Ошибка", 
        description: error.message,
        variant: "destructive" 
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-start md:items-center justify-center p-4 pt-8 md:pt-4">
      <div className="w-full max-w-md">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="register" className="text-xs sm:text-sm">
              <Store className="h-4 w-4 mr-1 hidden sm:inline" />
              Продавец
            </TabsTrigger>
            <TabsTrigger value="login" className="text-xs sm:text-sm">
              <LogIn className="h-4 w-4 mr-1 hidden sm:inline" />
              Войти
            </TabsTrigger>
            <TabsTrigger value="customer" className="text-xs sm:text-sm">
              <User className="h-4 w-4 mr-1 hidden sm:inline" />
              Покупатель
            </TabsTrigger>
          </TabsList>

          <TabsContent value="register">
            <Card>
              <CardHeader>
                <CardTitle>Создать магазин</CardTitle>
                <CardDescription>Заполните форму для регистрации</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="storeName">Название магазина *</Label>
                    <Input
                      id="storeName"
                      placeholder="Мой магазин"
                      value={regStoreName}
                      onChange={(e) => setRegStoreName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="regEmail">Email *</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="regEmail"
                        type="email"
                        placeholder="email@example.com"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Для восстановления пароля</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="regPhone">Номер телефона</Label>
                    <PhoneInput
                      id="regPhone"
                      value={regPhone}
                      onChange={setRegPhone}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="regPassword">Пароль *</Label>
                    <Input
                      id="regPassword"
                      type="password"
                      placeholder="Минимум 6 символов"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={regLoading}>
                    {regLoading ? "Создание..." : "Создать магазин"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="login">
            <Card>
              <CardHeader>
                <CardTitle>Вход</CardTitle>
                <CardDescription>Войдите в свой аккаунт</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="loginEmail">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="loginEmail"
                        type="email"
                        placeholder="email@example.com"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="loginPassword">Пароль</Label>
                    <Input
                      id="loginPassword"
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loginLoading}>
                    {loginLoading ? "Вход..." : "Войти"}
                  </Button>
                  <Button
                    type="button"
                    variant="link"
                    className="w-full text-sm"
                    onClick={() => handleForgotPassword(loginEmail, 'seller')}
                  >
                    Забыли пароль?
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="customer">
            <Card>
              <CardHeader>
                <CardTitle>{isCustomerLogin ? "Вход для покупателя" : "Регистрация покупателя"}</CardTitle>
                <CardDescription>
                  {catalogFromUrl && !isCustomerLogin 
                    ? "Зарегистрируйтесь для просмотра каталога" 
                    : (isCustomerLogin ? "Войдите в личный кабинет" : "Создайте аккаунт покупателя")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCustomerAuth} className="space-y-4">
                  {!isCustomerLogin && (
                    <div className="space-y-2">
                      <Label htmlFor="customerFullName">Ваше имя *</Label>
                      <Input
                        id="customerFullName"
                        placeholder="Иван Иванов"
                        value={customerFullName}
                        onChange={(e) => setCustomerFullName(e.target.value)}
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="customerEmail">Email *</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="customerEmail"
                        type="email"
                        placeholder="email@example.com"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    {!isCustomerLogin && (
                      <p className="text-xs text-muted-foreground">Для восстановления пароля</p>
                    )}
                  </div>
                  {!isCustomerLogin && (
                    <div className="space-y-2">
                      <Label htmlFor="customerPhone">Номер телефона</Label>
                      <PhoneInput
                        id="customerPhone"
                        value={customerPhone}
                        onChange={setCustomerPhone}
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="customerPassword">Пароль {!isCustomerLogin && '*'}</Label>
                    <Input
                      id="customerPassword"
                      type="password"
                      placeholder={isCustomerLogin ? "" : "Минимум 6 символов"}
                      value={customerPassword}
                      onChange={(e) => setCustomerPassword(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={customerLoading}>
                    {customerLoading 
                      ? (isCustomerLogin ? "Вход..." : "Регистрация...") 
                      : (isCustomerLogin ? "Войти" : "Зарегистрироваться")}
                  </Button>
                  {isCustomerLogin && (
                    <Button
                      type="button"
                      variant="link"
                      className="w-full text-sm"
                      onClick={() => handleForgotPassword(customerEmail, 'customer')}
                    >
                      Забыли пароль?
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => setIsCustomerLogin(!isCustomerLogin)}
                  >
                    {isCustomerLogin ? "Нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
