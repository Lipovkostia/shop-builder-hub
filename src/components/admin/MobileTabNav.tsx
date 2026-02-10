import { useEffect, useRef } from "react";
import { Package, Download, FolderOpen, Users, Eye, ShoppingCart, HelpCircle, User, History, Trash2, Store, Warehouse, Tag, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

type ActiveSection = "products" | "megacatalog" | "import" | "catalogs" | "visibility" | "profile" | "orders" | "clients" | "history" | "trash" | "help" | "retail" | "showcase" | "wholesale" | "category-settings";

interface NavItem {
  id: ActiveSection;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { id: "products", label: "Ассортимент", icon: Package },
  { id: "catalogs", label: "Прайс-листы", icon: FolderOpen },
  { id: "orders", label: "Заказы", icon: ShoppingCart },
  { id: "retail", label: "Розница", icon: Store },
  { id: "showcase", label: "Витрина", icon: Globe },
  { id: "wholesale", label: "Опт", icon: Warehouse },
  { id: "import", label: "Импорт", icon: Download },
  { id: "clients", label: "Клиенты", icon: Users },
  { id: "visibility", label: "Видимость", icon: Eye },
  { id: "trash", label: "Корзина", icon: Trash2 },
  { id: "history", label: "История", icon: History },
  { id: "profile", label: "Профиль", icon: User },
  { id: "help", label: "Помощь", icon: HelpCircle },
  { id: "category-settings", label: "Категории", icon: Tag },
];

interface MobileTabNavProps {
  activeSection: ActiveSection;
  onSectionChange: (section: ActiveSection) => void;
  workspaceMode?: boolean;
}

export function MobileTabNav({ activeSection, onSectionChange, workspaceMode }: MobileTabNavProps) {
  const navRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);

  // Scroll active tab into view
  useEffect(() => {
    if (activeTabRef.current && navRef.current) {
      const nav = navRef.current;
      const tab = activeTabRef.current;
      const navRect = nav.getBoundingClientRect();
      const tabRect = tab.getBoundingClientRect();
      
      // Calculate center position
      const scrollLeft = tab.offsetLeft - navRect.width / 2 + tabRect.width / 2;
      
      nav.scrollTo({
        left: Math.max(0, scrollLeft),
        behavior: "smooth",
      });
    }
  }, [activeSection]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent, currentIndex: number) => {
    let newIndex = currentIndex;
    
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      newIndex = currentIndex > 0 ? currentIndex - 1 : navItems.length - 1;
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      newIndex = currentIndex < navItems.length - 1 ? currentIndex + 1 : 0;
    } else if (e.key === "Home") {
      e.preventDefault();
      newIndex = 0;
    } else if (e.key === "End") {
      e.preventDefault();
      newIndex = navItems.length - 1;
    } else {
      return;
    }
    
    onSectionChange(navItems[newIndex].id);
  };

  return (
    <nav
      ref={navRef}
      role="tablist"
      aria-label="Навигация панели управления"
      className={cn(
        "sticky z-40 bg-card border-b border-border overflow-x-auto scrollbar-hide",
        workspaceMode ? "top-0" : "top-14"
      )}
      style={{ 
        scrollbarWidth: "none", 
        msOverflowStyle: "none",
        WebkitOverflowScrolling: "touch"
      }}
    >
      <div className="flex min-w-max px-2 py-1.5 gap-1">
        {navItems.map((item, index) => {
          const isActive = activeSection === item.id;
          const Icon = item.icon;
          
          return (
            <button
              key={item.id}
              ref={isActive ? activeTabRef : null}
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${item.id}`}
              tabIndex={isActive ? 0 : -1}
              data-onboarding-tab={item.id}
              onClick={() => onSectionChange(item.id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200 ease-out flex-shrink-0",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm transform scale-[1.02]"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground active:bg-muted/80"
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
