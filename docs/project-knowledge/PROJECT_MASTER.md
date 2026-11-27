# UrbanKey — Project Master

**Проверено по исходному ZIP:** 27.11.2026. Production-схема, credentials, домен и внешние аккаунты недоступны. Этот документ описывает код и конфигурации репозитория, а не обещает состояние production.

## 1. Назначение

UrbanKey — мультиязычный каталог квартир и коммерческой недвижимости в Ташкенте с публичными карточками, пользовательскими профилями и объявлениями, закрытыми admin-инструментами, приёмом лидов и Telegram-парсером.

## 2. Стек

- React 19, Vite 8, React Router 7, React Compiler; JavaScript/JSX.
- Supabase JS 2: Postgres, Auth, Storage; Supabase Edge Function на Deno.
- i18next / react-i18next, RU / UZ / EN.
- Vercel: статический client build, serverless handlers в `api/`, rewrites, redirects, headers и daily cron.
- React Hook Form, Framer Motion, Swiper, Sass/CSS modules, Leaflet/map integrations.
- Node.js: API, альтернативный Telegram long-poll bot; tests через `node:test`.

Точные версии и транзитивные зависимости зафиксированы в `package-lock.json`; диапазоны прямых зависимостей находятся в `package.json`. `engines.node` / `.nvmrc` не обнаружены, минимальная версия Node не закреплена в репозитории.

## 3. Структура

| Путь | Назначение |
|---|---|
| `src/main.jsx`, `src/App.jsx` | Инициализация React, корневой router и layout |
| `src/pages/` | Страницы публичной части, аккаунтов и admin |
| `src/components/`, `src/components/admin/` | UI, формы, списки, повторно используемые admin elements |
| `src/Context.jsx` | Общие данные, текущая сессия/профиль, объявления и CRUD |
| `src/context/CurrencyContext.jsx` | Форматирование/состояние валюты |
| `src/hooks/`, `src/utils/`, `src/api/` | Состояния, чистые helpers и клиентские API функции |
| `src/locales/{ru,en,uz}/translation.json`, `src/i18n.js` | UI-тексты и настройка переводов |
| `api/` | Vercel endpoints и общие серверные модули с `_` префиксом |
| `server/` | Запуск Telegram polling bot и локальный check-keys tool |
| `sql/`, `supabase/` | Эволюционные SQL-файлы, RLS/function scripts, Supabase config/Edge Function |
| `public/` | Публичные медиа, изображения, `robots.txt`, IndexNow key-file и другие ресурсы |
| `tests/` | Node tests и изолированный E2E/integration harness |
| `scripts/` | Ручное перепарсивание Telegram-объявлений |
| `docs/` | Текущий SEO/GEO отчет, план и техническая документация |
| `src/unused/` | React-компоненты, исключённые из runtime после import-path проверки |

## 4. Frontend entrypoint и routing

`index.html` загружает `/src/main.jsx`; main инициализирует i18n, Supabase/context и router. `App.jsx` содержит route tree и React lazy imports. Публичная языковая оболочка `/:lang` (`ru|en|uz`) обслуживает home, AboutUs, Properties, Services, ContactUs, Privacy, Terms, районные страницы, жилые и коммерческие listings. Старые пути перенаправляются в язык. Отдельные корневые маршруты обслуживают login/register, profile, favorites, user profile, listings и admin.

`vercel.json` задаёт permanent redirects, `/sitemap.xml → /api/sitemap`, локальные SEO URL → `/api/spa`, auth/admin routes → `index.html` для client routing и catch-all → API 404 shell. Не менять rewrite order без проверки всех route patterns: сначала точные SEO/server routes, затем SPA fallback.

## 5. Основные runtime-модули

- `src/Context.jsx`: основной store и действия для сессии, listings, профилей, favorites, lead admin data.
- `src/supabase.js`: клиентский Supabase singleton; использует только `VITE_SUPABASE_URL` и публичный `VITE_SUPABASE_KEY`.
- `src/api/villas.js`: запросы, относящиеся к villas.
- `src/utils/`: районные справочники/текст, языковые пути, деньги, filtering/search, SEO structured data, API lead submit, similar/viewed listings.
- `api/_publicDb.js`: публичные query helpers, listing existence/meta и district inventory.
- `api/_listingDb.js`: запись объявлений и альбомов с обработкой схемных вариантов.
- `api/listingParser.js`, `_listingFacts.js`, `_districtRules.js`, `aiProviders.js`: разбор постов, проверка извлечённых фактов и fallback AI providers.
- `api/_leadRouting.js`, `_leadManagers.js`, `_binotel.js`: классификация, назначение и синхронизация заявок.
- `api/_exchangeRate.js`: чтение курса ЦБ Узбекистана и обновление таблицы курса.
- `api/_telegramPhotos.js`: скачивание, преобразование/загрузка Telegram media и получение public URL.

## 6. Data flow и границы доверия

Browser SPA обращается к Supabase с anon/publishable key для user-facing действий и к `/api/*` для операций, которым нужны private credentials. Serverless/API используют env из runtime; секреты не должны иметь префикс `VITE_`. Supabase service-role key обходит RLS, поэтому использовать только в server-only коде и ограничить конкретной операцией.

```mermaid
flowchart LR
  Browser[React SPA] -->|anon key, user session| Supabase[Supabase Auth / Postgres / Storage]
  Browser -->|HTTPS| Vercel[Vercel routes and API]
  Vercel -->|service role where needed| Supabase
  Telegram[Telegram webhook or polling] --> Parser[listingParser + AI fallbacks]
  Parser --> Vercel
  Parser --> Supabase
  Browser -->|lead form| Lead[/api/lead]
  Lead --> Turnstile[Cloudflare Turnstile]
  Lead --> CRM[Binotel and optional CRM webhook]
  Lead --> Supabase
  Lead --> Telegram
  Browser --> GA4[GA4]
```

## 7. Авторизация и права

- Supabase Auth управляет user session. `Context.jsx` наблюдает session и загружает связанный `profiles` record.
- Client route guards в `App.jsx` используют загруженную роль `admin` для UI gating. Это не заменяет базовую защиту: безопасный доступ к DB обеспечивается RLS, а server routes должны валидировать вход.
- В репозитории есть `supabase/security_hardening.sql`, `admin_only_listings.sql`, `profiles_privacy.sql` и профильные migrations с policy/function definitions. Их фактическое применение и эффективные policy в production **Unknown**.
- `supabase/functions/delete-account`: Edge Function конфигурирует `verify_jwt = false`; код должен проверять авторизацию токена сам. Перед изменениями проверить её полный handler и production deployment status.
- Никогда не передавайте service-role key в браузер. Ряд серверных ботов может иметь explicit fallback на Vite anon key; администратор должен понимать RLS consequences и не считать такой режим production-safe без проверки.

## 8. Объявления недвижимости

Жилой каталог использует `cardss` как карточку/основную запись и `villas` как связанный объект с `card_id`; публичное чтение идёт через `cardss_public` и дополняется записью `villas`. Коммерческая ветка использует `commercials` (в коде также view `commercials_public`) и отдельные `commercial_pages` для расширенных данных; упрощённая запись commercial может отображаться без связанной `commercial_pages`.

`is_rent`, `is_sold`, `sold_at`, `updated_at` и связанные поля появляются в эволюционных scripts/queries. Код sitemap/API полагается на public views; точное production определение views неизвестно. Telegram webhook/poll bot разбирает source post, передаёт текст по настроенной цепочке AI-провайдеров и сохраняет listing/media. Точный алгоритм смотрите в `api/listingParser.js`, `api/_listingDb.js` и тестах `listing.*`.

## 9. Языки и контент

`src/i18n.js` и три translation JSON — клиентские переводы UI. Языковые URL — `/ru`, `/uz`, `/en`; SEO метаданные для statics находятся в `src/utils/staticPages.js`, районные strings в `districtPages.js` + `districtTexts.js`, SEO SSR handling — `api/_seoMeta.js`.

Не считать отсутствие перевода эквивалентом реального перевода: listing href alternate должен использовать только доступный контент. При добавлении ключа синхронно обновите RU/EN/UZ JSON и проверьте `node check-i18n.cjs`.

## 10. SEO / Local SEO / GEO

- Server-generated HTML через `api/spa.js` обслуживает public static, районные и активные object URLs; нет гарантии полного SSR для всех SPA routes.
- `api/sitemap.js` включает static routes, непустые районы и доступные языковые версии listing; errors чтения inventory должны быть 503, а не partial sitemap.
- `public/robots.txt`, `Seo.jsx`, `_seoMeta.js`, `staticPages.js`, `districtPages.js`, `structuredData.js` формируют правила обхода, metadata, hreflang/canonical, OG/Twitter, `RealEstateAgent`, `WebSite`, `BreadcrumbList`, listing JSON-LD.
- Текущий SEO/GEO аудит в `docs/SEO-GEO-FINAL-REPORT.md`; рабочий план в `SEO-GEO-90-DAY-PLAN.md`. Это локальные code review/build/tests, не production crawl, rank report или GSC data.
- Не добавлять страницы, брендовые факты, NAP, отзывы или кейсы без подтверждённых исходных данных.

## 11. GA4 и лиды

`src/analytics.js` инициализирует GA4 measurement ID, загружая `gtag.js` асинхронно; pageview SPA формируется в `App.jsx`. Параметры событий проходят sanitizer; submit success инициирует `generate_lead` только после ответа lead endpoint. Contact click events не передают телефон/Telegram username.

`api/lead.js` валидирует origin/payload, honeypot, rate limit, optional Turnstile и admin skip logic; сохраняет leads, отправляет Telegram notification, вызывает Binotel и optional external CRM. UI/CRM качество и GA4 property state требуют runtime доступа. Не отправлять PII, тексты форм, email/phone, auth IDs или секреты в GA4.

## 12. Интеграции

Точная статусная матрица, env names и неопределённости — `INTEGRATIONS.md`. По исходнику найдены Supabase, Telegram, Cloudflare Turnstile, Binotel, configurable CRM webhook, GA4, AI model providers, CBU FX, IndexNow, Google Translate endpoint, OpenStreetMap/Nominatim/OSRM и Vercel.

## 13. Tests, build, deploy

- `npm run test:all` — основной `node:test` набор: в проверенном snapshot 263/263 тестов прошли. Устаревший sitemap hardening test сохранён как `tests/archive/seo-hardening.test.mjs.disabled`: он импортировал несуществующие exports и проверял удалённую chunking-схему.
- `tests/e2e/` — отдельные тесты/пробы Supabase/route flows; изучите собственный README/config до запуска, часть требует локальной Supabase/Deno/browser.
- `npm run build` — Vite production client build; для production-эквивалентной проверки нужны корректные Vite env и assets. Snapshot build успешен, но показывает отсутствующий `%VITE_SUPABASE_URL%` и неразрешённый `/Abstract Design.png`; production build не доказан.
- `npm run lint` — полный ESLint; финальный запуск: 46 errors / 22 warnings в существующих файлах. ESLint для трёх перемещённых компонентов проходит.
- Vercel deployment, redirects, cron and serverless route configuration — `vercel.json`. В репозитории нет свидетельства успешного deploy, live DNS или production env.
- Supabase config: `supabase/config.toml`; Edge Function — `supabase/functions/delete-account/`.

## 14. Известные ограничения и техдолг

1. Ни Git metadata, ни production env/scheme/dashboard не предоставлены; git diff/history и факт миграций проверить нельзя.
2. Глобальный ESLint не проходит без общего debt pass; исправлять постепенно вместе с изменёнными модулями.
3. In-memory rate-limit Maps в serverless не являются глобальным/долговременным limiter: каждый процесс/invocation environment может иметь отдельное состояние.
4. Sitemap/district detection сканируют страницы и inventory запросами; масштабируемость должна подтверждаться DB query plans и объёмом production, не локальным архивом.
5. OAuth, role, views, policies, webhooks, AI credentials, Maps providers, analytics property, backups, cron/domain/WAF state внешние/Unknown.
6. Некоторые исторические README/отчёты описывают старые варианты; они сохранены в `docs/project-knowledge/archive/`.
7. `src/unused/` хранит кандидатов, исключённых по отсутствию ссылок в доступном source snapshot; повторно импортировать только после проверки актуальной потребности.

## 15. Безопасные изменения

Начинайте с `AGENTS.md` и `AI_CONTEXT.md`. Для API → `API.md`; схемы, Views, RLS и миграций → `DATABASE.md`; внешних service changes → `INTEGRATIONS.md`; SEO → `SEO_GEO.md`. Перед routing/component cleanup проверяйте route config, lazy imports, dynamic imports, E2E aliases, serverless references и static asset URLs. Сохраните неинвентаризированные public media и SQL. Не выполнять migrations, deploy, push или внешние account edits без явного задания. После изменения — целевые тесты, `npm run test:all`, build и изменённые ESLint scopes; обновить документацию/changelog.

