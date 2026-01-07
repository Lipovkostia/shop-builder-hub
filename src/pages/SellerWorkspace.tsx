import { useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { useStoreBySubdomain } from "@/hooks/useUserStore";
import StoreFront from "./StoreFront";
import AdminPanel from "./AdminPanel";

type ActiveView = "storefront" | "admin";

export default function SellerWorkspace() {
  const { subdomain } = useParams<{ subdomain: string }>();
  const { store, loading: storeLoading, error: storeError } = useStoreBySubdomain(subdomain);

  const [activeView, setActiveView] = useState<ActiveView>("storefront");
  
  // Сохраняем позицию скролла при переключении
  const storefrontScrollRef = useRef(0);
  const adminScrollRef = useRef(0);

  const handleSwitchToAdmin = useCallback((section?: string) => {
    if (activeView === "admin") return;
    
    // Сохраняем позицию скролла витрины
    storefrontScrollRef.current = window.scrollY;
    setActiveView("admin");
    
    // Устанавливаем секцию через URL если нужно
    if (section) {
      window.history.replaceState(null, '', `?section=${section}`);
    }
    
    // Восстанавливаем позицию скролла админки после рендера
    requestAnimationFrame(() => {
      window.scrollTo(0, adminScrollRef.current);
    });
  }, [activeView]);

  const handleSwitchToStorefront = useCallback(() => {
    if (activeView === "storefront") return;
    
    // Сохраняем позицию скролла админки
    adminScrollRef.current = window.scrollY;
    setActiveView("storefront");
    
    // Восстанавливаем позицию скролла витрины после рендера
    requestAnimationFrame(() => {
      window.scrollTo(0, storefrontScrollRef.current);
    });
  }, [activeView]);

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
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Витрина */}
      <div 
        className="absolute inset-0 transition-transform duration-300 ease-out"
        style={{ 
          transform: activeView === "admin" ? "translateX(-100%)" : "translateX(0)",
          willChange: "transform"
        }}
      >
        <StoreFront 
          workspaceMode
          storeData={store}
          onSwitchToAdmin={handleSwitchToAdmin}
        />
      </div>
      
      {/* Панель управления */}
      <div 
        className="absolute inset-0 transition-transform duration-300 ease-out"
        style={{ 
          transform: activeView === "admin" ? "translateX(0)" : "translateX(100%)",
          willChange: "transform"
        }}
      >
        <AdminPanel 
          workspaceMode
          storeIdOverride={store.id}
          storeSubdomainOverride={store.subdomain}
          onSwitchToStorefront={handleSwitchToStorefront}
        />
      </div>
    </div>
  );
}
