
# План: Полноценная поддержка кастомных доменов для Retail и Wholesale магазинов

## Текущая проблема

Когда пользователь заходит на `9999999999.ru`:
1. DNS направляет трафик на сервер Lovable (185.158.133.1)
2. Приложение загружается, но `App.tsx` видит только путь `/`
3. React Router показывает главную страницу `Index` вместо магазина
4. Домен `9999999999.ru` привязан к магазину `79999993222-d778` как `wholesale_custom_domain`, но это нигде не проверяется

## Решение: Перехват кастомных доменов в App.tsx

```text
┌─────────────────────────────────────────────────────────────────┐
│                    ЗАГРУЗКА ПРИЛОЖЕНИЯ                          │
│                  (window.location.hostname)                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  ОПРЕДЕЛЕНИЕ ТИПА ДОМЕНА                                        │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Платформенный домен?                                           │
│  • *.lovable.app                                                │
│  • *.lovable.dev                                                │
│  • localhost                                                    │
│  • 127.0.0.1                                                    │
│       │                               │                         │
│      ДА                              НЕТ                        │
│       │                               │                         │
│       ▼                               ▼                         │
│  Стандартный                    КАСТОМНЫЙ ДОМЕН                 │
│  React Router                   (например 9999999999.ru)        │
│       │                               │                         │
│       │                               ▼                         │
│  /retail/:subdomain            Поиск в БД:                      │
│  /wholesale/:subdomain         ├─ custom_domain = hostname?     │
│  /admin                        └─ wholesale_custom_domain =     │
│  и т.д.                            hostname?                    │
│                                       │                         │
│                          ┌────────────┼────────────┐            │
│                          │            │            │            │
│                      Найден       Найден        Не найден       │
│                     в Retail     в Wholesale        │           │
│                          │            │            ▼           │
│                          ▼            ▼        Страница         │
│                     RetailStore  WholesaleStore  "Магазин       │
│                     (рендер      (рендер       не найден"       │
│                      напрямую)    напрямую)                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Часть 1: Новый хук useCustomDomainStore

Создать `src/hooks/useCustomDomainStore.ts`:

Универсальный хук для поиска магазина по любому кастомному домену:

| Функция | Описание |
|---------|----------|
| `useCustomDomainStore(hostname)` | Ищет магазин в БД по `custom_domain` ИЛИ `wholesale_custom_domain` |

Возвращает:
- `store` — данные магазина
- `storeType` — `"retail"` или `"wholesale"` или `null`
- `loading` — статус загрузки
- `error` — сообщение об ошибке

Логика поиска:
1. Проверить `stores.custom_domain = hostname` → Retail магазин
2. Проверить `stores.wholesale_custom_domain = hostname` → Wholesale магазин
3. Если ничего не найдено → `storeType = null`

---

## Часть 2: Новый компонент CustomDomainHandler

Создать `src/components/CustomDomainHandler.tsx`:

| Состояние | Отображение |
|-----------|-------------|
| Загрузка | Спиннер загрузки |
| storeType = "retail" | `<RetailStore subdomain={store.subdomain} />` |
| storeType = "wholesale" | `<WholesaleStore subdomain={store.subdomain} />` |
| Не найден | Страница ошибки "Магазин не найден" |

Также должен обрабатывать подпути на кастомных доменах:
- `/` → Главная магазина
- `/product/:slug` → Страница товара
- `/checkout` → Оформление заказа (для Retail)

---

## Часть 3: Изменения в App.tsx

Добавить проверку кастомного домена ДО стандартного роутинга:

```text
const App = () => {
  const hostname = window.location.hostname;
  
  // Список платформенных доменов
  const isPlatformDomain = 
    hostname.endsWith('.lovable.app') ||
    hostname.endsWith('.lovable.dev') ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('192.168.') ||
    hostname.includes('preview--');
  
  if (!isPlatformDomain) {
    // Это кастомный домен — используем специальный обработчик
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <CustomDomainHandler hostname={hostname} />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    );
  }
  
  // Стандартный роутинг для платформенных доменов
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* существующие маршруты */}
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

---

## Часть 4: Обновление WholesaleStore и RetailStore

Добавить поддержку проп `subdomain` для прямого рендеринга:

```text
// Текущий код:
export default function WholesaleStore() {
  const { subdomain } = useParams(); // Только из URL
  ...
}

// Новый код:
interface Props {
  subdomain?: string; // Для прямого вызова с CustomDomainHandler
}

export default function WholesaleStore({ subdomain: directSubdomain }: Props = {}) {
  const params = useParams();
  const subdomain = directSubdomain || params.subdomain;
  ...
}
```

---

## Часть 5: Роутинг внутри CustomDomainHandler

Для кастомных доменов нужно поддержать внутренние страницы:

| Путь на кастомном домене | Компонент |
|--------------------------|-----------|
| `/` | RetailStore / WholesaleStore |
| `/product/:slug` | WholesaleProduct (для Wholesale) |
| `/product/:productId` | RetailStore с productId (для Retail) |
| `/checkout` | RetailCheckout (только для Retail) |

CustomDomainHandler будет использовать внутренний BrowserRouter:

```text
<BrowserRouter>
  <Routes>
    {storeType === "wholesale" && (
      <>
        <Route path="/" element={<WholesaleStore subdomain={store.subdomain} />} />
        <Route path="/product/:slug" element={<WholesaleProduct subdomain={store.subdomain} />} />
      </>
    )}
    {storeType === "retail" && (
      <>
        <Route path="/" element={<RetailStore subdomain={store.subdomain} />} />
        <Route path="/product/:productId" element={<RetailStore subdomain={store.subdomain} />} />
        <Route path="/checkout" element={<RetailCheckout subdomain={store.subdomain} />} />
      </>
    )}
    <Route path="*" element={<NotFound />} />
  </Routes>
</BrowserRouter>
```

---

## Файлы для создания/изменения

| Файл | Действие | Описание |
|------|----------|----------|
| `src/hooks/useCustomDomainStore.ts` | Создать | Поиск магазина по кастомному домену |
| `src/components/CustomDomainHandler.tsx` | Создать | Обработчик кастомных доменов с роутингом |
| `src/App.tsx` | Изменить | Добавить проверку hostname перед BrowserRouter |
| `src/pages/WholesaleStore.tsx` | Изменить | Добавить проп `subdomain` |
| `src/pages/WholesaleProduct.tsx` | Изменить | Добавить проп `subdomain` |
| `src/pages/RetailStore.tsx` | Изменить | Добавить проп `subdomain` |
| `src/pages/RetailCheckout.tsx` | Изменить | Добавить проп `subdomain` |

---

## Примеры работы

### Пример 1: `9999999999.ru` (Wholesale)

```text
1. Пользователь заходит на 9999999999.ru
2. DNS → 185.158.133.1 → Lovable сервер
3. App.tsx: hostname = "9999999999.ru" — НЕ платформенный
4. Рендерится CustomDomainHandler
5. useCustomDomainStore ищет в БД:
   - custom_domain = "9999999999.ru"? НЕТ
   - wholesale_custom_domain = "9999999999.ru"? ДА → subdomain: "79999993222-d778"
6. storeType = "wholesale"
7. Рендерится WholesaleStore с subdomain="79999993222-d778"
8. Пользователь видит оптовый магазин
```

### Пример 2: `shop.example.com` (Retail)

```text
1. Пользователь заходит на shop.example.com
2. CustomDomainHandler ищет:
   - custom_domain = "shop.example.com"? ДА
3. storeType = "retail"
4. Рендерится RetailStore
```

### Пример 3: `shopify-on-sub.lovable.app/wholesale/1`

```text
1. hostname = "shopify-on-sub.lovable.app" — платформенный
2. Стандартный React Router
3. Route "/wholesale/:subdomain" → WholesaleStore
4. subdomain = "1" из useParams()
```

### Пример 4: `9999999999.ru/product/hammon-serrano`

```text
1. hostname = "9999999999.ru" — кастомный
2. CustomDomainHandler определяет: wholesale
3. Внутренний роутинг: path="/product/:slug"
4. Рендерится WholesaleProduct с slug="hammon-serrano"
```

---

## Преимущества решения

- Минимальные изменения в существующем коде
- Чёткое разделение логики кастомных и платформенных доменов
- Поддержка отдельных доменов для Retail и Wholesale
- Полноценная поддержка подстраниц (товары, checkout)
- Совместимость с SEO (страницы товаров доступны по прямым ссылкам)
- Лёгкое добавление новых подстраниц в будущем
