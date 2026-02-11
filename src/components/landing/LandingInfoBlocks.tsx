import { Rocket, Store } from "lucide-react";

export default function LandingInfoBlocks() {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="rounded-lg border bg-card p-3 flex flex-col gap-1">
        <Rocket className="h-4 w-4 text-primary" />
        <p className="text-xs font-semibold leading-tight">Быстрый старт продаж</p>
        <p className="text-[10px] text-muted-foreground leading-tight">
          Выберите товары, добавьте в каталог — и уже сегодня принимайте заказы. Всё автоматизировано, вам остаётся только продавать.
        </p>
      </div>
      <div className="rounded-lg border bg-card p-3 flex flex-col gap-1">
        <Store className="h-4 w-4 text-primary" />
        <p className="text-xs font-semibold leading-tight">Витрина и каталоги</p>
        <p className="text-[10px] text-muted-foreground leading-tight">
          Розничная витрина, приватные каталоги для оптовых покупателей и интеграции с внешними системами — всё в одном месте.
        </p>
      </div>
    </div>
  );
}