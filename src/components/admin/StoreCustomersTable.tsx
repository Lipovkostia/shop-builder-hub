import { useState, useEffect } from "react";
import { Users, Phone, Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { InlineMultiSelectCell } from "@/components/admin/InlineMultiSelectCell";
import { useToast } from "@/hooks/use-toast";

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
  const [allCatalogs, setAllCatalogs] = useState<{id: string, name: string}[]>([]);
  const { toast } = useToast();

  // Update customer catalog access
  const updateCustomerCatalogAccess = async (
    storeCustomerId: string, 
    newCatalogIds: string[]
  ) => {
    try {
      const customer = customers.find(c => c.id === storeCustomerId);
      const currentCatalogIds = customer?.catalogs.map(c => c.id) || [];
      
      const toAdd = newCatalogIds.filter(id => !currentCatalogIds.includes(id));
      const toRemove = currentCatalogIds.filter(id => !newCatalogIds.includes(id));
      
      if (toRemove.length > 0) {
        const { error } = await supabase
          .from('customer_catalog_access')
          .delete()
          .eq('store_customer_id', storeCustomerId)
          .in('catalog_id', toRemove);
        if (error) throw error;
      }
      
      if (toAdd.length > 0) {
        const { error } = await supabase
          .from('customer_catalog_access')
          .insert(toAdd.map(catalogId => ({
            store_customer_id: storeCustomerId,
            catalog_id: catalogId
          })));
        if (error) throw error;
      }
      
      setCustomers(prev => prev.map(c => {
        if (c.id === storeCustomerId) {
          return {
            ...c,
            catalogs: allCatalogs.filter(cat => newCatalogIds.includes(cat.id))
          };
        }
        return c;
      }));
      
      toast({
        title: "Доступ обновлён",
        description: "Изменения сохранены",
      });
    } catch (error) {
      console.error('Error updating catalog access:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось обновить доступ",
        variant: "destructive",
      });
    }
  };

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
        setAllCatalogs(catalogs || []);
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
                    <InlineMultiSelectCell
                      values={customer.catalogs.map(c => c.id)}
                      options={allCatalogs.map(c => ({ value: c.id, label: c.name }))}
                      onSave={(newCatalogIds) => updateCustomerCatalogAccess(customer.id, newCatalogIds)}
                      allowAddNew={false}
                      placeholder="Нет доступа"
                    />
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
