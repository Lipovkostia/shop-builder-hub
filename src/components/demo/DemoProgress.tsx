import React from "react";
import { X } from "lucide-react";

interface DemoProgressProps {
  currentStep: number;
  totalSteps: number;
  onSkip: () => void;
}

export function DemoProgress({ currentStep, totalSteps, onSkip }: DemoProgressProps) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[10003] flex items-center gap-4 bg-background/90 backdrop-blur-sm rounded-full px-4 py-2 border border-border shadow-lg">
      {/* Progress dots */}
      <div className="flex items-center gap-1.5">
        {Array.from({ length: totalSteps }).map((_, idx) => (
          <div
            key={idx}
            className={`
              w-2 h-2 rounded-full transition-all duration-300
              ${idx === currentStep 
                ? "bg-primary w-4" 
                : idx < currentStep 
                  ? "bg-primary/50" 
                  : "bg-muted-foreground/30"
              }
            `}
          />
        ))}
      </div>
      
      {/* Step counter */}
      <span className="text-xs text-muted-foreground tabular-nums">
        {currentStep + 1} / {totalSteps}
      </span>

      {/* Skip button */}
      <button
        onClick={onSkip}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="w-3 h-3" />
        Пропустить
      </button>
    </div>
  );
}
