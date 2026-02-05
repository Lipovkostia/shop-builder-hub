
# План: Восстановление горизонтальной прокрутки и изменения ширины столбцов в таблице Ассортимента

## Проблема

В таблице Ассортимента (`VirtualProductTable`) сломаны две функции:
1. **Горизонтальная прокрутка** — заблокирована из-за `overflow-x-hidden` на контейнере виртуализированных строк
2. **Изменение ширины столбцов** — отсутствует, так как компонент не использует систему resizable-колонок

## Причины

При сравнении с работающей таблицей Прайс-листа (`VirtualCatalogTable`) выявлены ключевые различия:

| Аспект | VirtualCatalogTable (работает) | VirtualProductTable (сломан) |
|--------|-------------------------------|------------------------------|
| Контейнер | `overflow-auto` | `overflow-y-auto overflow-x-hidden` |
| Колонки | `useResizableColumns` + `ResizableColumnHeader` | Простые `div` с фиксированными ширинами |
| Скролл | Единый контейнер для header и body | Раздельные контейнеры |

## Решение

### Шаг 1: Единый контейнер прокрутки

Объединить header и body таблицы в один scroll-контейнер с `overflow-auto`:

```text
┌──────────────────────────────────────────────────────────────┐
│ Внешний контейнер (overflow: auto)                           │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ Header (sticky top: 0)                                   │ │
│ │ [Фото] [Название] [SKU] [Описание] [Ед.] [Тип] [Объём]...│ │
│ └──────────────────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ Body (виртуализированные строки)                         │ │
│ │ ...                                                      │ │
│ └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### Шаг 2: Интеграция системы изменения ширины колонок

Добавить использование существующих компонентов:
- `useResizableColumns` — хук для управления и сохранения ширин
- `ResizableColumnHeader` — заголовок с drag-ручкой для resize

### Шаг 3: Обновление строк для использования columnWidths

Передать `columnWidths` в `MemoizedProductRow` для синхронизации ширин с заголовками.

---

## Технические детали

### Изменения в `VirtualProductTable.tsx`

**1. Импорты:**
```typescript
import { ResizableColumnHeader } from "./ResizableColumnHeader";
import { useResizableColumns, ColumnConfig } from "@/hooks/useResizableColumns";
```

**2. Определение конфигурации колонок:**
```typescript
const COLUMN_CONFIGS: ColumnConfig[] = [
  { id: 'drag', minWidth: 32, defaultWidth: 32 },
  { id: 'checkbox', minWidth: 32, defaultWidth: 32 },
  { id: 'photo', minWidth: 48, defaultWidth: 48 },
  { id: 'name', minWidth: 120, defaultWidth: 220 },
  { id: 'sku', minWidth: 60, defaultWidth: 80 },
  { id: 'desc', minWidth: 80, defaultWidth: 100 },
  { id: 'source', minWidth: 50, defaultWidth: 64 },
  { id: 'unit', minWidth: 50, defaultWidth: 64 },
  { id: 'type', minWidth: 60, defaultWidth: 80 },
  { id: 'volume', minWidth: 50, defaultWidth: 64 },
  { id: 'cost', minWidth: 50, defaultWidth: 64 },
  { id: 'groups', minWidth: 80, defaultWidth: 96 },
  { id: 'catalogs', minWidth: 100, defaultWidth: 112 },
  { id: 'sync', minWidth: 40, defaultWidth: 48 },
];
```

**3. Использование хука:**
```typescript
const { columnWidths, setColumnWidth, getTotalWidth } = useResizableColumns(
  COLUMN_CONFIGS,
  'products-assortment'
);

const totalWidth = useMemo(
  () => getTotalWidth(visibleColumns), 
  [getTotalWidth, visibleColumns, columnWidths]
);
```

**4. Структура контейнера (единый scroll):**
```tsx
<div 
  ref={parentRef}
  className="overflow-auto"  // ← Горизонтальный + вертикальный скролл
  style={{ height: 'calc(100vh - 300px)', minHeight: '400px' }}
>
  {/* Header - sticky */}
  <div 
    className="sticky top-0 z-10 bg-muted/30 border-b flex items-center"
    style={{ minWidth: totalWidth }}
  >
    <ResizableColumnHeader columnId="photo" ...>Фото</ResizableColumnHeader>
    <ResizableColumnHeader columnId="name" ...>Название</ResizableColumnHeader>
    ...
  </div>

  {/* Virtualized Body */}
  <div style={{ height: totalSize, minWidth: totalWidth, position: 'relative' }}>
    {virtualItems.map(...)}
  </div>
</div>
```

### Изменения в `MemoizedProductRow.tsx`

Добавить проп `columnWidths` и применять ширины к каждой ячейке:

```tsx
interface MemoizedProductRowProps {
  // ... existing props
  columnWidths: Record<string, number>;
}

// В рендере:
{visibleColumns.name && (
  <div 
    className="flex-shrink-0 overflow-hidden"
    style={{ 
      width: columnWidths.name, 
      maxWidth: columnWidths.name 
    }}
  >
    <InlineEditableCell ... />
  </div>
)}
```

---

## Файлы для изменения

1. **`src/components/admin/VirtualProductTable.tsx`**
   - Добавить импорты `ResizableColumnHeader` и `useResizableColumns`
   - Определить `COLUMN_CONFIGS`
   - Заменить структуру контейнера на единый scroll
   - Заменить простые заголовки на `ResizableColumnHeader`
   - Передать `columnWidths` в строки

2. **`src/components/admin/MemoizedProductRow.tsx`**
   - Добавить проп `columnWidths`
   - Применить динамические ширины к ячейкам

## Результат

После изменений таблица Ассортимента будет:
- Поддерживать горизонтальную прокрутку при большом количестве видимых колонок
- Позволять изменять ширину каждой колонки перетаскиванием
- Сохранять настроенные ширины в localStorage
