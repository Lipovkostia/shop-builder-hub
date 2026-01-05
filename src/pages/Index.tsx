import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Store, LogIn, Shield } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
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

      toast({ title: "Магазин создан!", description: "Вы можете войти в админ-панель" });
      navigate(`/store/${subdomain}/admin`);
      
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
          navigate(`/store/${store.subdomain}/admin`);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Маркетплейс</h1>
          <p className="text-muted-foreground mt-2">Создайте свой магазин за минуту</p>
        </div>

        <Tabs defaultValue="register" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="register" className="text-xs sm:text-sm">
              <Store className="h-4 w-4 mr-1 hidden sm:inline" />
              Создать
            </TabsTrigger>
            <TabsTrigger value="login" className="text-xs sm:text-sm">
              <LogIn className="h-4 w-4 mr-1 hidden sm:inline" />
              Войти
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
                    <Input
                      id="regPhone"
                      type="tel"
                      placeholder="+7 999 123 45 67"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
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
                    <Input
                      id="loginPhone"
                      type="tel"
                      placeholder="+7 999 123 45 67"
                      value={loginPhone}
                      onChange={(e) => setLoginPhone(e.target.value)}
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
