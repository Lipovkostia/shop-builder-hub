import { useState, useCallback, useRef, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useStoreBySubdomain } from "@/hooks/useUserStore";
import { useStoreOrders } from "@/hooks/useOrders";
import { useIsStoreOwner } from "@/hooks/useUserStore";
import { useAuth } from "@/hooks/useAuth";
import { WorkspaceHeader } from "@/components/workspace/WorkspaceHeader";
import { OnboardingWelcomeModal } from "@/components/onboarding/OnboardingWelcomeModal";
import { SpotlightOverlay } from "@/components/onboarding/SpotlightOverlay";
import { sellerOnboardingStep1 } from "@/components/onboarding/onboardingSteps";
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
  
  // Onboarding step 1 state - triggered after seller registration
  // Only show if explicitly triggered AND not completed before
  const [onboardingStep1Active, setOnboardingStep1Active] = useState(() => {
    const isTriggered = localStorage.getItem('seller_onboarding_step1') === 'true';
    const isCompleted = localStorage.getItem('seller_onboarding_completed') === 'true';
    return isTriggered && !isCompleted;
  });
  
  // Track if welcome modal was completed - spotlight only shows after this
  const [welcomeCompleted, setWelcomeCompleted] = useState(() => {
    // If welcome was already shown before, consider it completed
    return localStorage.getItem('seller_onboarding_welcome_shown') === 'true';
  });
  
  // Onboarding step 9 state - triggered when user completes step 8 and switches to storefront
  const [onboardingStep9Active, setOnboardingStep9Active] = useState(false);
  
  // Onboarding step 10 state - triggered when user completes step 9
  const [onboardingStep10Active, setOnboardingStep10Active] = useState(false);
  
  // Trigger refetch in StoreFront when switching from admin
  const [triggerStorefrontRefetch, setTriggerStorefrontRefetch] = useState(false);
  
  // Сохраняем позицию скролла при переключении
  const storefrontScrollRef = useRef(0);
  const adminScrollRef = useRef(0);

  const handleViewChange = useCallback((view: ActiveView) => {
    if (view === activeView) return;
    
    // Complete onboarding step 1 when switching to admin
    if (view === "admin" && onboardingStep1Active) {
      localStorage.removeItem('seller_onboarding_step1');
      setOnboardingStep1Active(false);
    }
    
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
  }, [activeView, onboardingStep1Active]);
  
  // Handle spotlight step completion - switches to admin
  const handleSpotlightStepComplete = useCallback(() => {
    // Switch to admin panel when spotlight step is completed
    handleViewChange("admin");
  }, [handleViewChange]);
  
  const handleSpotlightSkip = useCallback(() => {
    localStorage.removeItem('seller_onboarding_step1');
    setOnboardingStep1Active(false);
  }, []);
  
  const handleSpotlightClose = useCallback(() => {
    localStorage.removeItem('seller_onboarding_step1');
    setOnboardingStep1Active(false);
  }, []);

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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Welcome modal for first-time sellers */}
      {hasFullAccess && (
        <OnboardingWelcomeModal onComplete={() => {
          // Modal completed, now show spotlight
          setWelcomeCompleted(true);
        }} />
      )}
      
      {/* Spotlight overlay for step 1 - go to admin panel (only after welcome modal) */}
      <SpotlightOverlay
        steps={sellerOnboardingStep1}
        currentStep={0}
        onStepComplete={handleSpotlightStepComplete}
        onSkip={handleSpotlightSkip}
        onClose={handleSpotlightClose}
        isActive={onboardingStep1Active && hasFullAccess && activeView === "storefront" && welcomeCompleted}
      />
      
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
            onboardingStep1Active={onboardingStep1Active}
            onOnboardingStep1Complete={() => {
              localStorage.removeItem('seller_onboarding_step1');
              setOnboardingStep1Active(false);
            }}
            onboardingStep9Active={onboardingStep9Active}
            onOnboardingStep9Complete={() => {
              setOnboardingStep9Active(false);
              setOnboardingStep10Active(true);
            }}
            onboardingStep10Active={onboardingStep10Active}
            onOnboardingStep10Complete={() => {
              setOnboardingStep10Active(false);
              // Mark onboarding as completed so it doesn't restart on refresh
              localStorage.setItem('seller_onboarding_completed', 'true');
              localStorage.removeItem('seller_onboarding_step1');
            }}
            triggerRefetch={triggerStorefrontRefetch}
            onRefetchComplete={() => setTriggerStorefrontRefetch(false)}
          />
        </div>
        <div className={activeView === "admin" ? "block" : "hidden"}>
          <AdminPanel 
            workspaceMode={hasFullAccess}
            storeIdOverride={store.id}
            storeSubdomainOverride={store.subdomain}
            onSwitchToStorefront={handleSwitchToStorefront}
            onTriggerOnboardingStep9={() => {
              setOnboardingStep9Active(true);
              setTriggerStorefrontRefetch(true);
              handleViewChange("storefront");
            }}
          />
        </div>
      </div>
    </div>
  );
}
