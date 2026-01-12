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
    description: 'Откройте карточку и введите:\n\n• Себестоимость и Наценку.\n\n• Установите Уникальную цену за единицу товара при покупке половины 1/2.\n\n• Установите цельный объем от которого будет считаться 1/2 и 1/4',
    shortDescription: 'Как заполнить карточку',
    targetSelector: '[data-onboarding="product-card"]',
    pulsatingSelector: '[data-onboarding="product-card"]',
    placement: 'bottom',
    action: 'manual',
    view: 'storefront',
  },
  {
    id: 'go-to-admin',
    title: 'Переход в панель управления',
    description: 'Перейдите в панель управления.',
    shortDescription: 'Как открыть панель управления',
    targetSelector: '[data-onboarding-admin-button]',
    pulsatingSelector: '[data-onboarding-admin-button]',
    placement: 'bottom',
    action: 'click',
    view: 'storefront',
  },
  {
    id: 'explore-admin',
    title: 'Знакомство с панелью управления',
    description: 'Просмотрите разделы управления магазином. В конце раздел помощь с подробными инструкциями к каждому разделу.',
    shortDescription: 'Обзор разделов',
    targetSelector: '[data-onboarding-tab="help"]',
    pulsatingSelector: '[data-onboarding-tab="help"]',
    placement: 'bottom',
    action: 'manual',
    view: 'admin',
  },
];
