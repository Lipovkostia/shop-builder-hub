import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface FlyingItem {
  id: string;
  imageUrl: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

interface FlyToCartAnimationProps {
  cartIconRef: React.RefObject<HTMLElement>;
}

// Global event system for triggering animations
const flyToCartListeners: Set<(item: Omit<FlyingItem, "endX" | "endY">) => void> = new Set();

export function triggerFlyToCart(
  imageUrl: string,
  startX: number,
  startY: number
) {
  const id = `fly-${Date.now()}-${Math.random()}`;
  flyToCartListeners.forEach((listener) => 
    listener({ id, imageUrl, startX, startY })
  );
}

export function FlyToCartAnimation({ cartIconRef }: FlyToCartAnimationProps) {
  const [flyingItems, setFlyingItems] = useState<FlyingItem[]>([]);

  const addFlyingItem = useCallback((item: Omit<FlyingItem, "endX" | "endY">) => {
    if (!cartIconRef.current) return;
    
    const cartRect = cartIconRef.current.getBoundingClientRect();
    const endX = cartRect.left + cartRect.width / 2;
    const endY = cartRect.top + cartRect.height / 2;

    setFlyingItems((prev) => [...prev, { ...item, endX, endY }]);
  }, [cartIconRef]);

  useEffect(() => {
    flyToCartListeners.add(addFlyingItem);
    return () => {
      flyToCartListeners.delete(addFlyingItem);
    };
  }, [addFlyingItem]);

  const removeItem = useCallback((id: string) => {
    setFlyingItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  if (flyingItems.length === 0) return null;

  return createPortal(
    <>
      {flyingItems.map((item) => (
        <FlyingImage key={item.id} item={item} onComplete={() => removeItem(item.id)} />
      ))}
    </>,
    document.body
  );
}

interface FlyingImageProps {
  item: FlyingItem;
  onComplete: () => void;
}

function FlyingImage({ item, onComplete }: FlyingImageProps) {
  const [phase, setPhase] = useState<"start" | "flying" | "done">("start");

  useEffect(() => {
    // Start animation after mount
    const startTimer = requestAnimationFrame(() => {
      setPhase("flying");
    });

    // Complete animation
    const endTimer = setTimeout(() => {
      setPhase("done");
      setTimeout(onComplete, 50);
    }, 400);

    return () => {
      cancelAnimationFrame(startTimer);
      clearTimeout(endTimer);
    };
  }, [onComplete]);

  const translateX = item.endX - item.startX;
  const translateY = item.endY - item.startY;

  return (
    <div
      className={cn(
        "fixed pointer-events-none z-[9999] rounded-lg overflow-hidden shadow-lg",
        "transition-all duration-[400ms] ease-out"
      )}
      style={{
        left: item.startX,
        top: item.startY,
        width: phase === "start" ? 60 : 20,
        height: phase === "start" ? 60 : 20,
        transform: phase === "flying" 
          ? `translate(${translateX}px, ${translateY}px) scale(0.3) rotate(15deg)` 
          : "translate(0, 0) scale(1) rotate(0deg)",
        opacity: phase === "done" ? 0 : 1,
      }}
    >
      <img
        src={item.imageUrl}
        alt=""
        className="w-full h-full object-cover"
      />
    </div>
  );
}
