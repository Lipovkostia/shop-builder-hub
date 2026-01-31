import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useCustomDomainStore } from "@/hooks/useCustomDomainStore";
import { Skeleton } from "@/components/ui/skeleton";
import { Package } from "lucide-react";
import RetailStore from "@/pages/RetailStore";
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

  // Store not found
  if (!store || !storeType || !subdomain) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Магазин не найден</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            {error || `Домен ${hostname} не привязан ни к одному магазину`}
          </p>
        </div>
      </div>
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
            <Route path="/product/:productId" element={<RetailStore subdomain={subdomain} />} />
            <Route path="/checkout" element={<RetailCheckout subdomain={subdomain} />} />
          </>
        )}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
