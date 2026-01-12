import { Store as StoreIcon, Settings, ShoppingCart } from "lucide-react";
import { useOnboardingSafe } from "@/contexts/OnboardingContext";

type ActiveView = "storefront" | "admin";

interface WorkspaceHeaderProps {
  storeName: string;
  storeLogo?: string | null;
  activeView: ActiveView;
  onViewChange: (view: ActiveView) => void;
  onOrdersClick?: () => void;
  ordersCount?: number;
}

export function WorkspaceHeader({
  storeName,
  storeLogo,
  activeView,
  onViewChange,
  onOrdersClick,
  ordersCount = 0,
}: WorkspaceHeaderProps) {
  const onboarding = useOnboardingSafe();

  const handleOrdersClick = () => {
    if (onOrdersClick) {
      onOrdersClick();
    } else {
      onViewChange("admin");
    }
  };

  const handleAdminClick = () => {
    // Если онбординг на шаге "go-to-admin", продвигаем на следующий шаг
    if (onboarding?.isActive && onboarding.currentStep?.id === 'go-to-admin') {
      onboarding.nextStep();
    }
    onViewChange("admin");
  };

  return (
    <header className="sticky top-0 z-50 bg-background border-b border-border">
      <div className="h-12 flex items-center justify-between px-3">
        {/* Витрина - слева */}
        <div className="flex-1">
          <button
            onClick={() => onViewChange("storefront")}
            data-onboarding-storefront-button
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeView === "storefront"
                ? "bg-muted text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <StoreIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Витрина</span>
          </button>
        </div>

        {/* Мои заказы - по центру */}
        <button
          className="relative flex items-center justify-center p-2 rounded-full hover:bg-muted transition-colors"
          onClick={handleOrdersClick}
          title="Мои заказы"
        >
          <ShoppingCart className="w-5 h-5 text-muted-foreground" />
          {ordersCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center px-1">
              {ordersCount > 99 ? "99+" : ordersCount}
            </span>
          )}
        </button>

        {/* Управление - справа */}
        <div className="flex-1 flex justify-end">
          <button
            onClick={handleAdminClick}
            data-onboarding-admin-button
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeView === "admin"
                ? "bg-muted text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Управление</span>
          </button>
        </div>
      </div>
    </header>
  );
}
