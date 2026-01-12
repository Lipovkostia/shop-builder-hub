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
    targetSelector: '[data-onboarding="catalog-folder"]',
    pulsatingSelector: '[data-onboarding="catalog-folder"]',
    placement: 'bottom',
    action: 'click',
    view: 'storefront',
  },
  {
    id: 'create-product',
    title: 'Создание товара',
    description: 'Создайте новый товар. Товар привяжется к открытому прайс-листу.',
    shortDescription: 'Как создать товар',
    targetSelector: '[data-onboarding="add-product-button"]',
    pulsatingSelector: '[data-onboarding="add-product-button"]',
    placement: 'bottom',
    action: 'click',
    view: 'storefront',
  },
  {
    id: 'fill-product-card',
    title: 'Заполнение карточки товара',
    description: 'Откройте карточку и внесите данные: Себестоимость, Наценку, Цену за 1/2 и 1/4, Объём единицы товара.',
    shortDescription: 'Как заполнить карточку',
    targetSelector: '[data-onboarding="product-card"]',
    pulsatingSelector: '[data-onboarding="product-card"]',
    placement: 'bottom',
    action: 'manual',
    view: 'storefront',
  },
];
