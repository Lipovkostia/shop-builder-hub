import { Store as StoreIcon, Settings, ShoppingCart } from "lucide-react";

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
  const handleOrdersClick = () => {
    if (onOrdersClick) {
      onOrdersClick();
    } else {
      onViewChange("admin");
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-background border-b border-border">
      <div className="h-12 flex items-center justify-between px-3">
        {/* Логотип и название */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {storeLogo ? (
            <img 
              src={storeLogo} 
              alt={storeName} 
              className="w-7 h-7 rounded object-cover flex-shrink-0" 
            />
          ) : (
            <div className="w-7 h-7 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
              <StoreIcon className="w-4 h-4 text-primary" />
            </div>
          )}
          <span className="text-sm font-medium truncate">{storeName}</span>
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

        {/* Табы */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1 flex-1 justify-end">
          {/* Витрина */}
          <button
            onClick={() => onViewChange("storefront")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeView === "storefront"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <StoreIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Витрина</span>
          </button>

          {/* Управление */}
          <button
            onClick={() => onViewChange("admin")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeView === "admin"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
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
