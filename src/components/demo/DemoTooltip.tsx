import React, { useEffect, useState, useRef } from "react";
import { Lightbulb, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DemoTooltipProps {
  message: string;
  targetRect: DOMRect;
  position: "top" | "bottom" | "left" | "right";
  onNext?: () => void;
}

export function DemoTooltip({ message, targetRect, position, onNext }: DemoTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [adjustedStyle, setAdjustedStyle] = useState<React.CSSProperties>({});
  const [arrowStyle, setArrowStyle] = useState<React.CSSProperties>({});
  
  const gap = 12;
  const padding = 16; // Padding from screen edges
  const maxWidth = Math.min(280, window.innerWidth - padding * 2);

  useEffect(() => {
    // Calculate initial position
    let x = 0;
    let y = 0;

    switch (position) {
      case "top":
        x = targetRect.left + targetRect.width / 2;
        y = targetRect.top - gap;
        break;
      case "bottom":
        x = targetRect.left + targetRect.width / 2;
        y = targetRect.bottom + gap;
        break;
      case "left":
        x = targetRect.left - gap;
        y = targetRect.top + targetRect.height / 2;
        break;
      case "right":
        x = targetRect.right + gap;
        y = targetRect.top + targetRect.height / 2;
        break;
    }

    // Wait for render to get tooltip dimensions
    requestAnimationFrame(() => {
      if (!tooltipRef.current) return;
      
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let finalX = x;
      let finalY = y;
      let arrowOffsetX = 0;
      let arrowOffsetY = 0;

      // For mobile, prefer bottom/top positions to avoid left/right overflow
      const isMobile = viewportWidth < 640;

      if (position === "left" || position === "right") {
        // Center vertically
        finalY = y - tooltipRect.height / 2;

        if (position === "left") {
          finalX = x - tooltipRect.width;
        }

        // Check horizontal overflow - if it overflows, switch to bottom position
        if (isMobile || finalX < padding || finalX + tooltipRect.width > viewportWidth - padding) {
          // Switch to bottom position
          finalX = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
          finalY = targetRect.bottom + gap;

          // Clamp to screen bounds
          if (finalX < padding) {
            arrowOffsetX = finalX - padding;
            finalX = padding;
          } else if (finalX + tooltipRect.width > viewportWidth - padding) {
            arrowOffsetX = (finalX + tooltipRect.width) - (viewportWidth - padding);
            finalX = viewportWidth - padding - tooltipRect.width;
          }
        }
      } else {
        // Top or bottom position
        finalX = x - tooltipRect.width / 2;

        if (position === "top") {
          finalY = y - tooltipRect.height;
        }

        // Clamp horizontal position
        if (finalX < padding) {
          arrowOffsetX = finalX - padding;
          finalX = padding;
        } else if (finalX + tooltipRect.width > viewportWidth - padding) {
          arrowOffsetX = (finalX + tooltipRect.width) - (viewportWidth - padding);
          finalX = viewportWidth - padding - tooltipRect.width;
        }

        // Check vertical overflow
        if (finalY < padding && position === "top") {
          // Switch to bottom
          finalY = targetRect.bottom + gap;
        } else if (finalY + tooltipRect.height > viewportHeight - padding && position === "bottom") {
          // Switch to top
          finalY = targetRect.top - gap - tooltipRect.height;
        }
      }

      // Clamp vertical position
      if (finalY < padding) {
        finalY = padding;
      } else if (finalY + tooltipRect.height > viewportHeight - padding) {
        finalY = viewportHeight - padding - tooltipRect.height;
      }

      setAdjustedStyle({
        left: finalX,
        top: finalY,
        maxWidth,
      });

      // Calculate arrow position based on target center
      const targetCenterX = targetRect.left + targetRect.width / 2;
      const tooltipCenterX = finalX + tooltipRect.width / 2;
      const arrowLeft = Math.max(16, Math.min(tooltipRect.width - 16, targetCenterX - finalX));

      setArrowStyle({
        left: arrowLeft,
        transform: 'translateX(-50%)',
      });
    });
  }, [targetRect, position, maxWidth]);

  // Determine if tooltip is above or below target
  const isBelow = (adjustedStyle.top as number || 0) > targetRect.top;

  return (
    <div
      ref={tooltipRef}
      className={`
        fixed z-[10002] pointer-events-auto
        p-3 rounded-xl
        bg-background/95 backdrop-blur-sm
        border border-border shadow-2xl
        animate-demo-tooltip
      `}
      style={adjustedStyle}
    >
      {/* Arrow */}
      <div 
        className={`
          absolute w-3 h-3 bg-background/95 border-border rotate-45
          ${isBelow 
            ? '-top-1.5 border-l border-t' 
            : '-bottom-1.5 border-r border-b'
          }
        `}
        style={arrowStyle}
      />

      <div className="flex items-start gap-2">
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
          <Lightbulb className="w-3.5 h-3.5 text-primary" />
        </div>
        <p className="text-sm text-foreground leading-relaxed flex-1">{message}</p>
      </div>
      
      {onNext && (
        <Button
          size="sm"
          className="mt-3 w-full"
          onClick={onNext}
        >
          Далее
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      )}
    </div>
  );
}
