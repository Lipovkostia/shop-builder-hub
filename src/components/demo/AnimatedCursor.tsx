import React, { useState, useEffect } from "react";
import { Hand } from "lucide-react";

interface AnimatedCursorProps {
  targetRect: DOMRect;
  action: "point" | "tap" | "hold";
  isActive: boolean;
}

export function AnimatedCursor({ targetRect, action, isActive }: AnimatedCursorProps) {
  const [phase, setPhase] = useState<"moving" | "tapping" | "holding" | "done">("moving");
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);

  // Target position - offset to point at element better
  const targetX = targetRect.left + targetRect.width / 2;
  const targetY = targetRect.top + targetRect.height / 2 + 5;

  useEffect(() => {
    if (!isActive) {
      setIsVisible(false);
      return;
    }

    // Reset phase
    setPhase("moving");
    
    // Start from slightly offset position
    setPosition({ 
      x: targetX + 50, 
      y: targetY - 50 
    });

    // Show after brief delay
    const showTimer = setTimeout(() => {
      setIsVisible(true);
    }, 50);

    // After cursor arrives (500ms), do action
    const actionTimer = setTimeout(() => {
      if (action === "tap") {
        setPhase("tapping");
        setTimeout(() => setPhase("done"), 300);
      } else if (action === "hold") {
        setPhase("holding");
      } else {
        setPhase("done");
      }
    }, 550);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(actionTimer);
    };
  }, [isActive, action, targetX, targetY]);

  // Update position with animation
  useEffect(() => {
    if (phase === "moving" && isVisible) {
      requestAnimationFrame(() => {
        setPosition({ x: targetX, y: targetY });
      });
    }
  }, [phase, targetX, targetY, isVisible]);

  if (!isVisible) return null;

  return (
    <div
      className={`
        fixed z-[10001] pointer-events-none
        transition-all duration-500 ease-out
        ${phase === "tapping" ? "scale-90" : "scale-100"}
      `}
      style={{
        left: position.x,
        top: position.y,
        transform: "translate(-50%, -50%)",
      }}
    >
      {/* Finger icon */}
      <div className="relative">
        <div className="w-10 h-10 bg-white rounded-full shadow-xl flex items-center justify-center border-2 border-primary/20">
          <Hand className="w-5 h-5 text-primary rotate-[20deg]" />
        </div>
        
        {/* Ripple effect on tap */}
        {phase === "tapping" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 bg-primary/40 rounded-full animate-demo-ripple" />
          </div>
        )}
        
        {/* Hold indicator */}
        {phase === "holding" && (
          <svg className="absolute -inset-1.5 w-[52px] h-[52px]" viewBox="0 0 52 52">
            <circle
              cx="26"
              cy="26"
              r="22"
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="2.5"
              strokeDasharray="138"
              className="animate-demo-hold-progress"
              style={{ 
                strokeLinecap: "round",
                transformOrigin: "center",
                transform: "rotate(-90deg)"
              }}
            />
          </svg>
        )}
      </div>
    </div>
  );
}
