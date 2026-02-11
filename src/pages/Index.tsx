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
import LandingProductTable from "@/components/landing/LandingProductTable";
import LandingInfoBlocks from "@/components/landing/LandingInfoBlocks";
import LandingDemoCart from "@/components/landing/LandingDemoCart";

interface DemoProduct {
  id: string;
  name: string;
  price?: number;
  unit?: string;
  sku?: string;
  image?: string;
  category?: string;
  images_count?: number;
}

type AuthMode = 'login' | 'register' | 'forgot' | 'forgot-phone';
type LoginMethod = 'email' | 'phone';

const Index = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  const tabFromUrl = searchParams.get("tab");
  const catalogFromUrl = searchParams.get("catalog");
  
  const [activeTab, setActiveTab] = useState<'seller' | 'customer'>(tabFromUrl === "customer" ? "customer" : "seller");

  // Demo cart state
  const [demoItems, setDemoItems] = useState<DemoProduct[]>(() => {
    try {
      const saved = localStorage.getItem('landing_demo_cart');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem('landing_demo_cart', JSON.stringify(demoItems));
  }, [demoItems]);

  const handleAddToCatalog = (products: { id: string; name: string; price?: number; unit?: string; sku?: string }[]) => {
    setDemoItems(prev => {
      const existingIds = new Set(prev.map(i => i.id));
      const newItems = products.filter(p => !existingIds.has(p.id));
      return [...prev, ...newItems];
    });
  };

  const handleRemoveFromCart = (id: string) => {
    setDemoItems(prev => prev.filter(i => i.id !== id));
  };

  const handleClearCart = () => {
    setDemoItems([]);
  };
  
  // Seller state
  const [sellerMode, setSellerMode] = useState<AuthMode>('login');
  const [sellerLoginMethod, setSellerLoginMethod] = useState<LoginMethod>('email');
  const [sellerEmail, setSellerEmail] = useState("");
  const [sellerPassword, setSellerPassword] = useState("");
  const [sellerStoreName, setSellerStoreName] = useState("");
  const [sellerPhone, setSellerPhone] = useState("");
  const [sellerLoginPhone, setSellerLoginPhone] = useState("");
  const [sellerLoading, setSellerLoading] = useState(false);
  
  // Customer state
  const [customerMode, setCustomerMode] = useState<AuthMode>(tabFromUrl === "customer" && catalogFromUrl ? 'register' : 'login');
  const [customerLoginMethod, setCustomerLoginMethod] = useState<LoginMethod>('email');
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPassword, setCustomerPassword] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerLoginPhone, setCustomerLoginPhone] = useState("");
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

  // Normalize phone to digits only
  const normalizePhone = (phone: string) => phone.replace(/\D/g, '');

  // Convert phone to pseudo-email for legacy users
  const phoneToPseudoEmail = (phone: string) => `${normalizePhone(phone)}@store.local`;

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

  // Phone login handler for sellers
  const handleSellerPhoneLogin = async () => {
    const digits = normalizePhone(sellerLoginPhone);
    if (!digits || digits.length < 10) {
      toast({ title: "Введите корректный номер телефона", variant: "destructive" });
      return;
    }
    if (!sellerPassword.trim()) {
      toast({ title: "Введите пароль", variant: "destructive" });
      return;
    }

    setSellerLoading(true);
    try {
      const pseudoEmail = phoneToPseudoEmail(sellerLoginPhone);
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: pseudoEmail,
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
      }
    } catch (error: any) {
      toast({ title: "Ошибка входа", description: "Неверный телефон или пароль", variant: "destructive" });
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

  // Phone login handler for customers
  const handleCustomerPhoneLogin = async () => {
    const digits = normalizePhone(customerLoginPhone);
    if (!digits || digits.length < 10) {
      toast({ title: "Введите корректный номер телефона", variant: "destructive" });
      return;
    }
    if (!customerPassword.trim()) {
      toast({ title: "Введите пароль", variant: "destructive" });
      return;
    }

    setCustomerLoading(true);
    try {
      const pseudoEmail = phoneToPseudoEmail(customerLoginPhone);
      const { error } = await supabase.auth.signInWithPassword({
        email: pseudoEmail,
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
      toast({ title: "Ошибка входа", description: "Неверный телефон или пароль", variant: "destructive" });
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
        redirectTo: `${window.location.origin}/reset-password`,
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

  const renderLoginMethodToggle = (method: LoginMethod, setMethod: (m: LoginMethod) => void) => (
    <div className="flex rounded-md bg-muted/50 p-0.5 mb-3">
      <button
        type="button"
        onClick={() => setMethod('email')}
        className={`flex-1 py-1.5 px-2 text-xs font-medium rounded transition-all flex items-center justify-center gap-1.5 ${
          method === 'email' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <Mail className="h-3.5 w-3.5" />
        Email
      </button>
      <button
        type="button"
        onClick={() => setMethod('phone')}
        className={`flex-1 py-1.5 px-2 text-xs font-medium rounded transition-all flex items-center justify-center gap-1.5 ${
          method === 'phone' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <Phone className="h-3.5 w-3.5" />
        Телефон
      </button>
    </div>
  );

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
    onPhoneLogin: () => void,
    onRegister: () => void,
    loginMethod: LoginMethod,
    setLoginMethod: (m: LoginMethod) => void,
    loginPhone: string,
    setLoginPhone: (v: string) => void,
    extraFields?: React.ReactNode
  ) => {
    // Forgot password for phone users
    if (mode === 'forgot-phone') {
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
          
          <div className="bg-muted/50 border border-border rounded-lg p-4 text-center">
            <Phone className="h-8 w-8 text-primary mx-auto mb-2" />
            <p className="text-sm text-foreground font-medium mb-1">
              Восстановление по телефону
            </p>
            <p className="text-xs text-muted-foreground">
              Для сброса пароля обратитесь к администратору магазина или напишите в поддержку
            </p>
          </div>
          
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setMode('login')}
          >
            Вернуться ко входу
          </Button>
        </div>
      );
    }

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

        {/* Login method toggle - only for login mode */}
        {isLogin && renderLoginMethodToggle(loginMethod, setLoginMethod)}

        {/* Email or Phone field based on login method */}
        {isLogin ? (
          loginMethod === 'email' ? (
            <div className="space-y-1.5">
              <Label className="text-sm">Email</Label>
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
          ) : (
            <div className="space-y-1.5">
              <Label className="text-sm">Номер телефона</Label>
              <PhoneInput
                value={loginPhone}
                onChange={setLoginPhone}
              />
            </div>
          )
        ) : (
          <div className="space-y-1.5">
            <Label className="text-sm">Email *</Label>
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
        )}

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
          onClick={isLogin ? (loginMethod === 'email' ? onLogin : onPhoneLogin) : onRegister}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {isLogin ? 'Войти' : 'Зарегистрироваться'}
        </Button>

        {/* Forgot password link */}
        {isLogin && (
          <button
            type="button"
            onClick={() => setMode(loginMethod === 'phone' ? 'forgot-phone' : 'forgot')}
            className="w-full text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            Забыли пароль?
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 p-4 pt-6">
      <div className="w-full max-w-7xl mx-auto">
        {/* 3-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          {/* Left column: info blocks + product list */}
          <div className="flex flex-col gap-3">
            <LandingInfoBlocks />
            <div className="rounded-lg border bg-card overflow-hidden max-h-[calc(100vh-260px)]">
              <LandingProductTable onAddToCatalog={handleAddToCatalog} />
            </div>
          </div>

          {/* Middle column: demo cart */}
          <div className="lg:max-h-[calc(100vh-80px)]">
            <LandingDemoCart
              items={demoItems}
              onRemove={handleRemoveFromCart}
              onClear={handleClearCart}
            />
          </div>

          {/* Right column: auth form */}
          <div>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'seller' | 'customer')} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-3">
                <TabsTrigger value="seller" className="gap-2 text-xs">
                  <Store className="h-3.5 w-3.5" />
                  Продавец
                </TabsTrigger>
                <TabsTrigger value="customer" className="gap-2 text-xs">
                  <User className="h-3.5 w-3.5" />
                  Покупатель
                </TabsTrigger>
              </TabsList>

              <TabsContent value="seller">
                <Card>
                  <CardHeader className="pb-3 pt-4 px-4">
                    <CardTitle className="text-base">
                      {sellerMode === 'forgot' || sellerMode === 'forgot-phone' ? 'Восстановление пароля' : 'Кабинет продавца'}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {sellerMode === 'forgot' 
                        ? 'Введите email для получения ссылки'
                        : sellerMode === 'forgot-phone'
                          ? 'Свяжитесь с поддержкой'
                          : sellerMode === 'login' 
                            ? 'Войдите для управления магазином' 
                            : 'Создайте свой магазин бесплатно'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
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
                      handleSellerPhoneLogin,
                      handleSellerRegister,
                      sellerLoginMethod,
                      setSellerLoginMethod,
                      sellerLoginPhone,
                      setSellerLoginPhone,
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
                  <CardHeader className="pb-3 pt-4 px-4">
                    <CardTitle className="text-base">
                      {customerMode === 'forgot' || customerMode === 'forgot-phone' ? 'Восстановление пароля' : 'Личный кабинет'}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {customerMode === 'forgot'
                        ? 'Введите email для получения ссылки'
                        : customerMode === 'forgot-phone'
                          ? 'Свяжитесь с поддержкой'
                          : catalogFromUrl 
                            ? 'Войдите для просмотра каталога' 
                            : customerMode === 'login'
                              ? 'Войдите в личный кабинет'
                              : 'Создайте аккаунт покупателя'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
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
                      handleCustomerPhoneLogin,
                      handleCustomerRegister,
                      customerLoginMethod,
                      setCustomerLoginMethod,
                      customerLoginPhone,
                      setCustomerLoginPhone,
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
      </div>
    </div>
  );
};

export default Index;
