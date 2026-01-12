export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  shortDescription: string;
  targetSelector: string;
  placement: 'top' | 'bottom' | 'left' | 'right';
  action?: 'click' | 'input' | 'manual';
  view?: 'storefront' | 'admin';
}

export const onboardingSteps: OnboardingStep[] = [
  {
    id: 'add-product',
    title: 'Добавление товара',
    description: 'Нажмите на кнопку "+", чтобы добавить первый товар в ваш ассортимент',
    shortDescription: 'Как добавить товар',
    targetSelector: '[data-onboarding="add-product-button"]',
    placement: 'bottom',
    action: 'click',
    view: 'storefront',
  },
  // Остальные шаги будут добавлены позже
];
