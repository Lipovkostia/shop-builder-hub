import React, { useEffect, useState, useCallback } from 'react';
import { X, ChevronRight, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface SpotlightStep {
  id: string;
  targetSelector: string;
  title: string;
  description: string;
  placement: 'top' | 'bottom' | 'left' | 'right';
  action?: () => void;
  waitForSelector?: string;
  highlightPadding?: number;
  hideActions?: boolean;
}

interface SpotlightOverlayProps {
  steps: SpotlightStep[];
  currentStep: number;
  onStepComplete: () => void;
  onSkip: () => void;
  onClose: () => void;
  isActive: boolean;
}

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export const SpotlightOverlay: React.FC<SpotlightOverlayProps> = ({
  steps,
  currentStep,
  onStepComplete,
  onSkip,
  onClose,
  isActive
}) => {
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [isVisible, setIsVisible] = useState(false);

  const step = steps[currentStep];

  const calculatePositions = useCallback(() => {
    if (!step) return;

    const target = document.querySelector(step.targetSelector);
    if (!target) {
      console.log('Spotlight target not found:', step.targetSelector);
      return;
    }

    const rect = target.getBoundingClientRect();
    const padding = step.highlightPadding ?? 8;

    const newTargetRect = {
      top: rect.top - padding,
      left: rect.left - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2
    };

    setTargetRect(newTargetRect);

    // Calculate tooltip position based on placement
    const tooltipWidth = 320;
    const tooltipHeight = 150;
    const gap = 16;

    let tooltipTop = 0;
    let tooltipLeft = 0;

    switch (step.placement) {
      case 'bottom':
        tooltipTop = newTargetRect.top + newTargetRect.height + gap;
        tooltipLeft = newTargetRect.left + newTargetRect.width / 2 - tooltipWidth / 2;
        break;
      case 'top':
        tooltipTop = newTargetRect.top - tooltipHeight - gap;
        tooltipLeft = newTargetRect.left + newTargetRect.width / 2 - tooltipWidth / 2;
        break;
      case 'left':
        tooltipTop = newTargetRect.top + newTargetRect.height / 2 - tooltipHeight / 2;
        tooltipLeft = newTargetRect.left - tooltipWidth - gap;
        break;
      case 'right':
        tooltipTop = newTargetRect.top + newTargetRect.height / 2 - tooltipHeight / 2;
        tooltipLeft = newTargetRect.left + newTargetRect.width + gap;
        break;
    }

    // Keep tooltip within viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (tooltipLeft < 16) tooltipLeft = 16;
    if (tooltipLeft + tooltipWidth > viewportWidth - 16) {
      tooltipLeft = viewportWidth - tooltipWidth - 16;
    }
    if (tooltipTop < 16) tooltipTop = 16;
    if (tooltipTop + tooltipHeight > viewportHeight - 16) {
      tooltipTop = viewportHeight - tooltipHeight - 16;
    }

    setTooltipPosition({ top: tooltipTop, left: tooltipLeft });
  }, [step]);

  useEffect(() => {
    if (!isActive || !step) {
      setIsVisible(false);
      return;
    }

    // Execute step action (e.g., scroll to element)
    if (step.action) {
      step.action();
    }

    // Wait for element to be visible
    const waitAndShow = () => {
      const target = document.querySelector(step.targetSelector);
      if (target) {
        // Scroll element into view
        target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        
        // Wait for scroll to complete
        setTimeout(() => {
          calculatePositions();
          setIsVisible(true);
        }, 300);
      } else {
        // Retry after a short delay
        setTimeout(waitAndShow, 100);
      }
    };

    waitAndShow();

    // Recalculate on resize/scroll
    const handleResize = () => calculatePositions();
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
    };
  }, [isActive, step, calculatePositions]);

  // Handle click on target element when hideActions is true
  useEffect(() => {
    if (!isActive || !step || !isVisible || !step.hideActions) return;

    const target = document.querySelector(step.targetSelector) as HTMLElement;
    if (target) {
      const handleClick = () => {
        onStepComplete();
      };
      target.addEventListener('click', handleClick);
      return () => target.removeEventListener('click', handleClick);
    }
  }, [isActive, step, isVisible, onStepComplete]);

  if (!isActive || !step || !isVisible) return null;

  // Create clip path for the spotlight hole
  const clipPath = targetRect
    ? `polygon(
        0% 0%, 
        0% 100%, 
        ${targetRect.left}px 100%, 
        ${targetRect.left}px ${targetRect.top}px, 
        ${targetRect.left + targetRect.width}px ${targetRect.top}px, 
        ${targetRect.left + targetRect.width}px ${targetRect.top + targetRect.height}px, 
        ${targetRect.left}px ${targetRect.top + targetRect.height}px, 
        ${targetRect.left}px 100%, 
        100% 100%, 
        100% 0%
      )`
    : 'none';

  // Arrow direction based on placement
  const getArrowStyles = () => {
    if (!targetRect) return {};
    
    const arrowSize = 12;
    
    switch (step.placement) {
      case 'bottom':
        return {
          top: tooltipPosition.top - arrowSize,
          left: targetRect.left + targetRect.width / 2 - arrowSize / 2,
          transform: 'rotate(0deg)'
        };
      case 'top':
        return {
          top: tooltipPosition.top + 150,
          left: targetRect.left + targetRect.width / 2 - arrowSize / 2,
          transform: 'rotate(180deg)'
        };
      case 'left':
        return {
          top: targetRect.top + targetRect.height / 2 - arrowSize / 2,
          left: tooltipPosition.left + 320,
          transform: 'rotate(-90deg)'
        };
      case 'right':
        return {
          top: targetRect.top + targetRect.height / 2 - arrowSize / 2,
          left: tooltipPosition.left - arrowSize,
          transform: 'rotate(90deg)'
        };
    }
  };

  const arrowStyles = getArrowStyles();

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      {/* Dark overlay with spotlight hole */}
      <div
        className="absolute inset-0 bg-black/75 transition-all duration-300 pointer-events-auto"
        style={{ clipPath }}
        onClick={onClose}
      />

      {/* Highlight border around target */}
      {targetRect && (
        <div
          className="absolute border-2 border-primary rounded-lg pointer-events-none animate-pulse"
          style={{
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
            boxShadow: '0 0 0 4px hsl(var(--primary) / 0.3), 0 0 20px 8px hsl(var(--primary) / 0.2)'
          }}
        />
      )}

      {/* Arrow pointing to target */}
      <div
        className="absolute pointer-events-none"
        style={{
          ...arrowStyles,
          zIndex: 10001
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-primary animate-bounce">
          <path 
            d="M12 4L12 16M12 16L6 10M12 16L18 10" 
            stroke="currentColor" 
            strokeWidth="3" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Tooltip */}
      <div
        className={cn(
          "absolute w-80 bg-card border border-border rounded-xl shadow-2xl p-5 pointer-events-auto",
          "animate-in fade-in-0 zoom-in-95 duration-300"
        )}
        style={{
          top: tooltipPosition.top,
          left: tooltipPosition.left,
          zIndex: 10002
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Progress indicator */}
        <div className="flex items-center gap-1.5 mb-3">
          {steps.map((_, idx) => (
            <div
              key={idx}
              className={cn(
                "h-1.5 rounded-full transition-all",
                idx === currentStep 
                  ? "w-6 bg-primary" 
                  : idx < currentStep 
                    ? "w-1.5 bg-primary/50"
                    : "w-1.5 bg-muted"
              )}
            />
          ))}
          <span className="text-xs text-muted-foreground ml-2">
            {currentStep + 1} из {steps.length}
          </span>
        </div>

        {/* Content */}
        <h3 className="text-lg font-semibold text-foreground mb-2">
          {step.title}
        </h3>
        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
          {step.description}
        </p>

        {/* Actions */}
        {step.hideActions ? (
          <p className="text-xs text-primary font-medium">
            Нажмите на выделенную кнопку →
          </p>
        ) : (
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={onSkip}
              className="text-muted-foreground hover:text-foreground"
            >
              <SkipForward className="h-4 w-4 mr-1" />
              Пропустить
            </Button>
            <Button
              size="sm"
              onClick={onStepComplete}
              className="bg-primary hover:bg-primary/90"
            >
              Понятно
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
