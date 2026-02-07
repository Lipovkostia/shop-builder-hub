import { useState, useEffect, useCallback } from "react";

export interface ShowcaseCartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  unit: string;
}

const CART_STORAGE_KEY = "showcase_cart";

function getStoredCart(key: string): ShowcaseCartItem[] {
  try {
    const stored = localStorage.getItem(`${CART_STORAGE_KEY}_${key}`);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function saveCart(key: string, cart: ShowcaseCartItem[]) {
  try { localStorage.setItem(`${CART_STORAGE_KEY}_${key}`, JSON.stringify(cart)); }
  catch (e) { console.error("Failed to save cart:", e); }
}

export function useShowcaseCart(storeIdOrSubdomain: string | null) {
  const [cart, setCart] = useState<ShowcaseCartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [cartKey, setCartKey] = useState<string | null>(null);

  useEffect(() => {
    if (storeIdOrSubdomain) {
      setCartKey(storeIdOrSubdomain);
      setCart(getStoredCart(storeIdOrSubdomain));
    }
  }, [storeIdOrSubdomain]);

  useEffect(() => {
    if (cartKey && cart.length >= 0) saveCart(cartKey, cart);
  }, [cartKey, cart]);

  const addToCart = useCallback((item: Omit<ShowcaseCartItem, "quantity">, quantity: number = 1) => {
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.productId === item.productId);
      if (idx >= 0) { const updated = [...prev]; updated[idx].quantity += quantity; return updated; }
      return [...prev, { ...item, quantity }];
    });
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    setCart((prev) => quantity <= 0 ? prev.filter((i) => i.productId !== productId) : prev.map((i) => i.productId === productId ? { ...i, quantity } : i));
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return { cart, cartTotal, cartItemsCount, isOpen, setIsOpen, addToCart, updateQuantity, removeFromCart, clearCart };
}
