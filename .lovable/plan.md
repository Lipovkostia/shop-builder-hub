
## План: Полный экспорт базы данных и Storage

### Что будет выгружено

**1. База данных (один архив `database_dump.zip`)**
- `schema.sql` — структура: таблицы, типы (enum), функции, триггеры, индексы, foreign keys
- `rls_policies.sql` — все RLS политики и GRANT для public схемы
- `data.sql` — все данные public схемы в виде `INSERT`-ов
- `auth_users.sql` — экспорт `auth.users` (id, email, encrypted_password (bcrypt), email_confirmed_at, raw_user_meta_data, created_at). Хеши паролей совместимы с любым Supabase/GoTrue инстансом — пользователи смогут логиниться теми же паролями.
- `README_RESTORE.md` — инструкция по восстановлению на своём PostgreSQL/Supabase сервере (последовательность: schema → auth → data → rls)

**2. Storage (отдельный архив `storage_files.zip`)**
- Скачаю все файлы из бакетов: `product-images`, `landing-slides`, `order-attachments`, `landing-info`, `avito-images`
- Сохраню структуру папок как в бакетах
- Приложу `buckets.json` с настройками бакетов (public/private, лимиты)

### Как буду делать

1. Через `psql` (доступ к Supabase DB есть в sandbox) выгружу:
   - Схему public через запросы к `information_schema` + `pg_dump`-style SELECT
   - Все функции через `pg_get_functiondef`
   - RLS политики через `pg_policies`
   - Данные через `COPY ... TO` для каждой таблицы (быстрее и надёжнее, чем INSERT для больших таблиц — конвертирую в INSERT для удобства импорта)
   - Auth.users через service_role (только нужные поля, без служебных)

2. Через Supabase Storage API (service_role) скачаю списком все объекты каждого бакета и сохраню локально.

3. Упакую всё в два zip-архива в `/mnt/documents/`, выдам ссылки для скачивания через `<presentation-artifact>`.

### Важные замечания

- **Размер**: бакет `product-images` и `avito-images` могут весить много гигабайт. Если архив получится слишком большим — разобью на части или предложу скачать бакеты по отдельности.
- **Безопасность**: архив будет содержать хеши паролей и все данные клиентов/заказов. Скачивайте по защищённому каналу и храните аккуратно.
- **Совместимость**: дамп рассчитан на PostgreSQL 15+ с расширениями `pgcrypto` и `uuid-ossp` (как в Supabase). Auth-схема — на восстановление в Supabase/GoTrue (для голого PostgreSQL пароли работать не будут без GoTrue).
- **Что НЕ войдёт**: Edge Functions (это код в репозитории, не БД), секреты (TELEGRAM_BOT_TOKEN и т.д. — это переменные окружения, не БД), realtime publication настройки (пересоздадите на новом сервере).

После вашего подтверждения запущу выгрузку — это займёт несколько минут в зависимости от объёма Storage.
