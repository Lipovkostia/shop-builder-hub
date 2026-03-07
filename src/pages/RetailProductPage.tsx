import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ChevronLeft, ChevronRight, ShoppingBag, Plus, Minus, ImageOff, Star, ArrowLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useRetailStore } from "@/hooks/useRetailStore";
import { useRetailCart } from "@/hooks/useRetailCart";
import { useProductReviews } from "@/hooks/useProductReviews";
import { useIsMobile } from "@/hooks/use-mobile";
import { FullscreenImageViewer } from "@/components/ui/fullscreen-image-viewer";
import { RetailFooter } from "@/components/retail/RetailFooter";

function formatPrice(price: number): string {
  return new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(price) + " ₽";
}

interface RetailProductPageProps {
  subdomain?: string;
}

export default function RetailProductPage({ subdomain: propSubdomain }: RetailProductPageProps) {
  const params = useParams();
  const navigate = useNavigate();
  const subdomain = propSubdomain || params.subdomain;
  const productSlug = params.slug;
  const isMobile = useIsMobile();

  const { store, products, loading } = useRetailStore(subdomain);
  const { cart, addToCart, updateQuantity } = useRetailCart(subdomain || null);
  const { getProductStats, getProductReviews } = useProductReviews(store?.id || null);

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageError, setImageError] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);

  const product = useMemo(() => {
    if (!products.length || !productSlug) return null;
    return products.find(p => p.slug === productSlug) || null;
  }, [products, productSlug]);

  const cartItem = product ? cart.find(c => c.productId === product.id) : null;
  const cartQuantity = cartItem?.quantity || 0;

  const reviewStats = product ? getProductStats(product.id) : null;
  const reviews = product ? getProductReviews(product.id) : [];

  const images = product?.images || [];
  const currentImage = images[currentImageIndex] || null;
  const hasDiscount = product?.compare_price && product.compare_price > (product?.price ?? 0);

  useEffect(() => {
    setCurrentImageIndex(0);
    setImageError(false);
    window.scrollTo(0, 0);
  }, [productSlug]);

  // SEO data
  const seoTitle = (product as any)?.seo_title || product?.name || "";
  const seoDescription = (product as any)?.seo_description || product?.description || "";
  const seoKeywords = (product as any)?.seo_keywords || [];
  const seoSchema = (product as any)?.seo_schema || null;
  const seoNoindex = (product as any)?.seo_noindex || false;

  const storeBaseUrl = subdomain ? `/retail/${subdomain}` : "/";
  const canonicalUrl = typeof window !== "undefined" ? `${window.location.origin}${storeBaseUrl}/p/${productSlug}` : "";

  const schemaMarkup = seoSchema || (product ? {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description || "",
    sku: product.sku || "",
    image: images[0] || "",
    offers: {
      "@type": "Offer",
      price: product.price,
      priceCurrency: "RUB",
      availability: product.quantity > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
    ...(reviewStats && reviewStats.totalCount > 0 ? {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: reviewStats.averageRating,
        reviewCount: reviewStats.totalCount,
      }
    } : {}),
  } : null);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Товар не найден</h1>
          <Button onClick={() => navigate(storeBaseUrl)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Вернуться в магазин
          </Button>
        </div>
      </div>
    );
  }

  const primaryColor = store?.retail_theme?.primaryColor || store?.primary_color || "#16a34a";

  return (
    <>
      <Helmet>
        <title>{seoTitle || product.name}</title>
        <meta name="description" content={seoDescription || product.description || `Купить ${product.name}`} />
        {seoKeywords.length > 0 && <meta name="keywords" content={seoKeywords.join(", ")} />}
        <link rel="canonical" href={canonicalUrl} />
        {seoNoindex && <meta name="robots" content="noindex, nofollow" />}
        
        {/* Open Graph */}
        <meta property="og:type" content="product" />
        <meta property="og:title" content={seoTitle || product.name} />
        <meta property="og:description" content={seoDescription || product.description || ""} />
        {images[0] && <meta property="og:image" content={images[0]} />}
        <meta property="og:url" content={canonicalUrl} />
        <meta property="product:price:amount" content={String(product.price)} />
        <meta property="product:price:currency" content="RUB" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={seoTitle || product.name} />
        <meta name="twitter:description" content={seoDescription || product.description || ""} />
        {images[0] && <meta name="twitter:image" content={images[0]} />}

        {/* JSON-LD */}
        {schemaMarkup && (
          <script type="application/ld+json">{JSON.stringify(schemaMarkup)}</script>
        )}

        {store?.favicon_url && <link rel="icon" href={store.favicon_url} />}
      </Helmet>

      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-card border-b border-border">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(storeBaseUrl)} className="shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            {store?.retail_logo_url && (
              <img src={store.retail_logo_url} alt={store.retail_name || store.name} className="h-8 object-contain" />
            )}
            <nav className="flex items-center gap-1 text-sm text-muted-foreground overflow-hidden">
              <Link to={storeBaseUrl} className="hover:text-foreground whitespace-nowrap">
                <Home className="h-4 w-4" />
              </Link>
              <span>/</span>
              {product.category_name && (
                <>
                  <span className="truncate max-w-[120px]">{product.category_name}</span>
                  <span>/</span>
                </>
              )}
              <span className="text-foreground font-medium truncate">{product.name}</span>
            </nav>
          </div>
        </header>

        {/* Main content */}
        <main className="max-w-6xl mx-auto px-4 py-6">
          <div className={cn("grid gap-8", isMobile ? "grid-cols-1" : "grid-cols-2")}>
            {/* Image gallery */}
            <div className="space-y-3">
              <div
                className="w-full aspect-square rounded-2xl bg-muted overflow-hidden relative cursor-pointer group"
                onClick={() => currentImage && !imageError && setFullscreenOpen(true)}
              >
                {currentImage && !imageError ? (
                  <img
                    src={currentImage}
                    alt={product.name}
                    className="w-full h-full object-contain"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageOff className="h-16 w-16 text-muted-foreground/30" />
                  </div>
                )}

                {images.length > 1 && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(i => i === 0 ? images.length - 1 : i - 1); setImageError(false); }}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-background/80 backdrop-blur flex items-center justify-center shadow-md hover:bg-background transition-colors"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(i => i === images.length - 1 ? 0 : i + 1); setImageError(false); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-background/80 backdrop-blur flex items-center justify-center shadow-md hover:bg-background transition-colors"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </>
                )}

                {hasDiscount && (
                  <Badge className="absolute top-3 left-3 bg-destructive text-destructive-foreground">
                    -{Math.round(((product.compare_price! - product.price) / product.compare_price!) * 100)}%
                  </Badge>
                )}
              </div>

              {/* Thumbnails */}
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {images.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => { setCurrentImageIndex(i); setImageError(false); }}
                      className={cn(
                        "flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors",
                        i === currentImageIndex ? "border-primary" : "border-transparent hover:border-muted-foreground/30"
                      )}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product info */}
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-foreground leading-tight">{product.name}</h1>
                {product.sku && (
                  <p className="text-sm text-muted-foreground mt-1">Артикул: {product.sku}</p>
                )}
              </div>

              {/* Rating */}
              {reviewStats && reviewStats.totalCount > 0 && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-medium text-sm">{reviewStats.averageRating.toFixed(1)}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">({reviewStats.totalCount} отзывов)</span>
                </div>
              )}

              {/* Price */}
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold" style={{ color: primaryColor }}>
                  {formatPrice(product.price)}
                </span>
                {hasDiscount && (
                  <span className="text-lg text-muted-foreground line-through">
                    {formatPrice(product.compare_price!)}
                  </span>
                )}
                {product.unit && product.unit !== "шт" && (
                  <span className="text-sm text-muted-foreground">/ {product.unit}</span>
                )}
              </div>

              {/* Availability */}
              <div className="flex items-center gap-2">
                {product.quantity > 0 ? (
                  <Badge variant="outline" className="text-emerald-600 border-emerald-300 bg-emerald-50">
                    В наличии
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-destructive border-destructive/30">
                    Нет в наличии
                  </Badge>
                )}
              </div>

              {/* Add to cart */}
              <div className="flex items-center gap-3">
                {cartQuantity === 0 ? (
                  <Button
                    size="lg"
                    className="flex-1 text-base h-12 rounded-xl gap-2"
                    style={{ backgroundColor: primaryColor }}
                    onClick={() => addToCart({
                      productId: product.id,
                      name: product.name,
                      price: product.price,
                      image: images[0] || undefined,
                      unit: product.unit,
                    })}
                    disabled={product.quantity <= 0}
                  >
                    <ShoppingBag className="h-5 w-5" />
                    Добавить в корзину
                  </Button>
                ) : (
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-12 w-12 rounded-xl"
                      onClick={() => updateQuantity(product.id, cartQuantity - 1)}
                    >
                      <Minus className="h-5 w-5" />
                    </Button>
                    <span className="text-xl font-semibold w-12 text-center">{cartQuantity}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-12 w-12 rounded-xl"
                      onClick={() => updateQuantity(product.id, cartQuantity + 1)}
                    >
                      <Plus className="h-5 w-5" />
                    </Button>
                  </div>
                )}
              </div>

              <Separator />

              {/* Description */}
              {product.description && (
                <div>
                  <h2 className="text-lg font-semibold mb-2">Описание</h2>
                  <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{product.description}</p>
                </div>
              )}

              {/* Product details */}
              <div>
                <h2 className="text-lg font-semibold mb-3">Характеристики</h2>
                <div className="space-y-2">
                  {product.unit && (
                    <div className="flex justify-between py-2 border-b border-border/50">
                      <span className="text-muted-foreground">Единица измерения</span>
                      <span className="font-medium">{product.unit}</span>
                    </div>
                  )}
                  {product.sku && (
                    <div className="flex justify-between py-2 border-b border-border/50">
                      <span className="text-muted-foreground">Артикул</span>
                      <span className="font-medium">{product.sku}</span>
                    </div>
                  )}
                  {product.category_name && (
                    <div className="flex justify-between py-2 border-b border-border/50">
                      <span className="text-muted-foreground">Категория</span>
                      <span className="font-medium">{product.category_name}</span>
                    </div>
                  )}
                  {product.packaging_type && product.packaging_type !== "piece" && (
                    <div className="flex justify-between py-2 border-b border-border/50">
                      <span className="text-muted-foreground">Тип упаковки</span>
                      <span className="font-medium">{product.packaging_type}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Reviews */}
              {reviews.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold mb-3">Отзывы ({reviews.length})</h2>
                  <div className="space-y-3">
                    {reviews.slice(0, 5).map(review => (
                      <div key={review.id} className="p-3 bg-muted/50 rounded-lg space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{review.reviewer_name}</span>
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star key={i} className={cn("h-3 w-3", i < review.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30")} />
                            ))}
                          </div>
                        </div>
                        {review.comment && <p className="text-sm text-muted-foreground">{review.comment}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Footer */}
        {store && <RetailFooter store={store} />}
      </div>

      {/* Fullscreen image viewer */}
      {fullscreenOpen && images.length > 0 && (
        <FullscreenImageViewer
          images={images}
          currentIndex={currentImageIndex}
          onClose={() => setFullscreenOpen(false)}
        />
      )}
    </>
  );
}
