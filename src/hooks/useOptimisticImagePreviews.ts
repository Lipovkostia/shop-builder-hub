import { useState, useCallback } from "react";

interface OptimisticPreview {
  url: string;
  file: File;
}

interface UseOptimisticImagePreviewsReturn {
  /**
   * Map of productId -> array of temporary preview URLs
   */
  optimisticPreviews: Record<string, string[]>;
  
  /**
   * Add temporary previews for a product.
   * Returns the local blob URLs that can be shown immediately.
   */
  addPreviews: (productId: string, files: FileList | File[]) => string[];
  
  /**
   * Remove all previews for a product (call after upload completes)
   */
  clearPreviews: (productId: string) => void;
  
  /**
   * Remove a specific preview by URL
   */
  removePreview: (productId: string, previewUrl: string) => void;
}

/**
 * Hook for managing optimistic image previews.
 * Creates instant local blob URLs while uploads happen in the background.
 */
export function useOptimisticImagePreviews(): UseOptimisticImagePreviewsReturn {
  const [optimisticPreviews, setOptimisticPreviews] = useState<Record<string, string[]>>({});

  const addPreviews = useCallback((productId: string, files: FileList | File[]): string[] => {
    const fileArray = Array.from(files);
    const newUrls: string[] = [];

    fileArray.forEach((file) => {
      // Create a local blob URL for instant preview
      const blobUrl = URL.createObjectURL(file);
      newUrls.push(blobUrl);
    });

    setOptimisticPreviews((prev) => ({
      ...prev,
      [productId]: [...(prev[productId] || []), ...newUrls],
    }));

    return newUrls;
  }, []);

  const clearPreviews = useCallback((productId: string) => {
    setOptimisticPreviews((prev) => {
      const current = prev[productId];
      if (current) {
        // Revoke blob URLs to free memory
        current.forEach((url) => {
          if (url.startsWith("blob:")) {
            URL.revokeObjectURL(url);
          }
        });
      }
      const { [productId]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const removePreview = useCallback((productId: string, previewUrl: string) => {
    setOptimisticPreviews((prev) => {
      const current = prev[productId];
      if (!current) return prev;

      // Revoke the blob URL
      if (previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }

      const filtered = current.filter((url) => url !== previewUrl);
      if (filtered.length === 0) {
        const { [productId]: _, ...rest } = prev;
        return rest;
      }

      return {
        ...prev,
        [productId]: filtered,
      };
    });
  }, []);

  return {
    optimisticPreviews,
    addPreviews,
    clearPreviews,
    removePreview,
  };
}
