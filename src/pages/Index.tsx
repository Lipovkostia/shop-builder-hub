import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Store, ShoppingCart, BarChart3, CreditCard, Mail, Truck, Star, Shield, Zap } from "lucide-react";

const Index = () => {
  const features = [
    {
      icon: Store,
      title: "Персональный магазин",
      description: "Получите уникальный поддомен и настройте внешний вид под ваш бренд",
    },
    {
      icon: ShoppingCart,
      title: "Управление товарами",
      description: "Легко добавляйте товары, категории, управляйте остатками и ценами",
    },
    {
      icon: BarChart3,
      title: "Аналитика продаж",
      description: "Отслеживайте метрики: продажи, конверсию, средний чек в реальном времени",
    },
    {
      icon: CreditCard,
      title: "Приём платежей",
      description: "Интеграция с российскими платёжными системами: ЮKassa, Тинькофф",
    },
    {
      icon: Mail,
      title: "Email-рассылки",
      description: "Отправляйте уведомления и маркетинговые письма вашим покупателям",
    },
    {
      icon: Truck,
      title: "Настройка доставки",
      description: "Гибкие тарифы и зоны доставки для вашего магазина",
    },
  ];

  const benefits = [
    { icon: Zap, text: "Запуск за 5 минут" },
    { icon: Shield, text: "Безопасные платежи" },
    { icon: Star, text: "Без комиссий платформы" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-lg">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-primary">
              <Store className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-bold">ShopForge</span>
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            <Link to="#features" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              Возможности
            </Link>
            <Link to="#pricing" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              Тарифы
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link to="/auth">Войти</Link>
            </Button>
            <Button asChild className="gradient-primary border-0">
              <Link to="/auth?mode=register">Создать магазин</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden pt-32 pb-20 md:pt-40 md:pb-32">
        <div className="absolute inset-0 gradient-hero" />
        <div className="absolute top-20 left-10 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-20 right-10 h-72 w-72 rounded-full bg-primary/5 blur-3xl" />
        
        <div className="container relative">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground">
              <Zap className="h-4 w-4" />
              Запустите свой магазин сегодня
            </div>
            
            <h1 className="mb-6 font-display text-4xl font-bold tracking-tight md:text-6xl lg:text-7xl">
              Создайте{" "}
              <span className="text-gradient">интернет-магазин</span>{" "}
              за минуты
            </h1>
            
            <p className="mb-10 text-lg text-muted-foreground md:text-xl">
              Полноценная платформа для электронной коммерции с персональным поддоменом, 
              приёмом платежей, аналитикой и всем необходимым для успешных продаж.
            </p>
            
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button size="lg" asChild className="gradient-primary border-0 px-8 text-lg shadow-glow">
                <Link to="/auth?mode=register">
                  Начать бесплатно
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="px-8 text-lg">
                <Link to="#features">
                  Узнать больше
                </Link>
              </Button>
            </div>
            
            <div className="mt-10 flex items-center justify-center gap-8">
              {benefits.map((benefit, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <benefit.icon className="h-4 w-4 text-primary" />
                  {benefit.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 md:py-32">
        <div className="container">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <h2 className="mb-4 font-display text-3xl font-bold md:text-4xl">
              Всё для вашего бизнеса
            </h2>
            <p className="text-lg text-muted-foreground">
              Мощные инструменты для управления магазином, которые помогут вам продавать больше
            </p>
          </div>
          
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, idx) => (
              <Card 
                key={idx} 
                className="group border-border/50 bg-card transition-all duration-300 hover:border-primary/30 hover:shadow-lg"
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                <CardContent className="p-6">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent transition-colors group-hover:bg-primary/10">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="mb-2 font-display text-lg font-semibold">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-32">
        <div className="container">
          <Card className="overflow-hidden border-0 gradient-primary">
            <CardContent className="p-10 text-center md:p-16">
              <h2 className="mb-4 font-display text-3xl font-bold text-primary-foreground md:text-4xl">
                Готовы начать продавать?
              </h2>
              <p className="mx-auto mb-8 max-w-xl text-lg text-primary-foreground/80">
                Присоединяйтесь к тысячам продавцов, которые уже используют ShopForge 
                для развития своего бизнеса
              </p>
              <Button size="lg" variant="secondary" asChild className="px-8 text-lg">
                <Link to="/auth?mode=register">
                  Создать магазин бесплатно
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-10">
        <div className="container">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary">
                <Store className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-display font-semibold">ShopForge</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 ShopForge. Все права защищены.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;