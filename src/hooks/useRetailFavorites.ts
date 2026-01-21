import { useState, useEffect, useCallback } from "react";

const FAVORITES_STORAGE_KEY = "retail_favorites";

function getStoredFavorites(storeId: string): string[] {
  try {
    const stored = localStorage.getItem(`${FAVORITES_STORAGE_KEY}_${storeId}`);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveFavorites(storeId: string, favorites: string[]) {
  try {
    localStorage.setItem(`${FAVORITES_STORAGE_KEY}_${storeId}`, JSON.stringify(favorites));
  } catch (e) {
    console.error("Failed to save favorites:", e);
  }
}

export function useRetailFavorites(storeId: string | null) {
  const [favorites, setFavorites] = useState<string[]>([]);

  // Load favorites from localStorage
  useEffect(() => {
    if (storeId) {
      setFavorites(getStoredFavorites(storeId));
    }
  }, [storeId]);

  // Save favorites to localStorage when it changes
  useEffect(() => {
    if (storeId) {
      saveFavorites(storeId, favorites);
    }
  }, [storeId, favorites]);

  const toggleFavorite = useCallback((productId: string) => {
    setFavorites((prev) => {
      if (prev.includes(productId)) {
        return prev.filter((id) => id !== productId);
      }
      return [...prev, productId];
    });
  }, []);

  const isFavorite = useCallback((productId: string) => {
    return favorites.includes(productId);
  }, [favorites]);

  const clearFavorites = useCallback(() => {
    setFavorites([]);
  }, []);

  return {
    favorites,
    favoritesCount: favorites.length,
    toggleFavorite,
    isFavorite,
    clearFavorites,
  };
}
