export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  shortDescription: string;
  targetSelector: string;
  placement: 'top' | 'bottom' | 'left' | 'right';
  action?: 'click' | 'input' | 'manual';
  view?: 'storefront' | 'admin';
  pulsatingSelector?: string;
  autoOpenDropdown?: boolean;
}

export const onboardingSteps: OnboardingStep[] = [
  {
    id: 'create-pricelist',
    title: 'Создание прайс-листа',
    description: 'Создайте прайс-лист и введите название. Прайс-лист — это каталог товаров с ценами, который вы отправляете клиентам.',
    shortDescription: 'Как создать прайс-лист',
    targetSelector: '[data-onboarding="catalog-dropdown-content"]',
    pulsatingSelector: '[data-onboarding="create-catalog-button"]',
    placement: 'bottom',
    action: 'click',
    view: 'storefront',
    autoOpenDropdown: true,
  },
  // Остальные шаги будут добавлены позже
];
