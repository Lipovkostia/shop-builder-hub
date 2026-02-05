

# План: Добавление возможности обновлять отпускную цену при импорте из Excel

## Описание задачи
Сейчас при умной загрузке из Excel можно выбрать "Себестоимость" (закупочная цена, поле `buy_price`). Нужно добавить дополнительную опцию "Цена" (отпускная цена, поле `price`), чтобы пользователь мог обновлять именно ту цену, которая отображается в столбце "Цена" в прайс-листе.

## Изменения

### 1. ExcelColumnMapping.tsx
Добавить новое поле `price` (Цена/Отпускная цена) в список полей для обновления:

```text
Текущие поля:
- Себестоимость (buyPrice)
- Единица измерения
- Название
- Описание
- Группа
- Объём
- Фото

Добавить после "Себестоимость":
- Цена (price) — Отпускная цена товара
```

### 2. ColumnMapping интерфейс
Расширить интерфейс `fieldsToUpdate` новым полем `price`:

```typescript
fieldsToUpdate: {
  buyPrice: number | null;
  price: number | null;  // Новое поле
  unit: number | null;
  name: number | null;
  // ...остальные поля
}
```

### 3. priceListImport.ts
Обновить функцию `importProductsWithMapping`:

- Добавить поле `price` в интерфейс `ParsedAssortmentProduct`
- Добавить парсинг колонки `price` при чтении файла
- При обновлении товара добавить логику:
  ```typescript
  if (product.price !== undefined) {
    updateData.price = product.price;
  }
  ```
- При создании нового товара использовать `product.price` или `product.buyPrice`

### 4. ExtendedColumnMapping интерфейс
Синхронизировать интерфейс `ExtendedColumnMapping` в `priceListImport.ts`:

```typescript
fieldsToUpdate: {
  buyPrice: number | null;
  price: number | null;  // Добавить
  unit: number | null;
  // ...
}
```

## Технические детали

**Файлы для изменения:**
- `src/components/admin/ExcelColumnMapping.tsx` — добавить новое поле в UI
- `src/lib/priceListImport.ts` — добавить поддержку поля price в импорт и парсинг
- `src/components/admin/ExcelImportSection.tsx` — инициализировать новое поле в mapping

**Логика:**
- Поле "Цена" будет отображаться сразу после "Себестоимость"
- Пользователь может выбрать обновлять либо себестоимость, либо цену, либо оба поля одновременно
- Описание поля: "Отпускная цена товара"

