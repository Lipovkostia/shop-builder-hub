import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Store, User, Mail, Lock, Phone, ArrowLeft, Loader2 } from "lucide-react";
import { PhoneInput } from "@/components/ui/phone-input";

type AuthMode = 'login' | 'register' | 'forgot';

const Index = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  const tabFromUrl = searchParams.get("tab");
  const catalogFromUrl = searchParams.get("catalog");
  
  const [activeTab, setActiveTab] = useState<'seller' | 'customer'>(tabFromUrl === "customer" ? "customer" : "seller");
  
  // Seller state
  const [sellerMode, setSellerMode] = useState<AuthMode>('login');
  const [sellerEmail, setSellerEmail] = useState("");
  const [sellerPassword, setSellerPassword] = useState("");
  const [sellerStoreName, setSellerStoreName] = useState("");
  const [sellerPhone, setSellerPhone] = useState("");
  const [sellerLoading, setSellerLoading] = useState(false);
  
  // Customer state
  const [customerMode, setCustomerMode] = useState<AuthMode>(tabFromUrl === "customer" && catalogFromUrl ? 'register' : 'login');
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPassword, setCustomerPassword] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerLoading, setCustomerLoading] = useState(false);

  // Check session on mount
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

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
        }
      } else if (profile.role === 'customer') {
        if (catalogFromUrl) {
          navigate(`/catalog/${catalogFromUrl}`);
        } else {
          navigate('/customer-dashboard');
        }
      }
    };

    checkSession();
  }, [navigate, catalogFromUrl]);

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

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
      .replace(/^-|-$/g, '') || 'store';
  };

  // SELLER HANDLERS
  const handleSellerLogin = async () => {
    if (!sellerEmail.trim() || !sellerPassword.trim()) {
      toast({ title: "Заполните все поля", variant: "destructive" });
      return;
    }
    if (!isValidEmail(sellerEmail)) {
      toast({ title: "Введите корректный email", variant: "destructive" });
      return;
    }

    setSellerLoading(true);
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: sellerEmail.trim().toLowerCase(),
        password: sellerPassword
      });

      if (error) throw error;

      // Check super admin
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

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('user_id', authData.user.id)
        .single();

      if (profile?.role === 'customer') {
        navigate('/customer-dashboard');
        return;
      }

      const { data: store } = await supabase
        .from('stores')
        .select('subdomain')
        .eq('owner_id', profile?.id)
        .limit(1)
        .maybeSingle();

      if (store) {
        navigate(`/store/${store.subdomain}`);
      } else {
        // Auto-create store
        const subdomain = generateSubdomain(sellerEmail.split('@')[0]) + '-' + Date.now().toString(36).slice(-4);
        await supabase.from('stores').insert({
          name: 'Мой магазин',
          subdomain,
          owner_id: profile?.id,
          status: 'active'
        });
        navigate(`/store/${subdomain}`);
      }
    } catch (error: any) {
      toast({ title: "Ошибка входа", description: "Неверный email или пароль", variant: "destructive" });
    } finally {
      setSellerLoading(false);
    }
  };

  const handleSellerRegister = async () => {
    if (!sellerEmail.trim() || !sellerPassword.trim() || !sellerStoreName.trim()) {
      toast({ title: "Заполните обязательные поля", variant: "destructive" });
      return;
    }
    if (!isValidEmail(sellerEmail)) {
      toast({ title: "Введите корректный email", variant: "destructive" });
      return;
    }
    if (sellerPassword.length < 6) {
      toast({ title: "Пароль минимум 6 символов", variant: "destructive" });
      return;
    }

    setSellerLoading(true);
    try {
      const subdomain = generateSubdomain(sellerStoreName) + '-' + Date.now().toString(36).slice(-4);

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: sellerEmail.trim().toLowerCase(),
        password: sellerPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: { full_name: sellerStoreName, role: 'seller' }
        }
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          toast({ title: "Email уже зарегистрирован", description: "Попробуйте войти", variant: "destructive" });
          setSellerMode('login');
          return;
        }
        throw authError;
      }
      if (!authData.user) throw new Error("Ошибка регистрации");

      await new Promise(resolve => setTimeout(resolve, 1000));

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', authData.user.id)
        .single();

      if (profile) {
        if (sellerPhone.trim()) {
          await supabase.from('profiles').update({ phone: sellerPhone }).eq('id', profile.id);
        }

        await supabase.from('stores').insert({
          name: sellerStoreName,
          subdomain,
          owner_id: profile.id,
          status: 'active'
        });
      }

      toast({ title: "Магазин создан!", description: "Переходим в витрину" });
      localStorage.setItem('seller_onboarding_step1', 'true');
      navigate(`/store/${subdomain}`);
    } catch (error: any) {
      toast({ title: "Ошибка регистрации", description: error.message, variant: "destructive" });
    } finally {
      setSellerLoading(false);
    }
  };

  // CUSTOMER HANDLERS
  const handleCustomerLogin = async () => {
    if (!customerEmail.trim() || !customerPassword.trim()) {
      toast({ title: "Заполните все поля", variant: "destructive" });
      return;
    }
    if (!isValidEmail(customerEmail)) {
      toast({ title: "Введите корректный email", variant: "destructive" });
      return;
    }

    setCustomerLoading(true);
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: customerEmail.trim().toLowerCase(),
        password: customerPassword
      });

      if (error) throw error;

      toast({ title: "Вход выполнен" });
      if (catalogFromUrl) {
        navigate(`/catalog/${catalogFromUrl}`);
      } else {
        navigate('/customer-dashboard');
      }
    } catch (error: any) {
      toast({ title: "Ошибка входа", description: "Неверный email или пароль", variant: "destructive" });
    } finally {
      setCustomerLoading(false);
    }
  };

  const handleCustomerRegister = async () => {
    if (!customerEmail.trim() || !customerPassword.trim() || !customerName.trim()) {
      toast({ title: "Заполните обязательные поля", variant: "destructive" });
      return;
    }
    if (!isValidEmail(customerEmail)) {
      toast({ title: "Введите корректный email", variant: "destructive" });
      return;
    }
    if (customerPassword.length < 6) {
      toast({ title: "Пароль минимум 6 символов", variant: "destructive" });
      return;
    }

    setCustomerLoading(true);
    try {
      const email = customerEmail.trim().toLowerCase();
      
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password: customerPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/customer-dashboard`,
          data: { full_name: customerName, role: 'customer' }
        }
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          // Try login
          const { error: loginError } = await supabase.auth.signInWithPassword({
            email,
            password: customerPassword
          });
          if (loginError) {
            toast({ title: "Email уже зарегистрирован", description: "Неверный пароль", variant: "destructive" });
            setCustomerMode('login');
            return;
          }
          toast({ title: "Вход выполнен", description: "Вы уже были зарегистрированы" });
          navigate(catalogFromUrl ? `/catalog/${catalogFromUrl}` : '/customer-dashboard');
          return;
        }
        throw authError;
      }

      if (!authData.user) throw new Error("Ошибка регистрации");

      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (customerPhone.trim()) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', authData.user.id)
          .single();
        
        if (profile) {
          await supabase.from('profiles').update({ phone: customerPhone }).eq('id', profile.id);
        }
      }

      toast({ title: "Регистрация успешна!" });
      navigate(catalogFromUrl ? `/catalog/${catalogFromUrl}` : '/customer-dashboard');
    } catch (error: any) {
      toast({ title: "Ошибка регистрации", description: error.message, variant: "destructive" });
    } finally {
      setCustomerLoading(false);
    }
  };

  // FORGOT PASSWORD
  const handleForgotPassword = async (email: string, setLoading: (v: boolean) => void, setMode: (m: AuthMode) => void) => {
    if (!email.trim()) {
      toast({ title: "Введите email", variant: "destructive" });
      return;
    }
    if (!isValidEmail(email)) {
      toast({ title: "Введите корректный email", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/`,
      });
      if (error) throw error;
      toast({ title: "Письмо отправлено", description: "Проверьте почту для восстановления пароля" });
      setMode('login');
    } catch (error: any) {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const renderAuthForm = (
    type: 'seller' | 'customer',
    mode: AuthMode,
    setMode: (m: AuthMode) => void,
    email: string,
    setEmail: (v: string) => void,
    password: string,
    setPassword: (v: string) => void,
    loading: boolean,
    onLogin: () => void,
    onRegister: () => void,
    extraFields?: React.ReactNode
  ) => {
    if (mode === 'forgot') {
      return (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setMode('login')}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Назад
          </button>
          
          <div className="space-y-2">
            <Label>Email для восстановления</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <Button
            className="w-full"
            disabled={loading}
            onClick={() => handleForgotPassword(email, 
              type === 'seller' ? setSellerLoading : setCustomerLoading, 
              setMode
            )}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Отправить ссылку
          </Button>
        </div>
      );
    }

    const isLogin = mode === 'login';

    return (
      <div className="space-y-4">
        {/* Mode toggle */}
        <div className="flex rounded-lg bg-muted p-1">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-all ${
              isLogin ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Вход
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-all ${
              !isLogin ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Регистрация
          </button>
        </div>

        {/* Extra fields for registration */}
        {!isLogin && extraFields}

        {/* Email */}
        <div className="space-y-1.5">
          <Label className="text-sm">Email {!isLogin && '*'}</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <Label className="text-sm">Пароль {!isLogin && '*'}</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="password"
              placeholder={isLogin ? "••••••" : "Минимум 6 символов"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Submit button */}
        <Button
          className="w-full"
          disabled={loading}
          onClick={isLogin ? onLogin : onRegister}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {isLogin ? 'Войти' : 'Зарегистрироваться'}
        </Button>

        {/* Forgot password link */}
        {isLogin && (
          <button
            type="button"
            onClick={() => setMode('forgot')}
            className="w-full text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            Забыли пароль?
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'seller' | 'customer')} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="seller" className="gap-2">
              <Store className="h-4 w-4" />
              Продавец
            </TabsTrigger>
            <TabsTrigger value="customer" className="gap-2">
              <User className="h-4 w-4" />
              Покупатель
            </TabsTrigger>
          </TabsList>

          <TabsContent value="seller">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">
                  {sellerMode === 'forgot' ? 'Восстановление пароля' : 'Кабинет продавца'}
                </CardTitle>
                <CardDescription>
                  {sellerMode === 'forgot' 
                    ? 'Введите email для получения ссылки'
                    : sellerMode === 'login' 
                      ? 'Войдите для управления магазином' 
                      : 'Создайте свой магазин бесплатно'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {renderAuthForm(
                  'seller',
                  sellerMode,
                  setSellerMode,
                  sellerEmail,
                  setSellerEmail,
                  sellerPassword,
                  setSellerPassword,
                  sellerLoading,
                  handleSellerLogin,
                  handleSellerRegister,
                  // Extra fields for registration
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Название магазина *</Label>
                      <Input
                        placeholder="Мой магазин"
                        value={sellerStoreName}
                        onChange={(e) => setSellerStoreName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Телефон</Label>
                      <PhoneInput
                        value={sellerPhone}
                        onChange={setSellerPhone}
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="customer">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">
                  {customerMode === 'forgot' ? 'Восстановление пароля' : 'Личный кабинет'}
                </CardTitle>
                <CardDescription>
                  {customerMode === 'forgot'
                    ? 'Введите email для получения ссылки'
                    : catalogFromUrl 
                      ? 'Войдите для просмотра каталога' 
                      : customerMode === 'login'
                        ? 'Войдите в личный кабинет'
                        : 'Создайте аккаунт покупателя'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {renderAuthForm(
                  'customer',
                  customerMode,
                  setCustomerMode,
                  customerEmail,
                  setCustomerEmail,
                  customerPassword,
                  setCustomerPassword,
                  customerLoading,
                  handleCustomerLogin,
                  handleCustomerRegister,
                  // Extra fields for registration
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Ваше имя *</Label>
                      <Input
                        placeholder="Иван Иванов"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Телефон</Label>
                      <PhoneInput
                        value={customerPhone}
                        onChange={setCustomerPhone}
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
