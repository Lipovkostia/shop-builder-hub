import React, { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Store, Package, Tag, Users, Settings, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStoreBySubdomain, useIsStoreOwner } from "@/hooks/useUserStore";
import { useStoreProducts } from "@/hooks/useStoreProducts";
import { useStoreCatalogs } from "@/hooks/useStoreCatalogs";
import { useCustomerRoles } from "@/hooks/useCustomerRoles";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";

// Import existing admin components
import { ProductPricingDialog } from "@/components/admin/ProductPricingDialog";
import { CustomerRolesManager } from "@/components/admin/CustomerRolesManager";
import { CustomerRole } from "@/components/admin/types";

// Loading Skeleton
function AdminSkeleton() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="flex items-center gap-4 mb-6">
        <Skeleton className="h-10 w-10" />
        <div>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32 mt-1" />
        </div>
      </div>
      <Skeleton className="h-10 w-full max-w-md mb-6" />
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
}

// Access Denied Component
function AccessDenied() {
  const navigate = useNavigate();
  
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
          <Store className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Доступ запрещён</h1>
        <p className="text-muted-foreground mb-6">
          У вас нет прав для управления этим магазином. Войдите как владелец магазина.
        </p>
        <div className="flex gap-2 justify-center">
          <Button variant="outline" onClick={() => navigate(-1)}>
            Назад
          </Button>
          <Button asChild>
            <Link to="/auth">Войти</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

// Main StoreAdmin Component
export default function StoreAdmin() {
  const { subdomain } = useParams<{ subdomain: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  
  const { store, loading: storeLoading, error: storeError } = useStoreBySubdomain(subdomain);
  const { isOwner, loading: ownerLoading } = useIsStoreOwner(store?.id || null);
  const { products, loading: productsLoading, updateProduct, deleteProduct } = useStoreProducts(store?.id || null);
  const { catalogs, productVisibility, createCatalog, updateCatalog, deleteCatalog, setProductCatalogs } = useStoreCatalogs(store?.id || null);
  const { roles, createRole, updateRole, deleteRole } = useCustomerRoles(store?.id || null);
  
  const [activeTab, setActiveTab] = useState("products");
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Check loading states
  const isLoading = authLoading || storeLoading || ownerLoading;

  if (isLoading) {
    return <AdminSkeleton />;
  }

  // Check if store exists
  if (storeError || !store) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Магазин не найден</h1>
          <p className="text-muted-foreground mb-4">
            {storeError || "Магазин с таким адресом не существует"}
          </p>
          <Button onClick={() => navigate("/dashboard")}>
            В личный кабинет
          </Button>
        </div>
      </div>
    );
  }

  // Check ownership
  if (!isOwner) {
    return <AccessDenied />;
  }

  // Convert products to format expected by existing components
  const formattedProducts = products.map(p => ({
    id: p.id,
    name: p.name,
    description: p.description || "",
    pricePerUnit: p.price,
    buyPrice: p.buy_price || undefined,
    markup: p.markup_type && p.markup_value !== null ? {
      type: p.markup_type as "percent" | "rubles",
      value: p.markup_value,
    } : undefined,
    unit: p.unit || "шт",
    image: p.images?.[0] || "",
    images: p.images || [],
    productType: "weight" as const,
    packagingType: (p.packaging_type as any) || "piece",
    unitWeight: p.unit_weight || undefined,
    portionWeight: p.portion_weight || undefined,
    inStock: p.is_active !== false,
    isHit: false,
    status: p.is_active === false ? "hidden" as const : "in_stock" as const,
    source: "local" as const,
    portionPrices: {
      fullPricePerKg: p.price_full || undefined,
      halfPricePerKg: p.price_half || undefined,
      quarterPricePerKg: p.price_quarter || undefined,
      portionPrice: p.price_portion || undefined,
    },
  }));

  const handleProductSave = async (updatedProduct: any) => {
    await updateProduct(updatedProduct.id, {
      name: updatedProduct.name,
      description: updatedProduct.description,
      price: updatedProduct.pricePerUnit,
      buy_price: updatedProduct.buyPrice,
      markup_type: updatedProduct.markup?.type,
      markup_value: updatedProduct.markup?.value,
      unit: updatedProduct.unit,
      packaging_type: updatedProduct.packagingType,
      unit_weight: updatedProduct.unitWeight,
      portion_weight: updatedProduct.portionWeight,
      is_active: updatedProduct.status !== "hidden",
      price_full: updatedProduct.portionPrices?.fullPricePerKg,
      price_half: updatedProduct.portionPrices?.halfPricePerKg,
      price_quarter: updatedProduct.portionPrices?.quarterPricePerKg,
      price_portion: updatedProduct.portionPrices?.portionPrice,
    });
    setEditDialogOpen(false);
    setEditingProduct(null);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              {store.logo_url ? (
                <img src={store.logo_url} alt={store.name} className="w-10 h-10 rounded-lg object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Store className="h-5 w-5 text-primary" />
                </div>
              )}
              <div>
                <h1 className="font-bold">{store.name}</h1>
                <p className="text-xs text-muted-foreground">Панель управления</p>
              </div>
            </div>
            
            <Button variant="outline" size="sm" asChild>
              <Link to={`/store/${subdomain}`} target="_blank">
                <ExternalLink className="h-4 w-4 mr-2" />
                Открыть витрину
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="products" className="gap-2">
              <Package className="h-4 w-4" />
              Товары
            </TabsTrigger>
            <TabsTrigger value="catalogs" className="gap-2">
              <Tag className="h-4 w-4" />
              Прайс-листы
            </TabsTrigger>
            <TabsTrigger value="roles" className="gap-2">
              <Users className="h-4 w-4" />
              Роли клиентов
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              Настройки
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products">
            <div className="rounded-lg border">
              <div className="p-4 border-b bg-muted/30">
                <h2 className="font-semibold">Товары ({products.length})</h2>
                <p className="text-sm text-muted-foreground">
                  Управление ассортиментом магазина
                </p>
              </div>
              
              {productsLoading ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : products.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>У вас пока нет товаров</p>
                  <p className="text-sm">Добавьте первый товар или импортируйте из МойСклад</p>
                </div>
              ) : (
                <div className="divide-y">
                  {products.map((product) => (
                    <div
                      key={product.id}
                      className="p-4 flex items-center gap-4 hover:bg-muted/30 cursor-pointer"
                      onClick={() => {
                        const formatted = formattedProducts.find(p => p.id === product.id);
                        if (formatted) {
                          setEditingProduct(formatted);
                          setEditDialogOpen(true);
                        }
                      }}
                    >
                      <div className="w-12 h-12 rounded bg-muted flex-shrink-0 overflow-hidden">
                        {product.images?.[0] ? (
                          <img
                            src={product.images[0]}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{product.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {product.price} ₽ / {product.unit || "шт"}
                        </p>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {productVisibility[product.id]?.size || 0} прайс-листов
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="catalogs">
            <div className="rounded-lg border">
              <div className="p-4 border-b bg-muted/30">
                <h2 className="font-semibold">Прайс-листы ({catalogs.length})</h2>
                <p className="text-sm text-muted-foreground">
                  Группы товаров для разных клиентов
                </p>
              </div>
              
              {catalogs.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Tag className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>У вас пока нет прайс-листов</p>
                  <Button 
                    className="mt-4"
                    onClick={() => createCatalog("Основной прайс-лист")}
                  >
                    Создать первый прайс-лист
                  </Button>
                </div>
              ) : (
                <div className="divide-y">
                  {catalogs.map((catalog) => {
                    const productCount = Object.values(productVisibility).filter(
                      (set) => set.has(catalog.id)
                    ).length;
                    
                    return (
                      <div key={catalog.id} className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-medium">{catalog.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {productCount} товаров
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteCatalog(catalog.id)}
                        >
                          Удалить
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="roles">
            <CustomerRolesManager 
              storeId={store.id} 
              roles={roles.map(r => ({
                ...r,
                description: r.description || undefined,
              })) as CustomerRole[]}
              onCreateRole={(role) => createRole({ ...role, description: role.description || null })}
              onUpdateRole={(role) => updateRole({ ...role, description: role.description || null })}
              onDeleteRole={deleteRole}
            />
          </TabsContent>

          <TabsContent value="settings">
            <div className="rounded-lg border p-6">
              <h2 className="font-semibold mb-4">Настройки магазина</h2>
              <p className="text-muted-foreground">
                Настройки магазина будут добавлены в следующих обновлениях
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Product Edit Dialog */}
      {editingProduct && (
        <ProductPricingDialog
          product={editingProduct}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onSave={handleProductSave}
          customerRoles={[]}
          rolePricing={[]}
          onSaveRolePricing={() => {}}
        />
      )}
    </div>
  );
}
