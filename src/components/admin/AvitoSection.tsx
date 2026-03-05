import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ExternalLink,
  Loader2,
  Link2,
  Unlink,
  RefreshCw,
  Check,
  Package,
  Search,
  ChevronDown,
  ChevronUp,
  MapPin,
  Calendar,
  Eye,
  Image as ImageIcon,
} from "lucide-react";

interface AvitoItem {
  id: number;
  title: string;
  price: number;
  url: string;
  status: string;
  category?: { id: number; name: string };
  images?: any[];
  description?: string;
  body?: string;
  address?: { city?: string; street?: string; address?: string; lat?: number; lng?: number };
  created?: string;
  avito_id?: number;
  views?: number;
  favorites?: number;
  params?: any[];
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
  const [expandedItemId, setExpandedItemId] = useState<number | null>(null);
  const [detailDialogItem, setDetailDialogItem] = useState<AvitoItem | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

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

  const handleViewDetail = async (item: AvitoItem) => {
    setDetailDialogItem(item);
    setLoadingDetail(true);
    try {
      const data = await callAvitoApi({
        action: "get_item_info",
        store_id: storeId,
        item_id: item.id,
      });
      if (data.item) {
        setDetailDialogItem({ ...item, ...data.item });
      }
    } catch (err: any) {
      // Keep the basic item data even if detail fetch fails
      console.error("Failed to load item details:", err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const filteredItems = items.filter((item) =>
    !searchQuery || item.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString("ru", { day: "2-digit", month: "2-digit", year: "numeric" });
    } catch { return "—"; }
  };

  const formatPrice = (price?: number) => {
    if (!price) return "—";
    return `${price.toLocaleString("ru")} ₽`;
  };

  const getAddress = (item: AvitoItem) => {
    if (!item.address) return "—";
    const parts = [item.address.city, item.address.street, item.address.address].filter(Boolean);
    return parts.join(", ") || "—";
  };

  const getImageCount = (item: AvitoItem) => item.images?.length || 0;

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
            Интеграция с Авито для импорта и управления объявлениями
          </p>
        </div>
        {isConnected && (
          <Badge variant="outline" className="gap-1 text-primary border-primary/30">
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
              <ScrollArea className="w-full">
                <div className="min-w-[1100px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-xs">
                        <TableHead className="w-10 px-2">№</TableHead>
                        <TableHead className="w-14 px-2">Фото</TableHead>
                        <TableHead className="min-w-[200px] px-2">Название</TableHead>
                        <TableHead className="w-24 px-2 text-right">Цена</TableHead>
                        <TableHead className="w-32 px-2">Категория</TableHead>
                        <TableHead className="w-40 px-2">Адрес</TableHead>
                        <TableHead className="w-20 px-2 text-center">Фото</TableHead>
                        <TableHead className="w-24 px-2">Статус</TableHead>
                        <TableHead className="w-24 px-2">Создано</TableHead>
                        <TableHead className="w-16 px-2 text-center">ID</TableHead>
                        <TableHead className="w-10 px-2"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredItems.map((item, index) => {
                        const imageUrl = item.images?.[0]?.["640x480"] || item.images?.[0]?.url || item.images?.[0]?.main?.url || null;
                        const isExpanded = expandedItemId === item.id;
                        return (
                          <>
                            <TableRow
                              key={item.id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => handleViewDetail(item)}
                            >
                              <TableCell className="px-2 text-xs text-muted-foreground">{index + 1}</TableCell>
                              <TableCell className="px-2">
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
                              <TableCell className="px-2">
                                <div className="font-medium text-xs leading-tight line-clamp-2">
                                  {item.title}
                                </div>
                              </TableCell>
                              <TableCell className="px-2 text-right font-medium text-xs">
                                {formatPrice(item.price)}
                              </TableCell>
                              <TableCell className="px-2">
                                <span className="text-xs text-muted-foreground line-clamp-1">
                                  {item.category?.name || "—"}
                                </span>
                              </TableCell>
                              <TableCell className="px-2">
                                <span className="text-xs text-muted-foreground line-clamp-1">
                                  {getAddress(item)}
                                </span>
                              </TableCell>
                              <TableCell className="px-2 text-center">
                                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                                  <ImageIcon className="h-3 w-3" />
                                  {getImageCount(item)}
                                </div>
                              </TableCell>
                              <TableCell className="px-2">
                                <Badge variant="secondary" className="text-[10px]">
                                  {item.status === "active" ? "Активно" : 
                                   item.status === "old" ? "Завершено" : 
                                   item.status === "blocked" ? "Заблокировано" : 
                                   item.status === "removed" ? "Удалено" : item.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="px-2 text-xs text-muted-foreground">
                                {formatDate(item.created)}
                              </TableCell>
                              <TableCell className="px-2 text-xs text-muted-foreground text-center">
                                {item.id}
                              </TableCell>
                              <TableCell className="px-2">
                                {item.url && (
                                  <a
                                    href={item.url.startsWith("http") ? item.url : `https://www.avito.ru${item.url}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                                  </a>
                                )}
                              </TableCell>
                            </TableRow>
                          </>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </ScrollArea>
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

      {/* Item Detail Dialog */}
      <Dialog open={!!detailDialogItem} onOpenChange={(open) => !open && setDetailDialogItem(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base leading-tight pr-6">
              {detailDialogItem?.title}
            </DialogTitle>
          </DialogHeader>

          {loadingDetail && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Загрузка деталей...
            </div>
          )}

          {detailDialogItem && (
            <div className="space-y-4">
              {/* Images gallery */}
              {detailDialogItem.images && detailDialogItem.images.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Фотографии ({detailDialogItem.images.length})</Label>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {detailDialogItem.images.map((img: any, idx: number) => {
                      const imgUrl = img?.["640x480"] || img?.url || img?.main?.url;
                      return imgUrl ? (
                        <img
                          key={idx}
                          src={imgUrl}
                          alt={`Фото ${idx + 1}`}
                          className="w-24 h-24 rounded-lg object-cover flex-shrink-0 border"
                        />
                      ) : null;
                    })}
                  </div>
                </div>
              )}

              {/* Price */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Цена</Label>
                  <p className="text-lg font-semibold">{formatPrice(detailDialogItem.price)}</p>
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Статус</Label>
                  <div className="mt-1">
                    <Badge variant="secondary">
                      {detailDialogItem.status === "active" ? "Активно" : 
                       detailDialogItem.status === "old" ? "Завершено" : 
                       detailDialogItem.status === "blocked" ? "Заблокировано" : 
                       detailDialogItem.status === "removed" ? "Удалено" : detailDialogItem.status}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Category */}
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Категория</Label>
                <p className="text-sm">
                  {detailDialogItem.category?.name || "—"}
                  {detailDialogItem.category?.id && (
                    <span className="text-muted-foreground ml-1">(ID: {detailDialogItem.category.id})</span>
                  )}
                </p>
              </div>

              {/* Address */}
              <div>
                <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Адрес
                </Label>
                <p className="text-sm">{getAddress(detailDialogItem)}</p>
              </div>

              {/* Description */}
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Описание</Label>
                <div className="mt-1 p-3 bg-muted/50 rounded-lg text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {detailDialogItem.body || detailDialogItem.description || "Нет описания"}
                </div>
              </div>

              {/* Params */}
              {detailDialogItem.params && detailDialogItem.params.length > 0 && (
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Параметры</Label>
                  <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1">
                    {detailDialogItem.params.map((param: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-xs py-1 border-b border-border/50">
                        <span className="text-muted-foreground">{param.title || param.name}:</span>
                        <span className="font-medium">{param.value || param.values?.join(", ") || "—"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Meta info */}
              <div className="grid grid-cols-3 gap-4 pt-2 border-t">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Создано
                  </Label>
                  <p className="text-xs">{formatDate(detailDialogItem.created)}</p>
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Avito ID</Label>
                  <p className="text-xs">{detailDialogItem.id}</p>
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Ссылка</Label>
                  {detailDialogItem.url && (
                    <a
                      href={detailDialogItem.url.startsWith("http") ? detailDialogItem.url : `https://www.avito.ru${detailDialogItem.url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary underline flex items-center gap-0.5"
                    >
                      Открыть на Авито
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>

              {/* Note about editing */}
              <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
                <strong>Примечание:</strong> API Авито пока ограничен для редактирования объявлений. 
                Обновление цен и описаний доступно через автозагрузку (XML/JSON фид) или личный кабинет Авито.
                Мы добавим поддержку редактирования, как только Авито расширит API.
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
