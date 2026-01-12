import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { onboardingSteps, OnboardingStep } from "@/components/onboarding/onboardingSteps";

interface OnboardingContextType {
  currentStep: OnboardingStep | null;
  currentStepIndex: number;
  isActive: boolean;
  steps: OnboardingStep[];
  completedSteps: string[];
  startOnboarding: (fromStepId?: string) => void;
  nextStep: () => void;
  skipOnboarding: () => void;
  goToStep: (stepId: string) => void;
  completeStep: (stepId: string) => void;
  resetOnboarding: () => void;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

const COMPLETED_STEPS_KEY = "seller_onboarding_completed_steps";

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(-1);
  const [completedSteps, setCompletedSteps] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(COMPLETED_STEPS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const isActive = currentStepIndex >= 0 && currentStepIndex < onboardingSteps.length;
  const currentStep = isActive ? onboardingSteps[currentStepIndex] : null;

  const saveCompletedSteps = useCallback((steps: string[]) => {
    setCompletedSteps(steps);
    localStorage.setItem(COMPLETED_STEPS_KEY, JSON.stringify(steps));
  }, []);

  const startOnboarding = useCallback((fromStepId?: string) => {
    if (fromStepId) {
      const index = onboardingSteps.findIndex(s => s.id === fromStepId);
      if (index !== -1) {
        setCurrentStepIndex(index);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }
    setCurrentStepIndex(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const nextStep = useCallback(() => {
    if (currentStep) {
      // Mark current step as completed
      if (!completedSteps.includes(currentStep.id)) {
        saveCompletedSteps([...completedSteps, currentStep.id]);
      }
    }
    
    if (currentStepIndex < onboardingSteps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // All steps completed
      setCurrentStepIndex(-1);
    }
  }, [currentStepIndex, currentStep, completedSteps, saveCompletedSteps]);

  const skipOnboarding = useCallback(() => {
    setCurrentStepIndex(-1);
  }, []);

  const goToStep = useCallback((stepId: string) => {
    const index = onboardingSteps.findIndex(s => s.id === stepId);
    if (index !== -1) {
      setCurrentStepIndex(index);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const completeStep = useCallback((stepId: string) => {
    if (!completedSteps.includes(stepId)) {
      saveCompletedSteps([...completedSteps, stepId]);
    }
    // Move to next step or finish
    const currentIndex = onboardingSteps.findIndex(s => s.id === stepId);
    if (currentIndex !== -1 && currentIndex < onboardingSteps.length - 1) {
      setCurrentStepIndex(currentIndex + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setCurrentStepIndex(-1);
    }
  }, [completedSteps, saveCompletedSteps]);

  const resetOnboarding = useCallback(() => {
    setCurrentStepIndex(-1);
    saveCompletedSteps([]);
  }, [saveCompletedSteps]);

  return (
    <OnboardingContext.Provider
      value={{
        currentStep,
        currentStepIndex,
        isActive,
        steps: onboardingSteps,
        completedSteps,
        startOnboarding,
        nextStep,
        skipOnboarding,
        goToStep,
        completeStep,
        resetOnboarding,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error("useOnboarding must be used within an OnboardingProvider");
  }
  return context;
}

// Safe version that returns null if outside provider
export function useOnboardingSafe() {
  return useContext(OnboardingContext);
}
