import { useState, useEffect, useCallback } from "react";

export interface RetailCartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  unit: string;
}

const CART_STORAGE_KEY = "retail_cart";

function getStoredCart(storeId: string): RetailCartItem[] {
  try {
    const stored = localStorage.getItem(`${CART_STORAGE_KEY}_${storeId}`);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveCart(storeId: string, cart: RetailCartItem[]) {
  try {
    localStorage.setItem(`${CART_STORAGE_KEY}_${storeId}`, JSON.stringify(cart));
  } catch (e) {
    console.error("Failed to save cart:", e);
  }
}

export function useRetailCart(storeId: string | null) {
  const [cart, setCart] = useState<RetailCartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  // Load cart from localStorage
  useEffect(() => {
    if (storeId) {
      setCart(getStoredCart(storeId));
    }
  }, [storeId]);

  // Save cart to localStorage when it changes
  useEffect(() => {
    if (storeId && cart.length >= 0) {
      saveCart(storeId, cart);
    }
  }, [storeId, cart]);

  const addToCart = useCallback((item: Omit<RetailCartItem, "quantity">, quantity: number = 1) => {
    setCart((prev) => {
      const existingIndex = prev.findIndex((i) => i.productId === item.productId);
      
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex].quantity += quantity;
        return updated;
      }
      
      return [...prev, { ...item, quantity }];
    });
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    setCart((prev) => {
      if (quantity <= 0) {
        return prev.filter((i) => i.productId !== productId);
      }
      
      return prev.map((i) =>
        i.productId === productId ? { ...i, quantity } : i
      );
    });
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return {
    cart,
    cartTotal,
    cartItemsCount,
    isOpen,
    setIsOpen,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
  };
}
