import { useState, useCallback, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useStoreBySubdomain, useIsStoreOwner } from "@/hooks/useUserStore";
import { useStoreProducts } from "@/hooks/useStoreProducts";
import { useStoreCatalogs } from "@/hooks/useStoreCatalogs";
import { useCatalogProductSettings } from "@/hooks/useCatalogProductSettings";
import { useAuth } from "@/hooks/useAuth";
import StoreFront from "./StoreFront";
import AdminPanel from "./AdminPanel";

type ActiveView = "storefront" | "admin";

export default function SellerWorkspace() {
  const { subdomain } = useParams<{ subdomain: string }>();
  const { store, loading: storeLoading, error: storeError } = useStoreBySubdomain(subdomain);
  const { isOwner, loading: ownerLoading } = useIsStoreOwner(store?.id || null);
  const { user, profile, loading: authLoading } = useAuth();

  const [activeView, setActiveView] = useState<ActiveView>("storefront");
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationDirection, setAnimationDirection] = useState<"left" | "right">("left");
  
  // Сохраняем позицию скролла при переключении
  const storefrontScrollRef = useRef(0);
  const adminScrollRef = useRef(0);

  const handleSwitchToAdmin = useCallback(() => {
    if (isAnimating || activeView === "admin") return;
    
    // Сохраняем позицию скролла витрины
    storefrontScrollRef.current = window.scrollY;
    
    setAnimationDirection("left");
    setIsAnimating(true);
    
    // Небольшая задержка для анимации
    setTimeout(() => {
      setActiveView("admin");
      setIsAnimating(false);
      // Восстанавливаем позицию скролла админки
      window.scrollTo(0, adminScrollRef.current);
    }, 300);
  }, [activeView, isAnimating]);

  const handleSwitchToStorefront = useCallback(() => {
    if (isAnimating || activeView === "storefront") return;
    
    // Сохраняем позицию скролла админки
    adminScrollRef.current = window.scrollY;
    
    setAnimationDirection("right");
    setIsAnimating(true);
    
    setTimeout(() => {
      setActiveView("storefront");
      setIsAnimating(false);
      // Восстанавливаем позицию скролла витрины
      window.scrollTo(0, storefrontScrollRef.current);
    }, 300);
  }, [activeView, isAnimating]);

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

  // CSS классы для анимации
  const getAnimationClass = () => {
    if (!isAnimating) return "";
    
    if (animationDirection === "left") {
      return activeView === "storefront" 
        ? "animate-slide-out-left" 
        : "animate-slide-in-from-right";
    } else {
      return activeView === "admin" 
        ? "animate-slide-out-right" 
        : "animate-slide-in-from-left";
    }
  };

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <div className={`transition-transform duration-300 ease-in-out ${getAnimationClass()}`}>
        {activeView === "storefront" ? (
          <StoreFront 
            workspaceMode
            storeData={store}
            onSwitchToAdmin={handleSwitchToAdmin}
          />
        ) : (
          <AdminPanel 
            workspaceMode
            storeIdOverride={store.id}
            storeSubdomainOverride={store.subdomain}
            onSwitchToStorefront={handleSwitchToStorefront}
          />
        )}
      </div>
    </div>
  );
}
