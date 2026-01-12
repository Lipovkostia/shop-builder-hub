import { useState, useCallback, useRef, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useStoreBySubdomain } from "@/hooks/useUserStore";
import { useStoreOrders } from "@/hooks/useOrders";
import { useIsStoreOwner } from "@/hooks/useUserStore";
import { useAuth } from "@/hooks/useAuth";
import { WorkspaceHeader } from "@/components/workspace/WorkspaceHeader";

import { OnboardingProvider } from "@/contexts/OnboardingContext";
import { OnboardingSpotlight } from "@/components/onboarding/SpotlightOverlay";
import StoreFront from "./StoreFront";
import AdminPanel from "./AdminPanel";

type ActiveView = "storefront" | "admin";

export default function SellerWorkspace() {
  const { subdomain } = useParams<{ subdomain: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { store, loading: storeLoading, error: storeError } = useStoreBySubdomain(subdomain);
  const { isOwner: isStoreOwner } = useIsStoreOwner(store?.id);
  const { isSuperAdmin } = useAuth();
  
  // Супер-админ или владелец магазина имеют полные права
  const hasFullAccess = isStoreOwner || isSuperAdmin;
  
  // Получаем количество заказов для владельца/супер-админа
  const { orders } = useStoreOrders(hasFullAccess && store?.id ? store.id : null);

  const [activeView, setActiveView] = useState<ActiveView>("storefront");
  
  // Прокручиваем страницу вверх при первом входе
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  
  // Сохраняем позицию скролла при переключении
  const storefrontScrollRef = useRef(0);
  const adminScrollRef = useRef(0);

  const handleViewChange = useCallback((view: ActiveView) => {
    if (view === activeView) return;
    
    // Сохраняем текущую позицию скролла
    if (activeView === "storefront") {
      storefrontScrollRef.current = window.scrollY;
    } else {
      adminScrollRef.current = window.scrollY;
    }
    
    setActiveView(view);
    
    // Восстанавливаем позицию скролла после рендера
    requestAnimationFrame(() => {
      if (view === "storefront") {
        window.scrollTo(0, storefrontScrollRef.current);
      } else {
        window.scrollTo(0, adminScrollRef.current);
      }
    });
  }, [activeView]);

  const handleSwitchToAdmin = useCallback((section?: string) => {
    if (section) {
      setSearchParams({ section });
    }
    handleViewChange("admin");
  }, [handleViewChange, setSearchParams]);

  const handleSwitchToStorefront = useCallback(() => {
    handleViewChange("storefront");
  }, [handleViewChange]);

  // Загрузка и ошибки
  if (storeLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (storeError || !store) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Магазин не найден</h1>
          <p className="text-muted-foreground">{storeError || "Магазин с таким адресом не существует"}</p>
        </div>
      </div>
    );
  }

  return (
    <OnboardingProvider>
      <div className="min-h-screen bg-background flex flex-col">
        {/* Onboarding spotlight overlay */}
        {hasFullAccess && <OnboardingSpotlight />}
        
        {/* Общая шапка с вкладками - для владельца или супер-админа */}
        {hasFullAccess && (
          <WorkspaceHeader
            storeName={store.name}
            storeLogo={store.logo_url}
            activeView={activeView}
            onViewChange={handleViewChange}
            onOrdersClick={() => handleSwitchToAdmin("orders")}
            ordersCount={orders.length}
          />
        )}
        
        {/* Контент - оба компонента рендерятся, но скрываются через CSS для сохранения состояния */}
        <div className="flex-1 overflow-hidden">
          <div className={activeView === "storefront" ? "block" : "hidden"}>
            <StoreFront 
              workspaceMode={hasFullAccess}
              storeData={store}
              onSwitchToAdmin={handleSwitchToAdmin}
            />
          </div>
          <div className={activeView === "admin" ? "block" : "hidden"}>
            <AdminPanel 
              workspaceMode={hasFullAccess}
              storeIdOverride={store.id}
              storeSubdomainOverride={store.subdomain}
              onSwitchToStorefront={handleSwitchToStorefront}
            />
          </div>
        </div>
      </div>
    </OnboardingProvider>
  );
}
