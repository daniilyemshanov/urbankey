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
