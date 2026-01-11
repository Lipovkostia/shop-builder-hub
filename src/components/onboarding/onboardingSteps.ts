import { SpotlightStep } from './SpotlightOverlay';

// Первый шаг онбординга - перейти в панель управления
export const sellerOnboardingStep1: SpotlightStep[] = [
  {
    id: 'go-to-admin',
    targetSelector: '[data-onboarding-admin-button]',
    title: 'Перейдите в панель управления',
    description: 'Здесь вы будете добавлять товары, настраивать прайс-листы и управлять заказами. Нажмите на кнопку «Управление».',
    placement: 'left',
    highlightPadding: 6,
    hideActions: true
  }
];

export const adminPanelSpotlightSteps: SpotlightStep[] = [
  {
    id: 'catalog-column',
    targetSelector: '[data-onboarding="catalog-column-header"], [data-column-id="catalogs"]',
    title: 'Создайте прайс-лист',
    description: 'Прайс-лист — это каталог с ценами для определённой группы клиентов. Например: «Рестораны» с наценкой 30%, «Оптовики» с наценкой 15%. Нажмите «+» в ячейке товара в этом столбце.',
    placement: 'bottom',
    highlightPadding: 12
  }
];

export const storefrontSpotlightSteps: SpotlightStep[] = [
  {
    id: 'catalog-switcher',
    targetSelector: '[data-onboarding="catalog-switcher"]',
    title: 'Переключайте прайс-листы',
    description: 'Здесь вы видите витрину глазами покупателя. Переключайтесь между прайс-листами чтобы проверить как выглядят цены для разных типов клиентов.',
    placement: 'bottom',
    highlightPadding: 8
  },
  {
    id: 'product-card',
    targetSelector: '[data-onboarding="product-card"]',
    title: 'Оперативное управление',
    description: 'На витрине можно быстро менять цены, статусы товаров и наличие. Изменения применяются мгновенно для всех типов покупателей.',
    placement: 'right',
    highlightPadding: 8
  }
];
