## Что меняем

### 1. Прайс-лист (`src/pages/AdminPanel.tsx`) — новая кнопка рядом с иконкой фото

В ячейке "Фото" каталога (строки ~5844-5878) сейчас две кнопки: фиолетовый `Sparkles` (открывает AI-фоторедактор в модалке Авито) и `ImageIcon` (разворачивает галерею).

Добавим **третью кнопку** между ними — иконка `Wand2` (зелёная), title «Открыть в AI Photo Studio». По клику:
- `setActiveSection("photo-generation")`
- `setSearchParams`: `section=photo-generation`, `productId=<product.id>`, `fromPriceList=1`

Это переключает на раздел AI Photo с уже выбранным товаром (механика `preselectedProductId` уже работает).

### 2. AI Photo (`PhotoGenerationSection.tsx`) — кнопка «Назад в прайс-лист»

Добавляем новый проп `onOpenInPriceList?: (productId: string) => void` рядом с `onOpenInAvito`. В строке промпта (около строки 715) добавляем вторую кнопку рядом с «В Авито»:

```tsx
{onOpenInPriceList && (
  <Button size="sm" variant="ghost" onClick={() => onOpenInPriceList(r.product_id)} title="Вернуться к товару в прайс-листе">
    ← В прайс-лист
  </Button>
)}
```

В `AdminPanel.tsx` (строка ~7330) передаём колбэк, который читает сохранённый `fromPriceList` флаг и возвращает на `section=products` с подсветкой нужного товара (`productId=<id>`).

### 3. AI Photo — перенос кнопок действий из правой части в левую

Сейчас блок кнопок («В Авито», «Генерировать») в `flex items-center justify-between` справа (строки 710-725). Кнопки приходится искать прокручивая ряд вправо.

Меняем порядок: блок с кнопками генерации/переходов размещаем **слева** от текстового счётчика (`justify-between` остаётся, но `<div className="flex gap-1">` идёт первым, счётчик — справа). Так главные действия всегда в начале строки.

## Файлы

- `src/pages/AdminPanel.tsx` — третья кнопка в ячейке фото каталога; новый колбэк `onOpenInPriceList` для `PhotoGenerationSection`.
- `src/components/admin/photo-generation/PhotoGenerationSection.tsx` — новый проп `onOpenInPriceList`, кнопка «← В прайс-лист», перестановка панели действий влево.

Бэкенд/схема БД не затрагиваются.
