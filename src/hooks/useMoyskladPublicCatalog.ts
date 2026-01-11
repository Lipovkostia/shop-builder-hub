import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PublicCatalogProduct {
  id: string;
  name: string;
  code?: string;
  price: number;
  unit: string;
  category?: string;
  thumbnailUrl?: string;
  selected?: boolean;
}

interface UseMoyskladPublicCatalog {
  products: PublicCatalogProduct[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  fetchCatalog: (url: string) => Promise<void>;
  toggleProductSelection: (productId: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  getSelectedProducts: () => PublicCatalogProduct[];
  reset: () => void;
}

export function useMoyskladPublicCatalog(): UseMoyskladPublicCatalog {
  const [products, setProducts] = useState<PublicCatalogProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  const fetchCatalog = useCallback(async (url: string) => {
    setLoading(true);
    setError(null);
    setProducts([]);
    setTotalCount(0);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('moysklad-public-catalog', {
        body: { catalogUrl: url }
      });

      if (fnError) {
        throw new Error(fnError.message || 'Ошибка загрузки каталога');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const productsWithSelection = (data.products || []).map((p: PublicCatalogProduct) => ({
        ...p,
        selected: true, // Select all by default
      }));

      setProducts(productsWithSelection);
      setTotalCount(data.totalCount || productsWithSelection.length);
    } catch (err: any) {
      console.error('Error fetching public catalog:', err);
      setError(err.message || 'Не удалось загрузить каталог');
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleProductSelection = useCallback((productId: string) => {
    setProducts(prev => prev.map(p => 
      p.id === productId ? { ...p, selected: !p.selected } : p
    ));
  }, []);

  const selectAll = useCallback(() => {
    setProducts(prev => prev.map(p => ({ ...p, selected: true })));
  }, []);

  const deselectAll = useCallback(() => {
    setProducts(prev => prev.map(p => ({ ...p, selected: false })));
  }, []);

  const getSelectedProducts = useCallback(() => {
    return products.filter(p => p.selected);
  }, [products]);

  const reset = useCallback(() => {
    setProducts([]);
    setLoading(false);
    setError(null);
    setTotalCount(0);
  }, []);

  return {
    products,
    loading,
    error,
    totalCount,
    fetchCatalog,
    toggleProductSelection,
    selectAll,
    deselectAll,
    getSelectedProducts,
    reset,
  };
}
