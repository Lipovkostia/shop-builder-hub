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
import RetailCustomerDashboard from "./pages/RetailCustomerDashboard";
import { useStoreBySubdomain } from "@/hooks/useUserStore";
import { Skeleton } from "@/components/ui/skeleton";
import { CustomDomainHandler } from "@/components/CustomDomainHandler";

const queryClient = new QueryClient();

// Check if hostname is a platform domain (not a custom domain)
function isPlatformDomain(hostname: string): boolean {
  // Main platform domains - these should show the main service, not custom stores
  const platformDomains = [
    '9999999999.ru',
    'www.9999999999.ru',
    'shopify-on-sub.lovable.app',
  ];
  
  return (
    platformDomains.includes(hostname) ||
    hostname.endsWith('.lovable.app') ||
    hostname.endsWith('.lovable.dev') ||
    hostname.endsWith('.lovableproject.com') ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    hostname.includes('preview--')
  );
}

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

const App = () => {
  const hostname = window.location.hostname;

  // If this is a custom domain, use the CustomDomainHandler
  if (!isPlatformDomain(hostname)) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <CustomDomainHandler hostname={hostname} />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    );
  }

  // Standard platform routing
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
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
              <Route path="/retail/:subdomain/account" element={<RetailCustomerDashboard />} />
              {/* Wholesale B2B routes */}
              <Route path="/wholesale/:subdomain" element={<WholesaleStore />} />
              <Route path="/wholesale/:subdomain/checkout" element={<WholesaleCheckout />} />
              <Route path="/wholesale/:subdomain/product/:slug" element={<WholesaleProduct />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;