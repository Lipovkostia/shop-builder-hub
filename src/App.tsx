import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useParams, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import ResetPassword from "./pages/ResetPassword";
import TestStore from "./pages/TestStore";
import AdminPanel from "./pages/AdminPanel";
import SuperAdmin from "./pages/SuperAdmin";
import StoreFront from "./pages/StoreFront";
import SellerWorkspace from "./pages/SellerWorkspace";
import NotFound from "./pages/NotFound";
import RetailStore from "./pages/RetailStore";
import RetailCheckout from "./pages/RetailCheckout";
import WholesaleStore from "./pages/WholesaleStore";
import WholesaleProduct from "./pages/WholesaleProduct";
import WholesaleCheckout from "./pages/WholesaleCheckout";
import CatalogAccess from "./pages/CatalogAccess";
import CustomerDashboard from "./pages/CustomerDashboard";
import GuestCatalogView from "./pages/GuestCatalogView";
import { useStoreBySubdomain } from "@/hooks/useUserStore";
import { useCustomDomainResolver, isPlatformDomain } from "@/hooks/useCustomDomainResolver";
import { Skeleton } from "@/components/ui/skeleton";

const queryClient = new QueryClient();

// Wrapper component to load AdminPanel with store context from subdomain
function StoreAdminWrapper() {
  const { subdomain } = useParams<{ subdomain: string }>();
  const { store, loading, error } = useStoreBySubdomain(subdomain);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !store) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Магазин не найден</h1>
          <p className="text-muted-foreground">{error || "Магазин с таким адресом не существует"}</p>
        </div>
      </div>
    );
  }

  // Redirect to AdminPanel with storeId in URL
  return <Navigate to={`/admin?storeId=${store.id}`} replace />;
}

// Custom domain handler - resolves custom domains to appropriate store type
function CustomDomainHandler() {
  const { store, loading, error, isCustomDomain } = useCustomDomainResolver();

  // Not a custom domain - render nothing, let normal routing handle it
  if (!isCustomDomain) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !store) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold mb-2">Магазин не найден</h1>
          <p className="text-muted-foreground">
            {error || "Магазин для этого домена не настроен или не активирован"}
          </p>
        </div>
      </div>
    );
  }

  // Render appropriate store based on type, passing subdomain
  if (store.storeType === "wholesale") {
    return <WholesaleStore subdomainOverride={store.subdomain} />;
  }

  return <RetailStore subdomainOverride={store.subdomain} />;
}

// Main app component that decides between custom domain and platform routing
function AppRoutes() {
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  const isCustom = !isPlatformDomain(hostname);

  // If custom domain, use CustomDomainHandler exclusively
  if (isCustom) {
    return <CustomDomainHandler />;
  }

  // Platform domain - use standard routing
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/auth" element={<Navigate to="/" replace />} />
      <Route path="/dashboard" element={<Navigate to="/" replace />} />
      <Route path="/test-store" element={<TestStore />} />
      <Route path="/admin" element={<AdminPanel />} />
      <Route path="/super-admin" element={<SuperAdmin />} />
      {/* Customer routes */}
      <Route path="/catalog/:accessCode" element={<CatalogAccess />} />
      <Route path="/catalog/:accessCode/view" element={<GuestCatalogView />} />
      <Route path="/customer-dashboard" element={<CustomerDashboard />} />
      {/* Store routes - SellerWorkspace for seamless transitions */}
      <Route path="/store/:subdomain" element={<SellerWorkspace />} />
      <Route path="/store/:subdomain/admin" element={<StoreAdminWrapper />} />
      {/* Retail store routes */}
      <Route path="/retail/:subdomain" element={<RetailStore />} />
      <Route path="/retail/:subdomain/product/:productId" element={<RetailStore />} />
      <Route path="/retail/:subdomain/checkout" element={<RetailCheckout />} />
      {/* Wholesale B2B routes */}
      <Route path="/wholesale/:subdomain" element={<WholesaleStore />} />
      <Route path="/wholesale/:subdomain/product/:slug" element={<WholesaleProduct />} />
      <Route path="/wholesale/:subdomain/checkout" element={<WholesaleCheckout />} />
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;