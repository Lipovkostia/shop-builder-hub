import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Store, LogIn, Shield, User } from "lucide-react";
import { PhoneInput } from "@/components/ui/phone-input";
import slideCatalogs from "@/assets/slide-catalogs.png";

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
  
  // Carousel state
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slideCount, setSlideCount] = useState(0);
  
  // Подписка на смену слайда
  useEffect(() => {
    if (!carouselApi) return;
    
    setSlideCount(carouselApi.scrollSnapList().length);
    setCurrentSlide(carouselApi.selectedScrollSnap());
    
    carouselApi.on("select", () => {
      setCurrentSlide(carouselApi.selectedScrollSnap());
    });
  }, [carouselApi]);
  // Registration form state
  const [regStoreName, setRegStoreName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  
  // Login form state
  const [loginPhone, setLoginPhone] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  
  // Super admin form state
  const [adminLogin, setAdminLogin] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);

  // Customer form state
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerPassword, setCustomerPassword] = useState("");
  const [customerFullName, setCustomerFullName] = useState("");
  const [customerLoading, setCustomerLoading] = useState(false);
  const [isCustomerLogin, setIsCustomerLogin] = useState(tabFromUrl !== "customer"); // Start in register mode if coming from catalog link

  // Switch to registration mode when coming from catalog link
  useEffect(() => {
    if (tabFromUrl === "customer" && catalogFromUrl) {
      setIsCustomerLogin(false); // Show registration form
    }
  }, [tabFromUrl, catalogFromUrl]);
  // Format phone to email for Supabase auth
  const phoneToEmail = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, "");
    return `${cleanPhone}@store.local`;
  };

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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!regStoreName.trim() || !regPhone.trim() || !regPassword.trim()) {
      toast({ title: "Заполните все поля", variant: "destructive" });
      return;
    }

    setRegLoading(true);
    try {
      const email = phoneToEmail(regPhone);
      const subdomain = generateSubdomain(regStoreName);

      // Register user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
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

      // Update profile with phone
      await supabase
        .from('profiles')
        .update({ phone: regPhone })
        .eq('id', profile.id);

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
      toast({ 
        title: "Ошибка регистрации", 
        description: error.message,
        variant: "destructive" 
      });
    } finally {
      setRegLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!loginPhone.trim() || !loginPassword.trim()) {
      toast({ title: "Заполните все поля", variant: "destructive" });
      return;
    }

    setLoginLoading(true);
    try {
      const email = phoneToEmail(loginPhone);

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password: loginPassword
      });

      if (authError) throw authError;

      // Get user's store
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', authData.user.id)
        .single();

      if (profile) {
        const { data: store } = await supabase
          .from('stores')
          .select('subdomain')
          .eq('owner_id', profile.id)
          .single();

         if (store) {
           navigate(`/store/${store.subdomain}`);
           return;
         }
      }

      navigate('/dashboard');
      
    } catch (error: any) {
      console.error('Login error:', error);
      toast({ 
        title: "Ошибка входа", 
        description: "Неверный телефон или пароль",
        variant: "destructive" 
      });
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSuperAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Temporary super admin credentials
    if (adminLogin === "1" && adminPassword === "1") {
      setAdminLoading(true);
      // Store super admin session in localStorage temporarily
      localStorage.setItem('temp_super_admin', 'true');
      toast({ title: "Вход выполнен" });
      navigate('/super-admin');
      setAdminLoading(false);
    } else {
      toast({ 
        title: "Неверные данные", 
        description: "Проверьте логин и пароль",
        variant: "destructive" 
      });
    }
  };

  const handleCustomerAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!customerPhone.trim() || !customerPassword.trim()) {
      toast({ title: "Заполните все поля", variant: "destructive" });
      return;
    }

    if (!isCustomerLogin && !customerFullName.trim()) {
      toast({ title: "Введите ваше имя", variant: "destructive" });
      return;
    }

    const email = phoneToEmail(customerPhone);

    setCustomerLoading(true);
    try {
      if (isCustomerLogin) {
        // Login
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password: customerPassword
        });

        if (error) throw error;

        toast({ title: "Вход выполнен" });
        // If coming from catalog link, redirect to catalog access page
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
            // User exists, try to login
            const { error: loginError } = await supabase.auth.signInWithPassword({
              email,
              password: customerPassword
            });
            
            if (loginError) {
              toast({ 
                title: "Пользователь уже зарегистрирован", 
                description: "Неверный пароль. Попробуйте войти с правильным паролем.",
                variant: "destructive" 
              });
              setIsCustomerLogin(true); // Switch to login mode
              setCustomerLoading(false);
              return;
            }
            
            toast({ title: "Вход выполнен", description: "Вы уже были зарегистрированы" });
            // If coming from catalog link, redirect to catalog access page
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

        // Update profile with phone
        await new Promise(resolve => setTimeout(resolve, 500));
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', authData.user.id)
          .single();

        if (profile) {
          await supabase
            .from('profiles')
            .update({ phone: customerPhone })
            .eq('id', profile.id);
        }

        toast({ 
          title: "Регистрация успешна!", 
          description: "Теперь вы можете войти в личный кабинет" 
        });
        // If coming from catalog link, redirect to catalog access page to grant access
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-start md:items-center justify-center p-4 pt-8 md:pt-4">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <Carousel
            setApi={setCarouselApi}
            opts={{ loop: true }}
            plugins={[Autoplay({ delay: 5000, stopOnInteraction: true })]}
            className="w-full"
          >
            <CarouselContent>
              {/* Слайд 1 */}
              <CarouselItem>
                <div className="flex flex-col">
                  <div className="aspect-[16/9] w-full overflow-hidden rounded-lg mb-4">
                    <img 
                      src={slideCatalogs} 
                      alt="Каталоги" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className="text-left text-lg font-medium text-foreground">
                    Создавайте уникальные каталоги для разных покупателей
                  </p>
                </div>
              </CarouselItem>
              
              {/* Слайд 2 */}
              <CarouselItem>
                <div className="flex flex-col">
                  <div className="aspect-[16/9] w-full overflow-hidden rounded-lg mb-4 bg-muted flex items-center justify-center">
                    <span className="text-4xl">📊</span>
                  </div>
                  <p className="text-left text-lg font-medium text-foreground">
                    Покупатель всегда видит индивидуальную актуальную цену и наличие
                  </p>
                </div>
              </CarouselItem>
              
              {/* Слайд 3 */}
              <CarouselItem>
                <div className="flex flex-col">
                  <div className="aspect-[16/9] w-full overflow-hidden rounded-lg mb-4 bg-muted flex items-center justify-center">
                    <span className="text-4xl">🛒</span>
                  </div>
                  <p className="text-left text-lg font-medium text-foreground">
                    Заказ упаковкой или штучно в 1 клик
                  </p>
                </div>
              </CarouselItem>
              
              {/* Слайд 4 */}
              <CarouselItem>
                <div className="flex flex-col">
                  <div className="aspect-[16/9] w-full overflow-hidden rounded-lg mb-4 bg-muted flex items-center justify-center">
                    <span className="text-4xl">🔄</span>
                  </div>
                  <p className="text-left text-lg font-medium text-foreground">
                    Повторить заказ в 1 клик
                  </p>
                </div>
              </CarouselItem>
            </CarouselContent>
          </Carousel>
          
          {/* Индикаторы */}
          <div className="flex justify-center gap-2 mt-4">
            {Array.from({ length: slideCount }).map((_, index) => (
              <button
                key={index}
                onClick={() => carouselApi?.scrollTo(index)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentSlide ? "bg-primary" : "bg-muted-foreground/30"
                }`}
                aria-label={`Перейти к слайду ${index + 1}`}
              />
            ))}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
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
            <TabsTrigger value="admin" className="text-xs sm:text-sm">
              <Shield className="h-4 w-4 mr-1 hidden sm:inline" />
              Админ
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
                    <Label htmlFor="storeName">Название магазина</Label>
                    <Input
                      id="storeName"
                      placeholder="Мой магазин"
                      value={regStoreName}
                      onChange={(e) => setRegStoreName(e.target.value)}
                    />
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
                    <Label htmlFor="regPassword">Пароль</Label>
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
                <CardTitle>Вход в магазин</CardTitle>
                <CardDescription>Войдите в свою админ-панель</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="loginPhone">Номер телефона</Label>
                    <PhoneInput
                      id="loginPhone"
                      value={loginPhone}
                      onChange={setLoginPhone}
                    />
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
                      <Label htmlFor="customerFullName">Ваше имя</Label>
                      <Input
                        id="customerFullName"
                        placeholder="Иван Иванов"
                        value={customerFullName}
                        onChange={(e) => setCustomerFullName(e.target.value)}
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="customerPhone">Номер телефона</Label>
                    <PhoneInput
                      id="customerPhone"
                      value={customerPhone}
                      onChange={setCustomerPhone}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="customerPassword">Пароль</Label>
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

          <TabsContent value="admin">
            <Card>
              <CardHeader>
                <CardTitle>Супер-админ</CardTitle>
                <CardDescription>Вход в панель управления</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSuperAdminLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="adminLogin">Логин</Label>
                    <Input
                      id="adminLogin"
                      value={adminLogin}
                      onChange={(e) => setAdminLogin(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adminPassword">Пароль</Label>
                    <Input
                      id="adminPassword"
                      type="password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={adminLoading}>
                    {adminLoading ? "Вход..." : "Войти как супер-админ"}
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
