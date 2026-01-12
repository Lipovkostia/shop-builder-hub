import React, { useEffect } from "react";
import { useOnboarding } from "@/contexts/OnboardingContext";

/**
 * AdminOnboardingBanner - баннер для шага онбординга в панели управления.
 * Отображается под лентой навигации (MobileTabNav).
 */
export function AdminOnboardingBanner() {
  const { currentStep, isActive, nextStep } = useOnboarding();

  // Добавляем пульсацию на элемент
  useEffect(() => {
    if (!isActive || !currentStep?.pulsatingSelector) return;

    const addPulse = () => {
      const element = document.querySelector(currentStep.pulsatingSelector!);
      if (element) {
        element.classList.add("onboarding-pulse");
      }
    };

    addPulse();
    const interval = setInterval(addPulse, 200);

    return () => {
      clearInterval(interval);
      const element = document.querySelector(currentStep.pulsatingSelector!);
      if (element) {
        element.classList.remove("onboarding-pulse");
      }
    };
  }, [isActive, currentStep?.pulsatingSelector]);

  // Показываем только для шага explore-admin
  if (!isActive || !currentStep || currentStep.id !== 'explore-admin') {
    return null;
  }

  const handleComplete = () => {
    nextStep(); // Завершает онбординг
  };

  return (
    <div 
      className="w-full bg-primary px-4 py-3 flex items-start justify-between gap-3 cursor-pointer hover:bg-primary/90 transition-colors"
      onClick={handleComplete}
    >
      <p className="text-primary-foreground text-sm font-medium whitespace-pre-line leading-relaxed">
        {currentStep.description}
      </p>
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleComplete();
        }}
        className="text-primary-foreground/70 hover:text-primary-foreground text-xs whitespace-nowrap shrink-0 mt-0.5"
      >
        Понятно
      </button>
    </div>
  );
}
