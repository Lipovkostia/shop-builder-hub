
# Транслирование порядка категорий из прайс-листа на витрины

## Текущая ситуация

### Как сейчас работает порядок категорий:

1. **В админ-панели**: `CategoryOrderDialog` → вызывает `updateCategoryOrder()` → обновляет поле `sort_order` в таблице `categories`

2. **На витрине Retail**: `useRetailStore` → запрашивает категории из `categories` таблицы с `.order("sort_order")`

3. **На витрине Wholesale**: `useWholesaleStore` → запрашивает категории из `categories` таблицы с `.order("sort_order")`

### Проблема:

Порядок категорий сейчас **глобальный для магазина** (хранится в `categories.sort_order`), но у вас есть таблица `catalog_category_settings` с полями:
- `catalog_id` — привязка к конкретному прайс-листу
- `category_id` — ID категории  
- `custom_name` — кастомное название для каталога
- `sort_order` — порядок отображения в каталоге

Эта таблица **создана, но не используется** на витринах!

---

## План реализации

### Этап 1: Модификация хуков витрин для использования каталог-специфичного порядка

**Файлы:**
- `src/hooks/useRetailStore.ts`
- `src/hooks/useWholesaleStore.ts`

Изменить логику загрузки категорий: вместо глобального `categories.sort_order` использовать `catalog_category_settings.sort_order` для конкретного каталога, привязанного к витрине.

```text
Текущая логика:
  categories → order by sort_order (глобальный)

Новая логика:
  categories LEFT JOIN catalog_category_settings
  ON catalog_id = retail_catalog_id / wholesale_catalog_id
  ORDER BY COALESCE(catalog_settings.sort_order, categories.sort_order, 999)
```

### Этап 2: Создание SQL-функции для получения категорий с каталог-специфичным порядком

Новая функция `get_catalog_categories_ordered` в базе данных:

```sql
CREATE FUNCTION get_catalog_categories_ordered(_catalog_id uuid, _store_id uuid)
RETURNS TABLE (
  id uuid,
  name text,           -- кастомное имя или оригинальное
  slug text,
  image_url text,
  parent_id uuid,
  sort_order int
)
```

Логика:
1. Берём все категории магазина
2. LEFT JOIN с `catalog_category_settings` для данного каталога
3. Применяем кастомное имя из настроек (если есть)
4. Сортируем по `catalog_settings.sort_order`, затем `categories.sort_order`, затем по имени

### Этап 3: Обновление AdminPanel — сохранение порядка в catalog_category_settings

При изменении порядка категорий в прайс-листе:
- Сохранять в `catalog_category_settings` (привязка к каталогу)
- Если нет записи — создавать
- Если есть — обновлять `sort_order`

**Файл:** `src/hooks/useStoreCategories.ts` или новый хук `useCatalogCategorySettings.ts`

### Этап 4: Обновление компонентов витрин

**Retail:**
- `RetailLayoutSidebar.tsx` — категории уже получает пропсами, сортировка будет применена в хуке
- `CategoryProductsSection.tsx` — порядок секций определяется порядком категорий

**Wholesale:**
- `WholesaleCategorySelector.tsx` — аналогично

---

## Техническая реализация

### 1. Миграция базы данных

```sql
-- Функция для получения категорий с учётом каталог-специфичного порядка
CREATE OR REPLACE FUNCTION get_catalog_categories_ordered(
  _catalog_id uuid,
  _store_id uuid
)
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  image_url text,
  parent_id uuid,
  sort_order integer
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    c.id,
    COALESCE(ccs.custom_name, c.name) as name,
    c.slug,
    c.image_url,
    c.parent_id,
    COALESCE(ccs.sort_order, c.sort_order, 999999) as sort_order
  FROM categories c
  LEFT JOIN catalog_category_settings ccs 
    ON ccs.category_id = c.id 
    AND ccs.catalog_id = _catalog_id
  WHERE c.store_id = _store_id
  ORDER BY COALESCE(ccs.sort_order, c.sort_order, 999999), c.name;
$$;
```

### 2. Изменение useRetailStore.ts

```typescript
const fetchCategories = useCallback(async () => {
  if (!store?.id) return;
  
  // Используем каталог-специфичный порядок если есть каталог
  if (store.retail_catalog_id) {
    const { data } = await supabase
      .rpc('get_catalog_categories_ordered', {
        _catalog_id: store.retail_catalog_id,
        _store_id: store.id
      });
    // ... обработка
  } else {
    // Fallback на глобальный порядок
    const { data } = await supabase
      .from("categories")
      .select("*")
      .eq("store_id", store.id)
      .order("sort_order");
  }
}, [store?.id, store?.retail_catalog_id]);
```

### 3. Изменение AdminPanel — привязка к каталогу

При сохранении порядка категорий в прайс-листе, если выбран конкретный каталог:

```typescript
const updateCatalogCategoryOrder = async (catalogId: string, orderedIds: string[]) => {
  for (let i = 0; i < orderedIds.length; i++) {
    await supabase
      .from('catalog_category_settings')
      .upsert({
        catalog_id: catalogId,
        category_id: orderedIds[i],
        sort_order: i
      }, { 
        onConflict: 'catalog_id,category_id' 
      });
  }
};
```

---

## Результат

После реализации:

1. Продавец открывает прайс-лист "Опт для ресторанов"
2. Меняет порядок категорий (перетаскиванием)
3. Сохраняет — порядок записывается в `catalog_category_settings` для этого каталога
4. Оптовая витрина (подключённая к этому прайс-листу) автоматически отображает категории в новом порядке
5. Другие прайс-листы и витрины сохраняют свой порядок

```text
┌──────────────────────────────────────────────────────┐
│  ПРАЙС-ЛИСТ "Опт для ресторанов"                     │
│  ───────────────────────────────────────────────────  │
│  Порядок категорий:                                  │
│  1. Сыры твёрдые          ─────┐                     │
│  2. Сыры мягкие                │                     │
│  3. Молочная продукция         │ сохраняется в       │
│                                ▼ catalog_category_   │
│                                  settings            │
└──────────────────────────────────────────────────────┘
                │
                │ retail_catalog_id / wholesale_catalog_id
                ▼
┌──────────────────────────────────────────────────────┐
│  ВИТРИНА ОПТОВОГО МАГАЗИНА                          │
│  ───────────────────────────────────────────────────  │
│  Категории (в том же порядке):                       │
│  1. Сыры твёрдые                                     │
│  2. Сыры мягкие                                      │
│  3. Молочная продукция                               │
└──────────────────────────────────────────────────────┘
```

---

## Файлы для изменения

| Файл | Изменения |
|------|-----------|
| `supabase/migrations/...` | Новая функция `get_catalog_categories_ordered` |
| `src/hooks/useRetailStore.ts` | Использовать RPC с каталог-специфичным порядком |
| `src/hooks/useWholesaleStore.ts` | Использовать RPC с каталог-специфичным порядком |
| `src/hooks/useStoreCategories.ts` | Добавить `updateCatalogCategoryOrder` |
| `src/pages/AdminPanel.tsx` | Передавать `catalogId` в диалог порядка категорий |
| `src/components/admin/CategoryOrderDialog.tsx` | Принимать `catalogId` и использовать каталог-специфичное сохранение |
