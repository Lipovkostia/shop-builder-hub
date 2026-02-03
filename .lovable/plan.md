
# План: Реализация корзины для оптового магазина

## Обзор

Создадим полноценную корзину и оформление заказов для оптового B2B магазина по аналогии с розничным магазином. Заказы будут автоматически попадать в личный кабинет продавца с пометкой "Опт".

## Текущее состояние

- Оптовый магазин (`/wholesale/:subdomain`) уже использует хук `useRetailCart` для управления корзиной
- Корзина добавляется/отображается, но нет UI для просмотра и оформления заказа
- Есть минимальная сумма заказа (`wholesale_min_order_amount`), которая должна проверяться
- Нужно создать страницу оформления заказа и Edge Function для создания оптовых заказов

## Архитектура решения

```text
+-------------------+     +---------------------+     +----------------------+
|  WholesaleStore   | --> | WholesaleCartSheet  | --> | WholesaleCheckout    |
|  (каталог товаров)|     | (просмотр корзины)  |     | (оформление заказа)  |
+-------------------+     +---------------------+     +----------------------+
                                    |                           |
                                    v                           v
                          +---------------------+     +------------------------+
                          | WholesaleCartDrawer |     | create-wholesale-order |
                          | (десктоп версия)    |     | (Edge Function)        |
                          +---------------------+     +------------------------+
                                                                |
                                                                v
                                                      +-------------------+
                                                      | orders table      |
                                                      | (source: wholesale)|
                                                      +-------------------+
```

## Детальный план реализации

### Этап 1: Компоненты корзины (UI)

#### 1.1 Создать `WholesaleCartSheet.tsx` (мобильная версия)
- Скопировать структуру из `RetailCartSheet.tsx`
- Адаптировать маршруты для wholesale (`/wholesale/:subdomain/checkout`)
- Добавить проверку минимальной суммы заказа
- Показывать предупреждение если сумма меньше минимальной

#### 1.2 Создать `WholesaleCartDrawer.tsx` (десктопная версия)
- Скопировать структуру из `RetailCartDrawer.tsx`
- Адаптировать для wholesale
- Добавить индикатор минимальной суммы

### Этап 2: Страница оформления заказа

#### 2.1 Создать `WholesaleCheckout.tsx`
- Скопировать структуру из `RetailCheckout.tsx`
- Форма: Компания/ИП, Контактное лицо, Телефон, Email, Комментарий
- Убрать поле адреса доставки (для B2B обычно обсуждается отдельно)
- Добавить валидацию минимальной суммы заказа
- Интеграция с Edge Function `create-wholesale-order`

### Этап 3: Edge Function для оптовых заказов

#### 3.1 Создать `create-wholesale-order/index.ts`
- Валидация данных заказа
- Проверка минимальной суммы заказа
- Генерация номера заказа с префиксом `W` (wholesale)
- Сохранение в таблицу `orders` с `source: wholesale`
- Отправка уведомления продавцу

### Этап 4: Интеграция в WholesaleStore

#### 4.1 Обновить `WholesaleStore.tsx`
- Добавить компоненты WholesaleCartSheet/Drawer
- Подключить открытие/закрытие корзины
- Передать минимальную сумму заказа в компоненты корзины

#### 4.2 Добавить маршрут в `App.tsx`
- Добавить роут `/wholesale/:subdomain/checkout`

### Этап 5: Конфигурация Edge Function

#### 5.1 Обновить `supabase/config.toml`
- Добавить конфигурацию для `create-wholesale-order`

## Файлы для создания/изменения

| Файл | Действие |
|------|----------|
| `src/components/wholesale/WholesaleCartSheet.tsx` | Создать |
| `src/components/wholesale/WholesaleCartDrawer.tsx` | Создать |
| `src/pages/WholesaleCheckout.tsx` | Создать |
| `supabase/functions/create-wholesale-order/index.ts` | Создать |
| `src/pages/WholesaleStore.tsx` | Изменить |
| `src/App.tsx` | Изменить |
| `supabase/config.toml` | Изменить |

## Особенности B2B корзины

1. **Минимальный заказ** - блокировка оформления если сумма меньше `wholesale_min_order_amount`
2. **Нумерация заказов** - префикс `W` для оптовых заказов (W-XXXX)
3. **Данные в заказе** - `source: wholesale` для фильтрации в ЛК продавца
4. **Форма заказа** - упрощенная для B2B (без адреса, с полем "Компания")

## Техническая реализация

### Edge Function: create-wholesale-order

```text
POST /functions/v1/create-wholesale-order
{
  storeId: string,
  companyName: string,
  contactName: string,
  phone: string,
  email?: string,
  comment?: string,
  items: [{productId, productName, quantity, price, unit}]
}

Response:
{
  success: boolean,
  orderNumber: string,
  orderId: string,
  total: number
}
```

### Маршрутизация

```text
/wholesale/:subdomain          - каталог товаров (существует)
/wholesale/:subdomain/product/:slug  - страница товара (существует)
/wholesale/:subdomain/checkout - оформление заказа (новый)
```

## Ожидаемый результат

- Покупатель может добавлять товары в корзину
- Корзина открывается по клику на иконку (Sheet на мобильном, Drawer на десктопе)
- При оформлении проверяется минимальная сумма заказа
- Заказы попадают в ЛК продавца с меткой "Опт" (wholesale)
- Продавец получает уведомление о новом заказе
