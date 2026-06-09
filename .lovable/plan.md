
## Цель

Во вкладке «Авито» сделать переключатель аккаунтов сверху: можно добавить несколько аккаунтов Авито (client_id/secret), переключаться между ними и видеть для каждого свою рабочую область — города-вкладки, товары для фида, активные объявления, статистику, бот, аналитика, фид XML.

## Что меняется

### 1. БД (миграция)

- `avito_accounts`: убрать UNIQUE на `store_id`, добавить `is_default boolean`, `sort_order int`, `label text` (отображаемое имя на пилюле, по умолчанию = profile_name).
- `avito_city_tabs`: добавить колонку `account_id uuid references avito_accounts(id) on delete cascade`, индекс. Существующую вкладку «Основная» привязать к текущему единственному аккаунту магазина.
- `avito_feed_products`: добавить `account_id uuid references avito_accounts(id) on delete cascade`, индекс. Бэкфил по `tab_id → city_tabs.account_id` или по единственному аккаунту магазина.
- RLS остаётся через `store_id` (политики не трогаем).
- GRANT'ы уже есть на этих таблицах.

### 2. Edge функции

- `avito-api`:
  - Принимает опциональный `account_id` во всех экшенах. Если не передан — берётся `is_default` либо первый.
  - Все `.eq("store_id", ...).single()` заменяются на `.eq("id", account_id)` (или fallback по store_id+default).
  - Новые экшены: `list_accounts`, `set_default_account`, `update_account_label`. `connect/save_credentials/disconnect` работают per-account (`account_id` опционален при создании нового).
  - `restore_feed_from_active` и статистика — для выбранного account_id, вставка в `avito_feed_products` с `account_id` и `tab_id` активной вкладки этого аккаунта.
- `avito-feed`:
  - URL получает параметр `?account=<id>` (или сохраняем обратную совместимость: без параметра отдаём дефолтный аккаунт магазина).
  - Подгружает только city_tabs/feed_products этого account_id, `feed_defaults` берёт из его записи `avito_accounts`.

### 3. UI — `src/components/admin/AvitoSection.tsx`

Сверху, над блоком «Города», добавляется панель **«Аккаунты Авито»**:

```text
[● Вероника ✓подкл]  [○ Аккаунт 2]  [+ Добавить аккаунт]   [⚙ переименовать] [★ сделать основным] [🗑 удалить]
```

- Пилюли-табы аккаунтов (как сейчас вкладки-города), активный подсвечен зелёным, рядом бэйдж «Подключено/Не подключено».
- Кнопка «+ Добавить аккаунт» → диалог с полями Client ID / Client Secret / Название → создаёт строку в `avito_accounts` и сразу делает её активной, подгружает profile_name из Avito API.
- Контекстное меню на пилюле: переименовать, сделать основным, отключить (очистить токены), удалить (с подтверждением — каскадом удалит city_tabs и feed_products).
- Активный `account_id` хранится в `localStorage` per-store (как сейчас `activeTabId` для городов).
- Все существующие блоки (Города, Товары для Авито, Объявления с ошибками, Активные объявления, Статистика, API подключение, Настройки, Категории) фильтруются по активному account_id.
- Бэйдж «Подключено: …» в шапке показывает имя активного аккаунта.
- Кнопка «Скопировать ссылку на фид» подставляет `?account=<id>`.

### 4. Хуки

- `useAvitoAccounts(storeId)` — новый: список аккаунтов, активный, CRUD, setActive.
- `useAvitoCityTabs` — принимает `accountId`, фильтрует и создаёт вкладки с `account_id`.
- `useAvitoFeedProducts` — принимает `accountId`, фильтрует и пишет `account_id`.
- `useAvitoBot` — уже привязан к `avito_account_id`, передаём активный.

### 5. Что не меняется

- Схема товаров магазина, общие категории, фото-студия (она per-store).
- Логика префиксов «Опт:», восстановления фида, AI-аналитика — переиспользуются, просто per-account.
- RLS-политики на public таблицах.

## Технические детали

**Миграция (укрупнённо):**
```sql
alter table public.avito_accounts drop constraint avito_accounts_store_id_key;
alter table public.avito_accounts
  add column is_default boolean not null default false,
  add column sort_order int not null default 0,
  add column label text;
update public.avito_accounts set is_default = true, label = coalesce(profile_name, 'Аккаунт');

alter table public.avito_city_tabs add column account_id uuid references public.avito_accounts(id) on delete cascade;
create index idx_avito_city_tabs_account on public.avito_city_tabs(account_id);
update public.avito_city_tabs t set account_id = (
  select a.id from public.avito_accounts a where a.store_id = t.store_id and a.is_default limit 1
);

alter table public.avito_feed_products add column account_id uuid references public.avito_accounts(id) on delete cascade;
create index idx_avito_feed_products_account on public.avito_feed_products(account_id);
update public.avito_feed_products fp set account_id = (
  select ct.account_id from public.avito_city_tabs ct where ct.id = fp.tab_id
);
```

**Backwards-compat фида:** `avito-feed` без `?account=` → дефолтный аккаунт магазина, чтобы уже настроенные в Авито URL продолжали работать.

## Файлы

- новая миграция `supabase/migrations/*_avito_multi_account.sql`
- `supabase/functions/avito-api/index.ts` (account_id во всех экшенах + list/set_default/update_label)
- `supabase/functions/avito-feed/index.ts` (читаем ?account=)
- новый `src/hooks/useAvitoAccounts.ts`
- `src/hooks/useAvitoCityTabs.ts`, `src/hooks/useAvitoFeedProducts.ts` (фильтр по accountId)
- `src/components/admin/AvitoSection.tsx` (панель аккаунтов сверху + проброс accountId везде)
