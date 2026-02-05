
# План: Отображение и редактирование фиксированной цены каталога в карточке товара

## Проблема
В прайс-листе товар показывает цену 44,444 ₽ (это `fixed_price` из `catalog_product_settings`), но при раскрытии карточки для редактирования отображается другая цена (1000 ₽ — это расчётная цена из себестоимости).

Панель редактирования `ProductEditPanel` не получает и не отображает `fixed_price` из настроек каталога.

## Решение

Добавить в панель редактирования:
1. Поля `fixed_price` и `is_fixed_price` в интерфейс `CatalogSettings`
2. Отдельное поле "Цена" с иконкой замка 🔒 для отображения и редактирования фикс.цены каталога
3. При изменении цены — автоматически устанавливать `is_fixed_price = true`
4. Логика приоритета: если есть фикс.цена — показывать её, иначе — расчётную

## Изменения

### 1. Файл: `src/components/admin/ProductEditPanel.tsx`

**a) Расширить интерфейс CatalogSettings (строки 22-32):**

```typescript
interface CatalogSettings {
  markup_type?: string;
  markup_value?: number;
  portion_prices?: { ... } | null;
  status?: string;
  categories?: string[];
  fixed_price?: number | null;      // ← ДОБАВИТЬ
  is_fixed_price?: boolean;          // ← ДОБАВИТЬ
}
```

**b) Добавить состояние для фикс.цены каталога:**

```typescript
const [catalogFixedPrice, setCatalogFixedPrice] = useState(
  catalogSettings?.fixed_price?.toString() || ""
);
const [isCatalogFixedPrice, setIsCatalogFixedPrice] = useState(
  catalogSettings?.is_fixed_price || false
);
```

**c) Изменить логику отображения цены (строки 424-430):**

Вместо просто `calculateSalePrice()` показывать:
- Если `is_fixed_price = true` → показывать фикс.цену с замком 🔒 и возможностью редактирования
- Если нет → показывать расчётную цену

**d) Добавить редактируемое поле для цены:**

```jsx
<div>
  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
    Цена
    {isCatalogFixedPrice && <Lock className="h-2.5 w-2.5" />}
  </label>
  {isCatalogFixedPrice || !buyPrice ? (
    <Input
      type="number"
      value={catalogFixedPrice}
      onChange={(e) => {
        setCatalogFixedPrice(e.target.value);
        setIsCatalogFixedPrice(true);
      }}
      placeholder="0"
      className="h-7 text-xs mt-0.5"
    />
  ) : (
    <div className="h-7 mt-0.5 flex items-center px-2 rounded-md bg-primary/10 border border-primary/20">
      <span className="text-xs font-semibold text-primary">
        {calculateSalePrice().toFixed(0)} ₽
      </span>
    </div>
  )}
</div>
```

**e) Обновить функцию `performSave` для сохранения фикс.цены:**

В секции catalog-specific settings добавить:
```typescript
if (catalogId && onCatalogSettingsChange) {
  onCatalogSettingsChange(catalogId, product.id, {
    // ... existing fields ...
    fixed_price: parseFloat(catalogFixedPrice) || null,
    is_fixed_price: isCatalogFixedPrice,
  });
}
```

### 2. Файл: `src/pages/StoreFront.tsx`

**Передавать `fixed_price` и `is_fixed_price` в `catalogSettings` prop (строки 644-651):**

```typescript
catalogSettings={catalogSettings ? {
  markup_type: catalogSettings.markup_type,
  markup_value: catalogSettings.markup_value,
  portion_prices: catalogSettings.portion_prices,
  status: catalogSettings.status,
  categories: catalogSettings.categories,
  fixed_price: catalogSettings.fixed_price,        // ← ДОБАВИТЬ
  is_fixed_price: catalogSettings.is_fixed_price,  // ← ДОБАВИТЬ
} : undefined}
```

## Ожидаемый результат

1. Если в прайс-листе товар показывает 44,444 ₽, то при раскрытии карточки:
   - Поле "Цена" будет показывать 44,444 с иконкой 🔒
   - Это поле будет редактируемым
   - При изменении значения — оно сохраняется в `catalog_product_settings.fixed_price`

2. Если у товара нет фикс.цены, но есть себестоимость + наценка:
   - Показывается расчётная цена (как сейчас)
   - При вводе значения в поле "Цена" — включается режим фикс.цены
