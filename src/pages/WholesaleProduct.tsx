import { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ChevronLeft, 
  ShoppingCart, 
  Package, 
  Phone, 
  Mail,
  Share2,
  Minus,
  Plus
} from "lucide-react";
import { useWholesaleProduct } from "@/hooks/useWholesaleStore";
import { useRetailCart } from "@/hooks/useRetailCart";

interface WholesaleProductProps {
  subdomain?: string;
}

export default function WholesaleProduct({ subdomain: directSubdomain }: WholesaleProductProps = {}) {
  const params = useParams();
  const subdomain = directSubdomain || params.subdomain;
  const { slug } = params;
  const { store, product, loading, error } = useWholesaleProduct(subdomain, slug);
  const { cart, addToCart, updateQuantity } = useRetailCart(subdomain || null);

  const cartItem = cart.find(i => i.productId === product?.id);
  const cartQuantity = cartItem?.quantity || 0;

  // Compute SEO values
  const displayStoreName = store?.wholesale_name || store?.name || "";
  const pageTitle = product?.seo_title || (product ? `${product.name} — ${displayStoreName}` : "Загрузка...");
  const pageDescription = product?.seo_description || product?.description || (product ? `Купите ${product.name} оптом в ${displayStoreName}` : "");

  // Generate SEO structured data
  const structuredData = product?.seo_schema || (product ? {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.seo_title || product.name,
    description: product.seo_description || product.description,
    sku: product.sku,
    image: product.images?.[0],
    offers: {
      "@type": "Offer",
      price: product.price,
      priceCurrency: "RUB",
      availability: product.quantity > 0 
        ? "https://schema.org/InStock" 
        : "https://schema.org/OutOfStock",
    },
  } : null);

  // Set document title and meta tags
  useEffect(() => {
    if (!product) return;
    
    document.title = pageTitle;
    
    // Update meta description
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', pageDescription);

    // Add structured data
    if (structuredData) {
      let scriptTag = document.querySelector('script[data-product-schema]');
      if (!scriptTag) {
        scriptTag = document.createElement('script');
        scriptTag.setAttribute('type', 'application/ld+json');
        scriptTag.setAttribute('data-product-schema', 'true');
        document.head.appendChild(scriptTag);
      }
      scriptTag.textContent = JSON.stringify(structuredData);
    }

    return () => {
      const script = document.querySelector('script[data-product-schema]');
      if (script) script.remove();
    };
  }, [product, pageTitle, pageDescription, structuredData]);

  const handleAddToCart = () => {
    if (!product) return;
    addToCart({
      productId: product.id,
      name: product.name,
      price: product.price,
      image: product.images?.[0],
      unit: product.unit || "",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Skeleton className="h-8 w-32 mb-6" />
          <div className="grid md:grid-cols-2 gap-8">
            <Skeleton className="aspect-square rounded-lg" />
            <div className="space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-6 w-1/4" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !product || !store) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Товар не найден</h1>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Link to={`/wholesale/${subdomain}`}>
            <Button>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Вернуться в каталог
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card border-b">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link 
              to={`/wholesale/${subdomain}`}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
              Назад в каталог
            </Link>
            <Link to={`/wholesale/${subdomain}`} className="font-semibold">
              {displayStoreName}
            </Link>
          </div>
        </div>
      </header>

      {/* Breadcrumbs */}
      <nav className="max-w-4xl mx-auto px-4 py-4">
        <ol className="flex items-center gap-2 text-sm text-muted-foreground">
          <li>
            <Link to={`/wholesale/${subdomain}`} className="hover:text-foreground">
              Каталог
            </Link>
          </li>
          <li>/</li>
          {product.category_name && (
            <>
              <li>
                <Link 
                  to={`/wholesale/${subdomain}?category=${product.category_id}`}
                  className="hover:text-foreground"
                >
                  {product.category_name}
                </Link>
              </li>
              <li>/</li>
            </>
          )}
          <li className="text-foreground truncate max-w-[200px]">{product.name}</li>
        </ol>
      </nav>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 pb-12">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Product image */}
          <div className="space-y-4">
            <div className="aspect-square bg-muted rounded-lg overflow-hidden">
              {product.images?.[0] ? (
                <img
                  src={product.images[0]}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="h-24 w-24 text-muted-foreground" />
                </div>
              )}
            </div>
            
            {/* Additional images */}
            {product.images && product.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {product.images.map((img, i) => (
                  <img
                    key={i}
                    src={img}
                    alt={`${product.name} ${i + 1}`}
                    className="w-20 h-20 object-cover rounded border"
                  />
                ))}
              </div>
            )}
          </div>

          {/* Product info */}
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold mb-2">{product.name}</h1>
              {product.sku && (
                <p className="text-sm text-muted-foreground">Артикул: {product.sku}</p>
              )}
            </div>

            {/* Price */}
            <div className="space-y-2">
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold text-primary">
                  {product.price.toLocaleString("ru-RU")} ₽
                </span>
                <span className="text-muted-foreground">/ {product.unit || "шт"}</span>
              </div>
              {product.compare_price && product.compare_price > product.price && (
                <span className="text-sm text-muted-foreground line-through">
                  {product.compare_price.toLocaleString("ru-RU")} ₽
                </span>
              )}
            </div>

            {/* Availability */}
            <div className="flex items-center gap-2">
              {product.quantity > 0 ? (
                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                  В наличии
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-orange-500/10 text-orange-700 dark:text-orange-400">
                  Под заказ
                </Badge>
              )}
            </div>

            {/* Add to cart */}
            <Card>
              <CardContent className="p-4">
                {cartQuantity > 0 ? (
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => updateQuantity(product.id, cartQuantity - 1)}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-12 text-center font-semibold text-lg">
                        {cartQuantity}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => updateQuantity(product.id, cartQuantity + 1)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex-1 text-right">
                      <p className="text-sm text-muted-foreground">Сумма</p>
                      <p className="font-semibold">
                        {(product.price * cartQuantity).toLocaleString("ru-RU")} ₽
                      </p>
                    </div>
                  </div>
                ) : (
                  <Button className="w-full" size="lg" onClick={handleAddToCart}>
                    <ShoppingCart className="h-5 w-5 mr-2" />
                    Добавить в корзину
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Description */}
            {product.description && (
              <div>
                <h2 className="font-semibold mb-2">Описание</h2>
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {product.description}
                </p>
              </div>
            )}

            {/* Contact */}
            {(store.contact_phone || store.contact_email) && (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <h3 className="font-semibold">Остались вопросы?</h3>
                  {store.contact_phone && (
                    <a 
                      href={`tel:${store.contact_phone}`}
                      className="flex items-center gap-2 text-sm hover:text-primary"
                    >
                      <Phone className="h-4 w-4" />
                      {store.contact_phone}
                    </a>
                  )}
                  {store.contact_email && (
                    <a 
                      href={`mailto:${store.contact_email}`}
                      className="flex items-center gap-2 text-sm hover:text-primary"
                    >
                      <Mail className="h-4 w-4" />
                      {store.contact_email}
                    </a>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Share */}
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigator.clipboard.writeText(window.location.href)}
            >
              <Share2 className="h-4 w-4 mr-2" />
              Поделиться
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
