import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ExternalLink, Copy, ChevronLeft, ChevronRight, Shield, Store } from 'lucide-react';
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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

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

const ITEMS_PER_PAGE = 10;

export default function SuperAdmin() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isSuperAdmin, loading } = useAuth();
  
  const [stores, setStores] = useState<StoreWithCounts[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Check for temp super admin or real super admin
  const isTempSuperAdmin = localStorage.getItem('temp_super_admin') === 'true';
  const hasAccess = isSuperAdmin || isTempSuperAdmin;

  useEffect(() => {
    if (!loading && !hasAccess) {
      navigate('/');
    }
  }, [loading, hasAccess, navigate]);

  useEffect(() => {
    if (hasAccess) {
      fetchStores();
    }
  }, [hasAccess, currentPage, searchQuery]);

  const fetchStores = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('stores')
        .select(`
          id,
          name,
          subdomain,
          status,
          created_at,
          products_count,
          customers_count,
          profiles!stores_owner_id_fkey (
            email,
            full_name
          )
        `, { count: 'exact' });

      // Apply search filter
      if (searchQuery) {
        query = query.or(`name.ilike.%${searchQuery}%,subdomain.ilike.%${searchQuery}%`);
      }

      // Apply pagination
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      
      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      const formattedStores: StoreWithCounts[] = (data || []).map((store: any) => ({
        id: store.id,
        name: store.name,
        subdomain: store.subdomain,
        status: store.status,
        created_at: store.created_at,
        owner_email: store.profiles?.email || 'N/A',
        owner_name: store.profiles?.full_name,
        products_count: store.products_count || 0,
        customers_count: store.customers_count || 0,
      }));

      setStores(formattedStores);
      setTotalCount(count || 0);
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

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

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
        {/* Search and stats */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
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
      </main>
    </div>
  );
}
