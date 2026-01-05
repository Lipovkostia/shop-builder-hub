import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useParams, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import TestStore from "./pages/TestStore";
import AdminPanel from "./pages/AdminPanel";
import SuperAdmin from "./pages/SuperAdmin";
import StoreFront from "./pages/StoreFront";
import NotFound from "./pages/NotFound";
import { useStoreBySubdomain } from "@/hooks/useUserStore";
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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/test-store" element={<TestStore />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/super-admin" element={<SuperAdmin />} />
            {/* Store routes */}
            <Route path="/store/:subdomain" element={<StoreFront />} />
            <Route path="/store/:subdomain/admin" element={<StoreAdminWrapper />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;