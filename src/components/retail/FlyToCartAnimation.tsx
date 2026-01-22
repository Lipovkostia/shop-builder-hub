import { useState, useEffect, useCallback, useRef } from "react";
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
  const [phase, setPhase] = useState<"initial" | "lift" | "arc" | "land" | "done">("initial");
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Phase 1: Initial lift with scale up (gives anticipation)
    const liftTimer = requestAnimationFrame(() => {
      setPhase("lift");
    });

    // Phase 2: Arc flight (main movement)
    const arcTimer = setTimeout(() => {
      setPhase("arc");
    }, 120);

    // Phase 3: Landing with bounce
    const landTimer = setTimeout(() => {
      setPhase("land");
    }, 720);

    // Phase 4: Fade out
    const doneTimer = setTimeout(() => {
      setPhase("done");
    }, 900);

    // Cleanup
    const cleanupTimer = setTimeout(() => {
      onComplete();
    }, 1050);

    return () => {
      cancelAnimationFrame(liftTimer);
      clearTimeout(arcTimer);
      clearTimeout(landTimer);
      clearTimeout(doneTimer);
      clearTimeout(cleanupTimer);
    };
  }, [onComplete]);

  const deltaX = item.endX - item.startX;
  const deltaY = item.endY - item.startY;
  
  // Calculate arc control point for bezier-like curve effect
  // The arc goes up and to the side for a natural parabolic feel
  const arcHeight = Math.min(Math.abs(deltaY) * 0.4, 80);

  const getTransform = () => {
    switch (phase) {
      case "initial":
        return "translate(0, 0) scale(1) rotate(0deg)";
      case "lift":
        // Slight lift up and scale for anticipation
        return `translate(0, -12px) scale(1.08) rotate(-3deg)`;
      case "arc":
        // Main arc movement with rotation
        return `translate(${deltaX}px, ${deltaY}px) scale(0.35) rotate(360deg)`;
      case "land":
        // Slight overshoot bounce
        return `translate(${deltaX}px, ${deltaY - 4}px) scale(0.28) rotate(360deg)`;
      case "done":
        return `translate(${deltaX}px, ${deltaY}px) scale(0.15) rotate(360deg)`;
      default:
        return "translate(0, 0) scale(1) rotate(0deg)";
    }
  };

  const getSize = () => {
    switch (phase) {
      case "initial":
      case "lift":
        return 56;
      case "arc":
        return 48;
      case "land":
      case "done":
        return 40;
      default:
        return 56;
    }
  };

  const getOpacity = () => {
    switch (phase) {
      case "done":
        return 0;
      default:
        return 1;
    }
  };

  const getBoxShadow = () => {
    switch (phase) {
      case "lift":
        return "0 8px 32px -4px rgba(0, 0, 0, 0.25), 0 0 0 2px rgba(255, 255, 255, 0.8)";
      case "arc":
        return "0 12px 40px -8px rgba(0, 0, 0, 0.3), 0 0 20px rgba(var(--primary), 0.3)";
      case "land":
        return "0 2px 8px rgba(0, 0, 0, 0.2)";
      default:
        return "0 4px 16px rgba(0, 0, 0, 0.15)";
    }
  };

  const getTransition = () => {
    switch (phase) {
      case "lift":
        return "all 120ms cubic-bezier(0.34, 1.56, 0.64, 1)";
      case "arc":
        return "all 600ms cubic-bezier(0.25, 0.46, 0.45, 0.94)";
      case "land":
        return "all 180ms cubic-bezier(0.34, 1.56, 0.64, 1)";
      case "done":
        return "all 150ms ease-out";
      default:
        return "none";
    }
  };

  const size = getSize();

  return (
    <>
      {/* Trail effect */}
      {phase === "arc" && (
        <div
          className="fixed pointer-events-none z-[9998] rounded-full"
          style={{
            left: item.startX,
            top: item.startY,
            width: 24,
            height: 24,
            background: "radial-gradient(circle, hsl(var(--primary) / 0.4) 0%, transparent 70%)",
            transform: `translate(${deltaX * 0.3}px, ${deltaY * 0.3}px)`,
            opacity: 0.6,
            transition: "all 400ms ease-out",
          }}
        />
      )}

      {/* Main flying element */}
      <div
        ref={elementRef}
        className={cn(
          "fixed pointer-events-none z-[9999] rounded-2xl overflow-hidden",
          phase === "arc" && "ring-2 ring-primary/30"
        )}
        style={{
          left: item.startX,
          top: item.startY,
          width: size,
          height: size,
          transform: getTransform(),
          opacity: getOpacity(),
          boxShadow: getBoxShadow(),
          transition: getTransition(),
          willChange: "transform, opacity",
        }}
      >
        {/* Glow overlay */}
        <div 
          className="absolute inset-0 z-10 rounded-2xl"
          style={{
            background: phase === "arc" 
              ? "radial-gradient(circle at center, rgba(255,255,255,0.3) 0%, transparent 60%)"
              : "none",
            transition: "all 300ms ease",
          }}
        />
        
        {/* Product image */}
        <img
          src={item.imageUrl}
          alt=""
          className="w-full h-full object-cover"
          style={{
            filter: phase === "arc" ? "brightness(1.1) saturate(1.1)" : "none",
            transition: "filter 300ms ease",
          }}
        />
      </div>

      {/* Landing pulse effect */}
      {(phase === "land" || phase === "done") && (
        <div
          className="fixed pointer-events-none z-[9997] rounded-full"
          style={{
            left: item.endX - 20,
            top: item.endY - 20,
            width: 40,
            height: 40,
            background: "radial-gradient(circle, hsl(var(--primary) / 0.5) 0%, transparent 70%)",
            transform: phase === "done" ? "scale(2.5)" : "scale(1)",
            opacity: phase === "done" ? 0 : 0.8,
            transition: "all 200ms ease-out",
          }}
        />
      )}
    </>
  );
}
