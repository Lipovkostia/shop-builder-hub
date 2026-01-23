import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ExternalLink, Copy, ChevronLeft, ChevronRight, Shield, Store, Users, User, Image, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import SlidesManager from '@/components/admin/SlidesManager';
import SuperAdminDashboard from '@/components/admin/SuperAdminDashboard';

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
  created_at: string;
  stores: { store_name: string; store_id: string }[];
}

const ITEMS_PER_PAGE = 10;

export default function SuperAdmin() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isSuperAdmin, loading } = useAuth();
  
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

  // Check for temp super admin or real super admin
  const isTempSuperAdmin = localStorage.getItem('temp_super_admin') === 'true';
  const hasAccess = isSuperAdmin || isTempSuperAdmin;

  useEffect(() => {
    if (!loading && !hasAccess) {
      navigate('/');
    }
  }, [loading, hasAccess, navigate]);

  useEffect(() => {
    if (hasAccess && activeTab === 'stores') {
      fetchStores();
    }
  }, [hasAccess, currentPage, searchQuery, activeTab]);

  useEffect(() => {
    if (hasAccess && activeTab === 'customers') {
      fetchCustomers();
    }
  }, [hasAccess, customersPage, customersSearch, activeTab]);

  const fetchStores = async () => {
    setIsLoading(true);
    try {
      // Build URL with query params for edge function
      const params = new URLSearchParams({
        action: 'stores',
        page: currentPage.toString(),
        limit: ITEMS_PER_PAGE.toString(),
      });
      if (searchQuery) {
        params.set('search', searchQuery);
      }

      const response = await fetch(
        `https://zqegcsutpwwrahfiwaic.supabase.co/functions/v1/super-admin-stats?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-super-admin-key': 'temp_super_admin_access',
          },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch stores');

      const result = await response.json();
      setStores(result.data || []);
      setTotalCount(result.total || 0);
    } catch (error) {
      console.error('Error fetching stores:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить список магазинов',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCustomers = async () => {
    setCustomersLoading(true);
    try {
      // Build URL with query params for edge function
      const params = new URLSearchParams({
        action: 'customers',
        page: customersPage.toString(),
        limit: ITEMS_PER_PAGE.toString(),
      });
      if (customersSearch) {
        params.set('search', customersSearch);
      }

      const response = await fetch(
        `https://zqegcsutpwwrahfiwaic.supabase.co/functions/v1/super-admin-stats?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-super-admin-key': 'temp_super_admin_access',
          },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch customers');

      const result = await response.json();
      setCustomers(result.data || []);
      setCustomersTotal(result.total || 0);
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить список покупателей',
        variant: 'destructive',
      });
    } finally {
      setCustomersLoading(false);
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
    // Store the user ID to impersonate
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!hasAccess) {
    return null;
  }

  const handleLogout = () => {
    localStorage.removeItem('temp_super_admin');
    localStorage.removeItem('impersonate_customer_id');
    navigate('/');
  };

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
                <p className="text-sm text-muted-foreground">Управление всеми магазинами платформы</p>
              </div>
            </div>
            <Button variant="outline" onClick={handleLogout}>
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
            <TabsTrigger value="customers" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Покупатели</span>
            </TabsTrigger>
            <TabsTrigger value="slides" className="gap-2">
              <Image className="h-4 w-4" />
              <span className="hidden sm:inline">Слайды</span>
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            <SuperAdminDashboard />
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
            {/* Search and stats */}
            <div className="flex flex-col sm:flex-row gap-4">
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
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>Всего покупателей: <strong className="text-foreground">{customersTotal}</strong></span>
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
                    <TableHead>Магазины</TableHead>
                    <TableHead>Дата регистрации</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customersLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center">
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : customers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                        {customersSearch ? 'Покупатели не найдены' : 'Нет покупателей'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    customers.map((customer) => (
                      <TableRow key={customer.id}>
                        <TableCell>
                          <button
                            onClick={() => openCustomerDashboard(customer.user_id)}
                            className="font-medium text-primary hover:underline flex items-center gap-1"
                          >
                            <User className="h-3 w-3" />
                            {customer.full_name || 'Без имени'}
                          </button>
                        </TableCell>
                        <TableCell>
                          <button
                            onClick={() => openCustomerDashboard(customer.user_id)}
                            className="text-primary hover:underline"
                          >
                            {customer.phone || '—'}
                          </button>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {customer.email}
                        </TableCell>
                        <TableCell>
                          {customer.stores.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {customer.stores.slice(0, 2).map((s, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {s.store_name}
                                </Badge>
                              ))}
                              {customer.stores.length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{customer.stores.length - 2}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(customer.created_at).toLocaleDateString('ru-RU')}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openCustomerDashboard(customer.user_id)}
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            Войти
                          </Button>
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
          </TabsContent>

          {/* Slides Tab */}
          <TabsContent value="slides" className="space-y-6">
            <SlidesManager />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
