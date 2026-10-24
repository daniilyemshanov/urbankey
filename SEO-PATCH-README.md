# UrbanKey: SEO-патч (страницы районов + HTML для роботов)

## Что сделано
1. **Страницы районов** (квартиры и коммерция × 12 районов × ru/en/uz):
   `/ru/Properties/apartments/yunusabad`, `/ru/Properties/commercial/yunusabad`, ...
   У каждой свои title, description, canonical, hreflang, `<h1>` и абзац текста — прямо в HTML, без ожидания JavaScript.
2. **Общие страницы** (`/ru`, `/uz`, `/en`, `Properties`, `AboutUs`, `Services`, `ContactUs`): то же самое — свой серверный head и `<h1>` в HTML.
3. **Пустые районы**: если в районе нет объявлений, страница остаётся доступной людям, но получает `X-Robots-Tag: noindex` и не попадает в sitemap. Если база не ответила — ничего не скрывается.
4. **Ссылки**: блок «по районам» под каталогом на `/Properties` и на страницах районов.
5. **Title главной**: «Агентство недвижимости в Ташкенте — UrbanKey» (RU/EN/UZ, в `locales` и на сервере одинаково).
6. **vercel.json**: редирект `urbankeyy.vercel.app` → `urbankey.uz` (кроме `/api/`).

Что проверено: `vite build` проходит; серверная часть проверена на заглушках (статусы 200/404, title/canonical/h1, пустые районы, отказоустойчивость БД). На реальной базе и preview-деплое НЕ запускалось.

## Пошагово: что делать вам
**Шаг 1. Применить файлы.** Скопируйте содержимое папки `files/` поверх проекта (или `git apply changes-existing-files.diff`). Либо возьмите полный zip проекта.

**Шаг 2. Тексты районов.** Названия районов — официальные (Яккасарайский район и т. д.). Свои тексты вставляйте в `src/utils/districtTexts.js` (формат — в комментарии файла): они заменяют шаблон. Запасные описания лежат в `src/utils/districtPages.js` — черновики. Тексты общих страниц — в `src/utils/staticPages.js` (title/description там совпадают с `src/locales/*/translation.json`; меняете в одном месте — меняйте в обоих).

**Шаг 3. Проверить локально.** `npm install`, `npm run build`, `npm run dev`; откройте `/ru/Properties/apartments/yunusabad`.

**Шаг 4. Выложить на preview-деплой (ветка/preview в Vercel), проверить:**
- `curl -s https://<preview>/ru | grep -E "<title|<h1|canonical"` — свой title и h1 в HTML.
- `curl -s https://<preview>/ru/Properties/apartments/yunusabad | grep -E "<title|<h1|canonical"`.
- `curl -sI https://<preview>/ru/Properties/apartments/nonsense` → `404`.
- `https://<preview>/sitemap.xml` — есть `/Properties/apartments/...` и `/Properties/commercial/...` только для районов с объявлениями.
- В браузере: страницы районов показывают объявления, чипы районов ведут на другие районы, сайт выглядит как раньше.
- Telegram-бот и крон (`/api/...`) работают.

**Шаг 5. Деплой в продакшен.**

**Шаг 6. Cloudflare (www и без www).** Сейчас `www.urbankey.uz` отдаёт сайт, а Google часть страниц держит под www, игнорируя ваш canonical на `urbankey.uz`. В Cloudflare: Rules → Redirect Rules → создать правило: *Hostname equals www.urbankey.uz* → Dynamic redirect `concat("https://urbankey.uz", http.request.uri.path)` (с сохранением query string), код 301. Если есть обратное правило (urbankey.uz → www) — удалить. Проверка: `curl -sI https://www.urbankey.uz/ru` → 301 на `https://urbankey.uz/ru`, а `curl -sI https://urbankey.uz/ru` → 200.

**Шаг 7. Search Console** (ресурс sc-domain:urbankey.uz):
- Sitemaps → заново отправить `https://urbankey.uz/sitemap.xml`.
- Проверка URL → «Запросить индексирование» для: `/ru`, `/ru/Properties`, 3–4 страниц районов.
- Через 1–2 недели смотреть Эффективность (запросы, показы) и Индексирование страниц.

**Шаг 8. Карты и отзывы (без кода):** профиль в Google Business, 2GIS, Яндекс Карты (название, адрес, телефон, сайт — одинаково везде) и реальные отзывы клиентов.

**Шаг 9. Безопасность:** в присланном архиве лежал `.env`. Если архив уходил кому-то ещё — смените ключи (Supabase, Telegram, ИИ-провайдеры). В полный zip `.env` не включён.

## Ограничения
- Позиции в Google патч не гарантирует: он убирает технические препятствия и добавляет страницы под запросы.
- Серверная проверка пустых районов опирается на колонки представлений `cardss_public` и `commercials_public`; если их структура отличается от `sql/recreate_public_views.sql`, проверка вернёт «не удалось» и ничего не скроет.
