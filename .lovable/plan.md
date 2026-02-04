

# План оптимизации производительности прайс-листа

## Обзор проблемы

При работе с прайс-листом (750 товаров, 433 выбрано) наблюдаются задержки при:
1. Изменении категорий и подкатегорий
2. Массовом редактировании товаров
3. Общей прокрутке и взаимодействии

## Выявленные узкие места

### 1. Отсутствие виртуализации в таблице каталога
В разделе "Ассортимент" используется `VirtualProductTable` с `@tanstack/react-virtual`, но в прайс-листе (каталоге) таблица рендерится напрямую без виртуализации:

```text
Ассортимент: ✅ VirtualProductTable (виртуализация)
Прайс-лист: ❌ ResizableTable (все 750 строк рендерятся)
```

### 2. Отсутствие ленивой загрузки изображений
В таблице каталога изображения загружаются без `loading="lazy"`:

```typescript
// Текущий код (AdminPanel.tsx ~4882)
<img src={product.image} alt={baseName} className="w-10 h-10 rounded object-cover" />
```

### 3. Синхронные обновления без debounce
При изменении категории вызывается `updateCatalogProductPricing` сразу, без задержки:

```typescript
// Каждый клик = запрос к БД
onSave={(categoryId) => {
  updateCatalogProductPricing(currentCatalog.id, product.id, { primary_category_id: categoryId });
}}
```

### 4. Массовое редактирование обновляет товары последовательно
При bulk-редактировании 433 товаров:

```typescript
selectedCatalogBulkProducts.forEach(productId => {
  updateCatalogProductPricing(currentCatalog.id, productId, { ... });
});
// = 433 отдельных запроса к БД!
```

### 5. Отсутствие мемоизации строк каталога
В ассортименте используется `MemoizedProductRow`, но в прайс-листе строки создаются inline.

## План оптимизации

### Этап 1: Виртуализация таблицы прайс-листа (Высокий приоритет)

Создать компонент `VirtualCatalogTable` для прайс-листа:

```typescript
// Новый файл: src/components/admin/VirtualCatalogTable.tsx
import { useVirtualizer } from "@tanstack/react-virtual";

export function VirtualCatalogTable({
  products,
  catalogId,
  catalogProductSettings,
  onUpdatePricing,
  // ... остальные пропсы
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: products.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48, // Высота строки
    overscan: 10, // Рендерить +10 строк за пределами viewport
  });

  return (
    <div ref={parentRef} className="overflow-auto" style={{ height: 'calc(100vh - 300px)' }}>
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map(virtualRow => {
          const product = products[virtualRow.index];
          return (
            <MemoizedCatalogRow
              key={product.id}
              product={product}
              style={{ transform: `translateY(${virtualRow.start}px)` }}
              // ...
            />
          );
        })}
      </div>
    </div>
  );
}
```

**Ожидаемый результат**: Рендеринг ~20 строк вместо 750 = прирост скорости в 35+ раз

### Этап 2: Ленивая загрузка изображений

Добавить `loading="lazy"` ко всем изображениям в таблице:

```typescript
// До:
<img src={product.image} alt={baseName} className="w-10 h-10 rounded object-cover" />

// После:
<img 
  src={product.image} 
  alt={baseName} 
  className="w-10 h-10 rounded object-cover"
  loading="lazy"
  decoding="async"
/>
```

**Ожидаемый результат**: Изображения загружаются только при прокрутке = меньше сетевых запросов

### Этап 3: Мемоизированный компонент строки каталога

Создать `MemoizedCatalogRow` с оптимизированным сравнением:

```typescript
// Новый файл: src/components/admin/MemoizedCatalogRow.tsx
const CatalogRowComponent = memo(({ 
  product, 
  catalogPricing, 
  categories, 
  onUpdatePricing 
}) => {
  // Рендер строки
}, (prev, next) => {
  // Сравнение только релевантных полей
  return prev.product.id === next.product.id &&
         prev.catalogPricing?.primary_category_id === next.catalogPricing?.primary_category_id &&
         prev.catalogPricing?.status === next.catalogPricing?.status &&
         shallowEqual(prev.catalogPricing?.categories, next.catalogPricing?.categories) &&
         prev.catalogPricing?.markup_value === next.catalogPricing?.markup_value;
});
```

### Этап 4: Debounce для inline-редактирования

Добавить задержку при изменении категорий:

```typescript
// В InlinePrimaryCategoryCell или родительском компоненте
const debouncedSave = useMemo(
  () => debounce((categoryId: string | null) => {
    onSave(categoryId);
  }, 300),
  [onSave]
);

// При закрытии popover'а - сохранять сразу
const handleSelect = (value: string | null) => {
  setLocalValue(value); // Мгновенное UI-обновление
  debouncedSave(value); // Отложенное сохранение в БД
};
```

### Этап 5: Пакетное обновление при bulk-редактировании (Критически важно)

Заменить цикл `forEach` на batch-операцию:

```typescript
// Новая функция в useCatalogProductSettings.ts
const bulkUpdateProductSettings = useCallback(async (
  catalogId: string,
  productIds: string[],
  updates: Partial<CatalogProductSetting>
) => {
  // Оптимистичное обновление UI
  setSettings(prev => prev.map(s => 
    productIds.includes(s.product_id) && s.catalog_id === catalogId
      ? { ...s, ...updates }
      : s
  ));

  // Один запрос к БД для всех товаров
  const { error } = await supabase
    .from('catalog_product_settings')
    .update({
      primary_category_id: updates.primary_category_id,
      categories: updates.categories,
      // ...
    })
    .eq('catalog_id', catalogId)
    .in('product_id', productIds);

  if (error) await fetchSettings(); // Откат при ошибке
}, [fetchSettings]);
```

**Ожидаемый результат**: 1 запрос вместо 433 = ускорение в 100+ раз

### Этап 6: Оптимизация подписки на realtime

Добавить throttle для realtime-обновлений:

```typescript
// В useCatalogProductSettings.ts
const throttledUpdate = useMemo(
  () => throttle((payload) => {
    // Обработка payload
  }, 100), // Максимум 10 обновлений в секунду
  []
);

channel.on('postgres_changes', { ... }, throttledUpdate);
```

## Файлы для изменения

| Файл | Действие | Описание |
|------|----------|----------|
| `src/components/admin/VirtualCatalogTable.tsx` | Создать | Виртуализированная таблица для прайс-листа |
| `src/components/admin/MemoizedCatalogRow.tsx` | Создать | Мемоизированная строка каталога |
| `src/hooks/useCatalogProductSettings.ts` | Изменить | Добавить `bulkUpdateProductSettings` |
| `src/pages/AdminPanel.tsx` | Изменить | Использовать VirtualCatalogTable, добавить lazy loading |
| `src/components/admin/InlinePrimaryCategoryCell.tsx` | Изменить | Добавить debounce |
| `src/components/admin/InlineMultiSelectCell.tsx` | Изменить | Добавить debounce |
| `src/components/admin/BulkEditPanel.tsx` | Изменить | Использовать bulk-операции |

## Визуальные индикаторы загрузки

Добавить skeleton-loader'ы для строк вне viewport:

```typescript
// При загрузке данных показывать скелетоны
{loading ? (
  <div className="animate-pulse bg-muted h-12 rounded" />
) : (
  <MemoizedCatalogRow ... />
)}
```

## Ожидаемые результаты

| Метрика | До | После |
|---------|-----|-------|
| Время рендера таблицы | 800-1200ms | 50-100ms |
| Bulk-update 400 товаров | 15-30 сек | 0.5-1 сек |
| Изменение категории | 200-400ms | 50ms (UI) |
| Расход памяти (DOM-узлы) | ~45,000 | ~1,500 |

## Порядок реализации

1. **Фаза 1** (быстрые победы):
   - Добавить `loading="lazy"` к изображениям
   - Добавить batch-операцию для bulk-редактирования

2. **Фаза 2** (основная оптимизация):
   - Создать VirtualCatalogTable
   - Создать MemoizedCatalogRow

3. **Фаза 3** (полировка):
   - Добавить debounce в inline-редактирование
   - Оптимизировать realtime-подписки

