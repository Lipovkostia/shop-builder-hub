
# Исправления в системе категорий и разделов

## Проблема 1: После удаления раздел остаётся в списке

**Причина**: `handleConfirmDelete` (строка 533) удаляет раздел только из локального состояния `items`, но НЕ вызывает `onDeleteCategory(id)` для удаления из базы данных. Также не удаляются связанные записи в `catalog_category_settings`.

**Решение**: Добавить вызов `onDeleteCategory(deleteTarget.id)` внутри `handleConfirmDelete`, а также удалить записи из `catalog_category_settings` для этой категории.

---

## Проблема 2: После сохранения/обновления выбрасывает из вкладки "Настройки категорий"

**Причина**: В файле `AdminPanel.tsx` (строка 687) при восстановлении секции из URL параметра проверяются только секции: `products`, `import`, `catalogs`, `visibility`, `orders`, `clients`, `help`. Секция `category-settings` отсутствует в списке, поэтому при обновлении страницы происходит сброс на `products`.

**Решение**: Добавить `"category-settings"` (а также другие отсутствующие секции: `profile`, `history`, `trash`, `retail`, `wholesale`) в условие проверки на строке 687.

---

## Проблема 3: Раздел "Хамон" с подкатегориями не виден в каталоге

**Причина**: В витрине (`StoreFront.tsx`, строка 1525) `catalogCategories` фильтрует категории по наличию товаров. Раздел-родитель (например "Хамон") может не иметь товаров, напрямую назначенных ему -- товары назначены только подкатегориям ("хамон без кости", "хамон на кости"). Также фильтр `topLevel` (строка 1867-1869) неверно определяет, какие категории являются верхнеуровневыми: он включает дочерние категории как "top level", если их родитель не найден в `catalogCategories`.

**Решение**:
- Изменить `catalogCategories` так, чтобы раздел-родитель включался в список, если хотя бы одна из его дочерних категорий имеет товары.
- Исправить фильтр `topLevel` -- категория НЕ верхнеуровневая, если у неё есть `catalog_parent_id`, даже если родитель не в текущем отфильтрованном списке.

---

## Проблема 4: Не видно количество товаров в каждой категории

**Решение**: Добавить подсчёт товаров для каждой категории в `catalogCategories` и отображать счётчик в выпадающем списке категорий рядом с названием.

---

## Проблема 5: Порядок категорий из настроек не транслируется на витрину

**Причина**: `catalogCategories` уже использует порядок из RPC, но при построении иерархии в дропдауне `topLevel` формируется без учёта `sort_order`. Также разделы без товаров выпадают из списка (проблема 3), что ломает порядок.

**Решение**: Исправление проблемы 3 автоматически исправит порядок. Дополнительно -- сохранять полный массив `catalogSpecificCategories` для построения иерархии, а `catalogCategories` использовать только для фильтрации по наличию товаров.

---

## Техническая часть

| Файл | Изменения |
|------|-----------|
| `src/components/admin/CategorySettingsSection.tsx` | (1) В `handleConfirmDelete` вызывать `onDeleteCategory(id)` и удалять `catalog_category_settings` записи |
| `src/pages/AdminPanel.tsx` | (2) Строка 687: добавить `category-settings` в список восстанавливаемых секций |
| `src/pages/StoreFront.tsx` | (3) Обновить `catalogCategories` -- включать разделы-родители, если у них есть дочерние с товарами. (4) Добавить подсчёт товаров по категориям. (5) Исправить `topLevel` фильтр -- не считать дочерние категории верхнеуровневыми |

### Ключевые изменения в коде

**CategorySettingsSection.tsx -- `handleConfirmDelete`:**
```typescript
const handleConfirmDelete = async () => {
  if (!deleteTarget) return;
  try {
    // Удалить из БД
    await onDeleteCategory(deleteTarget.id);
    // Удалить настройки каталога
    if (selectedCatalogId) {
      const idsToRemove = [deleteTarget.id, ...items.filter(i => i.parentCategoryId === deleteTarget.id).map(i => i.id)];
      await supabase.from('catalog_category_settings').delete()
        .eq('catalog_id', selectedCatalogId)
        .in('category_id', idsToRemove);
    }
  } catch (e) { console.error(e); }
  // Удалить из локального стейта
  setItems(prev => prev.filter(i => i.id !== deleteTarget.id && i.parentCategoryId !== deleteTarget.id));
  setDeleteTarget(null);
  setHasChanges(true);
};
```

**AdminPanel.tsx -- строка 687:**
```typescript
if (section === 'products' || section === 'import' || section === 'catalogs' || 
    section === 'visibility' || section === 'orders' || section === 'clients' || 
    section === 'help' || section === 'category-settings' || section === 'profile' || 
    section === 'history' || section === 'trash' || section === 'retail' || 
    section === 'wholesale') {
  setActiveSection(section);
}
```

**StoreFront.tsx -- `catalogCategories`:**
```typescript
const catalogCategories = useMemo(() => {
  if (!selectedCatalog) return [];
  
  // Собрать ID категорий с товарами и посчитать количество
  const categoryCounts = new Map<string, number>();
  displayProducts.forEach((p) => {
    if (!productVisibility[p.id]?.has(selectedCatalog)) return;
    const settings = getProductSettings(selectedCatalog, p.id);
    (settings?.categories || []).forEach(catId => {
      categoryCounts.set(catId, (categoryCounts.get(catId) || 0) + 1);
    });
  });
  
  // Включить разделы-родители, у которых есть дочерние с товарами
  const parentIdsToInclude = new Set<string>();
  catalogSpecificCategories.forEach(cat => {
    if (cat.catalog_parent_id && categoryCounts.has(cat.id)) {
      parentIdsToInclude.add(cat.catalog_parent_id);
    }
  });
  
  return catalogSpecificCategories
    .filter(cat => categoryCounts.has(cat.id) || parentIdsToInclude.has(cat.id))
    .map(cat => ({ ...cat, product_count: categoryCounts.get(cat.id) || 0 }));
}, [...]);
```
