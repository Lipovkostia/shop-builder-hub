import { Store as StoreIcon, Settings } from "lucide-react";
import { ForkliftIcon } from "@/components/icons/ForkliftIcon";

type ActiveView = "storefront" | "admin";

interface WorkspaceHeaderProps {
  storeName: string;
  storeLogo?: string | null;
  activeView: ActiveView;
  onViewChange: (view: ActiveView) => void;
  ordersCount?: number;
}

export function WorkspaceHeader({
  storeName,
  storeLogo,
  activeView,
  onViewChange,
  ordersCount = 0,
}: WorkspaceHeaderProps) {
  // Количество коробок для иконки погрузчика (0-3)
  const boxCount = Math.min(ordersCount, 3);

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

        {/* Табы */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
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
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeView === "admin"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            } ${ordersCount > 0 ? "mr-2" : ""}`}
          >
            {ordersCount > 0 ? (
              <ForkliftIcon boxCount={boxCount} className="w-4 h-4" />
            ) : (
              <Settings className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">Управление</span>
            {ordersCount > 0 && (
              <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                {ordersCount > 99 ? "99+" : ordersCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
