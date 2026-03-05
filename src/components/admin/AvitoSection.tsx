import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ExternalLink,
  Loader2,
  Link2,
  Unlink,
  RefreshCw,
  Check,
  Package,
  Search,
} from "lucide-react";

interface AvitoItem {
  id: number;
  title: string;
  price: number;
  url: string;
  status: string;
  category?: { id: number; name: string };
  images?: { id: number; url: string }[] | any[];
  description?: string;
  address?: { city?: string; location?: any };
}

interface AvitoAccount {
  id: string;
  store_id: string;
  client_id: string;
  client_secret: string;
  avito_user_id: number | null;
  profile_name: string | null;
  last_sync: string | null;
}

interface AvitoSectionProps {
  storeId: string | null;
}

export function AvitoSection({ storeId }: AvitoSectionProps) {
  const { toast } = useToast();
  const [account, setAccount] = useState<AvitoAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");

  const [items, setItems] = useState<AvitoItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

  const callAvitoApi = useCallback(async (body: any) => {
    const res = await fetch(
      `https://${projectId}.supabase.co/functions/v1/avito-api`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(data.error || "Ошибка API Авито");
    }
    return data;
  }, [projectId]);

  // Load account on mount
  useEffect(() => {
    if (!storeId) return;
    setLoading(true);
    callAvitoApi({ action: "get_credentials", store_id: storeId })
      .then((data) => {
        setAccount(data.account || null);
        if (data.account) {
          setClientId(data.account.client_id);
          setClientSecret(data.account.client_secret);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [storeId, callAvitoApi]);

  const handleConnect = async () => {
    if (!storeId || !clientId.trim() || !clientSecret.trim()) {
      toast({ title: "Заполните Client ID и Client Secret", variant: "destructive" });
      return;
    }
    setConnecting(true);
    try {
      const data = await callAvitoApi({
        action: "test_connection",
        store_id: storeId,
        client_id: clientId.trim(),
        client_secret: clientSecret.trim(),
      });
      toast({ title: "Авито подключён!", description: `Профиль: ${data.user?.name || data.user?.email || data.user?.id}` });
      // Reload account
      const acc = await callAvitoApi({ action: "get_credentials", store_id: storeId });
      setAccount(acc.account);
    } catch (err: any) {
      toast({ title: "Ошибка подключения", description: err.message, variant: "destructive" });
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!storeId) return;
    setDisconnecting(true);
    try {
      await callAvitoApi({ action: "disconnect", store_id: storeId });
      setAccount(null);
      setClientId("");
      setClientSecret("");
      setItems([]);
      toast({ title: "Авито отключён" });
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleFetchItems = async () => {
    if (!storeId) return;
    setFetching(true);
    try {
      const data = await callAvitoApi({ action: "fetch_items", store_id: storeId });
      setItems(data.items || []);
      toast({ title: `Загружено ${data.total} объявлений` });
    } catch (err: any) {
      toast({ title: "Ошибка загрузки", description: err.message, variant: "destructive" });
    } finally {
      setFetching(false);
    }
  };

  const filteredItems = items.filter((item) =>
    !searchQuery || item.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isConnected = account && account.avito_user_id;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Авито</h2>
          <p className="text-sm text-muted-foreground">
            Интеграция с Авито для импорта объявлений
          </p>
        </div>
        {isConnected && (
          <Badge variant="outline" className="gap-1 text-green-600 border-green-300">
            <Check className="h-3 w-3" />
            Подключено: {account.profile_name}
          </Badge>
        )}
      </div>

      {/* Connection form */}
      <Card className="p-4 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Link2 className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">Подключение к Авито API</span>
        </div>

        <p className="text-xs text-muted-foreground">
          Получите Client ID и Client Secret на{" "}
          <a
            href="https://www.avito.ru/professionals/api"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline inline-flex items-center gap-0.5"
          >
            avito.ru/professionals/api
            <ExternalLink className="h-3 w-3" />
          </a>
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="avito-client-id" className="text-xs">Client ID</Label>
            <Input
              id="avito-client-id"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="Введите Client ID"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="avito-client-secret" className="text-xs">Client Secret</Label>
            <Input
              id="avito-client-secret"
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder="Введите Client Secret"
              className="h-9 text-sm"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleConnect}
            disabled={connecting || !clientId.trim() || !clientSecret.trim()}
          >
            {connecting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isConnected ? "Переподключить" : "Подключить"}
          </Button>

          {isConnected && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="text-destructive hover:text-destructive"
            >
              {disconnecting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <Unlink className="h-3.5 w-3.5" />
              Отключить
            </Button>
          )}
        </div>
      </Card>

      {/* Items section */}
      {isConnected && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">
                Активные объявления
                {items.length > 0 && (
                  <span className="text-muted-foreground ml-1">({filteredItems.length})</span>
                )}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {items.length > 0 && (
                <div className="relative">
                  <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Поиск..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 text-xs pl-8 w-48"
                  />
                </div>
              )}
              <Button size="sm" variant="outline" onClick={handleFetchItems} disabled={fetching}>
                {fetching ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Загрузить объявления
              </Button>
            </div>
          </div>

          {account.last_sync && (
            <p className="text-xs text-muted-foreground">
              Последняя синхронизация: {new Date(account.last_sync).toLocaleString("ru")}
            </p>
          )}

          {items.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Фото</TableHead>
                    <TableHead>Название</TableHead>
                    <TableHead className="w-28 text-right">Цена</TableHead>
                    <TableHead className="w-32">Категория</TableHead>
                    <TableHead className="w-20">Статус</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => {
                    const imageUrl = item.images?.[0]?.["640x480"] || item.images?.[0]?.url || null;
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt=""
                              className="w-10 h-10 rounded object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                              <Package className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-xs leading-tight line-clamp-2">
                            {item.title}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium text-xs">
                          {item.price ? `${item.price.toLocaleString("ru")} ₽` : "—"}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {item.category?.name || "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px]">
                            {item.status === "active" ? "Активно" : item.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {item.url && (
                            <a
                              href={item.url.startsWith("http") ? item.url : `https://www.avito.ru${item.url}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                            </a>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <Card className="p-8 text-center">
              <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Нажмите «Загрузить объявления», чтобы импортировать активные объявления с Авито
              </p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
