# Performance changes (UrbanKey)

Измерено локально в headless Chromium (mobile 412px, без троттлинга, без Supabase), НЕ Lighthouse:
- /ru: передано 1852 KB -> 1264 KB (JS 383->326, CSS 36->16, картинки 286->187, видео 1146->733)
- /ru/AboutUs: 16982 KB -> 1030 KB
Lighthouse/GTmetrix на проде нужно перезапустить после деплоя.

## Файлы
public: фото команды и партнёров .jpg -> .webp, logo-nav.webp (новый), favicon.png, Profile.svg, hero-bg.mp4 пережаты (оригиналы убраны, лежат в бэкапе)
src: Hero.jsx, Realtor.jsx, Partners.jsx, Nav.jsx, Footer.jsx(+css), What.jsx, App.jsx, main.jsx, MapComponent.jsx, analytics.js, Context.jsx
api: spa.js (preload героя на главной), _telegramPhotos.js, finalize-albums.js (cacheControl)
vercel.json (Cache-Control для /assets/* и медиа), vite.config.js (vendor-чанки), index.html (preconnect Supabase)
tests/preload.test.mjs (+ package.json test:all)

## Повторное измерение
npx lighthouse https://urbankey.uz/ru --preset=perf --form-factor=mobile --runs=5 --output=json --output-path=./lh-mobile.json
npx lighthouse https://urbankey.uz/ru --preset=desktop --output=json --output-path=./lh-desktop.json

Примечание: статика с именами без хеша кэшируется 30 дней — при замене файла переименовывайте его.
Уже загруженные в Supabase фото сохраняют cacheControl=3600 до перезаливки.

## Очистка
- Удалены: `on` (дамп git diff), `under CSP…` (дамп less), `УДАЛИТЬ.txt`, 5 неиспользуемых CSS-модулей из этого списка, `backups/` и `scripts/.reparse-cache.json` (создаются скриптом reparse, добавлены в .gitignore), 48 неиспользуемых файлов из `public/`.
- Комментарии удалены из .js/.jsx/.mjs/.cjs/.ts/.css/.scss/.sql/.html. Оставлены только директивы (eslint-disable и т.п.). Для JS/CSS/SCSS/SQL проверена идентичность кода без комментариев.
- eslint.config.js: no-empty разрешает пустой catch (в таких блоках был только комментарий).
- Не тронуты: .md, .env.example, .gitignore, supabase/config.toml, json.

## Этап 2 (мобильный LCP/CLS)
Стенд: headless Chromium, 412x823, Slow-4G (1.6 Мбит/с, 150 мс RTT), CPU x4, `/ru` через настоящий api/spa.js. Воспроизвёл PSI: LCP ~6.0-6.7 с, FCP ~1.0 с, CLS 0.077, LCP-элемент = VIDEO hero-bg.mp4.
- hero-poster.webp (36 КБ, первый кадр видео) + poster у <video> + preload в api/spa.js: LCP-кандидат теперь постер, а не загрузка видео.
- Секции под первым экраном (Feautured, CommercialSection, What, Questions, Footer) вынесены в ленивый чанк HomeSections: Swiper (~100 КБ) ушёл из главного бандла. Главный JS 490 -> 333 КБ, главный CSS 92 -> 26 КБ.
- index.css: серверная SEO-оболочка (main[data-ssr-seo]) выровнена по верхнему отступу героя (70/100 px): единственный layout shift исчез (CLS 0.077 -> 0).
- Preload большой картинки героя убран (конкурировал с JS за канал); у <img> остаётся fetchpriority=high.

Лабораторные результаты (медиана 4 прогонов, один и тот же стенд, не Lighthouse на проде):
  LCP: 6012 -> 4052 мс; CLS: 0.077 -> 0.000; FCP: ~950 -> ~960 мс.
  Остаток LCP ограничен объёмом JS (~270 КБ gzip) до монтирования героя.
