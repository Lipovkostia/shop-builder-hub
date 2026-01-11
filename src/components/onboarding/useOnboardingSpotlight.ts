import { useState, useCallback, useEffect } from 'react';
import { SpotlightStep } from './SpotlightOverlay';

interface UseOnboardingSpotlightOptions {
  storageKey: string;
  steps: SpotlightStep[];
  isOnboardingActive: boolean;
  onComplete?: () => void;
}

export function useOnboardingSpotlight({
  storageKey,
  steps,
  isOnboardingActive,
  onComplete
}: UseOnboardingSpotlightOptions) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSpotlightActive, setIsSpotlightActive] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);

  // Check if spotlight was already completed
  useEffect(() => {
    const completed = localStorage.getItem(storageKey) === 'completed';
    setHasCompleted(completed);
  }, [storageKey]);

  // Start spotlight when onboarding becomes active
  useEffect(() => {
    if (isOnboardingActive && !hasCompleted) {
      // Small delay to let the UI settle
      const timer = setTimeout(() => {
        setIsSpotlightActive(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isOnboardingActive, hasCompleted]);

  const goToStep = useCallback((stepIndex: number) => {
    if (stepIndex >= 0 && stepIndex < steps.length) {
      setCurrentStep(stepIndex);
    }
  }, [steps.length]);

  const nextStep = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      // All steps completed
      localStorage.setItem(storageKey, 'completed');
      setIsSpotlightActive(false);
      setHasCompleted(true);
      onComplete?.();
    }
  }, [currentStep, steps.length, storageKey, onComplete]);

  const skipSpotlight = useCallback(() => {
    localStorage.setItem(storageKey, 'completed');
    setIsSpotlightActive(false);
    setHasCompleted(true);
    onComplete?.();
  }, [storageKey, onComplete]);

  const closeSpotlight = useCallback(() => {
    setIsSpotlightActive(false);
  }, []);

  const resetSpotlight = useCallback(() => {
    localStorage.removeItem(storageKey);
    setCurrentStep(0);
    setHasCompleted(false);
    setIsSpotlightActive(true);
  }, [storageKey]);

  const startSpotlightFromStep = useCallback((stepId: string) => {
    const stepIndex = steps.findIndex(s => s.id === stepId);
    if (stepIndex >= 0) {
      setCurrentStep(stepIndex);
      setIsSpotlightActive(true);
    }
  }, [steps]);

  return {
    currentStep,
    isSpotlightActive,
    hasCompleted,
    goToStep,
    nextStep,
    skipSpotlight,
    closeSpotlight,
    resetSpotlight,
    startSpotlightFromStep
  };
}
