import { useState } from "react";
import { Store as StoreIcon, Settings, ShoppingCart, Sparkles, LayoutGrid, ChevronRight, ChevronDown, Folder } from "lucide-react";
import { useOnboardingSafe } from "@/contexts/OnboardingContext";
import { AIAssistantPanel } from "@/components/admin/AIAssistantPanel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import type { StoreFrontCategory } from "@/pages/StoreFront";

type ActiveView = "storefront" | "admin";

interface WorkspaceHeaderProps {
  storeName: string;
  storeLogo?: string | null;
  storeId?: string | null;
  activeView: ActiveView;
  onViewChange: (view: ActiveView) => void;
  onOrdersClick?: () => void;
  ordersCount?: number;
  categories?: StoreFrontCategory[];
  categoryFilter?: string | null;
  onCategoryChange?: (filter: string | null) => void;
}

export function WorkspaceHeader({
  storeName,
  storeLogo,
  storeId,
  activeView,
  onViewChange,
  onOrdersClick,
  ordersCount = 0,
  categories = [],
  categoryFilter = null,
  onCategoryChange,
}: WorkspaceHeaderProps) {
  const onboarding = useOnboardingSafe();
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const handleOrdersClick = () => {
    if (onOrdersClick) {
      onOrdersClick();
    } else {
      onViewChange("admin");
    }
  };

  const handleAdminClick = () => {
    if (onboarding?.isActive && onboarding.currentStep?.id === 'go-to-admin') {
      onboarding.nextStep();
    }
    onViewChange("admin");
  };

  const showCategories = activeView === "storefront" && categories.length > 0;

  return (
    <>
      <header className="sticky top-0 z-50 bg-background border-b border-border">
        <div className="h-12 flex items-center justify-between px-3">
          {/* Левая часть - категории + Витрина */}
          <div className="flex-1 flex items-center gap-1">
            {/* Category dropdown */}
            {showCategories && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={`flex items-center justify-center p-2 rounded-md transition-colors ${
                      categoryFilter ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                    title="Категории"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[220px] max-h-[400px] overflow-y-auto bg-popover z-[60]">
                  <DropdownMenuItem
                    onClick={() => onCategoryChange?.(null)}
                    className={`cursor-pointer ${categoryFilter === null ? 'font-semibold bg-primary/10' : ''}`}
                  >
                    Все товары
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {(() => {
                    const topLevel = categories.filter(cat => !cat.catalog_parent_id);

                    return topLevel.map((cat) => {
                      const children = categories.filter(c => c.catalog_parent_id === cat.id);
                      const isSection = children.length > 0;
                      const isExpanded = expandedSections.has(cat.id);

                      if (isSection) {
                        return (
                          <div key={cat.id}>
                            <div
                              className={`flex items-center gap-1 px-2 py-1.5 text-sm cursor-pointer rounded-sm hover:bg-accent transition-colors ${
                                categoryFilter === cat.id ? 'bg-primary/10 font-semibold' : ''
                              }`}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setExpandedSections(prev => {
                                  const next = new Set(prev);
                                  if (next.has(cat.id)) next.delete(cat.id);
                                  else next.add(cat.id);
                                  return next;
                                });
                              }}
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                              )}
                              <Folder className="w-3.5 h-3.5 text-primary/70 flex-shrink-0" />
                              <span className="font-semibold text-foreground">{cat.name}</span>
                              {cat.product_count > 0 && (
                                <span className="text-xs text-muted-foreground ml-auto">{cat.product_count}</span>
                              )}
                            </div>
                            {isExpanded && (
                              <div>
                                <DropdownMenuItem
                                  onClick={() => onCategoryChange?.(cat.id)}
                                  className={`cursor-pointer pl-8 text-xs text-muted-foreground ${
                                    categoryFilter === cat.id ? 'font-semibold bg-primary/10' : ''
                                  }`}
                                >
                                  Все в «{cat.name}»
                                </DropdownMenuItem>
                                {children.map(child => (
                                  <DropdownMenuItem
                                    key={child.id}
                                    onClick={() => onCategoryChange?.(child.id)}
                                    className={`cursor-pointer pl-8 ${
                                      categoryFilter === child.id ? 'font-semibold bg-primary/10' : ''
                                    }`}
                                  >
                                    {child.name}
                                    {child.product_count > 0 && (
                                      <span className="text-xs text-muted-foreground ml-auto">{child.product_count}</span>
                                    )}
                                  </DropdownMenuItem>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      }

                      return (
                        <DropdownMenuItem
                          key={cat.id}
                          onClick={() => onCategoryChange?.(cat.id)}
                          className={`cursor-pointer ${categoryFilter === cat.id ? 'font-semibold bg-primary/10' : ''}`}
                        >
                          {cat.name}
                          {cat.product_count > 0 && (
                            <span className="text-xs text-muted-foreground ml-auto">{cat.product_count}</span>
                          )}
                        </DropdownMenuItem>
                      );
                    });
                  })()}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

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

            {/* AI Помощник */}
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
