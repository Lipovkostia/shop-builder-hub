
# План: Добавление редактирования отпускной цены в прайс-листе

## Описание задачи
В текущей реализации столбик "Цена" редактирует только себестоимость (buy_price). Нужно добавить возможность редактировать отпускную цену (price) напрямую, независимо от себестоимости.

## Решение
Добавить новую колонку "Цена" для редактирования отпускной цены, а текущую колонку переименовать в "Себестоимость" для ясности.

## Изменения

### 1. MemoizedProductRow.tsx

**Добавить новое поле в интерфейс VisibleColumns:**
```typescript
export interface VisibleColumns {
  photo: boolean;
  name: boolean;
  sku: boolean;
  desc: boolean;
  source: boolean;
  unit: boolean;
  type: boolean;
  volume: boolean;
  cost: boolean;      // Себестоимость (buy_price)
  price: boolean;     // НОВОЕ: Отпускная цена (price/pricePerUnit)
  groups: boolean;
  catalogs: boolean;
  sync: boolean;
}
```

**Добавить обработчик для редактирования цены:**
```typescript
const handleUpdatePrice = useCallback((newPrice: number | undefined) => {
  onUpdateProduct({ ...product, pricePerUnit: newPrice ?? 0 });
}, [onUpdateProduct, product]);
```

**Добавить новую колонку между cost и groups:**
```tsx
{/* Price */}
{visibleColumns.price && (
  <div className="w-16 flex-shrink-0">
    <InlinePriceCell
      value={product.pricePerUnit}
      onSave={handleUpdatePrice}
      placeholder="0"
    />
  </div>
)}
```

**Обновить функцию areEqual для мемоизации:**
```typescript
if (prevCols.price !== nextCols.price) return false;
```

### 2. VirtualProductTable.tsx

**Добавить поле price в AllProductsFilters:**
```typescript
export interface AllProductsFilters {
  name: string;
  sku: string;
  desc: string;
  source: string;
  unit: string;
  type: string;
  volume: string;
  cost: string;      // Фильтр по себестоимости
  price: string;     // НОВОЕ: Фильтр по цене
  status: string;
  sync: string;
  groups: string[];
}
```

**Обновить заголовки столбцов:**
- Колонка cost: placeholder "Себест..." (сокращённо от "Себестоимость")
- Колонка price: placeholder "Цена..."

**Добавить заголовок и фильтр для колонки price (после cost):**
```tsx
{visibleColumns.price && (
  <div className="w-16 flex-shrink-0">
    <ColumnFilter 
      value={filters.price} 
      onChange={(v) => onFiltersChange({...filters, price: v})}
      placeholder="Цена..."
    />
  </div>
)}
```

### 3. ProductsSection.tsx

**Обновить defaultVisibleColumns:**
```typescript
const defaultVisibleColumns: VisibleColumns = {
  // ... existing fields
  cost: true,
  price: true,  // НОВОЕ
  groups: true,
  // ...
};
```

**Обновить defaultFilters:**
```typescript
const defaultFilters: AllProductsFilters = {
  // ... existing fields
  cost: "",
  price: "",  // НОВОЕ
  // ...
};
```

**Добавить чекбокс "Цена" в меню настройки колонок** (после "Себестоимость").

## Результат
После изменений пользователь сможет:
- Редактировать себестоимость в столбике "Себестоимость"
- Редактировать отпускную цену в столбике "Цена"
- Оставить себестоимость пустой и задать только отпускную цену
- Отпускная цена будет отображаться в карточках товаров
