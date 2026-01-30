import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { useCustomDomainStore } from "@/hooks/useCustomDomainStore";
import RetailStore from "@/pages/RetailStore";
import RetailCheckout from "@/pages/RetailCheckout";
import WholesaleStore from "@/pages/WholesaleStore";
import WholesaleProduct from "@/pages/WholesaleProduct";
import NotFound from "@/pages/NotFound";
import { Package } from "lucide-react";

interface CustomDomainHandlerProps {
  hostname: string;
}

/**
 * Handler component for custom domains.
 * Determines if the hostname matches a retail or wholesale store
 * and renders the appropriate storefront with internal routing.
 */
export function CustomDomainHandler({ hostname }: CustomDomainHandlerProps) {
  const { store, storeType, loading, error } = useCustomDomainStore(hostname);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Загрузка магазина...</p>
        </div>
      </div>
    );
  }

  // Store not found
  if (!store || !storeType) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Магазин не найден</h1>
          <p className="text-muted-foreground mb-2">
            Домен <strong>{hostname}</strong> не привязан к активному магазину.
          </p>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>
      </div>
    );
  }

  const subdomain = store.subdomain;

  // Render the appropriate store with internal routing
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
            <Route path="/product/:productId" element={<RetailStore subdomain={subdomain} />} />
            <Route path="/checkout" element={<RetailCheckout subdomain={subdomain} />} />
          </>
        )}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
