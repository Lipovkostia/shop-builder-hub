import { useState, useEffect, useCallback } from "react";

export interface WholesaleCartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  unit: string;
  sku?: string;
  moyskladId?: string;
}

const CART_STORAGE_KEY = "wholesale_cart";

function getStoredCart(key: string): WholesaleCartItem[] {
  try {
    const stored = localStorage.getItem(`${CART_STORAGE_KEY}_${key}`);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveCart(key: string, cart: WholesaleCartItem[]) {
  try {
    localStorage.setItem(`${CART_STORAGE_KEY}_${key}`, JSON.stringify(cart));
  } catch (e) {
    console.error("Failed to save wholesale cart:", e);
  }
}

export function useWholesaleCart(subdomain: string | null) {
  const [cart, setCart] = useState<WholesaleCartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [cartKey, setCartKey] = useState<string | null>(null);

  // Set cart key and load cart from localStorage
  useEffect(() => {
    if (subdomain) {
      setCartKey(subdomain);
      setCart(getStoredCart(subdomain));
    }
  }, [subdomain]);

  // Save cart to localStorage when it changes
  useEffect(() => {
    if (cartKey && cart.length >= 0) {
      saveCart(cartKey, cart);
    }
  }, [cartKey, cart]);

  const addToCart = useCallback((item: Omit<WholesaleCartItem, "quantity">, quantity: number = 1) => {
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
