import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ProductReview {
  id: string;
  product_id: string;
  store_id: string;
  reviewer_name: string;
  rating: number;
  comment: string | null;
  is_approved: boolean;
  created_at: string;
}

export interface ReviewStats {
  averageRating: number;
  totalCount: number;
}

export function useProductReviews(storeId: string | null) {
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchReviews = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("product_reviews" as any)
        .select("*")
        .eq("store_id", storeId)
        .eq("is_approved", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setReviews((data as any[]) || []);
    } catch (err) {
      console.error("Error fetching reviews:", err);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const submitReview = useCallback(async (
    productId: string,
    reviewerName: string,
    rating: number,
    comment: string
  ) => {
    if (!storeId) return;
    try {
      const { error } = await supabase
        .from("product_reviews" as any)
        .insert({
          product_id: productId,
          store_id: storeId,
          reviewer_name: reviewerName,
          rating,
          comment: comment || null,
        } as any);

      if (error) throw error;
      toast({ title: "Отзыв отправлен", description: "Ваш отзыв будет опубликован после модерации" });
    } catch (err) {
      console.error("Error submitting review:", err);
      toast({ variant: "destructive", title: "Ошибка", description: "Не удалось отправить отзыв" });
    }
  }, [storeId, toast]);

  const getProductStats = useCallback((productId: string): ReviewStats => {
    const productReviews = reviews.filter(r => r.product_id === productId);
    if (productReviews.length === 0) return { averageRating: 0, totalCount: 0 };
    const avg = productReviews.reduce((sum, r) => sum + r.rating, 0) / productReviews.length;
    return { averageRating: Math.round(avg * 10) / 10, totalCount: productReviews.length };
  }, [reviews]);

  const getProductReviews = useCallback((productId: string): ProductReview[] => {
    return reviews.filter(r => r.product_id === productId);
  }, [reviews]);

  return { reviews, loading, submitReview, getProductStats, getProductReviews, refetch: fetchReviews };
}

// Admin hook - fetches ALL reviews (approved + unapproved)
export function useAdminProductReviews(storeId: string | null) {
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchReviews = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("product_reviews" as any)
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setReviews((data as any[]) || []);
    } catch (err) {
      console.error("Error fetching admin reviews:", err);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const approveReview = useCallback(async (reviewId: string) => {
    try {
      const { error } = await supabase
        .from("product_reviews" as any)
        .update({ is_approved: true } as any)
        .eq("id", reviewId);
      if (error) throw error;
      setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, is_approved: true } : r));
      toast({ title: "Отзыв одобрен" });
    } catch (err) {
      toast({ variant: "destructive", title: "Ошибка" });
    }
  }, [toast]);

  const deleteReview = useCallback(async (reviewId: string) => {
    try {
      const { error } = await supabase
        .from("product_reviews" as any)
        .delete()
        .eq("id", reviewId);
      if (error) throw error;
      setReviews(prev => prev.filter(r => r.id !== reviewId));
      toast({ title: "Отзыв удалён" });
    } catch (err) {
      toast({ variant: "destructive", title: "Ошибка" });
    }
  }, [toast]);

  return { reviews, loading, approveReview, deleteReview, refetch: fetchReviews };
}
