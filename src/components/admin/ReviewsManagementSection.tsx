import { useState, useMemo, useEffect } from "react";
import { Star, Check, Trash2, Loader2, Search, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAdminProductReviews } from "@/hooks/useProductReviews";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface ReviewsManagementSectionProps {
  storeId: string | null;
}

export function ReviewsManagementSection({ storeId }: ReviewsManagementSectionProps) {
  const { reviews, loading, approveReview, deleteReview } = useAdminProductReviews(storeId);
  const [filter, setFilter] = useState<"all" | "pending" | "approved">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [productMap, setProductMap] = useState<Record<string, string>>({});

  // Fetch product names for reviews
  useEffect(() => {
    if (!storeId) return;
    supabase
      .from("products")
      .select("id, name")
      .eq("store_id", storeId)
      .then(({ data }) => {
        if (data) {
          const map: Record<string, string> = {};
          data.forEach((p: any) => { map[p.id] = p.name; });
          setProductMap(map);
        }
      });
  }, [storeId]);

  // Group reviews by product
  const groupedByProduct = useMemo(() => {
    const groups: Record<string, typeof reviews> = {};
    reviews.forEach(r => {
      if (!groups[r.product_id]) groups[r.product_id] = [];
      groups[r.product_id].push(r);
    });
    return groups;
  }, [reviews]);

  // Stats
  const stats = useMemo(() => {
    const total = reviews.length;
    const pending = reviews.filter(r => !r.is_approved).length;
    const approved = reviews.filter(r => r.is_approved).length;
    const avgRating = total > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / total : 0;
    return { total, pending, approved, avgRating: Math.round(avgRating * 100) / 100 };
  }, [reviews]);

  // Filter and search
  const filteredProducts = useMemo(() => {
    const entries = Object.entries(groupedByProduct);
    return entries
      .map(([productId, productReviews]) => {
        const name = productMap[productId] || "Неизвестный товар";
        const filtered = productReviews.filter(r => {
          if (filter === "pending" && r.is_approved) return false;
          if (filter === "approved" && !r.is_approved) return false;
          return true;
        });
        if (filtered.length === 0) return null;
        if (searchQuery && !name.toLowerCase().includes(searchQuery.toLowerCase()) &&
            !filtered.some(r => r.reviewer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              r.comment?.toLowerCase().includes(searchQuery.toLowerCase()))) return null;
        const avg = filtered.reduce((s, r) => s + r.rating, 0) / filtered.length;
        const pendingCount = filtered.filter(r => !r.is_approved).length;
        return { productId, name, reviews: filtered, avgRating: Math.round(avg * 10) / 10, pendingCount };
      })
      .filter(Boolean)
      .sort((a, b) => (b!.pendingCount - a!.pendingCount) || a!.name.localeCompare(b!.name));
  }, [groupedByProduct, filter, searchQuery, productMap]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{stats.total}</p>
          <p className="text-xs text-muted-foreground">Всего отзывов</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-amber-500">{stats.pending}</p>
          <p className="text-xs text-muted-foreground">На модерации</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-green-500">{stats.approved}</p>
          <p className="text-xs text-muted-foreground">Одобрены</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-1">
            <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
            <span className="text-2xl font-bold text-foreground">{stats.avgRating}</span>
          </div>
          <p className="text-xs text-muted-foreground">Средний рейтинг</p>
        </div>
      </div>

      {/* Search and filter */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по товару, автору или тексту..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1">
          {(["all", "pending", "approved"] as const).map(f => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "outline"}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "Все" : f === "pending" ? "На модерации" : "Одобренные"}
              {f === "pending" && stats.pending > 0 && (
                <Badge variant="destructive" className="ml-1 text-[10px] px-1">
                  {stats.pending}
                </Badge>
              )}
            </Button>
          ))}
        </div>
      </div>

      {/* Product groups */}
      {filteredProducts.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Нет отзывов</p>
      ) : (
        <div className="space-y-2">
          {filteredProducts.map(item => {
            if (!item) return null;
            const isExpanded = expandedProduct === item.productId;
            return (
              <div key={item.productId} className="bg-card border border-border rounded-lg overflow-hidden">
                {/* Product header */}
                <button
                  onClick={() => setExpandedProduct(isExpanded ? null : item.productId)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="flex items-center gap-0.5">
                      <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                      <span className="text-xs font-medium">{item.avgRating}</span>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">{item.reviews.length}</Badge>
                    {item.pendingCount > 0 && (
                      <Badge variant="destructive" className="text-[10px]">{item.pendingCount} новых</Badge>
                    )}
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>

                {/* Reviews list */}
                {isExpanded && (
                  <div className="border-t border-border px-4 py-2 space-y-2">
                    {item.reviews.map(review => (
                      <div key={review.id} className={cn(
                        "flex items-start justify-between gap-3 p-3 rounded-lg",
                        !review.is_approved ? "bg-amber-500/5 border border-amber-500/20" : "bg-muted/30"
                      )}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-medium">{review.reviewer_name}</span>
                            <div className="flex">
                              {[1, 2, 3, 4, 5].map(s => (
                                <Star
                                  key={s}
                                  className={cn("h-3 w-3", s <= review.rating ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30")}
                                />
                              ))}
                            </div>
                            {!review.is_approved && (
                              <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-600">Новый</Badge>
                            )}
                          </div>
                          {review.comment && (
                            <p className="text-sm text-muted-foreground">{review.comment}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground/60 mt-1">
                            {new Date(review.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
                          </p>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          {!review.is_approved && (
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => approveReview(review.id)} title="Одобрить">
                              <Check className="h-3.5 w-3.5 text-green-600" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteReview(review.id)} title="Удалить">
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
