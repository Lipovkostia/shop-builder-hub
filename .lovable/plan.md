
# План: Независимые цены для разных прайс-листов

## Проблема
При импорте/обновлении цены в одном прайс-листе, эта цена применяется ко **всем** прайс-листам. Причина: цена хранится в общей таблице `products`, а не в индивидуальных настройках каталога `catalog_product_settings`.

## Текущая архитектура

```text
┌──────────────────────────────────────────────────────────────────┐
│                         products                                 │
│ ─────────────────────────────────────────────────────────────── │
│ id, name, buy_price, price, markup_type, markup_value,          │
│ is_fixed_price  ← ОБЩИЕ для всех прайс-листов!                  │
└──────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│ catalog_product_settings │  │ catalog_product_settings │
│ (Прайс-лист A)           │  │ (Прайс-лист B)           │
│ ─────────────────────────│  │ ─────────────────────────│
│ markup_type, markup_value│  │ markup_type, markup_value│
│ status, categories       │  │ status, categories       │
│ НЕТ price/is_fixed_price!│  │ НЕТ price/is_fixed_price!│
└──────────────────────────┘  └──────────────────────────┘
```

## Решение

Добавить в `catalog_product_settings` два новых поля:
- `fixed_price` (numeric) — индивидуальная фиксированная цена для этого каталога
- `is_fixed_price` (boolean) — флаг фиксации цены для этого каталога

```text
┌──────────────────────────────────────────────────────────────────┐
│                         products                                 │
│ ─────────────────────────────────────────────────────────────── │
│ id, name, buy_price (себестоимость)                             │
│ price, markup_type, markup_value ← БАЗОВЫЕ значения по умолчанию│
└──────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│ catalog_product_settings │  │ catalog_product_settings │
│ (Прайс-лист A)           │  │ (Прайс-лист B)           │
│ ─────────────────────────│  │ ─────────────────────────│
│ markup_type, markup_value│  │ markup_type, markup_value│
│ fixed_price: 8888 ✓      │  │ fixed_price: 5000 ✓      │
│ is_fixed_price: true ✓   │  │ is_fixed_price: true ✓   │
└──────────────────────────┘  └──────────────────────────┘
```

## Изменения

### 1. Миграция БД — добавить поля в catalog_product_settings

```sql
ALTER TABLE catalog_product_settings 
ADD COLUMN IF NOT EXISTS fixed_price numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_fixed_price boolean DEFAULT false;
```

### 2. Обновить функцию importProductsToCatalogExtended

Вместо обновления `products.price` и `products.is_fixed_price`:
- Обновлять `catalog_product_settings.fixed_price` и `catalog_product_settings.is_fixed_price`

**Файл:** `src/lib/priceListImport.ts`

Изменить логику в строках 633-636:
```typescript
// БЫЛО:
if (fieldsToUpdate.includes('price') && excelProduct.price !== undefined) {
  updateData.price = excelProduct.price;
  updateData.is_fixed_price = true;
}

// СТАНЕТ:
// Цены обновляются в catalog_product_settings, не в products
if (fieldsToUpdate.includes('price') && excelProduct.price !== undefined) {
  catalogSettingsUpdate.fixed_price = excelProduct.price;
  catalogSettingsUpdate.is_fixed_price = true;
}
```

### 3. Обновить useCatalogProductSettings hook

Добавить поля `fixed_price` и `is_fixed_price` в интерфейс и обработку.

**Файл:** `src/hooks/useCatalogProductSettings.ts`

### 4. Обновить AI-ассистент

При action "update_prices" обновлять `catalog_product_settings` для выбранного каталога, а не `products`.

**Файл:** `src/components/admin/AIAssistantPanel.tsx`

В функции handleApply изменить логику:
```typescript
// БЫЛО:
await updateProduct(product.id, {
  markup_type: markupType,
  markup_value: markupValue,
});

// СТАНЕТ:
await updateProductSettings(effectiveCatalogId, product.id, {
  fixed_price: product.target_price,
  is_fixed_price: true,
});
```

### 5. Обновить функцию get_retail_products_public

Учитывать `catalog_product_settings.fixed_price` и `catalog_product_settings.is_fixed_price`.

**Файл:** Миграция БД

```sql
CASE
  -- Приоритет 1: фикс.цена из настроек каталога
  WHEN st.is_fixed_price = true AND st.fixed_price IS NOT NULL 
    THEN st.fixed_price::double precision
  -- Приоритет 2: фикс.цена из products (для обратной совместимости)
  WHEN p.is_fixed_price = true AND p.price IS NOT NULL 
    THEN p.price::double precision
  -- Приоритет 3: расчёт по наценке
  ...
END
```

### 6. Обновить витрину продавца StoreFront.tsx

Использовать `catalogSettings.fixed_price` при отображении.

**Файл:** `src/pages/StoreFront.tsx`

## Файлы для изменения

1. **Миграция БД** — добавить поля в catalog_product_settings и обновить функцию get_retail_products_public
2. `src/lib/priceListImport.ts` — импорт цен в catalog_product_settings
3. `src/hooks/useCatalogProductSettings.ts` — расширить интерфейс
4. `src/components/admin/AIAssistantPanel.tsx` — обновление цен через AI в catalog_product_settings
5. `src/pages/StoreFront.tsx` — использовать fixed_price из настроек каталога

## Обратная совместимость

- Существующие товары с `products.is_fixed_price = true` продолжат работать
- Новая логика приоритизирует `catalog_product_settings.fixed_price` над `products.price`
- Если в настройках каталога нет фикс.цены, используется базовая логика (себестоимость + наценка или products.price)
