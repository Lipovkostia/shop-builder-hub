import React, { useState, useEffect } from "react";
import { Hand } from "lucide-react";

interface AnimatedCursorProps {
  targetRect: DOMRect;
  action: "point" | "tap" | "hold";
  isActive: boolean;
}

export function AnimatedCursor({ targetRect, action, isActive }: AnimatedCursorProps) {
  const [phase, setPhase] = useState<"moving" | "tapping" | "holding" | "done">("moving");
  const [position, setPosition] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

  // Target position (center of element)
  const targetX = targetRect.left + targetRect.width / 2;
  const targetY = targetRect.top + targetRect.height / 2;

  useEffect(() => {
    if (!isActive) return;

    // Reset phase
    setPhase("moving");

    // After cursor arrives (600ms), do action
    const actionTimer = setTimeout(() => {
      if (action === "tap") {
        setPhase("tapping");
        // Reset after tap animation
        setTimeout(() => setPhase("done"), 300);
      } else if (action === "hold") {
        setPhase("holding");
      } else {
        setPhase("done");
      }
    }, 600);

    return () => clearTimeout(actionTimer);
  }, [isActive, action, targetRect]);

  // Update position with animation
  useEffect(() => {
    if (phase === "moving") {
      // Start from center of screen
      setPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      
      // Animate to target
      requestAnimationFrame(() => {
        setPosition({ x: targetX, y: targetY + 10 }); // Offset finger tip
      });
    }
  }, [phase, targetX, targetY]);

  return (
    <>
      {/* Cursor */}
      <div
        className={`
          absolute z-[10001] pointer-events-none
          transition-all duration-[600ms] ease-out
          ${phase === "tapping" ? "animate-demo-tap" : ""}
          ${phase === "holding" ? "animate-demo-hold" : ""}
        `}
        style={{
          left: position.x,
          top: position.y,
          transform: "translate(-50%, -50%)",
        }}
      >
        {/* Finger icon with glow */}
        <div className="relative">
          <div className="w-12 h-12 bg-white rounded-full shadow-xl flex items-center justify-center">
            <Hand className="w-6 h-6 text-primary rotate-[20deg]" />
          </div>
          
          {/* Ripple effect on tap */}
          {phase === "tapping" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 bg-primary/30 rounded-full animate-demo-ripple" />
            </div>
          )}
          
          {/* Hold indicator */}
          {phase === "holding" && (
            <svg className="absolute -inset-2 w-16 h-16" viewBox="0 0 64 64">
              <circle
                cx="32"
                cy="32"
                r="28"
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="3"
                strokeDasharray="176"
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
    </>
  );
}
