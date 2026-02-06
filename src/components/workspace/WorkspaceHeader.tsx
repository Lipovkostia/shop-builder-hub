import { useState } from "react";
import { Store as StoreIcon, Settings, ShoppingCart, Sparkles } from "lucide-react";
import { useOnboardingSafe } from "@/contexts/OnboardingContext";
import { AIAssistantPanel } from "@/components/admin/AIAssistantPanel";

type ActiveView = "storefront" | "admin";

interface WorkspaceHeaderProps {
  storeName: string;
  storeLogo?: string | null;
  storeId?: string | null;
  activeView: ActiveView;
  onViewChange: (view: ActiveView) => void;
  onOrdersClick?: () => void;
  ordersCount?: number;
  onCatalogClick?: () => void;
}

export function WorkspaceHeader({
  storeName,
  storeLogo,
  storeId,
  activeView,
  onViewChange,
  onOrdersClick,
  ordersCount = 0,
  onCatalogClick,
}: WorkspaceHeaderProps) {
  const onboarding = useOnboardingSafe();
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);

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
    <>
      <header className="sticky top-0 z-50 bg-background border-b border-border">
        <div className="h-12 flex items-center justify-between px-3">
          {/* Витрина и Каталог - слева */}
          <div className="flex-1 flex items-center gap-1">
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
            {onCatalogClick && (
              <button
                onClick={onCatalogClick}
                className="flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                Каталог
              </button>
            )}
          </div>

          {/* Центральная часть - Заказы, AI, и Управление */}
          <div className="flex items-center gap-3">
            {/* Мои заказы */}
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

            {/* AI Помощник - по центру между заказами и шестерёнкой */}
            <button
              onClick={() => setAiAssistantOpen(true)}
              className="relative flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 shadow-md shadow-purple-500/40 hover:shadow-purple-500/60 hover:scale-110 transition-all duration-300"
              title="AI Помощник"
            >
              <Sparkles className="w-4 h-4 text-white" />
              <span className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 animate-pulse opacity-30"></span>
            </button>

            {/* Управление */}
            <button
              onClick={handleAdminClick}
              data-onboarding-admin-button
              className={`flex items-center justify-center p-2 rounded-full transition-colors ${
                activeView === "admin"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
              title="Управление"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>

          {/* Правая часть - пустая для баланса */}
          <div className="flex-1 flex justify-end">
            {/* Placeholder for balance */}
          </div>
        </div>
      </header>

      {/* AI Assistant Panel */}
      <AIAssistantPanel
        open={aiAssistantOpen}
        onOpenChange={setAiAssistantOpen}
        storeId={storeId || null}
      />
    </>
  );
}
