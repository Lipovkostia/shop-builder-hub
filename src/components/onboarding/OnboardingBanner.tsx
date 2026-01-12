import React, { useEffect } from "react";
import { useOnboarding } from "@/contexts/OnboardingContext";

/**
 * OnboardingBanner - фиолетовая полоса-подсказка для первого шага онбординга.
 * Отображается под панелью иконок без затемнения экрана.
 * Пульсирует папка с прайс-листами.
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

    // Пытаемся добавить сразу и с интервалом для динамического контента
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

  // Показываем только для первого шага (create-pricelist)
  if (!isActive || !currentStep || currentStep.id !== 'create-pricelist') {
    return null;
  }

  return (
    <div 
      className="w-full bg-primary px-4 py-2.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-primary/90 transition-colors"
      onClick={nextStep}
    >
      <p className="text-primary-foreground text-sm font-medium">
        {currentStep.description.split('.')[0]}
      </p>
      <button
        onClick={(e) => {
          e.stopPropagation();
          nextStep();
        }}
        className="text-primary-foreground/70 hover:text-primary-foreground text-xs whitespace-nowrap"
      >
        Понятно
      </button>
    </div>
  );
}
