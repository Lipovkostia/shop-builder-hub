import React from "react";
import { Check } from "lucide-react";
import { useOnboardingSafe } from "@/contexts/OnboardingContext";

interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
}

interface OnboardingProductChecklistProps {
  buyPrice: string;
  markupValue: string;
  priceHalf: string;
  priceQuarter: string;
  unitWeight: string;
  onAllCompleted?: () => void;
}

export function OnboardingProductChecklist({
  buyPrice,
  markupValue,
  priceHalf,
  priceQuarter,
  unitWeight,
  onAllCompleted,
}: OnboardingProductChecklistProps) {
  const onboarding = useOnboardingSafe();
  
  // Показываем только на третьем шаге
  if (!onboarding?.isActive || onboarding.currentStep?.id !== 'fill-product-card') {
    return null;
  }

  const items: ChecklistItem[] = [
    { id: 'buyPrice', label: 'Себестоимость', completed: !!buyPrice && parseFloat(buyPrice) > 0 },
    { id: 'markup', label: 'Наценка', completed: !!markupValue && parseFloat(markupValue) > 0 },
    { id: 'priceHalf', label: 'Цена 1/2', completed: !!priceHalf && parseFloat(priceHalf) > 0 },
    { id: 'priceQuarter', label: 'Цена 1/4', completed: !!priceQuarter && parseFloat(priceQuarter) > 0 },
    { id: 'unitWeight', label: 'Объём', completed: !!unitWeight && parseFloat(unitWeight) > 0 },
  ];

  const allCompleted = items.every(item => item.completed);
  
  // Вызываем callback когда все пункты заполнены
  React.useEffect(() => {
    if (allCompleted && onAllCompleted) {
      // Небольшая задержка чтобы пользователь увидел завершённый чеклист
      const timer = setTimeout(() => {
        onAllCompleted();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [allCompleted, onAllCompleted]);

  return (
    <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 mt-2">
      <p className="text-xs text-primary font-medium mb-2">
        Заполните поля:
      </p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs transition-all ${
              item.completed
                ? 'bg-green-500/20 text-green-700 dark:text-green-400'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {item.completed ? (
              <Check className="w-3 h-3" />
            ) : (
              <span className="w-3 h-3 rounded-full border border-current" />
            )}
            <span>{item.label}</span>
          </div>
        ))}
      </div>
      {allCompleted && (
        <p className="text-xs text-green-600 dark:text-green-400 mt-2 font-medium">
          ✨ Отлично! Карточка заполнена
        </p>
      )}
    </div>
  );
}
