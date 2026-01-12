import React, { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Lightbulb } from "lucide-react";
import { useOnboarding } from "@/contexts/OnboardingContext";

interface SpotlightOverlayProps {
  targetSelector: string;
  message: string;
  pulsatingSelector?: string;
  onSkip?: () => void;
  canSkip?: boolean;
}

export function SpotlightOverlay({
  targetSelector,
  message,
  pulsatingSelector,
  onSkip,
  canSkip = true,
}: SpotlightOverlayProps) {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);

  const updateTargetPosition = useCallback(() => {
    const element = document.querySelector(targetSelector);
    if (element) {
      setTargetRect(element.getBoundingClientRect());
    }
  }, [targetSelector]);

  useEffect(() => {
    setMounted(true);
    
    // Initial position
    updateTargetPosition();

    // Update on scroll/resize
    const handleUpdate = () => {
      requestAnimationFrame(updateTargetPosition);
    };

    window.addEventListener("scroll", handleUpdate, true);
    window.addEventListener("resize", handleUpdate);

    // Use ResizeObserver for dynamic content
    const observer = new ResizeObserver(handleUpdate);
    const element = document.querySelector(targetSelector);
    if (element) {
      observer.observe(element);
    }

    // Update periodically for dropdown animations
    const interval = setInterval(updateTargetPosition, 100);

    return () => {
      window.removeEventListener("scroll", handleUpdate, true);
      window.removeEventListener("resize", handleUpdate);
      observer.disconnect();
      clearInterval(interval);
    };
  }, [targetSelector, updateTargetPosition]);

  // Add pulsating class to element
  useEffect(() => {
    if (!pulsatingSelector) return;

    const addPulse = () => {
      const element = document.querySelector(pulsatingSelector);
      if (element) {
        element.classList.add("onboarding-pulse");
      }
    };

    // Try immediately and with delay for dynamic content
    addPulse();
    const interval = setInterval(addPulse, 200);

    return () => {
      clearInterval(interval);
      const element = document.querySelector(pulsatingSelector);
      if (element) {
        element.classList.remove("onboarding-pulse");
      }
    };
  }, [pulsatingSelector]);

  if (!mounted) return null;

  const padding = 8;

  return createPortal(
    <div className="fixed inset-0 z-[9999]">
      {/* Dark overlay with hole */}
      <div 
        className="absolute inset-0 bg-black/70 transition-all duration-300"
        style={targetRect ? {
          clipPath: `polygon(
            0% 0%, 
            0% 100%, 
            ${targetRect.left - padding}px 100%, 
            ${targetRect.left - padding}px ${targetRect.top - padding}px, 
            ${targetRect.right + padding}px ${targetRect.top - padding}px, 
            ${targetRect.right + padding}px ${targetRect.bottom + padding}px, 
            ${targetRect.left - padding}px ${targetRect.bottom + padding}px, 
            ${targetRect.left - padding}px 100%, 
            100% 100%, 
            100% 0%
          )`,
        } : undefined}
      />

      {/* Highlight border around target */}
      {targetRect && (
        <div 
          className="absolute border-2 border-primary rounded-lg pointer-events-none transition-all duration-300"
          style={{
            top: targetRect.top - padding,
            left: targetRect.left - padding,
            width: targetRect.width + padding * 2,
            height: targetRect.height + padding * 2,
            boxShadow: '0 0 0 4px hsl(var(--primary) / 0.3)',
          }}
        />
      )}

      {/* Message tooltip - centered on mobile, below target on desktop */}
      <div 
        className="fixed left-4 right-4 top-1/2 -translate-y-1/2 md:top-auto md:translate-y-0 md:absolute md:left-auto md:right-auto"
        style={targetRect && window.innerWidth >= 768 ? {
          top: targetRect.bottom + padding + 16,
          left: Math.max(16, Math.min(targetRect.left, window.innerWidth - 320)),
          maxWidth: 300,
        } : undefined}
      >
        <div className="bg-card border border-border rounded-xl p-4 shadow-2xl">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Lightbulb className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground leading-relaxed">{message}</p>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function OnboardingSpotlight() {
  const { currentStep, isActive, skipOnboarding } = useOnboarding();

  if (!isActive || !currentStep) return null;

  // First step is mandatory - no skip button
  const isMandatoryStep = currentStep.id === 'create-pricelist';

  return (
    <SpotlightOverlay
      targetSelector={currentStep.targetSelector}
      message={currentStep.description}
      pulsatingSelector={(currentStep as any).pulsatingSelector}
      onSkip={skipOnboarding}
      canSkip={!isMandatoryStep}
    />
  );
}
