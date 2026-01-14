import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { AnimatedCursor } from "./AnimatedCursor";
import { DemoTooltip } from "./DemoTooltip";
import { DemoProgress } from "./DemoProgress";

export interface DemoStep {
  id: string;
  targetSelector: string;
  action: "point" | "tap" | "hold";
  tooltip: string;
  tooltipPosition: "top" | "bottom" | "left" | "right";
  duration: number;
  highlightPadding?: number;
  onBeforeStep?: () => void;
  onAfterStep?: () => void;
}

interface DemoTourProps {
  steps: DemoStep[];
  onComplete: () => void;
  onSkip: () => void;
  autoPlay?: boolean;
}

export function DemoTour({ steps, onComplete, onSkip, autoPlay = true }: DemoTourProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const currentStep = steps[currentStepIndex];

  // Find target element and get its rect
  const updateTargetRect = useCallback(() => {
    if (!currentStep) return;
    
    const element = document.querySelector(currentStep.targetSelector);
    if (element) {
      const rect = element.getBoundingClientRect();
      setTargetRect(rect);
    }
  }, [currentStep]);

  // Update rect on scroll/resize
  useEffect(() => {
    updateTargetRect();
    
    window.addEventListener("scroll", updateTargetRect, true);
    window.addEventListener("resize", updateTargetRect);
    
    return () => {
      window.removeEventListener("scroll", updateTargetRect, true);
      window.removeEventListener("resize", updateTargetRect);
    };
  }, [updateTargetRect]);

  // Run step lifecycle
  useEffect(() => {
    if (!currentStep || !targetRect) return;

    // Execute onBeforeStep
    currentStep.onBeforeStep?.();

    // Start animation
    setIsAnimating(true);
    setShowTooltip(false);

    // Show tooltip after cursor arrives (800ms)
    const tooltipTimer = setTimeout(() => {
      setShowTooltip(true);
    }, 800);

    // If autoPlay, move to next step after duration
    let nextTimer: NodeJS.Timeout | null = null;
    if (autoPlay) {
      nextTimer = setTimeout(() => {
        currentStep.onAfterStep?.();
        
        if (currentStepIndex < steps.length - 1) {
          setCurrentStepIndex(prev => prev + 1);
        } else {
          onComplete();
        }
      }, currentStep.duration);
    }

    return () => {
      clearTimeout(tooltipTimer);
      if (nextTimer) clearTimeout(nextTimer);
    };
  }, [currentStep, targetRect, currentStepIndex, steps.length, autoPlay, onComplete]);

  const handleNext = () => {
    currentStep?.onAfterStep?.();
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      onComplete();
    }
  };

  if (!currentStep || !targetRect) return null;

  const padding = currentStep.highlightPadding ?? 8;
  const highlightRect = {
    x: targetRect.left - padding,
    y: targetRect.top - padding,
    width: targetRect.width + padding * 2,
    height: targetRect.height + padding * 2,
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] pointer-events-auto">
      {/* Dark overlay with cutout */}
      <svg className="absolute inset-0 w-full h-full">
        <defs>
          <mask id="demo-spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect
              x={highlightRect.x}
              y={highlightRect.y}
              width={highlightRect.width}
              height={highlightRect.height}
              rx="8"
              fill="black"
            />
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.7)"
          mask="url(#demo-spotlight-mask)"
        />
      </svg>

      {/* Highlight border */}
      <div
        className="absolute rounded-lg border-2 border-primary shadow-[0_0_20px_rgba(var(--primary),0.4)] animate-demo-spotlight"
        style={{
          left: highlightRect.x,
          top: highlightRect.y,
          width: highlightRect.width,
          height: highlightRect.height,
          pointerEvents: "none",
        }}
      />

      {/* Animated cursor */}
      <AnimatedCursor
        targetRect={targetRect}
        action={currentStep.action}
        isActive={isAnimating}
      />

      {/* Tooltip */}
      {showTooltip && (
        <DemoTooltip
          message={currentStep.tooltip}
          targetRect={targetRect}
          position={currentStep.tooltipPosition}
          onNext={!autoPlay ? handleNext : undefined}
        />
      )}

      {/* Progress */}
      <DemoProgress
        currentStep={currentStepIndex}
        totalSteps={steps.length}
        onSkip={onSkip}
      />
    </div>,
    document.body
  );
}
