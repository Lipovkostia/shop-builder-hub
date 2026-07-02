import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Component, lazy, Suspense, useEffect, type ErrorInfo, type ReactNode } from "react";
import { BrowserRouter, Routes, Route, useParams, Navigate } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { useStoreBySubdomain } from "@/hooks/useUserStore";
import { ProxyLogViewer } from "@/components/ProxyLogViewer";

const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const IndexLegacy = lazy(() => import("./pages/IndexLegacy"));
const TestStore = lazy(() => import("./pages/TestStore"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const SuperAdmin = lazy(() => import("./pages/SuperAdmin"));
const SellerWorkspace = lazy(() => import("./pages/SellerWorkspace"));
const RetailStore = lazy(() => import("./pages/RetailStore"));
const RetailProductPage = lazy(() => import("./pages/RetailProductPage"));
const RetailCheckout = lazy(() => import("./pages/RetailCheckout"));
const WholesaleStore = lazy(() => import("./pages/WholesaleStore"));
const WholesaleProduct = lazy(() => import("./pages/WholesaleProduct"));
const WholesaleCheckout = lazy(() => import("./pages/WholesaleCheckout"));
const CatalogAccess = lazy(() => import("./pages/CatalogAccess"));
const CustomerDashboard = lazy(() => import("./pages/CustomerDashboard"));
const GuestCatalogView = lazy(() => import("./pages/GuestCatalogView"));
const RetailCustomerDashboard = lazy(() => import("./pages/RetailCustomerDashboard"));
const Zakupka = lazy(() => import("./pages/Zakupka"));
const CustomDomainHandler = lazy(() =>
  import("@/components/CustomDomainHandler").then((module) => ({
    default: module.CustomDomainHandler,
  }))
);

const queryClient = new QueryClient();

declare global {
  interface Window {
    __setBootProgress?: (value: number, message?: string) => void;
  }
}

const AppLoadingFallback = ({ progress = 88, message = "Загрузка раздела…" }: { progress?: number; message?: string }) => (
  <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 px-6">
    <div className="text-sm font-semibold text-foreground">{message}</div>
    <div className="h-2 w-full max-w-[280px] overflow-hidden rounded-full bg-secondary">
      <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
    </div>
    <div className="text-xs text-muted-foreground">{progress}%</div>
  </div>
);

class AppErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("App failed to load", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6 text-center">
          <h1 className="text-xl font-semibold text-foreground">Не удалось загрузить страницу</h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            Обновите страницу. Если интернет нестабильный, повторная загрузка возьмёт сохранённые файлы из кеша.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Обновить
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

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

  useEffect(() => {
    window.__setBootProgress?.(96, "Отрисовка страницы…");
    const frame = requestAnimationFrame(() => {
      window.__setBootProgress?.(100, "Готово");
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  // If this is a custom domain, use the CustomDomainHandler
  if (!isPlatformDomain(hostname)) {
    return (
      <QueryClientProvider client={queryClient}>
        <HelmetProvider>
          <AuthProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <ProxyLogViewer />
              <AppErrorBoundary>
                <Suspense fallback={<AppLoadingFallback />}>
                  <CustomDomainHandler hostname={hostname} />
                </Suspense>
              </AppErrorBoundary>
            </TooltipProvider>
          </AuthProvider>
        </HelmetProvider>
      </QueryClientProvider>
    );
  }

  // Standard platform routing
    return (
      <QueryClientProvider client={queryClient}>
        <HelmetProvider>
          <AuthProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <ProxyLogViewer />
              <BrowserRouter>
                <AppErrorBoundary>
                  <Suspense fallback={<AppLoadingFallback progress={92} />}>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/index" element={<Index />} />
                    <Route path="/index.html" element={<Index />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/auth" element={<IndexLegacy />} />
                    <Route path="/login" element={<IndexLegacy />} />
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
                    <Route path="/retail/:subdomain/p/:slug" element={<RetailProductPage />} />
                    <Route path="/retail/:subdomain/product/:productId" element={<RetailStore />} />
                    <Route path="/retail/:subdomain/checkout" element={<RetailCheckout />} />
                    <Route path="/retail/:subdomain/account" element={<RetailCustomerDashboard />} />
                    {/* Wholesale B2B routes */}
                    <Route path="/wholesale/:subdomain" element={<WholesaleStore />} />
                    <Route path="/wholesale/:subdomain/checkout" element={<WholesaleCheckout />} />
                    <Route path="/wholesale/:subdomain/product/:slug" element={<WholesaleProduct />} />
                    {/* Zakupka mini-service */}
                    <Route path="/zakupka" element={<Zakupka />} />
                    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
                </AppErrorBoundary>
              </BrowserRouter>
            </TooltipProvider>
          </AuthProvider>
        </HelmetProvider>
      </QueryClientProvider>
    );
};

export default App;