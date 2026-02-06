

# Добавление импорта фото из Excel через AI помощник

## Что будет сделано

Новая функция в AI помощнике: загрузка Excel-файла со ссылками на фото для товаров без изображений. Система скачает фото по ссылкам и привяжет к товарам.

## Изменения

### 1. PriceListProduct -- добавить поле photos (`src/lib/priceListImport.ts`)

Добавить в интерфейс `PriceListProduct` поле `photos?: string[]` для хранения ссылок на изображения из Excel.

### 2. parseProductsWithExtendedMapping -- парсить колонку фото (`src/lib/priceListImport.ts`)

В функции парсинга добавить обработку `fieldsToUpdate.photos`:
- Прочитать значение ячейки
- Разделить по `;` или `,` (несколько ссылок)
- Отфильтровать пустые и невалидные
- Сохранить массив URL в `product.photos`

Также убрать ограничение, что товар без цены пропускается, если указаны фото.

### 3. importProductsToCatalogExtended -- скачивать фото через edge function (`src/lib/priceListImport.ts`)

После обновления/создания товара, если в Excel есть ссылки на фото:
1. Проверить, есть ли у товара уже фото (поле `image_url` в products)
2. Если фото нет или передано новое -- вызвать edge function `fetch-external-image` для каждой ссылки
3. Обновить поля `image_url` (главное фото) и `images` (все фото) в таблице products

```typescript
if (excelProduct.photos && excelProduct.photos.length > 0) {
  const uploadedUrls: string[] = [];
  for (let imgIdx = 0; imgIdx < excelProduct.photos.length; imgIdx++) {
    const { data } = await supabase.functions.invoke('fetch-external-image', {
      body: { imageUrl: excelProduct.photos[imgIdx], productId: existingProduct.id, imageIndex: imgIdx }
    });
    if (data?.url) uploadedUrls.push(data.url);
  }
  if (uploadedUrls.length > 0) {
    await supabase.from('products').update({
      image_url: uploadedUrls[0],
      images: uploadedUrls
    }).eq('id', existingProduct.id);
  }
}
```

### 4. AI помощник -- показывать поле "Фото" в маппинге (`src/components/admin/AIAssistantPanel.tsx`)

Сейчас AI помощник использует `mode='price-list'` для ExcelColumnMapping, где поле "Фото" скрыто. Нужно:
- Добавить поле `photos` в список `baseUpdateFields` (или передать `mode='assortment'`)
- Обновить валидацию `handleConfirmMapping`: разрешить импорт если выбрано только поле `photos`
- Добавить `'photos'` в `fieldsToUpdateArray` при вызове `importProductsToCatalogExtended`

### 5. Обновить fieldsToUpdate тип в importProductsToCatalogExtended

Расширить тип параметра `fieldsToUpdate` чтобы включить `'photos'`:

```typescript
fieldsToUpdate: ('buyPrice' | 'price' | 'unit' | 'name' | 'photos')[]
```

### 6. Прогресс загрузки фото

Обновить `PriceListImportProgress` чтобы показывать прогресс загрузки фото:

```typescript
interface PriceListImportProgress {
  // ... existing fields
  photosUploaded: number;  // Счётчик загруженных фото
}
```

В процессе импорта обновлять статус: `"Загрузка фото: 3 из 15"`

## Порядок реализации

1. `src/lib/priceListImport.ts` -- добавить поле photos в PriceListProduct, парсинг фото, логику скачивания
2. `src/components/admin/AIAssistantPanel.tsx` -- добавить поле "Фото" в маппинг, обновить валидацию
3. `src/components/admin/ExcelColumnMapping.tsx` -- добавить "Фото" в baseUpdateFields

## Результат

Продавец:
1. Открывает AI помощник
2. Загружает Excel с колонками: Название | Ссылка на фото
3. Сопоставляет колонку "Фото" с нужной колонкой Excel
4. Нажимает "Импортировать"
5. Система находит товары по названию, скачивает фото по ссылкам и привязывает к товарам

