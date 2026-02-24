import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Search, ExternalLink, Copy, ChevronLeft, ChevronRight, Shield, Store, Users, User, Image, LayoutDashboard, LogOut, Mail, Lock, Loader2, Package, Sparkles, Link2, Globe, Bot, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import SlidesManager from '@/components/admin/SlidesManager';
import SuperAdminDashboard from '@/components/admin/SuperAdminDashboard';
import ProductMatchingSection from '@/components/admin/ProductMatchingSection';
import FeaturedProductsManager from '@/components/admin/FeaturedProductsManager';
import MegacatalogManager from '@/components/admin/MegacatalogManager';
import TelegramBotSection from '@/components/admin/TelegramBotSection';

interface StoreWithCounts {
  id: string;
  name: string;
  subdomain: string;
  status: 'pending' | 'active' | 'suspended';
  created_at: string;
  owner_email: string;
  owner_name: string | null;
  products_count: number;
  customers_count: number;
}

interface CustomerProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  phone: string | null;
  email: string;
  role?: string;
  created_at: string;
  stores: { store_name: string; store_id: string }[];
}

interface StoreOption {
  id: string;
  name: string;
  subdomain: string;
}

interface ProductWithStore {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  quantity: number;
  created_at: string;
  is_active: boolean;
  store_id: string;
  store_name: string;
  store_subdomain: string;
  is_new_today: boolean;
}

const ITEMS_PER_PAGE = 10;

export default function SuperAdmin() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, session, isSuperAdmin, loading: authLoading, signIn, signOut } = useAuth();
  
  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Stores state
  const [stores, setStores] = useState<StoreWithCounts[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Customers state
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [customersSearch, setCustomersSearch] = useState('');
  const [customersPage, setCustomersPage] = useState(1);
  const [customersTotal, setCustomersTotal] = useState(0);
  const [customersRoleFilter, setCustomersRoleFilter] = useState('all');

  // Assign customer to store dialog
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignCustomer, setAssignCustomer] = useState<CustomerProfile | null>(null);
  const [allStores, setAllStores] = useState<StoreOption[]>([]);
  const [assignStoreId, setAssignStoreId] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);

  // Products state
  const [products, setProducts] = useState<ProductWithStore[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsSearch, setProductsSearch] = useState('');
  const [productsPage, setProductsPage] = useState(1);
  const [productsTotal, setProductsTotal] = useState(0);

  useEffect(() => {
    if (isSuperAdmin && activeTab === 'stores') {
      fetchStores();
    }
  }, [isSuperAdmin, currentPage, searchQuery, activeTab, session]);

  useEffect(() => {
    if (isSuperAdmin && activeTab === 'customers') {
      fetchCustomers();
    }
  }, [isSuperAdmin, customersPage, customersSearch, customersRoleFilter, activeTab, session]);

  // Fetch all stores for the assign dialog
  useEffect(() => {
    if (isSuperAdmin && assignDialogOpen && allStores.length === 0) {
      fetchAllStores();
    }
  }, [isSuperAdmin, assignDialogOpen]);

  useEffect(() => {
    if (isSuperAdmin && activeTab === 'products') {
      fetchProducts();
    }
  }, [isSuperAdmin, productsPage, productsSearch, activeTab, session]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);

    try {
      const { error } = await signIn(email, password);
      
      if (error) {
        setLoginError(error.message || 'Ошибка входа');
        return;
      }
      
      // Auth state will update automatically via useAuth
      // isSuperAdmin check will happen after auth state updates
    } catch (err) {
      setLoginError('Произошла ошибка при входе');
    } finally {
      setLoginLoading(false);
    }
  };

  const fetchStores = async () => {
    if (!session?.access_token) return;
    
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        action: 'stores',
        page: currentPage.toString(),
        limit: ITEMS_PER_PAGE.toString(),
      });
      if (searchQuery) {
        params.set('search', searchQuery);
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/super-admin-stats?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch stores');
      }

      const result = await response.json();
      setStores(result.data || []);
      setTotalCount(result.total || 0);
    } catch (error: any) {
      console.error('Error fetching stores:', error);
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось загрузить список магазинов',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCustomers = async () => {
    if (!session?.access_token) return;
    
    setCustomersLoading(true);
    try {
      const params = new URLSearchParams({
        action: 'customers',
        page: customersPage.toString(),
        limit: ITEMS_PER_PAGE.toString(),
        role: customersRoleFilter,
      });
      if (customersSearch) {
        params.set('search', customersSearch);
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/super-admin-stats?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch customers');
      }

      const result = await response.json();
      setCustomers(result.data || []);
      setCustomersTotal(result.total || 0);
    } catch (error: any) {
      console.error('Error fetching customers:', error);
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось загрузить список покупателей',
        variant: 'destructive',
      });
    } finally {
      setCustomersLoading(false);
    }
  };

  const fetchProducts = async () => {
    if (!session?.access_token) return;
    
    setProductsLoading(true);
    try {
      const params = new URLSearchParams({
        action: 'products',
        page: productsPage.toString(),
        limit: ITEMS_PER_PAGE.toString(),
      });
      if (productsSearch) {
        params.set('search', productsSearch);
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/super-admin-stats?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch products');
      }

      const result = await response.json();
      setProducts(result.data || []);
      setProductsTotal(result.total || 0);
    } catch (error: any) {
      console.error('Error fetching products:', error);
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось загрузить список товаров',
        variant: 'destructive',
      });
    } finally {
      setProductsLoading(false);
    }
  };

  const fetchAllStores = async () => {
    if (!session?.access_token) return;
    try {
      const params = new URLSearchParams({ action: 'stores', page: '1', limit: '200' });
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/super-admin-stats?${params.toString()}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );
      if (response.ok) {
        const result = await response.json();
        setAllStores((result.data || []).map((s: any) => ({ id: s.id, name: s.name, subdomain: s.subdomain })));
      }
    } catch (e) {
      console.error('Error fetching stores for assign dialog:', e);
    }
  };

  const linkCustomerToStore = async () => {
    if (!session?.access_token || !assignCustomer || !assignStoreId) return;
    setAssignLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/super-admin-stats?action=link_customer`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            profile_id: assignCustomer.id,
            store_id: assignStoreId,
          }),
        }
      );

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to link customer');
      }

      toast({ title: 'Успешно', description: 'Покупатель привязан к магазину' });
      setAssignDialogOpen(false);
      setAssignCustomer(null);
      setAssignStoreId('');
      fetchCustomers();
    } catch (error: any) {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    } finally {
      setAssignLoading(false);
    }
  };

  const unlinkCustomerFromStore = async (customer: CustomerProfile, storeId: string) => {
    if (!session?.access_token) return;
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/super-admin-stats?action=link_customer`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            profile_id: customer.id,
            store_id: storeId,
            unlink: true,
          }),
        }
      );

      if (response.ok) {
        toast({ title: 'Успешно', description: 'Привязка удалена' });
        fetchCustomers();
      }
    } catch (error: any) {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Скопировано',
      description: 'ID магазина скопирован в буфер обмена',
    });
  };

  const openStoreAdmin = (subdomain: string) => {
    navigate(`/store/${subdomain}/admin`);
  };

  const openCustomerDashboard = (userId: string) => {
    localStorage.setItem('impersonate_customer_id', userId);
    navigate('/customer-dashboard');
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const customersTotalPages = Math.ceil(customersTotal / ITEMS_PER_PAGE);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-500">Активен</Badge>;
      case 'pending':
        return <Badge variant="secondary">Ожидает</Badge>;
      case 'suspended':
        return <Badge variant="destructive">Заблокирован</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleLogout = async () => {
    await signOut();
    localStorage.removeItem('impersonate_customer_id');
  };

  // Show loading while auth is initializing
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show login form if not authenticated or not super admin
  if (!user || !isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-full w-fit">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Панель супер-администратора</CardTitle>
            <CardDescription>
              Войдите с учётной записью супер-администратора
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Пароль</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              
              {loginError && (
                <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                  {loginError}
                </div>
              )}

              {user && !isSuperAdmin && (
                <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-md">
                  Вы вошли как {user.email}, но у вас нет прав супер-администратора.
                </div>
              )}
              
              <Button type="submit" className="w-full" disabled={loginLoading}>
                {loginLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Вход...
                  </>
                ) : (
                  'Войти'
                )}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <Link to="/" className="text-sm text-muted-foreground hover:text-primary">
                ← Вернуться на главную
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">Панель супер-администратора</h1>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Выйти
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="dashboard" className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Дашборд</span>
            </TabsTrigger>
            <TabsTrigger value="stores" className="gap-2">
              <Store className="h-4 w-4" />
              <span className="hidden sm:inline">Магазины</span>
            </TabsTrigger>
            <TabsTrigger value="products" className="gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Товары</span>
            </TabsTrigger>
            <TabsTrigger value="customers" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Покупатели</span>
            </TabsTrigger>
            <TabsTrigger value="matching" className="gap-2">
              <Link2 className="h-4 w-4" />
              <span className="hidden sm:inline">Сопоставление</span>
            </TabsTrigger>
            <TabsTrigger value="featured" className="gap-2">
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Витрина</span>
            </TabsTrigger>
            <TabsTrigger value="slides" className="gap-2">
              <Image className="h-4 w-4" />
              <span className="hidden sm:inline">Слайды</span>
            </TabsTrigger>
            <TabsTrigger value="megacatalog" className="gap-2">
              <Globe className="h-4 w-4" />
              <span className="hidden sm:inline">Мегакаталог</span>
            </TabsTrigger>
            <TabsTrigger value="telegram" className="gap-2">
              <Bot className="h-4 w-4" />
              <span className="hidden sm:inline">Telegram</span>
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            <SuperAdminDashboard onNavigate={setActiveTab} />
          </TabsContent>

          {/* Matching Tab */}
          <TabsContent value="matching" className="space-y-6">
            <ProductMatchingSection />
          </TabsContent>

          {/* Stores Tab */}
          <TabsContent value="stores" className="space-y-6">
            {/* Search and stats */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Поиск по названию или email..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-10"
                />
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Store className="h-4 w-4" />
                <span>Всего магазинов: <strong className="text-foreground">{totalCount}</strong></span>
              </div>
            </div>

            {/* Stores table */}
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Магазин</TableHead>
                    <TableHead>ID магазина</TableHead>
                    <TableHead>Email владельца</TableHead>
                    <TableHead className="text-center">Товаров</TableHead>
                    <TableHead className="text-center">Покупателей</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center">
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : stores.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                        {searchQuery ? 'Магазины не найдены' : 'Нет магазинов'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    stores.map((store) => (
                      <TableRow key={store.id}>
                        <TableCell>
                          <button
                            onClick={() => openStoreAdmin(store.subdomain)}
                            className="font-medium text-primary hover:underline flex items-center gap-1"
                          >
                            {store.name}
                            <ExternalLink className="h-3 w-3" />
                          </button>
                          <div className="text-xs text-muted-foreground">{store.subdomain}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                              {store.id.slice(0, 8)}...
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyToClipboard(store.id)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>{store.owner_email}</div>
                          {store.owner_name && (
                            <div className="text-xs text-muted-foreground">{store.owner_name}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-medium">{store.products_count}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-medium">{store.customers_count}</span>
                        </TableCell>
                        <TableCell>{getStatusBadge(store.status)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openStoreAdmin(store.subdomain)}
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            Открыть
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <div className="text-sm text-muted-foreground">
                    Страница {currentPage} из {totalPages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Customers Tab */}
          <TabsContent value="customers" className="space-y-6">
            {/* Search, filters and stats */}
            <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Поиск по имени, телефону или email..."
                  value={customersSearch}
                  onChange={(e) => {
                    setCustomersSearch(e.target.value);
                    setCustomersPage(1);
                  }}
                  className="pl-10"
                />
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={customersRoleFilter}
                  onChange={(e) => { setCustomersRoleFilter(e.target.value); setCustomersPage(1); }}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">Все роли</option>
                  <option value="customer">Покупатели</option>
                  <option value="seller">Продавцы</option>
                </select>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>Всего: <strong className="text-foreground">{customersTotal}</strong></span>
              </div>
            </div>

            {/* Customers table */}
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Имя</TableHead>
                    <TableHead>Телефон</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Роль</TableHead>
                    <TableHead>Магазины (клиент)</TableHead>
                    <TableHead>Дата регистрации</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customersLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center">
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : customers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                        {customersSearch ? 'Не найдено' : 'Нет пользователей'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    customers.map((customer) => (
                      <TableRow key={customer.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="h-4 w-4 text-primary" />
                            </div>
                            <span className="font-medium">{customer.full_name || 'Без имени'}</span>
                          </div>
                        </TableCell>
                        <TableCell>{customer.phone || '—'}</TableCell>
                        <TableCell className="text-xs">{customer.email}</TableCell>
                        <TableCell>
                          <Badge variant={customer.role === 'seller' ? 'default' : 'secondary'} className="text-xs">
                            {customer.role === 'seller' ? 'Продавец' : 'Покупатель'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {customer.stores.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {customer.stores.map((store, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs flex items-center gap-1">
                                  {store.store_name}
                                  <button
                                    onClick={() => unlinkCustomerFromStore(customer, store.store_id)}
                                    className="ml-0.5 hover:text-destructive"
                                    title="Отвязать"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(customer.created_at).toLocaleDateString('ru-RU')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setAssignCustomer(customer);
                                setAssignStoreId('');
                                setAssignDialogOpen(true);
                              }}
                              title="Привязать к магазину"
                            >
                              <UserPlus className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openCustomerDashboard(customer.user_id)}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {/* Pagination */}
              {customersTotalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <div className="text-sm text-muted-foreground">
                    Страница {customersPage} из {customersTotalPages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCustomersPage(p => Math.max(1, p - 1))}
                      disabled={customersPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCustomersPage(p => Math.min(customersTotalPages, p + 1))}
                      disabled={customersPage === customersTotalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Assign customer to store dialog */}
            {assignDialogOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                <div className="bg-card border rounded-lg shadow-lg p-6 w-full max-w-md mx-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Привязать к магазину</h3>
                    <button onClick={() => setAssignDialogOpen(false)} className="text-muted-foreground hover:text-foreground">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  
                  <p className="text-sm text-muted-foreground mb-4">
                    Пользователь: <strong>{assignCustomer?.full_name || assignCustomer?.email}</strong>
                    {assignCustomer?.phone && ` (${assignCustomer.phone})`}
                  </p>

                  <div className="space-y-3">
                    <Label>Выберите магазин</Label>
                    <select
                      value={assignStoreId}
                      onChange={(e) => setAssignStoreId(e.target.value)}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">— Выберите —</option>
                      {allStores
                        .filter(s => !assignCustomer?.stores.some(cs => cs.store_id === s.id))
                        .map(s => (
                          <option key={s.id} value={s.id}>{s.name} ({s.subdomain})</option>
                        ))
                      }
                    </select>
                  </div>

                  <div className="flex justify-end gap-2 mt-6">
                    <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
                      Отмена
                    </Button>
                    <Button onClick={linkCustomerToStore} disabled={!assignStoreId || assignLoading}>
                      {assignLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
                      Привязать
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Products Tab */}
          <TabsContent value="products" className="space-y-6">
            {/* Search and stats */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Поиск по названию или артикулу..."
                  value={productsSearch}
                  onChange={(e) => {
                    setProductsSearch(e.target.value);
                    setProductsPage(1);
                  }}
                  className="pl-10"
                />
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Package className="h-4 w-4" />
                <span>Всего товаров: <strong className="text-foreground">{productsTotal}</strong></span>
              </div>
            </div>

            {/* Products table */}
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Название</TableHead>
                    <TableHead>Артикул</TableHead>
                    <TableHead className="text-right">Цена</TableHead>
                    <TableHead className="text-center">Кол-во</TableHead>
                    <TableHead>Магазин</TableHead>
                    <TableHead>Добавлен</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productsLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center">
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : products.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                        {productsSearch ? 'Товары не найдены' : 'Нет товаров'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    products.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{product.name}</span>
                            {product.is_new_today && (
                              <Badge variant="default" className="bg-green-500 text-xs">
                                <Sparkles className="h-3 w-3 mr-1" />
                                Новый
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {product.sku || '—'}
                          </code>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {product.price.toLocaleString('ru-RU')} ₽
                        </TableCell>
                        <TableCell className="text-center">
                          {product.quantity}
                        </TableCell>
                        <TableCell>
                          <button
                            onClick={() => navigate(`/store/${product.store_subdomain}/admin`)}
                            className="text-primary hover:underline text-sm"
                          >
                            {product.store_name}
                          </button>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(product.created_at).toLocaleDateString('ru-RU')}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/store/${product.store_subdomain}/admin`)}
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            Магазин
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {/* Pagination */}
              {Math.ceil(productsTotal / ITEMS_PER_PAGE) > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <div className="text-sm text-muted-foreground">
                    Страница {productsPage} из {Math.ceil(productsTotal / ITEMS_PER_PAGE)}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setProductsPage(p => Math.max(1, p - 1))}
                      disabled={productsPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setProductsPage(p => Math.min(Math.ceil(productsTotal / ITEMS_PER_PAGE), p + 1))}
                      disabled={productsPage === Math.ceil(productsTotal / ITEMS_PER_PAGE)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Featured Tab */}
          <TabsContent value="featured" className="space-y-6">
            <FeaturedProductsManager />
          </TabsContent>

          {/* Slides Tab */}
          <TabsContent value="slides" className="space-y-6">
            <SlidesManager />
          </TabsContent>

          {/* Megacatalog Tab */}
          <TabsContent value="megacatalog" className="space-y-6">
            <MegacatalogManager />
          </TabsContent>

          {/* Telegram Tab */}
          <TabsContent value="telegram" className="space-y-6">
            <TelegramBotSection session={session} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
