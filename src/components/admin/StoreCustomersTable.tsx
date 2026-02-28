import { useState, useEffect, useCallback } from "react";
import { Users, Phone, Loader2, Link2, Unlink, Building2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { InlineMultiSelectCell } from "@/components/admin/InlineMultiSelectCell";
import { useToast } from "@/hooks/use-toast";
import type { MoyskladCounterparty } from "@/components/admin/MoyskladCounterpartiesSection";

interface CustomerWithAccess {
  id: string;
  profile_id: string;
  full_name: string | null;
  phone: string | null;
  email: string;
  moysklad_counterparty_id: string | null;
  moysklad_counterparty_name: string | null;
  catalogs: Array<{
    id: string;
    name: string;
  }>;
}

interface StoreCustomersTableProps {
  storeId: string;
  moyskladLogin?: string | null;
  moyskladPassword?: string | null;
}

export function StoreCustomersTable({ storeId, moyskladLogin, moyskladPassword }: StoreCustomersTableProps) {
  const [customers, setCustomers] = useState<CustomerWithAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [allCatalogs, setAllCatalogs] = useState<{id: string, name: string}[]>([]);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkingCustomerId, setLinkingCustomerId] = useState<string | null>(null);
  const [counterparties, setCounterparties] = useState<MoyskladCounterparty[]>([]);
  const [cpLoading, setCpLoading] = useState(false);
  const [cpSearch, setCpSearch] = useState("");
  const { toast } = useToast();

  const hasMoysklad = !!moyskladLogin && !!moyskladPassword;

  const fetchCounterparties = useCallback(async () => {
    if (!moyskladLogin || !moyskladPassword || counterparties.length > 0) return;
    setCpLoading(true);
    try {
      let all: MoyskladCounterparty[] = [];
      let offset = 0;
      const batchSize = 100;
      let total = 0;
      do {
        const { data, error } = await supabase.functions.invoke("moysklad", {
          body: { action: "get_counterparties", login: moyskladLogin, password: moyskladPassword, counterpartyLimit: batchSize, counterpartyOffset: offset },
        });
        if (error) throw error;
        if (data.error) throw new Error(data.error);
        all = [...all, ...(data.counterparties || [])];
        total = data.meta?.size || all.length;
        offset += batchSize;
      } while (offset < total && offset < 1000);
      setCounterparties(all);
    } catch (e: any) {
      toast({ title: "Ошибка загрузки контрагентов", description: e.message, variant: "destructive" });
    } finally {
      setCpLoading(false);
    }
  }, [moyskladLogin, moyskladPassword, counterparties.length, toast]);

  const updateCustomerCatalogAccess = async (storeCustomerId: string, newCatalogIds: string[]) => {
    try {
      const customer = customers.find(c => c.id === storeCustomerId);
      const currentCatalogIds = customer?.catalogs.map(c => c.id) || [];
      const toAdd = newCatalogIds.filter(id => !currentCatalogIds.includes(id));
      const toRemove = currentCatalogIds.filter(id => !newCatalogIds.includes(id));
      if (toRemove.length > 0) {
        const { error } = await supabase.from('customer_catalog_access').delete().eq('store_customer_id', storeCustomerId).in('catalog_id', toRemove);
        if (error) throw error;
      }
      if (toAdd.length > 0) {
        const { error } = await supabase.from('customer_catalog_access').insert(toAdd.map(catalogId => ({ store_customer_id: storeCustomerId, catalog_id: catalogId })));
        if (error) throw error;
      }
      setCustomers(prev => prev.map(c => c.id === storeCustomerId ? { ...c, catalogs: allCatalogs.filter(cat => newCatalogIds.includes(cat.id)) } : c));
      toast({ title: "Доступ обновлён" });
    } catch (error) {
      console.error('Error updating catalog access:', error);
      toast({ title: "Ошибка", description: "Не удалось обновить доступ", variant: "destructive" });
    }
  };

  const linkCounterparty = async (storeCustomerId: string, cp: MoyskladCounterparty) => {
    try {
      const { error } = await supabase
        .from('store_customers')
        .update({ moysklad_counterparty_id: cp.id, moysklad_counterparty_name: cp.name } as any)
        .eq('id', storeCustomerId);
      if (error) throw error;
      setCustomers(prev => prev.map(c => c.id === storeCustomerId ? { ...c, moysklad_counterparty_id: cp.id, moysklad_counterparty_name: cp.name } : c));
      setLinkDialogOpen(false);
      setLinkingCustomerId(null);
      toast({ title: "Контрагент привязан", description: `${cp.name} привязан к клиенту` });
    } catch (e: any) {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    }
  };

  const unlinkCounterparty = async (storeCustomerId: string) => {
    try {
      const { error } = await supabase
        .from('store_customers')
        .update({ moysklad_counterparty_id: null, moysklad_counterparty_name: null } as any)
        .eq('id', storeCustomerId);
      if (error) throw error;
      setCustomers(prev => prev.map(c => c.id === storeCustomerId ? { ...c, moysklad_counterparty_id: null, moysklad_counterparty_name: null } : c));
      toast({ title: "Связь удалена" });
    } catch (e: any) {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    }
  };

  const openLinkDialog = (customerId: string) => {
    setLinkingCustomerId(customerId);
    setLinkDialogOpen(true);
    setCpSearch("");
    fetchCounterparties();
  };

  const filteredCp = cpSearch.trim()
    ? counterparties.filter(cp => cp.name.toLowerCase().includes(cpSearch.toLowerCase()) || cp.phone?.includes(cpSearch) || cp.email?.toLowerCase().includes(cpSearch.toLowerCase()) || cp.inn?.includes(cpSearch))
    : counterparties;

  useEffect(() => {
    const fetchCustomers = async () => {
      setLoading(true);
      try {
        const { data: storeCustomers, error: scError } = await supabase
          .from('store_customers')
          .select('*')
          .eq('store_id', storeId) as { data: any[] | null; error: any };
        if (scError) throw scError;
        if (!storeCustomers || storeCustomers.length === 0) { setCustomers([]); setLoading(false); return; }

        const profileIds = storeCustomers.map(sc => sc.profile_id);
        const { data: profiles, error: profError } = await supabase.from('profiles').select('id, full_name, phone, email').in('id', profileIds);
        if (profError) throw profError;

        const storeCustomerIds = storeCustomers.map(sc => sc.id);
        const { data: catalogAccess, error: caError } = await supabase.from('customer_catalog_access').select('store_customer_id, catalog_id').in('store_customer_id', storeCustomerIds);
        if (caError) throw caError;

        const { data: catalogs, error: catError } = await supabase.from('catalogs').select('id, name').eq('store_id', storeId);
        if (catError) throw catError;

        const customersWithAccess: CustomerWithAccess[] = storeCustomers.map(sc => {
          const profile = profiles?.find(p => p.id === sc.profile_id);
          const customerCatalogIds = catalogAccess?.filter(ca => ca.store_customer_id === sc.id).map(ca => ca.catalog_id) || [];
          return {
            id: sc.id,
            profile_id: sc.profile_id,
            full_name: profile?.full_name || null,
            phone: profile?.phone || null,
            email: profile?.email || '',
            moysklad_counterparty_id: (sc as any).moysklad_counterparty_id || null,
            moysklad_counterparty_name: (sc as any).moysklad_counterparty_name || null,
            catalogs: catalogs?.filter(c => customerCatalogIds.includes(c.id)) || [],
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
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
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
                {hasMoysklad && <TableHead>Контрагент МС</TableHead>}
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
                  {hasMoysklad && (
                    <TableCell>
                      {customer.moysklad_counterparty_name ? (
                        <div className="flex items-center gap-1.5">
                          <Badge variant="secondary" className="text-xs flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {customer.moysklad_counterparty_name}
                          </Badge>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => unlinkCounterparty(customer.id)}>
                            <Unlink className="h-3 w-3 text-muted-foreground" />
                          </Button>
                        </div>
                      ) : (
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openLinkDialog(customer.id)}>
                          <Link2 className="h-3 w-3 mr-1" />
                          Привязать
                        </Button>
                      )}
                    </TableCell>
                  )}
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

      {/* Dialog to link counterparty */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Привязать контрагента МойСклад</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Поиск по имени, телефону, ИНН..."
            value={cpSearch}
            onChange={(e) => setCpSearch(e.target.value)}
            className="h-9"
          />
          <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
            {cpLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : filteredCp.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-4">Не найдено</p>
            ) : (
              filteredCp.slice(0, 50).map(cp => (
                <button
                  key={cp.id}
                  className="w-full text-left p-2.5 rounded-md border hover:bg-accent/50 transition-colors"
                  onClick={() => linkingCustomerId && linkCounterparty(linkingCustomerId, cp)}
                >
                  <div className="font-medium text-sm">{cp.name}</div>
                  <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                    {cp.phone && <span>{cp.phone}</span>}
                    {cp.email && <span>{cp.email}</span>}
                    {cp.inn && <span>ИНН: {cp.inn}</span>}
                  </div>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
