import React from "react";
import { X } from "lucide-react";

interface DemoProgressProps {
  currentStep: number;
  totalSteps: number;
  onSkip: () => void;
}

export function DemoProgress({ currentStep, totalSteps, onSkip }: DemoProgressProps) {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[10003] flex items-center gap-3 bg-background/95 backdrop-blur-sm rounded-full px-3 py-2 border border-border shadow-lg max-w-[90vw]">
      {/* Progress dots */}
      <div className="flex items-center gap-1">
        {Array.from({ length: totalSteps }).map((_, idx) => (
          <div
            key={idx}
            className={`
              h-2 rounded-full transition-all duration-300
              ${idx === currentStep 
                ? "bg-primary w-3" 
                : idx < currentStep 
                  ? "bg-primary/50 w-2" 
                  : "bg-muted-foreground/30 w-2"
              }
            `}
          />
        ))}
      </div>
      
      {/* Step counter */}
      <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
        {currentStep + 1}/{totalSteps}
      </span>

      {/* Skip button */}
      <button
        onClick={onSkip}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
      >
        <X className="w-3 h-3" />
        <span className="hidden sm:inline">Пропустить</span>
      </button>
    </div>
  );
}
