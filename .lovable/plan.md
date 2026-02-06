

# Исправление сброса порядка категорий

## Найденные проблемы

### Проблема 1: Realtime-подписка сбрасывает порядок
После сохранения порядка, `updateCategoryOrder` отправляет N отдельных UPDATE-запросов в БД. Каждый из них вызывает realtime-событие, которое обновляет объект категории в массиве через `prev.map(...)`. Но массив НЕ пересортировывается -- объекты просто заменяются на месте. Когда новые `sort_order` приходят через realtime, позиции в массиве остаются старыми, и при следующем открытии диалога (или любом использовании `categories`) порядок берётся из `sort_order` полей, которые могут не соответствовать позициям в массиве.

### Проблема 2: Каталог-специфичный порядок портит глобальное состояние
`updateCatalogCategoryOrder` сохраняет порядок в таблицу `catalog_category_settings`, но затем перестраивает ГЛОБАЛЬНЫЙ массив `categories` -- это неправильно. При следующем вызове `fetchCategories()` (который читает глобальный `sort_order` из таблицы `categories`) порядок сбрасывается обратно.

### Проблема 3: Диалог не знает каталог-специфичный порядок
При открытии диалога для конкретного каталога, категории сортируются по глобальному `sort_order` из `categories`, а не по `catalog_category_settings.sort_order`. Поэтому даже если каталог-специфичный порядок был сохранён, диалог показывает глобальный.

## Решение

### 1. `src/hooks/useStoreCategories.ts` -- исправить realtime и убрать мутацию глобального состояния

**Realtime**: после любого UPDATE-события пересортировать массив по `sort_order`:
```typescript
// Вместо просто замены объекта:
setCategories(prev => prev.map(c => c.id === updated.id ? updated : c));

// Замена + пересортировка:
setCategories(prev => {
  const updated = prev.map(c => c.id === updatedCat.id ? updatedCat : c);
  return updated.sort((a, b) => (a.sort_order ?? 999999) - (b.sort_order ?? 999999));
});
```

**`updateCatalogCategoryOrder`**: убрать `setCategories(...)` -- каталог-специфичный порядок не должен влиять на глобальный массив.

### 2. `src/components/admin/CategoryOrderDialog.tsx` -- загружать каталог-специфичный порядок

При открытии диалога с `catalogId`: сделать запрос к `catalog_category_settings` для этого каталога и использовать `sort_order` оттуда для начальной сортировки, вместо глобального `sort_order`.

```typescript
useEffect(() => {
  if (!open) return;
  
  if (catalogId) {
    // Загрузить каталог-специфичный порядок
    supabase
      .from('catalog_category_settings')
      .select('category_id, sort_order')
      .eq('catalog_id', catalogId)
      .then(({ data }) => {
        const orderMap = new Map(data?.map(d => [d.category_id, d.sort_order]) || []);
        const sorted = [...categories].sort((a, b) => {
          const orderA = orderMap.get(a.id) ?? a.sort_order ?? 999999;
          const orderB = orderMap.get(b.id) ?? b.sort_order ?? 999999;
          return orderA - orderB || a.name.localeCompare(b.name);
        });
        setOrderedCategories(sorted);
      });
  } else {
    // Глобальный порядок -- как раньше
    const sorted = [...categories].sort((a, b) => {
      const orderA = a.sort_order ?? 999999;
      const orderB = b.sort_order ?? 999999;
      return orderA - orderB || a.name.localeCompare(b.name);
    });
    setOrderedCategories(sorted);
  }
}, [open, categories, catalogId]);
```

## Файлы для изменения

| Файл | Что меняется |
|------|-------------|
| `src/hooks/useStoreCategories.ts` | (1) Realtime UPDATE: пересортировка массива после замены. (2) `updateCatalogCategoryOrder`: убрать `setCategories`. |
| `src/components/admin/CategoryOrderDialog.tsx` | При открытии с `catalogId` -- загрузить порядок из `catalog_category_settings` |

## Результат

- Глобальный порядок сохраняется и не сбрасывается realtime-событиями
- Каталог-специфичный порядок не перезаписывает глобальное состояние
- Диалог корректно показывает порядок для конкретного каталога

