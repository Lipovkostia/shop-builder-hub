
# Массовое снятие категорий у выбранных товаров в прайс-листе

## Что будет сделано

В выпадающее меню "Категории" в панели массового редактирования (BulkEditPanel) будет добавлена кнопка "Снять все категории". При нажатии она очищает все категории у выбранных товаров в текущем прайс-листе.

## Техническая часть

| Файл | Изменения |
|------|-----------|
| `src/components/admin/BulkEditPanel.tsx` | Добавить новый проп `onBulkClearCategories`, кнопку "Снять все" в Popover категорий |
| `src/pages/AdminPanel.tsx` | Передать `onBulkClearCategories` — вызывает `updateCatalogProductPricing` с `categories: []` для каждого выбранного товара |

### Изменения в BulkEditPanel

- Новый проп: `onBulkClearCategories?: () => void`
- В PopoverContent после списка категорий и перед кнопками "Применить/Отмена" добавить разделитель и кнопку "Снять все категории" с иконкой `X`
- Кнопка закрывает Popover после действия

### Изменения в AdminPanel

- Передать `onBulkClearCategories` в BulkEditPanel (строка ~4646):
```typescript
onBulkClearCategories={() => {
  if (currentCatalog) {
    const count = selectedCatalogBulkProducts.size;
    selectedCatalogBulkProducts.forEach(productId => {
      updateCatalogProductPricing(currentCatalog.id, productId, { categories: [] });
    });
    setSelectedCatalogBulkProducts(new Set());
    toast({
      title: "Категории сняты",
      description: `Категории очищены у ${count} товаров`,
    });
  }
}}
```
