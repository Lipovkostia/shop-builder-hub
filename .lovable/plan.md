
# План исправления: Порядок категорий в прайс-листе не транслируется в dropdown

## Проблема

На скриншоте видно, что в dropdown фильтра категорий (справа вверху на витрине StoreFront) категории отображаются **не в том порядке**, который установлен в прайс-листе через `catalog_category_settings`.

### Корневая причина

В `StoreFront.tsx` категории загружаются через `useStoreCategories()`, который запрашивает их из таблицы `categories` с **глобальным** `sort_order`:

```typescript
const { categories } = useStoreCategories(store?.id || null);
```

Затем в `catalogCategories` категории просто фильтруются без пересортировки:

```typescript
return categories.filter((cat) => categoryIds.has(cat.id));
```

Это приводит к тому, что порядок из `catalog_category_settings` игнорируется.

---

## Решение

### Файлы для изменения

| Файл | Изменения |
|------|-----------|
| `src/pages/StoreFront.tsx` | Загружать категории с каталог-специфичным порядком через RPC |
| `src/pages/CustomerDashboard.tsx` | Аналогичное исправление для дашборда покупателя |

### Изменения в StoreFront.tsx

1. **Добавить загрузку каталог-специфичных категорий** через RPC `get_catalog_categories_ordered`
2. **Использовать эти категории вместо глобальных** в `catalogCategories`

```text
Текущая логика:
  categories из useStoreCategories → глобальный sort_order → фильтрация

Новая логика:
  Когда selectedCatalog выбран:
    → Вызвать RPC get_catalog_categories_ordered(catalog_id, store_id)
    → Получить категории УЖЕ отсортированные по каталог-специфичному порядку
    → Использовать их в catalogCategories
```

### Технический план

```typescript
// Добавить state для каталог-специфичных категорий
const [catalogSpecificCategories, setCatalogSpecificCategories] = useState<StoreCategory[]>([]);

// Загружать категории при смене каталога
useEffect(() => {
  if (selectedCatalog && store?.id) {
    supabase
      .rpc('get_catalog_categories_ordered', {
        _catalog_id: selectedCatalog,
        _store_id: store.id
      })
      .then(({ data }) => {
        if (data) {
          setCatalogSpecificCategories(data.map(c => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
            sort_order: c.sort_order,
            // ... остальные поля
          })));
        }
      });
  }
}, [selectedCatalog, store?.id]);

// Обновить catalogCategories, чтобы использовать каталог-специфичный список
const catalogCategories = useMemo(() => {
  if (!selectedCatalog) return [];
  
  // Собираем ID категорий из товаров каталога
  const categoryIds = new Set<string>();
  displayProducts.forEach((p) => {
    if (!productVisibility[p.id]?.has(selectedCatalog)) return;
    const catalogSettings = getProductSettings(selectedCatalog, p.id);
    const productCategories = catalogSettings?.categories || [];
    productCategories.forEach((catId) => categoryIds.add(catId));
  });
  
  // Фильтруем каталог-специфичные категории (уже отсортированы!)
  return catalogSpecificCategories.filter((cat) => categoryIds.has(cat.id));
}, [selectedCatalog, displayProducts, productVisibility, getProductSettings, catalogSpecificCategories]);
```

---

## Ожидаемый результат

После изменений:

1. Продавец открывает прайс-лист в админ-панели
2. Нажимает «Порядок отображения» и перетаскивает категории
3. Сохраняет → порядок записывается в `catalog_category_settings`
4. На витрине StoreFront (и CustomerDashboard) dropdown с категориями показывает их в том же порядке

```text
┌─────────────────────────────────────────────┐
│  ПРАЙС-ЛИСТ "Оптовый прайс сайт"           │
│  ─────────────────────────────────────────  │
│  Порядок (сохранён в catalog_category_      │
│  settings):                                 │
│  0. Фуэт 2                                 │
│  1. Бренд Боерн тротс                      │
│  2. Вкусовые сыры с добавками              │
│  3. Порционный сыр                         │
│  4. Смешанное молоко                       │
└─────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────┐
│  ВИТРИНА (StoreFront) — dropdown категорий │
│  ─────────────────────────────────────────  │
│  ● Все товары                              │
│  ─────────────────                         │
│  ● Фуэт 2                                  │
│  ● Бренд Боерн тротс                       │
│  ● Вкусовые сыры с добавками               │
│  ● Порционный сыр                          │
│  ● Смешанное молоко                        │
│  ...                                       │
└─────────────────────────────────────────────┘
```
