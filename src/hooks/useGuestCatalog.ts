import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface GuestCatalogInfo {
  id: string;
  name: string;
  description: string | null;
  store_id: string;
  store_name: string;
  store_logo: string | null;
  store_description: string | null;
}

export interface GuestProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  compare_price: number | null;
  images: string[] | null;
  unit: string | null;
  sku: string | null;
  quantity: number;
  slug: string;
  packaging_type: string | null;
  portion_weight: number | null;
  price_portion: number | null;
  price_quarter: number | null;
  price_half: number | null;
  price_full: number | null;
  unit_weight: number | null;
  catalog_id: string;
  catalog_markup_type: string | null;
  catalog_markup_value: number | null;
  catalog_status: string | null;
  catalog_categories: string[] | null;
  catalog_portion_prices: {
    portion?: number | null;
    quarter?: number | null;
    half?: number | null;
    full?: number | null;
  } | null;
  category_id: string | null;
  category_name: string | null;
  category_slug: string | null;
}

export interface GuestCartItem {
  productId: string;
  productName: string;
  variantIndex: number; // 0 = full, 1 = half, 2 = quarter, 3 = portion
  quantity: number;
  price: number;
  unit: string | null;
  unit_weight: number | null;
  images: string[] | null;
  packaging_type: string | null;
}

const CART_STORAGE_KEY = 'guest_cart';

function getStoredCart(catalogId: string): GuestCartItem[] {
  try {
    const stored = localStorage.getItem(`${CART_STORAGE_KEY}_${catalogId}`);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveCart(catalogId: string, cart: GuestCartItem[]) {
  try {
    localStorage.setItem(`${CART_STORAGE_KEY}_${catalogId}`, JSON.stringify(cart));
  } catch (e) {
    console.error('Failed to save cart:', e);
  }
}

export interface StoreCategory {
  id: string;
  name: string;
  sort_order: number | null;
}

export function useGuestCatalog(accessCode: string | undefined) {
  const [catalogInfo, setCatalogInfo] = useState<GuestCatalogInfo | null>(null);
  const [products, setProducts] = useState<GuestProduct[]>([]);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [cart, setCart] = useState<GuestCartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch catalog info
  const fetchCatalogInfo = useCallback(async () => {
    if (!accessCode) {
      setError('Неверная ссылка');
      setLoading(false);
      return;
    }

    try {
      const { data, error: rpcError } = await supabase
        .rpc('get_catalog_by_access_code', { _access_code: accessCode })
        .single();

      if (rpcError || !data) {
        setError('Прайс-лист не найден');
        setLoading(false);
        return;
      }

      const info: GuestCatalogInfo = {
        id: data.id,
        name: data.name,
        description: data.description,
        store_id: data.store_id,
        store_name: data.store_name || 'Магазин',
        store_logo: data.store_logo || null,
        store_description: null,
      };

      setCatalogInfo(info);
      
      // Load cart from localStorage
      const storedCart = getStoredCart(info.id);
      setCart(storedCart);

      setLoading(false);
    } catch (err) {
      console.error('Error fetching catalog:', err);
      setError('Ошибка загрузки каталога');
      setLoading(false);
    }
  }, [accessCode]);

  // Fetch products using public RPC function
  const fetchProducts = useCallback(async () => {
    if (!accessCode || !catalogInfo) return;

    setProductsLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase
        .rpc('get_catalog_products_public', { _access_code: accessCode });

      if (rpcError) {
        console.error('Error fetching products:', rpcError);
        setError('Не удалось загрузить товары. Попробуйте обновить страницу.');
        setProductsLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        setProducts([]);
        setProductsLoading(false);
        return;
      }

      // Transform data to GuestProduct format
      const transformedProducts: GuestProduct[] = data.map((row: any) => {
        const basePrice = Number(row.product_price) || 0;
        const markupType = row.setting_markup_type;
        const markupValue = Number(row.setting_markup_value) || 0;

        // Calculate final price with markup
        let finalPrice = basePrice;
        if (markupType === 'percentage' && markupValue > 0) {
          finalPrice = basePrice * (1 + markupValue / 100);
        } else if (markupType === 'fixed' && markupValue > 0) {
          finalPrice = basePrice + markupValue;
        }

        // Parse portion prices from JSON
        // DB stores as: halfPricePerKg, quarterPricePerKg, portionPrice, fullPrice
        // Map to: half, quarter, portion, full
        let portionPrices: GuestProduct['catalog_portion_prices'] = null;
        if (row.setting_portion_prices) {
          try {
            const pp = typeof row.setting_portion_prices === 'string' 
              ? JSON.parse(row.setting_portion_prices) 
              : row.setting_portion_prices;
            portionPrices = {
              full: pp.fullPrice ?? pp.full ?? null,
              half: pp.halfPricePerKg ?? pp.half ?? null,
              quarter: pp.quarterPricePerKg ?? pp.quarter ?? null,
              portion: pp.portionPrice ?? pp.portion ?? null,
            };
            // Convert to numbers if present
            if (portionPrices.full != null) portionPrices.full = Number(portionPrices.full);
            if (portionPrices.half != null) portionPrices.half = Number(portionPrices.half);
            if (portionPrices.quarter != null) portionPrices.quarter = Number(portionPrices.quarter);
            if (portionPrices.portion != null) portionPrices.portion = Number(portionPrices.portion);
          } catch {
            portionPrices = null;
          }
        }

        return {
          id: row.product_id,
          name: row.product_name,
          description: row.product_description,
          price: finalPrice,
          compare_price: row.product_compare_price ? Number(row.product_compare_price) : null,
          images: row.product_images,
          unit: row.product_unit,
          sku: row.product_sku,
          quantity: row.product_quantity || 0,
          slug: row.product_slug,
          packaging_type: row.product_packaging_type,
          portion_weight: row.product_portion_weight ? Number(row.product_portion_weight) : null,
          price_portion: row.product_price_portion ? Number(row.product_price_portion) : null,
          price_quarter: row.product_price_quarter ? Number(row.product_price_quarter) : null,
          price_half: row.product_price_half ? Number(row.product_price_half) : null,
          price_full: row.product_price_full ? Number(row.product_price_full) : null,
          unit_weight: row.product_unit_weight ? Number(row.product_unit_weight) : null,
          catalog_id: row.catalog_id,
          catalog_markup_type: markupType,
          catalog_markup_value: markupValue,
          catalog_status: row.setting_status,
          catalog_categories: row.setting_categories,
          catalog_portion_prices: portionPrices,
          category_id: row.category_id,
          category_name: row.category_name,
          category_slug: row.category_slug,
        };
      });

      setProducts(transformedProducts);
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setProductsLoading(false);
    }
  }, [accessCode, catalogInfo]);

  // Cart operations
  const addToCart = useCallback((
    productId: string, 
    productName: string,
    variantIndex: number, 
    price: number,
    unit: string | null,
    unitWeight: number | null,
    images: string[] | null = null,
    packagingType: string | null = null
  ) => {
    if (!catalogInfo) return;

    setCart(prev => {
      const existingIndex = prev.findIndex(
        item => item.productId === productId && item.variantIndex === variantIndex
      );

      let newCart: GuestCartItem[];
      if (existingIndex >= 0) {
        newCart = prev.map((item, idx) => 
          idx === existingIndex 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        newCart = [...prev, {
          productId,
          productName,
          variantIndex,
          quantity: 1,
          price,
          unit,
          unit_weight: unitWeight,
          images,
          packaging_type: packagingType,
        }];
      }

      saveCart(catalogInfo.id, newCart);
      return newCart;
    });
  }, [catalogInfo]);

  const updateCartQuantity = useCallback((productId: string, variantIndex: number, quantity: number) => {
    if (!catalogInfo) return;

    setCart(prev => {
      let newCart: GuestCartItem[];
      if (quantity <= 0) {
        newCart = prev.filter(
          item => !(item.productId === productId && item.variantIndex === variantIndex)
        );
      } else {
        newCart = prev.map(item =>
          item.productId === productId && item.variantIndex === variantIndex
            ? { ...item, quantity }
            : item
        );
      }

      saveCart(catalogInfo.id, newCart);
      return newCart;
    });
  }, [catalogInfo]);

  const removeFromCart = useCallback((productId: string, variantIndex: number) => {
    if (!catalogInfo) return;

    setCart(prev => {
      const newCart = prev.filter(
        item => !(item.productId === productId && item.variantIndex === variantIndex)
      );
      saveCart(catalogInfo.id, newCart);
      return newCart;
    });
  }, [catalogInfo]);

  const clearCart = useCallback(() => {
    if (!catalogInfo) return;
    setCart([]);
    localStorage.removeItem(`${CART_STORAGE_KEY}_${catalogInfo.id}`);
  }, [catalogInfo]);

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Fetch categories for the store
  const fetchCategories = useCallback(async () => {
    if (!catalogInfo?.store_id) return;
    
    try {
      const { data, error: catError } = await supabase
        .from('categories')
        .select('id, name, sort_order')
        .eq('store_id', catalogInfo.store_id)
        .order('sort_order', { ascending: true });
        
      if (!catError && data) {
        setCategories(data);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  }, [catalogInfo?.store_id]);

  // Initial fetch
  useEffect(() => {
    fetchCatalogInfo();
  }, [fetchCatalogInfo]);

  // Fetch products and categories when catalog info is loaded
  useEffect(() => {
    if (catalogInfo) {
      fetchProducts();
      fetchCategories();
    }
  }, [catalogInfo, fetchProducts, fetchCategories]);

  return {
    catalogInfo,
    products,
    categories,
    cart,
    loading,
    productsLoading,
    error,
    addToCart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    cartTotal,
    cartItemsCount,
    refetch: fetchProducts,
  };
}
