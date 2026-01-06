import { useState, useEffect } from "react";
import { Users, Phone, FolderOpen, Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface CustomerWithAccess {
  id: string;
  profile_id: string;
  full_name: string | null;
  phone: string | null;
  email: string;
  catalogs: Array<{
    id: string;
    name: string;
  }>;
}

interface StoreCustomersTableProps {
  storeId: string;
}

export function StoreCustomersTable({ storeId }: StoreCustomersTableProps) {
  const [customers, setCustomers] = useState<CustomerWithAccess[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCustomers = async () => {
      setLoading(true);
      try {
        // Get store customers with profiles
        const { data: storeCustomers, error: scError } = await supabase
          .from('store_customers')
          .select('id, profile_id')
          .eq('store_id', storeId);

        if (scError) throw scError;
        if (!storeCustomers || storeCustomers.length === 0) {
          setCustomers([]);
          setLoading(false);
          return;
        }

        // Get profiles for these customers
        const profileIds = storeCustomers.map(sc => sc.profile_id);
        const { data: profiles, error: profError } = await supabase
          .from('profiles')
          .select('id, full_name, phone, email')
          .in('id', profileIds);

        if (profError) throw profError;

        // Get catalog access for these customers
        const storeCustomerIds = storeCustomers.map(sc => sc.id);
        const { data: catalogAccess, error: caError } = await supabase
          .from('customer_catalog_access')
          .select('store_customer_id, catalog_id')
          .in('store_customer_id', storeCustomerIds);

        if (caError) throw caError;

        // Get catalogs for this store
        const { data: catalogs, error: catError } = await supabase
          .from('catalogs')
          .select('id, name')
          .eq('store_id', storeId);

        if (catError) throw catError;

        // Build customers with access info
        const customersWithAccess: CustomerWithAccess[] = storeCustomers.map(sc => {
          const profile = profiles?.find(p => p.id === sc.profile_id);
          const customerCatalogIds = catalogAccess
            ?.filter(ca => ca.store_customer_id === sc.id)
            .map(ca => ca.catalog_id) || [];
          const customerCatalogs = catalogs
            ?.filter(c => customerCatalogIds.includes(c.id)) || [];

          return {
            id: sc.id,
            profile_id: sc.profile_id,
            full_name: profile?.full_name || null,
            phone: profile?.phone || null,
            email: profile?.email || '',
            catalogs: customerCatalogs,
          };
        });

        setCustomers(customersWithAccess);
      } catch (error) {
        console.error('Error fetching customers:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
  }, [storeId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Клиенты</h2>
        <p className="text-sm text-muted-foreground">
          Список покупателей вашего магазина и их доступ к прайс-листам
        </p>
      </div>

      {customers.length > 0 ? (
        <div className="bg-card rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Имя</TableHead>
                <TableHead>Телефон</TableHead>
                <TableHead>Доступные прайс-листы</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      {customer.full_name || customer.email || "—"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      {customer.phone || "—"}
                    </div>
                  </TableCell>
                  <TableCell>
                    {customer.catalogs.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {customer.catalogs.map((catalog) => (
                          <Badge key={catalog.id} variant="secondary" className="text-xs">
                            <FolderOpen className="h-3 w-3 mr-1" />
                            {catalog.name}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">Нет доступа</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="bg-card rounded-lg border border-border p-8 text-center">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-medium text-foreground mb-2">Нет клиентов</h3>
          <p className="text-sm text-muted-foreground">
            Покупатели появятся здесь после регистрации по ссылке на ваш прайс-лист
          </p>
        </div>
      )}
    </div>
  );
}
