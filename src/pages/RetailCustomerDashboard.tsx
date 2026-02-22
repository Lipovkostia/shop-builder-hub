import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  Package,
  User,
  LogOut,
  Loader2,
  ShoppingBag,
  MapPin,
  Clock,
  CheckCircle2,
  Truck,
  XCircle,
  Save,
  RefreshCw,
  Phone,
  Plus,
  Trash2,
  Star,
} from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { TelegramIcon } from "@/components/icons/TelegramIcon";
import { useRetailCart } from "@/hooks/useRetailCart";
import { useCustomerAddresses } from "@/hooks/useCustomerAddresses";

interface RetailOrder {
  id: string;
  order_number: string;
  status: string;
  total: number;
  created_at: string;
  shipping_address: {
    name?: string;
    phone?: string;
    address?: string;
    comment?: string;
  } | null;
  items: Array<{
    id: string;
    product_name: string;
    product_id: string | null;
    quantity: number;
    price: number;
    total: number;
  }>;
}

function formatPrice(price: number): string {
  return `${Math.round(price).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ₽`;
}

const statusConfig: Record<string, { label: string; icon: any; color: string }> = {
  pending: { label: "Новый", icon: Clock, color: "bg-yellow-100 text-yellow-800" },
  forming: { label: "Формируется", icon: Package, color: "bg-blue-100 text-blue-800" },
  processing: { label: "В обработке", icon: Package, color: "bg-blue-100 text-blue-800" },
  shipped: { label: "Доставляется", icon: Truck, color: "bg-purple-100 text-purple-800" },
  delivered: { label: "Доставлен", icon: CheckCircle2, color: "bg-green-100 text-green-800" },
  cancelled: { label: "Отменён", icon: XCircle, color: "bg-red-100 text-red-800" },
};

export default function RetailCustomerDashboard() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { subdomain } = useParams();
  const { toast } = useToast();

  const [orders, setOrders] = useState<RetailOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("orders");

  // Store contacts
  const [storeContacts, setStoreContacts] = useState<{
    phone: string | null;
    whatsapp: string | null;
    telegram: string | null;
  }>({ phone: null, whatsapp: null, telegram: null });

  // Profile editing
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [saving, setSaving] = useState(false);

  // Cart for repeat order
  const { addToCart } = useRetailCart(subdomain || "");

  // Addresses
  const { addresses, loading: addressesLoading, addAddress, deleteAddress } = useCustomerAddresses();
  const [newCity, setNewCity] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [addingAddress, setAddingAddress] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Auto-save city from localStorage
  useEffect(() => {
    if (!user || !subdomain || addressesLoading) return;
    const storageKey = `retail_city_${subdomain}`;
    const savedCity = localStorage.getItem(storageKey);
    const savedAddress = localStorage.getItem(`retail_address_${subdomain}`);
    if (savedCity && addresses.length === 0 && savedAddress) {
      addAddress(savedAddress, null, savedCity);
    }
  }, [user, subdomain, addressesLoading, addresses.length]);

  // Fetch store contacts
  useEffect(() => {
    if (!subdomain) return;
    supabase
      .from("stores")
      .select("retail_phone, whatsapp_phone, telegram_username")
      .eq("subdomain", subdomain)
      .single()
      .then(({ data }) => {
        if (data) {
          setStoreContacts({
            phone: data.retail_phone,
            whatsapp: data.whatsapp_phone,
            telegram: data.telegram_username,
          });
        }
      });
  }, [subdomain]);

  // Fetch phone from profiles table directly
  useEffect(() => {
    if (profile) {
      setEditName(profile.full_name || "");
      supabase
        .from("profiles")
        .select("phone")
        .eq("id", profile.id)
        .single()
        .then(({ data }) => {
          if (data?.phone) {
            setEditPhone(data.phone);
            setProfilePhone(data.phone);
          }
        });
    }
  }, [profile]);

  // Fetch orders for this retail store
  const fetchOrders = useCallback(async () => {
    if (!user || !subdomain) return;
    setOrdersLoading(true);
    try {
      const { data: prof } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();
      if (!prof) return;

      const { data: store } = await supabase
        .from("stores")
        .select("id")
        .eq("subdomain", subdomain)
        .single();
      if (!store) return;

      const { data: sc } = await supabase
        .from("store_customers")
        .select("id")
        .eq("store_id", store.id)
        .eq("profile_id", prof.id)
        .maybeSingle();
      if (!sc) { setOrders([]); return; }

      const { data: ordersData } = await supabase
        .from("orders")
        .select("*")
        .eq("store_id", store.id)
        .eq("customer_id", sc.id)
        .order("created_at", { ascending: false });

      if (!ordersData || ordersData.length === 0) { setOrders([]); return; }

      const orderIds = ordersData.map(o => o.id);
      const { data: itemsData } = await supabase
        .from("order_items")
        .select("*")
        .in("order_id", orderIds);

      const mapped: RetailOrder[] = ordersData.map(o => ({
        id: o.id,
        order_number: o.order_number,
        status: o.status,
        total: Number(o.total),
        created_at: o.created_at,
        shipping_address: o.shipping_address as RetailOrder["shipping_address"],
        items: (itemsData || [])
          .filter(i => i.order_id === o.id)
          .map(i => ({
            id: i.id,
            product_name: i.product_name,
            product_id: i.product_id,
            quantity: i.quantity,
            price: Number(i.price),
            total: Number(i.total),
          })),
      }));

      setOrders(mapped);
    } catch (e) {
      console.error("Error fetching retail orders:", e);
    } finally {
      setOrdersLoading(false);
    }
  }, [user, subdomain]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleRepeatOrder = useCallback((order: RetailOrder) => {
    let addedCount = 0;
    for (const item of order.items) {
      if (item.product_id) {
        addToCart({
          productId: item.product_id,
          name: item.product_name,
          price: item.price,
          unit: "шт",
        }, item.quantity);
        addedCount++;
      }
    }
    if (addedCount > 0) {
      toast({ title: "Товары добавлены в корзину", description: `${addedCount} товар(ов) из заказа #${order.order_number}` });
    } else {
      toast({ title: "Не удалось повторить заказ", description: "Товары из этого заказа больше не доступны", variant: "destructive" });
    }
  }, [addToCart, toast]);

  const handleSaveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: editName, phone: editPhone })
        .eq("id", profile.id);
      if (error) throw error;
      toast({ title: "Профиль сохранён" });
    } catch (e: any) {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate(`/retail/${subdomain}`);
  };

  const formatWhatsAppPhone = (phone: string) => {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('8') && cleaned.length === 11) cleaned = '7' + cleaned.slice(1);
    if (cleaned.length === 10) cleaned = '7' + cleaned;
    return cleaned;
  };

  const hasContacts = storeContacts.phone || storeContacts.whatsapp || storeContacts.telegram;

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-2">Войдите в аккаунт</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Для доступа к личному кабинету необходимо авторизоваться
            </p>
            <Button onClick={() => navigate(`/retail/${subdomain}`)}>
              Вернуться в магазин
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="bg-card border-b border-border sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/retail/${subdomain}`)}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold flex-1">Личный кабинет</h1>
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-muted-foreground">
            <LogOut className="h-4 w-4 mr-1" />
            Выйти
          </Button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full mb-6">
            <TabsTrigger value="orders" className="flex-1 gap-2">
              <ShoppingBag className="h-4 w-4" />
              Заказы
            </TabsTrigger>
            <TabsTrigger value="addresses" className="flex-1 gap-2">
              <MapPin className="h-4 w-4" />
              Адреса
            </TabsTrigger>
            <TabsTrigger value="profile" className="flex-1 gap-2">
              <User className="h-4 w-4" />
              Профиль
            </TabsTrigger>
          </TabsList>

          {/* Orders Tab */}
          <TabsContent value="orders">
            {ordersLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : orders.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-medium text-lg mb-1">Заказов пока нет</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Ваши заказы из этого магазина появятся здесь
                  </p>
                  <Button variant="outline" onClick={() => navigate(`/retail/${subdomain}`)}>
                    Перейти к покупкам
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {orders.map(order => {
                  const sc = statusConfig[order.status] || statusConfig.pending;
                  const StatusIcon = sc.icon;
                  const canRepeat = order.status !== 'forming' && order.items.some(i => i.product_id);
                  return (
                    <Card key={order.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">
                            Заказ #{order.order_number}
                          </CardTitle>
                          <Badge variant="secondary" className={`${sc.color} border-0`}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {sc.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString("ru-RU", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </CardHeader>
                      <CardContent className="pt-0">
                        {/* Items */}
                        <div className="space-y-2 mb-3">
                          {order.items.map(item => (
                            <div key={item.id} className="flex justify-between text-sm">
                              <span className="text-foreground">
                                {item.product_name} × {item.quantity}
                              </span>
                              <span className="text-muted-foreground font-medium">
                                {formatPrice(item.total)}
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="border-t border-border pt-3 flex justify-between items-center">
                          <span className="font-medium">Итого:</span>
                          <span className="font-bold text-lg">{formatPrice(order.total)}</span>
                        </div>

                        {/* Shipping address */}
                        {order.shipping_address && (
                          <div className="mt-3 p-3 bg-muted/50 rounded-lg text-sm space-y-1">
                            {order.shipping_address.name && (
                              <div className="flex items-center gap-2">
                                <User className="h-3.5 w-3.5 text-muted-foreground" />
                                <span>{order.shipping_address.name}</span>
                              </div>
                            )}
                            {order.shipping_address.address && (
                              <div className="flex items-center gap-2">
                                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                                <span>{order.shipping_address.address}</span>
                              </div>
                            )}
                            {order.shipping_address.comment && (
                              <p className="text-muted-foreground text-xs mt-1">
                                {order.shipping_address.comment}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Repeat order button */}
                        {canRepeat && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full mt-3"
                            onClick={() => handleRepeatOrder(order)}
                          >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Повторить заказ
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Contact us section */}
            {hasContacts && (
              <Card className="mt-6">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Связаться с нами</CardTitle>
                </CardHeader>
                <CardContent className="flex gap-3">
                  {storeContacts.phone && (
                    <a
                      href={`tel:${storeContacts.phone}`}
                      className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-muted-foreground/20 transition-colors"
                      title="Позвонить"
                    >
                      <Phone className="h-5 w-5 text-foreground" />
                    </a>
                  )}
                  {storeContacts.whatsapp && (
                    <a
                      href={`https://wa.me/${formatWhatsAppPhone(storeContacts.whatsapp)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-muted-foreground/20 transition-colors"
                      title="WhatsApp"
                    >
                      <WhatsAppIcon className="h-5 w-5 text-foreground" />
                    </a>
                  )}
                  {storeContacts.telegram && (
                    <a
                      href={`https://t.me/${storeContacts.telegram.replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-muted-foreground/20 transition-colors"
                      title="Telegram"
                    >
                      <TelegramIcon className="h-5 w-5 text-foreground" />
                    </a>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Addresses Tab */}
          <TabsContent value="addresses">
            <div className="space-y-4">
              {/* Add address button */}
              {!showAddForm && addresses.length < 5 && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowAddForm(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Добавить адрес
                </Button>
              )}

              {/* Add address form */}
              {showAddForm && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Новый адрес</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label className="text-sm">Город</Label>
                      <Input
                        value={newCity}
                        onChange={(e) => setNewCity(e.target.value)}
                        placeholder="Например: Москва"
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Адрес (улица, дом, квартира)</Label>
                      <Input
                        value={newAddress}
                        onChange={(e) => setNewAddress(e.target.value)}
                        placeholder="ул. Ленина, д. 1, кв. 1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Название (необязательно)</Label>
                      <Input
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        placeholder="Дом, Работа..."
                      />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button
                        className="flex-1"
                        disabled={!newAddress.trim() || addingAddress}
                        onClick={async () => {
                          setAddingAddress(true);
                          const fullAddress = newCity ? `${newCity}, ${newAddress}` : newAddress;
                          await addAddress(fullAddress, newLabel || undefined, newCity || undefined);
                          setNewCity("");
                          setNewAddress("");
                          setNewLabel("");
                          setShowAddForm(false);
                          setAddingAddress(false);
                        }}
                      >
                        {addingAddress ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                        Сохранить
                      </Button>
                      <Button variant="outline" onClick={() => { setShowAddForm(false); setNewCity(""); setNewAddress(""); setNewLabel(""); }}>
                        Отмена
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Address list */}
              {addressesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : addresses.length === 0 && !showAddForm ? (
                <Card>
                  <CardContent className="py-10 text-center">
                    <MapPin className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                    <h3 className="font-medium mb-1">Адресов пока нет</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Добавьте адрес доставки для быстрого оформления заказов
                    </p>
                    <Button variant="outline" onClick={() => setShowAddForm(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Добавить адрес
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                addresses.map((addr) => (
                  <Card key={addr.id}>
                    <CardContent className="py-4 flex items-start gap-3">
                      <MapPin className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        {addr.label && (
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-medium">{addr.label}</span>
                            {addr.is_default && (
                              <Badge variant="secondary" className="text-xs py-0">
                                <Star className="h-3 w-3 mr-1" />
                                Основной
                              </Badge>
                            )}
                          </div>
                        )}
                        <p className="text-sm text-foreground">{addr.address}</p>
                        {addr.city && !addr.address.toLowerCase().includes(addr.city.toLowerCase()) && (
                          <p className="text-xs text-muted-foreground mt-0.5">{addr.city}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteAddress(addr.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}

              {addresses.length >= 5 && (
                <p className="text-xs text-muted-foreground text-center">
                  Максимум 5 адресов. Удалите один, чтобы добавить новый.
                </p>
              )}
            </div>
          </TabsContent>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Данные профиля</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Email</Label>
                  <Input value={profile?.email || ""} disabled className="bg-muted/50" />
                </div>
                <div>
                  <Label>Имя</Label>
                  <Input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    placeholder="Ваше имя"
                  />
                </div>
                <div>
                  <Label>Телефон</Label>
                  <Input
                    value={editPhone}
                    onChange={e => setEditPhone(e.target.value)}
                    placeholder="+7 (999) 123-45-67"
                  />
                </div>
                <Button onClick={handleSaveProfile} disabled={saving} className="w-full">
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Сохранить
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
