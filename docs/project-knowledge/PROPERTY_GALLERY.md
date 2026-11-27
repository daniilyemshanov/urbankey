# Apartment property gallery

## Component

`src/pages/PropertyPage.jsx` renders `src/components/Property.jsx` with `villa.images` from Supabase. Swiper handles the main apartment gallery; `src/components/GalleryModal.jsx` is the separate fullscreen viewer.

## Responsive overflow fix (2026-11-27)

The reported defect was specific to tablet/mobile widths: the gallery became white/blank and extended beyond the viewport while desktop sizing remained correct. The actual layout issue was the flex cross-axis. `.property .all` changed from a row to a column at 1024px but retained `align-items: flex-start`; its gallery child therefore did not stretch to the available width, and Swiper could keep a width based on its intrinsic/max width during responsive resize.

The responsive rule now stretches `.all`, gives `.swiperWrapper` an explicit full width and zero minimum width, constrains the Swiper to the container, and calls `swiper.update()` on resize. `touch-action: pan-y` preserves normal vertical page scrolling while leaving horizontal gestures available to Swiper. Desktop layout and autoplay remain unchanged.

## Verification and limits

`npm run build` succeeds. No test suite was run for this quick fix. A real phone/production URL was not available for visual confirmation. If a specific photo URL itself fails, that is a separate media issue and should be checked in the browser network panel.
