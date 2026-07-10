import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useCustomDomainStore } from "@/hooks/useCustomDomainStore";
import Index from "@/pages/Index";
import RetailStore from "@/pages/RetailStore";
import RetailProductPage from "@/pages/RetailProductPage";
import RetailCheckout from "@/pages/RetailCheckout";
import WholesaleStore from "@/pages/WholesaleStore";
import WholesaleProduct from "@/pages/WholesaleProduct";
import NotFound from "@/pages/NotFound";

interface CustomDomainHandlerProps {
  hostname: string;
}

export function CustomDomainHandler({ hostname }: CustomDomainHandlerProps) {
  const { store, storeType, subdomain, loading, error } = useCustomDomainStore(hostname);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="text-muted-foreground">Загрузка магазина...</p>
        </div>
      </div>
    );
  }

  // Store not found — render the main platform landing on this domain
  if (!store || !storeType || !subdomain) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    );
  }

  // Render store with internal routing
  return (
    <BrowserRouter>
      <Routes>
        {storeType === "wholesale" && (
          <>
            <Route path="/" element={<WholesaleStore subdomain={subdomain} />} />
            <Route path="/product/:slug" element={<WholesaleProduct subdomain={subdomain} />} />
          </>
        )}
        {storeType === "retail" && (
          <>
            <Route path="/" element={<RetailStore subdomain={subdomain} />} />
            <Route path="/p/:slug" element={<RetailProductPage subdomain={subdomain} />} />
            <Route path="/product/:productId" element={<RetailStore subdomain={subdomain} />} />
            <Route path="/checkout" element={<RetailCheckout subdomain={subdomain} />} />
          </>
        )}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
