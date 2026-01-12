import React, { useEffect } from "react";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { Sparkles } from "lucide-react";

/**
 * OnboardingBanner - современная полоса-подсказка для шагов онбординга.
 * Градиентный фон, иконка, компактный размер.
 */
export function OnboardingBanner() {
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

  // Показываем для первых четырёх шагов (витрина)
  const showBannerSteps = ['create-pricelist', 'create-product', 'fill-product-card', 'go-to-admin'];
  if (!isActive || !currentStep || !showBannerSteps.includes(currentStep.id)) {
    return null;
  }

  return (
    <div 
      className="w-full gradient-primary px-3 py-2.5 flex items-center justify-between gap-3 cursor-pointer hover:opacity-95 transition-opacity animate-in fade-in slide-in-from-top-1 duration-300"
      onClick={nextStep}
    >
      <div className="flex items-center gap-2.5">
        <Sparkles className="h-4 w-4 text-white/90 shrink-0" />
        <p className="text-white text-sm font-medium tracking-wide whitespace-pre-line leading-snug">
          {currentStep.description}
        </p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          nextStep();
        }}
        className="bg-white/15 hover:bg-white/25 text-white text-xs font-medium px-2.5 py-1 rounded-md transition-colors whitespace-nowrap shrink-0"
      >
        Понятно
      </button>
    </div>
  );
}
