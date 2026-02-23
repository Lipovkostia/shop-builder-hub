import { useState } from "react";
import { Star, Check, Trash2, MessageSquare, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAdminProductReviews } from "@/hooks/useProductReviews";
import { cn } from "@/lib/utils";

interface ReviewsManagementSectionProps {
  storeId: string | null;
}

export function ReviewsManagementSection({ storeId }: ReviewsManagementSectionProps) {
  const { reviews, loading, approveReview, deleteReview } = useAdminProductReviews(storeId);
  const [filter, setFilter] = useState<"all" | "pending" | "approved">("all");

  const filtered = reviews.filter(r => {
    if (filter === "pending") return !r.is_approved;
    if (filter === "approved") return r.is_approved;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-semibold text-foreground">Отзывы о товарах</h3>
        <Badge variant="secondary" className="ml-auto">{reviews.length}</Badge>
      </div>

      <div className="flex gap-2 mb-4">
        {(["all", "pending", "approved"] as const).map(f => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "Все" : f === "pending" ? "На модерации" : "Одобренные"}
            {f === "pending" && (
              <Badge variant="destructive" className="ml-1 text-[10px] px-1">
                {reviews.filter(r => !r.is_approved).length}
              </Badge>
            )}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Нет отзывов</p>
      ) : (
        <div className="space-y-3">
          {filtered.map(review => (
            <div key={review.id} className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{review.reviewer_name}</span>
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star
                          key={s}
                          className={cn("h-3.5 w-3.5", s <= review.rating ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30")}
                        />
                      ))}
                    </div>
                    {!review.is_approved && (
                      <Badge variant="outline" className="text-[10px]">На модерации</Badge>
                    )}
                  </div>
                  {review.comment && (
                    <p className="text-sm text-muted-foreground">{review.comment}</p>
                  )}
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    {new Date(review.created_at).toLocaleDateString("ru-RU")}
                  </p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {!review.is_approved && (
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => approveReview(review.id)}>
                      <Check className="h-4 w-4 text-green-600" />
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => deleteReview(review.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
