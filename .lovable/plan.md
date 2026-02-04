

# План: Подкатегории на витрине магазина

## Обзор

При выборе главной (родительской) категории покупатель увидит подкатегории и сможет их выбрать для более точной фильтрации товаров.

## Текущая ситуация

- В базе данных поле `parent_id` уже существует в таблице `categories`
- Хуки `useStoreCategories` загружают `parent_id`
- Витрины (`RetailStore`, `WholesaleStore`) не используют иерархию
- Компонент `RetailLayoutSidebar` имеет заготовку для подкатегорий (`hasChildren = false`)

## Визуальное представление

### Розничная витрина (Desktop sidebar)

```text
┌─────────────────────────────┐
│ 🏪 МАГАЗИН                  │
├─────────────────────────────┤
│ Все товары                  │
│                             │
│ ▼ Мясо                      │  ← Родительская (кликабельна)
│   ├─ Говядина              │  ← Подкатегория
│   ├─ Свинина               │
│   └─ Птица                 │
│                             │
│ › Сыры                      │  ← Свёрнута (есть дети)
│                             │
│ Напитки                     │  ← Без детей
└─────────────────────────────┘
```

### Мобильная версия (Sheet)

```text
╭──────────────────────────────────────────╮
│ ▔▔▔▔▔                                    │
│ Выберите категорию                       │
│ 🔍 Поиск...                              │
│──────────────────────────────────────────│
│ ✓ Все товары                        156  │
│                                          │
│ ▼ Мясо                               45  │  ← Раскрыта
│     Говядина                         15  │
│     Свинина                          18  │
│     Птица                            12  │
│                                          │
│ › Сыры                               32  │  ← Свёрнута
│                                          │
│ Напитки                              28  │  ← Без детей
╰──────────────────────────────────────────╯
```

### Оптовая витрина (Dropdown selector)

При выборе родительской категории показываются чипы подкатегорий:

```text
┌─────────────────────────────────────────────────────────┐
│ [📁 Мясо (45) ▼]                                        │
│                                                         │
│ Подкатегории:                                           │
│ [Говядина (15)] [Свинина (18)] [Птица (12)]            │
└─────────────────────────────────────────────────────────┘
```

## Технические изменения

### Этап 1: Обновить интерфейсы категорий

Добавить `parent_id` в типы `RetailCategory` и `WholesaleCategory`:

```typescript
// useRetailStore.ts
export interface RetailCategory {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  parent_id: string | null;  // NEW
  product_count?: number;
}
```

### Этап 2: Обновить загрузку категорий

Изменить запросы в `useRetailStore.ts` и `useWholesaleStore.ts` для включения `parent_id`:

```typescript
const { data } = await supabase
  .from("categories")
  .select("id, name, slug, image_url, parent_id")  // добавить parent_id
  .eq("store_id", store.id)
  .order("sort_order");
```

### Этап 3: Построить дерево категорий

Добавить утилиту для построения иерархии:

```typescript
interface CategoryTree extends RetailCategory {
  children: CategoryTree[];
}

function buildCategoryTree(categories: RetailCategory[]): CategoryTree[] {
  const map = new Map<string, CategoryTree>();
  const roots: CategoryTree[] = [];

  // Инициализация узлов
  categories.forEach(cat => {
    map.set(cat.id, { ...cat, children: [] });
  });

  // Построение дерева
  categories.forEach(cat => {
    const node = map.get(cat.id)!;
    if (cat.parent_id && map.has(cat.parent_id)) {
      map.get(cat.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}
```

### Этап 4: Обновить RetailLayoutSidebar

```typescript
// Построить дерево один раз
const categoryTree = useMemo(() => 
  buildCategoryTree(categoriesWithProducts), 
  [categoriesWithProducts]
);

// Рекурсивный рендеринг
function renderCategory(cat: CategoryTree, depth = 0) {
  const hasChildren = cat.children.length > 0;
  const isExpanded = expandedCategories.includes(cat.id);
  const isSelected = selectedCategory === cat.id;

  return (
    <div key={cat.id} style={{ marginLeft: depth * 16 }}>
      <button onClick={() => {
        onCategorySelect(cat.id);
        if (hasChildren) toggleExpanded(cat.id);
      }}>
        {hasChildren && (isExpanded ? <ChevronDown/> : <ChevronRight/>)}
        {cat.name}
      </button>
      
      {hasChildren && isExpanded && (
        <div className="border-l pl-4">
          {cat.children.map(child => renderCategory(child, depth + 1))}
        </div>
      )}
    </div>
  );
}
```

### Этап 5: Обновить RetailCatalogSheet (мобильная версия)

Аналогичная логика для мобильного Sheet:
- Показывать иерархию с отступами
- Кнопка раскрытия/сворачивания для родительских категорий
- При выборе родительской автоматически раскрывать детей

### Этап 6: Обновить WholesaleCategorySelector

При выборе родительской категории показывать чипы подкатегорий под селектором:

```typescript
// Получить подкатегории выбранной категории
const subcategories = useMemo(() => {
  if (!selectedCategory) return [];
  return categories.filter(c => c.parent_id === selectedCategory);
}, [categories, selectedCategory]);

// Рендер чипов подкатегорий
{subcategories.length > 0 && (
  <div className="flex flex-wrap gap-2 mt-2">
    {subcategories.map(sub => (
      <Button
        key={sub.id}
        variant={selectedCategory === sub.id ? "default" : "outline"}
        size="sm"
        onClick={() => onSelectCategory(sub.id)}
      >
        {sub.name} ({sub.product_count})
      </Button>
    ))}
  </div>
)}
```

### Этап 7: Логика фильтрации с учётом иерархии

При выборе родительской категории показывать товары из неё И из всех подкатегорий:

```typescript
const getDescendantIds = (categoryId: string): string[] => {
  const descendants: string[] = [categoryId];
  const children = categories.filter(c => c.parent_id === categoryId);
  children.forEach(child => {
    descendants.push(...getDescendantIds(child.id));
  });
  return descendants;
};

// В фильтрации
if (selectedCategory) {
  const relevantCategoryIds = getDescendantIds(selectedCategory);
  result = result.filter((p) => 
    relevantCategoryIds.some(catId => 
      p.category_ids.includes(catId) || p.category_id === catId
    )
  );
}
```

## Файлы для изменения

| Файл | Действие | Описание |
|------|----------|----------|
| `src/hooks/useRetailStore.ts` | Изменить | Добавить `parent_id` в интерфейс и запрос |
| `src/hooks/useWholesaleStore.ts` | Изменить | Добавить `parent_id` в интерфейс и запрос |
| `src/lib/categoryUtils.ts` | Создать | Утилиты для работы с деревом категорий |
| `src/components/retail/RetailLayoutSidebar.tsx` | Изменить | Рекурсивный рендеринг дерева |
| `src/components/retail/RetailCatalogSheet.tsx` | Изменить | Иерархия в мобильном Sheet |
| `src/components/wholesale/WholesaleCategorySelector.tsx` | Изменить | Показ подкатегорий чипами |
| `src/pages/RetailStore.tsx` | Изменить | Фильтрация с учётом подкатегорий |
| `src/pages/WholesaleStore.tsx` | Изменить | Фильтрация с учётом подкатегорий |

## Автоматическое раскрытие

При выборе подкатегории (через URL или прямой выбор) автоматически раскрывать её родительскую категорию:

```typescript
useEffect(() => {
  if (selectedCategory) {
    const selected = categories.find(c => c.id === selectedCategory);
    if (selected?.parent_id) {
      setExpandedCategories(prev => 
        prev.includes(selected.parent_id!) 
          ? prev 
          : [...prev, selected.parent_id!]
      );
    }
  }
}, [selectedCategory, categories]);
```

## Подсчёт товаров

Для родительских категорий показывать сумму товаров из всех дочерних:

```typescript
const getTotalProductCount = (categoryId: string): number => {
  const category = categories.find(c => c.id === categoryId);
  const directCount = category?.product_count || 0;
  const children = categories.filter(c => c.parent_id === categoryId);
  const childrenCount = children.reduce(
    (sum, child) => sum + getTotalProductCount(child.id), 
    0
  );
  return directCount + childrenCount;
};
```

