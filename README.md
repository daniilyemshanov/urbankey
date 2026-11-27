# UrbanKey

Мультиязычный каталог недвижимости Ташкента на React/Vite, Vercel и Supabase. Исходный архив не содержит историю Git, production credentials или доказательство текущего состояния внешних аккаунтов.

## Начать

```sh
npm ci
npm run dev
npm run test:all
npm run build
```

Для локальной работы нужны переменные Vite/Supabase из секретного хранилища команды; не коммитьте `.env`. Для локального Telegram polling есть `npm run bot`; подробности в [документации проекта](docs/project-knowledge/PROJECT_MASTER.md).

## Карта проекта

- `src/` — SPA, UI, роуты, локали, бизнес-состояние и клиентская аналитика.
- `api/` — Vercel serverless endpoints и общая серверная логика.
- `server/` — альтернативный long-polling Telegram bot и локальная проверка ключей.
- `sql/`, `supabase/` — инкрементальные SQL-скрипты, RLS helpers и Edge Function.
- `public/` — публичная статика; не удалять без проверки runtime-ссылок и ссылок из данных.
- `tests/` — unit/API-тесты и E2E-пробы с изолированными заглушками.
- `docs/project-knowledge/` — master-документация и журнал изменений ИИ.

## Документы

Перед значимой работой прочитайте корневой [AGENTS.md](AGENTS.md) и [AI_CONTEXT.md](docs/project-knowledge/AI_CONTEXT.md). Главный справочник — [PROJECT_MASTER.md](docs/project-knowledge/PROJECT_MASTER.md); далее используйте профильные документы из `docs/project-knowledge/`. Исторические записи перенесены в [archive](docs/project-knowledge/archive/README.md).

SEO deployment notes: [SEO-DEPLOYMENT-NOTES.md](SEO-DEPLOYMENT-NOTES.md). Последний SEO/GEO отчёт и план: [SEO-GEO-FINAL-REPORT.md](docs/SEO-GEO-FINAL-REPORT.md), [SEO-GEO-90-DAY-PLAN.md](docs/SEO-GEO-90-DAY-PLAN.md).
