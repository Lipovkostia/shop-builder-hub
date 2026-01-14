import React from "react";
import { Lightbulb, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DemoTooltipProps {
  message: string;
  targetRect: DOMRect;
  position: "top" | "bottom" | "left" | "right";
  onNext?: () => void;
}

export function DemoTooltip({ message, targetRect, position, onNext }: DemoTooltipProps) {
  // Calculate tooltip position
  const gap = 16;
  let style: React.CSSProperties = {};
  let arrowClass = "";

  switch (position) {
    case "top":
      style = {
        left: targetRect.left + targetRect.width / 2,
        top: targetRect.top - gap,
        transform: "translate(-50%, -100%)",
      };
      arrowClass = "after:top-full after:left-1/2 after:-translate-x-1/2 after:border-t-background/95";
      break;
    case "bottom":
      style = {
        left: targetRect.left + targetRect.width / 2,
        top: targetRect.bottom + gap,
        transform: "translate(-50%, 0)",
      };
      arrowClass = "after:bottom-full after:left-1/2 after:-translate-x-1/2 after:border-b-background/95";
      break;
    case "left":
      style = {
        left: targetRect.left - gap,
        top: targetRect.top + targetRect.height / 2,
        transform: "translate(-100%, -50%)",
      };
      arrowClass = "after:left-full after:top-1/2 after:-translate-y-1/2 after:border-l-background/95";
      break;
    case "right":
      style = {
        left: targetRect.right + gap,
        top: targetRect.top + targetRect.height / 2,
        transform: "translate(0, -50%)",
      };
      arrowClass = "after:right-full after:top-1/2 after:-translate-y-1/2 after:border-r-background/95";
      break;
  }

  // Ensure tooltip stays within viewport
  const maxWidth = Math.min(300, window.innerWidth - 32);

  return (
    <div
      className={`
        absolute z-[10002] pointer-events-auto
        max-w-[300px] p-4 rounded-xl
        bg-background/95 backdrop-blur-sm
        border border-border shadow-2xl
        animate-demo-tooltip
        after:absolute after:border-8 after:border-transparent
        ${arrowClass}
      `}
      style={{ ...style, maxWidth }}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Lightbulb className="w-4 h-4 text-primary" />
        </div>
        <p className="text-sm text-foreground leading-relaxed">{message}</p>
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
