# E2E-проверка на настоящей БД (Postgres + PostgREST)

Проверяет то, что нельзя проверить моками: RLS, колоночные GRANT-ы, view и
поведение `api/spa`, `api/sitemap` и клиентских страниц на реальных ответах API.
Миграций нет: `is_draft` ничего не скрывает, объявления из Telegram публикуются сразу.
**Только локально, на тестовой БД, никогда не на production.** Клиентский тест
ходит на `http://localhost:3200`; не кладите рядом боевой `.env`.

Нужно: Postgres 16, бинарь [PostgREST](https://github.com/PostgREST/postgrest/releases)
(проверено на 12.2.3), Node 22, `npm i --no-save jsdom @testing-library/react`
(только для `client.test.mjs`).

```bash
createdb e2e && psql -d e2e -f tests/e2e/schema.sql   # схема + "как в проде": объекты из Telegram с is_draft=true
# PostgREST: db-uri -> e2e, db-anon-role=anon, jwt-secret = E2E_JWT_SECRET, порт 3100
node tests/e2e/gen-tokens.mjs                         # tokens.json
node tests/e2e/proxy.mjs &                            # имитация префикса /rest/v1 у Supabase (порт 3200)

node tests/e2e/snapshot.mjs save                      # что видит посетитель СЕЙЧАС
psql -d e2e -f tests/e2e/bot-new-listing.sql          # имитация нового поста бота (карточка + страница, is_draft=true)
node tests/e2e/snapshot.mjs check                     # ничего не исчезло, новое появилось
node tests/e2e/probe-public.mjs                       # права anon / user / admin (20 проверок)

psql -d e2e -f tests/e2e/seed-mixed.sql               # граничные случаи
node tests/e2e/handlers.mjs                           # настоящие api/spa и api/sitemap
node tests/e2e/client.test.mjs                        # клиентские страницы в jsdom, из корня проекта
```
### Сохранение объявлений бота (разбор -> запись -> чтение как посетитель)

```bash
node tests/e2e/gen-tokens.mjs                 # токены живут 24 ч: при "JWT expired" перегенерируйте
node tests/e2e/persist.mjs                    # настоящие buildCardRow/insertCardRow/savePage, чтение через anon (32 проверки)
node tests/e2e/webhook.mjs                    # настоящий api/telegram-webhook.js: новый пост, правка, ИИ, ИИ недоступен, "продано"

# опционально: этаж жилья в карточках (только на ТЕСТОВОЙ БД!)
psql -d e2e -f sql/optional_add_card_floor.sql
node tests/e2e/floor.mjs
```
`persist.mjs`/`webhook.mjs` запускать на свежей БД (`schema.sql`); `webhook.mjs` и `persist.mjs`
пишут ключом `service_role` (как бот). Telegram и Google Translate в них подменены.

PostgREST, прокси и тесты нужно запускать в одном сеансе: фоновые процессы не должны
пропадать между шагами. Для повторного запуска пересоздайте БД.
