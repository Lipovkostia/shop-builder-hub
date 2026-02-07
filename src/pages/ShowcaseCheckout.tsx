import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, ShoppingBag, MapPin, User, Phone, MessageSquare, Loader2, CheckCircle2, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useShowcaseStore } from "@/hooks/useShowcaseStore";
import { useShowcaseCart, ShowcaseCartItem } from "@/hooks/useShowcaseCart";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function formatPrice(price: number): string {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(price);
}

interface ShowcaseCheckoutProps {
  subdomain?: string;
}

export default function ShowcaseCheckout({ subdomain: propSubdomain }: ShowcaseCheckoutProps = {}) {
  const params = useParams();
  const subdomain = propSubdomain || params.subdomain;
  const navigate = useNavigate();
  const { store, loading: storeLoading } = useShowcaseStore(subdomain);
  const { cart, cartTotal, clearCart } = useShowcaseCart(subdomain || null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");

  useEffect(() => {
    if (!subdomain) return;
    const timeoutId = setTimeout(() => {
      if (!storeLoading && store && cart.length === 0 && !orderSuccess) {
        navigate(`/showcase/${subdomain}`, { replace: true });
      }
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [storeLoading, store, cart.length, orderSuccess, subdomain, navigate]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 0) {
      if (value[0] === "8") value = "7" + value.slice(1);
      if (value[0] !== "7") value = "7" + value;
      let formatted = "+7";
      if (value.length > 1) formatted += " (" + value.slice(1, 4);
      if (value.length > 4) formatted += ") " + value.slice(4, 7);
      if (value.length > 7) formatted += "-" + value.slice(7, 9);
      if (value.length > 9) formatted += "-" + value.slice(9, 11);
      setPhone(formatted);
    } else setPhone("");
  };

  const isFormValid = name.trim() && phone.length >= 10 && address.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store || !isFormValid || cart.length === 0) return;
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-retail-order", {
        body: {
          storeId: store.id,
          customerName: name.trim(),
          customerPhone: phone.trim(),
          customerAddress: address.trim(),
          customerComment: comment.trim() || null,
          source: "showcase",
          items: cart.map(item => ({
            productId: item.productId,
            productName: item.name,
            quantity: item.quantity,
            price: item.price,
            unit: item.unit,
          })),
        },
      });
      if (error) throw new Error(error.message || "Ошибка создания заказа");
      if (data?.success) {
        setOrderNumber(data.orderNumber);
        setOrderSuccess(true);
        clearCart();
        toast.success("Заказ успешно оформлен!");
      } else throw new Error(data?.error || "Не удалось создать заказ");
    } catch (err: any) {
      console.error("Order submission error:", err);
      toast.error(err.message || "Произошла ошибка при оформлении заказа");
    } finally { setIsSubmitting(false); }
  };

  if (storeLoading) {
    return (<div className="retail-theme min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>);
  }

  if (!store) {
    return (<div className="retail-theme min-h-screen bg-background flex items-center justify-center"><div className="text-center"><h1 className="text-2xl font-bold mb-2">Витрина не найдена</h1><p className="text-muted-foreground">Витрина не активирована</p></div></div>);
  }

  if (orderSuccess) {
    return (
      <div className="retail-theme min-h-screen bg-background">
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
          <div className="container mx-auto px-4 py-4 flex items-center gap-3">
            {store.showcase_logo_url || store.logo_url ? (
              <img src={store.showcase_logo_url || store.logo_url || ""} alt={store.showcase_name || store.name} className="h-10 w-auto object-contain" />
            ) : (<Store className="h-8 w-8 text-primary" />)}
            <span className="font-semibold text-lg text-foreground">{store.showcase_name || store.name}</span>
          </div>
        </header>
        <main className="container mx-auto px-4 py-12">
          <div className="max-w-md mx-auto text-center">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center animate-in zoom-in-50 duration-300">
              <CheckCircle2 className="h-12 w-12 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Заказ успешно оформлен!</h1>
            <p className="text-muted-foreground mb-6">Номер вашего заказа: <span className="font-semibold text-foreground">{orderNumber}</span></p>
            <div className="bg-muted/50 rounded-xl p-4 mb-8 text-left">
              <h3 className="font-medium text-foreground mb-2">Что дальше?</h3>
              <ul className="text-sm text-muted-foreground space-y-1.5">
                <li>• Мы свяжемся с вами для подтверждения заказа</li>
                <li>• Вы получите уведомление о статусе доставки</li>
                <li>• Сохраните номер заказа для отслеживания</li>
              </ul>
            </div>
            <Button asChild size="lg" className="w-full"><Link to={`/showcase/${subdomain}`}>Вернуться в витрину</Link></Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="retail-theme min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0"><ArrowLeft className="h-5 w-5" /></Button>
            <h1 className="text-xl font-semibold text-foreground">Оформление заказа</h1>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-6 pb-32">
        <div className="max-w-lg mx-auto space-y-6">
          <section className="bg-muted/30 rounded-2xl p-4 border border-border/50">
            <div className="flex items-center gap-2 mb-3">
              <ShoppingBag className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-foreground">Ваш заказ</h2>
              <span className="text-sm text-muted-foreground">({cart.length} {cart.length === 1 ? "товар" : cart.length < 5 ? "товара" : "товаров"})</span>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {cart.map((item) => (
                <div key={item.productId} className="flex items-center gap-3 py-2">
                  <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                    {item.image ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><ShoppingBag className="h-4 w-4 text-muted-foreground/30" /></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground line-clamp-1">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.quantity} × {formatPrice(item.price)}</p>
                  </div>
                  <span className="text-sm font-semibold text-foreground">{formatPrice(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-border/50 mt-3 pt-3 flex justify-between items-center">
              <span className="font-medium text-foreground">Итого:</span>
              <span className="text-xl font-bold text-foreground">{formatPrice(cartTotal)}</span>
            </div>
          </section>

          <form onSubmit={handleSubmit} className="space-y-5">
            <section className="space-y-4">
              <h2 className="font-semibold text-foreground flex items-center gap-2"><User className="h-5 w-5 text-primary" />Контактные данные</h2>
              <div className="space-y-2">
                <Label htmlFor="name">Имя *</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Как к вам обращаться?" required autoComplete="name" className="h-12" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Телефон *</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="phone" type="tel" value={phone} onChange={handlePhoneChange} placeholder="+7 (___) ___-__-__" required autoComplete="tel" className="h-12 pl-10" />
                </div>
              </div>
            </section>
            <section className="space-y-4">
              <h2 className="font-semibold text-foreground flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" />Доставка</h2>
              <div className="space-y-2">
                <Label htmlFor="address">Адрес доставки *</Label>
                <Textarea id="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Город, улица, дом, квартира" required autoComplete="street-address" className="min-h-[80px] resize-none" />
              </div>
            </section>
            <section className="space-y-4">
              <h2 className="font-semibold text-foreground flex items-center gap-2"><MessageSquare className="h-5 w-5 text-primary" />Дополнительно</h2>
              <div className="space-y-2">
                <Label htmlFor="comment">Комментарий к заказу</Label>
                <Textarea id="comment" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Пожелания к заказу, удобное время доставки..." className="min-h-[80px] resize-none" />
              </div>
            </section>
          </form>
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 bg-background border-t border-border p-4 safe-area-bottom">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-3">
            <span className="text-muted-foreground">К оплате:</span>
            <span className="text-2xl font-bold text-foreground">{formatPrice(cartTotal)}</span>
          </div>
          <Button onClick={handleSubmit} disabled={!isFormValid || isSubmitting} className="w-full h-14 text-base font-semibold rounded-2xl" size="lg">
            {isSubmitting ? (<><Loader2 className="h-5 w-5 animate-spin mr-2" />Оформляем заказ...</>) : "Оформить заказ"}
          </Button>
        </div>
      </div>
    </div>
  );
}
